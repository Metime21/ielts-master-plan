// /api/gemini-edge.ts

export const config = {
  runtime: 'edge',
  maxDuration: 60,
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(request: Request) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Server Configuration Error: API Key missing" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const url = `${GEMINI_API_URL}${apiKey}`;
        
        // 1. 获取前端发送的完整 JSON 对象：{ contents, config }
        const requestBody = await request.json(); 

        // 2. 发送请求，使用最纯净的 headers
        const geminiResponse = await fetch(url, {
            method: 'POST',
            // 确保只发送 Content-Type
            headers: {
                'Content-Type': 'application/json',
            },
            // 确保请求体是 { contents: [...], config: {...} }
            body: JSON.stringify(requestBody) 
        });

        // 3. 检查 Google 的响应状态
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API HTTP Error:", errorText);
            
            // 尝试解析 Google 的 JSON 错误，如果解析失败，直接返回原始文本
            try {
                const errorJson = JSON.parse(errorText);
                 return new Response(JSON.stringify({ 
                    error: `Gemini API Error: ${errorJson.error?.message || 'Unknown Google 4XX Error'}`
                }), {
                    status: geminiResponse.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e) {
                 // 如果无法解析，直接将 400 错误文本返回给前端
                 return new Response(errorText, { status: geminiResponse.status });
            }
        }

        // 4. 成功时，直接返回 Google 的响应
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
