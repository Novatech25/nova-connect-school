'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthContext, useSchool } from '@novaconnect/data';
import type { UserRole } from '@novaconnect/core/types';
import {
  HomeIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  DevicePhoneMobileIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  BellIcon,
  QrCodeIcon,
  MegaphoneIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

type NavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type SidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

const NAVIGATION_BY_ROLE: Record<UserRole, NavSection[]> = {
  super_admin: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/super-admin', icon: HomeIcon },
      ],
    },
    {
      label: 'Platform',
      items: [
        { name: 'Écoles', href: '/super-admin/schools', icon: BuildingOfficeIcon },
        { name: 'Utilisateurs', href: '/super-admin/users', icon: UserGroupIcon },
        { name: 'Mobile Money', href: '/super-admin/mobile-money', icon: DevicePhoneMobileIcon },
        { name: 'Licenses', href: '/super-admin/licenses', icon: ShieldCheckIcon },
      ],
    },
    {
      label: 'Conformité',
      items: [
        { name: 'Audit Logs', href: '/super-admin/audit', icon: ShieldCheckIcon },
        { name: 'Support', href: '/super-admin/support', icon: ExclamationTriangleIcon },
      ],
    },
    {
      label: 'Paramètres',
      items: [
        { name: 'Paramètres', href: '/super-admin/settings', icon: CogIcon },
      ],
    },
  ],
  school_admin: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/admin', icon: HomeIcon },
      ],
    },
    {
      label: 'Gestion des Étudiants',
      items: [
        { name: 'Étudiants', href: '/admin/students', icon: UserGroupIcon },
        { name: 'Cartes étudiantes', href: '/admin/student-cards', icon: DocumentTextIcon },
        { name: 'Documents', href: '/admin/students', icon: DocumentTextIcon },
      ],
    },
    {
      label: 'Académique',
      items: [
        { name: 'Enseignants', href: '/admin/teachers', icon: AcademicCapIcon },
        { name: 'Classes', href: '/admin/classes', icon: UserGroupIcon },
        { name: 'Emploi du temps', href: '/admin/schedule', icon: CalendarIcon },
        { name: 'Notes', href: '/admin/grades', icon: DocumentTextIcon },
        { name: 'Bulletins', href: '/admin/report-cards', icon: DocumentTextIcon },
        { name: 'Promotions', href: '/admin/promotions', icon: ChartBarIcon },
        { name: 'Validation séances', href: '/admin/lesson-logs', icon: ShieldCheckIcon },
      ],
    },
    {
      label: 'Opérations',
      items: [
        { name: 'Finances', href: '/admin/finances', icon: CurrencyDollarIcon },
        { name: 'Documents bloqués', href: '/admin/documents/blocked', icon: ExclamationTriangleIcon },
        { name: 'Imports', href: '/admin/imports', icon: ArrowDownTrayIcon },
        { name: 'Vérification', href: '/admin/verification', icon: ShieldCheckIcon },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Diffusion', href: '/admin/messaging', icon: MegaphoneIcon },
        { name: 'Chat', href: '/admin/chat', icon: ChatBubbleLeftRightIcon },
      ],
    },
    {
      label: 'Paramètres',
      items: [
        { name: 'Paramètres', href: '/admin/settings', icon: CogIcon },
      ],
    },
  ],
  accountant: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/accountant', icon: HomeIcon },
      ],
    },
    {
      label: 'Scolarité',
      items: [
        { name: 'Élèves', href: '/admin/students', icon: UserGroupIcon },
        { name: 'Nouvel élève', href: '/admin/students/new', icon: UserGroupIcon },
      ],
    },
    {
      label: 'Finance',
      items: [
        { name: 'Statistiques', href: '/admin/finances', icon: ChartBarIcon },
        { name: 'Paiements', href: '/accountant/payments', icon: CurrencyDollarIcon },
        { name: 'Mobile Money', href: '/accountant/mobile-money', icon: DevicePhoneMobileIcon },
        { name: 'Salaires', href: '/accountant/salaries', icon: CurrencyDollarIcon },
        { name: 'Rapports', href: '/accountant/reports', icon: ChartBarIcon },
        { name: 'Vérification', href: '/admin/verification', icon: ShieldCheckIcon },
        { name: 'Paramètres paiements', href: '/accountant/payment-settings', icon: CogIcon },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Messages', href: '/accountant/messages', icon: ChatBubbleLeftRightIcon },
        { name: 'Notifications', href: '/accountant/notifications', icon: BellIcon },
        { name: 'Chat', href: '/accountant/chat', icon: ChatBubbleLeftRightIcon },
      ],
    },
  ],
  teacher: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/teacher', icon: HomeIcon },
      ],
    },
    {
      label: 'Teaching',
      items: [
        { name: 'Mes classes', href: '/teacher/classes', icon: UserGroupIcon },
        { name: 'Emploi du temps', href: '/teacher/schedule', icon: CalendarIcon },
        { name: 'Présences', href: '/teacher/attendance', icon: DocumentTextIcon },
        { name: 'Notes', href: '/teacher/grades', icon: DocumentTextIcon },
        { name: 'Cahier de texte', href: '/teacher/homework', icon: DocumentTextIcon },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Messages', href: '/teacher/messages', icon: MegaphoneIcon },
        { name: 'Chat', href: '/teacher/chat', icon: ChatBubbleLeftRightIcon },
        { name: 'Notifications', href: '/teacher/notifications', icon: BellIcon },
      ],
    },
  ],
  student: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/student', icon: HomeIcon },
      ],
    },
    {
      label: 'Scolarité',
      items: [
        { name: 'Scanner QR', href: '/student/scan', icon: QrCodeIcon },
        { name: 'Emploi du temps', href: '/student/schedule', icon: CalendarIcon },
        { name: 'Notes', href: '/student/grades', icon: DocumentTextIcon },
        { name: 'Devoirs', href: '/student/homework', icon: DocumentTextIcon },
        { name: 'Présences', href: '/student/attendance', icon: DocumentTextIcon },
        { name: 'Paiements', href: '/student/payments', icon: CurrencyDollarIcon },
      ],
    },
    {
      label: 'Documents',
      items: [
        { name: 'Mes Documents', href: '/student/documents', icon: DocumentTextIcon },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Messages', href: '/student/messages', icon: MegaphoneIcon },
        { name: 'Chat', href: '/student/chat', icon: ChatBubbleLeftRightIcon },
        { name: 'Notifications', href: '/student/notifications', icon: BellIcon },
      ],
    },
  ],
  parent: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/parent', icon: HomeIcon },
      ],
    },
    {
      label: 'Suivi',
      items: [
        { name: 'Mes enfants', href: '/parent/children', icon: UserGroupIcon },
        { name: 'Notes', href: '/parent/grades', icon: DocumentTextIcon },
        { name: 'Présences', href: '/parent/attendance', icon: DocumentTextIcon },
        { name: 'Paiements', href: '/parent/payments', icon: CurrencyDollarIcon },
        { name: 'Mobile Money', href: '/parent/mobile-money', icon: DevicePhoneMobileIcon },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Chat', href: '/parent/chat', icon: ChatBubbleLeftRightIcon },
        { name: 'Notifications', href: '/parent/notifications', icon: BellIcon },
      ],
    },
  ],
  supervisor: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/supervisor', icon: HomeIcon },
      ],
    },
    {
      label: 'Monitoring',
      items: [
        { name: 'Surveillance', href: '/supervisor/monitoring', icon: ShieldCheckIcon },
        { name: 'Absences', href: '/supervisor/absences', icon: DocumentTextIcon },
        { name: 'Rapports', href: '/supervisor/reports', icon: ChartBarIcon },
      ],
    },
  ],
};

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, user, profile } = useAuthContext();

  const navigation = role ? NAVIGATION_BY_ROLE[role as UserRole] || [] : [];
  
  const schoolId = profile?.schoolId || user?.schoolId;
  const { school } = useSchool(schoolId);
  const schoolName = school?.name || profile?.school?.name || 'Mon École';
  const roleLabel = role ? getRoleDisplayName(role) : 'Utilisateur';

  const firstName = user?.user_metadata?.firstName || '';
  const lastName = user?.user_metadata?.lastName || '';
  const displayName = `${firstName} ${lastName}`.trim() || user?.email || 'Utilisateur';
  const avatarInitial = displayName ? displayName[0].toUpperCase() : 'U';
  const handleMobileClose = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      <aside className="hidden lg:flex lg:w-72 lg:flex-col">
        <div className="relative flex h-full flex-col overflow-hidden border-r border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_60%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom,_rgba(148,163,184,0.3),_transparent_65%)]" />

          <div className="relative z-10 flex h-20 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332 .477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332 .477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332 .477-4.5 1.253" />
                </svg>
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-900">NovaConnectSchool</p>
                <p className="text-xs text-slate-500">{role !== 'super_admin' ? schoolName : 'Console Admin'}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {roleLabel}
            </span>
          </div>

          <nav className="relative z-10 flex-1 space-y-6 overflow-y-auto px-4 pb-6 pt-4" aria-label="Main navigation">
            {navigation.map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                          ? 'bg-sky-100 text-slate-900 shadow-[0_12px_30px_-24px_rgba(14,165,233,0.35)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-sky-500'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`}
                          aria-hidden="true"
                        />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="relative z-10 border-t border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-100 p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-lg font-semibold text-slate-700">
                {avatarInitial}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">{role !== 'super_admin' ? schoolName : 'Super Admin'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={handleMobileClose}
          />
          <div className="relative h-full w-72 shadow-xl">
            <div className="relative flex h-full flex-col overflow-hidden border-r border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_60%)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom,_rgba(148,163,184,0.3),_transparent_65%)]" />

              <div className="relative z-10 flex h-20 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332 .477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332 .477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332 .477-4.5 1.253" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-slate-900">NovaConnectSchool</p>
                    <p className="text-xs text-slate-500">{role !== 'super_admin' ? schoolName : 'Console Admin'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {roleLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleMobileClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    aria-label="Fermer le menu"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <nav className="relative z-10 flex-1 space-y-6 overflow-y-auto px-4 pb-6 pt-4" aria-label="Main navigation">
                {navigation.map((section) => (
                  <div key={section.label} className="space-y-2">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                      {section.label}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={handleMobileClose}
                            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                              ? 'bg-sky-100 text-slate-900 shadow-[0_12px_30px_-24px_rgba(14,165,233,0.35)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-sky-500'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <Icon
                              className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`}
                              aria-hidden="true"
                            />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="relative z-10 border-t border-slate-200 px-5 py-5">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-100 p-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-lg font-semibold text-slate-700">
                    {avatarInitial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500">{role !== 'super_admin' ? schoolName : 'Super Admin'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'school_admin':
      return "Administrateur d'école";
    case 'accountant':
      return 'Comptable';
    case 'teacher':
      return 'Enseignant';
    case 'student':
      return 'Élève';
    case 'parent':
      return 'Parent';
    case 'supervisor':
      return 'Surveillant';
    default:
      return role;
  }
};
