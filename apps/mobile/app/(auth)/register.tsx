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
import { registerSchema, UserRole } from '@novaconnect/core';
import { useAuthContext } from '@novaconnect/data';
import { MobileInput, MobileButton } from '@novaconnect/ui/mobile';
import type { z } from 'zod';

/**
 * Page d'inscription mobile
 *
 * Cette page :
 * - Utilise React Hook Form avec validation Zod
 * - Affiche les champs : email, password, confirmPassword, firstName, lastName, role (picker), schoolCode
 * - Utilise Picker de React Native pour le rôle
 * - Appelle signUp mutation
 * - Affiche un message de succès et redirige vers login
 * - Gère les erreurs avec Alert
 */
type RegisterFormData = z.infer<typeof registerSchema>;

// Liste des rôles disponibles pour l'inscription (super_admin est réservé)
const AVAILABLE_ROLES: UserRole[] = [
  'school_admin',
  'accountant',
  'teacher',
  'student',
  'parent',
  'supervisor',
];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Administrateur d\'école',
  accountant: 'Comptable',
  teacher: 'Enseignant',
  student: 'Élève',
  parent: 'Parent',
  supervisor: 'Surveillant',
};

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuthContext();

  // États
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Configuration du formulaire
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: 'student',
      schoolCode: '',
    },
  });

  const selectedRole = watch('role');

  /**
   * Handler de soumission du formulaire
   */
  const onSubmit = async (data: RegisterFormData) => {
    setGlobalError(null);

    try {
      // Appeler la mutation signUp
      const result = await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        schoolCode: data.schoolCode,
      });

      if (result.error) {
        // Afficher l'erreur
        Alert.alert('Erreur d\'inscription', result.error.message || 'Une erreur est survenue');
        return;
      }

      // Succès - afficher alerte et rediriger
      Alert.alert(
        'Inscription réussie !',
        'Un email de confirmation a été envoyé. Vérifiez votre boîte de réception.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'inscription');
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
          <Text style={styles.subtitle}>Créer un compte</Text>
        </View>

        {/* Formulaire d'inscription */}
        <View style={styles.formContainer}>
          {/* Champs Nom */}
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <MobileInput
                control={control}
                name="firstName"
                label="Prénom"
                placeholder="Jean"
                error={errors.firstName?.message}
              />
            </View>

            <View style={styles.halfWidth}>
              <MobileInput
                control={control}
                name="lastName"
                label="Nom"
                placeholder="Dupont"
                error={errors.lastName?.message}
              />
            </View>
          </View>

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

          {/* Champs Mot de passe */}
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <MobileInput
                control={control}
                name="password"
                label="Mot de passe"
                placeholder="••••••••"
                secureTextEntry
                error={errors.password?.message}
              />
            </View>

            <View style={styles.halfWidth}>
              <MobileInput
                control={control}
                name="confirmPassword"
                label="Confirmer"
                placeholder="••••••••"
                secureTextEntry
                error={errors.confirmPassword?.message}
              />
            </View>
          </View>

          {/* Champ Rôle */}
          <Text style={styles.label}>Rôle</Text>
          <View style={styles.pickerContainer}>
            {AVAILABLE_ROLES.map((role) => (
              <Text
                key={role}
                style={[
                  styles.pickerItem,
                  selectedRole === role && styles.pickerItemActive,
                ]}
                onPress={() => {
                  // Mettre à jour la valeur du rôle avec react-hook-form
                  setValue('role', role);
                }}
              >
                {ROLE_LABELS[role]}
              </Text>
            ))}
          </View>

          {/* Champ Code école */}
          <MobileInput
            control={control}
            name="schoolCode"
            label="Code de l'école"
            placeholder="ABC123"
            autoCapitalize="characters"
            error={errors.schoolCode?.message}
          />

          {/* Bouton d'inscription */}
          <MobileButton
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={styles.submitButton}
          >
            {isLoading ? 'Création en cours...' : 'Créer mon compte'}
          </MobileButton>

          {/* Liens */}
          <View style={styles.linksContainer}>
            <Text style={styles.linkText}>Vous avez déjà un compte ?</Text>
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
    marginBottom: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    marginBottom: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  pickerItemActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff',
  },
  submitButton: {
    marginTop: 16,
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
