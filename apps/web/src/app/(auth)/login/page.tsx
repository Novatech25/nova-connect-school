'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@novaconnect/core';
import { useAuthContext } from '@novaconnect/data/providers';
import { Button, Input } from '@novaconnect/ui/web';
import { Loader2 } from 'lucide-react';
import type { z } from 'zod';

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isLoading } = useAuthContext();

  const [globalError, setGlobalError] = useState<string | null>(null);
  const redirectTo = searchParams.get('redirect');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setGlobalError(null);
    try {
      const result = await signIn(data.email, data.password);

      if (result.error) {
        setGlobalError(result.error.message || 'Identifiants invalides');
        return;
      }

      if (result.user) {
        const userRole = (result.user.user_metadata?.role ||
                         result.user.app_metadata?.role ||
                         result.user.role) as string;

        if (redirectTo) {
          router.push(redirectTo);
        } else if (userRole === 'super_admin') {
          router.push('/super-admin');
        } else if (userRole === 'school_admin') {
          router.push('/admin');
        } else if (userRole === 'accountant') {
          router.push('/accountant');
        } else if (userRole === 'teacher') {
          router.push('/teacher');
        } else if (userRole === 'student') {
          router.push('/student');
        } else if (userRole === 'parent') {
          router.push('/parent');
        } else {
          router.push('/admin');
        }
      } else {
        setGlobalError('Aucun utilisateur trouvé');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Une erreur est survenue';
      setGlobalError(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Accès Sécurisé</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Bon retour !</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connectez-vous pour accéder à votre espace NovaConnect.
        </p>
      </div>

      {globalError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-semibold">Erreur de connexion</p>
          <p className="mt-1">{globalError}</p>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
          <div className="mt-2">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">Mot de passe</label>
          <div className="mt-2">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              id="remember"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              {...register('remember')}
            />
            Se souvenir de moi
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
            Mot de passe oublie ?
          </Link>
        </div>

        <Button type="submit" fullWidth disabled={isLoading} className="h-11 bg-blue-600 text-base font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed">
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Connexion en cours...
            </span>
          ) : (
            'Se connecter'
          )}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-semibold text-blue-600 transition-colors hover:text-blue-700">
            Créer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse"><div className="h-8 bg-slate-200 rounded" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
