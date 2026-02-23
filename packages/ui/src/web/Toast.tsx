import React, { useEffect } from 'react';
import toast, { Toaster as ToastToaster, ToastBar } from 'react-hot-toast';
import type { ToastPosition } from 'react-hot-toast';

/**
 * Configuration du toast
 */
export interface ToastConfig {
  /**
   * Durée d'affichage en ms
   */
  duration?: number;

  /**
   * Position du toast
   */
  position?: ToastPosition;

  /**
   * Icône
   */
  icon?: string | React.ReactNode;

  /**
   * Style personnalisé
   */
  className?: string;

  /**
   * Style personnalisé pour le conteneur
   */
  style?: React.CSSProperties;
}

/**
 * Props du composant Toast
 */
export interface ToastProps {
  /**
   * Configuration globale des toasts
   */
  config?: ToastConfig;

  /**
   * Afficher ou non les toasts
   */
  showToasts?: boolean;
}

/**
 * Toast - Composant pour afficher les notifications (Web)
 *
 * Ce composant :
 * - Utilise react-hot-toast pour afficher les notifications
 * - Affiche les messages de succès, erreur, warning, info
 * - S'intègre avec les mutations React Query
 *
 * @example
 * ```tsx
 * // Dans votre layout racine
 * <Toast />
 *
 * // Utilisation
 * import { toast } from '@novaconnect/ui/web';
 *
 * toast.success('Opération réussie !');
 * toast.error('Une erreur est survenue');
 * toast.loading('Chargement...');
 * ```
 */
export function Toast({ config, showToasts = true }: ToastProps) {
  /**
   * Appliquer la configuration globale
   */
  useEffect(() => {
    if (config?.duration) {
      // Note: react-hot-toast ne permet pas de configurer la durée par défaut globalement
      // Il faut la passer à chaque appel
    }
  }, [config]);

  if (!showToasts) {
    return null;
  }

  return (
    <ToastToaster
      position={config?.position || 'top-right'}
      toastOptions={{
        duration: config?.duration || 4000,
        className: config?.className,
        style: config?.style,
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#ffffff',
          },
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#ffffff',
          },
        },
      }}
    >
      {(t: any) => (
        <ToastBar toast={t}>
          {({ icon, message }: { icon: any; message: any }) => (
            <div className="flex items-center gap-3">
              {icon}
              <span className="font-medium">{message}</span>
              {t.type !== 'loading' && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </ToastToaster>
  );
}

/**
 * Helper functions pour afficher les toasts
 */
export const showToast = {
  /**
   * Toast de succès
   */
  success: (message: string, options?: ToastConfig) => {
    return toast.success(message, {
      duration: options?.duration || 4000,
      className: options?.className,
      style: options?.style,
    });
  },

  /**
   * Toast d'erreur
   */
  error: (message: string, options?: ToastConfig) => {
    return toast.error(message, {
      duration: options?.duration || 4000,
      className: options?.className,
      style: options?.style,
    });
  },

  /**
   * Toast d'information
   */
  info: (message: string, options?: ToastConfig) => {
    return toast(message, {
      icon: 'ℹ️',
      duration: options?.duration || 4000,
      className: options?.className,
      style: options?.style,
    });
  },

  /**
   * Toast de warning
   */
  warning: (message: string, options?: ToastConfig) => {
    return toast(message, {
      icon: '⚠️',
      duration: options?.duration || 4000,
      className: options?.className,
      style: options?.style,
    });
  },

  /**
   * Toast de chargement
   */
  loading: (message: string, options?: ToastConfig) => {
    return toast.loading(message, {
      className: options?.className,
      style: options?.style,
    });
  },

  /**
   * Dismiss un toast spécifique
   */
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss tous les toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },

  /**
   * Promise toast - pour les opérations asynchrones
   */
  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    });
  },
};

/**
 * Hook pour utiliser les toasts dans les composants
 */
export function useToast() {
  return showToast;
}

export default Toast;
