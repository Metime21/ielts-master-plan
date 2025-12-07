import { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Received request to /api/gemini | Method:", req.method, "| Time:", new Date().toISOString());

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return res.status(500).json({ error: "Server Configuration Error: API Key not configured" });
  }

  if (req.method !== 'POST') {
    console.warn("Invalid method used:", req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contents, config } = req.body;
    const systemInstruction = config?.systemInstruction;

    const finalContents = [];
    if (systemInstruction) {
      finalContents.push({
        role: 'system',
        parts: [{ text: systemInstruction }]
      });
    }
    finalContents.push(...contents);

    const fullUrl = `${GEMINI_API_URL}?key=${apiKey}`;

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: finalContents
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return res.status(response.status).json({ error: "Gemini API Error: " + errorText });
    }

    const result = await response.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error("Network Error:", error);
    return res.status(500).json({ error: "Network Error" });
  }
}
