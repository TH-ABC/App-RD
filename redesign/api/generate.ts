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
    const { prompt, image, userKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Determine API key priority: userKey > env
    const apiKey = userKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ 
        error: "No API Keys configured. Please add your Gemini API key." 
      });
    }

    // Build request payload
    const parts: any[] = [];
    parts.push({ text: prompt });

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: base64Data,
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

    // Call Gemini API
    const response = await fetch(`${GOOGLE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Handle API errors
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      
      // Check for quota errors
      if (data.error.code === 429 || data.error.message?.includes("quota")) {
        return res.status(429).json({ 
          error: "API quota exceeded. Please add more API keys or try again later." 
        });
      }
      
      return res.status(400).json({ 
        error: data.error.message || "Gemini API error" 
      });
    }

    // Extract text response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to extract base64 image if present
    const imageMatch = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

    return res.json({
      ok: true,
      raw: data,
      text,
      image: imageMatch ? imageMatch[0] : null,
    });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
}
