// services/geminiService.ts
//---------------------------------------------------------
// FINAL VERSION — Tất cả yêu cầu đều đi qua /api/generate
// Không gọi Google API trực tiếp → Không lộ API key
//---------------------------------------------------------

let freePool: string[] = [];
let paidPool: string[] = [];
let freeIndex = 0;
let paidIndex = 0;

//---------------------------------------------------------
// KEY POOL (UI ONLY) — có thể có hoặc không
//---------------------------------------------------------
export function setKeyPools(free: string[], paid: string[]) {
  freePool = free;
  paidPool = paid;
  freeIndex = 0;
  paidIndex = 0;

  console.log(`🔑 Key Pool Loaded → ${free.length} Free, ${paid.length} Paid`);
}

function getNextUserKey(): string | null {
  if (paidPool.length > 0) {
    const key = paidPool[paidIndex % paidPool.length];
    paidIndex++;
    return key;
  }
  if (freePool.length > 0) {
    const key = freePool[freeIndex % freePool.length];
    freeIndex++;
    return key;
  }
  return null;
}

//---------------------------------------------------------
// BACKEND WRAPPER
//---------------------------------------------------------
async function callBackend(prompt: string, imageBase64?: string) {
  try {
    const body: any = { prompt };

    // hình (nếu có)
    if (imageBase64) body.image = imageBase64;

    // key pool (optional)
    const userKey = getNextUserKey();
    if (userKey) body.userKey = userKey;

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Backend failed");
    }

    return json;
  } catch (err) {
    console.error("⛔ Backend call failed:", err);
    throw err;
  }
}

//---------------------------------------------------------
// 1️⃣ CLEANUP — REMOVE BACKGROUND
//---------------------------------------------------------
export async function cleanupProductImage(imageBase64: string): Promise<string> {
  const prompt =
    "Remove background, isolate subject, clean edges, return PNG base64 only.";

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}

//---------------------------------------------------------
// 2️⃣ ANALYZE PRODUCT IMAGE
//---------------------------------------------------------
export async function analyzeProductDesign(
  imageBase64: string,
  productType: string,
  designMode: any
) {
  const prompt = `
You are a senior product design analyzer.
Analyze the uploaded product and return ONLY JSON:
{
  "title": "",
  "description": "",
  "redesignPrompt": "",
  "detectedComponents": [],
  "detectedType": "",
  "strategy": ""
}

Product Type: ${productType}
Design Mode: ${designMode}
Return JSON only.
`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
  } catch {
    console.warn("⚠️ JSON parse fail → returning fallback");
    return {
      title: "Unknown Product",
      description: "",
      redesignPrompt: "Create a modern refined redesign.",
      detectedComponents: [],
      detectedType: productType,
      strategy: "basic",
    };
  }
}

//---------------------------------------------------------
// 3️⃣ EXTRACT ELEMENTS
//---------------------------------------------------------
export async function extractDesignElements(imageBase64: string) {
  const prompt = `
Extract all key visual elements (patterns, colors, shapes, icons).
Return JSON array only.
`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(text);
  } catch {
    return [];
  }
}

//---------------------------------------------------------
// 4️⃣ GENERATE PRODUCT REDESIGNS (6 image)
//---------------------------------------------------------
export async function generateProductRedesigns(
  redesignPrompt: string,
  ropeType: any,
  extraRefs: string[],
  override: string,
  productType: string,
  useUltra?: boolean
) {
  const prompt = `
Using the following design brief:
${redesignPrompt}

Generate 6 unique product redesigns.
Return ONLY PNG base64 outputs.
Each output must be separated clearly.
`;

  const result = await callBackend(prompt);

  const rawText =
    result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // extract tất cả hình trả về theo dạng base64
  const matches = rawText.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);

  return matches || [];
}

//---------------------------------------------------------
// 5️⃣ REMIX PRODUCT IMAGE
//---------------------------------------------------------
export async function remixProductImage(
  imageBase64: string,
  instruction: string
) {
  const prompt = `
Modify the uploaded image with these instructions:
${instruction}

Return PNG base64 only.
`;

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}

//---------------------------------------------------------
// 6️⃣ SPLIT MULTIPLE CHARACTERS / OBJECTS
//---------------------------------------------------------
export async function detectAndSplitCharacters(imageBase64: string) {
  const prompt = `
Detect distinct objects/characters in the image.
Crop each one individually.
Return JSON array of PNG base64.
`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(text);
  } catch {
    return [];
  }
}

//---------------------------------------------------------
// 7️⃣ GENERATE MOCKUP
//---------------------------------------------------------
export async function generateRandomMockup(imageBase64: string) {
  const prompt = `
Place this product into a premium mockup scene.
Return PNG base64 only.
`;

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}
