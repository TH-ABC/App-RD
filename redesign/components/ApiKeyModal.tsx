
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Layers, CreditCard, Zap, Trash2, FileJson, User } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (freeKeys: string[], paidKeys: string[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [freeKeysInput, setFreeKeysInput] = useState('');
  const [paidKeysInput, setPaidKeysInput] = useState('');
  const [tokenJsonInput, setTokenJsonInput] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [detectedUser, setDetectedUser] = useState<{name: string, email: string, image: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setStatusMessage('');
      
      const storedFree = localStorage.getItem('gemini_pool_free');
      const storedPaid = localStorage.getItem('gemini_pool_paid');
      const storedToken = localStorage.getItem('gemini_raw_token_json');
      
      if (storedFree) setFreeKeysInput(JSON.parse(storedFree).join('\n'));
      // Filter out the token from the paid list for display purposes if we have the raw json
      if (storedPaid) {
          const paidList = JSON.parse(storedPaid);
          const cleanPaidList = paidList.filter((k: string) => !k.startsWith('ya29'));
          setPaidKeysInput(cleanPaidList.join('\n'));
      }
      if (storedToken) {
          setTokenJsonInput(storedToken);
          try {
              const parsed = JSON.parse(storedToken);
              if (parsed.user) setDetectedUser(parsed.user);
          } catch(e) {}
      }
    }
  }, [isOpen]);

  // Auto-detect user info when pasting JSON
  useEffect(() => {
      try {
          if (!tokenJsonInput.trim()) {
              setDetectedUser(null);
              return;
          }
          const parsed = JSON.parse(tokenJsonInput);
          if (parsed.user) {
              setDetectedUser(parsed.user);
          }
      } catch (e) {
          // invalid json, ignore
      }
  }, [tokenJsonInput]);

  if (!isOpen) return null;

  const extractKeys = (input: string): string[] => {
    return input
      .split(/[\n,]+/) // Split by newline or comma
      .map(k => k.trim())
      .filter(k => k.length > 10 && !k.startsWith('ya29')); // Exclude tokens from manual entry if possible
  };

  const handleSave = async () => {
    const freeKeys = extractKeys(freeKeysInput);
    const manualPaidKeys = extractKeys(paidKeysInput);
    
    let tokenKey = "";
    // Parse Token JSON
    if (tokenJsonInput.trim()) {
        try {
            const parsed = JSON.parse(tokenJsonInput);
            if (parsed.access_token) {
                tokenKey = parsed.access_token;
            } else if (parsed.token) {
                 tokenKey = parsed.token;
            } else {
                 // Maybe they pasted just the token string?
                 if (tokenJsonInput.startsWith('ya29')) {
                     tokenKey = tokenJsonInput.trim();
                 }
            }
        } catch (e) {
            // Not JSON, check if it's a raw token string
            if (tokenJsonInput.startsWith('ya29')) {
                tokenKey = tokenJsonInput.trim();
            }
        }
    }

    // Combine manual paid keys + token
    const finalPaidKeys = [...manualPaidKeys];
    if (tokenKey) {
        finalPaidKeys.push(tokenKey);
        // Save raw JSON for persistence
        localStorage.setItem('gemini_raw_token_json', tokenJsonInput);
    } else {
        localStorage.removeItem('gemini_raw_token_json');
    }

    if (freeKeys.length === 0 && finalPaidKeys.length === 0) {
      setStatus('error');
      setStatusMessage('Vui lòng nhập ít nhất 1 API Key hoặc Token.');
      return;
    }

    setStatus('validating');
    setStatusMessage(`Đang kiểm tra kết nối...`);

    // Validation Priority: Token -> Paid -> Free
    const keyToTest = tokenKey || manualPaidKeys[0] || freeKeys[0];

    try {
      await validateToken(keyToTest);
      
      setStatus('success');
      setStatusMessage(`Đã kết nối: ${freeKeys.length} Free, ${manualPaidKeys.length} Paid, ${tokenKey ? '1 Ultra Token' : '0 Token'}.`);
      
      setTimeout(() => {
        onSave(freeKeys, finalPaidKeys);
      }, 1000);

    } catch (error: any) {
      console.error("Validation failed", error);
      const confirm = window.confirm("Kiểm tra kết nối thất bại (Key/Token có thể bị lỗi). Bạn có chắc chắn muốn lưu không?");
      if (confirm) {
         onSave(freeKeys, finalPaidKeys);
      } else {
         setStatus('error');
         setStatusMessage('Lỗi: ' + (error.message || 'Kết nối thất bại'));
      }
    }
  };

  const clearAll = () => {
    setFreeKeysInput('');
    setPaidKeysInput('');
    setTokenJsonInput('');
    setDetectedUser(null);
    setStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-slate-900 shadow-2xl transition-all w-full max-w-4xl animate-fade-in border border-slate-800">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900">
            <h3 className="text-lg font-bold text-slate-200 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-500" />
              Quản lý API Key Pool
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1: Free Keys */}
                <div className="space-y-2">
                   <label className="flex items-center justify-between text-sm font-bold text-slate-300">
                      <div className="flex items-center">
                        <Zap size={14} className="mr-1 text-amber-500" />
                        Free Keys (Pool 1)
                      </div>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {extractKeys(freeKeysInput).length}
                      </span>
                   </label>
                   <textarea 
                      value={freeKeysInput}
                      onChange={(e) => setFreeKeysInput(e.target.value)}
                      placeholder="AIza... (Mỗi dòng 1 key)"
                      className="w-full h-64 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                   />
                </div>

                {/* Column 2: Paid API Keys */}
                 <div className="space-y-2">
                   <label className="flex items-center justify-between text-sm font-bold text-slate-300">
                      <div className="flex items-center">
                        <CreditCard size={14} className="mr-1 text-green-500" />
                        Paid Keys (Pool 2)
                      </div>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {extractKeys(paidKeysInput).length}
                      </span>
                   </label>
                   <textarea 
                      value={paidKeysInput}
                      onChange={(e) => setPaidKeysInput(e.target.value)}
                      placeholder="AIza... (Billing Enabled)&#10;Mỗi dòng 1 key"
                      className="w-full h-64 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                   />
                </div>

                {/* Column 3: Ultra Token (NEW) */}
                <div className="space-y-2">
                   <label className="flex items-center justify-between text-sm font-bold text-slate-300">
                      <div className="flex items-center">
                        <FileJson size={14} className="mr-1 text-purple-500" />
                        Ultra Token JSON
                      </div>
                      {detectedUser && (
                          <span className="text-xs text-green-400 flex items-center bg-green-950/30 px-2 py-0.5 rounded border border-green-900">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span> Active
                          </span>
                      )}
                   </label>
                   <textarea 
                      value={tokenJsonInput}
                      onChange={(e) => setTokenJsonInput(e.target.value)}
                      placeholder='Dán toàn bộ JSON vào đây:&#10;{"user":..., "access_token":"ya29..."}'
                      className="w-full h-64 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none placeholder:text-slate-600"
                   />
                   {detectedUser && (
                       <div className="flex items-center p-2 bg-slate-800 rounded-lg border border-slate-700 animate-fade-in">
                           <img src={detectedUser.image} alt="Avatar" className="w-8 h-8 rounded-full mr-3 border border-slate-600" />
                           <div className="overflow-hidden">
                               <p className="text-xs font-bold text-white truncate">{detectedUser.name}</p>
                               <p className="text-[10px] text-slate-400 truncate">{detectedUser.email}</p>
                           </div>
                       </div>
                   )}
                </div>
            </div>

            {/* Status Bar */}
            {status !== 'idle' && (
               <div className={`p-3 rounded-lg flex items-center ${status === 'error' ? 'bg-red-950/30 text-red-400 border border-red-900' : 'bg-green-950/30 text-green-400 border border-green-900'}`}>
                  {status === 'validating' && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />}
                  {status === 'success' && <CheckCircle size={18} className="mr-2" />}
                  {status === 'error' && <AlertCircle size={18} className="mr-2" />}
                  <span className="font-medium text-sm">{statusMessage}</span>
               </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 hover:text-red-400 flex items-center transition-colors"
              >
                <Trash2 size={14} className="mr-1" /> Xóa tất cả
              </button>
              <div className="flex space-x-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    Đóng
                </button>
                <button
                    onClick={handleSave}
                    disabled={status === 'validating'}
                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm shadow-indigo-500/20"
                >
                    Lưu & Kết nối
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
