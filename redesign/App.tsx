import React, { useState, useRef, useEffect } from "react";
import {
  cleanupProductImage,
  analyzeProductDesign,
  generateProductRedesigns,
  remixProductImage,
  detectAndSplitCharacters,
  generateRandomMockup,
  extractDesignElements
} from "./services/geminiService";

type Step = "upload" | "analyze" | "redesign" | "remix" | "mockup";

function App() {
  // ===== STATE MANAGEMENT =====
  const [step, setStep] = useState<Step>("upload");
  const [originalImage, setOriginalImage] = useState<string>("");
  const [cleanedImage, setCleanedImage] = useState<string>("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [redesigns, setRedesigns] = useState<string[]>([]);
  const [selectedRedesign, setSelectedRedesign] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  // Product settings
  const [productType, setProductType] = useState("t-shirt");
  const [designMode, setDesignMode] = useState("modern");
  const [customPrompt, setCustomPrompt] = useState("");
  const [ropeType, setRopeType] = useState("default");
  const [extraRefs, setExtraRefs] = useState<string[]>([]);
  const [useUltra, setUseUltra] = useState(false);

  // UI settings
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
  const [selectedDesigns, setSelectedDesigns] = useState<number[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== HANDLERS =====

  // Upload image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("File size must be less than 20MB");
      return;
    }

    setLoading(true);
    setError("");
    setProgress("Uploading image...");

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setOriginalImage(base64);

        setProgress("Removing background...");
        const cleaned = await cleanupProductImage(base64);
        setCleanedImage(cleaned);

        setStep("analyze");
        setProgress("");
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Analyze product
  const handleAnalyze = async () => {
    if (!cleanedImage) return;

    setLoading(true);
    setError("");
    setProgress("Analyzing product design...");

    try {
      const result = await analyzeProductDesign(
        cleanedImage,
        productType,
        designMode
      );

      setAnalysis(result);
      setStep("redesign");
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Generate redesigns
  const handleGenerateRedesigns = async () => {
    if (!analysis) return;

    setLoading(true);
    setError("");
    setProgress("Generating 6 unique redesigns...");

    try {
      const prompt = customPrompt || analysis.redesignPrompt;

      const results = await generateProductRedesigns(
        prompt,
        ropeType,
        extraRefs,
        customPrompt,
        productType,
        useUltra
      );

      setRedesigns(results);
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Remix design
  const handleRemix = async (imageBase64: string) => {
    const instruction = prompt("Enter remix instruction (e.g., 'make it more colorful', 'add flowers'):");
    if (!instruction) return;

    setLoading(true);
    setError("");
    setProgress("Remixing design...");

    try {
      const remixed = await remixProductImage(imageBase64, instruction);
      setRedesigns([remixed, ...redesigns]);
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Generate mockup
  const handleMockup = async (imageBase64: string) => {
    setLoading(true);
    setError("");
    setProgress("Generating premium mockup...");

    try {
      const mockup = await generateRandomMockup(imageBase64);
      window.open(mockup, "_blank");
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Split characters
  const handleSplitCharacters = async () => {
    if (!cleanedImage) return;

    setLoading(true);
    setError("");
    setProgress("Detecting and splitting objects...");

    try {
      const splits = await detectAndSplitCharacters(cleanedImage);
      setExtraRefs(splits);
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
      setLoading(false);
    }
  };

  // Extract design elements
  const handleExtractElements = async () => {
    if (!cleanedImage) return;

    setLoading(true);
    setError("");
    setProgress("Extracting design elements...");

    try {
      const elements = await extractDesignElements(cleanedImage);
      alert(`Detected elements: ${elements.join(", ")}`);
      setProgress("");
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setProgress("");
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

  // Download selected designs
  const handleDownloadSelected = () => {
    selectedDesigns.forEach((index) => {
      handleDownload(redesigns[index], `redesign-${index + 1}.png`);
    });
    setSelectedDesigns([]);
  };

  // Toggle design selection
  const toggleSelection = (index: number) => {
    setSelectedDesigns((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  // Reset app
  const handleReset = () => {
    setStep("upload");
    setOriginalImage("");
    setCleanedImage("");
    setAnalysis(null);
    setRedesigns([]);
    setSelectedDesigns([]);
    setError("");
    setProgress("");
  };

  // ===== RENDER =====

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
          <div className="flex justify-center gap-4 mt-4">
            <span className={`px-4 py-2 rounded-full ${step === "upload" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>
              1. Upload
            </span>
            <span className={`px-4 py-2 rounded-full ${step === "analyze" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>
              2. Analyze
            </span>
            <span className={`px-4 py-2 rounded-full ${step === "redesign" ? "bg-purple-600 text-white" : "bg-gray-200"}`}>
              3. Redesign
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-center justify-between">
            <div>
              <strong>Error:</strong> {error}
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 text-center max-w-md">
              <div className="animate-spin w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-xl font-semibold">{progress || "Processing..."}</p>
              <p className="text-gray-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="bg-white rounded-2xl shadow-2xl p-12">
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="border-4 border-dashed border-purple-300 rounded-xl p-12 mb-6">
                <div className="text-6xl mb-4">📤</div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-12 py-6 rounded-xl text-xl font-bold hover:scale-105 transition-transform"
                >
                  Upload Product Image
                </button>
                <p className="text-gray-500 mt-4">
                  Supports: JPG, PNG, WEBP (max 20MB)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-left">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">🧹</div>
                  <h3 className="font-bold mb-1">Auto Cleanup</h3>
                  <p className="text-sm text-gray-600">
                    Automatically removes background
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">🔍</div>
                  <h3 className="font-bold mb-1">AI Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Detects design elements & style
                  </p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <div className="text-2xl mb-2">✨</div>
                  <h3 className="font-bold mb-1">6 Variations</h3>
                  <p className="text-sm text-gray-600">
                    Generates unique redesigns
                  </p>
                </div>
              </div>
            </div>
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
                  <h3 className="font-semibold mb-2">Original Image</h3>
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-64 object-contain bg-gray-50 rounded-lg border-2 border-gray-200"
                  />
                </div>

                {/* Cleaned Image */}
                <div>
                  <h3 className="font-semibold mb-2">Cleaned (No Background)</h3>
                  <img
                    src={cleanedImage}
                    alt="Cleaned"
                    className="w-full h-64 object-contain bg-gray-50 rounded-lg border-2 border-gray-200"
                  />
                  <button
                    onClick={() => handleDownload(cleanedImage, "cleaned-product.png")}
                    className="mt-2 w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    💾 Download Cleaned Image
                  </button>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2">Product Type</label>
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="t-shirt">👕 T-Shirt</option>
                      <option value="mug">☕ Mug</option>
                      <option value="poster">🖼️ Poster</option>
                      <option value="sticker">🏷️ Sticker</option>
                      <option value="phone-case">📱 Phone Case</option>
                      <option value="tote-bag">👜 Tote Bag</option>
                      <option value="hoodie">🧥 Hoodie</option>
                      <option value="cap">🧢 Cap</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-2">Design Mode</label>
                    <select
                      value={designMode}
                      onChange={(e) => setDesignMode(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="modern">✨ Modern & Minimal</option>
                      <option value="vintage">🕰️ Vintage & Retro</option>
                      <option value="bold">🔥 Bold & Vibrant</option>
                      <option value="elegant">💎 Elegant & Luxury</option>
                      <option value="playful">🎈 Playful & Fun</option>
                      <option value="grunge">🎸 Grunge & Street</option>
                      <option value="nature">🌿 Nature & Organic</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-purple-600 font-semibold hover:text-purple-700"
                  >
                    {showAdvanced ? "▼" : "▶"} Advanced Options
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={useUltra}
                            onChange={(e) => setUseUltra(e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span>Use Ultra Quality (slower)</span>
                        </label>
                      </div>

                      <div>
                        <label className="block font-semibold mb-2">Rope Type</label>
                        <select
                          value={ropeType}
                          onChange={(e) => setRopeType(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                        >
                          <option value="default">Default</option>
                          <option value="smooth">Smooth</option>
                          <option value="textured">Textured</option>
                        </select>
                      </div>

                      <div>
                        <button
                          onClick={handleSplitCharacters}
                          disabled={loading}
                          className="w-full bg-blue-100 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                        >
                          🔍 Detect & Split Objects
                        </button>
                      </div>

                      <div>
                        <button
                          onClick={handleExtractElements}
                          disabled={loading}
                          className="w-full bg-green-100 text-green-700 px-4 py-3 rounded-lg hover:bg-green-200 disabled:opacity-50"
                        >
                          🎨 Extract Design Elements
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
                >
                  🚀 Analyze & Continue
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-200 text-gray-800 px-6 py-4 rounded-xl font-semibold hover:bg-gray-300"
                >
                  🔄 Start Over
                </button>
              </div>
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
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{analysis.title}</h3>
                    <p className="text-gray-600 mb-4">{analysis.description}</p>
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold">Detected Type:</span>{" "}
                        <span className="text-purple-600">{analysis.detectedType}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Strategy:</span>{" "}
                        <span className="text-blue-600">{analysis.strategy}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
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
                      className="w-full h-64 object-contain bg-gray-50 rounded-lg border-2 border-gray-200"
                    />
                  </div>
                </div>

                {/* Custom Prompt */}
                <div className="mb-6">
                  <label className="block font-semibold mb-2">
                    Custom Prompt (Optional)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={analysis.redesignPrompt || "Enter custom instructions..."}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave empty to use AI-generated prompt
                  </p>
                </div>

                <button
                  onClick={handleGenerateRedesigns}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
                >
                  ✨ Generate 6 Unique Redesigns
                </button>
              </div>
            )}

            {/* Redesign Results */}
            {redesigns.length > 0 && (
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">
                    🎨 Generated Redesigns ({redesigns.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-4 py-2 rounded-lg ${
                        viewMode === "grid"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setViewMode("carousel")}
                      className={`px-4 py-2 rounded-lg ${
                        viewMode === "carousel"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      Carousel
                    </button>
                  </div>
                </div>

                {selectedDesigns.length > 0 && (
                  <div className="mb-4 flex items-center justify-between bg-purple-50 p-4 rounded-lg">
                    <span className="font-semibold">
                      {selectedDesigns.length} design(s) selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadSelected}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                      >
                        💾 Download Selected
                      </button>
                      <button
                        onClick={() => setSelectedDesigns([])}
                        className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className={viewMode === "grid" ? "grid grid-cols-3 gap-6" : "space-y-4"}>
                  {redesigns.map((img, i) => (
                    <div
                      key={i}
                      className={`relative group bg-gray-50 rounded-lg overflow-hidden ${
                        selectedDesigns.includes(i) ? "ring-4 ring-purple-600" : ""
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Redesign ${i + 1}`}
                        className="w-full h-64 object-contain cursor-pointer"
                        onClick={() => toggleSelection(i)}
                      />
                      <div className="absolute top-2 right-2">
                        <input
                          type="checkbox"
                          checked={selectedDesigns.includes(i)}
                          onChange={() => toggleSelection(i)}
                          className="w-5 h-5"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-4">
                        <button
                          onClick={() => handleDownload(img, `redesign-${i + 1}.png`)}
                          className="bg-white text-gray-800 px-3 py-2 rounded-lg font-semibold hover:bg-gray-100 text-sm"
                        >
                          💾 Download
                        </button>
                        <button
                          onClick={() => handleRemix(img)}
                          className="bg-purple-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-purple-700 text-sm"
                        >
                          🔄 Remix
                        </button>
                        <button
                          onClick={() => handleMockup(img)}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-700 text-sm"
                        >
                          📸 Mockup
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleGenerateRedesigns}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
              >
                ✨ Generate More Redesigns
              </button>
              <button
                onClick={handleReset}
                className="bg-gray-200 text-gray-800 px-8 py-4 rounded-xl font-semibold hover:bg-gray-300"
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
