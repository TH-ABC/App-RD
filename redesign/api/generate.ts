import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb", // cho phép nhận hình lớn
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, image, mode } = req.body;

    if (!prompt && !image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }

    const token = process.env.ULTRA_TOKEN;
    if (!token) {
      return res.status(400).json({ error: "Missing ULTRA_TOKEN environment variable" });
    }

    // gọi Google API Pro
    const apiURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp:generateContent";

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

    const googleRes = await fetch(`${apiURL}?key=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await googleRes.json();

    // Nếu Google trả lỗi
    if (json.error) {
      console.error("Google API ERROR:", json.error);
      return res.status(400).json({ error: json.error.message });
    }

    // Trích image từ response (nếu có)
    let base64Image = null;

    try {
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
      if (match) base64Image = match[0];
    } catch (e) {}

    return res.status(200).json({
      ok: true,
      image: base64Image,
      raw: json,
    });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server Error" });
  }
}
