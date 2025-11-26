// services/geminiService.ts
// Sử dụng GEMINI_API_KEY từ Vercel Environment Variables

// CRITICAL: Endpoint đúng là "/api/generate"
async function callBackend(prompt: string, imageBase64?: string) {
  try {
    const body: any = { prompt };
    if (imageBase64) body.image = imageBase64;

    console.log('🚀 Calling API:', '/api/generate');

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    console.log('📥 API Response:', json);

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    return json;
  } catch (err: any) {
    console.error("⛔ Backend call failed:", err);
    throw err;
  }
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

export async function cleanupProductImage(imageBase64: string): Promise<string> {
  const prompt = `Remove the background from this product image completely.
Keep only the main product/subject.
Clean edges and make them smooth.
Output: Return a PNG image with transparent background as base64 data URI.
Format: data:image/png;base64,<data>`;

  const result = await callBackend(prompt, imageBase64);

  if (!result.image) {
    throw new Error("No cleaned image returned from API");
  }

  return result.image;
}

export async function analyzeProductDesign(
  imageBase64: string,
  productType: string,
  designMode: string
): Promise<any> {
  const prompt = `You are a senior product design analyzer.

Analyze this ${productType} product image.

Design Mode: ${designMode}

Return ONLY a valid JSON object (no markdown):
{
  "title": "Brief product title",
  "description": "Detailed description",
  "redesignPrompt": "Detailed creative prompt for 6 redesign variations",
  "detectedComponents": ["component1", "component2"],
  "detectedType": "${productType}",
  "strategy": "redesign_strategy"
}`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "{}";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch (parseError) {
    console.warn("⚠️ JSON parse failed, using fallback");
    return {
      title: "Product Analysis",
      description: "Unable to fully analyze",
      redesignPrompt: `Create 6 modern variations of this ${productType}`,
      detectedComponents: [],
      detectedType: productType,
      strategy: "basic",
    };
  }
}

export async function extractDesignElements(imageBase64: string): Promise<string[]> {
  const prompt = `Analyze this product and extract key visual elements.
Return ONLY a JSON array: ["element1", "element2", ...]`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "[]";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch {
    return [];
  }
}

export async function generateProductRedesigns(
  redesignPrompt: string,
  ropeType: string,
  extraRefs: string[],
  override: string,
  productType: string,
  useUltra?: boolean
): Promise<string[]> {
  const finalPrompt = override || redesignPrompt;

  const prompt = `${finalPrompt}

Generate 6 UNIQUE ${productType} variations.
Each must be distinctly different.
Output: Return 6 PNG images as base64 data URIs.
Format: data:image/png;base64,<data>`;

  const result = await callBackend(prompt);
  const rawText = result.text || "";

  const matches = rawText.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);

  if (!matches || matches.length === 0) {
    console.warn("⚠️ No images generated");
    return [];
  }

  console.log(`✅ Generated ${matches.length} redesigns`);
  return matches;
}

export async function remixProductImage(
  imageBase64: string,
  instruction: string
): Promise<string> {
  const prompt = `Modify this product image: ${instruction}
Output: Return PNG as base64 data URI.`;

  const result = await callBackend(prompt, imageBase64);

  if (!result.image) {
    throw new Error("No remixed image returned");
  }

  return result.image;
}

export async function detectAndSplitCharacters(
  imageBase64: string
): Promise<string[]> {
  const prompt = `Detect all distinct objects in this image.
Separate and crop each one.
Return JSON array of base64 images.`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "[]";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch {
    return [];
  }
}

export async function generateRandomMockup(imageBase64: string): Promise<string> {
  const prompt = `Place this product into a premium mockup scene.
Output: Return PNG as base64 data URI.`;

  const result = await callBackend(prompt, imageBase64);

  if (!result.image) {
    throw new Error("No mockup image returned");
  }

  return result.image;
}
