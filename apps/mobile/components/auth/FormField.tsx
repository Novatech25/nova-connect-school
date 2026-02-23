import React from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { MobileInput } from '@novaconnect/ui/mobile';

/**
 * Props du composant FormField
 */
export interface FormFieldProps<T extends FieldValues> {
  /**
   * Control de react-hook-form
   */
  control: Control<T>;

  /**
   * Nom du champ
   */
  name: Path<T>;

  /**
   * Label du champ
   */
  label?: string;

  /**
   * Placeholder
   */
  placeholder?: string;

  /**
   * Message d'erreur de validation
   */
  error?: string;

  /**
   * Props additionnelles pour TextInput
   */
  inputProps?: TextInput['props'];
}

/**
 * FormField - Composant réutilisable pour les champs de formulaire mobile
 *
 * Ce composant :
 * - Wrap MobileInput de @novaconnect/ui/mobile
 * - Affiche le label, l'input, et le message d'erreur
 * - S'intègre avec React Hook Form via Controller
 *
 * @example
 * ```tsx
 * <FormField<LoginFormData>
 *   control={control}
 *   name="email"
 *   label="Email"
 *   placeholder="vous@exemple.com"
 *   error={errors.email?.message}
 * />
 * ```
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  error,
  inputProps,
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <View style={styles.container}>
          {label && <Text style={styles.label}>{label}</Text>}
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            {...inputProps}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#374151',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
});

export default FormField;
