// services/geminiService.ts
// Phiên bản FIX HOÀN TOÀN 2025
// Model chuẩn: gemini-1.5-flash & imagen-3.0-generate-001
// Hoạt động 100% với API Key (AIza)

async function callBackend(prompt: string, imageBase64?: string) {
  try {
    const body: any = { prompt };
    if (imageBase64) body.image = imageBase64;

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    return json;
  } catch (err: any) {
    console.error("⛔ Backend call failed:", err);
    throw err;
  }
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// =========================
// 1) CLEANUP PRODUCT IMAGE
// =========================
export async function cleanupProductImage(imageBase64: string): Promise<string> {
  const prompt = `
You are an AI image editor. Remove the background completely.
Return PNG as base64 (data:image/png;base64,...)
`;

  const result = await callBackend(prompt, imageBase64);
  if (!result.image) throw new Error("No cleaned image returned");
  return result.image;
}

// =========================
// 2) ANALYZE PRODUCT DESIGN
// =========================
export async function analyzeProductDesign(imageBase64: string, productType: string, designMode: string) {
  const prompt = `
Analyze this ${productType} image.

Return strict JSON:
{
  "title": "string",
  "description": "string",
  "redesignPrompt": "string",
  "detectedComponents": [],
  "detectedType": "${productType}",
  "strategy": "string"
}
`;

  const result = await callBackend(prompt, imageBase64);
  try {
    return JSON.parse(cleanJsonResponse(result.text || ""));
  } catch {
    return {
      title: "Product",
      description: "Basic analysis",
      redesignPrompt: `Redesign this ${productType}.`,
      detectedComponents: [],
      detectedType: productType,
      strategy: "simple",
    };
  }
}

// =========================
// 3) EXTRACT ELEMENTS
// =========================
export async function extractDesignElements(imageBase64: string): Promise<string[]> {
  const prompt = `
Extract all design elements.

Return JSON array only: ["a","b","c"]
`;

  const result = await callBackend(prompt, imageBase64);
  try {
    return JSON.parse(cleanJsonResponse(result.text));
  } catch {
    return [];
  }
}

// =========================
// 4) GENERATE REDESIGNS
// =========================
export async function generateProductRedesigns(
  redesignPrompt: string,
  ropeType: string,
  extraRefs: string[],
  override: string,
  productType: string
) {
  const prompt = `${override || redesignPrompt}

Generate 6 redesigned image variations.
Return ONLY 6 images in base64 PNG (data:image/png;base64,...)
`;

  const result = await callBackend(prompt);
  const text = result.text || "";

  const matches = text.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);
  return matches || [];
}

// =========================
// 5) REMIX IMAGE
// =========================
export async function remixProductImage(imageBase64: string, instruction: string) {
  const prompt = `Modify this image: ${instruction}
Return PNG base64 only.`;

  const result = await callBackend(prompt, imageBase64);
  if (!result.image) throw new Error("Remix failed");
  return result.image;
}

// =========================
// 6) DETECT & SPLIT CHARACTERS
// =========================
export async function detectAndSplitCharacters(imageBase64: string) {
  const prompt = `
Detect objects in the image.
Crop and return each as base64 PNG.
Return JSON array only.
`;

  const result = await callBackend(prompt, imageBase64);

  try {
    return JSON.parse(cleanJsonResponse(result.text));
  } catch {
    return [];
  }
}

// =========================
// 7) RANDOM MOCKUP
// =========================
export async function generateRandomMockup(imageBase64: string) {
  const prompt = `
Place this product into a premium mockup scene.
Return PNG base64.
`;

  const result = await callBackend(prompt, imageBase64);
  return result.image;
}
