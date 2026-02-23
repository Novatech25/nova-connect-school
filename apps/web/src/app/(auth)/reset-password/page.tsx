'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@novaconnect/data';
import { Button, Input } from '@novaconnect/ui/web';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setGlobalError('Lien de reinitialisation invalide ou expire.');
      }
    };

    checkSession();
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setGlobalError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        setGlobalError(error.message || 'Une erreur est survenue');
        return;
      }

      setIsSuccess(true);

      setTimeout(() => {
        router.push('/login');
      }, 3000);
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
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Reinitialiser</h2>
        <p className="mt-2 text-sm text-slate-600">
          Choisissez un nouveau mot de passe pour acceder a votre compte.
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
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
              Nouveau mot de passe
            </label>
            <div className="mt-2">
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="********"
                error={errors.newPassword?.message}
                {...register('newPassword')}
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

          <Button type="submit" fullWidth disabled={isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
            {isLoading ? 'Reinitialisation...' : 'Mettre a jour le mot de passe'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p className="font-semibold">Mot de passe mis a jour</p>
            <p className="mt-1">
              Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Redirection vers la page de connexion en cours...
          </p>
        </div>
      )}
    </div>
  );
}
