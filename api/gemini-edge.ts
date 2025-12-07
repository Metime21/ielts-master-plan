// /api/gemini-edge.ts

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(request: Request) {
    // 1. 获取 Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Server Configuration Error: API Key missing" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 2. 检查请求方法
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const url = `${GEMINI_API_URL}${apiKey}`;
        
        // 3. 获取前端发送的完整 JSON 对象：{ contents, config }
        const requestBody = await request.json(); 

        // 4. 使用原生的 fetch API 发送请求，直接将前端对象作为请求体
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 确保请求体是 { contents: [...], config: {...} }
            body: JSON.stringify(requestBody) 
        });

        // 5. 检查 Google 的响应状态
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API HTTP Error:", errorText);
            
            // 尝试解析 Google 的 JSON 错误，如果解析失败，直接返回原始文本
            try {
                const errorJson = JSON.parse(errorText);
                 return new Response(JSON.stringify({ 
                    error: `Gemini API Error: ${errorJson.error?.message || 'Unknown 4XX Error'}`
                }), {
                    status: geminiResponse.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e) {
                 return new Response(errorText, { status: geminiResponse.status });
            }
        }

        // 6. 将成功的响应返回给前端
        return geminiResponse; 

    } catch (error) {
        console.error("Fatal Fetch/Network Error:", error);
        return new Response(JSON.stringify({ 
            error: `Edge Network Connection Failed: ${error.message || 'Unknown network error'}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
