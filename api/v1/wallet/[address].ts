import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { polymarketService } from '../_lib/polymarket';
import { detectBot } from '../_lib/detector';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ ok: false, error: 'Missing address parameter' });
  }

  // Fetch metrics, positions, and bot detection in parallel
  const [metrics, positions, botResult] = await Promise.all([
    polymarketService.getAgentMetrics(address),
    polymarketService.getAgentPositions(address, 200),
    detectBot(address),
  ]);

  res.status(200).json({
    ok: true,
    data: {
      metrics,
      positions,
      botDetection: botResult,
    },
  });
});
