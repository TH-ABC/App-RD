// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb", // cho phép hình lớn
    },
  },
};

// -----------------------------------------------------
// Helper: gọi Google API
// -----------------------------------------------------
async function callGoogleAPI(prompt: string, imageBase64: string | null, apiKey: string) {
  const apiURL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const payload: any = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
    },
  };

  if (imageBase64) {
    payload.contents[0].parts.push({
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/png",
      },
    });
  }

  const res = await fetch(`${apiURL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  return json;
}

// -----------------------------------------------------
// Helper: Extract image from Gemini response
// (Có cả inlineData & fallback regex)
// -----------------------------------------------------
function extractImage(json: any): string | null {
  // 1️⃣ NEW FORMAT — inlineData
  try {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const inline = parts.find((p: any) => p.inlineData);

    if (inline?.inlineData?.data) {
      return "data:image/png;base64," + inline.inlineData.data;
    }
  } catch {}

  // 2️⃣ OLD FORMAT — text regex
  try {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    if (match) return match[0];
  } catch {}

  return null;
}

// -----------------------------------------------------
// Helper: Extract ALL images (dành cho redesign 6 tấm)
// -----------------------------------------------------
function extractMultipleImages(json: any): string[] {
  const results: string[] = [];

  const parts = json?.candidates?.[0]?.content?.parts || [];

  // 1️⃣ inlineData images
  for (const p of parts) {
    if (p.inlineData?.data) {
      results.push("data:image/png;base64," + p.inlineData.data);
    }
  }

  // 2️⃣ fallback regex
  const textDump = parts.map((p: any) => p.text || "").join("\n");

  const matches = textDump.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);
  if (matches) results.push(...matches);

  return results;
}

// -----------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { action, prompt, image, userKey } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing GEMINI_API_KEY env variable" });
    }

    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    // -----------------------------------------------------
    // ACTION MAP
    // -----------------------------------------------------

    // 1️⃣ CLEANUP (REMOVE BACKGROUND)
    if (action === "cleanup") {
      const cleanPrompt = `
Remove background completely, isolate subject, perfect edges.
Return only PNG base64 output.
      `;

      const json = await callGoogleAPI(cleanPrompt, image, apiKey);
      const img = extractImage(json);

      return res.status(200).json({
        ok: true,
        image: img,
        raw: json,
      });
    }

    // 2️⃣ ANALYZE
    if (action === "analyze") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // 3️⃣ EXTRACT ELEMENTS
    if (action === "extract") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // 4️⃣ REDESIGN (GENERATE 6 IMAGES)
    if (action === "redesign") {
      const json = await callGoogleAPI(prompt, null, apiKey);
      const images = extractMultipleImages(json);

      return res.status(200).json({
        ok: true,
        images,
        raw: json,
      });
    }

    // 5️⃣ REMIX (UPDATE IMAGE)
    if (action === "remix") {
      const json = await callGoogleAPI(prompt, image, apiKey);
      const img = extractImage(json);

      return res.status(200).json({
        ok: true,
        image: img,
        raw: json,
      });
    }

    // 6️⃣ SPLIT CHARACTERS
    if (action === "splitCharacters") {
      const json = await callGoogleAPI(prompt, image, apiKey);

      return res.status(200).json({
        ok: true,
        raw: json,
      });
    }

    // 7️⃣ MOCKUP
    if (action === "mockup") {
      const json = await callGoogleAPI(prompt, image, apiKey);
      const img = extractImage(json);

      return res.status(200).json({
        ok: true,
        image: img,
        raw: json,
      });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message || "Server Error" });
  }
}
