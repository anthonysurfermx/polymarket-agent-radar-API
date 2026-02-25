import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../_lib/middleware';
import type { ApiContext } from '../../_lib/types';
import { computeTraderReliability } from '../../_lib/compute';
import { polymarketService } from '../../_lib/polymarket';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ ok: false, error: 'Missing address parameter' });
  }

  // Fetch positions and closed positions for reliability calculation
  const [positions, closedPositions] = await Promise.all([
    polymarketService.getAgentPositions(address, 200),
    polymarketService.getClosedPositions(address, 100),
  ]);

  const reliability = computeTraderReliability(address, positions, closedPositions);

  res.status(200).json({
    ok: true,
    data: reliability,
  });
});
