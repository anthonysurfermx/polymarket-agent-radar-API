import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import type { ApiContext } from './types';

// ---------------------------------------------------------------------------
// Supabase admin client (service role -- never exposed to the browser)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// Handler signature used by every endpoint
// ---------------------------------------------------------------------------
type Handler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: ApiContext,
) => Promise<any>;

// ---------------------------------------------------------------------------
// CORS helper -- exported so individual handlers can call it for OPTIONS, etc.
// ---------------------------------------------------------------------------
export function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

// ---------------------------------------------------------------------------
// Returns the ISO-8601 timestamp of the next midnight UTC (rate limit reset)
// ---------------------------------------------------------------------------
export function getNextMidnightUTC(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return next.toISOString();
}

// ---------------------------------------------------------------------------
// withAuth -- wraps a handler with API-key auth + daily rate limiting
// ---------------------------------------------------------------------------
export function withAuth(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    // ── CORS ──────────────────────────────────────────────────────────────
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      // ── Extract API key ───────────────────────────────────────────────
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({
          ok: false,
          error:
            'Missing or invalid API key. Use Authorization: Bearer bw_live_xxx',
        });
        return;
      }

      const parts = authHeader.split(' ');
      const apiKey = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

      if (
        !apiKey ||
        (!apiKey.startsWith('bw_live_') && !apiKey.startsWith('bw_test_'))
      ) {
        res.status(401).json({
          ok: false,
          error:
            'Missing or invalid API key. Use Authorization: Bearer bw_live_xxx',
        });
        return;
      }

      // ── Hash the key (we never store plaintext) ───────────────────────
      const keyHash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');

      // ── Derive the endpoint path for logging ──────────────────────────
      const endpoint =
        typeof req.url === 'string' ? req.url.split('?')[0] : '/unknown';

      // ── Validate key + atomically increment daily counter ─────────────
      const { data, error: rpcError } = await supabase.rpc('validate_api_key', {
        p_key_hash: keyHash,
        p_endpoint: endpoint,
      });

      if (rpcError) {
        console.error('[middleware] validate_api_key RPC error:', rpcError);
        res.status(500).json({ ok: false, error: 'Internal server error' });
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || !row.key_id) {
        res.status(401).json({ ok: false, error: 'Invalid API key' });
        return;
      }

      // ── Rate limit check ──────────────────────────────────────────────
      const limit: number = row.daily_limit;
      const used: number = row.current_count;
      const remaining = Math.max(limit - used, 0);
      const resetsAt = getNextMidnightUTC();

      if (!row.is_allowed) {
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetsAt);
        res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded',
          limit,
          used,
          resetsAt,
        });
        return;
      }

      // ── Attach rate limit headers to every successful response ────────
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', resetsAt);

      // ── Build context and hand off to the actual handler ──────────────
      const ctx: ApiContext = {
        keyId: row.key_id,
        tier: row.tier,
        dailyLimit: limit,
        currentCount: used,
      };

      await handler(req, res, ctx);
    } catch (err: unknown) {
      console.error('[middleware] Unhandled error:', err);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
}
