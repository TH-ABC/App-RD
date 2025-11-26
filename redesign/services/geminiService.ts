// pages/api/generate.ts
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
    const { action, prompt, image, userKey } = req.body as {
      action?: string;
      prompt?: string;
      image?: string;
      userKey?: string;
    };

    // ⚠️ Check cơ bản: phải có prompt hoặc image
    if (!prompt && !image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }

    // 🔑 Chọn key: ưu tiên GEMINI_API_KEY trên server
    const apiKey = process.env.GEMINI_API_KEY || userKey;

    if (!apiKey) {
      return res
        .status(400)
        .json({ error: "Missing GEMINI_API_KEY (or userKey) environment variable" });
    }

    // Bạn đang dùng GEMINI TEXT+IMAGE MODEL → gemini-2.0-flash
    const apiURL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    // ---- BUILD PAYLOAD CHUNG ----
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

    // 1) TEXT PROMPT (mọi action đều dùng)
    if (prompt) {
      payload.contents[0].parts.push({ text: prompt });
    }

    // 2) IMAGE INPUT (cho cleanup / remix / mockup / analyze / extract / splitCharacters)
    if (image) {
      payload.contents[0].parts.push({
        inlineData: {
          data: image.replace(/^data:image\/\w+;base64,/, ""),
          mimeType: "image/png",
        },
      });
    }

    // (Optional) Tuning theo action – cho đẹp, không bắt buộc
    if (action === "analyze" || action === "extract" || action === "splitCharacters") {
      payload.generationConfig.temperature = 0.2; // ổn định hơn cho JSON
    }

    // ---- CALL GOOGLE API ----
    const googleRes = await fetch(`${apiURL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await googleRes.json();

    // Nếu Google trả lỗi
    if (!googleRes.ok || json.error) {
      console.error("Google API ERROR:", json.error || json);
      return res.status(400).json({
        error:
          json.error?.message || json.error || "Google API error. Check quota / key / model.",
      });
    }

    // ---- PARSE IMAGE (nếu model trả base64 trong text) ----
    let base64Image: string | null = null;

    try {
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
      if (match) {
        base64Image = match[0];
      }
    } catch (e) {
      // không sao, có thể action đó chỉ trả JSON chứ không có image
    }

    // ---- TRẢ VỀ CHO FRONTEND ----
    return res.status(200).json({
      ok: true,
      image: base64Image,
      raw: json,
      action: action || null,
    });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server Error" });
  }
}
