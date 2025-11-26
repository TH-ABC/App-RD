import { GoogleGenAI } from "@google/genai";
import { ProductAnalysis, DesignMode, RopeType, PRODUCT_MATERIALS } from "../types";

// Helper to strip base64 prefix
const stripBase64Prefix = (base64: string) => {
  return base64.replace(/^data:image\/[a-z]+;base64,/, "");
};

export const cleanJsonString = (text: string) => {
    return text.replace(/```json\s*|\s*```/g, "").trim();
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust retry logic for API calls
async function executeWithRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    let currentDelay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && (error.message.includes('429') || error.message.includes('quota')));
            
            if (isRateLimit && i < retries - 1) {
                console.warn(`Rate limit hit. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
                await sleep(currentDelay);
                currentDelay *= 2; // Exponential backoff
                continue;
            }
            throw error;
        }
    }
    throw new Error("Operation failed after max retries");
}

// --- EXPORTED SERVICES ---

// 1. Configuration (No-op now as we use process.env.API_KEY)
export const setKeyPools = (free: string[], paid: string[]) => {
  console.log("Key pools are managed via Environment Variables in this version.");
};

// 2. Validation (No longer needed for UI, but kept for compatibility if imported)
export const validateToken = async (token: string): Promise<boolean> => {
  return true; 
};

// 3. Cleanup
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  return executeWithRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    designMode: DesignMode
  ): Promise<ProductAnalysis> => {
    
    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Use Flash for speed and reliability in standard env
        const activeModel = 'gemini-2.5-flash';

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

  for (const prompt of prompts) {
      try {
        const img = await executeWithRetry(async () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        await sleep(500); // Gentle pacing
      } catch (e) { console.error("Extraction partial fail", e); }
  }
  return results;
};

// 6. Generate Redesigns
export const generateProductRedesigns = async (
    basePrompt: string,
    ropeType: RopeType,
    selectedComponents: string[],
    userNotes: string,
    productType: string,
    useUltraFlag: boolean // Kept for signature compatibility but ignored
  ): Promise<string[]> => {
    
    // 1. Construct the Prompt
    let finalPrompt = basePrompt;
    
    const isAutoDetect = productType === "Auto-Detect / Random";
    if (!isAutoDetect) {
       const materialInfo = PRODUCT_MATERIALS[productType] || "";
       finalPrompt += `\n\nMaterial Specs: ${materialInfo}`;
    } else {
        finalPrompt += `\n\nEnsure High-Quality Material Rendering appropriate for this product type.`;
    }

    if (ropeType !== RopeType.NONE) finalPrompt += `\nAdd ${ropeType} loop.`;
    if (userNotes) finalPrompt += `\nUser Request: ${userNotes}`;
    if (selectedComponents.length > 0) finalPrompt += `\nKeep elements: ${selectedComponents.join(", ")}.`;

    if (productType.includes('Acrylic') || productType.includes('Suncatcher') || (isAutoDetect && basePrompt.toLowerCase().includes('acrylic'))) {
       finalPrompt += `\n\nCRITICAL PHYSICAL PROPERTIES:
       - The material MUST be depicted as a THIN (3mm) sheet. Do NOT render it as a thick block.
       - CUTLINE: The acrylic must be laser-cut VERY CLOSE to the design edge (Kiss-cut).
       - TRANSPARENCY: Optically clear background.`;
    }

    finalPrompt += `\n\nIMPORTANT PRESENTATION: Generate this as a High-Quality Product Photography Mockup.
    - The product should be hanging or placed in a beautiful, realistic environment.
    - Do NOT use a plain white background.
    - Use cinematic lighting, depth of field (bokeh).`;


    const results: string[] = [];
    // Generate 6 images. Standard key might rate limit, so we proceed sequentially with retries.
    for(let i=0; i<6; i++) {
        await sleep(500); // Stagger requests
        try {
            const img = await executeWithRetry(async () => {
                 const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                 
                 // Try Imagen 4.0 first if possible, else Flash
                 // Note: Imagen needs specific quotas. We default to Flash Image for reliability on standard keys.
                 // If you want to use Imagen, uncomment logic, but Flash Image is safer for general 'gemini-api' keys.
                 // We will stick to gemini-2.5-flash-image per guidelines for general tasks unless requested.
                 
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
            });
            if (img) results.push(img);
        } catch (e) {
            console.error(`Generation ${i+1} failed`, e);
        }
    }
    return results;
};

// 7. Remix
export const remixProductImage = async (imageBase64: string, instruction: string): Promise<string> => {
    const prompt = `Image Editor. Instruction: ${instruction}. Preserve Text spelling exactly.`;
    
    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
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

// 8. Split Characters
export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const identifyPrompt = "Analyze image. List the main distinct characters (humans, animals, snowmen) visible. Return a comma-separated list of their names/descriptions. Ignore small background elements.";
        
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

        const isolatedImages: string[] = [];
        
        // Sequential generation to be safe
        for (const charName of characterList.slice(0, 4)) {
             try {
                 const isolatePrompt = `Crop and isolate ONLY the ${charName} from this image. Place it on a PURE WHITE background. High resolution.`;
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
                     isolatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
                 }
                 await sleep(300);
             } catch (e) { console.error(`Failed to split ${charName}`, e); }
        }
        
        return isolatedImages;
    });
};

// 9. Random Mockup
export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
    return executeWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `Image Editor. 
        Action: Place this isolated object into a professional Print-on-Demand (POD) product photography setting.
        Logic:
        - If Ornament: Hang on a Christmas tree with bokeh lights.
        - Else: Place on a rustic wooden table with cinematic lighting.
        Requirement: High-resolution, photorealistic.`;

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
        throw new Error("Mockup generation failed.");
    });
};