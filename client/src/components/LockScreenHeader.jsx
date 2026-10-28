import React, { useState, useEffect } from 'react';

const KAWAII_EMOTICONS = [
  '(˶ᵔ ᵕ ᵔ˶)',
  '(｡•̀ᴗ-)✧',
  '(づ ◕‿◕ )づ',
  '( •̀ ω •́ )✧',
  '(*^▽^*)',
  '(◕‿◕✿)',
];

export function LockScreenHeader({ userName }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [emoticonIndex, setEmoticonIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const nextEmoticon = () => {
    setEmoticonIndex((prev) => (prev + 1) % KAWAII_EMOTICONS.length);
  };

  return (
    <header className="relative flex flex-col items-center justify-center pt-2 pb-4 px-4 text-center select-none">
      {/* Phone Lock-Screen Aesthetic Clock */}
      <div className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#7A5A50] drop-shadow-sm">
        {timeString}
      </div>

      {/* Date + Cute Kaomoji */}
      <div className="mt-1 flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-[#5B6475]">
        <span>{dateString}</span>
        <button
          type="button"
          onClick={nextEmoticon}
          title="Click to cycle cute kaomoji!"
          className="inline-block px-2 py-0.5 rounded-full bg-[#FFF3C4] text-[#7A5A50] text-xs sm:text-sm font-bold shadow-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer kawaii-focus"
          aria-label="Cute emoticon, click to change"
        >
          {KAWAII_EMOTICONS[emoticonIndex]}
        </button>
      </div>

      {/* Friendly Microcopy */}
      {userName && (
        <p className="mt-1 text-xs sm:text-sm text-[#7A5A50]/80 font-medium">
          Welcome back, <span className="font-bold text-[#7A5A50]">{userName}</span>! All caught up! ✨
        </p>
      )}
    </header>
  );
}

