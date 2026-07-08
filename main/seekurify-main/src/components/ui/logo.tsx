import React from 'react';

const Logo = () => {
return (

    <div className="flex flex-col items-center mb-4">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-amber-400 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <span className="text-amber-400 font-bold text-2xl">Seekurify</span>
    </div>
)}

export { Logo };