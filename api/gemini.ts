// api/gemini.ts

import { GoogleGenAI } from '@google/genai';

// Vercel Serverless Function 的标准入口
export default async (req: { body: any; method: string; }, res: any) => {
    // 1. 检查请求方法
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // 2. 将 API Key 检查和初始化放在请求处理内部
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // 返回 500 错误，并显示详细信息（供您调试）
        console.error('Configuration Error: GEMINI_API_KEY is missing.');
        res.status(500).json({ error: 'Configuration Error: API Key is not set on Vercel.' });
        return;
    }

    try {
        // 3. 只有在 Key 存在时才初始化 AI 客户端
        const ai = new GoogleGenAI({ apiKey });
        const { contents } = req.body;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        res.status(200).json(response);
    } catch (error) {
        // 捕获 API 调用失败的错误
        console.error('Gemini API Call Error:', error);
        res.status(500).json({ error: 'Internal Server Error during API call. Check Vercel logs for API Key validation status.' });
    }
};