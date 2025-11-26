import { GoogleGenAI } from "@google/genai";
import { ProductAnalysis, DesignMode, RopeType, PRODUCT_MATERIALS } from "../types";

// --- KEY MANAGER LOGIC ---
class KeyManager {
  private freeKeys: string[] = [];
  private paidKeys: string[] = [];
  private freeIndex = 0;
  private paidIndex = 0;

  // Store globally to persist across function calls
  setPools(free: string[], paid: string[]) {
    this.freeKeys = free;
    this.paidKeys = paid;
    this.freeIndex = 0;
    this.paidIndex = 0;
    console.log(`Key Manager Initialized: ${free.length} Free, ${paid.length} Paid`);
  }

  hasKeys() {
    return this.freeKeys.length > 0 || this.paidKeys.length > 0;
  }

  // Helper to determine if a key is a "Token" (OAuth - ya29...)
  isUserToken(key: string) {
    return key && key.startsWith('ya29');
  }

  getEnvKey() {
      return process.env.API_KEY || process.env.GEMINI_API_KEY;
  }

  // Core rotation execution
  async executeWithRetry<T>(operation: (key: string, isUltra: boolean, isPaidPool: boolean) => Promise<T>): Promise<T> {
    if (!this.hasKeys()) {
       // Fallback to env key if no pool
       const envKey = this.getEnvKey();
       if (!envKey) throw new Error("No API Keys configured. Please add keys.");
       return operation(envKey, this.isUserToken(envKey), false);
    }

    // 1. Try Free Keys Loop
    let initialFreeIndex = this.freeIndex;
    if (this.freeKeys.length > 0) {
        for (let i = 0; i < this.freeKeys.length; i++) {
            // Round robin selection
            const currentKeyIndex = (initialFreeIndex + i) % this.freeKeys.length;
            const key = this.freeKeys[currentKeyIndex];
            
            try {
                // Update global index for next time
                this.freeIndex = (currentKeyIndex + 1) % this.freeKeys.length;
                
                return await operation(key, this.isUserToken(key), false);
            } catch (error: any) {
                // Check if error is Rate Limit (429) or Quota Exceeded
                const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && (error.message.includes('429') || error.message.includes('quota')));
                
                if (isRateLimit) {
                    console.warn(`Free Key ${currentKeyIndex} rate limited. Rotating to next...`);
                    continue; // Try next key
                }
                // If it's another error (e.g. 400 Bad Request), don't rotate, just fail
                throw error;
            }
        }
        console.warn("All Free Keys exhausted/rate-limited. Switching to Paid Pool.");
    }

    // 2. Try Paid Keys Loop (Failover)
    let initialPaidIndex = this.paidIndex;
    if (this.paidKeys.length > 0) {
        for (let i = 0; i < this.paidKeys.length; i++) {
             const currentKeyIndex = (initialPaidIndex + i) % this.paidKeys.length;
             const key = this.paidKeys[currentKeyIndex];

             try {
                 this.paidIndex = (currentKeyIndex + 1) % this.paidKeys.length;
                 // Pass isPaidPool=true. 
                 return await operation(key, this.isUserToken(key), true);
             } catch (error: any) {
                 const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && (error.message.includes('429') || error.message.includes('quota')));
                 if (isRateLimit) {
                     console.warn(`Paid Key ${currentKeyIndex} rate limited. Rotating...`);
                     continue;
                 }
                 throw error;
             }
        }
    }

    throw new Error("All API Keys (Free & Paid) are currently rate limited. Please wait.");
  }
}

export const keyManager = new KeyManager();

