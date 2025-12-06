// /api/gemini.ts - Vercel Serverless Function for Secure Gemini API Proxy

// 导入 GoogleGenAI 客户端和 Vercel 的类型定义 import { GoogleGenAI } from "@google/genai"; // 引入 Vercel 的 Request/Response 类型 import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel 会自动从环境变量中读取 GEMINI_API_KEY const apiKey = process.env.GEMINI_API_KEY;

// 🚨 检查 Key 是否存在，如果不存在，导出一个返回 500 错误的函数 if (!apiKey) { console.error("Configuration Error: GEMINI_API_KEY is missing from Vercel Environment Variables!");

}

// Key 存在，初始化 AI 客户端 const ai = new GoogleGenAI({ apiKey });
/**

实际处理请求的 Vercel Serverless Function。

@param req Vercel 请求对象

@param res Vercel 响应对象 */ export default async function handler(req: VercelRequest, res: VercelResponse) { // 1. 检查请求方法 if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

try { // 2. 从请求体中解构出 contents 和 config const { contents, config } = req.body;

} catch (error) {
}