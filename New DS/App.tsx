import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsPanel } from './components/ResultsPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { RedesignDetailModal } from './components/RedesignDetailModal';
import { DesignAnalysisModal } from './components/DesignAnalysisModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { cleanupProductImage, analyzeProductDesign, generateProductRedesigns, extractDesignElements, remixProductImage, detectAndSplitCharacters, generateRandomMockup, hasValidKey, setManualKey } from './services/geminiService';
import { sendDataToSheet } from './services/googleSheetService';
import { ProductAnalysis, ProcessStage, PRODUCT_TYPES, HistoryItem, DesignMode, RopeType } from './types';
import { AlertCircle, RefreshCw, Wand2, Sparkles, Paintbrush, Zap, Package, Eraser, Key } from 'lucide-react';

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [extractedElements, setExtractedElements] = useState<string[] | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [generatedRedesigns, setRedesigns] = useState<string[] | null>(null);
  const [stage, setStage] = useState<ProcessStage>(ProcessStage.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [productType, setProductType] = useState<string>(PRODUCT_TYPES[0]); // Defaults to Auto-Detect
  const [designMode, setDesignMode] = useState<DesignMode>(DesignMode.NEW_CONCEPT);
  
  // API Key & Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Remix / Detail Modal State
  const [selectedRedesignIndex, setSelectedRedesignIndex] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);

  // Undo History State: Map index -> array of previous image strings
  const [redesignHistory, setRedesignHistory] = useState<Record<number, string[]>>({});
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    // 1. Load History
    try {
      const savedHistory = localStorage.getItem('product_perfect_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }

    // 2. Check for API Key
    const keyExists = hasValidKey();
    setHasKey(keyExists);
    if (!keyExists) {
        setIsApiKeyModalOpen(true);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
      setManualKey(key);
      setHasKey(true);
      setError(null);
  };

  const saveHistoryToStorage = (items: HistoryItem[]) => {
    try {
      localStorage.setItem('product_perfect_history', JSON.stringify(items));
    } catch (e) {
      console.warn("LocalStorage quota exceeded.");
      if (items.length > 1) {
        const reducedItems = items.slice(0, -1);
        saveHistoryToStorage(reducedItems);
        setHistory(reducedItems);
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
    setRedesignHistory({}); // Reset undo history for loaded item
  };

  const processFile = (file: File) => {
    if (!hasValidKey()) {
        setIsApiKeyModalOpen(true);
        return;
    }

    setStage(ProcessStage.UPLOADING);
    setError(null);
    setProcessedImage(null);
    setAnalysis(null);
    setRedesigns(null);
    setExtractedElements(null);
    setRedesignHistory({}); // Reset undo history

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setOriginalImage(base64);
      
      // Start processing based on current mode
      if (designMode === DesignMode.CLEAN_ONLY) {
          startQuickClean(base64);
      } else {
          startAnalysis(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuotaError = (err: any) => {
     console.error("Quota Error:", err);
     let errorMessage = err.message || "An unexpected error occurred.";
     
     if (errorMessage.includes("MISSING_API_KEY")) {
         setIsApiKeyModalOpen(true);
         errorMessage = "API Key missing. Please check your settings.";
     } else if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted")) {
        errorMessage = "Server busy (Rate Limit Hit). Please wait 10-15 seconds and try again.";
     }
     setError(errorMessage);
  };

  const startQuickClean = async (image: string) => {
    try {
        setStage(ProcessStage.CLEANING);
        const cleaned = await cleanupProductImage(image);
        setProcessedImage(cleaned);
        setStage(ProcessStage.COMPLETE);
    } catch (err: any) {
        console.error(err);
        handleQuotaError(err);
        setStage(ProcessStage.IDLE);
    }
  };

  const startAnalysis = async (image: string) => {
    try {
      setStage(ProcessStage.CLEANING); 
      
      // 1. Clean
      const cleaned = await cleanupProductImage(image);
      setProcessedImage(cleaned);
      
      // 2. Analyze
      setStage(ProcessStage.ANALYZING);
      const analysisResult = await analyzeProductDesign(image, productType, designMode);
      setAnalysis(analysisResult);

      // 3. Extract
      const extracted = await extractDesignElements(image);
      setExtractedElements(extracted);
      
      // 4. Review (Stop here and show Modal)
      if (analysisResult && analysisResult.redesignPrompt) {
         setStage(ProcessStage.REVIEW);
         setIsReviewModalOpen(true);
      } else {
         throw new Error("Analysis failed to generate a prompt.");
      }

    } catch (err: any) {
      console.error(err);
      handleQuotaError(err);
      if (stage !== ProcessStage.COMPLETE && stage !== ProcessStage.REVIEW) {
         setStage(ProcessStage.IDLE);
      }
    }
  };

  const handleGenerateConfirm = async (selectedComponents: string[], userNotes: string, ropeType: RopeType) => {
      setIsReviewModalOpen(false);
      setStage(ProcessStage.GENERATING);
      
      try {
         if (!analysis || !analysis.redesignPrompt) throw new Error("Missing analysis data");

         const redesigns = await generateProductRedesigns(
            analysis.redesignPrompt, 
            ropeType, 
            selectedComponents, 
            userNotes, 
            productType,
            false // useUltra deprecated
         );
         
         setRedesigns(redesigns);
         setStage(ProcessStage.COMPLETE);
         
         // 5. Send to Google Sheet (Hidden Background Process)
         sendDataToSheet(
            redesigns, 
            analysis.redesignPrompt, 
            analysis.description || "N/A"
         ).catch(e => console.error("Sheet logging failed silently", e));

         addToHistory(
            originalImage!, 
            processedImage, 
            analysis, 
            redesigns, 
            productType, 
            designMode,
            ropeType
         );

      } catch (err: any) {
          console.error(err);
          handleQuotaError(err);
          setStage(ProcessStage.REVIEW); // Go back to review on error
          setIsReviewModalOpen(true);
      }
  };

  const handleRedesignClick = (index: number) => {
    setSelectedRedesignIndex(index);
    setIsDetailModalOpen(true);
  };

  const pushToUndoHistory = (index: number, currentImage: string) => {
      setRedesignHistory(prev => ({
          ...prev,
          [index]: [...(prev[index] || []), currentImage]
      }));
  };

  const handleUndoRedesign = (index: number) => {
      if (!generatedRedesigns) return;
      const historyStack = redesignHistory[index];
      if (!historyStack || historyStack.length === 0) return;

      const previousImage = historyStack[historyStack.length - 1];
      const newHistory = historyStack.slice(0, -1);

      setRedesignHistory(prev => ({ ...prev, [index]: newHistory }));

      const newRedesigns = [...generatedRedesigns];
      newRedesigns[index] = previousImage;
      setRedesigns(newRedesigns);
  };

  const handleRemix = async (instruction: string) => {
    if (selectedRedesignIndex === null || !generatedRedesigns) return;
    
    setIsRemixing(true);
    try {
      const currentImage = generatedRedesigns[selectedRedesignIndex];
      
      // Save state before changing
      pushToUndoHistory(selectedRedesignIndex, currentImage);

      const newImage = await remixProductImage(currentImage, instruction);
      
      const newRedesigns = [...generatedRedesigns];
      newRedesigns[selectedRedesignIndex] = newImage;
      setRedesigns(newRedesigns);
      
    } catch (err: any) {
      console.error("Remix failed", err);
      handleQuotaError(err);
    } finally {
      setIsRemixing(false);
    }
  };

  // Helper to directly update image from Modal (e.g., Applying Mockup)
  const handleUpdateRedesign = (newImage: string) => {
      if (selectedRedesignIndex === null || !generatedRedesigns) return;
      
      const currentImage = generatedRedesigns[selectedRedesignIndex];
      pushToUndoHistory(selectedRedesignIndex, currentImage);
      
      const newRedesigns = [...generatedRedesigns];
      newRedesigns[selectedRedesignIndex] = newImage;
      setRedesigns(newRedesigns);
  };

  // New handler for Remove Background
  const handleRemoveBackground = async () => {
    if (selectedRedesignIndex === null || !generatedRedesigns) return;
    
    setIsRemixing(true);
    try {
       const currentImage = generatedRedesigns[selectedRedesignIndex];
       
       // Save state before changing
       pushToUndoHistory(selectedRedesignIndex, currentImage);

       // Reuse the cleanup service which removes bg
       const cleanedImage = await cleanupProductImage(currentImage);
       
       const newRedesigns = [...generatedRedesigns];
       newRedesigns[selectedRedesignIndex] = cleanedImage;
       setRedesigns(newRedesigns);
    } catch (err: any) {
       console.error("Background removal failed", err);
       handleQuotaError(err);
    } finally {
       setIsRemixing(false);
    }
  };

  const handleSplit = async () => {
      if (selectedRedesignIndex === null || !generatedRedesigns) return [];
      const currentImage = generatedRedesigns[selectedRedesignIndex];
      return await detectAndSplitCharacters(currentImage);
  };
  
  const handleGenerateMockup = async (image: string) => {
      return await generateRandomMockup(image);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-x-hidden text-slate-200">
      <Header onHistoryClick={() => setIsHistoryOpen(true)} />

      {/* Top Bar for Environment Info */}
      <div className="bg-slate-900 border-b border-slate-800 py-2 px-4 shadow-sm z-30 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-400">
             {hasKey ? (
                 <button 
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="flex items-center bg-green-950/30 hover:bg-green-900/50 text-green-300 px-3 py-1.5 rounded-full border border-green-800/50 transition-colors"
                 >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    <span className="font-bold">System Ready</span>
                 </button>
             ) : (
                 <button 
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="flex items-center bg-red-950/30 hover:bg-red-900/50 text-red-300 px-3 py-1.5 rounded-full border border-red-800/50 animate-pulse transition-colors"
                 >
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    <span className="font-bold">Missing API Key</span>
                 </button>
             )}
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full z-10">
        
        {stage === ProcessStage.IDLE && (
           <div className="mb-8 space-y-6">
              <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                     Reimagine Your Products
                  </h2>
                  <p className="text-slate-500">Upload an image to clean, analyze, and generate stunning redesigns instantly.</p>
              </div>

              {/* Controls Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
                 
                 {/* Design Mode Selector */}
                 <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                        <Wand2 className="w-3 h-3 mr-1 text-purple-400" />
                        Design Goal
                    </label>
                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <button 
                            onClick={() => setDesignMode(DesignMode.NEW_CONCEPT)}
                            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center ${designMode === DesignMode.NEW_CONCEPT ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            <Sparkles size={12} className="mr-1.5" />
                            New Concept
                        </button>
                        <button 
                            onClick={() => setDesignMode(DesignMode.ENHANCE_EXISTING)}
                            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center ${designMode === DesignMode.ENHANCE_EXISTING ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            <Paintbrush size={12} className="mr-1.5" />
                            Enhance Existing
                        </button>
                    </div>
                 </div>

                 {/* Product Type Selector */}
                 <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                        <Package className="w-3 h-3 mr-1 text-blue-400" />
                        Product Type
                    </label>
                    <select
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                        {PRODUCT_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                 </div>
              </div>
           </div>
        )}

        {/* Quick Actions (Before Upload) */}
        {stage === ProcessStage.IDLE && (
            <div className="flex justify-center mb-6">
                <button
                   onClick={() => setDesignMode(DesignMode.CLEAN_ONLY)}
                   className={`flex items-center px-4 py-2 rounded-full text-xs font-bold transition-all border ${designMode === DesignMode.CLEAN_ONLY ? 'bg-teal-900/30 text-teal-300 border-teal-500/50' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
                >
                   <Eraser size={14} className="mr-1.5" />
                   Quick Tool: Remove Background Only
                </button>
            </div>
        )}

        {stage === ProcessStage.IDLE ? (
          <div className="max-w-2xl mx-auto">
            <FileUpload onFileSelect={processFile} />
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 bg-red-950/30 border border-red-900/50 text-red-200 p-4 rounded-xl flex items-center shadow-lg animate-fade-in">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-red-500" />
                <span className="text-sm font-medium">{error}</span>
                <button 
                    onClick={() => setStage(ProcessStage.IDLE)} 
                    className="ml-auto text-xs bg-red-900/50 hover:bg-red-800 px-3 py-1.5 rounded-lg transition-colors border border-red-800"
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
                    }}
                    className="flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold shadow-lg transition-all border border-slate-700 hover:border-indigo-500"
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
        hasKey={hasKey}
        onSave={handleSaveApiKey}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {analysis && (
        <DesignAnalysisModal
          isOpen={isReviewModalOpen}
          onClose={() => {
              setIsReviewModalOpen(false);
              setStage(ProcessStage.IDLE); // Or handle cancel
          }}
          analysis={analysis}
          extractedElements={extractedElements}
          onGenerate={handleGenerateConfirm}
        />
      )}

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
          onUndo={() => handleUndoRedesign(selectedRedesignIndex!)}
          canUndo={(redesignHistory[selectedRedesignIndex!]?.length || 0) > 0}
        />
      )}
    </div>
  );
}

export default App;
