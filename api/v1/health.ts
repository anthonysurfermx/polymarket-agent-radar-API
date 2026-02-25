import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from './_lib/middleware';

const startedAt = Date.now();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.status(200).json({
    ok: true,
    version: '1.0.0',
    service: 'Polymarket Agent Radar API',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/usage',
      'GET /api/v1/smart-money',
      'GET /api/v1/smart-money/alpha',
      'GET /api/v1/smart-money/convergence',
      'GET /api/v1/trader/:address/reliability',
      'GET /api/v1/wallet/:address',
      'GET /api/v1/market/:slug',
      'GET /api/v1/bonds',
      'GET /api/v1/orderbook/:tokenId',
      'GET /api/v1/open-interest/:conditionId',
      'GET /api/v1/open-interest?conditionIds=...',
      'POST /api/v1/explain',
    ],
  });
}
