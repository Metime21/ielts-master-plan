// api/gemini.ts

import { GoogleGenAI } from '@google/genai';

// Vercel 会安全地读取这个环境变量
const apiKey = process.env.GEMINI_API_KEY; 

if (!apiKey) {
    throw new Error('Serverless Function Error: GEMINI_API_KEY is not configured.');
}

const ai = new GoogleGenAI({ apiKey });

// Vercel Serverless Function 的标准入口
export default async (req: { body: any; method: string; }, res: any) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { contents } = req.body;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        res.status(200).json(response);
    } catch (error) {
        console.error('Gemini API Call Error:', error);
        res.status(500).json({ error: 'Internal Server Error during API call.' });
    }
};