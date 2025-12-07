// api/gemini.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = 'qwen-max'; // 可选: qwen-plus, qwen-turbo

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
    const { contents, systemInstruction } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    // 转换 Gemini 格式 → Qwen 格式
    const messages = contents.map((part: any) => ({
      role: part.role === 'model' ? 'assistant' : 'user',
      content: part.parts?.[0]?.text || '',
    }));

    // 添加 systemInstruction（如果存在）
    if (systemInstruction && typeof systemInstruction === 'string') {
      messages.unshift({
        role: 'system',
        content: systemInstruction,
      });
    }

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
        },
        parameters: {
          result_format: 'message',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qwen API Error:', errorText);
      return res.status(response.status).json({ error: 'Failed to call Qwen API', details: errorText });
    }

    const data = await response.json();

    // 转换回 Gemini 兼容格式
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
  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
