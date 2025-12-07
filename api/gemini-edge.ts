// /api/gemini-edge.ts

export const config = {
  runtime: 'edge', // ⬅️ 启用边缘运行环境
  maxDuration: 60, // ⬅️ 保持 60 秒超时
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
        
        // 3. 提取请求体内容
        const body = await request.json();

        // 4. 使用原生的 fetch API 发送请求
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body) // 直接发送前端的 body (contents, config)
        });

        // 5. 将 Gemini 的响应直接返回给前端
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
