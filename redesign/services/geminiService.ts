// services/geminiService.ts (Dạng B — Frontend dùng Backend Proxy /api/generate)
// Frontend KHÔNG gọi GoogleGenAI trực tiếp nữa. Mọi thứ đi qua backend.

/* ---------------------------------------------------------
   Helper chung để gọi /api/generate
--------------------------------------------------------- */
async function callApi(action: string, payload: any) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API /api/generate error (${res.status}): ${text}`);
  }

  // Giả định backend luôn trả JSON
  return res.json();
}

/* ---------------------------------------------------------
   1. setKeyPools — Dạng B không dùng nữa, để cho code cũ không lỗi import
--------------------------------------------------------- */
export const setKeyPools = (_free?: string[], _paid?: string[]) => {
  // Không làm gì cả ở Dạng B
  return;
};

/* ---------------------------------------------------------
   2. Validate token (nếu cần)
--------------------------------------------------------- */
export const validateToken = async (): Promise<boolean> => {
  const data = await callApi("validate", {});
  return data.ok === true;
};

/* ---------------------------------------------------------
   3. Cleanup product image (remove background, enhance)
--------------------------------------------------------- */
export const cleanupProductImage = async (imageBase64: string): Promise<string> => {
  const data = await callApi("cleanup", { image: imageBase64 });
  // Backend trả về { result: "data:image/..." }
  return data.result;
};

/* ---------------------------------------------------------
   4. Analyze product design
--------------------------------------------------------- */
export const analyzeProductDesign = async (
  imageBase64: string,
  productType: string,
  designMode: string
): Promise<any> => {
  const data = await callApi("analyze", {
    image: imageBase64,
    productType,
    designMode
  });
  // Backend trả { result: {...ProductAnalysis} }
  return data.result;
};

/* ---------------------------------------------------------
   5. Extract design elements (frames)
--------------------------------------------------------- */
export const extractDesignElements = async (imageBase64: string): Promise<string[]> => {
  const data = await callApi("extract", { image: imageBase64 });
  // Backend trả { results: [img1, img2, ...] }
  return data.results || [];
};

/* ---------------------------------------------------------
   6. Generate product redesigns (6 images)
--------------------------------------------------------- */
export const generateProductRedesigns = async (
  basePrompt: string,
  ropeType: string,
  selectedComponents: string[],
  userNotes: string,
  productType: string,
  useUltraFlag: boolean
): Promise<string[]> => {
  const data = await callApi("redesign", {
    basePrompt,
    ropeType,
    selectedComponents,
    userNotes,
    productType,
    useUltraFlag
  });
  // Backend trả { results: [img...] }
  return data.results || [];
};

/* ---------------------------------------------------------
   7. Remix product image theo instruction
--------------------------------------------------------- */
export const remixProductImage = async (
  imageBase64: string,
  instruction: string
): Promise<string> => {
  const data = await callApi("remix", {
    image: imageBase64,
    instruction
  });
  // Backend trả { result: "data:image/..." }
  return data.result;
};

/* ---------------------------------------------------------
   8. Detect & split characters
--------------------------------------------------------- */
export const detectAndSplitCharacters = async (
  imageBase64: string
): Promise<string[]> => {
  const data = await callApi("splitCharacters", { image: imageBase64 });
  // Backend trả { results: [img1, img2, ...] }
  return data.results || [];
};

/* ---------------------------------------------------------
   9. Generate random mockup
--------------------------------------------------------- */
export const generateRandomMockup = async (
  imageBase64: string
): Promise<string> => {
  const data = await callApi("mockup", { image: imageBase64 });
  // Backend trả { result: "data:image/..." }
  return data.result;
};
