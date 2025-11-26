import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { action, prompt, image, userKey } = req.body;

    const apiKey = userKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing GEMINI_API_KEY" });
    }

    // ----------------------------------------------------
    // Helper: build request body
    // ----------------------------------------------------
    const buildPayload = () => {
      const parts: any[] = [];
      if (prompt) parts.push({ text: prompt });

      if (image) {
        parts.push({
          inlineData: {
            data: image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/png",
          },
        });
      }

      return {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
        },
      };
    };

    // ----------------------------------------------------
    // Helper: call Gemini
    // ----------------------------------------------------
    const callGemini = async () => {
      const response = await fetch(`${GOOGLE_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      return await response.json();
    };

    // ----------------------------------------------------
    // ACTIONS ROUTER
    // ----------------------------------------------------
    let raw = await callGemini();

    if (raw.error) {
      console.error("Gemini API Error:", raw.error);
      return res.status(400).json({ error: raw.error.message });
    }

    const text =
      raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // ----------------------------------------------------
    // 1️⃣ CLEANUP → return image
    // ----------------------------------------------------
    if (action === "cleanup") {
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
      return res.json({ ok: true, image: match ? match[0] : null, raw });
    }

    // ----------------------------------------------------
    // 2️⃣ ANALYZE → return JSON
    // ----------------------------------------------------
    if (action === "analyze") {
      try {
        const json = JSON.parse(text);
        return res.json({ ok: true, raw, ...json });
      } catch {
        return res.json({
          ok: true,
          raw,
          title: "",
          description: "",
          redesignPrompt: "Create an improved redesign.",
          detectedComponents: [],
          detectedType: "",
          strategy: "basic",
        });
      }
    }

    // ----------------------------------------------------
    // 3️⃣ EXTRACT ELEMENTS → return array
    // ----------------------------------------------------
    if (action === "extract") {
      try {
        const arr = JSON.parse(text);
        return res.json({ ok: true, raw, elements: arr });
      } catch {
        return res.json({ ok: true, raw, elements: [] });
      }
    }

    // ----------------------------------------------------
    // 4️⃣ REDESIGN → extract 6 PNG images
    // ----------------------------------------------------
    if (action === "redesign") {
      const matches = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);
      return res.json({ ok: true, raw, images: matches || [] });
    }

    // ----------------------------------------------------
    // 5️⃣ REMIX → return 1 PNG
    // ----------------------------------------------------
    if (action === "remix") {
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
      return res.json({ ok: true, raw, image: match ? match[0] : null });
    }

    // ----------------------------------------------------
    // 6️⃣ SPLIT CHARACTERS → return JSON array
    // ----------------------------------------------------
    if (action === "splitCharacters") {
      try {
        const arr = JSON.parse(text);
        return res.json({ ok: true, raw, images: arr });
      } catch {
        return res.json({ ok: true, raw, images: [] });
      }
    }

    // ----------------------------------------------------
    // 7️⃣ MOCKUP → return 1 PNG
    // ----------------------------------------------------
    if (action === "mockup") {
      const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
      return res.json({ ok: true, raw, image: match ? match[0] : null });
    }

    // ----------------------------------------------------
    // Default fallback
    // ----------------------------------------------------
    return res.json({ ok: true, raw, text });

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
