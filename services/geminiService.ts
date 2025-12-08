// src/services/geminiService.ts

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * 调用本地代理接口 /api/gemini
 * 接收标准 messages 数组和可选 systemInstruction
 */
const fetchGeminiProxy = async (payload: {
  messages: ChatMessage[];
  systemInstruction?: string;
}): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
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
 * 生成 AI 响应
 * 
 * 支持两种调用方式：
 * 1. generateGeminiResponse(prompt: string, systemInstruction?) → 用于字典等单轮场景
 * 2. generateGeminiResponse(messages: ChatMessage[], systemInstruction?) → 用于多轮聊天
 * 
 * ❌ 不接受 { contents: [...] } 等 Google Gemini 格式
 */
export const generateGeminiResponse = async (
  input: string | ChatMessage[],
  systemInstruction?: string
): Promise<string> => {
  let messages: ChatMessage[];

  if (typeof input === 'string') {
    // 单轮模式：字典、简单问答
    messages = [{ role: 'user', content: input }];
  } else if (Array.isArray(input)) {
    // 多轮模式：聊天上下文
    messages = input;
  } else {
    // 防御性编程：拒绝非法输入（如 { contents: [...] }）
    console.error('[geminiService] Invalid input type:', input);
    throw new Error('Invalid input to generateGeminiResponse: must be string or ChatMessage[]');
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

/**
 * 字典查询专用函数
 * 使用单条 prompt + 固定系统指令
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
