// /api/gemini-serverless.ts

import { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server Configuration Error: API Key missing" });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        const url = `${GEMINI_API_URL}${apiKey}`;
        
        const requestBody = req.body; 
        const { contents, config } = requestBody;
        const systemInstruction = config?.systemInstruction;

        let finalUrl = `${url}`;
        if (systemInstruction) {
             finalUrl += `&systemInstruction=${encodeURIComponent(systemInstruction)}`;
        }
        
        const geminiResponse = await fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents }) 
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API HTTP Error:", errorText);
            
            try {
                 const errorJson = JSON.parse(errorText);
                 return res.status(geminiResponse.status).json({ 
                    error: `Gemini API Error: ${errorJson.error?.message || 'Unknown Google 4XX Error'}`
                });
            } catch (e) {
                 return res.status(geminiResponse.status).send(errorText);
            }
        }

        const responseJson = await geminiResponse.json();
        return res.status(200).json(responseJson);

    } catch (error) {
        console.error("Fatal Fetch/Network Error:", error);
        return res.status(500).json({ 
            error: `Network Connection Failed: ${error.message || 'Unknown network error'}`
        });
    }
}
