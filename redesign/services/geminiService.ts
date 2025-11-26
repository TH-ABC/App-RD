//
// geminiService.ts (Dạng B - dùng backend proxy /api/generate)
// -------------------------------------------------------------
// Toàn bộ request đều đi qua backend → Không lộ token
// Không còn gọi Google trực tiếp từ trình duyệt
//

// Utility
export const cleanJsonString = (text: string) => {
  return text.replace(/```json\s*|\s*```/g, "").trim();
};

// --------------------------------------------
// VALIDATE TOKEN
// --------------------------------------------
export const validateToken = async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate" })
    });

    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error("Validate token error:", err);
    return false;
  }
};

// --------------------------------------------
// CLEANUP IMAGE (Remove Background, Enhance)
// --------------------------------------------
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "cleanup",
      image: imageBase64
    })
  });

  const data = await res.json();
  return data.result;
};

// --------------------------------------------
// ANALYZE PRODUCT IMAGE
// --------------------------------------------
export const analyzeProductDesign = async (
  imageBase64: string,
  productType: string,
  designMode: string
): Promise<any> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "analyze",
      image: imageBase64,
      productType,
      designMode
    })
  });

  const data = await res.json();
  return data.result;
};

// --------------------------------------------
// GENERATE REDESIGNS (6 IMAGES)
// --------------------------------------------
export const generateProductRedesigns = async (
  basePrompt: string,
  ropeType: string,
  selectedComponents: string[],
  userNotes: string,
  productType: string,
  useUltraFlag: boolean
): Promise<string[]> => {

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "redesign",
      payload: {
        basePrompt,
        ropeType,
        selectedComponents,
        userNotes,
        productType,
        useUltraFlag
      }
    })
  });

  const data = await res.json();
  return data.results || [];
};

// --------------------------------------------
// EXTRACT DESIGN ELEMENTS
// --------------------------------------------
export const extractDesignElements = async (imageBase64: string): Promise<string[]> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "extract",
      image: imageBase64
    })
  });

  const data = await res.json();
  return data.results || [];
};

// --------------------------------------------
// REMIX IMAGE WITH INSTRUCTIONS
// --------------------------------------------
export const remixProductImage = async (
  imageBase64: string,
  instruction: string
): Promise<string> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "remix",
      image: imageBase64,
      instruction
    })
  });

  const data = await res.json();
  return data.result;
};

// --------------------------------------------
// CHARACTER SPLIT
// --------------------------------------------
export const detectAndSplitCharacters = async (imageBase64: string): Promise<string[]> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "splitCharacters",
      image: imageBase64
    })
  });

  const data = await res.json();
  return data.results || [];
};

// --------------------------------------------
// GENERATE MOCKUP IMAGE
// --------------------------------------------
export const generateRandomMockup = async (imageBase64: string): Promise<string> => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "mockup",
      image: imageBase64
    })
  });

  const data = await res.json();
  return data.result;
};
