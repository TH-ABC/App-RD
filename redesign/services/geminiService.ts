import { GoogleGenAI } from "@google/genai";
import { ProductAnalysis, DesignMode, RopeType, PRODUCT_MATERIALS } from "../types";

/* ---------------------------------------------------------
   0. TOKEN NORMALIZER (NEW — SUPPORT JSON, YA29, AIza)
--------------------------------------------------------- */
function extractAccessToken(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();

  // JSON Ultra Token
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.access_token === "string") return parsed.access_token;
      if (typeof parsed.token === "string") return parsed.token;
      console.warn("JSON token không chứa access_token");
    } catch (e) {
      console.warn("Parse JSON Ultra Token lỗi:", e);
    }
  }

  // Direct OAuth token
  if (trimmed.startsWith("ya29")) return trimmed;

  // API Key AIza...
  return trimmed;
}

/* ---------------------------------------------------------
   1. KEY MANAGER
--------------------------------------------------------- */
class KeyManager {
  private freeKeys: string[] = [];
  private paidKeys: string[] = [];
  private freeIndex = 0;
  private paidIndex = 0;

  setPools(free: string[], paid: string[]) {
    this.freeKeys = free.map(extractAccessToken).filter(Boolean);
    this.paidKeys = paid.map(extractAccessToken).filter(Boolean);
    this.freeIndex = 0;
    this.paidIndex = 0;

    console.log(`Key Manager Initialized: ${this.freeKeys.length} Free, ${this.paidKeys.length} Paid`);
  }

  hasKeys() {
    return this.freeKeys.length > 0 || this.paidKeys.length > 0;
  }

  isUserToken(key: string) {
    return key.startsWith("ya29");
  }

  getEnvKey() {
    return extractAccessToken(process.env.API_KEY || process.env.GEMINI_API_KEY || "");
  }

  async executeWithRetry<T>(
    operation: (key: string, isUltra: boolean, isPaidPool: boolean) => Promise<T>
  ): Promise<T> {
    if (!this.hasKeys()) {
      const envKey = this.getEnvKey();
      if (!envKey) throw new Error("Không tìm thấy API key");
      return operation(envKey, this.isUserToken(envKey), false);
    }

    /* ---- Free Keys ---- */
    let firstFree = this.freeIndex;
    for (let i = 0; i < this.freeKeys.length; i++) {
      const idx = (firstFree + i) % this.freeKeys.length;
      const key = this.freeKeys[idx];
      try {
        this.freeIndex = (idx + 1) % this.freeKeys.length;
        return await operation(key, this.isUserToken(key), false);
      } catch (err: any) {
        const isRateLimit =
          err?.status === 429 ||
          err?.code === 429 ||
          err?.message?.includes("429") ||
          err?.message?.includes("quota");

        if (isRateLimit) continue;
        throw err;
      }
    }

    console.warn("Free keys hết hoặc rate-limited → chuyển Paid Keys");

    /* ---- Paid Keys ---- */
    let firstPaid = this.paidIndex;
    for (let i = 0; i < this.paidKeys.length; i++) {
      const idx = (firstPaid + i) % this.paidKeys.length;
      const key = this.paidKeys[idx];
      try {
        this.paidIndex = (idx + 1) % this.paidKeys.length;
        return await operation(key, this.isUserToken(key), true);
      } catch (err: any) {
        const isRateLimit =
          err?.status === 429 ||
          err?.code === 429 ||
          err?.message?.includes("429") ||
          err?.message?.includes("quota");

        if (isRateLimit) continue;
        throw err;
      }
    }

    throw new Error("Tất cả key đều đang bị rate limit. Vui lòng đợi.");
  }
}

export const keyManager = new KeyManager();

/* ---------------------------------------------------------
   2. CLIENT FACTORY — FIXED FOR BROWSER (FINAL)
   - Ultra Token = Bearer
   - Browser requires apiKey → use "DUMMY_KEY"
--------------------------------------------------------- */
const getClient = (rawKey: string, isPaidPool: boolean = false) => {
  if (!rawKey) throw new Error("Missing key");

  const key = extractAccessToken(rawKey);

  /* ---- If Ultra OAuth token ---- */
  if (key.startsWith("ya29")) {
    const customFetch = (url: RequestInfo | URL, init?: RequestInit) => {
      const cfg: RequestInit = { ...init };
      const headers = new Headers(cfg.headers || {});
      headers.set("Authorization", `Bearer ${key}`);
      headers.delete("x-goog-api-key");
      cfg.headers = headers;
      return window.fetch(url, cfg);
    };

    return new GoogleGenAI({
      apiKey: "DUMMY_KEY",   // <-- FIX CHÍNH: Browser BẮT BUỘC phải có apiKey
      fetch: customFetch
    } as any);
  }

  /* ---- Standard API Key ---- */
  return new GoogleGenAI({ apiKey: key });
};

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
const stripBase64Prefix = (b64: string) =>
  b64.replace(/^data:image\/[a-z]+;base64,/, "");