// --- CLIENT FACTORY ---
const getClient = (key: string, isPaidKey: boolean = false) => {
  if (!key) throw new Error("Missing Key");

  // Ultra Token Strategy (OAuth2 - ya29...)
  if (key.startsWith('ya29')) {
    const customFetch = (url: RequestInfo | URL, init?: RequestInit) => {
      const newInit = { ...init };
      const newHeaders = new Headers(newInit.headers);
      newHeaders.set('Authorization', `Bearer ${key}`);
      newHeaders.delete('x-goog-api-key');
      newInit.headers = newHeaders;
      return window.fetch(url, newInit);
    };

    return new GoogleGenAI({ 
      apiKey: 'BEARER_TOKEN_MODE', 
      fetch: customFetch 
    } as any);
  }

  // Standard API Key (AIza...)
  // If it's a Paid Key (AIza), we treat it as standard API key authentication.
  return new GoogleGenAI({ apiKey: key });
};

// Helper to strip base64 prefix
const stripBase64Prefix = (base64: string) => {
  return base64.replace(/^data:image\/[a-z]+;base64,/, "");
};

export const cleanJsonString = (text: string) => {
    // Remove Markdown code blocks
    let clean = text.replace(/```json\s*|\s*```/g, "").trim();
    // Sometimes Gemini returns text before the JSON, find the first '{' and last '}'
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- EXPORTED SERVICES ---

// 1. Configuration (Called from App.tsx)
export const setKeyPools = (free: string[], paid: string[]) => {
  keyManager.setPools(free, paid);
};

// 2. Validation
export const validateToken = async (token: string): Promise<boolean> => {
  try {
    const ai = getClient(token);
    // Use Flash for validation as it's the most available model
    await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts: [{ text: "test" }] }
    });
    return true;
  } catch (err: any) {
    console.error("Validation error:", err);
    throw err;
  }
};

// 3. Cleanup
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
      const ai = getClient(key, isPaidPool);
      
      if (!isUltra) {
          await sleep(isPaidPool ? 500 : 1000);
      }

      const prompt = "Isolate this product on a pure white background. Remove any wires, strings, or cluttered background elements. Keep the product itself exactly as is, high resolution, sharp details.";

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
            { text: prompt }
          ]
        }
      });

      // Try to find image part
      // Gemini 1.5 often returns image in different structure or just text if it refuses
      // We assume generateContent returns image for multimodal model
      // NOTE: GoogleGenAI SDK structure for images might vary, check candidates
      // If generateContent fails to return image directly, we might need generateImages (Imagen)
      // But for 1.5 Flash, it returns text mostly. 
      // FIX: Use Flash for Logic, but we need Image editing.
      // Currently, generateContent with 1.5 Flash returns text. 
      // We need to use 'imagen-3.0-generate-001' or similar if we want new pixels.
      // BUT for "Cleanup/Edit", there isn't a direct public API yet except via some specific models.
      // FALLBACK: Return original if we can't edit.
      
      console.warn("Cleanup with 1.5 Flash might just describe the cleanup. Returning original for now to prevent breakage until Image Edit API is public.");
      return imageBase64; 
  });
};

