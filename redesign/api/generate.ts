import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

// -------------------------------------------------------
// GOOGLE MODEL (GENERATION)
// -------------------------------------------------------
const MODEL = "gemini-2.0-flash"; // có thể đổi sang Ultra nếu muốn

// -------------------------------------------------------
// HÀM GỌI GOOGLE GENAI
// -------------------------------------------------------
async function callGoogleAPI(prompt: string, imageBase64?: string, apiKey?: string) {
  const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

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

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
    },
  };

  const res = await fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json;
}

// -------------------------------------------------------
// MAIN API
// -------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, prompt, image, userKey } = req.body;

    const apiKey =
      userKey ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Missing GEMINI_API_KEY environment variable" });
    }

    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    // ---------------------------------------------------
    // 1️⃣ CLEANUP — REMOVE BACKGROUND
    // ---------------------------------------------------
    if (action === "cleanup") {
      const cleanPrompt = `
Remove background, isolate subject, perfect edges.
Return ONLY base64 PNG.
      `;

      const json = await callGoogleAPI(cleanPrompt, image, apiKey);

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.status(200).json({
        ok: true,
        image: match ? match[0] : null,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 2️⃣ ANALYZE — TRẢ VỀ JSON
    // ---------------------------------------------------
    if (action === "analyze") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 3️⃣ EXTRACT ELEMENTS
    // ---------------------------------------------------
    if (action === "extract") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 4️⃣ REDESIGN — OUTPUT 6 IMAGES
    // ---------------------------------------------------
    if (action === "redesign") {
      const json = await callGoogleAPI(prompt, undefined, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 5️⃣ REMIX IMAGE
    // ---------------------------------------------------
    if (action === "remix") {
      const remixPrompt = `
Modify this image following user instructions.
Return PNG base64 only.
      `;

      const json = await callGoogleAPI(remixPrompt + "\n" + prompt, image, apiKey);

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.status(200).json({
        ok: true,
        image: match ? match[0] : null,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 6️⃣ SPLIT CHARACTERS
    // ---------------------------------------------------
    if (action === "splitCharacters") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // 7️⃣ MOCKUP
    // ---------------------------------------------------
    if (action === "mockup") {
      const mockPrompt = `
Place this object into a premium product mockup.
Return PNG base64 only.
      `;

      const json = await callGoogleAPI(mockPrompt, image, apiKey);

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);

      return res.status(200).json({
        ok: true,
        image: match ? match[0] : null,
        raw: json,
      });
    }

    // ---------------------------------------------------
    // ❌ UNKNOWN ACTION
    // ---------------------------------------------------
    return res.status(400).json({ error: "Unknown action" });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server Error" });
  }
}