export const cleanJsonString = (t: string) =>
  t.replace(/```json\s*|\s*```/g, "").trim();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ---------------------------------------------------------
   EXPORT FUNCTION: setKeyPools
--------------------------------------------------------- */
export const setKeyPools = (free: string[], paid: string[]) => {
  keyManager.setPools(free, paid);
};

/* ---------------------------------------------------------
   VALIDATE TOKEN
--------------------------------------------------------- */
export const validateToken = async (token: string): Promise<boolean> => {
  try {
    const ai = getClient(token);
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: "test" }] }
    });
    return true;
  } catch (err) {
    console.error("Validation error:", err);
    throw err;
  }
};

/* ---------------------------------------------------------
   CLEANUP IMAGE
--------------------------------------------------------- */
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  return keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
    const ai = getClient(key);
    if (!isUltra) await sleep(isPaid ? 500 : 1000);

    const prompt =
      "Isolate this product on a pure white background. Remove wires/clutter.";

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
          { text: prompt }
        ]
      }
    });

    for (const part of res.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data)
        return `data:image/png;base64,${part.inlineData.data}`;
    }

    return imageBase64;
  });
};

/* ---------------------------------------------------------
   ANALYSIS (giữ nguyên logic nhưng chạy với client mới)
--------------------------------------------------------- */
export const analyzeProductDesign = async (
  imageBase64: string,
  productType: string,
  mode: DesignMode,
  preferredModel: string = "gemini-2.5-flash"
): Promise<ProductAnalysis> => {
  return keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
    const ai = getClient(key);

    let model = (isUltra || isPaid) ? "gemini-1.5-pro" : "gemini-2.5-flash";
    if (!isUltra) await sleep(isPaid ? 500 : 1000);

    const isAuto = productType === "Auto-Detect / Random";
    const material = PRODUCT_MATERIALS[productType] || "";

    const prompt = `
    Analyze this product image for redesign.
    ${isAuto ? "Identify product type first." : `Material: ${material}`}
    Design Goal: ${mode === DesignMode.NEW_CONCEPT ? "New Concept" : "Enhance Existing"}
    Return JSON: description, designCritique, detectedComponents, redesignPrompt.
    `;

    try {
      const res = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
            { text: prompt }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const raw = JSON.parse(cleanJsonString(res.text || "{}"));

      let components = raw.detectedComponents;
      if (typeof components === "string")
        components = components.split(",").map((s: string) => s.trim());
      else if (!Array.isArray(components))
        components = [];

      return { ...raw, detectedComponents: components };
    } catch (err) {
      // fallback to Flash
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
            { text: prompt }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const raw = JSON.parse(cleanJsonString(res.text || "{}"));
      let components = raw.detectedComponents;

      if (typeof components === "string")
        components = components.split(",").map((s: string) => s.trim());
      else if (!Array.isArray(components))
        components = [];

      return { ...raw, detectedComponents: components };
    }
  });
};

/* ---------------------------------------------------------
   EXTRACT DESIGN ELEMENTS (GIỮ NGUYÊN)
--------------------------------------------------------- */
export const extractDesignElements = async (imageBase64: string): Promise<string[]> => {
  const prompts = [
    "Crop and isolate the main CHARACTER",
    "Crop and isolate the BACKGROUND PATTERN",
    "Crop and isolate TEXT or LOGO elements"
  ];

  const results: string[] = [];

  for (const p of prompts) {
    try {
      const img = await keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
        const ai = getClient(key);
        if (!isUltra) await sleep(isPaid ? 500 : 1000);

        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
              { text: p }
            ]
          }
        });

        for (const part of res.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data)
            return `data:image/png;base64,${part.inlineData.data}`;
        }

        return null;
      });

      if (img) results.push(img);
    } catch {}
  }

  return results;
};

