import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryProvider, AuthProvider, useAuthContext } from '@novaconnect/data';

// PWA Components (web only)
import InstallPrompt from '../src/components/pwa/InstallPrompt';
import UpdateNotification from '../src/components/pwa/UpdateNotification';
import OfflineIndicator from '../src/components/pwa/OfflineIndicator';

// PWA Hooks (web only)
import { useServiceWorker } from '../src/hooks/useServiceWorker';
import { useWebPush } from '../src/hooks/useWebPush';

/**
 * PWA Component Wrapper - Only renders on web platform
 */
function PWAComponents() {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <>
      <InstallPrompt />
      <UpdateNotification />
      <OfflineIndicator />
    </>
  );
}

/**
 * Inner layout component that uses auth context
 */
function RootLayoutInner() {
  const { isAuthenticated, isLoading, role } = useAuthContext();
  const [isReady, setIsReady] = useState(false);

  // Initialize PWA hooks unconditionally (they handle platform checks internally)
  const { isReady: swReady, registration: swRegistration } = useServiceWorker();

  // Only initialize useWebPush when SW registration is ready
  const skipWebPush = Platform.OS !== 'web' || !swRegistration;
  const { permission } = useWebPush({
    swRegistration: skipWebPush ? null : swRegistration,
    autoRequest: false,
    autoSubscribe: false,
  });

  // Attendre que le splash screen soit prêt
  useEffect(() => {
    const prepare = async () => {
      try {
        // Simuler la préparation de l'application
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };

    prepare();
  }, []);

  // Afficher un splash screen pendant le chargement
  if (!isReady || isLoading) {
    return (
      <>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="splash"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
        <PWAComponents />
      </>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Si non authentifié, rediriger vers login */}
        {!isAuthenticated && (
          <Stack.Screen
            name="(auth)/login"
            options={{
              headerShown: false,
            }}
          />
        )}

        {/* Si authentifié, rediriger vers le dashboard approprié */}
        {isAuthenticated && (
          <Stack.Screen
            name="(protected)/index"
            options={{
              headerShown: false,
            }}
          />
        )}
      </Stack>
      <PWAComponents />
    </>
  );
}

/**
 * Layout racine de l'application mobile
 *
 * Ce layout :
 * - Wrap l'application avec QueryProvider et AuthProvider
 * - Utilise useAuth() pour vérifier l'authentification
 * - Affiche un splash screen pendant le chargement
 * - Rediriger vers /login si non authentifié
 * - Rediriger vers le dashboard approprié si authentifié
 */
export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </QueryProvider>
  );
}
