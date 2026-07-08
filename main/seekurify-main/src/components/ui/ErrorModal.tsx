// src/components/ui/ErrorModal.tsx
import React from "react";
import { Button } from "./button";

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
  return (
  <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-80 z-50">
      <div className="bg-white rounded-xl p-8 w-full max-w-md mx-4 shadow-lg text-center">
        <h2 className="text-xl font-semibold mb-4 text-red-600">Error</h2>
        <p className="mb-6 text-gray-700">{message}</p>
        <Button onClick={onClose} className="bg-red-500 hover:bg-red-600 text-white">
          Close
        </Button>
      </div>
    </div>
  );
};
