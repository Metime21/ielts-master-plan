// /api/proxy.ts

import { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 设置 60 秒的 CORS 头部，防止浏览器预检失败，虽然不能解决超时，但能提供更友好的错误信息
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server Configuration Error: API Key missing" });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        const url = `${GEMINI_API_URL}${apiKey}`;
        
        // 1. 获取前端发送的完整 JSON 对象：{ contents, config }
        const requestBody = req.body; 
        const { contents, config } = requestBody;
        const systemInstruction = config?.systemInstruction;

        // 2. 构造请求 URL，将 systemInstruction 作为查询参数（解决 400 结构错误）
        let finalUrl = `${url}`;
        if (systemInstruction) {
             finalUrl += `&systemInstruction=${encodeURIComponent(systemInstruction)}`;
        }
        
        // 3. 发送请求，请求体中只包含 contents
        const geminiResponse = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contents: contents }) 
        });

        // 4. 检查 Google 的响应状态 (4XX/5XX)
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            // ... (错误处理逻辑不变)
             return res.status(geminiResponse.status).send(errorText); // 直接返回 Google 错误文本
        }

        // 5. 成功时，返回 JSON
        const responseJson = await geminiResponse.json();
        return res.status(200).json(responseJson);

    } catch (error) {
        console.error("Fatal Fetch/Network Error:", error);
        return res.status(500).json({ 
            error: `Network Connection Failed: ${error.message || 'Unknown network error'}`
        });
    }
}
