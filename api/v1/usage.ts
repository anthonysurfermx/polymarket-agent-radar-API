import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from './_lib/middleware';
import type { ApiContext } from './_lib/types';

export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const nextMidnight = new Date();
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  nextMidnight.setUTCHours(0, 0, 0, 0);

  res.status(200).json({
    ok: true,
    data: {
      tier: ctx.tier,
      requestsToday: ctx.currentCount,
      requestsLimit: ctx.dailyLimit,
      requestsRemaining: Math.max(0, ctx.dailyLimit - ctx.currentCount),
      resetsAt: nextMidnight.toISOString(),
    },
  });
});
