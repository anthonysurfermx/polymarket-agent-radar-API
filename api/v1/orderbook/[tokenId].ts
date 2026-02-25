import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../_lib/middleware';
import type { ApiContext } from '../_lib/types';
import { polymarketService } from '../_lib/polymarket';

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const tokenId = req.query.tokenId as string;
  if (!tokenId) {
    return res.status(400).json({ ok: false, error: 'Missing tokenId parameter' });
  }

  const orderbook = await polymarketService.getOrderBook(tokenId);
  if (!orderbook) {
    return res.status(404).json({ ok: false, error: 'Order book not found' });
  }

  res.status(200).json({ ok: true, data: orderbook });
});
