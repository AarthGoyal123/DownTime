"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, CheckCircle2, XCircle, Info, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error" | "confirm";
  confirmText?: string;
  cancelText?: string;
}

export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "info",
  confirmText = "Continue",
  cancelText = "Cancel",
}: ModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setShow(false), 300);
      document.body.style.overflow = "unset";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !show) return null;

  const icons = {
    info: <Info className="w-6 h-6 text-blue-400" />,
    success: <CheckCircle2 className="w-6 h-6 text-green-400" />,
    warning: <AlertCircle className="w-6 h-6 text-yellow-400" />,
    error: <XCircle className="w-6 h-6 text-red-400" />,
    confirm: <Shield className="w-6 h-6 text-indigo-400" />,
  };

  const colors = {
    info: "from-blue-500/20 to-indigo-500/20 border-blue-500/20",
    success: "from-green-500/20 to-emerald-500/20 border-green-500/20",
    warning: "from-yellow-500/20 to-orange-500/20 border-yellow-500/20",
    error: "from-red-500/20 to-orange-500/20 border-red-500/20",
    confirm: "from-indigo-500/20 to-purple-500/20 border-indigo-500/20",
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 transform",
          isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
          colors[type]
        )}
      >
        {/* Glow Effect */}
        <div className={cn(
          "absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] opacity-20",
          type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
        )} />

        <button 
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={cn(
            "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-xl",
            isOpen ? "animate-float" : ""
          )}>
            {icons[type]}
          </div>

          <h3 className="mb-2 text-2xl font-bold text-white tracking-tight">{title}</h3>
          <p className="mb-8 text-slate-400 leading-relaxed">{message}</p>

          <div className="flex w-full gap-3">
            {type === "confirm" ? (
              <>
                <Button 
                  variant="ghost" 
                  className="flex-1 rounded-xl border border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white py-6 h-auto"
                  onClick={onClose}
                >
                  {cancelText}
                </Button>
                <Button 
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-6 h-auto shadow-lg shadow-indigo-500/20"
                  onClick={() => {
                    onConfirm?.();
                    onClose();
                  }}
                >
                  {confirmText}
                </Button>
              </>
            ) : (
              <Button 
                className={cn(
                  "w-full rounded-xl py-6 h-auto font-bold text-lg transition-all",
                  type === 'error' 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                )}
                onClick={onClose}
              >
                Okay
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
