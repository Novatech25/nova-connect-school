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
import { z } from 'zod';
import { supabase } from '@novaconnect/data';
import { MobileInput, MobileButton } from '@novaconnect/ui/mobile';

/**
 * Schéma de validation pour la récupération de mot de passe
 */
const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Page de récupération de mot de passe mobile
 *
 * Cette page :
 * - Affiche un champ email
 * - Appelle supabase.auth.resetPasswordForEmail()
 * - Affiche un message de succès avec Alert
 * - Redirige vers login
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();

  // États
  const [isLoading, setIsLoading] = useState(false);

  // Configuration du formulaire
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  /**
   * Handler de soumission du formulaire
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      // Appeler Supabase pour envoyer l'email de récupération
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: '', // URL de réinitialisation (à configurer)
      });

      if (error) {
        Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        return;
      }

      // Succès
      Alert.alert(
        'Email envoyé !',
        'Un email avec un lien de réinitialisation a été envoyé. Vérifiez votre boîte de réception.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
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
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            Entrez votre email pour recevoir un lien de réinitialisation
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            Récupérer votre mot de passe
          </Text>

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

          {/* Bouton d'envoi */}
          <MobileButton
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
          </MobileButton>

          {/* Liens */}
          <View style={styles.linksContainer}>
            <Text style={styles.linkText}>Vous vous souvenez de votre mot de passe ?</Text>
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/login')}
            >
              Se connecter
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
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
