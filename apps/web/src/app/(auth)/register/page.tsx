'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@novaconnect/core';
import { useAuthContext } from '@novaconnect/data';
import { Button, Input } from '@novaconnect/ui/web';
import type { z } from 'zod';

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, isLoading } = useAuthContext();

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: 'student',
      schoolCode: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setGlobalError(null);

    try {
      const result = await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        schoolCode: data.schoolCode,
      });

      if (result.error) {
        setGlobalError(result.error.message || 'Une erreur est survenue lors de l inscription');
        return;
      }

      setIsSuccess(true);
    } catch (error: any) {
      setGlobalError(error.message || 'Une erreur est survenue lors de l inscription');
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Confirmation</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">Compte cree</h2>
          <p className="mt-2 text-sm text-slate-600">
            Verifiez votre email pour activer votre compte.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <p className="font-semibold">Inscription terminee</p>
          <p className="mt-1">
            Un email de confirmation a ete envoye. Suivez les instructions pour finaliser votre acces.
          </p>
        </div>

        <Button type="button" fullWidth onClick={() => router.push('/login')} className="bg-slate-900 text-white hover:bg-slate-800">
          Aller a la connexion
        </Button>

        <button
          type="button"
          className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          onClick={() => setIsSuccess(false)}
        >
          Renvoyer le formulaire
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inscription</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Creer un compte</h2>
        <p className="mt-2 text-sm text-slate-600">
          Rejoignez votre etablissement avec vos informations.
        </p>
      </div>

      {globalError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-semibold">Erreur d inscription</p>
          <p className="mt-1">{globalError}</p>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
              Prenom
            </label>
            <div className="mt-2">
              <Input
                id="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="Jean"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
              Nom
            </label>
            <div className="mt-2">
              <Input
                id="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Dupont"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>
          </div>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <div className="mt-2">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="********"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
              Confirmer le mot de passe
            </label>
            <div className="mt-2">
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="********"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-slate-700">
            Role
          </label>
          <div className="mt-2">
            <select
              id="role"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              {...register('role')}
            >
              <option value="student">Eleve</option>
              <option value="parent">Parent</option>
              <option value="teacher">Enseignant</option>
              <option value="accountant">Comptable</option>
              <option value="school_admin">Administrateur d ecole</option>
              <option value="supervisor">Surveillant</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-rose-600">{errors.role.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="schoolCode" className="block text-sm font-medium text-slate-700">
            Code de l ecole
          </label>
          <div className="mt-2">
            <Input
              id="schoolCode"
              type="text"
              autoComplete="organization"
              placeholder="ABC123"
              error={errors.schoolCode?.message}
              {...register('schoolCode')}
            />
            <p className="mt-2 text-xs text-slate-500">
              Code unique fourni par votre administration.
            </p>
          </div>
        </div>

        <Button type="submit" fullWidth disabled={isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
          {isLoading ? 'Creation en cours...' : 'Creer mon compte'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Vous avez deja un compte ?{' '}
          <Link href="/login" className="font-semibold text-slate-900 hover:text-slate-700">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
