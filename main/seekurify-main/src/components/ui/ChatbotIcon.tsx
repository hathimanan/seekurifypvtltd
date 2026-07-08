import React from "react";

const SecurityChatbotIcon = () => {
  return (
    <div className="flex items-center justify-center bg-[#0d1b2a] rounded-2xl p-6 w-32 h-32 shadow-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 128 128"
        className="w-20 h-20"
      >
        {/* Robot Head */}
        <rect
          x="34"
          y="34"
          width="60"
          height="50"
          rx="12"
          fill="#e9f1fb"
          stroke="#1e3a8a"
          strokeWidth="2"
        />
        {/* Eyes / Visor */}
        <rect
          x="46"
          y="46"
          width="36"
          height="18"
          rx="9"
          fill="#3b82f6"
        />
        <circle cx="56" cy="55" r="4" fill="#0f172a" />
        <circle cx="72" cy="55" r="4" fill="#0f172a" />
        {/* Antenna */}
        <line
          x1="64"
          y1="28"
          x2="64"
          y2="20"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="64" cy="17" r="3" fill="#3b82f6" />
        {/* Shield */}
        <path
          d="M88 70c10 2 16 5 16 12v10c0 10-6 14-16 18-10-4-16-8-16-18V82c0-7 6-10 16-12z"
          fill="#1e3a8a"
        />
        {/* Shield Checkmark */}
        <path
          d="M80 88l4 4 8-8"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default SecurityChatbotIcon;
