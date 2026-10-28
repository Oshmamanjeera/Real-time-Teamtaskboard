import React from 'react';

export function KumoMascot({ expression = 'happy', size = 120, className = '' }) {
  return (
    <div
      className={`inline-flex items-center justify-center transition-transform hover:scale-105 duration-300 ${className}`}
      style={{ width: size, height: (size * 140) / 160 }}
      role="img"
      aria-label={`Cute cloud mascot Kumo-chan, feeling ${expression}`}
    >
      <svg
        viewBox="0 0 160 140"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`cloudGrad_${expression}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="60%" stop-color="#F2F7FD" />
            <stop offset="100%" stop-color="#DCEBFA" />
          </linearGradient>
          <linearGradient id={`wingGrad_${expression}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="100%" stop-color="#BFD7F3" />
          </linearGradient>
          <linearGradient id={`bowGrad_${expression}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FDE8EF" />
            <stop offset="100%" stop-color="#F7CADA" />
          </linearGradient>
          <filter id={`softShadow_${expression}`} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#8FA8E8" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Left Angel Wing */}
        <g transform="matrix(0.95 -0.3 0.3 0.95 8 46)">
          <path
            d="M 28 32 C 12 28 4 14 10 4 C 18 -6 32 6 36 20 Z"
            fill={`url(#wingGrad_${expression})`}
            stroke="#BFD7F3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M 24 24 C 14 20 10 12 14 6" fill="none" stroke="#BFD7F3" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Right Angel Wing */}
        <g transform="matrix(-0.95 -0.3 -0.3 0.95 152 46)">
          <path
            d="M 28 32 C 12 28 4 14 10 4 C 18 -6 32 6 36 20 Z"
            fill={`url(#wingGrad_${expression})`}
            stroke="#BFD7F3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M 24 24 C 14 20 10 12 14 6" fill="none" stroke="#BFD7F3" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Main Round Puffy Cloud Body */}
        <g filter={`url(#softShadow_${expression})`}>
          <path
            d="
              M 48 95
              C 32 95 24 82 26 68
              C 28 54 40 48 50 50
              C 52 38 66 26 82 26
              C 98 26 112 36 116 48
              C 126 46 138 52 140 66
              C 142 80 134 95 118 95
              C 112 108 92 112 80 112
              C 66 112 52 106 48 95 Z"
            fill={`url(#cloudGrad_${expression})`}
            stroke="#BFD7F3"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>

        {/* Cute Blush Ribbon Bow on Top-Left */}
        <g transform="translate(46, 26)">
          <path d="M 0 6 C -14 -6 -18 12 -4 10 Z" fill={`url(#bowGrad_${expression})`} stroke="#E8A7BD" strokeWidth="2" />
          <path d="M 0 6 C 14 -6 18 12 4 10 Z" fill={`url(#bowGrad_${expression})`} stroke="#E8A7BD" strokeWidth="2" />
          <path d="M -2 10 Q -6 18 -10 20 Q -4 16 0 12" fill="#F7CADA" stroke="#E8A7BD" strokeWidth="1.5" />
          <path d="M 2 10 Q 6 18 10 20 Q 4 16 0 12" fill="#F7CADA" stroke="#E8A7BD" strokeWidth="1.5" />
          <circle cx="0" cy="7" r="4.5" fill="#F2AEC5" stroke="#E8A7BD" strokeWidth="2" />
        </g>

        {/* Blush Cheeks */}
        <ellipse cx="50" cy="74" rx="8" ry="5" fill="#F7CADA" opacity="0.85" />
        <ellipse cx="110" cy="74" rx="8" ry="5" fill="#F7CADA" opacity="0.85" />

        {/* Facial Expressions */}
        {expression === 'happy' && (
          <>
            {/* Sparkling Anime Eyes */}
            <g transform="translate(62, 64)">
              <ellipse cx="0" cy="0" rx="5.5" ry="7.5" fill="#7A5A50" />
              <circle cx="-2" cy="-2.5" r="2.2" fill="#FFFFFF" />
              <circle cx="2" cy="2.5" r="1.2" fill="#FFFFFF" />
            </g>
            <g transform="translate(98, 64)">
              <ellipse cx="0" cy="0" rx="5.5" ry="7.5" fill="#7A5A50" />
              <circle cx="-2" cy="-2.5" r="2.2" fill="#FFFFFF" />
              <circle cx="2" cy="2.5" r="1.2" fill="#FFFFFF" />
            </g>
            {/* Smile */}
            <path d="M 76 74 Q 80 81 84 74" fill="none" stroke="#7A5A50" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {expression === 'celebrating' && (
          <>
            {/* Joyful Curving Eyes (^_^ ) */}
            <path d="M 57 65 Q 63 56 69 65" fill="none" stroke="#7A5A50" strokeWidth="3" strokeLinecap="round" />
            <path d="M 91 65 Q 97 56 103 65" fill="none" stroke="#7A5A50" strokeWidth="3" strokeLinecap="round" />
            {/* Open happy smile */}
            <path d="M 74 72 Q 80 84 86 72 Z" fill="#F7CADA" stroke="#7A5A50" strokeWidth="2.5" strokeLinejoin="round" />
          </>
        )}

        {expression === 'alert' && (
          <>
            {/* Surprised Round Eyes */}
            <circle cx="62" cy="63" r="6" fill="#7A5A50" />
            <circle cx="60" cy="61" r="2" fill="#FFFFFF" />
            <circle cx="98" cy="63" r="6" fill="#7A5A50" />
            <circle cx="96" cy="61" r="2" fill="#FFFFFF" />
            {/* Little 'o' mouth */}
            <ellipse cx="80" cy="76" rx="4" ry="5" fill="#F7CADA" stroke="#7A5A50" strokeWidth="2" />
          </>
        )}

        {expression === 'sleepy' && (
          <>
            {/* Peaceful Sleeping Eyes */}
            <path d="M 57 66 Q 63 72 69 66" fill="none" stroke="#7A5A50" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 91 66 Q 97 72 103 66" fill="none" stroke="#7A5A50" strokeWidth="2.8" strokeLinecap="round" />
            {/* Tiny content mouth */}
            <path d="M 77 75 Q 80 77 83 75" fill="none" stroke="#7A5A50" strokeWidth="2" strokeLinecap="round" />
          </>
        )}

        {expression === 'thinking' && (
          <>
            {/* Looking up */}
            <g transform="translate(62, 60)">
              <ellipse cx="0" cy="0" rx="5.5" ry="7" fill="#7A5A50" />
              <circle cx="0" cy="-2" r="2.2" fill="#FFFFFF" />
            </g>
            <g transform="translate(98, 60)">
              <ellipse cx="0" cy="0" rx="5.5" ry="7" fill="#7A5A50" />
              <circle cx="0" cy="-2" r="2.2" fill="#FFFFFF" />
            </g>
            {/* Pouty / curious mouth */}
            <circle cx="80" cy="75" r="3" fill="#F7CADA" stroke="#7A5A50" strokeWidth="2" />
          </>
        )}

        {/* Twinkling Star Accent */}
        <g transform="translate(132, 28) scale(0.8)">
          <path d="M 0 -10 Q 0 0 10 0 Q 0 0 0 10 Q 0 0 -10 0 Q 0 0 0 -10 Z" fill="#FFD966" stroke="#F5C430" strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
}

