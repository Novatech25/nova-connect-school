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
    <div className={`relative min-h-screen bg-slate-50 overflow-hidden ${spaceGrotesk.className}`}>
      {/* Background Decorators - Same as Landing Page */}
      <div className="pointer-events-none absolute -left-[10%] top-[-10%] h-[800px] w-[800px] rounded-full bg-gradient-to-br from-blue-300/40 to-indigo-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-[5%] top-[20%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-emerald-200/40 to-teal-100/10 blur-3xl opacity-80" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-20%] h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-slate-200/50 blur-3xl opacity-60" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 min-h-screen pt-12 md:pt-20">
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          {/* Section Information (Gauche) */}
          <section className="flex flex-col justify-center gap-10 rounded-[2.5rem] border border-slate-200/60 bg-white/40 p-10 shadow-2xl backdrop-blur-xl h-full min-h-[600px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/20 z-0" />
            
            <div className="relative z-10">
              <Link href="/" className="inline-flex items-center gap-3 text-lg font-bold tracking-tight text-slate-900 group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                  <LineChart className="h-6 w-6" aria-hidden="true" />
                </span>
                NovaConnect
              </Link>

              <h1 className={`${fraunces.className} mt-10 text-4xl text-slate-900 sm:text-5xl leading-tight tracking-tight`}>
                Connectez votre équipe au cœur de l'école.
              </h1>
              <p className="mt-4 text-lg text-slate-600 max-w-lg leading-relaxed">
                Une expérience fluide pour garder le contrôle sur les opérations,
                la présence et les finances en un seul endroit stratégique.
              </p>
            </div>

            <div className="relative z-10 grid gap-4 sm:grid-cols-2 mt-4">
              {highlights.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-transform hover:-translate-y-1">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${i === 0 ? 'bg-blue-100 text-blue-600' : i === 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="text-base font-bold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10 grid gap-3 sm:grid-cols-3 mt-4 border-t border-slate-200/60 pt-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{stat.label}</p>
                  <p className={`${fraunces.className} text-3xl text-slate-900`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section Formulaire (Droite) */}
          <section className="relative w-full max-w-lg mx-auto rounded-[2rem] border border-slate-200/80 bg-white p-10 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)] sm:p-14">
            {children}
          </section>
        </div>

        <p className="text-center text-sm font-medium text-slate-500 mt-4">
          © {new Date().getFullYear()} NovaConnect. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
