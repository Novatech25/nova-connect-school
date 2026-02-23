'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@novaconnect/core';
import { useAuthContext } from '@novaconnect/data/providers';
import { Button, Input } from '@novaconnect/ui/web';
import type { z } from 'zod';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
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

    console.log('[LOGIN] Tentative de connexion pour:', data.email);

    try {
      const result = await signIn(data.email, data.password);

      console.log('[LOGIN] Résultat de signIn:', {
        hasError: !!result.error,
        errorMessage: result.error?.message,
        hasUser: !!result.user,
        userId: result.user?.id,
        userEmail: result.user?.email,
        userMetadata: result.user?.user_metadata,
        userRole: result.user?.user_metadata?.role,
      });

      if (result.error) {
        console.error('[LOGIN] Erreur de connexion:', result.error);
        setGlobalError(result.error.message || 'Identifiants invalides');
        return;
      }

      if (result.user) {
        // Try to get role from both user_metadata and app_metadata
        const userRole = (result.user.user_metadata?.role ||
                         result.user.app_metadata?.role ||
                         result.user.role) as string;

        console.log('[LOGIN] Rôle détecté:', userRole);
        console.log('[LOGIN] user_metadata:', result.user.user_metadata);
        console.log('[LOGIN] app_metadata:', result.user.app_metadata);

        if (redirectTo) {
          console.log('[LOGIN] Redirection vers:', redirectTo);
          router.push(redirectTo);
        } else if (userRole === 'super_admin') {
          console.log('[LOGIN] Redirection vers /super-admin');
          router.push('/super-admin');
        } else if (userRole === 'school_admin') {
          console.log('[LOGIN] Redirection vers /admin');
          router.push('/admin');
        } else if (userRole === 'accountant') {
          console.log('[LOGIN] Redirection vers /accountant');
          router.push('/accountant');
        } else if (userRole === 'teacher') {
          console.log('[LOGIN] Redirection vers /teacher');
          router.push('/teacher');
        } else if (userRole === 'student') {
          console.log('[LOGIN] Redirection vers /student');
          router.push('/student');
        } else if (userRole === 'parent') {
          console.log('[LOGIN] Redirection vers /parent');
          router.push('/parent');
        } else {
          console.log('[LOGIN] Rôle non reconnu, redirection vers /admin par défaut');
          router.push('/admin');
        }
      } else {
        console.error('[LOGIN] Aucun utilisateur retourné');
        setGlobalError('Aucun utilisateur trouvé');
      }
    } catch (error: any) {
      console.error('[LOGIN] Exception lors de la connexion:', error);
      setGlobalError(error.message || 'Une erreur est survenue lors de la connexion');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Acces</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Connexion</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connectez-vous pour acceder a votre espace NovaConnectSchool.
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
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
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
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Mot de passe
          </label>
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

        <Button type="submit" fullWidth disabled={isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
          {isLoading ? 'Connexion...' : 'Se connecter'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-semibold text-slate-900 hover:text-slate-700">
            Creer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}
