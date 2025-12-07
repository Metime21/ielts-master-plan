// src/services/geminiService.ts

const fetchGeminiProxy = async (contents: any, config?: any): Promise<any> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contents, config }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Proxy failed: ${errorData.error}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No AI response received");
  }

  return data;
};

export const generateGeminiResponse = async (prompt: string, systemInstruction?: string): Promise<string> => {
  const userMessage = { role: 'user', parts: [{ text: prompt }] };
  const config = { systemInstruction };

  try {
    const jsonResponse = await fetchGeminiProxy([userMessage], config);
    const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('AI returned empty or invalid response:', jsonResponse);
      return "Sorry, I couldn't generate a meaningful response. Please try rephrasing your question.";
    }

    return text.trim();
  } catch (error) {
    console.error("Gemini Proxy Call Error:", error);
    return "Sorry, I encountered an error connecting to the AI. Please check your network and try again.";
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
