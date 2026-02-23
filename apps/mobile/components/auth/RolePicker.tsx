import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { UserRole } from '@novaconnect/core';

/**
 * Props du composant RolePicker
 */
export interface RolePickerProps<T extends FieldValues> {
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
   * Message d'erreur de validation
   */
  error?: string;

  /**
   * Rôles disponibles (par défaut tous sauf super_admin)
   */
  availableRoles?: UserRole[];
}

/**
 * Description des rôles disponibles
 */
const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Administrateur global de NovaConnectSchool',
  school_admin: 'Gérer l\'école, les utilisateurs et les paramètres',
  accountant: 'Gérer les finances, les paiements et les salaires',
  teacher: 'Gérer les classes, les notes et les présences',
  student: 'Accéder à l\'EDT, aux notes et aux devoirs',
  parent: 'Suivre les enfants, les notes et les présences',
  supervisor: 'Surveiller les élèves et gérer les absences',
};

/**
 * Labels des rôles en français
 */
const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Administrateur d\'école',
  accountant: 'Comptable',
  teacher: 'Enseignant',
  student: 'Élève',
  parent: 'Parent',
  supervisor: 'Surveillant',
};

/**
 * RolePicker - Picker pour choisir le rôle lors de l'inscription mobile
 *
 * Ce composant :
 * - Affiche les rôles disponibles sous forme de tags sélectionnables
 * - Exclut super_admin de la liste (réservé)
 * - Affiche une description pour chaque rôle
 * - S'intègre avec React Hook Form
 *
 * @example
 * ```tsx
 * <RolePicker<RegisterFormData>
 *   control={control}
 *   name="role"
 *   label="Rôle"
 *   error={errors.role?.message}
 * />
 * ```
 */
export function RolePicker<T extends FieldValues>({
  control,
  name,
  label,
  error,
  availableRoles = ['school_admin', 'accountant', 'teacher', 'student', 'parent', 'supervisor'],
}: RolePickerProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View style={styles.container}>
          {label && <Text style={styles.label}>{label}</Text>}

          <View style={styles.pickerContainer}>
            {availableRoles.map((role) => {
              const isSelected = value === role;

              return (
                <Pressable
                  key={role}
                  style={[
                    styles.pickerItem,
                    isSelected && styles.pickerItemActive,
                  ]}
                  onPress={() => onChange(role)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      isSelected && styles.pickerItemTextActive,
                    ]}
                  >
                    {ROLE_LABELS[role]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Description du rôle sélectionné */}
          {value && ROLE_DESCRIPTIONS[value] && (
            <Text style={styles.description}>
              {ROLE_DESCRIPTIONS[value]}
            </Text>
          )}

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
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
    backgroundColor: '#ffffff',
  },
  pickerItemActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  pickerItemText: {
    fontSize: 12,
    color: '#6b7280',
  },
  pickerItemTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
});

export default RolePicker;