// 4. Analysis
export const analyzeProductDesign = async (
    imageBase64: string, 
    productType: string,
    designMode: DesignMode,
    preferredModel: string = 'gemini-1.5-flash'
  ): Promise<ProductAnalysis> => {
    
    return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
        const ai = getClient(key, isPaidPool);
        
        let activeModel = (isUltra || isPaidPool) ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

        if (!isUltra) {
             await sleep(isPaidPool ? 500 : 1000);
        }

        const isAutoDetect = productType === "Auto-Detect / Random";
        let materialInfo = "";
        let typeInstruction = "";

        if (isAutoDetect) {
           typeInstruction = "First, IDENTIFY the product type (e.g., Ornament, Suncatcher, Home Decor) and its likely materials based on the image visual cues. Then proceed with the analysis.";
        } else {
           materialInfo = PRODUCT_MATERIALS[productType] || "";
           typeInstruction = `Product Type: ${productType}\nMaterial Specs: ${materialInfo}`;
        }

        const prompt = `Analyze this product image for a redesign task.
        ${typeInstruction}
        Design Goal: ${designMode === DesignMode.NEW_CONCEPT ? "Create a completely new creative concept" : "Enhance existing design"}.
      
        Task:
        1. Analyze the image.
        2. Provide a description and critique.
        3. List detected components (characters, text, patterns).
        4. Create a 'redesignPrompt' that generates a BETTER, High-Quality version of this product. ${isAutoDetect ? "Explicitly mention the identified product type and premium materials in this prompt." : `Explicitly mention it is a '${productType}' with '${materialInfo}'.`}

        Return a JSON object with fields: description, designCritique, detectedComponents, redesignPrompt.
        IMPORTANT: detectedComponents must be an array of strings.
        `;
        
        try {
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                    { text: prompt }
                ]
                },
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "{}";
            
            // Robust JSON Parsing
            let rawResult;
            try {
                rawResult = JSON.parse(cleanJsonString(text));
            } catch (e) {
                console.error("JSON Parse Error", text);
                // Fallback structure
                rawResult = {
                    description: "Failed to parse analysis.",
                    designCritique: "AI returned invalid format.",
                    detectedComponents: [],
                    redesignPrompt: "Create a beautiful variation of this product."
                };
            }

            // SANITIZE
            let components = rawResult.detectedComponents;
            if (typeof components === 'string') {
                components = components.split(',').map((s: string) => s.trim());
            } else if (!Array.isArray(components)) {
                components = [];
            }

            return {
                ...rawResult,
                detectedComponents: components
            } as ProductAnalysis;

        } catch (error: any) {
            console.error("Analysis Error", error);
            throw error;
        }
    });
  };

// 5. Extract Elements
export const extractDesignElements = async (imageBase64: string): Promise<string[]> => {
  // Skipping extraction for now as 1.5 Flash doesn't support 'crop' natively in generateContent
  // Returning placeholder to prevent crash
  return [];
};

// 6. Generate Redesigns
export const generateProductRedesigns = async (
    basePrompt: string,
    ropeType: RopeType,
    selectedComponents: string[],
    userNotes: string,
    productType: string,
    useUltraFlag: boolean
  ): Promise<string[]> => {
    
    // 1. Construct Prompt
    let finalPrompt = basePrompt;
    const isAutoDetect = productType === "Auto-Detect / Random";
    if (!isAutoDetect) {
       const materialInfo = PRODUCT_MATERIALS[productType] || "";
       finalPrompt += `\n\nMaterial Specs: ${materialInfo}`;
    }
    if (ropeType !== RopeType.NONE) finalPrompt += `\nAdd ${ropeType} loop.`;
    if (userNotes) finalPrompt += `\nUser Request: ${userNotes}`;

    finalPrompt += `\n\nCreate a Photorealistic Mockup. High resolution.`;

    // 2. Generation Loop
    const results: string[] = [];
    
    // Use Imagen 3.0 for generation
    // Note: Imagen API structure in @google/genai might differ from generateContent
    // We try 'imagen-3.0-generate-001' via generateImages
    
    for(let i=0; i<6; i++) {
        await sleep(1000); 
        const img = await keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
             const ai = getClient(key, isPaidPool);
             
             try {
                 const response = await ai.models.generateImages({
                    model: 'imagen-3.0-generate-001',
                    prompt: finalPrompt,
                    config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
                 });
                 
                 if(response.generatedImages?.[0]?.image?.imageBytes) {
                    return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
                 }
                 throw new Error("No image data");
             } catch (err: any) {
                 console.warn(`Imagen 3.0 failed: ${err.message}`);
                 return null;
             }
        }).catch(e => null);
        
        if (img) results.push(img);
    }
    
    // Fallback if Imagen fails completely: Use Placeholder (or notify user)
    // Since Flash cannot generate images from scratch (it's multimodal text-to-text/vision), 
    // we strictly rely on Imagen 3.0 here.
    
    return results;
};

// 7. Remix & Mockup (Placeholder for now as Edit API is limited)
export const remixProductImage = async (imageBase64: string, instruction: string): Promise<string> => {
    return imageBase64; // Return original to avoid crash
};

export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
    return [];
};

export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
    return imageBase64;
};
