import Link from 'next/link';
import { ReactNode } from 'react';
import { Space_Grotesk, Fraunces } from 'next/font/google';
import { LineChart, ShieldCheck, Sparkles, Users } from 'lucide-react';

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
    title: 'Pilotage unifie',
    description: 'Suivi des classes, presences, finances et rapports en temps reel.',
    icon: Sparkles,
  },
  {
    title: 'Securite native',
    description: 'RLS, audit et controle d acces pour chaque role.',
    icon: ShieldCheck,
  },
  {
    title: 'Adoption rapide',
    description: 'Interfaces claires pour admins, enseignants et parents.',
    icon: Users,
  },
];

const stats = [
  {
    label: 'Temps de mise en route',
    value: '2 jours',
  },
  {
    label: 'Automatisation',
    value: '80%',
  },
  {
    label: 'Satisfaction',
    value: '4.9/5',
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`relative min-h-screen bg-gradient-to-br from-white via-slate-50 to-sky-50 ${spaceGrotesk.className}`}>
      <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-12 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr,0.95fr]">
          <section className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-[0_25px_60px_-50px_rgba(15,23,42,0.35)]">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <LineChart className="h-6 w-6" aria-hidden="true" />
                </span>
                NovaConnectSchool
              </Link>

              <h1 className={`${fraunces.className} mt-6 text-3xl text-slate-900 sm:text-4xl`}>
                Connectez votre equipe au coeur de l ecole.
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Une experience fluide pour garder le controle sur les operations,
                la presence et les finances en un seul endroit.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.4)] sm:p-8">
            {children}
          </section>
        </div>

        <p className="text-center text-xs text-slate-500">
          © 2025 NovaConnectSchool. Tous droits reserves.
        </p>
      </div>
    </div>
  );
}
