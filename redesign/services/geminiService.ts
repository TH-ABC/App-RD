// services/geminiService.ts
// Complete service layer for Gemini API calls

let freePool: string[] = [];
let paidPool: string[] = [];
let freeIndex = 0;
let paidIndex = 0;

/**
 * Initialize API key pools
 */
export function setKeyPools(free: string[], paid: string[]) {
  freePool = free.filter(k => k && k.trim().length > 0);
  paidPool = paid.filter(k => k && k.trim().length > 0);
  freeIndex = 0;
  paidIndex = 0;
  console.log(`🔑 Key Pool Loaded → ${freePool.length} Free, ${paidPool.length} Paid`);
}

/**
 * Get next available API key from pool (prioritizes paid keys)
 */
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

/**
 * Core function to call backend API
 */
async function callBackend(prompt: string, imageBase64?: string) {
  try {
    const body: any = { prompt };
    if (imageBase64) body.image = imageBase64;

    const userKey = getNextUserKey();
    if (userKey) body.userKey = userKey;

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error("⛔ Backend call failed:", err);
    throw err;
  }
}

/**
 * Helper to clean JSON response from markdown
 */
function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

/**
 * 1️⃣ CLEANUP - Remove background from product image
 */
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

/**
 * 2️⃣ ANALYZE - Analyze product design and generate insights
 */
export async function analyzeProductDesign(
  imageBase64: string,
  productType: string,
  designMode: string
): Promise<any> {
  const prompt = `You are a senior product design analyzer and strategist.

Analyze this ${productType} product image carefully.

Design Mode: ${designMode}

Return ONLY a valid JSON object (no markdown, no explanation) with this EXACT structure:
{
  "title": "Brief product title",
  "description": "Detailed description of the current design, colors, style, materials",
  "redesignPrompt": "Detailed creative prompt for generating 6 modern redesign variations. Include style direction, color palette suggestions, design principles to follow",
  "detectedComponents": ["component1", "component2"],
  "detectedType": "${productType}",
  "strategy": "redesign_strategy"
}

Make the redesignPrompt detailed and creative, focusing on modern design trends.`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "{}";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch (parseError) {
    console.warn("⚠️ JSON parse failed:", parseError);
    console.warn("Raw text:", result.text);
    return {
      title: "Product Analysis",
      description: "Unable to fully analyze the product",
      redesignPrompt: `Create 6 modern variations of this ${productType}. Use contemporary design trends, clean aesthetics, and appealing color combinations.`,
      detectedComponents: [],
      detectedType: productType,
      strategy: "basic",
    };
  }
}

/**
 * 3️⃣ EXTRACT - Extract design elements from image
 */
export async function extractDesignElements(imageBase64: string): Promise<string[]> {
  const prompt = `Analyze this product image and extract key visual design elements.

Return ONLY a JSON array of strings (no markdown, no explanation):
["element1", "element2", "element3", ...]

Include:
- Color palette
- Patterns
- Shapes
- Typography styles
- Key visual motifs
- Material textures`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "[]";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch {
    console.warn("⚠️ Failed to parse design elements");
    return [];
  }
}

/**
 * 4️⃣ REDESIGN - Generate multiple product redesign variations
 */
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

IMPORTANT REQUIREMENTS:
- Generate 6 UNIQUE variations of this ${productType}
- Each design should be distinctly different
- Use modern, appealing aesthetics
- High quality, professional product photography style
- Clean, isolated products on transparent/white background

Output: Return 6 separate PNG images as base64 data URIs.
Format each as: data:image/png;base64,<data>
Separate each image clearly in your response.`;

  const result = await callBackend(prompt);
  const rawText = result.text || "";

  const matches = rawText.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g);

  if (!matches || matches.length === 0) {
    console.warn("⚠️ No images generated from redesign");
    return [];
  }

  console.log(`✅ Generated ${matches.length} redesign variations`);
  return matches;
}

/**
 * 5️⃣ REMIX - Modify existing product image based on instructions
 */
export async function remixProductImage(
  imageBase64: string,
  instruction: string
): Promise<string> {
  const prompt = `Modify this product image according to these instructions:

${instruction}

REQUIREMENTS:
- Keep the product recognizable
- Apply the changes naturally
- Maintain high quality
- Keep transparent/clean background

Output: Return modified PNG image as base64 data URI.
Format: data:image/png;base64,<data>`;

  const result = await callBackend(prompt, imageBase64);

  if (!result.image) {
    throw new Error("No remixed image returned from API");
  }

  return result.image;
}

/**
 * 6️⃣ SPLIT - Detect and split multiple objects/characters
 */
export async function detectAndSplitCharacters(
  imageBase64: string
): Promise<string[]> {
  const prompt = `Detect all distinct objects, characters, or elements in this image.

Separate each one individually and crop them.

Return ONLY a JSON array (no markdown, no explanation) where each element is a PNG base64 data URI:
["data:image/png;base64,<data1>", "data:image/png;base64,<data2>", ...]`;

  const result = await callBackend(prompt, imageBase64);

  try {
    const text = result.text || "[]";
    const cleanedText = cleanJsonResponse(text);
    return JSON.parse(cleanedText);
  } catch {
    console.warn("⚠️ Failed to split characters");
    return [];
  }
}

/**
 * 7️⃣ MOCKUP - Generate product mockup in realistic scene
 */
export async function generateRandomMockup(imageBase64: string): Promise<string> {
  const prompt = `Place this product into a premium, realistic mockup scene.

REQUIREMENTS:
- Professional product photography style
- Appealing background/environment
- Good lighting and shadows
- High quality rendering
- Make the product look desirable

Output: Return mockup PNG image as base64 data URI.
Format: data:image/png;base64,<data>`;

  const result = await callBackend(prompt, imageBase64);

  if (!result.image) {
    throw new Error("No mockup image returned from API");
  }

  return result.image;
}
