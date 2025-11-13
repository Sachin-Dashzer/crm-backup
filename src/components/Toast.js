"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { X, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

// ============================================
// CONTEXT AND PROVIDER
// ============================================

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    ({ type = "info", message, title, duration = 5000, position = "top-right" }) => {
      const id = Date.now() + Math.random();
      const toast = { id, type, message, title, duration, position };
      
      setToasts((prev) => [...prev, toast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Memoize the toast methods object so it doesn't change on every render
  const value = useMemo(() => ({
    success: (message, title = "Success", options = {}) =>
      addToast({ type: "success", message, title, ...options }),
    error: (message, title = "Error", options = {}) =>
      addToast({ type: "error", message, title, ...options }),
    warning: (message, title = "Warning", options = {}) =>
      addToast({ type: "warning", message, title, ...options }),
    info: (message, title = "Info", options = {}) =>
      addToast({ type: "info", message, title, ...options }),
  }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// ============================================
// TOAST COMPONENT
// ============================================

function Toast({ type, message, title, duration, position, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = useMemo(() => ({
    success: {
      icon: CheckCircle,
      style: "bg-green-50 border-green-500 text-green-900",
      iconColor: "text-green-500",
      progressColor: "bg-green-500",
    },
    error: {
      icon: XCircle,
      style: "bg-red-50 border-red-500 text-red-900",
      iconColor: "text-red-500",
      progressColor: "bg-red-500",
    },
    warning: {
      icon: AlertCircle,
      style: "bg-yellow-50 border-yellow-500 text-yellow-900",
      iconColor: "text-yellow-500",
      progressColor: "bg-yellow-500",
    },
    info: {
      icon: Info,
      style: "bg-blue-50 border-blue-500 text-blue-900",
      iconColor: "text-blue-500",
      progressColor: "bg-blue-500",
    },
  }), []);

  const positions = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  const currentConfig = config[type] || config.info;
  const Icon = currentConfig.icon;

  return (
    <>
      <style jsx>{`
        @keyframes slideInFade {
          0% {
            opacity: 0;
            transform: translateY(-1rem);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes progress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
        .toast-animate {
          animation: slideInFade 0.3s ease-out;
        }
        .toast-progress {
          animation: progress linear forwards;
        }
      `}</style>

      <div
        className={`fixed ${positions[position] || positions["top-right"]} z-50 toast-animate min-w-[320px] max-w-md`}
      >
        <div className={`border-l-4 ${currentConfig.style} rounded-lg shadow-lg p-4 flex items-start space-x-3`}>
          <div className={`flex-shrink-0 ${currentConfig.iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
            <p className="text-sm">{message}</p>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {duration > 0 && (
          <div className="h-1 bg-gray-200 rounded-b-lg overflow-hidden">
            <div
              className={`h-full ${currentConfig.progressColor} toast-progress`}
              style={{ animationDuration: `${duration}ms` }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default Toast;