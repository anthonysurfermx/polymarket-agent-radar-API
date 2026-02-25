import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { polymarketService } from '../_lib/polymarket';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const raw = req.query.conditionIds as string;
  if (!raw) {
    return res.status(400).json({
      ok: false,
      error: 'Missing conditionIds query parameter. Usage: ?conditionIds=id1,id2,id3',
    });
  }

  const conditionIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (conditionIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid conditionIds provided' });
  }

  if (conditionIds.length > 50) {
    return res.status(400).json({ ok: false, error: 'Max 50 conditionIds per request' });
  }

  const oiMap = await polymarketService.getBatchOpenInterest(conditionIds);

  const result: Record<string, number> = {};
  for (const [id, oi] of oiMap) {
    result[id] = oi;
  }

  res.status(200).json({
    ok: true,
    data: result,
    meta: { requested: conditionIds.length, found: oiMap.size },
  });
});
