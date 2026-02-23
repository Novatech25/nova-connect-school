'use client';

import Link from 'next/link';
import { Space_Grotesk, Fraunces } from 'next/font/google';
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  LineChart,
  Loader2,
  MapPin,
  Settings2,
  Sparkles,
  Users,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@novaconnect/data/providers';
import { useAdminDashboardStats } from '@novaconnect/data';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
});

/** Small skeleton placeholder while a value is loading. */
function StatValue({ value, isLoading }: { value: number | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
    );
  }
  return <>{value ?? 0}</>;
}

export default function SchoolAdminDashboard() {
  const { user, profile } = useAuthContext();
  const schoolId = profile?.schoolId || profile?.school_id;

  const { stats, overview, isLoading } = useAdminDashboardStats(schoolId);

  const userName = 
    (profile?.first_name || profile?.last_name) 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : (user?.user_metadata?.firstName || user?.user_metadata?.lastName)
        ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
        : (user?.user_metadata?.first_name || user?.user_metadata?.last_name)
          ? `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim()
          : user?.email || '';
  const displayName = userName || 'Utilisateur';
  const schoolName = profile?.school?.name || 'Mon Ecole';

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 18 ? 'Bonjour' : 'Bonsoir';
  };

  const greeting = getGreeting();

  const statCards = [
    {
      label: 'Eleves actifs',
      value: stats?.activeStudents ?? null,
      note: 'inscrits',
      icon: Users,
      accent: 'from-cyan-500/15 via-transparent to-transparent',
      iconBg: 'bg-cyan-500/15 text-cyan-700',
    },
    {
      label: 'Professeurs',
      value: stats?.teachers ?? null,
      note: 'disponibles',
      icon: GraduationCap,
      accent: 'from-emerald-500/15 via-transparent to-transparent',
      iconBg: 'bg-emerald-500/15 text-emerald-700',
    },
    {
      label: 'Classes ouvertes',
      value: stats?.openClasses ?? null,
      note: 'en cours',
      icon: Building2,
      accent: 'from-indigo-500/15 via-transparent to-transparent',
      iconBg: 'bg-indigo-500/15 text-indigo-700',
    },
    {
      label: 'Paiements a verifier',
      value: stats?.pendingPayments ?? null,
      note: 'mobile money',
      icon: CreditCard,
      accent: 'from-amber-500/20 via-transparent to-transparent',
      iconBg: 'bg-amber-500/20 text-amber-700',
    },
  ];

  const actions = [
    {
      title: 'Presence',
      description: 'Suivi des scans et anomalies',
      href: '/admin/attendance',
      icon: ClipboardList,
      tint: 'from-cyan-500/15 to-transparent',
    },
    {
      title: 'Emploi du temps',
      description: 'Creer ou publier un EDT',
      href: '/admin/schedule',
      icon: CalendarDays,
      tint: 'from-indigo-500/15 to-transparent',
    },
    {
      title: 'Notes et bulletins',
      description: 'Parametrer les periodes',
      href: '/admin/grades',
      icon: LineChart,
      tint: 'from-emerald-500/15 to-transparent',
    },
    {
      title: 'Cartes eleves',
      description: 'Templates et generation',
      href: '/admin/student-cards',
      icon: FileText,
      tint: 'from-fuchsia-500/10 to-transparent',
    },
    {
      title: 'Campuses',
      description: 'Sites, acces et perimetres',
      href: '/admin/campuses',
      icon: MapPin,
      tint: 'from-amber-500/20 to-transparent',
    },
    {
      title: 'Exports',
      description: 'Historique et templates',
      href: '/admin/exports',
      icon: Sparkles,
      tint: 'from-slate-500/15 to-transparent',
    },
  ];

  const focusItems = [
    {
      title: 'Verifier les conflits de presence',
      href: '/admin/attendance/conflicts',
      badge: 'Priorite haute',
      badgeClass: 'bg-rose-500/15 text-rose-700',
    },
    {
      title: 'Mettre a jour les campus actifs',
      href: '/admin/campuses',
      badge: 'Geo',
      badgeClass: 'bg-cyan-500/15 text-cyan-700',
    },
    {
      title: 'Preparer la session examens',
      href: '/admin/exams',
      badge: 'Planif',
      badgeClass: 'bg-amber-500/20 text-amber-700',
    },
    {
      title: 'Verifier les exports programmes',
      href: '/admin/exports/scheduled',
      badge: 'Automatisation',
      badgeClass: 'bg-slate-500/15 text-slate-700',
    },
  ];

  return (
    <div className={`relative ${spaceGrotesk.className} space-y-10`}>
      <div className="pointer-events-none absolute -left-40 -top-24 h-80 w-80 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-52 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-6 py-8 text-slate-900 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.25)] sm:px-10 sm:py-10 animate-in fade-in slide-in-from-bottom-4">
        <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute -left-32 -bottom-24 h-64 w-64 rounded-full bg-amber-200/60 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
              Administration
            </div>
            <div>
              <h1 className={`${fraunces.className} text-4xl leading-tight sm:text-5xl`}>
                {greeting}, {displayName}
              </h1>
              <p className="mt-3 max-w-xl text-base text-slate-600">
                Vue d'ensemble et pilotage pour {schoolName}. Centralisez les actions
                critiques et gardez une vision claire des priorites.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
                <Link href="/admin/schedule">Planifier un EDT</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Link href="/admin/exports">Voir les rapports</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <LineChart className="h-5 w-5" aria-hidden="true" />
              </span>
              Apercu rapide
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Etat des donnees</span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Stable</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Flux exports</span>
                <span className="text-slate-700">
                  <StatValue value={overview?.pendingExports ?? null} isLoading={isLoading} />{' '}
                  en attente
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Alertes presence</span>
                <span className="text-slate-700">
                  <StatValue value={overview?.attendanceConflicts ?? null} isLoading={isLoading} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Etat sync</span>
                <span className="text-slate-700">OK</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-0 transition group-hover:opacity-100`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    <StatValue value={stat.value} isLoading={isLoading} />
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{stat.note}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] backdrop-blur animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`${fraunces.className} text-2xl text-slate-900`}>Actions rapides</h2>
              <p className="mt-2 text-sm text-slate-500">
                Accedez aux modules utilises chaque jour.
              </p>
            </div>
            <Button asChild variant="ghost" className="text-slate-500">
              <Link href="/admin/settings" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Reglages
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.tint} opacity-0 transition group-hover:opacity-100`} />
                  <div className="relative flex items-start gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">{action.title}</h3>
                        <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900" />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{action.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className={`${fraunces.className} text-xl text-slate-900`}>Focus du jour</h3>
              <p className="text-sm text-slate-500">Priorites a traiter rapidement.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {focusItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs ${item.badgeClass}`}>
                    {item.badge}
                  </span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
