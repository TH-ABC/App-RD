import React, { useState } from 'react';
import { X, Download, RefreshCw, Palette, Layers, Sparkles, Wand2, MessageSquare, Link2, Cat, User, LayoutTemplate, Type, Eraser, Scissors, Image as ImageIcon, Check, ArrowLeft, MonitorPlay, RotateCcw } from 'lucide-react';
import { ROPE_OPTIONS } from '../types';

interface RedesignDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onRemix: (instruction: string) => Promise<void>;
  onRemoveBackground: () => Promise<void>;
  onSplit: () => Promise<string[]>;
  onGenerateMockup: (img: string) => Promise<string>;
  isRemixing: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}

const COLOR_PALETTE = [
  { name: 'Classic Red', hex: '#ef4444' },
  { name: 'Forest Green', hex: '#15803d' },
  { name: 'Royal Gold', hex: '#fbbf24' },
  { name: 'Ice Blue', hex: '#3b82f6' },
  { name: 'Midnight', hex: '#1e293b' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Lavender', hex: '#a855f7' },
  { name: 'Rose Gold', hex: '#f43f5e' },
];

export const RedesignDetailModal: React.FC<RedesignDetailModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  onRemix,
  onRemoveBackground,
  onSplit,
  onGenerateMockup,
  isRemixing,
  onUndo,
  canUndo
}) => {
  const [activeTab, setActiveTab] = useState<'colors' | 'details' | 'ropes' | 'split'>('colors');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Split State
  const [splitImages, setSplitImages] = useState<string[]>([]);
  const [isSplitting, setIsSplitting] = useState(false);

  // Mockup Preview State (in Split Tab)
  const [mockupPreview, setMockupPreview] = useState<{img: string, index: number} | null>(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);

  if (!isOpen) return null;

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCustomSubmit = () => {
      if (customPrompt.trim()) {
          onRemix(customPrompt);
      }
  };

  const handleSplitClick = async () => {
    setIsSplitting(true);
    setSplitImages([]);
    setMockupPreview(null);
    try {
        const images = await onSplit();
        setSplitImages(images);
    } catch (error) {
        console.error("Split failed", error);
    } finally {
        setIsSplitting(false);
    }
  };

  const handleCreateMockup = async (img: string, index: number) => {
     setIsGeneratingMockup(true);
     try {
         const mockup = await onGenerateMockup(img);
         setMockupPreview({ img: mockup, index });
     } catch (error) {
         console.error("Mockup failed", error);
         alert("Failed to generate mockup.");
     } finally {
         setIsGeneratingMockup(false);
     }
  };

  const handleReturnFromMockup = () => {
      setMockupPreview(null);
  };

  const handleApplyMockup = () => {
      // User wants to keep the mockup. 
      // In a full flow, we might replace the main image, but for now we just let them download it
      // or we could potentially add it to a list. 
      // Given the requirement "giữ lại", downloading is the safest immediate action or just keeping it viewable.
      if (mockupPreview) {
          handleDownload(mockupPreview.img, `mockup-character-${mockupPreview.index + 1}.jpg`);
      }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-fade-in border border-slate-800">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900">
            <h3 className="text-lg font-bold text-slate-200 flex items-center">
              <Wand2 className="w-5 h-5 mr-2 text-indigo-500" />
              Design Detail & Remix
            </h3>
            <div className="flex items-center space-x-2">
              {onUndo && (
                  <button
                    onClick={onUndo}
                    disabled={!canUndo || isRemixing}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Undo last change"
                  >
                      <RotateCcw size={16} className="mr-2" />
                      Return
                  </button>
              )}
              <button 
                onClick={onRemoveBackground}
                disabled={isRemixing}
                className="px-4 py-2 bg-indigo-950/30 border border-indigo-900/50 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-900/50 flex items-center transition-colors disabled:opacity-50"
                title="Isolate product on white background"
              >
                <Eraser size={16} className="mr-2" />
                Remove BG
              </button>
              <button 
                onClick={() => handleDownload(imageUrl, `design-variation-${Date.now()}.jpg`)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 flex items-center"
              >
                <Download size={16} className="mr-2" />
                Download
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row h-full overflow-hidden">
            
            {/* Left: Main Image */}
            <div className="w-full lg:w-2/3 bg-slate-950/50 relative flex items-center justify-center p-8 overflow-hidden">
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={mockupPreview ? mockupPreview.img : imageUrl} 
                  alt="Detail View" 
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                />
                {(isRemixing || isGeneratingMockup) && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
                    <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <span className="font-bold text-indigo-300 bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-700">
                      {isGeneratingMockup ? 'Generating Mockup...' : 'Processing Remix...'}
                    </span>
                  </div>
                )}
                
                {/* Mockup Preview Actions Overlay */}
                {mockupPreview && !isGeneratingMockup && (
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-4">
                        <button 
                            onClick={handleReturnFromMockup}
                            className="bg-slate-800 text-slate-200 px-6 py-2 rounded-full shadow-lg font-bold flex items-center hover:bg-slate-700 border border-slate-600"
                        >
                            <ArrowLeft size={16} className="mr-2" /> Return
                        </button>
                        <button 
                            onClick={handleApplyMockup}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center hover:bg-indigo-700 border border-indigo-500"
                        >
                            <Download size={16} className="mr-2" /> Save Mockup
                        </button>
                    </div>
                )}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="w-full lg:w-1/3 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
              
              {/* Custom Prompt Area (Hidden in Split View for clarity) */}
              {activeTab !== 'split' && (
                <div className="p-6 pb-4 border-b border-slate-800">
                    <div className="flex items-center mb-2">
                        <MessageSquare size={16} className="text-indigo-500 mr-2" />
                        <h4 className="text-sm font-bold text-slate-300">Custom Instructions (Tùy chỉnh)</h4>
                    </div>
                    <div className="relative">
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Nhập yêu cầu chỉnh sửa... (VD: đổi màu chữ viết thành màu đen, thêm tuyết rơi)"
                            className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none placeholder:text-slate-600"
                            rows={3}
                            disabled={isRemixing}
                        />
                        <button 
                            onClick={handleCustomSubmit}
                            disabled={!customPrompt.trim() || isRemixing}
                            className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Send Request"
                        >
                            <Sparkles size={14} />
                        </button>
                    </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-slate-800">
                <button 
                  onClick={() => { setActiveTab('colors'); setMockupPreview(null); }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center ${activeTab === 'colors' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  <Palette size={14} className="mr-1.5" />
                  Colors
                </button>
                 <button 
                  onClick={() => { setActiveTab('ropes'); setMockupPreview(null); }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center ${activeTab === 'ropes' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  <Link2 size={14} className="mr-1.5" />
                  Ropes
                </button>
                <button 
                  onClick={() => { setActiveTab('details'); setMockupPreview(null); }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center ${activeTab === 'details' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  <Layers size={14} className="mr-1.5" />
                  Parts
                </button>
                <button 
                  onClick={() => setActiveTab('split')}
                  className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center ${activeTab === 'split' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-950/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                >
                  <Scissors size={14} className="mr-1.5" />
                  Split
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-700">
                
                {activeTab === 'colors' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 mb-4">Change Dominant Color</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {COLOR_PALETTE.map((color) => (
                          <button
                            key={color.hex}
                            onClick={() => onRemix(`Change the main color theme of this product to ${color.name} (${color.hex}). Keep the design style exactly the same.`)}
                            disabled={isRemixing}
                            className="flex items-center p-2 rounded-lg border border-slate-700 bg-slate-800 hover:border-indigo-500 hover:bg-slate-700 transition-all group text-left"
                          >
                            <div 
                              className="w-8 h-8 rounded-full shadow-sm mr-3 border border-slate-600" 
                              style={{ backgroundColor: color.hex }} 
                            />
                            <span className="text-sm font-medium text-slate-400 group-hover:text-white">
                              {color.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ropes' && (
                   <div className="space-y-6 animate-fade-in">
                     <div>
                       <h4 className="text-sm font-bold text-slate-300 mb-4">Add Hanging Rope</h4>
                       <div className="space-y-3">
                          {ROPE_OPTIONS.map((rope) => (
                            <button
                                key={rope.id}
                                onClick={() => onRemix(`Add a hanging loop to the top of the ornament made of ${rope.name}. Make it look realistic.`)}
                                disabled={isRemixing}
                                className="w-full flex items-center p-3 rounded-lg border border-slate-700 bg-slate-800 hover:border-indigo-500 hover:bg-slate-700 transition-all group text-left"
                            >
                                <div 
                                    className="w-10 h-10 rounded-full border border-slate-600 flex-shrink-0 mr-3 shadow-sm"
                                    style={{ background: rope.color }}
                                />
                                <div>
                                    <span className="block text-sm font-medium text-slate-300 group-hover:text-indigo-300">
                                        {rope.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        Apply {rope.texture} texture
                                    </span>
                                </div>
                            </button>
                          ))}
                       </div>
                     </div>
                   </div>
                )}

                {activeTab === 'details' && (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Text Color Section - New Request */}
                    <div>
                       <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center">
                          <Type size={16} className="mr-2 text-slate-500" />
                          Text Styling
                       </h4>
                       <div className="grid grid-cols-2 gap-3">
                           <button
                            onClick={() => onRemix("Change the color of the TEXT to BLACK. Preserve the font style and spelling exactly as is.")}
                            disabled={isRemixing}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:border-indigo-500 transition-all flex items-center justify-center gap-2"
                           >
                              <div className="w-4 h-4 rounded-full bg-black border border-slate-600"></div>
                              <span className="text-sm text-slate-300">To Black</span>
                           </button>
                           <button
                            onClick={() => onRemix("Change the color of the TEXT to WHITE. Preserve the font style and spelling exactly as is.")}
                            disabled={isRemixing}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:border-indigo-500 transition-all flex items-center justify-center gap-2"
                           >
                              <div className="w-4 h-4 rounded-full bg-white border border-slate-600"></div>
                              <span className="text-sm text-slate-300">To White</span>
                           </button>
                       </div>
                    </div>

                    <div className="h-px bg-slate-800 w-full" />

                    {/* Character Section */}
                    <div>
                       <h4 className="text-sm font-bold text-slate-300 mb-3">Remix Character</h4>
                       <div className="grid grid-cols-1 gap-3">
                          <button
                            onClick={() => onRemix("Analyze the current theme/season of this product. Replace the central character with a cute, high-quality 3D render of an ANIMAL that fits this theme (e.g., Reindeer, Penguin, Bear, Cat). Keep the background and text layout.")}
                            disabled={isRemixing}
                            className="p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-purple-500 hover:bg-slate-750 transition-all flex items-center text-left group"
                          >
                             <div className="p-2 bg-purple-900/30 text-purple-400 rounded-lg mr-3 border border-purple-800">
                                <Cat size={18} />
                             </div>
                             <div>
                               <h5 className="font-bold text-slate-300 text-sm group-hover:text-purple-300">Cute Animal</h5>
                               <p className="text-xs text-slate-500">Theme-appropriate animal (Reindeer, etc.)</p>
                             </div>
                          </button>

                          <button
                            onClick={() => onRemix("Analyze the current theme/season of this product. Replace the central character with a friendly HUMAN figure (e.g., Santa, Snowman with human traits, or a Family member). Keep the background and text layout.")}
                            disabled={isRemixing}
                            className="p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-slate-750 transition-all flex items-center text-left group"
                          >
                             <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg mr-3 border border-indigo-800">
                                <User size={18} />
                             </div>
                             <div>
                               <h5 className="font-bold text-slate-300 text-sm group-hover:text-indigo-300">Human Figure</h5>
                               <p className="text-xs text-slate-500">Santa, Family, or Person</p>
                             </div>
                          </button>
                       </div>
                    </div>

                    {/* Pattern Section */}
                    <div>
                       <h4 className="text-sm font-bold text-slate-300 mb-3">Remix Background</h4>
                       <button
                            onClick={() => onRemix("Analyze the SEASON of the original product (e.g., Christmas, Halloween, Easter). Replace the background texture with a trending Print-on-Demand (POD) pattern that perfectly matches this season (e.g., Buffalo Plaid, Snowflakes, Pumpkin patch). Keep the main character and text.")}
                            disabled={isRemixing}
                            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-amber-500 hover:bg-slate-750 transition-all flex items-center text-left group"
                          >
                             <div className="p-2 bg-amber-900/30 text-amber-500 rounded-lg mr-3 border border-amber-800">
                                <LayoutTemplate size={18} />
                             </div>
                             <div>
                               <h5 className="font-bold text-slate-300 text-sm group-hover:text-amber-300">Seasonal POD Pattern</h5>
                               <p className="text-xs text-slate-500">Auto-detects season & applies trending pattern</p>
                             </div>
                          </button>
                    </div>

                    {/* Lighting Section */}
                    <div>
                       <h4 className="text-sm font-bold text-slate-300 mb-3">Ambience</h4>
                       <button
                            onClick={() => onRemix("Change the lighting to be dramatic, warm, and cinematic golden hour lighting. Make it look like a premium product photography shot.")}
                            disabled={isRemixing}
                            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-750 transition-all flex items-center text-left group"
                          >
                            <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg mr-3 border border-blue-800">
                               <Wand2 size={18} />
                            </div>
                            <div>
                                 <h5 className="font-bold text-slate-300 text-sm group-hover:text-blue-300">Cinematic Lighting</h5>
                                 <p className="text-xs text-slate-500">Warm, golden hour atmosphere</p>
                            </div>
                          </button>
                    </div>

                  </div>
                )}
                
                {activeTab === 'split' && (
                  <div className="space-y-6 animate-fade-in">
                      {/* Main Split Controls */}
                      {!mockupPreview && (
                         <>
                             <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-xl p-4">
                                <h4 className="font-bold text-indigo-400 mb-2 flex items-center">
                                    <Scissors size={18} className="mr-2" />
                                    Character Separation
                                </h4>
                                <p className="text-sm text-indigo-300 mb-4">
                                    Auto-detect and isolate individual characters/figures from the image onto white backgrounds.
                                </p>
                                
                                <button
                                    onClick={handleSplitClick}
                                    disabled={isSplitting}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center disabled:opacity-50"
                                >
                                    {isSplitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Detecting & Splitting...
                                        </>
                                    ) : (
                                        <>
                                            <Scissors className="w-4 h-4 mr-2" />
                                            Auto Detect & Split
                                        </>
                                    )}
                                </button>
                            </div>

                            {splitImages.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-300">Result ({splitImages.length})</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {splitImages.map((img, idx) => (
                                            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-2 relative group">
                                                <div className="aspect-square bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%,#1e293b)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] bg-slate-900 overflow-hidden rounded mb-2">
                                                    <img src={img} alt={`Split ${idx}`} className="w-full h-full object-contain" />
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <button
                                                        onClick={() => handleCreateMockup(img, idx)}
                                                        className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 text-xs font-bold rounded shadow-sm hover:shadow flex items-center justify-center transition-all"
                                                        disabled={isGeneratingMockup}
                                                    >
                                                        <MonitorPlay size={12} className="mr-1" /> Generate Mockup
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(img, `character-${idx + 1}.png`)}
                                                        className="w-full py-1.5 bg-slate-700 border border-slate-600 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded flex items-center justify-center"
                                                    >
                                                        <Download size={12} className="mr-1" /> Save PNG
                                                    </button>
                                                </div>
                                                <div className="absolute top-3 left-3 bg-black/60 text-white text-[10px] px-1.5 rounded border border-white/10">#{idx+1}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {splitImages.length === 0 && !isSplitting && (
                                <div className="text-center py-8 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No separated characters yet.</p>
                                </div>
                            )}
                         </>
                      )}

                      {/* Mockup Preview Mode */}
                      {mockupPreview && (
                         <div className="text-center py-10 text-slate-500">
                             <div className="w-16 h-16 bg-indigo-950/30 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-900/50">
                                <Sparkles size={32} />
                             </div>
                             <p className="font-bold text-slate-300">Mockup Generated!</p>
                             <p className="text-xs mt-2 text-slate-500">Previewing in the main window.</p>
                             <div className="mt-4 p-4 bg-yellow-950/30 text-yellow-200 text-xs rounded-lg text-left border border-yellow-900/50">
                                <p className="font-bold mb-1">Tip:</p>
                                Use the controls below the image to <strong>Save</strong> or <strong>Return</strong>.
                             </div>
                         </div>
                      )}
                  </div>
                )}

              </div>
              
              <div className="p-6 bg-slate-900 border-t border-slate-800">
                <p className="text-xs text-slate-600 text-center">
                  AI generation may take a few seconds. Results will replace the current view.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};