'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@novaconnect/data/providers';
import { useAcademicYears, useCreatePayrollPeriod } from '@novaconnect/data';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreatePayrollPeriodPage() {
  const router = useRouter();
  const { user, profile } = useAuthContext();

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    (user?.user_metadata as any)?.schoolId ||
    (user?.user_metadata as any)?.school_id ||
    (user as any)?.schoolId ||
    (user as any)?.school_id ||
    '';

  const createMutation = useCreatePayrollPeriod(schoolId);

  const { data: academicYearsRaw, isLoading: yearsLoading } = useAcademicYears(schoolId);
  const academicYears: any[] = Array.isArray(academicYearsRaw) ? academicYearsRaw : [];

  // Pré-sélectionner l'année courante
  const defaultYearId = useMemo(() => {
    const current = academicYears.find((y: any) => y.isCurrent || y.is_current || y.current);
    return current?.id || (academicYears.length > 0 ? academicYears[0].id : '') || '';
  }, [academicYears]);

  const [formData, setFormData] = useState({
    periodName: '',
    startDate: '',
    endDate: '',
    academicYearId: '',
  });

  const activeYearId = formData.academicYearId || defaultYearId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolId) {
      alert('Impossible de déterminer l\'école. Veuillez vous reconnecter.');
      return;
    }

    if (!activeYearId) {
      alert('Veuillez sélectionner une année académique.');
      return;
    }

    if (formData.endDate && formData.startDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      alert('La date de fin doit être après la date de début.');
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        periodName: formData.periodName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        academicYearId: activeYearId,
      });
      router.push(`/accountant/payroll/${result.id}`);
    } catch (error: any) {
      // Les erreurs Supabase sont des objets plain (pas des Error JS standard)
      const message =
        error?.message ||
        error?.details ||
        error?.hint ||
        (typeof error === 'string' ? error : JSON.stringify(error));
      console.error('Error creating period:', message, error);
      alert(`Erreur lors de la création de la période :\n${message || 'Erreur inconnue'}`);
    }
  };


  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accountant/payroll">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouvelle Période de Paie</h1>
          <p className="mt-2 text-muted-foreground">
            Créez une nouvelle période de paie pour calculer les rémunérations des enseignants.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la période</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Nom de la période */}
            <div className="space-y-2">
              <Label htmlFor="periodName">Nom de la période *</Label>
              <Input
                id="periodName"
                placeholder="Ex: Janvier 2026"
                value={formData.periodName}
                onChange={(e) => setFormData({ ...formData, periodName: e.target.value })}
                required
              />
              <p className="text-sm text-muted-foreground">
                Nom affiché dans la liste des périodes de paie.
              </p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Date de fin *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Année académique — SearchableSelect */}
            <div className="space-y-2">
              <Label htmlFor="academicYearId">Année académique *</Label>
              <SearchableSelect
                options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
                value={activeYearId}
                onValueChange={(v) => setFormData({ ...formData, academicYearId: v })}
                placeholder={yearsLoading ? 'Chargement...' : 'Sélectionner une année'}
                searchPlaceholder="Rechercher une année..."
              />
              <p className="text-sm text-muted-foreground">
                Année scolaire à laquelle cette période est rattachée.
              </p>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || !activeYearId}
                className="flex-1"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer la période'
                )}
              </Button>
              <Link href="/accountant/payroll" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Annuler
                </Button>
              </Link>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
