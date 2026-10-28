import React from 'react';

export function KawaiiDecorations() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-70"
      aria-hidden="true"
    >
      {/* Top Left Twinkling Star */}
      <div className="absolute top-12 left-10 text-[#FFD966] animate-twinkle-slow text-2xl">
        ✦
      </div>
      
      {/* Top Right Pastel Plus */}
      <div className="absolute top-20 right-16 text-[#F7CADA] animate-float-gentle text-xl font-bold">
        +
      </div>

      {/* Mid Left Cute Sparkle */}
      <div className="absolute top-1/3 left-6 text-[#8FA8E8] animate-twinkle-slow text-lg" style={{ animationDelay: '1.5s' }}>
        ✧
      </div>

      {/* Mid Right Floating Star */}
      <div className="absolute top-1/2 right-10 text-[#FFD966] animate-float-gentle text-3xl" style={{ animationDelay: '2.5s' }}>
        ★
      </div>

      {/* Bottom Left Small Bow/Heart */}
      <div className="absolute bottom-20 left-16 text-[#F7CADA] animate-float-gentle text-2xl" style={{ animationDelay: '3s' }}>
        ♥
      </div>

      {/* Bottom Right Pastel Plus */}
      <div className="absolute bottom-14 right-20 text-[#8FA8E8] animate-twinkle-slow text-xl font-bold" style={{ animationDelay: '4s' }}>
        +
      </div>

      {/* Center Subtle Sparkle */}
      <div className="absolute top-2/3 left-1/4 text-[#BFD7F3] animate-twinkle-slow text-sm" style={{ animationDelay: '0.8s' }}>
        ✦
      </div>
    </div>
  );
}

