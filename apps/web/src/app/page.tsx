import Link from 'next/link';
import { Space_Grotesk, Fraunces } from 'next/font/google';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CreditCard,
  Laptop,
  LineChart,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  Smartphone,
  Timer,
  Users,
  Workflow,
  GraduationCap,
  BookOpen,
  PieChart,
  BellRing,
  QrCode,
  FileBadge
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

// --- Données pour les Fonctionnalités Clés ---
const features = [
  {
    title: 'Planification Intelligente',
    description: 'Créez et ajustez vos emplois du temps avec détection automatique de conflits. Publication instantanée pour tous les acteurs.',
    icon: CalendarDays,
    color: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'Discipline & Présences',
    description: 'Contrôlez les accès via scan de cartes QR. Gestion rigoureuse des retards et absences avec alertes automatisées.',
    icon: ShieldCheck,
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Finances & Facturation',
    description: 'Suivi transparent des paiements de frais scolaires, intégration Mobile Money et blocage automatique en cas d\'impayés.',
    icon: CreditCard,
    color: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Évaluations & Scolarité',
    description: 'Saisie rapide des notes, calcul matriciel des moyennes et génération instantanée de bulletins et procès-verbaux (PV) annuels.',
    icon: BookOpen,
    color: 'bg-indigo-100 text-indigo-700',
  },
];

// --- Données pour les Métriques ---
const stats = [
  { label: 'Campus Gérés', value: '150+', icon: Orbit },
  { label: 'Utilisateurs Actifs', value: '85k', icon: Users },
  { label: 'Documents Générés', value: '2M+', icon: FileBadge },
  { label: 'Taux de Disponibilité', value: '99.9%', icon: Timer },
];

