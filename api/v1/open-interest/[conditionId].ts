import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { polymarketService } from '../_lib/polymarket';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const conditionId = req.query.conditionId as string;
  if (!conditionId) {
    return res.status(400).json({ ok: false, error: 'Missing conditionId parameter' });
  }

  const oi = await polymarketService.getOpenInterest(conditionId);

  res.status(200).json({
    ok: true,
    data: { conditionId, openInterest: oi },
  });
});
