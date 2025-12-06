// /api/gemini.ts - Vercel Serverless Function for Secure Gemini API Proxy
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
console.error("Configuration Error: GEMINI_API_KEY is missing from Vercel Environment Variables!");
export default async function handler(req: VercelRequest, res: VercelResponse) {
res.status(500).json({
error: "Configuration Error: GEMINI_API_KEY is not set in Vercel Environment Variables."
});
}
throw new Error("API Key configuration missing.");
}
const ai = new GoogleGenAI({ apiKey });
/**
*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method Not Allowed' });
}
try {
const { contents, config } = req.body;
const response = await ai.models.generateContent({
model: 'gemini-2.5-flash',
contents: contents,
config: config,// 允许传入系统指令等配置
});
res.status(200).json(response);
} catch (error) {
console.error('Gemini API Call Error:', JSON.stringify(error, null, 2));
let errorMessage = 'Internal Server Error during API call. Check Vercel logs for details.';
if (error && typeof error === 'object' && 'message' in error) {
errorMessage = \Gemini API Failed: ${error.message}`;`
}
res.status(500).json({ error: errorMessage });
}
}
