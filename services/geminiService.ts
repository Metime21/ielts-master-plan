// services/geminiservices.ts

// 定义一个通用的请求函数，它将请求发送给 Vercel 代理
const fetchGeminiProxy = async (contents: any, config?: any): Promise<any> => {
    const response = await fetch('/api/gemini-edge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Vercel 代理需要 { contents, config } 结构
        body: JSON.stringify({ contents, config }),
    });

    if (!response.ok) {
        // 如果代理返回非 200 状态码 (例如代理自身错误 500)，抛出错误
        const errorData = await response.json();
        throw new Error(`API Proxy failed with status ${response.status}: ${errorData.error}`);
    }

    // 假设 Vercel 代理返回的是 Gemini API 的完整 JSON 响应
    return await response.json();
};


// 1. 生成 AI 响应 (用于 AI Tutor)
export const generateGeminiResponse = async (prompt: string, systemInstruction?: string): Promise<string> => {
    
    // 构造发送给代理的请求体
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const config = { systemInstruction };
    
    try {
        const jsonResponse = await fetchGeminiProxy(contents, config);
        
        // 解析 Gemini API 响应结构
        const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return text || "No response generated from AI.";
        
    } catch (error) {
        console.error("Gemini Proxy Call Error:", error);
        return "Sorry, I encountered an error connecting to the AI.";
    }
};

// 2. 翻译和定义 (用于 Dictionary Widget)
export const translateAndDefine = async (text: string): Promise<string> => {
    
    // 复用您原始文件中的结构化提示词
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
    
    // 最终调用 generateGeminiResponse，它会通过代理发送请求
    return await generateGeminiResponse(prompt, "You are a helpful and professional IELTS Dictionary assistant.");
};
