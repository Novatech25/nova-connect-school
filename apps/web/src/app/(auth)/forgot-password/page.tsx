'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@novaconnect/data';
import { Button, Input } from '@novaconnect/ui/web';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setGlobalError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setGlobalError(error.message || 'Une erreur est survenue');
        return;
      }

      setIsSuccess(true);

      setTimeout(() => {
        router.push('/login');
      }, 5000);
    } catch (error: any) {
      setGlobalError(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mot de passe</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Mot de passe oublie</h2>
        <p className="mt-2 text-sm text-slate-600">
          Saisissez votre email pour recevoir un lien de reinitialisation.
        </p>
      </div>

      {!isSuccess ? (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {globalError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">Erreur</p>
              <p className="mt-1">{globalError}</p>
            </div>
          )}

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

          <Button type="submit" fullWidth disabled={isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
            {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
          </Button>

          <p className="text-center text-sm text-slate-600">
            Vous vous souvenez de votre mot de passe ?{' '}
            <Link href="/login" className="font-semibold text-slate-900 hover:text-slate-700">
              Se connecter
            </Link>
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p className="font-semibold">Email envoye</p>
            <p className="mt-1">
              Un lien de reinitialisation a ete envoye. Verifiez votre boite de reception.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Vous serez redirige vers la page de connexion dans quelques secondes.
          </p>
        </div>
      )}
    </div>
  );
}