export default function HomePage() {
  const fadeUp = (delayMs: number) => ({
    animation: 'fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) both',
    animationDelay: `${delayMs}ms`,
  });

  return (
    <main className={`relative min-h-screen bg-slate-50 overflow-hidden ${spaceGrotesk.className}`}>
      
      {/* Background Decorators */}
      <div className="pointer-events-none absolute -left-[20%] top-[-10%] h-[800px] w-[800px] rounded-full bg-gradient-to-br from-blue-300/40 to-indigo-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-[10%] top-[20%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-emerald-200/40 to-teal-100/10 blur-3xl opacity-80" />
      <div className="pointer-events-none absolute left-1/2 bottom-[-20%] h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-slate-200/50 blur-3xl opacity-60" />

      {/* Navigation (Simple) */}
      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-6 py-6" style={fadeUp(0)}>
        <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className={`${fraunces.className} text-xl font-bold tracking-tight text-slate-900`}>
              NovaConnect
            </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden text-sm font-medium text-slate-600 transition hover:text-blue-600 sm:block">
            Se connecter
          </Link>
          <Button asChild className="rounded-full bg-slate-900 px-6 font-medium text-white hover:bg-slate-800 shadow-md transition-transform hover:scale-105">
            <Link href="/register">Demander une démo</Link>
          </Button>
        </div>
      </nav>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-24 px-6 pb-24 pt-16 sm:pt-24">
        
        {/* --- 1. HERO SECTION --- */}
        <section className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 backdrop-blur-sm shadow-sm" style={fadeUp(100)}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Le Hub Éducatif Nouvelle Génération
          </div>

          <h1 className={`${fraunces.className} mb-8 text-5xl leading-[1.1] text-slate-900 tracking-tight sm:text-6xl md:text-7xl`} style={fadeUp(200)}>
            Pilotez votre école avec une <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">précision chirurgicale</span>.
          </h1>
          
          <p className="mb-10 max-w-2xl text-lg text-slate-600 sm:text-xl leading-relaxed" style={fadeUp(300)}>
            Plannings, notes, finances et présences réunis dans une seule plateforme intelligente. 
            Éliminez les frictions administratives et connectez enfin l'administration, les enseignants et les parents.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center" style={fadeUp(400)}>
            <Button asChild size="lg" className="rounded-full bg-blue-600 px-8 text-base shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all hover:-translate-y-1">
              <Link href="/register">Essayer NovaConnect <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-300 bg-white/50 px-8 text-base backdrop-blur-sm hover:bg-slate-50 transition-all">
              <Link href="/login">Visiter le Dashboard</Link>
            </Button>
          </div>
        </section>

        {/* --- DASHBOARD MOCKUP PREVIEW --- */}
        <section className="relative mx-auto w-full max-w-5xl" style={fadeUp(600)}>
            <div className="relative rounded-2xl border border-slate-200/50 bg-white/40 p-2 shadow-2xl backdrop-blur-xl sm:p-4">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-b from-slate-200 to-transparent opacity-50 pointer-events-none" />
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-inner">
                    {/* Fake Browser Header */}
                    <div className="flex h-12 items-center gap-2 border-b border-slate-200 bg-white px-4">
                        <div className="flex gap-1.5">
                            <div className="h-3 w-3 rounded-full bg-rose-400" />
                            <div className="h-3 w-3 rounded-full bg-amber-400" />
                            <div className="h-3 w-3 rounded-full bg-emerald-400" />
                        </div>
                        <div className="ml-4 flex-1 rounded-md bg-slate-100 flex items-center justify-center p-1.5 text-xs text-slate-400 font-medium">
                            <LockKeyhole className="h-3 w-3 mr-1 inline" /> school.novaconnect.app/admin
                        </div>
                    </div>
                    {/* Fake App Content Layering */}
                    <div className="flex h-[400px] sm:h-[500px]">
                        {/* Sidebar */}
                        <div className="w-16 sm:w-64 border-r border-slate-200 bg-white hidden sm:block p-4">
                            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-8" />
                            <div className="space-y-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
                                        <div className={`h-4 ${i===0 ? 'w-24 bg-blue-100' : 'w-32 bg-slate-100'} rounded animate-pulse`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Main Content */}
                        <div className="flex-1 p-6 sm:p-8 bg-slate-50 overflow-hidden relative">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
                                    <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
                                </div>
                                <div className="h-10 w-32 bg-blue-600/20 rounded-full animate-pulse" />
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                        <div className="h-4 w-12 bg-slate-200 rounded mb-4" />
                                        <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100 h-64 shadow-sm w-full relative overflow-hidden">
                                <div className="h-4 w-32 bg-slate-200 rounded mb-6" />
                                <div className="space-y-4">
                                    <div className="h-2 w-full bg-slate-100 rounded" />
                                    <div className="h-2 w-5/6 bg-slate-100 rounded" />
                                    <div className="h-2 w-4/6 bg-slate-100 rounded" />
                                </div>
                                {/* Floating Badge Mock */}
                                <div className="absolute right-6 top-6 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100 flex items-center">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Tous les systèmes opérationnels
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* --- 2. STATS SECTION --- */}
        <section className="mx-auto w-full max-w-5xl py-12 border-y border-slate-200/60">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex flex-col items-center text-center" style={fadeUp(100 + i * 50)}>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                      <Icon className="h-6 w-6 text-slate-600" />
                    </div>
                    <div className={`${fraunces.className} text-4xl text-slate-900 mb-2`}>{stat.value}</div>
                    <div className="text-sm font-medium tracking-wide text-slate-500 uppercase">{stat.label}</div>
                  </div>
                );
              })}
            </div>
        </section>

        {/* --- 3. BÉNÉFICES PAR RÔLE --- */}
        <section className="relative rounded-[2.5rem] bg-slate-900 px-6 py-24 sm:px-16" style={fadeUp(200)}>
            {/* Dark decor */}
            <div className="absolute top-0 right-0 -m-32 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[100px]" />
            <div className="absolute bottom-0 left-0 -m-32 h-[400px] w-[400px] rounded-full bg-emerald-600/10 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl text-center mb-16">
                <h2 className={`${fraunces.className} text-3xl sm:text-5xl text-white mb-6`}>
                    Conçu pour <span className="italic font-light text-blue-300">tout le monde</span>.
                </h2>
                <p className="text-slate-300 text-lg">
                    Chaque acteur de votre établissement dispose d'un espace sur-mesure pour agir vite et bien, en parfaite synchronicité avec les autres.
                </p>
            </div>

            <div className="relative z-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Admin Card */}
                <div className="group rounded-3xl bg-slate-800/50 p-6 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Laptop className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">L'Administration</h3>
                    <ul className="space-y-3 text-slate-400 text-sm">
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-blue-400" /> Pilotage des finances et impayés</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-blue-400" /> Génération certifiée des relevés & PV</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-blue-400" /> Conflits d'emplois du temps signalés</li>
                    </ul>
                </div>

                {/* Profs Card */}
                <div className="group rounded-3xl bg-slate-800/50 p-6 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <BookOpen className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Les Enseignants</h3>
                    <ul className="space-y-3 text-slate-400 text-sm">
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-emerald-400" /> Saisie ultra-rapide des notes (grille)</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-emerald-400" /> Appel numérique sur smartphone</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-emerald-400" /> Partage de documents aux classes</li>
                    </ul>
                </div>

                {/* Étudiants Card */}
                <div className="group rounded-3xl bg-slate-800/50 p-6 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        <Smartphone className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Les Étudiants</h3>
                    <ul className="space-y-3 text-slate-400 text-sm">
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-amber-400" /> Emploi temps et salles en temps réel</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-amber-400" /> QR Code unique pour les accès</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-amber-400" /> Téléchargement des bulletins PDF</li>
                    </ul>
                </div>

                {/* Parents Card */}
                <div className="group rounded-3xl bg-slate-800/50 p-6 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                        <Users className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Parents & Comptables</h3>
                    <ul className="space-y-3 text-slate-400 text-sm">
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-purple-400" /> Alertes présences et notes</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-purple-400" /> Historique et solde des paiements</li>
                        <li className="flex items-start"><CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-purple-400" /> Rapprochement Mobile Money</li>
                    </ul>
                </div>
            </div>
        </section>

        {/* --- 4. MODULES DÉTAILLÉS --- */}
        <section>
          <div className="mb-16 text-center" style={fadeUp(100)}>
            <h2 className={`${fraunces.className} text-3xl sm:text-4xl text-slate-900 max-w-2xl mx-auto`}>
              Une infrastructure complète, sans modules superflus.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group flex flex-col sm:flex-row gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:-translate-y-1" style={fadeUp(200 + i * 100)}>
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${feature.color}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="mb-3 text-xl font-bold text-slate-900">{feature.title}</h3>
                    <p className="text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* --- 5. INFRASTRUCTURE & SÉCURITÉ --- */}
        <section className="mx-auto max-w-4xl rounded-3xl border border-emerald-100 bg-emerald-50 p-8 sm:p-12 text-center" style={fadeUp(300)}>
            <Cloud className="h-10 w-10 text-emerald-600 mx-auto mb-6" />
            <h2 className={`${fraunces.className} text-2xl sm:text-3xl text-slate-900 mb-4`}>Construit sur le Cloud, Sécurisé par Design</h2>
            <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                NovaConnect repose sur <strong>Supabase (PostgreSQL)</strong>. Vos données sont isolées avec des règles RLS (Row Level Security) inviolables garantissant que chaque utilisateur ne voit que ce qui lui est strictement autorisé. Sauvegardes continues incluses.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-emerald-500" /> RLS Stricte</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Export JSON/CSV</span>
                <span className="flex items-center gap-2"><Workflow className="h-4 w-4 text-emerald-500" /> Logs d'Audit</span>
            </div>
        </section>

        {/* --- FINAL CTA --- */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-blue-600 px-6 py-20 text-center sm:px-16 sm:py-24" style={fadeUp(400)}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
            
            <BadgeCheck className="h-16 w-16 text-blue-300 mx-auto mb-6" />
            <h2 className={`${fraunces.className} text-3xl sm:text-5xl text-white mb-6 leading-tight`}>
                Prêt à moderniser votre établissement ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-blue-100 mb-10">
                Rejoignez les institutions qui font confiance à NovaConnect pour piloter leur scolarité au quotidien. Contactez notre équipe pour une démonstration personnalisée.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-14 rounded-full bg-white px-10 text-lg font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800 shadow-xl w-full sm:w-auto transition-transform hover:scale-105">
                    <Link href="/register">Demander une démonstration</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 rounded-full border border-blue-400 bg-transparent px-10 text-lg font-medium text-white hover:bg-blue-700 hover:border-blue-300 w-full sm:w-auto transition-all">
                    <Link href="/login">Accès Client</Link>
                </Button>
            </div>
        </section>

      </div>
    </main>
  );
}
