import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const FLASH_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function buildPayload(prompt: string, imageBase64?: string) {
  const parts: any[] = [];
  if (prompt) parts.push({ text: prompt });

  if (imageBase64) {
    parts.push({
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      },
    });
  }

  return {
    contents: [{ parts }],
    generationConfig: { temperature: 0.7, topP: 0.95, topK: 40 },
  };
}

async function callGemini(apiKey: string, payload: any) {
  const res = await fetch(`${FLASH_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, prompt, image } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "Missing GEMINI_API_KEY" });

    if (!action) return res.status(400).json({ error: "Missing action" });

    // =============================================
    // ACTION: CLEANUP (remove background)
    // =============================================
    if (action === "cleanup") {
      const payload = buildPayload(
        "Remove background, clean edges, return PNG base64 only.",
        image
      );
      const data = await callGemini(apiKey, payload);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.json({ ok: true, image: match?.[0] || null, raw: data });
    }

    // =============================================
    // ACTION: ANALYZE
    // =============================================
    if (action === "analyze") {
      const payload = buildPayload(prompt, image);
      const data = await callGemini(apiKey, payload);

      return res.json({ ok: true, raw: data });
    }

    // =============================================
    // ACTION: EXTRACT ELEMENTS
    // =============================================
    if (action === "extract") {
      const payload = buildPayload(prompt, image);
      const data = await callGemini(apiKey, payload);

      return res.json({ ok: true, raw: data });
    }

    // =============================================
    // ACTION: REDESIGN → trả về nhiều ảnh
    // =============================================
    if (action === "redesign") {
      const payload = buildPayload(prompt);
      const data = await callGemini(apiKey, payload);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const matches = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);

      return res.json({ ok: true, images: matches || [], raw: data });
    }

    // =============================================
    // ACTION: REMIX
    // =============================================
    if (action === "remix") {
      const payload = buildPayload(prompt, image);
      const data = await callGemini(apiKey, payload);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.json({ ok: true, image: match?.[0] || null, raw: data });
    }

    // =============================================
    // ACTION: SPLIT CHARACTERS
    // =============================================
    if (action === "splitCharacters") {
      const payload = buildPayload(prompt, image);
      const data = await callGemini(apiKey, payload);

      return res.json({ ok: true, raw: data });
    }

    // =============================================
    // ACTION: MOCKUP
    // =============================================
    if (action === "mockup") {
      const payload = buildPayload(prompt, image);
      const data = await callGemini(apiKey, payload);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.json({ ok: true, image: match?.[0] || null, raw: data });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
