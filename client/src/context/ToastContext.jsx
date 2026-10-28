import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = 'info', duration = 5000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          let bgClass = 'bg-[#F8F8FB] border-[#BFD7F3] text-[#7A5A50]';
          let icon = '🌸';
          let badgeBg = 'bg-[#DCEBFA]';

          if (toast.type === 'conflict') {
            bgClass = 'bg-[#FFFBF0] border-[#FFD966] text-[#7A5A50] shadow-kawaii-hover ring-2 ring-[#FFD966]/50';
            icon = '⚠️ (｡•́︿•̀｡)';
            badgeBg = 'bg-[#FFF3C4]';
          } else if (toast.type === 'error') {
            bgClass = 'bg-[#FDF0F5] border-[#F7CADA] text-[#7A5A50] shadow-kawaii-hover ring-2 ring-[#F7CADA]/50';
            icon = '❌ (´• ω •`)';
            badgeBg = 'bg-[#F7CADA]';
          } else if (toast.type === 'success') {
            bgClass = 'bg-[#F0FDF4] border-[#C8E6C9] text-[#7A5A50] shadow-kawaii';
            icon = '✨ (˶ᵔ ᵕ ᵔ˶)';
            badgeBg = 'bg-[#D2F1DF]';
          }

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-kawaii flex items-start gap-3 transition-all transform animate-float-gentle ${bgClass}`}
            >
              <div className={`px-2 py-1 rounded-xl text-xs font-bold shrink-0 ${badgeBg}`}>
                {icon}
              </div>
              <div className="flex-1 text-xs sm:text-sm font-semibold leading-relaxed">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[#7A5A50]/60 hover:text-[#7A5A50] text-sm font-bold px-1 kawaii-focus rounded-lg"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

