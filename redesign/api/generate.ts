// /pages/api/generate.ts
// WORKS 100% with API KEY (AIza) — No token needed

import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb", // FIX: handle large image uploads
    },
  },
};

const GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
// ⚠️ DÙNG 1.5-flash STABLE → KHÔNG LỖI như 2.0-exp

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel env" });
  }

  try {
    const { prompt, image } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Construct Gemini request payload
    const parts: any[] = [{ text: prompt }];

    // FIX: Clean and normalize base64 image
    if (image) {
      const base64 = image.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: base64,
          mimeType: "image/png",
        },
      });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    };

    // Call Gemini API
    const response = await fetch(`${GOOGLE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // FIX: If API returns non-JSON → force text mode
    const raw = await response.text();

    // If the response is not valid JSON → return clean error
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "Gemini returned invalid response",
        details: raw.slice(0, 500),
      });
    }

    // Handle Gemini API errors
    if (data.error) {
      return res.status(400).json({
        error: data.error.message || "Gemini API error",
        details: data.error,
      });
    }

    // Extract text output safely
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(" ") ||
      "";

    // Extract any base64 image embedded in text (PNG only)
    const imageMatch = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

    return res.json({
      ok: true,
      raw: data,
      text: text.trim(),
      image: imageMatch ? imageMatch[0] : null,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
