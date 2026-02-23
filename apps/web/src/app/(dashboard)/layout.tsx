'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryProvider, AuthProvider, useAuthContext } from '@novaconnect/data/providers';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

/**
 * Layout pour les pages protégées (dashboard)
 *
 * Ce layout :
 * - Wrap l'application avec QueryProvider et AuthProvider
 * - Affiche une sidebar avec navigation selon le rôle
 * - Affiche un header avec avatar, nom de l'utilisateur, et bouton logout
 * - Gère le loading state pendant la vérification de l'authentification
 * - Redirige vers /login si non authentifié (côté client en complément du middleware)
 */
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /**
   * Rediriger vers /login si non authentifié
   * Complément au middleware Next.js pour les navigations côté client
   */
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    document.body.classList.add('dashboard-body');
    return () => {
      document.body.classList.remove('dashboard-body');
    };
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Afficher un spinner pendant le chargement
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Si pas authentifié, ne rien afficher (la redirection va se faire)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Header */}
          <Header
            isMenuOpen={mobileSidebarOpen}
            onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
          />

          {/* Contenu de la page */}
          <main className="flex-1 overflow-y-auto p-6 min-h-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Layout racine pour les routes protégées
 * Wrappe le contenu avec les providers
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <DashboardLayoutContent>
          {children}
        </DashboardLayoutContent>
      </AuthProvider>
    </QueryProvider>
  );
}
