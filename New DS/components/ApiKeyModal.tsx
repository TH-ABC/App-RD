import React, { useState, useEffect } from 'react';
import { Key, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (key: string) => void;
  onClose: () => void;
  hasKey: boolean; // If true, user can close modal without entering new key
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose, hasKey }) => {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if key exists in localStorage to pre-fill or validate
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter a valid API Key');
      return;
    }
    if (!apiKey.startsWith('AIza')) {
        setError('Invalid Key format. Google Gemini keys usually start with "AIza"');
        return;
    }
    onSave(apiKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
        
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center space-x-3">
            <div className="p-2 bg-indigo-900/30 rounded-lg text-indigo-400 border border-indigo-900/50">
                <Key size={24} />
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-100">Setup API Key</h3>
                <p className="text-xs text-slate-500">Required to access Google Gemini AI</p>
            </div>
        </div>

        <div className="p-6 space-y-4">
            {!hasKey && (
                <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg flex items-start space-x-3 text-amber-200/80 text-xs">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>
                        No Environment Variable found. Please enter your own Google Gemini API Key below to continue.
                        <br/><span className="opacity-50 mt-1 block">Your key is saved locally in your browser.</span>
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Google Gemini API Key</label>
                    <div className="relative">
                        <input
                            type={isVisible ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setError(null);
                            }}
                            placeholder="AIzaSy..."
                            className="w-full pl-4 pr-12 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-200 outline-none transition-all placeholder:text-slate-600 font-mono text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setIsVisible(!isVisible)}
                            className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {error && <p className="text-red-400 text-xs flex items-center mt-1"><AlertCircle size={12} className="mr-1"/> {error}</p>}
                </div>

                <div className="pt-2 flex space-x-3">
                    {hasKey && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center"
                    >
                        <Check size={18} className="mr-2" />
                        Save & Continue
                    </button>
                </div>
            </form>

            <div className="text-center pt-2">
                <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                >
                    Get a free API Key here →
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};
