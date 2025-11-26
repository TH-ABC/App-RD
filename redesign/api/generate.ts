import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, image } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // ❗ API KEY CHỈ LẤY TỪ VERCEL ENV
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Server missing GEMINI_API_KEY in environment variables.",
      });
    }

    // Build payload
    const parts: any[] = [{ text: prompt }];

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
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    // Call Gemini
    const response = await fetch(`${GOOGLE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Handle API Errors
    if (data.error) {
      console.error("Gemini API Error:", data.error);

      if (data.error.code === 429) {
        return res.status(429).json({
          error: "Gemini API Quota exceeded.",
        });
      }

      return res.status(400).json({
        error: data.error.message || "Gemini API error",
      });
    }

    // Extract text
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Detect embedded image
    const imageMatch = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

    return res.status(200).json({
      ok: true,
      text,
      image: imageMatch ? imageMatch[0] : null,
      raw: data,
    });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
