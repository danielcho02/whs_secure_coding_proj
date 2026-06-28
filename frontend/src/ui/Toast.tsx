import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { IconButton } from './IconButton';
import { ToastContext, type ToastContextValue, type ToastTone } from './ToastContext';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1_000);
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismissToast(id), 3_500);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 size={18} /> : null}
            {toast.tone === 'error' ? <XCircle size={18} /> : null}
            {toast.tone === 'info' ? <Info size={18} /> : null}
            <span>{toast.message}</span>
            <IconButton
              className="toast__close"
              label="알림 닫기"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
