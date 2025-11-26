import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Layers, CreditCard, Zap, Trash2 } from 'lucide-react';
import { validateToken } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (freeKeys: string[], paidKeys: string[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [freeKeysInput, setFreeKeysInput] = useState('');
  const [paidKeysInput, setPaidKeysInput] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setStatusMessage('');
      
      const storedFree = localStorage.getItem('gemini_pool_free');
      const storedPaid = localStorage.getItem('gemini_pool_paid');
      
      if (storedFree) setFreeKeysInput(JSON.parse(storedFree).join('\n'));
      if (storedPaid) setPaidKeysInput(JSON.parse(storedPaid).join('\n'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const extractKeys = (input: string): string[] => {
    return input
      .split(/[\n,]+/) // Split by newline or comma
      .map(k => k.trim())
      .filter(k => k.length > 10); // Basic length check filter
  };

  const handleSave = async () => {
    const freeKeys = extractKeys(freeKeysInput);
    const paidKeys = extractKeys(paidKeysInput);

    if (freeKeys.length === 0 && paidKeys.length === 0) {
      setStatus('error');
      setStatusMessage('Vui lòng nhập ít nhất 1 API Key.');
      return;
    }

    setStatus('validating');
    setStatusMessage(`Đang kiểm tra ${freeKeys.length + paidKeys.length} keys...`);

    // Quick validation of just the first key of each pool to ensure basic connectivity
    try {
      const keyToTest = freeKeys[0] || paidKeys[0];
      // Attempt validation
      await validateToken(keyToTest);
      
      setStatus('success');
      setStatusMessage(`Đã lưu: ${freeKeys.length} Free Keys & ${paidKeys.length} Paid Keys.`);
      
      setTimeout(() => {
        onSave(freeKeys, paidKeys);
      }, 1000);

    } catch (error: any) {
      console.error("Validation failed", error);
      // We still save, but warn the user
      const confirm = window.confirm("Key đầu tiên kiểm tra thất bại. Bạn có chắc chắn muốn lưu danh sách này không?");
      if (confirm) {
         onSave(freeKeys, paidKeys);
      } else {
         setStatus('error');
         setStatusMessage('Kiểm tra thất bại: ' + (error.message || 'Key không hợp lệ'));
      }
    }
  };

  const clearAll = () => {
    setFreeKeysInput('');
    setPaidKeysInput('');
    setStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-slate-900 shadow-2xl transition-all w-full max-w-2xl animate-fade-in border border-slate-800">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900">
            <h3 className="text-lg font-bold text-slate-200 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-500" />
              Quản lý API Key Pool (Xoay vòng)
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            
            <div className="bg-blue-950/30 p-4 rounded-lg border border-blue-900/50 text-sm text-blue-200">
               <p className="font-semibold mb-1 text-blue-300">Cơ chế hoạt động:</p>
               <ul className="list-disc pl-5 space-y-1 opacity-90">
                 <li>Hệ thống sẽ ưu tiên dùng hết <strong>Free Keys</strong> trước.</li>
                 <li>Nếu Free Key bị giới hạn (429), tự động đổi sang Free Key khác.</li>
                 <li>Nếu tất cả Free Keys đều lỗi, hệ thống mới chuyển sang dùng <strong>Paid Keys</strong>.</li>
               </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free Keys Input */}
                <div className="space-y-2">
                   <label className="flex items-center justify-between text-sm font-bold text-slate-300">
                      <div className="flex items-center">
                        <Zap size={14} className="mr-1 text-amber-500" />
                        Free Keys (Ưu tiên 1)
                      </div>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {extractKeys(freeKeysInput).length} keys
                      </span>
                   </label>
                   <textarea 
                      value={freeKeysInput}
                      onChange={(e) => setFreeKeysInput(e.target.value)}
                      placeholder="Dán danh sách API Key Free vào đây...&#10;Mỗi key một dòng"
                      className="w-full h-48 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                   />
                </div>

                {/* Paid Keys Input */}
                 <div className="space-y-2">
                   <label className="flex items-center justify-between text-sm font-bold text-slate-300">
                      <div className="flex items-center">
                        <CreditCard size={14} className="mr-1 text-green-500" />
                        Paid/Backup Keys (Ưu tiên 2)
                      </div>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {extractKeys(paidKeysInput).length} keys
                      </span>
                   </label>
                   <textarea 
                      value={paidKeysInput}
                      onChange={(e) => setPaidKeysInput(e.target.value)}
                      placeholder="Dán danh sách API Key Trả phí/Token vào đây...&#10;Chỉ dùng khi Free Keys hết hạn mức"
                      className="w-full h-48 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                   />
                </div>
            </div>

            {/* Status */}
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