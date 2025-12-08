// src/services/geminiService.ts

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * 调用本地代理接口 /api/gemini
 * 注意：现在代理必须接收 Qwen 格式的 { messages, systemInstruction }
 */
const fetchGeminiProxy = async (payload: {
  messages: ChatMessage[];
  systemInstruction?: string;
}): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: '??POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Proxy failed: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No AI response received");
  }

  return data;
};

/**
 * 重载 generateGeminiResponse：
 * - 如果第一个参数是 string → 单轮模式（用于字典）
 * - 如果第一个参数是数组 → 多轮上下文模式（用于聊天）
 */
export const generateGeminiResponse = async (
  input: string | ChatMessage[],
  systemInstruction?: string
): Promise<string> => {
  let messages: ChatMessage[];

  if (typeof input === 'string') {
    // 单轮模式（字典、简单问答）
    messages = [{ role: 'user', content: input }];
  } else {
    // 多轮模式（聊天上下文）
    messages = input;
  }

  try {
    const payload = { messages, systemInstruction };
    const jsonResponse = await fetchGeminiProxy(payload);
    const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('AI returned empty or invalid response:', jsonResponse);
      return "Sorry, I couldn't generate a meaningful response. Please try rephrasing your question.";
    }

    return text.trim();
  } catch (error) {
    console.error("Gemini Proxy Call Error:", error);
    return `AI service error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

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
