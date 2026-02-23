import React from 'react';
import { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@novaconnect/ui/web';

/**
 * Props du composant FormField
 */
export interface FormFieldProps {
  /**
   * ID du champ input
   */
  id: string;

  /**
   * Label du champ
   */
  label: string;

  /**
   * Type de l'input (text, email, password, etc.)
   */
  type?: string;

  /**
   * Placeholder de l'input
   */
  placeholder?: string;

  /**
   * Message d'erreur de validation
   */
  error?: string;

  /**
   * Attributs retournés par react-hook-form register()
   */
  registration?: Partial<UseFormRegisterReturn>;

  /**
   * Props additionnelles pour l'Input
   */
  inputProps?: React.ComponentProps<typeof Input>;

  /**
   * Enfant (ex: select, checkbox, etc.)
   */
  children?: React.ReactNode;
}

/**
 * FormField - Composant réutilisable pour les champs de formulaire
 *
 * Ce composant :
 * - Wrap Input de @novaconnect/ui/web
 * - Affiche le label, l'input, et le message d'erreur
 * - S'intègre avec React Hook Form via register
 * - Gère l'accessibilité avec htmlFor et aria-describedby
 *
 * @example
 * ```tsx
 * <FormField
 *   id="email"
 *   label="Email"
 *   type="email"
 *   placeholder="vous@exemple.com"
 *   error={errors.email?.message}
 *   registration={register('email')}
 * />
 * ```
 */
export function FormField({
  id,
  label,
  type = 'text',
  placeholder,
  error,
  registration,
  inputProps,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="mt-1">
        {children ? (
          <>{children}</>
        ) : (
          <Input
            id={id}
            type={type}
            placeholder={placeholder}
            error={error}
            {...registration}
            {...inputProps}
          />
        )}
      </div>
    </div>
  );
}

export default FormField;
