// /api/gemini.ts

// 导入 GoogleGenAI 和 Vercel 的 Request/Response 类型
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel 会自动从环境变量中读取 GEMINI_API_KEY
const apiKey = process.env.GEMINI_API_KEY; 

// 如果没有 Key，直接返回一个错误提示，而不是初始化 API 客户端
if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from Vercel Environment Variables!");
    // 返回一个简单的函数，如果调用发生，则抛出错误
    export default async function handler(req: VercelRequest, res: VercelResponse) {
        res.status(500).json({ error: "Configuration Error: GEMINI_API_KEY is not set." });
    }
    // 阻止后续代码运行
    return; 
}

// 在这里初始化 AI 客户端，确保 Key 是存在的
const ai = new GoogleGenAI({ apiKey });

// 实际处理请求的函数
export default async function handler(req: VercelRequest, res: VercelResponse) { 
    // 检查请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 从请求体中解构出内容
        const { contents, config } = req.body;

        // 调用 Gemini API
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: config, // 允许传入系统指令等配置
        });

        // 成功时返回 200
        res.status(200).json(response);
    } catch (error) {
        // 🚨 修复 ReferenceError: res is not defined
        // 确保 res 对象在这里可用，因为它是函数 handler 的参数。

        // 强制打印错误对象的完整 JSON 结构，用于诊断 Key 无效/权限不足
        console.error('Gemini API Call Error:', JSON.stringify(error, null, 2)); 
        
        let errorMessage = 'Internal Server Error during API call. Check Vercel logs for details.';
        
        // 尝试从 Gemini API 错误中提取详细信息
        if (error && typeof error === 'object' && 'message' in error) {
            // 如果是 Google API 错误，通常会包含详细的错误信息
            errorMessage = `Gemini API Failed: ${error.message}`;
        }

        // 🚨 返回 500 状态码给前端，而不是之前的欺骗性 200
        res.status(500).json({ error: errorMessage });
    }
}