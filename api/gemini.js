// /api/gemini.js - 最终纯 JavaScript 稳定版
const { GoogleGenAI } = require("@google/genai")
// 获取 Key
const apiKey = process.env.GEMINI_API_KEY
// 唯一导出的函数
module.exports = async function handler(req, res) {
// 1. 检查 Key 是否存在
if (!apiKey) {
return res.status(500).json({
error: "Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables."
})
}
// 2. 初始化 AI 客户端
const ai = new GoogleGenAI({ apiKey })
// 3. 检查请求方法
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' })
}
try {
// 4. 从请求体中解构出 contents 和 config
const { contents, config } = req.body
// 5. 调用 Gemini API
const response = await ai.models.generateContent({
model: 'gemini-2.5-flash',
contents: contents,
config: config,
})
// 6. 成功时返回 200
res.status(200).json(response)
} catch (error) {
// 7. 打印详细错误信息
console.error('Gemini API Call Error:', JSON.stringify(error, null, 2))
let errorMessage = 'Internal Server Error during API call. Check Vercel logs for details.'
if (error && typeof error === 'object' && 'message' in error) {
errorMessage = \Gemini API Failed: ${error.message}``
}
// 8. 返回 500 状态码给前端
res.status(500).json({ error: errorMessage })
}
}
