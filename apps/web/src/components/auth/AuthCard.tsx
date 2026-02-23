import React from 'react';
import { Card } from '@novaconnect/ui/web';

/**
 * Props du composant AuthCard
 */
export interface AuthCardProps {
  /**
   * Titre de la card
   */
  title?: string;

  /**
   * Description de la card
   */
  description?: string;

  /**
   * Enfants (contenu de la card)
   */
  children: React.ReactNode;

  /**
   * Classes additionnelles
   */
  className?: string;

  /**
   * Afficher ou non le footer
   */
  showFooter?: boolean;

  /**
   * Contenu du footer
   */
  footer?: React.ReactNode;
}

/**
 * AuthCard - Composant Card pour les formulaires d'authentification
 *
 * Ce composant :
 * - Affiche le logo NovaConnectSchool en haut
 * - Wrap le contenu dans une card avec shadow et border-radius
 * - Affiche un titre et une description optionnelle
 * - Affiche un footer optionnel
 *
 * @example
 * ```tsx
 * <AuthCard
 *   title="Connexion"
 *   description="Connectez-vous pour accéder à votre espace"
 * >
 *   <LoginForm />
 * </AuthCard>
 * ```
 */
export function AuthCard({
  title,
  description,
  children,
  className,
  showFooter = false,
  footer,
}: AuthCardProps) {
  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {/* Logo NovaConnectSchool */}
      <div className="text-center mb-6">
        <div className="mx-auto h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>

      {/* Titre et description */}
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h3 className="text-2xl font-bold text-gray-900 text-center">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-2 text-sm text-gray-600 text-center">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Contenu */}
      <div className={className}>
        {children}
      </div>

      {/* Footer */}
      {showFooter && footer && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          {footer}
        </div>
      )}

      {/* Footer par défaut */}
      {showFooter && !footer && (
        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>© 2025 NovaConnectSchool. Tous droits réservés.</p>
        </div>
      )}
    </div>
  );
}

export default AuthCard;
