import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server Configuration Error: API Key missing" });
    }
    
    // 构造请求 URL
    const url = `${GEMINI_API_URL}${apiKey}`;

    try {
        const { contents, config } = req.body;
        
        // 使用原生的 fetch API 发送请求
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                config: config
            })
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            // 如果 HTTP 状态码不是 2xx，捕获错误
            const errorDetail = jsonResponse.error?.message || "Unknown API Error";
            console.error("Gemini API HTTP Error:", errorDetail);
            return res.status(response.status).json({ 
                error: `Gemini API HTTP Error: ${errorDetail}`
            });
        }
        
        // 成功返回
        res.status(200).json(jsonResponse);

    } catch (error: any) {
        // 捕获所有网络或解析错误
        console.error("Fatal Fetch/Network Error:", error);
        res.status(500).json({ 
            error: `Network Connection Failed: ${error.message || 'Check Vercel Firewall/Network Logs'}`
        });
    }
}
