import { Alert, Platform } from 'react-native';

/**
 * Configuration du toast mobile
 */
export interface ToastConfig {
  /**
   * Durée d'affichage en ms
   */
  duration?: number;

  /**
   * Type de toast
   */
  type?: 'success' | 'error' | 'info' | 'warning';

  /**
   * Titre
   */
  title?: string;

  /**
   * Style personnalisé
   */
  style?: any;
}

/**
 * Toast - Composant pour afficher les notifications (Mobile)
 *
 * Ce composant :
 * - Utilise Alert natif ou une librairie de toast
 * - Affiche les messages de succès, erreur, warning, info
 *
 * Note: Pour une meilleure expérience utilisateur, installez react-native-toast-message
 * et remplacez les Alert par des vrais toasts
 *
 * @example
 * ```tsx
 * // Installation recommandée:
 * // npm install react-native-toast-message
 *
 * // Utilisation
 * import { showToast } from '@novaconnect/ui/mobile';
 *
 * showToast.success('Opération réussie !');
 * showToast.error('Une erreur est survenue');
 * ```
 */

/**
 * Helper functions pour afficher les toasts mobile
 */
export const showToast = {
  /**
   * Toast de succès
   */
  success: (message: string, config?: ToastConfig) => {
    if (Platform.OS === 'web') {
      // Sur web, utiliser Alert
      Alert.alert(config?.title || 'Succès', message);
    } else {
      // Sur mobile, utiliser Alert (ou remplacer par react-native-toast-message)
      Alert.alert(config?.title || 'Succès', message, [
        { text: 'OK', style: 'default' }
      ]);
    }
  },

  /**
   * Toast d'erreur
   */
  error: (message: string, config?: ToastConfig) => {
    if (Platform.OS === 'web') {
      Alert.alert(config?.title || 'Erreur', message);
    } else {
      Alert.alert(config?.title || 'Erreur', message, [
        { text: 'OK', style: 'destructive' }
      ]);
    }
  },

  /**
   * Toast d'information
   */
  info: (message: string, config?: ToastConfig) => {
    Alert.alert(config?.title || 'Information', message);
  },

  /**
   * Toast de warning
   */
  warning: (message: string, config?: ToastConfig) => {
    Alert.alert(config?.title || 'Attention', message);
  },

  /**
   * Toast de chargement
   * Note: Sur mobile, utilisez un Spinner/ActivityIndicator au lieu d'un toast
   */
  loading: (message: string, _config?: ToastConfig) => {
    // Sur mobile, un toast loading n'est pas recommandé
    // Utilisez plutôt un Spinner/ActivityIndicator dans votre UI
    console.log('[Loading]', message);
  },

  /**
   * Promise toast - pour les opérations asynchrones
   */
  promise: async <T,>(
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
  ): Promise<T> => {
    try {
      // Afficher le loading (optionnel sur mobile)
      console.log('[Loading]', loading);

      const result = await promise;

      // Afficher le succès
      const successMessage = typeof success === 'function' ? success(result) : success;
      showToast.success(successMessage);

      return result;
    } catch (err) {
      // Afficher l'erreur
      const errorMessage = typeof error === 'function' ? error(err as Error) : error;
      showToast.error(errorMessage);
      throw err;
    }
  },
};

/**
 * Hook pour utiliser les toasts dans les composants mobiles
 */
export function useToast() {
  return showToast;
}

/**
 * Composant Toast vide (pour compatibilité avec le web)
 * Sur mobile, vous pouvez intégrer react-native-toast-message ici
 */
export function Toast() {
  // Si vous utilisez react-native-toast-message:
  // return <Toast />;

  return null;
}

export default Toast;
