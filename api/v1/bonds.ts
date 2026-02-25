import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from './_lib/middleware';
import type { ApiContext } from './_lib/types';
import { polymarketService } from './_lib/polymarket';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const minPrice = parseFloat(req.query.minPrice as string) || 0.90;
  const maxPrice = parseFloat(req.query.maxPrice as string) || 0.99;
  const minLiquidity = parseFloat(req.query.minLiquidity as string) || 500;
  const minVolume = parseFloat(req.query.minVolume as string) || 1000;
  const limit = parseInt(req.query.limit as string) || 100;
  const sort = (req.query.sort as string) || 'apy';

  const bonds = await polymarketService.getBondMarkets({
    minPrice,
    maxPrice,
    minLiquidity,
    minVolume,
    limit,
  });

  // Sort by requested field
  if (sort === 'return') {
    bonds.sort((a, b) => b.returnPct - a.returnPct);
  } else if (sort === 'liquidity') {
    bonds.sort((a, b) => b.liquidity - a.liquidity);
  } else if (sort === 'volume') {
    bonds.sort((a, b) => b.volume - a.volume);
  }
  // Default sort is apy (already sorted by getBondMarkets)

  res.status(200).json({
    ok: true,
    data: bonds,
    meta: {
      count: bonds.length,
      filters: { minPrice, maxPrice, minLiquidity, minVolume, limit, sort },
    },
  });
});
