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

// --- API KEY MANAGEMENT (PAID BILLING) ---
const API_KEYS = [
  "AIzaSyABqklwZahC-ixZ4vvQ28Gjl6Np4Q7qdwc",
  "AIzaSyDXSPV_UcVjG4u03-197gcym3h9bavO20Q",
  "AIzaSyBIuCGUzbmAQHQejpByAq1SZI6wOu9U7HM"
];

let currentKeyIndex = 0;

const getNextKey = () => {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  // console.log(`Using API Key [${currentKeyIndex}]: ...${key.slice(-4)}`);
  return key;
};

// Initialize AI client with rotated key
const getAiClient = () => {
  const apiKey = getNextKey();
  return new GoogleGenAI({ apiKey });
};

// Robust retry logic for API calls
// Reduced delays significantly since we are using Paid Keys
async function executeWithRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
    let currentDelay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            // Check for Rate Limit (429) or Quota Exhausted
            const isRateLimit = error?.status === 429 || error?.code === 429 || 
                               (error?.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exhausted')));
            
            // Check for Model Not Found (404) - Do not retry
            const isNotFound = error?.status === 404 || (error?.message && error.message.includes('404'));
            if (isNotFound) {
                console.error("Model not found. Please check usage.", error);
                throw new Error("AI Model not found or deprecated. Please check configuration.");
            }

            const isServerTransient = error?.status === 503 || error?.status === 500;

            if ((isRateLimit || isServerTransient) && i < retries - 1) {
                console.warn(`Transient error. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
                await sleep(currentDelay);
                currentDelay *= 2; 
                continue;
            }

            throw error;
        }
    }
    throw new Error("Operation failed after max retries");
}

// --- EXPORTED SERVICES ---

// 1. Cleanup
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  return executeWithRetry(async () => {
      const ai = getAiClient();
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

// 2. Analysis
export const analyzeProductDesign = async (
    imageBase64: string, 
    productType: string,
    designMode: DesignMode
  ): Promise<ProductAnalysis> => {
    
    return executeWithRetry(async () => {
        const ai = getAiClient();
        // Use 2.5 Flash for text analysis tasks
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

// 3. Extract Elements
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
            const ai = getAiClient();
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
        
        // Minimal delay for Paid Keys
        await sleep(500); 
      } catch (e) { console.error("Extraction partial fail", e); }
  }
  return results;
};

// 4. Generate Redesigns
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
    // Generate 6 images sequentially (Paid keys are fast enough)
    for(let i=0; i<6; i++) {
        // Minimal buffer for stability
        await sleep(500); 
        
        try {
            const img = await executeWithRetry(async () => {
                 const ai = getAiClient();
                 
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

// 5. Remix
export const remixProductImage = async (imageBase64: string, instruction: string): Promise<string> => {
    const prompt = `Image Editor. Instruction: ${instruction}. Preserve Text spelling exactly.`;
    
    return executeWithRetry(async () => {
        const ai = getAiClient();
        
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

// 6. Split Characters
export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
    return executeWithRetry(async () => {
        const ai = getAiClient();

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
        
        // Fast sequence for Paid keys
        for (const charName of characterList.slice(0, 4)) {
             await sleep(500); 
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
             } catch (e) { console.error(`Failed to split ${charName}`, e); }
        }
        
        return isolatedImages;
    });
};

// 7. Random Mockup
export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
    return executeWithRetry(async () => {
        const ai = getAiClient();
        
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
