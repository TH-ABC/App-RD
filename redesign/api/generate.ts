// /pages/api/generate.ts  (Next.js)
//-----------------------------------------------------------
// BACKEND OFFICIAL FOR PRODUCT PERFECT
// Hỗ trợ mọi action từ geminiService.ts
//-----------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

// Google API endpoint
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { action, prompt, image, userKey } = req.body;

  // chọn key: ưu tiên key người dùng → sau đó GEMINI_API_KEY trong Vercel
  const apiKey = userKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ error: "Missing GEMINI_API_KEY" });
  }

  //-----------------------------------------------------------
  // BUILD PROMPT THEO ACTION
  //-----------------------------------------------------------
  let parts: any[] = [];

  if (prompt) {
    parts.push({ text: prompt });
  }

  if (image) {
    parts.push({
      inlineData: {
        data: image.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      },
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
    },
  };

  //-----------------------------------------------------------
  // CALL GOOGLE API
  //-----------------------------------------------------------
  let googleRes = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await googleRes.json();

  if (json.error) {
    return res.status(400).json({ error: json.error.message, raw: json });
  }

  //-----------------------------------------------------------
  // EXTRACT RESPONSES TÙY THEO ACTION
  //-----------------------------------------------------------
  try {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 1) cleanup / remix / mockup → trả 1 image
    if (["cleanup", "remix", "mockup"].includes(action)) {
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
      return res.status(200).json({
        ok: true,
        image: match ? match[0] : null,
        raw: json,
      });
    }

    // 2) redesign → 6 images
    if (action === "redesign") {
      const matches = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);
      return res.status(200).json({
        ok: true,
        images: matches || [],
        raw: json,
      });
    }

    // 3) analyze / extract / splitCharacters → JSON
    if (["analyze", "extract", "splitCharacters"].includes(action)) {
      return res.status(200).json({
        ok: true,
        raw,
        json,
      });
    }

    return res.status(200).json({ ok: true, raw: json });
  } catch (e) {
    return res.status(200).json({ ok: true, raw: json });
  }
}
