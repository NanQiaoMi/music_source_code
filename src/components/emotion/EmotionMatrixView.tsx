import React from "react";

interface EmotionMatrixViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmotionMatrixView: React.FC<EmotionMatrixViewProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="text-white">Emotion Matrix</div>
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default EmotionMatrixView;
