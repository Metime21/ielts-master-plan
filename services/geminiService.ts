// src/services/geminiService.ts

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * 调用本地代理接口 /api/gemini
 * 支持 AbortSignal 用于取消请求（提升交互稳定性）
 */
const fetchGeminiProxy = async (
  payload: {
    messages: ChatMessage[];
    systemInstruction?: string;
  },
  signal?: AbortSignal
): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal, // ✅ 透传 AbortSignal
  });

  if (!response.ok) {
    // 尝试解析详细错误
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.error || errorData.details || response.statusText;
    } catch {
      // fallback to status text
    }

    throw new Error(`Proxy failed (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('AI returned empty or malformed response');
  }

  return data;
};

/**
 * 生成 AI 响应
 *
 * 支持两种调用方式：
 * 1. generateGeminiResponse(prompt: string, systemInstruction?, signal?)
 * 2. generateGeminiResponse(messages: ChatMessage[], systemInstruction?, signal?)
 */
export const generateGeminiResponse = async (
  input: string | ChatMessage[],
  systemInstruction?: string,
  signal?: AbortSignal // ✅ 新增可选 signal
): Promise<string> => {
  let messages: ChatMessage[];

  if (typeof input === 'string') {
    messages = [{ role: 'user', content: input }];
  } else if (Array.isArray(input)) {
    messages = input;
  } else {
    console.error('[geminiService] Invalid input type:', input);
    throw new Error('Invalid input to generateGeminiResponse: must be string or ChatMessage[]');
  }

  try {
    const payload = { messages, systemInstruction };
    const jsonResponse = await fetchGeminiProxy(payload, signal);
    const text = jsonResponse.candidates[0].content.parts[0].text;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('AI returned empty or invalid response:', jsonResponse);
      return "Sorry, I couldn't generate a meaningful response. Please try rephrasing your question.";
    }

    return text.trim();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // 被主动取消（如用户发新消息）
      throw error; // 让调用方决定是否忽略
    }

    console.error('Gemini Proxy Call Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return `AI service error: ${msg}`;
  }
};

/**
 * 字典查询专用函数（单轮，不支持取消）
 */
export const translateAndDefine = async (word: string): Promise<string> => {
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

  try {
    // 字典查询通常很短，不需要取消
    const responseText = await generateGeminiResponse(prompt, "Be accurate, concise, and helpful.");
    
    if (!responseText || responseText.trim().length === 0) {
      return "Definition search failed. The AI returned no content. Please try again.";
    }

    return responseText;
  } catch (error) {
    console.error("TranslateAndDefine Error:", error);
    return "Definition search failed. Please check your API connection or try again.";
  }
};
