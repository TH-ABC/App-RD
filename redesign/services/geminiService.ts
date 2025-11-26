// services/geminiService.ts
//---------------------------------------------------------
// VERSION: FINAL — DÀNH CHO BACKEND PROXY /api/generate
// Tất cả request gửi qua backend → Không lộ key, không lỗi CORS
//---------------------------------------------------------

let freePool: string[] = [];
let paidPool: string[] = [];
let freeIndex = 0;
let paidIndex = 0;

export function setKeyPools(free: string[], paid: string[]) {
  freePool = free;
  paidPool = paid;
  freeIndex = 0;
  paidIndex = 0;

  console.log(`Key Pool Loaded → ${free.length} Free, ${paid.length} Paid`);
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
// WRAPPER GỌI BACKEND
//---------------------------------------------------------
async function callBackend(action: string, params: any = {}, imageBase64?: string) {
  const userKey = getNextUserKey();

  const body: any = {
    action,
    ...params,
  };

  if (imageBase64) body.image = imageBase64;
  if (userKey) body.userKey = userKey;

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("Backend error:", json);
    throw new Error(json.error || "Backend failed");
  }

  return json;
}

//---------------------------------------------------------
// 1️⃣ CLEANUP — REMOVE BACKGROUND
//---------------------------------------------------------
export async function cleanupProductImage(imageBase64: string): Promise<string> {
  const payload = {
    prompt: "Remove background, isolate subject, clean edges, return PNG base64."
  };

  const result = await callBackend("cleanup", payload, imageBase64);
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
`;

  const result = await callBackend("analyze", { prompt }, imageBase64);

  try {
    const raw =
      result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(raw);
  } catch {
    return {
      title: "Unknown Product",
      description: "",
      redesignPrompt: "Create an improved redesign.",
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
Extract key visual elements (patterns, textures, icons, typography).
Return JSON array only.
`;

  const result = await callBackend("extract", { prompt }, imageBase64);

  try {
    const raw =
      result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

//---------------------------------------------------------
// 4️⃣ GENERATE PRODUCT REDESIGNS (OUTPUT 6 IMG)
//---------------------------------------------------------
export async function generateProductRedesigns(
  redesignPrompt: string,
  ropeType: any,
  selectedComponents: string[],
  userNotes: string,
  productType: string,
  useUltraFlag?: boolean
) {
  const finalPrompt = `
${redesignPrompt}

Generate 6 high-quality product redesign images.
Return ONLY base64 PNG images, each separated clearly.
`;

  const result = await callBackend("redesign", {
    prompt: finalPrompt
  });

  const text =
    result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Tìm tất cả base64 output
  const matches = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);
  return matches || [];
}

//---------------------------------------------------------
// 5️⃣ REMIX (UPDATE IMAGE)
//---------------------------------------------------------
export async function remixProductImage(imageBase64: string, instruction: string) {
  const prompt = `
Modify this image following instructions:
${instruction}

Return PNG base64 only.
`;

  const res = await callBackend("remix", { prompt }, imageBase64);
  return res.image;
}

//---------------------------------------------------------
// 6️⃣ SPLIT CHARACTERS
//---------------------------------------------------------
export async function detectAndSplitCharacters(imageBase64: string) {
  const prompt = `
Detect multiple characters or objects.
Return JSON array of cropped PNG base64 images.
`;

  const result = await callBackend("splitCharacters", { prompt }, imageBase64);

  try {
    const raw = result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

//---------------------------------------------------------
// 7️⃣ MOCKUP
//---------------------------------------------------------
export async function generateRandomMockup(imageBase64: string) {
  const prompt = `
Place this object into a premium product mockup scene.
Return PNG base64 only.
`;

  const result = await callBackend("mockup", { prompt }, imageBase64);
  return result.image;
}
