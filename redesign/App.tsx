import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsPanel } from './components/ResultsPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { RedesignDetailModal } from './components/RedesignDetailModal';

import {
  setKeyPools,
  cleanupProductImage,
  analyzeProductDesign,
  generateProductRedesigns,
  extractDesignElements,
  remixProductImage,
  detectAndSplitCharacters,
  generateRandomMockup
} from './services/geminiService';

import { sendDataToSheet } from './services/googleSheetService';
import {
  ProductAnalysis,
  ProcessStage,
  PRODUCT_TYPES,
  HistoryItem,
  DesignMode,
  RopeType
} from './types';

import {
  AlertCircle,
  RefreshCw,
  Key,
  Layers,
  Eraser,
  Sparkles,
  Zap,
  Package,
  Wand2,
  Paintbrush,
  AlertTriangle
} from 'lucide-react';

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [extractedElements, setExtractedElements] = useState<string[] | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [generatedRedesigns, setRedesigns] = useState<string[] | null>(null);
  const [stage, setStage] = useState<ProcessStage>(ProcessStage.IDLE);
  const [error, setError] = useState<string | null>(null);

  const [productType, setProductType] = useState<string>(PRODUCT_TYPES[0]);
  const [designMode, setDesignMode] = useState<DesignMode>(DesignMode.NEW_CONCEPT);

  const [selectedRedesignIndex, setSelectedRedesignIndex] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [redesignHistory, setRedesignHistory] = useState<Record<number, string[]>>({});

  const [freeKeysCount, setFreeKeysCount] = useState(0);
  const [paidKeysCount, setPaidKeysCount] = useState(0);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const envApiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const hasEnvKey = envApiKey && envApiKey.length > 10;
  const [useUltra] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  /* ----------------------------------------------------------
     LOAD LOCAL KEY POOL & INITIALIZE SERVICE
  ----------------------------------------------------------- */
  useEffect(() => {
    try {
      const storedFree = localStorage.getItem('gemini_pool_free');
      const storedPaid = localStorage.getItem('gemini_pool_paid');

      const free = storedFree ? JSON.parse(storedFree) : [];
      const paid = storedPaid ? JSON.parse(storedPaid) : [];

      // CRITICAL: Initialize the service's key pool
      setKeyPools(free, paid);

      setFreeKeysCount(free.length);
      setPaidKeysCount(paid.length);
    } catch (e) {
      console.error("Failed to load API keys", e);
    }
  }, []);

  /* ----------------------------------------------------------
     LOAD HISTORY
  ----------------------------------------------------------- */
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('product_perfect_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  /* ----------------------------------------------------------
     SAVE API KEYS
  ----------------------------------------------------------- */
  const handleSaveKeys = (free: string[], paid: string[]) => {
    try {
      localStorage.setItem('gemini_pool_free', JSON.stringify(free));
      localStorage.setItem('gemini_pool_paid', JSON.stringify(paid));

      // CRITICAL: Update the service's key pool
      setKeyPools(free, paid);

      setFreeKeysCount(free.length);
      setPaidKeysCount(paid.length);

      setIsApiKeyModalOpen(false);
      setError(null);
    } catch (e) {
      console.error("Failed to save API keys", e);
      setError("Failed to save API keys");
    }
  };

  /* ----------------------------------------------------------
     HISTORY HELPERS
  ----------------------------------------------------------- */
  const saveHistoryToStorage = (items: HistoryItem[]) => {
    try {
      localStorage.setItem('product_perfect_history', JSON.stringify(items));
    } catch {
      if (items.length > 1) {
        const reduced = items.slice(0, -1);
        saveHistoryToStorage(reduced);
        setHistory(reduced);
      }
    }
  };

  const addToHistory = (
    orig: string,
    proc: string | null,
    anal: ProductAnalysis | null,
    redesigns: string[] | null,
    pType: string,
    dMode: DesignMode,
    rType: RopeType
  ) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      originalImage: orig,
      processedImage: proc,
      analysis: anal,
      generatedRedesigns: redesigns,
      productType: pType,
      designMode: dMode,
      ropeType: rType
    };

    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    saveHistoryToStorage(newHistory);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    saveHistoryToStorage(newHistory);
  };

  const handleLoadHistory = (item: HistoryItem) => {
    setOriginalImage(item.originalImage);
    setProcessedImage(item.processedImage);
    setAnalysis(item.analysis);
    setRedesigns(item.generatedRedesigns);
    setProductType(item.productType);
    setDesignMode(item.designMode || DesignMode.NEW_CONCEPT);
    setStage(ProcessStage.COMPLETE);
    setError(null);
    setIsHistoryOpen(false);
    setExtractedElements(null);
    setRedesignHistory({});
  };

  const hasKeys = freeKeysCount > 0 || paidKeysCount > 0;

  /* ----------------------------------------------------------
     ERROR HANDLING
  ----------------------------------------------------------- */
  const handleQuotaError = (err: any) => {
    const msg = err.message || err.toString();
    
    if (msg.includes("No API Keys configured")) {
      setError("Chưa cấu hình API Key. Vui lòng thêm API key.");
      setIsApiKeyModalOpen(true);
      return;
    }
    
    if (msg.includes("429") || msg.includes("quota") || msg.includes("exceeded")) {
      if (!hasKeys && !hasEnvKey) {
        setError("Dung lượng miễn phí hết. Vui lòng thêm API key.");
        setIsApiKeyModalOpen(true);
      } else {
        setError("API quota exceeded. Vui lòng thử lại sau hoặc thêm key mới.");
      }
      return;
    }
    
    setError(msg);
  };

  /* ----------------------------------------------------------
     FILE SELECT → PROCESSING
  ----------------------------------------------------------- */
  const processFile = (file: File) => {
    if (!hasKeys && !hasEnvKey) {
      setError("Không tìm thấy API Key. Vui lòng nhập API Key.");
      setIsApiKeyModalOpen(true);
      return;
    }

    setStage(ProcessStage.UPLOADING);
    setError(null);
    setProcessedImage(null);
    setAnalysis(null);
    setRedesigns(null);
    setExtractedElements(null);
    setRedesignHistory({});

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);

      if (designMode === DesignMode.CLEAN_ONLY) {
        startQuickClean(base64);
      } else {
        startAnalysis(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  /* ----------------------------------------------------------
     QUICK CLEAN
  ----------------------------------------------------------- */
  const startQuickClean = async (image: string) => {
    try {
      setStage(ProcessStage.CLEANING);
      const cleaned = await cleanupProductImage(image);
      setProcessedImage(cleaned);
      setStage(ProcessStage.COMPLETE);
    } catch (err) {
      console.error("Clean error:", err);
      handleQuotaError(err);
      setStage(ProcessStage.IDLE);
    }
  };

  /* ----------------------------------------------------------
     FULL PIPELINE
  ----------------------------------------------------------- */
  const startAnalysis = async (image: string) => {
    try {
      setStage(ProcessStage.CLEANING);
      const cleaned = await cleanupProductImage(image);
      setProcessedImage(cleaned);

      setStage(ProcessStage.ANALYZING);
      const analysisResult = await analyzeProductDesign(image, productType, designMode);
      setAnalysis(analysisResult);

      const extracted = await extractDesignElements(image);
      setExtractedElements(extracted);

      if (analysisResult?.redesignPrompt) {
        setStage(ProcessStage.GENERATING);

        const redesigns = await generateProductRedesigns(
          analysisResult.redesignPrompt,
          RopeType.NONE,
          [],
          "",
          productType,
          useUltra
        );

        setRedesigns(redesigns);
        setStage(ProcessStage.COMPLETE);

        // Optional: Send to Google Sheets
        sendDataToSheet(
          redesigns,
          analysisResult.redesignPrompt,
          analysisResult.description || "N/A"
        ).catch((err) => {
          console.warn("Failed to send to Google Sheets:", err);
        });

        addToHistory(
          image,
          cleaned,
          analysisResult,
          redesigns,
          productType,
          designMode,
          RopeType.NONE
        );
      } else {
        setStage(ProcessStage.COMPLETE);
      }

    } catch (err) {
      console.error("Analysis error:", err);
      handleQuotaError(err);
      if (stage !== ProcessStage.COMPLETE) {
        setStage(ProcessStage.IDLE);
      }
    }
  };

  /* ----------------------------------------------------------
     REDESIGN MODAL HANDLERS
  ----------------------------------------------------------- */
  const handleRedesignClick = (index: number) => {
    setSelectedRedesignIndex(index);
    setIsDetailModalOpen(true);
  };

  const pushUndo = (index: number, current: string) => {
    setRedesignHistory(prev => ({
      ...prev,
      [index]: [...(prev[index] || []), current]
    }));
  };

  const handleUndoRedesign = (index: number) => {
    if (!generatedRedesigns) return;
    const stack = redesignHistory[index];
    if (!stack?.length) return;

    const previous = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);

    setRedesignHistory(prev => ({ ...prev, [index]: newStack }));

    const newList = [...generatedRedesigns];
    newList[index] = previous;
    setRedesigns(newList);
  };

  const handleRemix = async (instruction: string) => {
    if (selectedRedesignIndex == null || !generatedRedesigns) return;

    setIsRemixing(true);
    try {
      const current = generatedRedesigns[selectedRedesignIndex];
      pushUndo(selectedRedesignIndex, current);

      const newImage = await remixProductImage(current, instruction);

      const updated = [...generatedRedesigns];
      updated[selectedRedesignIndex] = newImage;
      setRedesigns(updated);

    } catch (err) {
      console.error("Remix error:", err);
      handleQuotaError(err);
    } finally {
      setIsRemixing(false);
    }
  };

  const handleUpdateRedesign = (newImg: string) => {
    if (selectedRedesignIndex == null || !generatedRedesigns) return;

    const current = generatedRedesigns[selectedRedesignIndex];
    pushUndo(selectedRedesignIndex, current);

    const updated = [...generatedRedesigns];
    updated[selectedRedesignIndex] = newImg;
    setRedesigns(updated);
  };

  const handleRemoveBackground = async () => {
    if (selectedRedesignIndex == null || !generatedRedesigns) return;

    setIsRemixing(true);
    try {
      const current = generatedRedesigns[selectedRedesignIndex];
      pushUndo(selectedRedesignIndex, current);

      const cleanedImage = await cleanupProductImage(current);

      const updated = [...generatedRedesigns];
      updated[selectedRedesignIndex] = cleanedImage;
      setRedesigns(updated);
    } catch (err) {
      console.error("Remove bg error:", err);
      handleQuotaError(err);
    } finally {
      setIsRemixing(false);
    }
  };

  const handleSplit = async () => {
    if (selectedRedesignIndex == null || !generatedRedesigns) return [];
    try {
      return await detectAndSplitCharacters(generatedRedesigns[selectedRedesignIndex]);
    } catch (err) {
      console.error("Split error:", err);
      return [];
    }
  };

  const handleGenerateMockup = async (image: string) => {
    try {
      return await generateRandomMockup(image);
    } catch (err) {
      console.error("Mockup error:", err);
      throw err;
    }
  };

  /* ----------------------------------------------------------
     UI RENDER
  ----------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-x-hidden text-slate-200">
      <Header onHistoryClick={() => setIsHistoryOpen(true)} />

      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 py-2 px-4 shadow-sm z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">

          {/* Connection Indicator */}
          <div className="flex items-center text-xs text-slate-400">
            {(freeKeysCount > 0 || paidKeysCount > 0) ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-indigo-900/30 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-800">
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  <span className="mr-1 font-medium">Pool:</span>
                  <span>{freeKeysCount} Free, {paidKeysCount} Paid</span>
                </div>
              </div>
            ) : (
              <div className={`flex items-center px-3 py-1.5 rounded-full border ${hasEnvKey ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-red-950/30 text-red-400 border-red-900/50'}`}>
                {hasEnvKey ? (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                    <span>Using Default Free Quota</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    <span>No Default Key</span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center border border-slate-700"
          >
            <Key size={14} className="mr-1.5" /> Manage Keys
          </button>
        </div>
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* INITIAL UI */}
        {stage === ProcessStage.IDLE && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Reimagine Your Products
              </h2>
              <p className="text-slate-500">Upload an image to begin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">

              {/* Design Mode */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                  <Wand2 className="w-3 h-3 mr-1 text-purple-400" /> Design Goal
                </label>
                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button
                    onClick={() => setDesignMode(DesignMode.NEW_CONCEPT)}
                    className={`flex-1 py-2 text-xs rounded-md flex items-center justify-center ${designMode === DesignMode.NEW_CONCEPT ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Sparkles size={12} className="mr-1" /> New Concept
                  </button>

                  <button
                    onClick={() => setDesignMode(DesignMode.ENHANCE_EXISTING)}
                    className={`flex-1 py-2 text-xs rounded-md flex items-center justify-center ${designMode === DesignMode.ENHANCE_EXISTING ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Paintbrush size={12} className="mr-1" /> Enhance Existing
                  </button>
                </div>
              </div>

              {/* Product Type */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                  <Package className="w-3 h-3 mr-1 text-blue-400" /> Product Type
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5"
                >
                  {PRODUCT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Quick Clean */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setDesignMode(DesignMode.CLEAN_ONLY)}
                className={`px-4 py-2 rounded-full text-xs border flex items-center ${designMode === DesignMode.CLEAN_ONLY ? 'bg-teal-900/30 text-teal-300 border-teal-500/50' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
              >
                <Eraser size={14} className="mr-1" />
                Remove Background Only
              </button>
            </div>

            <div className="max-w-2xl mx-auto mt-6">
              <FileUpload onFileSelect={processFile} />
            </div>

          </>
        )}

        {/* PROCESSING */}
        {stage !== ProcessStage.IDLE && (
          <>
            {error && (
              <div className="mb-6 bg-red-950/30 border border-red-900/50 text-red-200 p-4 rounded-xl flex items-center">
                <AlertCircle className="w-5 h-5 mr-3" />
                <span>{error}</span>
                <button
                  onClick={() => {
                    setStage(ProcessStage.IDLE);
                    setError(null);
                  }}
                  className="ml-auto text-xs bg-red-900/50 px-3 py-1.5 rounded border border-red-800 hover:bg-red-900/70"
                >
                  Try Again
                </button>
              </div>
            )}

            <ResultsPanel
              originalImage={originalImage || ''}
              processedImage={processedImage}
              analysis={analysis}
              generatedRedesigns={generatedRedesigns}
              stage={stage}
              onImageClick={handleRedesignClick}
            />

            {stage === ProcessStage.COMPLETE && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    setStage(ProcessStage.IDLE);
                    setOriginalImage(null);
                    setProcessedImage(null);
                    setRedesigns(null);
                    setError(null);
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full border border-slate-700 flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start New Design
                </button>
              </div>
            )}
          </>
        )}

      </main>

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleLoadHistory}
        onDelete={handleDeleteHistory}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveKeys}
      />

      {generatedRedesigns && selectedRedesignIndex !== null && (
        <RedesignDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          imageUrl={generatedRedesigns[selectedRedesignIndex]}
          onRemix={handleRemix}
          onRemoveBackground={handleRemoveBackground}
          onSplit={handleSplit}
          onGenerateMockup={handleGenerateMockup}
          onUpdateImage={handleUpdateRedesign}
          isRemixing={isRemixing}
          onUndo={() => handleUndoRedesign(selectedRedesignIndex)}
          canUndo={(redesignHistory[selectedRedesignIndex]?.length || 0) > 0}
        />
      )}
    </div>
  );
}

export default App;
