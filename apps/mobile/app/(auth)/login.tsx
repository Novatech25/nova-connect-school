import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@novaconnect/core';
import { useAuthContext } from '@novaconnect/data';
import { MobileInput, MobileButton } from '@novaconnect/ui/mobile';
import type { z } from 'zod';

/**
 * Page de connexion mobile
 *
 * Cette page :
 * - Utilise React Hook Form avec validation Zod
 * - Affiche les champs : email, password, remember me (switch)
 * - Utilise MobileInput et MobileButton de @novaconnect/ui/mobile
 * - Appelle signIn mutation
 * - Affiche les erreurs avec Alert ou toast
 * - Redirige vers le dashboard après succès
 * - Affiche des liens vers register et forgot-password
 * - Gère le keyboard avec KeyboardAvoidingView
 */
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuthContext();

  // États
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Configuration du formulaire
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  /**
   * Handler de soumission du formulaire
   */
  const onSubmit = async (data: LoginFormData) => {
    setGlobalError(null);

    try {
      // Appeler la mutation signIn
      const result = await signIn(data.email, data.password);

      if (result.error) {
        // Afficher l'erreur
        Alert.alert('Erreur de connexion', result.error.message || 'Identifiants invalides');
        return;
      }

      // Succès - rediriger vers le dashboard mobile approprié
      if (result.user) {
        // Tous les rôles redirigent vers le même stack protégé
        // Le layout (protected) gérera les tabs selon le rôle
        router.replace('/(protected)');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de la connexion');
    }
  };

  return (
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
            <Text style={styles.logoText}>NC</Text>
          </View>
          <Text style={styles.title}>NovaConnectSchool</Text>
          <Text style={styles.subtitle}>Plateforme de gestion scolaire</Text>
        </View>

        {/* Formulaire de connexion */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Connexion</Text>
          <Text style={styles.formSubtitle}>Connectez-vous pour accéder à votre espace</Text>

          {/* Champ Email */}
          <MobileInput
            control={control}
            name="email"
            label="Email"
            placeholder="vous@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email?.message}
          />

          {/* Champ Password */}
          <MobileInput
            control={control}
            name="password"
            label="Mot de passe"
            placeholder="••••••••"
            secureTextEntry
            error={errors.password?.message}
          />

          {/* Remember me */}
          <View style={styles.rememberContainer}>
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
          </View>

          {/* Bouton de connexion */}
          <MobileButton
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </MobileButton>

          {/* Liens */}
          <View style={styles.linksContainer}>
            <Text style={styles.linkText}>Pas encore de compte ?</Text>
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/register')}
            >
              Créer un compte
            </Text>
          </View>

          <View style={styles.linksContainer}>
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              Mot de passe oublié ?
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  rememberText: {
    fontSize: 14,
    color: '#374151',
  },
  submitButton: {
    marginTop: 8,
  },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#6b7280',
  },
  link: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginLeft: 4,
  },
});
