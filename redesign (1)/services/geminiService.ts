
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

  // Core rotation execution
  async executeWithRetry<T>(operation: (key: string, isUltra: boolean, isPaidPool: boolean) => Promise<T>): Promise<T> {
    if (!this.hasKeys()) {
       // Fallback to env key if no pool
       const envKey = process.env.API_KEY;
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
  // The 'isPaidKey' logic is handled in model selection, not client initialization.
  return new GoogleGenAI({ apiKey: key });
};

// Helper to strip base64 prefix
const stripBase64Prefix = (base64: string) => {
  return base64.replace(/^data:image\/[a-z]+;base64,/, "");
};

export const cleanJsonString = (text: string) => {
    return text.replace(/```json\s*|\s*```/g, "").trim();
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
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
      
      // Sleep strategy:
      // - OAuth Token (Ultra): No sleep (User Quota)
      // - Paid API Key (AIza): Sleep 500ms (High Limits but still rate limited)
      // - Free API Key: Sleep 1000ms (Low Limits)
      if (!isUltra) {
          await sleep(isPaidPool ? 500 : 1000);
      }

      const prompt = "Isolate this product on a pure white background. Remove any wires, strings, or cluttered background elements. Keep the product itself exactly as is, high resolution, sharp details.";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
            { text: prompt }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
              return `data:image/png;base64,${part.inlineData.data}`;
          }
      }
      console.warn("Cleanup returned no image, using original.");
      return imageBase64;
  });
};

// 4. Analysis
export const analyzeProductDesign = async (
    imageBase64: string, 
    productType: string,
    designMode: DesignMode,
    preferredModel: string = 'gemini-2.5-flash' // Pass preference, but logic below handles fallback
  ): Promise<ProductAnalysis> => {
    
    return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
        const ai = getClient(key, isPaidPool);
        
        // Model Selection Strategy:
        // - Ultra Token OR Paid Key (AIza or Token): Use 'gemini-1.5-pro' (Best quality)
        // - Free Key: Use 'gemini-2.5-flash' (Fast, Free)
        let activeModel = (isUltra || isPaidPool) ? 'gemini-1.5-pro' : 'gemini-2.5-flash';

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
            const rawResult = JSON.parse(cleanJsonString(text));

            // SANITIZE: Ensure detectedComponents is always an array
            let components = rawResult.detectedComponents;
            if (typeof components === 'string') {
                // If AI returned a string "a, b, c", split it
                components = components.split(',').map((s: string) => s.trim());
            } else if (!Array.isArray(components)) {
                // If it's null, undefined, or object, default to empty array
                components = [];
            }

            return {
                ...rawResult,
                detectedComponents: components
            } as ProductAnalysis;

        } catch (error: any) {
            // Intra-key fallback: If Pro fails (e.g. 404 or rate limit), try Flash on the SAME key immediately
            if (activeModel !== 'gemini-2.5-flash') {
                console.warn(`Pro model failed (${error.status}), falling back to Flash on same key.`);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                            { text: prompt }
                        ]
                    },
                    config: { responseMimeType: "application/json" }
                });
                const text = response.text || "{}";
                const rawResult = JSON.parse(cleanJsonString(text));
                
                let components = rawResult.detectedComponents;
                if (typeof components === 'string') {
                    components = components.split(',').map((s: string) => s.trim());
                } else if (!Array.isArray(components)) {
                    components = [];
                }

                return { ...rawResult, detectedComponents: components } as ProductAnalysis;
            }
            throw error; // Throw to trigger rotation to next key
        }
    });
  };

// 5. Extract Elements
export const extractDesignElements = async (imageBase64: string): Promise<string[]> => {
  const prompts = [
    "Crop and isolate the main CHARACTER or central figure.",
    "Crop and isolate the BACKGROUND PATTERN.",
    "Crop and isolate any TEXT or LOGO elements."
  ];

  const results: string[] = [];

  // Sequential execution, rotating keys for EACH component to spread load
  for (const prompt of prompts) {
      try {
        const img = await keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
            const ai = getClient(key, isPaidPool);
            if (!isUltra) await sleep(isPaidPool ? 500 : 1000);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                        { text: prompt }
                    ]
                }
            });
            
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            return null;
        });
        if (img) results.push(img);
      } catch (e) { console.error("Extraction partial fail", e); }
  }
  return results;
};

