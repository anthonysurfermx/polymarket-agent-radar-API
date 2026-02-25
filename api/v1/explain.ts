import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from './_lib/middleware';
import type { ApiContext } from './_lib/types';
import { promptBuilders, getSystemPrompt } from './_lib/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default withAuth(async (req: VercelRequest, res: VercelResponse, _ctx: ApiContext) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { context, data, language = 'en' } = req.body || {};

  if (!context || !data) {
    return res.status(400).json({ ok: false, error: 'Missing context or data' });
  }

  const builder = promptBuilders[context];
  if (!builder) {
    return res.status(400).json({
      ok: false,
      error: `Invalid context: ${context}. Valid: ${Object.keys(promptBuilders).join(', ')}`,
    });
  }

  const systemPrompt = getSystemPrompt(language);
  const userPrompt = builder(data);

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: unknown) {
    console.error('[explain] AI stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to generate explanation' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
});
