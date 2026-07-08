import React from "react";
import { useNavigate } from "react-router-dom";

const WarningScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-100">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">
          Suspicious Login Attempt
        </h1>
        <p className="text-gray-700 mb-6">
          We noticed unusual activity in your account.  
          For your security, please verify your identity before proceeding.
        </p>
        <button
          onClick={() => navigate("/verify")}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Verify Identity
        </button>
      </div>
    </div>
  );
};

export default WarningScreen;
