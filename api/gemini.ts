// /api/gemini.ts - 最终修复版本：解决 SyntaxError
// 导入 GoogleGenAI 客户端和 Vercel 的类型定义
import { GoogleGenAI } from "@google/genai";
// 引入 Vercel 的 Request/Response 类型
import type { VercelRequest, VercelResponse } from '@vercel/node';
// Vercel 会自动从环境变量中读取 GEMINI_API_KEY
const apiKey = process.env.GEMINI_API_KEY;
// Key 存在，初始化 AI 客户端（注意：Key 检查现在移入 handler 函数内部）
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
/**
* 实际处理请求的 Vercel Serverless Function。
* 这是唯一一个 export default 的函数。
*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
// 1. 检查 Key 是否存在（修复 SyntaxError 的关键）
if (!apiKey || !ai) {
return res.status(500).json({
error: "Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables."
});
}
// 2. 检查请求方法
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' });
}
try {
// 3. 从请求体中解构出 contents 和 config
const { contents, config } = req.body;
// 4. 调用 Gemini API
// 注意：ai 变量已经被 if 检查确保非空
const response = await ai.models.generateContent({
model: 'gemini-2.5-flash',
contents: contents,
config: config, // 允许传入系统指令等配置
});
// 5. 成功时返回 200
res.status(200).json(response);
} catch (error) {
// 6. 强制打印错误对象的完整 JSON 结构 (用于诊断 Key 无效/权限不足)
console.error('Gemini API Call Error:', JSON.stringify(error, null, 2));
let errorMessage = 'Internal Server Error during API call. Check Vercel logs for details.';
// 尝试从 Gemini API 错误中提取详细信息
if (error && typeof error === 'object' && 'message' in error) {
errorMessage = \Gemini API Failed: ${error.message}`;`
}
// 7. 返回 500 状态码给前端
res.status(500).json({ error: errorMessage });
}
}
