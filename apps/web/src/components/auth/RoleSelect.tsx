import React from 'react';
import { UseFormRegisterReturn } from 'react-hook-form';
import { UserRole } from '@novaconnect/core';

/**
 * Props du composant RoleSelect
 */
export interface RoleSelectProps {
  /**
   * ID du select
   */
  id?: string;

  /**
   * Label du champ
   */
  label?: string;

  /**
   * Message d'erreur de validation
   */
  error?: string;

  /**
   * Attributs retournés par react-hook-form register()
   */
  registration?: Partial<UseFormRegisterReturn>;

  /**
   * Rôle actuellement sélectionné
   */
  value?: UserRole;

  /**
   * Callback lors du changement de rôle
   */
  onChange?: (role: UserRole) => void;

  /**
   * Rôles disponibles (par défaut tous sauf super_admin)
   */
  availableRoles?: UserRole[];

  /**
   * Classes additionnelles
   */
  className?: string;
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
 * RoleSelect - Select pour choisir le rôle lors de l'inscription
 *
 * Ce composant :
 * - Affiche les rôles disponibles (school_admin, accountant, teacher, student, parent, supervisor)
 * - Exclut super_admin de la liste (réservé)
 * - Affiche une description pour chaque rôle
 * - S'intègre avec React Hook Form
 *
 * @example
 * ```tsx
 * <RoleSelect
 *   id="role"
 *   label="Rôle"
 *   error={errors.role?.message}
 *   registration={register('role')}
 *   value={watch('role')}
 *   onChange={(role) => setValue('role', role)}
 * />
 * ```
 */
export function RoleSelect({
  id = 'role',
  label = 'Rôle',
  error,
  registration,
  value,
  onChange,
  availableRoles = ['school_admin', 'accountant', 'teacher', 'student', 'parent', 'supervisor'],
  className,
}: RoleSelectProps) {
  /**
   * Handler de changement de rôle
   */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;

    if (onChange) {
      onChange(role);
    }
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <select
          id={id}
          className={`
            block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm
            ${error ? 'border-red-300' : ''}
          `}
          {...registration}
          value={value}
          onChange={(e) => {
            // Appeler le handler de react-hook-form
            registration?.onChange?.(e);
            // Appeler notre handler personnalisé
            handleChange(e);
          }}
        >
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}

        {/* Description du rôle sélectionné */}
        {value && ROLE_DESCRIPTIONS[value] && (
          <p className="mt-1 text-xs text-gray-500">
            {ROLE_DESCRIPTIONS[value]}
          </p>
        )}
      </div>
    </div>
  );
}

export default RoleSelect;
