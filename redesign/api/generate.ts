import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // data from frontend
    const { prompt, imageBase64 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Ultra token from Vercel environment variable
    const ultraToken = process.env.GOOGLE_ULTRA_TOKEN;
    if (!ultraToken) {
      return res.status(500).json({ error: "Missing GOOGLE_ULTRA_TOKEN" });
    }

    // Custom FETCH using Bearer token (server OK)
    const customFetch = (url, init) => {
      const headers = new Headers(init?.headers || {});
      headers.set("Authorization", `Bearer ${ultraToken}`);
      headers.delete("x-goog-api-key");
      return fetch(url, { ...init, headers });
    };

    const ai = new GoogleGenAI({
      apiKey: "dummy-key", // required but ignored
      fetch: customFetch
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          ...(imageBase64
            ? [{ inlineData: { mimeType: "image/jpeg", data: imageBase64.replace(/^data:image\/\w+;base64,/, "") } }]
            : []),
          { text: prompt }
        ]
      }
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
