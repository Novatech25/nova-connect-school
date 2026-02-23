import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

/**
 * Props du composant AuthContainer
 */
export interface AuthContainerProps {
  /**
   * Enfants (contenu de la page d'auth)
   */
  children: React.ReactNode;

  /**
   * Classes additionnelles (non utilisé en React Native)
   */
  className?: string;

  /**
   * Style additionnel
   */
  style?: any;
}

/**
 * AuthContainer - Container pour les écrans d'authentification mobile
 *
 * Ce composant :
 * - Utilise SafeAreaView et KeyboardAvoidingView
 * - Affiche le logo NovaConnectSchool en haut
 * - Wrap le contenu dans un ScrollView
 * - Gère le padding et le spacing
 *
 * @example
 * ```tsx
 * <AuthContainer>
 *   <LoginForm />
 * </AuthContainer>
 * ```
 */
export function AuthContainer({ children, style }: AuthContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo NovaConnectSchool */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <View style={styles.logoTextContainer}>
                <View style={styles.logoLetter}>N</View>
              </View>
            </View>
          </View>

          {/* Contenu */}
          <View style={[styles.content, style]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
});

export default AuthContainer;
