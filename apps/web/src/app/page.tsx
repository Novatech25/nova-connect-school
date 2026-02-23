import Link from 'next/link';
import { Space_Grotesk, Fraunces } from 'next/font/google';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Cloud,
  ClipboardList,
  CreditCard,
  Laptop,
  LineChart,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Users,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
});

const highlights = [
  {
    title: 'Planning intelligent',
    description: 'Emplois du temps, contraintes et publication instantanee.',
    icon: CalendarDays,
  },
  {
    title: 'Presence certifiee',
    description: 'QR codes, controle GPS et suivi des anomalies.',
    icon: ShieldCheck,
  },
  {
    title: 'Finance fluide',
    description: 'Facturation, mobile money et rapports a jour.',
    icon: CreditCard,
  },
];

const platform = [
  {
    title: 'Web',
    description: 'Interface admin complete pour piloter l etablissement.',
    icon: Laptop,
  },
  {
    title: 'Mobile',
    description: 'App eleves, parents et enseignants, meme hors ligne.',
    icon: Smartphone,
  },
  {
    title: 'Cloud',
    description: 'Securite RLS, sauvegardes et mise a jour continue.',
    icon: Cloud,
  },
];

const proofPoints = [
  'Multi-campus et roles precis',
  'Exports et archivage conformes',
  'Alertes temps reel et audit',
];

const stats = [
  {
    label: 'Ecoles pilotees',
    value: '120+',
    icon: BadgeCheck,
  },
  {
    label: 'Operations/jour',
    value: '38k',
    icon: Timer,
  },
  {
    label: 'Satisfaction',
    value: '4.9/5',
    icon: Orbit,
  },
];

const workflow = [
  {
    title: 'Configurer en 24h',
    description: 'Import des classes, enseignants, emplois du temps et regles de presence.',
    icon: ClipboardList,
  },
  {
    title: 'Orchestrer les flux',
    description: 'Alertes, validation, paiements et controles pour chaque role.',
    icon: Workflow,
  },
  {
    title: 'Securiser et auditer',
    description: 'RLS, logs et historisation pour garantir la conformite.',
    icon: LockKeyhole,
  },
];

export default function HomePage() {
  const fadeUp = (delayMs: number) => ({
    animation: 'fade-up 700ms ease-out both',
    animationDelay: `${delayMs}ms`,
  });

  return (
    <main className={`relative min-h-screen bg-gradient-to-br from-white via-slate-50 to-sky-50 ${spaceGrotesk.className}`}>
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-10 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-16 sm:pt-20">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6" style={fadeUp(0)}>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
              Plateforme scolaire
            </div>

            <div className="space-y-4">
              <h1 className={`${fraunces.className} text-4xl text-slate-900 sm:text-5xl`}>
                NovaConnectSchool, le cockpit complet pour une ecole alignee.
              </h1>
              <p className="max-w-xl text-base text-slate-600">
                Un seul espace pour planifier, suivre et financer la vie scolaire.
                Gardez la main sur les operations quotidiennes avec une vision claire,
                des donnees fiables et une execution rapide.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
                <Link href="/login">Acceder au tableau de bord</Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
                <Link href="/register">Creer un compte</Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Workflows automatises
              </div>
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Analytique temps reel
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Multitenant securise
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm"
                    style={fadeUp(150 + index * 100)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</span>
                      <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{stat.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative" style={fadeUp(200)}>
            <div className="absolute -top-6 left-6 h-16 w-16 rounded-2xl bg-slate-900 text-white shadow-lg">
              <div className="flex h-full items-center justify-center">
                <Sparkles className="h-7 w-7" aria-hidden="true" />
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[0_25px_60px_-45px_rgba(15,23,42,0.4)] backdrop-blur">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Operations du jour</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Stable
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-sky-500" aria-hidden="true" />
                    <span className="text-sm text-slate-700">{point}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Presence</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">96% validee</p>
                  <p className="text-xs text-slate-500">3 alertes en attente</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">18 paiements</p>
                  <p className="text-xs text-slate-500">2 a reconciler</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <div>
                  <p className="text-xs text-slate-300">Dernier export</p>
                  <p className="text-sm font-semibold">Rapport mensuel</p>
                </div>
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className={`${fraunces.className} text-3xl text-slate-900`}>
                Une experience fluide sur tous les ecrans.
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-600">
                NovaConnectSchool s adapte a chaque role. Admin, enseignants, parents et eleves
                disposent de vues claires et d actions rapides, meme en deplacement.
              </p>
            </div>
            <Button asChild variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
              <Link href="/login">Explorer la plateforme</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {platform.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.7fr,1.3fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-7 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Processus</p>
            <h3 className={`${fraunces.className} mt-3 text-3xl text-slate-900`}>
              Une cadence claire pour chaque equipe.
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              Des flux harmonises du matin au soir. Chaque role voit ce qui compte
              et agit en quelques clics.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Temps moyen de prise en main</span>
                <span className="font-semibold text-slate-900">2h</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-white">
                <div className="h-2 w-2/3 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Pret a demarrer</p>
              <h2 className={`${fraunces.className} mt-3 text-3xl`}>Pilotez votre ecole cette semaine.</h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-200">
                Accelerez la coordination, reduisez les frictions et gardez une trace claire
                de chaque action critique.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
                <Link href="/register">Demarrer maintenant</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-slate-600 text-slate-100 hover:border-slate-400 hover:bg-slate-800"
              >
                <Link href="/login">Voir une demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

    </main>
  );
}
