import React from 'react';

// This component is obsolete as API keys are managed via Environment Variables.
// It is kept as a stub to prevent build errors if referenced elsewhere.

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (freeKeys: string[], paidKeys: string[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  return null; 
};
