'use client';

import { useRouter } from 'next/navigation';
import { useAuthContext, useSchool } from '@novaconnect/data';
import {
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { NotificationBell } from './NotificationBell';

/**
 * Header - En-tête de l'application
 *
 * Ce composant :
 * - Affiche le logo et le nom de l'école
 * - Affiche un dropdown avec avatar, nom, rôle, et bouton logout
 * - Appelle signOut mutation lors du clic sur logout
 * - Menu mobile responsive
 */
type HeaderProps = {
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
};

export function Header({ isMenuOpen = false, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { signOut, user, role, profile } = useAuthContext();

  /**
   * Handler de déconnexion
   */
  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Nom de l'utilisateur
  const userName = user?.user_metadata
    ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
    : user?.email || 'Utilisateur';
  const avatarInitial = userName ? userName[0].toUpperCase() : 'U';

  // Nom affiché du rôle
  const roleDisplayName = role ? getRoleDisplayName(role) : '';

  // Récupérer le schoolId du profil ou de l'user
  const schoolId = profile?.schoolId || user?.schoolId;
  const { school } = useSchool(schoolId);

  // Nom de l'école (si pas super_admin)
  const schoolName = school?.name || profile?.school?.name || 'Mon École';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et nom de l'école (mobile) */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={onMenuToggle}
            >
              <span className="sr-only">Ouvrir le menu</span>
              {isMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
            <div className="ml-3 flex items-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="ml-2 text-gray-900 font-bold">NovaConnectSchool</span>
            </div>
          </div>

          {/* Logo et nom de l'école (desktop) */}
          <div className="hidden lg:flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              {role !== 'super_admin' ? schoolName : 'NovaConnectSchool Admin'}
            </h1>
          </div>

          {/* Actions à droite */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <NotificationBell />

            {/* Avatar et dropdown */}
            <div className="relative">
              <div className="flex items-center space-x-3">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                  {avatarInitial}
                </div>

                {/* Infos utilisateur (desktop) */}
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">{roleDisplayName}</p>
                </div>
              </div>
            </div>

            {/* Bouton logout (desktop) */}
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden lg:block inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

    </header>
  );
}

export default Header;

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'school_admin':
      return "Administrateur d'ecole";
    case 'accountant':
      return 'Comptable';
    case 'teacher':
      return 'Enseignant';
    case 'student':
      return 'Eleve';
    case 'parent':
      return 'Parent';
    case 'supervisor':
      return 'Surveillant';
    default:
      return role;
  }
};