/* ---------------------------------------------------------
   GENERATE REDESIGNS (GIỮ NGUYÊN LOGIC)
--------------------------------------------------------- */
export const generateProductRedesigns = async (
  basePrompt: string,
  ropeType: RopeType,
  selectedComponents: string[],
  userNotes: string,
  productType: string,
  useUltra: boolean
): Promise<string[]> => {

  let finalPrompt = basePrompt;

  // add materials
  if (productType !== "Auto-Detect / Random") {
    const materialInfo = PRODUCT_MATERIALS[productType] || "";
    finalPrompt += `\nMaterial Specs: ${materialInfo}`;
  }

  if (ropeType !== RopeType.NONE)
    finalPrompt += `\nAdd ${ropeType} loop.`;

  if (userNotes)
    finalPrompt += `\nUser Request: ${userNotes}`;

  if (selectedComponents.length > 0)
    finalPrompt += `\nKeep elements: ${selectedComponents.join(", ")}`;

  finalPrompt += `
  IMPORTANT: High-Quality Product Photography Mockup.
  Cinematic lighting, depth of field, NO white background.
  `;

  /* ---- Helper ---- */
  const runFlashGen = async (key: string, isPaid: boolean) => {
    const ai = getClient(key);
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: finalPrompt }] }
    });
    for (const part of res.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data)
        return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  };

  /* ---- Ultra Token Strategy ---- */
  if (keyManager["paidKeys"].some(k => k.startsWith("ya29"))) {
    return keyManager
      .executeWithRetry(async (key, isUltra, isPaid) => {
        if (isUltra) {
          const batch1 = await Promise.all([
            runFlashGen(key, true),
            runFlashGen(key, true),
            runFlashGen(key, true)
          ]);

          await sleep(500);

          const batch2 = await Promise.all([
            runFlashGen(key, true),
            runFlashGen(key, true),
            runFlashGen(key, true)
          ]);

          const all = [...batch1, ...batch2].filter(Boolean) as string[];
          return all;
        }
        return [];
      })
      .then(res => res.length ? res : Promise.reject("Ultra empty"))
      .catch(async () => standardSequentialGeneration(finalPrompt));
  }

  /* ---- Standard Path ---- */
  return standardSequentialGeneration(finalPrompt);
};

async function standardSequentialGeneration(prompt: string): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    const img = await keyManager
      .executeWithRetry(async (key, isUltra, isPaid) => {
        const ai = getClient(key);
        if (!isUltra) await sleep(isPaid ? 2500 : 2000);

        const runFlash = async () => {
          const res = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: [{ text: prompt }] }
          });
          for (const part of res.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data)
              return `data:image/png;base64,${part.inlineData.data}`;
          }
          return null;
        };

        try {
          const res = await ai.models.generateImages({
            model: "imagen-4.0-generate-001",
            prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: "1:1",
              outputMimeType: "image/jpeg"
            }
          });

          const bytes = res.generatedImages?.[0]?.image?.imageBytes;
          if (bytes) return `data:image/jpeg;base64,${bytes}`;
          throw new Error("no image");
        } catch (e) {
          return await runFlash();
        }
      })
      .catch(() => null);

    if (img) results.push(img);
  }
  return results;
}

/* ---------------------------------------------------------
   REMIX
--------------------------------------------------------- */
export const remixProductImage = async (imageBase64: string, instruction: string): Promise<string> => {
  const prompt = `Image Editor. Instruction: ${instruction}. Preserve text exactly.`;

  return keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
    const ai = getClient(key);
    if (!isUltra) await sleep(isPaid ? 500 : 1000);

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
          { text: prompt }
        ]
      }
    });

    for (const part of res.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data)
        return `data:image/png;base64,${part.inlineData.data}`;
    }

    throw new Error("Remix failed");
  });
};

/* ---------------------------------------------------------
   SPLIT CHARACTERS
--------------------------------------------------------- */
export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
  return keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
    const ai = getClient(key);
    if (!isUltra) await sleep(isPaid ? 500 : 1000);

    const identifyPrompt =
      "Analyze image. List main distinct characters. Comma-separated.";

    const identifyRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
          { text: identifyPrompt }
        ]
      }
    });

    const list = identifyRes.text
      ?.split(",")
      .map(s => s.trim())
      .filter(Boolean) || [];

    if (!list.length) return [];

    const isolate = async (name: string) => {
      const p = `Crop and isolate ONLY ${name}. White background. HQ.`;
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
            { text: p }
          ]
        }
      });
      const part = res.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data)
        return `data:image/png;base64,${part.inlineData.data}`;
      return null;
    };

    const results = await Promise.all(list.slice(0, 4).map(isolate));
    return results.filter(Boolean) as string[];
  });
};

/* ---------------------------------------------------------
   RANDOM MOCKUP
--------------------------------------------------------- */
export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
  return keyManager.executeWithRetry(async (key, isUltra, isPaid) => {
    const ai = getClient(key);
    if (!isUltra) await sleep(isPaid ? 500 : 1000);

    const prompt = `
    Image Editor.
    Insert object into POD mockup:
    - If Ornament → Christmas tree + bokeh lights.
    - Else → Wooden table + cinematic lighting.
    High resolution.
    `;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
          { text: prompt }
        ]
      }
    });

    for (const part of res.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data)
        return `data:image/png;base64,${part.inlineData.data}`;
    }

    throw new Error("Mockup failed");
  });
};
