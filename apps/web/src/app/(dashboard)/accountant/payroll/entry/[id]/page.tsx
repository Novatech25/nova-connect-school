'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePayrollEntry, useUpdatePayrollEntry, useCreateSalaryComponent, usePayrollPaymentsByEntry, useRecordPayrollPayment } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Save, Plus, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { toast } from 'sonner';

const componentTypeLabels: Record<string, string> = {
  prime: 'Prime',
  retenue: 'Retenue',
  avance: 'Avance',
  bonus: 'Bonus',
  deduction: 'Déduction',
  other: 'Autre',
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Espèces',
  bank_transfer: 'Virement bancaire',
  check: 'Chèque',
  mobile_money: 'Mobile Money',
  card: 'Carte',
};

export default function PayrollEntryDetailPage() {
  const params = useParams();
  const entryId = params.id as string;

  const { data: entry, isLoading, refetch } = usePayrollEntry(entryId);
  const updateMutation = useUpdatePayrollEntry();
  const createComponentMutation = useCreateSalaryComponent(entry?.schoolId || '');
  const { data: payments } = usePayrollPaymentsByEntry(entryId);
  const recordPaymentMutation = useRecordPayrollPayment(entry?.schoolId || '');

  // ── Controlled form state for the Details tab ──
  const [validatedHours, setValidatedHours] = useState<number>(0);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (entry) {
      setValidatedHours(entry.validatedHours ?? 0);
      setHourlyRate(entry.hourlyRate ?? 0);
      setNotes(entry.notes ?? '');
      setIsDirty(false);
    }
  }, [entry]);

  // Live preview of computed amounts
  const baseAmountPreview = validatedHours * hourlyRate;
  const primesAmount = entry?.primesAmount ?? 0;
  const retenesAmount = entry?.retenesAmount ?? (entry as any)?.retenuesAmount ?? 0;
  const avancesAmount = entry?.avancesAmount ?? 0;
  const grossAmountPreview = baseAmountPreview + primesAmount;
  const netAmountPreview = grossAmountPreview - retenesAmount - avancesAmount;

  // ── Adjustment component state ──
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponent, setNewComponent] = useState({
    componentType: 'prime' as const,
    label: '',
    amount: 0,
    description: '',
  });

  // ── Payment state ──
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: 0,
    paymentMethod: 'bank_transfer' as const,
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (entry) {
      setNewPayment((prev) => ({ ...prev, amount: entry.netAmount ?? 0 }));
    }
  }, [entry]);

  const [isUpdating, setIsUpdating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Entrée non trouvée</h2>
        <Link href="/accountant/payroll">
          <Button>Retour à la liste</Button>
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      // Build explicitly only the allowed fields to bypass the cached version of the SDK
      const dbUpdates: Record<string, any> = {};
      if (validatedHours !== undefined) dbUpdates['validated_hours'] = validatedHours;
      if (hourlyRate !== undefined) dbUpdates['hourly_rate'] = hourlyRate;
      if (notes !== undefined) dbUpdates['notes'] = notes;

      const { error } = await getSupabaseClient()
        .from('payroll_entries')
        .update(dbUpdates)
        .eq('id', entryId);

      if (error) throw error;
      
      toast.success('Entrée de paie mise à jour avec succès.');
      setIsDirty(false);
      refetch();
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error(error?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComponent = async () => {
    if (!newComponent.label || !newComponent.amount) {
      toast.error('Veuillez remplir le libellé et le montant.');
      return;
    }

    try {
      await createComponentMutation.mutateAsync({
        payrollEntryId: entryId,
        ...newComponent,
      } as any);
      toast.success('Composant ajouté avec succès.');
      setShowAddComponent(false);
      setNewComponent({ componentType: 'prime', label: '', amount: 0, description: '' });
      refetch();
    } catch (error: any) {
      console.error('Error adding component:', error);
      toast.error(error?.message || "Erreur lors de l'ajout du composant.");
    }
  };

  const handleRecordPayment = async () => {
    if (!newPayment.amount || newPayment.amount <= 0) {
      toast.error('Veuillez saisir un montant valide.');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        payrollEntryId: entryId,
        ...newPayment,
      } as any);
      toast.success('Paiement enregistré avec succès.');
      setShowAddPayment(false);
      refetch();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.message || "Erreur lors de l'enregistrement du paiement.");
    }
  };

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const remainingAmount = (entry.netAmount ?? 0) - totalPaid;

  const statusBadgeClass =
    entry.status === 'paid' ? 'bg-green-100 text-green-800' :
    entry.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
    'bg-gray-100 text-gray-700';

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    pending_payment: 'En attente',
    paid: 'Payé',
    cancelled: 'Annulé',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/accountant/payroll/${entry.payrollPeriod?.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {entry.teacher?.firstName} {entry.teacher?.lastName}
          </h1>
          <p className="text-muted-foreground">{entry.teacher?.email}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadgeClass}`}>
          {statusLabel[entry.status] || entry.status}
        </span>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Détails &amp; Ajustement</TabsTrigger>
          <TabsTrigger value="components">Composants salariaux</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
        </TabsList>

        {/* ─── Details Tab ─── */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Heures et taux horaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validatedHours">Heures validées</Label>
                  <Input
                    id="validatedHours"
                    type="number"
                    step="0.01"
                    min="0"
                    value={validatedHours}
                    onChange={(e) => {
                      setValidatedHours(parseFloat(e.target.value) || 0);
                      setIsDirty(true);
                    }}
                  />
                  <p className="text-xs text-gray-400">Heures totales enregistrées : {entry.totalHours?.toFixed(2) ?? 0} h</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Taux horaire (FCFA)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => {
                      setHourlyRate(parseFloat(e.target.value) || 0);
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>

              {/* Live preview of amounts */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div>
                  <div className="text-xs text-blue-500 font-medium mb-0.5">Base calculée</div>
                  <div className="font-semibold text-blue-800">{Math.round(baseAmountPreview).toLocaleString('fr-FR')} FCFA</div>
                </div>
                <div>
                  <div className="text-xs text-blue-500 font-medium mb-0.5">Brut estimé</div>
                  <div className="font-semibold text-blue-800">{Math.round(grossAmountPreview).toLocaleString('fr-FR')} FCFA</div>
                </div>
                <div>
                  <div className="text-xs text-blue-500 font-medium mb-0.5">Net estimé</div>
                  <div className="font-bold text-lg text-blue-900">{Math.round(netAmountPreview).toLocaleString('fr-FR')} FCFA</div>
                </div>
              </div>
              <p className="text-xs text-gray-400">* Montants estimés avant enregistrement. La valeur réelle sera recalculée par la base de données.</p>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes internes</Label>
                <textarea
                  id="notes"
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                  rows={3}
                  placeholder="Ajouter une note ou un commentaire..."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {isDirty && (
                  <p className="text-xs text-amber-600">⚠️ Des modifications non enregistrées sont en attente.</p>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isUpdating || !isDirty}
                  className="ml-auto"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer les modifications
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Salary Components Tab ─── */}
        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Composants salariaux</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Primes, retenues, avances et autres ajustements.</p>
              </div>
              <Button size="sm" onClick={() => setShowAddComponent(!showAddComponent)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {showAddComponent && (
                <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                  <h3 className="text-sm font-semibold text-blue-900">Nouveau composant</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        value={newComponent.componentType}
                        onChange={(e) => setNewComponent({ ...newComponent, componentType: e.target.value as any })}
                      >
                        <option value="prime">Prime</option>
                        <option value="retenue">Retenue</option>
                        <option value="avance">Avance</option>
                        <option value="bonus">Bonus</option>
                        <option value="deduction">Déduction</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Montant (FCFA)</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 5000"
                        value={newComponent.amount || ''}
                        onChange={(e) => setNewComponent({ ...newComponent, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Libellé</Label>
                    <Input
                      placeholder="Ex: Prime de transport"
                      value={newComponent.label}
                      onChange={(e) => setNewComponent({ ...newComponent, label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Description (optionnel)</Label>
                    <Input
                      placeholder="Détails supplémentaires..."
                      value={newComponent.description}
                      onChange={(e) => setNewComponent({ ...newComponent, description: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddComponent} disabled={createComponentMutation.isPending}>
                      {createComponentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddComponent(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {entry.salaryComponents && entry.salaryComponents.length > 0 ? (
                <div className="space-y-2">
                  {entry.salaryComponents.map((comp) => (
                    <div key={comp.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-gray-900">{comp.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {componentTypeLabels[comp.componentType] || comp.componentType}
                          {comp.description && ` — ${comp.description}`}
                        </div>
                      </div>
                      <div className={`text-right font-semibold ${comp.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comp.amount > 0 ? '+' : ''}{Math.round(comp.amount).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun composant salarial. Cliquez sur "Ajouter" pour en créer un.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Payments Tab ─── */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Paiements</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Historique et enregistrement des paiements effectués.</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddPayment(!showAddPayment)}
                disabled={entry.status === 'paid'}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Enregistrer un paiement
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Net à payer</div>
                  <div className="font-semibold">{Math.round(entry.netAmount ?? 0).toLocaleString('fr-FR')} FCFA</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Déjà payé</div>
                  <div className="font-semibold text-green-600">{Math.round(totalPaid).toLocaleString('fr-FR')} FCFA</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Reste à payer</div>
                  <div className="font-semibold text-amber-700">{Math.round(remainingAmount).toLocaleString('fr-FR')} FCFA</div>
                </div>
              </div>

              {showAddPayment && (
                <div className="mb-4 p-4 border border-emerald-200 bg-emerald-50 rounded-lg space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-900">Nouveau paiement</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Montant (FCFA)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newPayment.amount || ''}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Méthode de paiement</Label>
                      <select
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                        value={newPayment.paymentMethod}
                        onChange={(e) => setNewPayment({ ...newPayment, paymentMethod: e.target.value as any })}
                      >
                        <option value="cash">Espèces</option>
                        <option value="bank_transfer">Virement bancaire</option>
                        <option value="check">Chèque</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="card">Carte</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Référence (optionnel)</Label>
                    <Input
                      placeholder="Numéro de transaction ou reçu..."
                      value={newPayment.referenceNumber}
                      onChange={(e) => setNewPayment({ ...newPayment, referenceNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Notes (optionnel)</Label>
                    <Input
                      placeholder="Commentaire..."
                      value={newPayment.notes}
                      onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleRecordPayment} disabled={recordPaymentMutation.isPending}>
                      {recordPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddPayment(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {payments && payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-gray-900">
                          {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.paymentDate), 'dd MMM yyyy', { locale: fr })}
                        </div>
                        {payment.referenceNumber && (
                          <div className="text-xs text-muted-foreground">Réf : {payment.referenceNumber}</div>
                        )}
                        {payment.notes && (
                          <div className="text-xs text-gray-400 italic">{payment.notes}</div>
                        )}
                      </div>
                      <div className="text-right font-semibold text-green-600">
                        {Math.round(payment.amount).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun paiement enregistré.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
