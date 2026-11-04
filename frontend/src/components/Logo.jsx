import React from 'react';
import { Link } from 'react-router-dom';

const Logo = ({ 
  size = 36, 
  showText = true, 
  textSize = 'text-xl', 
  href = '/', 
  className = '' 
}) => {
  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* SVG Icon Emblem */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
        </defs>

        {/* Base Squircle */}
        <rect width="48" height="48" rx="13" fill="url(#logoGrad)" />

        {/* Mortarboard Diamond / Cap */}
        <polygon points="24,10 38,17 24,24 10,17" fill="#FFFFFF" />
        
        {/* Cap Underside Shadow */}
        <polygon points="24,24 38,17 38,19 24,26 10,19 10,17" fill="#DBEAFE" opacity="0.9" />

        {/* Cap Tassel Ribbon */}
        <path d="M33 19.5 V27 Q33 29 35 29" stroke="#FDE047" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="35" cy="29.5" r="1.5" fill="#EAB308" />

        {/* Open Book Pages */}
        <path d="M13 28 C17 26 21 27 24 29 C27 27 31 26 35 28 V36 C31 34 27 35 24 37 C21 35 17 34 13 36 Z" fill="#FFFFFF" />
        
        {/* Book Spine Center Divider */}
        <line x1="24" y1="29" x2="24" y2="37" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className={`font-black tracking-tight text-slate-900 ${textSize}`}>
          Edu<span className="text-blue-600">LMS</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="focus:outline-none hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