// 6. Generate Redesigns (Batching Logic embedded)
export const generateProductRedesigns = async (
    basePrompt: string,
    ropeType: RopeType,
    selectedComponents: string[],
    userNotes: string,
    productType: string,
    useUltraFlag: boolean // Flag kept for compatibility, logic uses detection
  ): Promise<string[]> => {
    
    let finalPrompt = basePrompt;
    
    const isAutoDetect = productType === "Auto-Detect / Random";
    if (!isAutoDetect) {
       const materialInfo = PRODUCT_MATERIALS[productType] || "";
       finalPrompt += `\n\nMaterial Specs: ${materialInfo}`;
    } else {
        // For auto-detect, we assume the basePrompt (from analysis) already contains the type/material info
        // We add a generic booster for quality
        finalPrompt += `\n\nEnsure High-Quality Material Rendering appropriate for this product type.`;
    }

    if (ropeType !== RopeType.NONE) finalPrompt += `\nAdd ${ropeType} loop.`;
    if (userNotes) finalPrompt += `\nUser Request: ${userNotes}`;
    if (selectedComponents.length > 0) finalPrompt += `\nKeep elements: ${selectedComponents.join(", ")}.`;

    // --- Specific Adjustments for Acrylic/Suncatcher Thickness ---
    // Only apply if explicitly selected or if Auto-detect likely found it (naive check on prompt)
    if (productType.includes('Acrylic') || productType.includes('Suncatcher') || (isAutoDetect && basePrompt.toLowerCase().includes('acrylic'))) {
       finalPrompt += `\n\nCRITICAL PHYSICAL PROPERTIES:
       - The material MUST be depicted as a THIN (3mm) sheet. Do NOT render it as a thick block or heavy slab.
       - CUTLINE: The acrylic must be laser-cut VERY CLOSE to the design edge (Kiss-cut / tight contour). No large transparent border margin.
       - TRANSPARENCY: The unprinted areas must be optically clear (crystal clear). Background should be visible through these parts.
       - EDGE: Clean, sharp laser-cut edge.`;
    }

    // --- Enforce Beautiful Mockup Backgrounds ---
    finalPrompt += `\n\nIMPORTANT PRESENTATION: Generate this as a High-Quality Product Photography Mockup.
    - The product should be hanging or placed in a beautiful, realistic environment matching its theme (e.g., on a Christmas tree with lights, on a rustic wooden table, or against a cozy window).
    - Do NOT use a plain white background.
    - Use cinematic lighting, depth of field (bokeh), and high-resolution textures.
    - Make it look like a top-selling Etsy/Amazon product listing image.`;

    // Function to generate ONE image (Key rotation happens inside this call)
    const generateOne = () => {
        return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
             const ai = getClient(key, isPaidPool);
             
             // THRESHOLD ADJUSTMENT:
             // Increase sleep to 2500ms for Paid API Keys (AIza) to prevent RPM Rate Limits on Imagen.
             if (!isUltra) {
                 await sleep(isPaidPool ? 2500 : 2000); 
             }

             // Helper function to use Flash Image (via generateContent)
             // This uses a different quota bucket than Imagen and is often more available.
             const runFlashGen = async () => {
                 const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: finalPrompt }] }
                 });
                 for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                 }
                 return null;
             };

             // PRIORITY STRATEGY: ALWAYS Try Imagen 4.0 First (Unless it's impossible)
             // We fallback to Flash on ANY error (Quota, 429, 400, etc.)
             try {
                 // Attempt Imagen 4.0
                 const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: finalPrompt,
                    config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
                 });
                 
                 if(response.generatedImages?.[0]?.image?.imageBytes) {
                    return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
                 }
                 // If no image bytes, treat as error to trigger fallback
                 throw new Error("No image data returned from Imagen");

             } catch (err: any) {
                 // CRITICAL FALLBACK: 
                 // If Imagen hits "limited free generations", "quota exceeded", "429", "400" or ANYTHING
                 // we switch to Flash Image on the SAME key immediately.
                 console.warn(`Imagen failed for key (falling back to Flash): ${err.message}`);
                 return await runFlashGen();
             }
        });
    };

    const results: string[] = [];
    const promises = [];
    for(let i=0; i<6; i++) {
        // Stagger start slightly to not hit the *same* key in the exact millisecond if pool is small
        // Even with executeWithRetry sleep, staggering promises helps the KeyManager lock/rotate correctly
        await sleep(500); 
        promises.push(generateOne().catch(e => null));
    }

    const rawResults = await Promise.all(promises);
    rawResults.forEach(r => { if (r) results.push(r); });

    return results;
};

