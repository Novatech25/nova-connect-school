import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthContext, useUnreadNotificationsCount } from '@novaconnect/data';
import { Tabs } from 'expo-router';
import {
  HomeIcon,
  CalendarIcon,
  DocumentTextIcon,
  UserCircleIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

/**
 * Layout pour les écrans protégés mobile
 *
 * Ce layout :
 * - Utilise un Tabs Navigator avec icônes
 * - Vérifie l'authentification et redirige vers /login si nécessaire
 * - Affiche les tabs selon le rôle (useRole)
 * - Définit les écrans : home, schedule, grades, attendance, profile, notifications
 * - Affiche un badge non-lu sur l'onglet notifications
 */
export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, role } = useAuthContext();
  const { user } = useAuthContext();
  const router = useRouter();
  const { data: unreadCount } = useUnreadNotificationsCount(user?.id || '');

  /**
   * Rediriger vers login si non authentifié
   */
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Définir les tabs selon le rôle
  const getTabs = () => {
    // Onglet Notifications commun à tous les rôles
    const notificationsTab = {
      name: 'notifications',
      title: 'Notifications',
      icon: ({ color }: { color: string }) => <BellIcon size={24} color={color} />,
      tabBarBadge: unreadCount && unreadCount > 0 ? unreadCount : undefined,
    };

    // Tabs par défaut pour tous les rôles
    const tabs = [
      {
        name: 'index',
        title: 'Accueil',
        icon: ({ color }: { color: string }) => <HomeIcon size={24} color={color} />,
      },
      {
        name: 'schedule',
        title: 'EDT',
        icon: ({ color }: { color: string }) => <CalendarIcon size={24} color={color} />,
      },
      {
        name: 'grades',
        title: 'Notes',
        icon: ({ color }: { color: string }) => <DocumentTextIcon size={24} color={color} />,
      },
      notificationsTab,
      {
        name: 'profile',
        title: 'Profil',
        icon: ({ color }: { color: string }) => <UserCircleIcon size={24} color={color} />,
      },
    ];

    // Tabs spécifiques selon le rôle
    if (role === 'student' || role === 'parent') {
      return tabs;
    } else if (role === 'teacher') {
      return [
        tabs[0], // index
        tabs[1], // schedule
        {
          name: 'attendance',
          title: 'Présences',
          icon: ({ color }: { color: string }) => <DocumentTextIcon size={24} color={color} />,
        },
        notificationsTab,
        tabs[4], // profile
      ];
    } else if (role === 'accountant') {
      return [
        tabs[0], // index
        {
          name: 'payments',
          title: 'Paiements',
          icon: ({ color }: { color: string }) => <DocumentTextIcon size={24} color={color} />,
        },
        notificationsTab,
        tabs[4], // profile
      ];
    } else if (role === 'school_admin' || role === 'super_admin') {
      return [
        tabs[0], // index
        {
          name: 'users',
          title: 'Utilisateurs',
          icon: ({ color }: { color: string }) => <DocumentTextIcon size={24} color={color} />,
        },
        notificationsTab,
        tabs[4], // profile
      ];
    }

    return tabs;
  };

  const tabs = getTabs();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => tab.icon({ color }),
            tabBarBadge: (tab as any).tabBarBadge,
          }}
        />
      ))}

      {/* Écran des préférences de notifications (pas dans la barre de tabs) */}
      <Tabs.Screen
        name="notification-preferences"
        options={{
          href: null, // Ne pas afficher dans la barre de tabs
        }}
      />
    </Tabs>
  );
}
