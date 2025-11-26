import React, { useState, useEffect } from 'react';
import { X, Layers, CreditCard, Zap, Trash2, FileJson } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (freeKeys: string[], paidKeys: string[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [freeKeysInput, setFreeKeysInput] = useState('');
  const [paidKeysInput, setPaidKeysInput] = useState('');
  const [tokenJsonInput, setTokenJsonInput] = useState('');

  // Khi mở modal → reset input
  useEffect(() => {
    if (isOpen) {
      setFreeKeysInput('');
      setPaidKeysInput('');
      setTokenJsonInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Không còn xử lý validate → chỉ đóng modal
  const handleSave = () => {
    alert("Chế độ backend API cố định. Không cần nhập API key nữa.");
    onSave([], []); 
    onClose();
  };

  const clearAll = () => {
    setFreeKeysInput('');
    setPaidKeysInput('');
    setTokenJsonInput('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-slate-900 shadow-2xl transition-all w-full max-w-4xl border border-slate-800">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900">
            <h3 className="text-lg font-bold text-slate-200 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-500" />
              Quản lý API Key (Không còn cần thiết)
            </h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <p className="text-slate-400 text-sm">
              Ứng dụng đang chạy ở chế độ <span className="text-indigo-400 font-bold">API cố định Backend</span>. <br />
              Bạn không cần nhập API Key hoặc Token nữa. Modal này chỉ giữ lại để tránh lỗi giao diện.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-40 pointer-events-none">

              {/* Free Keys */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-slate-300">
                  <Zap size={14} className="mr-1 text-amber-500" />
                  Free Keys
                </label>
                <textarea
                  value={freeKeysInput}
                  onChange={(e) => setFreeKeysInput(e.target.value)}
                  placeholder="Không cần nhập..."
                  className="w-full h-48 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-600 rounded-xl resize-none"
                />
              </div>

              {/* Paid Keys */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-slate-300">
                  <CreditCard size={14} className="mr-1 text-green-500" />
                  Paid Keys
                </label>
                <textarea
                  value={paidKeysInput}
                  onChange={(e) => setPaidKeysInput(e.target.value)}
                  placeholder="Không cần nhập..."
                  className="w-full h-48 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-600 rounded-xl resize-none"
                />
              </div>

              {/* Ultra Token */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-bold text-slate-300">
                  <FileJson size={14} className="mr-1 text-purple-500" />
                  Ultra Token JSON
                </label>
                <textarea
                  value={tokenJsonInput}
                  onChange={(e) => setTokenJsonInput(e.target.value)}
                  placeholder="Không cần nhập..."
                  className="w-full h-48 p-3 text-xs font-mono bg-slate-950 border border-slate-700 text-slate-600 rounded-xl resize-none"
                />
              </div>

            </div>

            {/* Buttons */}
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
                  className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-500/20"
                >
                  Lưu (thực chất là đóng)
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