// 7. Remix
export const remixProductImage = async (imageBase64: string, instruction: string): Promise<string> => {
    const prompt = `Image Editor. Instruction: ${instruction}. Preserve Text spelling exactly.`;
    
    return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
        const ai = getClient(key, isPaidPool);
        if (!isUltra) await sleep(isPaidPool ? 500 : 1000);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                    { text: prompt }
                ]
            }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        throw new Error("Remix failed to generate image");
    });
};

// 8. Split Characters (New)
export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
    return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
        const ai = getClient(key, isPaidPool);
        if (!isUltra) await sleep(isPaidPool ? 500 : 1000);

        // Step 1: Identify characters
        // Improve detection for splitting human/animal figures specifically
        const identifyPrompt = "Analyze image. List the main distinct characters (humans, animals, snowmen) visible. Return a comma-separated list of their names/descriptions (e.g. 'Santa, Reindeer, Child'). Ignore small background elements.";
        
        const identifyResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                    { text: identifyPrompt }
                ]
            }
        });
        const characterList = identifyResponse.text?.split(',').map(s => s.trim()) || [];
        
        if (characterList.length === 0) return [];

        // Step 2: Generate isolated images for each
        // We use parallel execution here since we have retry logic
        const isolatedImages: string[] = [];
        
        const generateIsolated = async (charName: string) => {
             const isolatePrompt = `Crop and isolate ONLY the ${charName} from this image. Place it on a PURE WHITE background. High resolution. Ensure the full figure is visible.`;
             const resp = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                 contents: {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                        { text: isolatePrompt }
                    ]
                }
             });
             const part = resp.candidates?.[0]?.content?.parts?.[0];
             if (part?.inlineData?.data) {
                 return `data:image/png;base64,${part.inlineData.data}`;
             }
             return null;
        };

        const promises = characterList.slice(0, 4).map(c => generateIsolated(c)); // Limit to 4 chars max
        const results = await Promise.all(promises);
        results.forEach(r => { if(r) isolatedImages.push(r); });
        
        return isolatedImages;
    });
};

// 9. Random Mockup (New)
export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
    return keyManager.executeWithRetry(async (key, isUltra, isPaidPool) => {
        const ai = getClient(key, isPaidPool);
        if (!isUltra) await sleep(isPaidPool ? 500 : 1000);
        
        // Strict prompt format for "Image Editor" behavior
        const prompt = `Image Editor. 
        Action: Place this isolated object into a professional Print-on-Demand (POD) product photography setting.
        
        Logic:
        - If Ornament: Hang on a Christmas tree with bokeh lights. Use a THIN invisible string. Ensure the object looks thin (3mm) and transparent if applicable.
        - If Sticker/Decal: Place on a laptop or notebook.
        - Else: Place on a rustic wooden table with cinematic lighting.

        Requirement:
        - The object must look naturally placed with correct shadows and lighting.
        - High-resolution, photorealistic.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: stripBase64Prefix(imageBase64) } },
                    { text: prompt }
                ]
            }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        
        // If we get here, the model probably returned text saying "I cannot..."
        const textResponse = response.text || "No response text";
        console.warn(`Mockup gen failed. Model output: ${textResponse}`);
        throw new Error("Mockup generation failed. The model might have refused the edit request.");
    });
};
