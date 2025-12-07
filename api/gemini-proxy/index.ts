// /api/gemini-proxy/index.ts

import { VercelRequest, VercelResponse } from '@vercel/node';

// 移除 Edge Function 的 export const config
// export const config = { runtime: 'edge', maxDuration: 60, }; // ⬅️ 已删除

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 强制设置超时为 60 秒（通过 Vercel Platform API/CLI 覆盖）
    // 此处无法设置，依赖 vercel.json 的 maxDuration

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
        
        // 2. 提取 contents 和 systemInstruction
        const { contents, config } = requestBody;
        const systemInstruction = config?.systemInstruction;

        // 3. 构造请求 URL，将 systemInstruction 作为查询参数
        let finalUrl = `${url}`;
        if (systemInstruction) {
             finalUrl += `&systemInstruction=${encodeURIComponent(systemInstruction)}`;
        }
        
        // 4. 发送请求
        const geminiResponse = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 请求体中只包含 Google 绝对需要的 contents 字段
            body: JSON.stringify({ contents: contents }) 
        });

        // 5. 检查 Google 的响应状态 (4XX/5XX)
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API HTTP Error:", errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                 return res.status(geminiResponse.status).json({ 
                    error: `Gemini API Error: ${errorJson.error?.message || 'Unknown Google 4XX Error'}`
                });
            } catch (e) {
                 return res.status(geminiResponse.status).send(errorText);
            }
        }

        // 6. 成功时，返回 JSON
        const responseJson = await geminiResponse.json();
        return res.status(200).json(responseJson);

    } catch (error) {
        console.error("Fatal Fetch/Network Error:", error);
        return res.status(500).json({ 
            error: `Network Connection Failed: ${error.message || 'Unknown network error'}`
        });
    }
}
