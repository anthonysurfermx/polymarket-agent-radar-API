import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { smartMoneyScan } from '../_lib/orchestrators';

export default withAuth(async (req: VercelRequest, res: VercelResponse, ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const category = (req.query.category as string) || 'OVERALL';
  const timePeriod = (req.query.timePeriod as string) || 'MONTH';
  const defaultCount = ctx.tier === 'free' ? 20 : 50;
  const walletCount = parseInt(req.query.walletCount as string) || defaultCount;

  try {
    const result = await smartMoneyScan({ category, timePeriod, walletCount });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    res.status(200).json({
      ok: true,
      data: {
        alphaSignals: result.alphaSignals,
        meta: result.meta,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Alpha signals scan failed';
    res.status(500).json({ ok: false, error: message });
  }
});
