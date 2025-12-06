// /api/gemini.js - 最终 ES Modules 稳定版
import { GoogleGenAI } from "@google/genai"
export default async function handler(req, res) {
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
return res.status(500).json({
error: "Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables."
})
}
const ai = new GoogleGenAI({ apiKey })
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' })
}
try {
const { contents, config } = req.body
const response = await ai.models.generateContent({
model: 'gemini-2.5-flash',
contents: contents,
config: config,
})
res.status(200).json(response)
} catch (error) {
console.error('Gemini API Call Error:', JSON.stringify(error, null, 2))
let errorMessage = 'Internal Server Error during API call. Check Vercel logs for details.'
if (error && typeof error === 'object' && 'message' in error) {
errorMessage = \Gemini API Failed: ${error.message}``
}
res.status(500).json({ error: errorMessage })
}
}
