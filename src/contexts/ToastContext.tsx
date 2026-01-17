import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import ToastManager from '../components/ui/ToastManager';
import { ToastConfig } from '../components/ui/Toast';
import { toastService } from '../services/toastService';

interface ToastContextType {
  showSuccess: (title: string, message?: string, options?: Partial<ToastConfig>) => string;
  showError: (title: string, message?: string, options?: Partial<ToastConfig>) => string;
  showWarning: (title: string, message?: string, options?: Partial<ToastConfig>) => string;
  showInfo: (title: string, message?: string, options?: Partial<ToastConfig>) => string;
  showCustom: (config: Omit<ToastConfig, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  // Convenience methods
  showSaved: () => string;
  showRemoved: () => string;
  showTraktSaved: () => string;
  showTraktRemoved: () => string;
  showNetworkError: () => string;
  showAuthError: () => string;
  showSyncSuccess: (count: number) => string;
  showProgressSaved: () => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe(setToasts);
    return unsubscribe;
  }, []);

  // Memoize context value - toastService methods are stable singleton references
  // This prevents cascading re-renders of all toast consumers on every provider render
  const contextValue = useMemo<ToastContextType>(() => ({
    showSuccess: toastService.success.bind(toastService),
    showError: toastService.error.bind(toastService),
    showWarning: toastService.warning.bind(toastService),
    showInfo: toastService.info.bind(toastService),
    showCustom: toastService.custom.bind(toastService),
    removeToast: toastService.remove.bind(toastService),
    removeAllToasts: toastService.removeAll.bind(toastService),
    showSaved: toastService.showSaved.bind(toastService),
    showRemoved: toastService.showRemoved.bind(toastService),
    showTraktSaved: toastService.showTraktSaved.bind(toastService),
    showTraktRemoved: toastService.showTraktRemoved.bind(toastService),
    showNetworkError: toastService.showNetworkError.bind(toastService),
    showAuthError: toastService.showAuthError.bind(toastService),
    showSyncSuccess: toastService.showSyncSuccess.bind(toastService),
    showProgressSaved: toastService.showProgressSaved.bind(toastService),
  }), []); // Empty deps - toastService is a singleton with stable methods

  // Memoize onRemoveToast to avoid recreating on every render
  const onRemoveToast = useMemo(() => toastService.remove.bind(toastService), []);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastManager toasts={toasts} onRemoveToast={onRemoveToast} />
    </ToastContext.Provider>
  );
};

