-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── API KEYS ───
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  owner_email TEXT NOT NULL,
  owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  label TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  daily_limit INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON public.api_keys (key_hash);
CREATE INDEX idx_api_keys_owner ON public.api_keys (owner_email);
CREATE INDEX idx_api_keys_active ON public.api_keys (is_active) WHERE is_active = TRUE;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on api_keys" ON public.api_keys
  FOR ALL USING (auth.role() = 'service_role');

-- ─── API USAGE LOG ───
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX idx_api_usage_key_date ON public.api_usage (api_key_id, usage_date);
CREATE INDEX idx_api_usage_date ON public.api_usage (usage_date);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on api_usage" ON public.api_usage
  FOR ALL USING (auth.role() = 'service_role');

-- ─── DAILY USAGE COUNTER (fast rate limit check) ───
CREATE TABLE public.api_daily_counts (
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, usage_date)
);

ALTER TABLE public.api_daily_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on api_daily_counts" ON public.api_daily_counts
  FOR ALL USING (auth.role() = 'service_role');

-- ─── RPC: Validate key + increment counter atomically ───
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT, p_endpoint TEXT)
RETURNS TABLE(
  key_id UUID,
  tier TEXT,
  daily_limit INTEGER,
  current_count INTEGER,
  is_allowed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key_id UUID;
  v_tier TEXT;
  v_daily_limit INTEGER;
  v_current_count INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT ak.id, ak.tier, ak.daily_limit
  INTO v_key_id, v_tier, v_daily_limit
  FROM public.api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.is_active = TRUE
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW());

  IF v_key_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0, 0, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.api_daily_counts (api_key_id, usage_date, request_count)
  VALUES (v_key_id, v_today, 1)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = public.api_daily_counts.request_count + 1
  RETURNING request_count INTO v_current_count;

  -- Only update last_used_at every 5 min to reduce write pressure
  UPDATE public.api_keys SET last_used_at = NOW()
  WHERE id = v_key_id AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '5 minutes');

  -- NOTE: api_usage inserts moved to async/batch for production scale.
  -- For MVP, we log only if under 1000 req/day to avoid table bloat.
  IF v_current_count <= 1000 THEN
    INSERT INTO public.api_usage (api_key_id, endpoint)
    VALUES (v_key_id, p_endpoint);
  END IF;

  RETURN QUERY SELECT v_key_id, v_tier, v_daily_limit, v_current_count, (v_current_count <= v_daily_limit);
END;
$$;

-- ─── RPC: Generate a new API key ───
CREATE OR REPLACE FUNCTION public.create_api_key(
  p_owner_email TEXT,
  p_tier TEXT DEFAULT 'free',
  p_label TEXT DEFAULT NULL,
  p_is_test BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT;
  v_random TEXT;
  v_full_key TEXT;
  v_hash TEXT;
  v_limit INTEGER;
BEGIN
  v_prefix := CASE WHEN p_is_test THEN 'bw_test_' ELSE 'bw_live_' END;
  v_random := encode(gen_random_bytes(24), 'hex');
  v_full_key := v_prefix || v_random;
  v_hash := encode(digest(v_full_key, 'sha256'), 'hex');

  v_limit := CASE p_tier
    WHEN 'free' THEN 50
    WHEN 'pro' THEN 1000
    WHEN 'enterprise' THEN 10000
    ELSE 10
  END;

  INSERT INTO public.api_keys (key_prefix, key_hash, owner_email, label, tier, daily_limit, is_test)
  VALUES (v_prefix || left(v_random, 4), v_hash, p_owner_email, p_label, p_tier, v_limit, p_is_test);

  RETURN v_full_key;
END;
$$;
