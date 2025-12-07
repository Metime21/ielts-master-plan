// api/gemini.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[1] Function started | Method:", req.method);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[FATAL] GEMINI_API_KEY is missing");
    return res.status(500).json({ error: "Missing API key" });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contents, systemInstruction } = req.body; // ← 直接解构 systemInstruction

    // 构造合法的请求体
    const geminiRequestBody: any = { contents };

    // ✅ 正确添加 systemInstruction（顶层字段，不是 contents 的一部分）
    if (systemInstruction && typeof systemInstruction === 'string') {
      geminiRequestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const fullUrl = `${GEMINI_API_URL}?key=${apiKey}`;

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody)
    });

    console.log("[6] Google API responded | Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[7] Google API Error Response:", errorText.substring(0, 200));
      return res.status(response.status).json({ error: "Google API returned error", details: errorText });
    }

    let result;
    try {
      result = await response.json();
      console.log("[8] Parsed JSON successfully | Candidates:", result.candidates?.length);
    } catch (parseError) {
      const rawText = await response.text();
      console.error("[PARSE ERROR] Raw response:", rawText.substring(0, 300));
      return res.status(500).json({ error: "Invalid response from AI provider", raw: rawText.substring(0, 200) });
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error("[9] Unhandled error:", error.message || error);
    return res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
}
