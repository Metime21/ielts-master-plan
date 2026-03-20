type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface GeminiProxyResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

const extractTextFromProxyResponse = (data: GeminiProxyResponse): string => {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('AI returned empty or malformed response.');
  }

  return text.trim();
};

const fetchGeminiProxy = async (
  payload: {
    messages: ChatMessage[];
    systemInstruction?: string;
  },
  signal?: AbortSignal
): Promise<GeminiProxyResponse> => {
  let response: Response;

  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!response.ok) {
    let errorDetail = response.statusText || 'Unknown error';

    try {
      const errorData = await response.json();
      errorDetail = errorData.error || errorData.details || errorDetail;
    } catch {
      // Fall back to the HTTP status text.
    }

    throw new Error(`Proxy failed (${response.status}): ${errorDetail}`);
  }

  const data = (await response.json()) as GeminiProxyResponse;
  extractTextFromProxyResponse(data);
  return data;
};

export const generateGeminiResponse = async (
  input: string | ChatMessage[],
  systemInstruction?: string,
  signal?: AbortSignal
): Promise<string> => {
  let messages: ChatMessage[];

  if (typeof input === 'string') {
    messages = [{ role: 'user', content: input }];
  } else if (Array.isArray(input)) {
    messages = input;
  } else {
    throw new Error('Invalid input to generateGeminiResponse: must be string or ChatMessage[]');
  }

  try {
    const payload = { messages, systemInstruction };
    const jsonResponse = await fetchGeminiProxy(payload, signal);
    return extractTextFromProxyResponse(jsonResponse);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    console.error('Gemini Proxy Call Error:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};

export const translateAndDefine = async (
  word: string,
  signal?: AbortSignal
): Promise<string> => {
  const prompt = `
You are an expert IELTS dictionary assistant. Provide a concise answer in Markdown format for the word: "${word}".

Include:
1. **IPA pronunciation** (e.g., /ˈdeɪ.tə/)
2. **Chinese meaning**
3. **Brief English definition**
4. **2-3 IELTS collocations** (with Chinese)
5. **One example sentence** (English + Chinese translation)

Keep it clean and structured.
`;

  return generateGeminiResponse(prompt, 'Be accurate, concise, and helpful.', signal);
};
