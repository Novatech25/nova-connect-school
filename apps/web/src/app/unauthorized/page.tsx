'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@novaconnect/data';

/**
 * Page Unauthorized - Accès refusé
 *
 * Cette page :
 * - Affiche un message "Accès refusé"
 * - Explique que l'utilisateur n'a pas les permissions nécessaires
 * - Affiche un bouton pour retourner au dashboard
 * - Affiche un bouton pour se déconnecter
 */
export default function UnauthorizedPage() {
  const router = useRouter();
  const { signOut, role } = useAuthContext();

  /**
   * Handler de déconnexion
   */
  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  /**
   * Retourner au dashboard approprié
   */
  const getDashboardPath = () => {
    switch (role) {
      case 'super_admin':
        return '/super-admin';
      case 'school_admin':
        return '/admin';
      case 'accountant':
        return '/accountant';
      case 'teacher':
        return '/teacher';
      case 'student':
        return '/student';
      case 'parent':
        return '/parent';
      default:
        return '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Icône d'erreur */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Message d'erreur */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Accès refusé
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur de votre école.
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="space-y-4">
          <Link
            href={getDashboardPath()}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Retourner au tableau de bord
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Se déconnecter
          </button>
        </div>

        {/* Informations supplémentaires */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Besoin d'aide ?
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Chaque rôle a accès à des fonctionnalités spécifiques. Si vous avez besoin d'accéder à cette page, demandez à votre administrateur de modifier vos permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
