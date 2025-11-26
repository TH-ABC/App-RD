// services/geminiService.ts
//---------------------------------------------------------
// TẤT CẢ GỌI GOOGLE API ĐỀU CHUYỂN HẾT SANG /api/generate
//---------------------------------------------------------

// Nếu sau này bạn muốn xoay key user → thêm lại keyPool logic bên dưới
let freePool: string[] = [];
let paidPool: string[] = [];
let freeIndex = 0;
let paidIndex = 0;

export function setKeyPools(free: string[], paid: string[]) {
  freePool = free;
  paidPool = paid;
  freeIndex = 0;
  paidIndex = 0;
  console.log(`KeyPools Loaded: ${free.length} free, ${paid.length} paid`);
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
// BACKEND REQUEST WRAPPER
//---------------------------------------------------------
async function callBackend(prompt: string, imageBase64?: string) {
  try {
    const body: any = { prompt };

    if (imageBase64) {
      body.image = imageBase64;
    }

    // Nếu user có key → gửi kèm xuống backend
    const userKey = getNextUserKey();
    if (userKey) body.userKey = userKey;

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Backend error");
    }

    return json;
  } catch (err: any) {
    console.error("Backend call failed:", err);
    throw err;
  }
}

//---------------------------------------------------------
// 1️⃣ CLEANUP IMAGE — REMOVE BACKGROUND
//---------------------------------------------------------
export async function cleanupProductImage(imageBase64: string): Promise<string> {
  const prompt =
    "Remove background, isolate object, clean edges, return image in pure PNG format base64.";

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}

//---------------------------------------------------------
// 2️⃣ ANALYZE PRODUCT DESIGN
//---------------------------------------------------------
export async function analyzeProductDesign(
  imageBase64: string,
  productType: string,
  designMode: any
) {
  const prompt = `
You are a senior product design analyzer.
Analyze the uploaded product and return JSON fields:
- title
- short_description
- long_description
- redesignPrompt (the best prompt to send for redesign generation)
- detected_type
- enhance_strategy

Product Type: ${productType}
Mode: ${designMode}
Return JSON only.
`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    console.warn("JSON parse fail → returning fallback analysis");
    return {
      title: "Unknown",
      short_description: "",
      long_description: "",
      redesignPrompt: "Create a clean modern redesign.",
      detected_type: productType,
      enhance_strategy: "basic",
    };
  }
}

//---------------------------------------------------------
// 3️⃣ EXTRACT DESIGN ELEMENTS
//---------------------------------------------------------
export async function extractDesignElements(imageBase64: string) {
  const prompt = `
Extract key design elements (objects, patterns, textures, icons, colors).
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
// 4️⃣ GENERATE PRODUCT REDESIGNS
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
Return each result as PNG base64 only, separated clearly.
`;

  const result = await callBackend(prompt);

  // Extract images from response
  const rawText =
    result.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const matches = rawText.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);

  return matches || [];
}

//---------------------------------------------------------
// 5️⃣ REMIX IMAGE
//---------------------------------------------------------
export async function remixProductImage(imageBase64: string, instruction: string) {
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
Detect individual objects/characters in the image.
Return each object separated as a cropped PNG base64.
Return JSON array of base64 strings.
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
Place this product image into a premium mockup scene (studio lighting, clean background).
Return PNG base64 only.
`;

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}
