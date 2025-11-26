import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb", // cho phép ảnh lớn
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, image } = req.body;

    if (!prompt && !image) {
      return res
        .status(400)
        .json({ error: "Missing prompt or image input." });
    }

    const API_KEY = process.env.API_KEY || process.env.ULTRA_TOKEN;

    if (!API_KEY) {
      return res
        .status(400)
        .json({ error: "Missing API_KEY in Vercel Environment Variables." });
    }

    // ==========================================================
    // 🔥 MODEL ĐÚNG — KHÔNG BAO GIỜ LỖI
    // ==========================================================
    const MODEL = "gemini-1.5-flash-latest";
    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    // ==========================================================
    // 🔥 BUILD PAYLOAD GỬI LÊN GOOGLE
    // ==========================================================
    const payload: any = {
      contents: [
        {
          parts: [],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
      },
    };

    if (prompt) {
      payload.contents[0].parts.push({ text: prompt });
    }

    if (image) {
      payload.contents[0].parts.push({
        inlineData: {
          data: image.replace(/^data:image\/\w+;base64,/, ""),
          mimeType: "image/png",
        },
      });
    }

    // ==========================================================
    // 🔥 CALL GOOGLE AI
    // ==========================================================
    const googleRes = await fetch(`${apiURL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await googleRes.json();

    // ==========================================================
    // 🔥 HANDLE ERROR
    // ==========================================================
    if (json.error) {
      console.error("Google API Error:", json.error);
      return res.status(400).json({ error: json.error.message });
    }

    // ==========================================================
    // 🔥 TRY EXTRACT BASE64 IMAGE FROM RESPONSE
    // ==========================================================
    let base64Image: string | null = null;

    try {
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // match data:image/png;base64,...
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      if (match) {
        base64Image = match[0];
      }
    } catch (e) {
      console.warn("Image extract failed", e);
    }

    // ==========================================================
    // 🔥 RETURN OUTPUT
    // ==========================================================
    return res.status(200).json({
      ok: true,
      image: base64Image, // null nếu model chỉ trả text
      raw: json,
    });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
