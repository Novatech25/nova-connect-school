'use client';

import { PaymentConfigTab } from '@/app/(dashboard)/admin/settings/components/PaymentConfigTab';
import { useAuthContext } from '@novaconnect/data/providers';
import { Card } from '@/components/ui/card';

export default function AccountantPaymentSettingsPage() {
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ??
    profile?.school_id ??
    user?.schoolId ??
    (user as any)?.school_id;

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Paramètres des paiements</h1>
          <p className="text-gray-600 mt-2">
            Configuration du blocage de documents et des relances de paiement
          </p>
        </div>
        <Card className="p-6">
          <p className="text-red-600">Impossible de charger l'ID de l'école. Veuillez vous reconnecter.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres des paiements</h1>
        <p className="text-gray-600 mt-2">
          Configuration du blocage de documents et des relances de paiement
        </p>
      </div>

      <PaymentConfigTab schoolId={schoolId} />
    </div>
  );
}
