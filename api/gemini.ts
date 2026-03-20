import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = 'qwen3-max-2026-01-23';
const REQUEST_TIMEOUT_MS = 55000;
const DASHSCOPE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

type IncomingMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type DashscopeMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const isValidIncomingMessage = (value: unknown): value is IncomingMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as IncomingMessage;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
};

const buildErrorText = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    return text || response.statusText || 'Unknown upstream error';
  } catch {
    return response.statusText || 'Unknown upstream error';
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('[api/gemini] DASHSCOPE_API_KEY is missing');
    return res.status(500).json({ error: 'AI service is not configured.' });
  }

  const { messages, systemInstruction } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  if (!messages.every(isValidIncomingMessage)) {
    return res.status(400).json({
      error: 'Each message must include role ("user" | "assistant") and string content',
    });
  }

  const fullMessages: DashscopeMessage[] =
    typeof systemInstruction === 'string' && systemInstruction.trim() !== ''
      ? [{ role: 'system', content: systemInstruction.trim() }, ...messages]
      : messages;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          messages: fullMessages,
        },
        parameters: {
          result_format: 'message',
          max_tokens: 2048,
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await buildErrorText(response);
      console.error('[api/gemini] Qwen API HTTP Error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to call Qwen API',
        details: errorText,
      });
    }

    const data = await response.json();
    const output = data?.output?.choices?.[0]?.message?.content;

    if (typeof output !== 'string' || output.trim() === '') {
      console.warn(
        '[api/gemini] Qwen returned empty or invalid response:',
        JSON.stringify(data, null, 2)
      );
      return res.status(502).json({
        error: 'AI returned invalid response',
      });
    }

    const usage = data?.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    return res.status(200).json({
      candidates: [
        {
          content: {
            parts: [{ text: output.trim() }],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: usage.input_tokens,
        candidatesTokenCount: usage.output_tokens,
        totalTokenCount: usage.total_tokens,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[api/gemini] Request timed out after 55s');
      return res.status(504).json({
        error:
          'AI response timed out. Full essay analysis may take up to one minute. Please try again or check your internet connection.',
      });
    }

    console.error('[api/gemini] Server Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    clearTimeout(timeoutId);
  }
}
