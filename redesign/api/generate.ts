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
    const { prompt, image, mode } = req.body || {};

    if (!prompt && !image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }

    // Lấy API key từ env (ưu tiên GEMINI_API_KEY)
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.ULTRA_TOKEN; // fallback nếu bạn vẫn dùng tên ULTRA_TOKEN

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY / API_KEY / ULTRA_TOKEN environment variable",
      });
    }

    // Model text + image ổn định (có thể đổi sang pro nếu bạn muốn)
    const apiURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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

    const googleRes = await fetch(apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Dùng API key dạng header, KHÔNG phải Bearer token
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const json = await googleRes.json();

    // Nếu Google trả lỗi
    if (!googleRes.ok) {
      console.error("Google API ERROR:", json);
      return res.status(400).json({
        error:
          json?.error?.message ||
          `Upstream error: ${googleRes.status} ${googleRes.statusText}`,
      });
    }

    // Trả raw data về cho frontend (frontend tự xử lý tiếp)
    return res.status(200).json({
      ok: true,
      data: json,
    });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server Error" });
  }
}
