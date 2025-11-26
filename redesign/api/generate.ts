import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, image } = req.body;

    if (!prompt && !image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }

    const raw = process.env.ULTRA_TOKEN;
    if (!raw) {
      return res.status(400).json({ error: "ULTRA_TOKEN is missing" });
    }

    let accessToken = "";

    try {
      const parsed = JSON.parse(raw);
      accessToken = parsed.access_token;
    } catch (e) {
      return res.status(400).json({ error: "Invalid ULTRA_TOKEN JSON format" });
    }

    if (!accessToken) {
      return res.status(400).json({ error: "access_token missing in ULTRA_TOKEN" });
    }

    // API sử dụng Bearer (KHÔNG dùng ?key=)
    const apiURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp:generateContent";

    const payload: any = {
      contents: [{ parts: [] }],
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

    const googleRes = await fetch(apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await googleRes.json();

    if (json.error) {
      console.error("Google API ERROR:", json.error);
      return res.status(400).json({ error: json.error.message });
    }

    // Extract image
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
