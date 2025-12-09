// api/gemini.ts
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = 'qwen-max';

if (!DASHSCOPE_API_KEY) {
  console.error('[FATAL] DASHSCOPE_API_KEY is missing');
  throw new Error('DASHSCOPE_API_KEY not configured');
}

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const { messages, systemInstruction } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers,
      });
    }

    for (const msg of messages) {
      if (!['user', 'assistant'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Message role must be user or assistant' }), {
          status: 400,
          headers,
        });
      }
      if (typeof msg.content !== 'string') {
        return new Response(JSON.stringify({ error: 'Message content must be string' }), {
          status: 400,
          headers,
        });
      }
    }

    let fullMessages = messages;
    if (typeof systemInstruction === 'string' && systemInstruction.trim() !== '') {
      fullMessages = [
        { role: 'system', content: systemInstruction.trim() },
        ...messages
      ];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
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

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Qwen API HTTP Error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to call Qwen API', details: errorText }), {
        status: response.status,
        headers,
      });
    }

    const data = await response.json();
    const output = data.output?.choices?.[0]?.message?.content;

    if (typeof output !== 'string' || output.trim() === '') {
      console.warn('Qwen returned empty or invalid response:', JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({
        error: 'AI returned invalid response',
        candidates: [{
          content: {
            parts: [{ text: 'Sorry, I cannot generate a valid response right now.' }],
            role: 'model',
          },
        }],
      }), {
        status: 502,
        headers,
      });
    }

    const tokenUsage = data.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: output.trim() }],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
      }],
      usageMetadata: {
        promptTokenCount: tokenUsage.input_tokens,
        candidatesTokenCount: tokenUsage.output_tokens,
        totalTokenCount: tokenUsage.total_tokens,
      },
    }), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Qwen] Request timed out after 55s');
      return new Response(JSON.stringify({
        error: 'AI response timed out. Full essay analysis may take up to one minute. Please try again or check your internet connection.'
      }), {
        status: 504,
        headers,
      });
    }
    console.error('Server Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers,
    });
  }
}
