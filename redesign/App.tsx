import React, { useState, useRef } from "react";
import {
  cleanupProductImage,
  analyzeProductDesign,
  generateProductRedesigns,
  remixProductImage,
  detectAndSplitCharacters,
  generateRandomMockup,
  extractDesignElements
} from "./services/geminiService";

function App() {
  const [step, setStep] = useState<"upload" | "analyze" | "redesign">("upload");
  const [originalImage, setOriginalImage] = useState<string>("");
  const [cleanedImage, setCleanedImage] = useState<string>("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [redesigns, setRedesigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [productType, setProductType] = useState("t-shirt");
  const [designMode, setDesignMode] = useState("modern");
  const [customPrompt, setCustomPrompt] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload và cleanup image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setOriginalImage(base64);
        
        console.log("🧹 Cleaning up image...");
        const cleaned = await cleanupProductImage(base64);
        setCleanedImage(cleaned);
        
        setStep("analyze");
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Analyze product design
  const handleAnalyze = async () => {
    if (!cleanedImage) return;

    setLoading(true);
    setError("");

    try {
      console.log("🔍 Analyzing product design...");
      const result = await analyzeProductDesign(
        cleanedImage,
        productType,
        designMode
      );
      
      setAnalysis(result);
      setStep("redesign");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Generate redesigns
  const handleGenerateRedesigns = async () => {
    if (!analysis) return;

    setLoading(true);
    setError("");

    try {
      console.log("🎨 Generating redesigns...");
      const prompt = customPrompt || analysis.redesignPrompt;
      
      const results = await generateProductRedesigns(
        prompt,
        "default",
        [],
        customPrompt,
        productType,
        false
      );
      
      setRedesigns(results);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Remix specific design
  const handleRemix = async (imageBase64: string) => {
    const instruction = prompt("Enter remix instruction:");
    if (!instruction) return;

    setLoading(true);
    setError("");

    try {
      const remixed = await remixProductImage(imageBase64, instruction);
      setRedesigns([remixed, ...redesigns]);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Generate mockup
  const handleMockup = async (imageBase64: string) => {
    setLoading(true);
    setError("");

    try {
      const mockup = await generateRandomMockup(imageBase64);
      window.open(mockup, "_blank");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Download image
  const handleDownload = (imageBase64: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageBase64;
    link.download = filename;
    link.click();
  };

  // Reset app
  const handleReset = () => {
    setStep("upload");
    setOriginalImage("");
    setCleanedImage("");
    setAnalysis(null);
    setRedesigns([]);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 mb-4">
            🎨 AI Product Designer Pro
          </h1>
          <p className="text-gray-600 text-lg">
            Upload → Analyze → Generate 6 Unique Redesigns
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 text-center">
              <div className="animate-spin w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-xl font-semibold">Processing...</p>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-12 py-6 rounded-xl text-xl font-bold hover:scale-105 transition-transform"
            >
              📤 Upload Product Image
            </button>
            <p className="text-gray-500 mt-4">
              Supports: JPG, PNG, WEBP (max 20MB)
            </p>
          </div>
        )}

        {/* Step 2: Analyze */}
        {step === "analyze" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">🔍 Product Analysis</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Original Image */}
                <div>
                  <h3 className="font-semibold mb-2">Original</h3>
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-64 object-contain bg-gray-50 rounded-lg"
                  />
                </div>
                
                {/* Cleaned Image */}
                <div>
                  <h3 className="font-semibold mb-2">Cleaned (No Background)</h3>
                  <img
                    src={cleanedImage}
                    alt="Cleaned"
                    className="w-full h-64 object-contain bg-gray-50 rounded-lg"
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block font-semibold mb-2">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="t-shirt">T-Shirt</option>
                    <option value="mug">Mug</option>
                    <option value="poster">Poster</option>
                    <option value="sticker">Sticker</option>
                    <option value="phone-case">Phone Case</option>
                    <option value="tote-bag">Tote Bag</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-2">Design Mode</label>
                  <select
                    value={designMode}
                    onChange={(e) => setDesignMode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="modern">Modern & Minimal</option>
                    <option value="vintage">Vintage & Retro</option>
                    <option value="bold">Bold & Vibrant</option>
                    <option value="elegant">Elegant & Luxury</option>
                    <option value="playful">Playful & Fun</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
              >
                🚀 Analyze & Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Redesign */}
        {step === "redesign" && (
          <div className="space-y-6">
            {/* Analysis Results */}
            {analysis && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold mb-4">📊 Analysis Results</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{analysis.title}</h3>
                    <p className="text-gray-600 mb-4">{analysis.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.detectedComponents?.map((comp: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <img
                      src={cleanedImage}
                      alt="Product"
                      className="w-full h-48 object-contain bg-gray-50 rounded-lg"
                    />
                  </div>
                </div>

                {/* Custom Prompt */}
                <div className="mt-6">
                  <label className="block font-semibold mb-2">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={analysis.redesignPrompt}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg h-24"
                  />
                </div>

                <button
                  onClick={handleGenerateRedesigns}
                  disabled={loading}
                  className="w-full mt-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
                >
                  ✨ Generate 6 Redesigns
                </button>
              </div>
            )}

            {/* Redesign Results */}
            {redesigns.length > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold mb-6">
                  🎨 Generated Redesigns ({redesigns.length})
                </h2>
                <div className="grid grid-cols-3 gap-6">
                  {redesigns.map((img, i) => (
                    <div
                      key={i}
                      className="relative group bg-gray-50 rounded-lg overflow-hidden"
                    >
                      <img
                        src={img}
                        alt={`Redesign ${i + 1}`}
                        className="w-full h-64 object-contain"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownload(img, `redesign-${i + 1}.png`)}
                          className="bg-white text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100"
                        >
                          💾 Download
                        </button>
                        <button
                          onClick={() => handleRemix(img)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700"
                        >
                          🔄 Remix
                        </button>
                        <button
                          onClick={() => handleMockup(img)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
                        >
                          📸 Mockup
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            <div className="text-center">
              <button
                onClick={handleReset}
                className="bg-gray-200 text-gray-800 px-8 py-3 rounded-xl font-semibold hover:bg-gray-300"
              >
                🔄 Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
