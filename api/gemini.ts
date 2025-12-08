// api/gemini.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = 'qwen-max'; // qwen-max supports full context

if (!DASHSCOPE_API_KEY) {
  console.error('[FATAL] DASHSCOPE_API_KEY is missing');
  throw new Error('DASHSCOPE_API_KEY not configured');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[1] Function started | Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages, systemInstruction } = req.body;

    // 验证 messages 格式
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    for (const msg of messages) {
      if (!['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Message role must be user or assistant' });
      }
      if (typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'Message content must be string' });
      }
    }

    // 确保 systemInstruction 是字符串
    const system = typeof systemInstruction === 'string' ? systemInstruction : '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          messages,
          system, // ✅ 正确方式：system 放在 input.system
        },
        parameters: {
          result_format: 'message',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Qwen API HTTP Error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Failed to call Qwen API', details: errorText });
    }

    const data = await response.json();

    const output = data.output?.choices?.[0]?.message?.content || '';
    const tokenUsage = data.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

    return res.status(200).json({
      candidates: [
        {
          content: {
            parts: [{ text: output }],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: tokenUsage.input_tokens,
        candidatesTokenCount: tokenUsage.output_tokens,
        totalTokenCount: tokenUsage.total_tokens,
      },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Qwen] Request timed out');
      return res.status(504).json({ error: 'AI response timed out. Please try again.' });
    }
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
