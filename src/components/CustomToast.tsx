import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  show: (content: string, type?: 'success' | 'fail' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{
    content: string;
    type: 'success' | 'fail' | 'info';
    visible: boolean;
  } | null>(null);

  const show = useCallback((content: string, type: 'success' | 'fail' | 'info' = 'info') => {
    setToast({ content, type, visible: true });
    setTimeout(() => {
      setToast(null);
    }, 2000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: toast.type === 'success' ? '#52c41a' : 
                         toast.type === 'fail' ? '#f5222d' : '#1890ff',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: 9999,
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'toastIn 0.3s ease-out',
          }}
        >
          {toast.content}
        </div>
      )}
      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
