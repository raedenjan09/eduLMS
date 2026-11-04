import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    border: 'border-emerald-200/80',
    bar: 'bg-emerald-500',
    defaultTitle: 'Success',
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-red-50 text-red-600 border-red-200',
    border: 'border-red-200/80',
    bar: 'bg-red-500',
    defaultTitle: 'Action Failed',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
    border: 'border-blue-200/80',
    bar: 'bg-blue-600',
    defaultTitle: 'Notice',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
    border: 'border-amber-200/80',
    bar: 'bg-amber-500',
    defaultTitle: 'Attention',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'success', title, message, duration = 3500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const config = TOAST_STYLES[type] || TOAST_STYLES.success;

      setToasts((prev) => [
        ...prev.slice(-3), // Keep max 4 visible at once
        {
          id,
          type,
          title: title || config.defaultTitle,
          message,
          duration,
        },
      ]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (message, title = 'Success') =>
      addToast({ type: 'success', title, message }),
    error: (message, title = 'Error') =>
      addToast({ type: 'error', title, message, duration: 4500 }),
    info: (message, title = 'Update') =>
      addToast({ type: 'info', title, message }),
    warning: (message, title = 'Notice') =>
      addToast({ type: 'warning', title, message }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Floating Toast Stack */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => {
            const style = TOAST_STYLES[item.type] || TOAST_STYLES.success;
            const IconComponent = style.icon;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                className={`pointer-events-auto relative overflow-hidden bg-white/95 backdrop-blur-md border ${style.border} rounded-2xl shadow-lg shadow-slate-900/10 p-3.5 flex items-start gap-3`}
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${style.iconBg}`}
                >
                  <IconComponent size={18} />
                </div>

                <div className="flex-1 min-w-0 pr-1 pt-0.5">
                  <p className="text-xs font-extrabold text-slate-900 leading-tight">
                    {item.title}
                  </p>
                  {item.message && (
                    <p className="text-xs text-slate-600 mt-0.5 leading-snug break-words">
                      {item.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(item.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>

                {item.duration > 0 && (
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: item.duration / 1000, ease: 'linear' }}
                    className={`absolute bottom-0 left-0 h-0.5 ${style.bar}`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

