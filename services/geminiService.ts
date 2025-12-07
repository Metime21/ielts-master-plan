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

    if (!text || typeof text !== 'string') {
      return "Sorry, I couldn't generate a response.";
    }

    return text.trim();
  } catch (error) {
    console.error("Gemini Proxy Call Error:", error);
    return "Sorry, I encountered an error connecting to the AI.";
  }
};

export const translateAndDefine = async (text: string): Promise<string> => {
  const prompt = `
Role: Professional English-Chinese Dictionary & IELTS Tutor.
Target Word/Phrase: "${text}"

Please provide a structured Markdown response with the following sections:

1.  **Phonetics & Meaning**
    * IPA: /.../
    * Chinese: [Concise translation]
    * Definition: [Brief English definition]
    
2.  **IELTS High-Frequency Collocations/Phrases** (Crucial: Provide 2-3 relevant phrases)
    * [Phrase 1] - [Chinese]
    * [Phrase 2] - [Chinese]
    
3.  **Example Sentence**
    * [Sentence containing the word]
    * ([Chinese translation of sentence])

Keep the output clean and strictly formatted for easy reading.
`;

  return await generateGeminiResponse(prompt, "You are a helpful and professional IELTS Dictionary assistant.");
};
