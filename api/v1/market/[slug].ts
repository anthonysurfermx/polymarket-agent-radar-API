import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { polymarketService } from '../_lib/polymarket';
import { detectBot } from '../_lib/detector';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const slug = req.query.slug as string;
  if (!slug) {
    return res.status(400).json({ ok: false, error: 'Missing slug parameter' });
  }

  // Try as market first, then as event
  const market = await polymarketService.getMarketBySlug(slug);
  if (!market) {
    return res.status(404).json({ ok: false, error: 'Market not found' });
  }

  // Fetch holders
  const holders = await polymarketService.getMarketHolders(market.conditionId);

  // Run bot detection on top 10 holders (parallel, batches of 5)
  const topHolders = holders.slice(0, 10);
  const botResults: Record<string, any> = {};

  for (let i = 0; i < topHolders.length; i += 5) {
    const batch = topHolders.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (h) => {
        const result = await detectBot(h.address, {
          holderAmount: h.amount,
        });
        return { address: h.address, result };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        botResults[r.value.address] = r.value.result;
      }
    }
  }

  res.status(200).json({
    ok: true,
    data: {
      market,
      holders: holders.slice(0, 50), // Return top 50
      botDetection: botResults,
    },
  });
});
