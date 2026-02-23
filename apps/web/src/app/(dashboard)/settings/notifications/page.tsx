'use client';

import { useState, useEffect } from 'react';
import { useAuthContext } from '@novaconnect/data';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Bell, Mail, MessageCircle, Phone } from 'lucide-react';
import { NotificationPreferencesTable } from '@/components/settings/NotificationPreferencesTable';

// Types de notifications disponibles
const NOTIFICATION_TYPES = [
  { value: 'grade_posted', label: 'Notes publiées', description: 'Lorsque de nouvelles notes sont publiées' },
  { value: 'assignment_added', label: 'Nouveaux devoirs', description: 'Lorsqu\'un nouveau devoir est ajouté' },
  { value: 'schedule_published', label: 'Emploi du temps publié', description: 'Lorsque l\'emploi du temps est publié' },
  { value: 'schedule_updated', label: 'Emploi du temps modifié', description: 'Lorsque l\'emploi du temps est modifié' },
  { value: 'attendance_marked', label: 'Présence marquée', description: 'Lorsque la présence est marquée' },
  { value: 'hours_validated', label: 'Heures validées', description: 'Lorsque vos heures sont validées' },
  { value: 'payroll_payment', label: 'Paiement effectué', description: 'Lorsqu\'un paiement est effectué' },
  { value: 'document_blocked', label: 'Document bloqué', description: 'Lorsqu\'un document est bloqué' },
  { value: 'payment_overdue', label: 'Paiement en retard', description: 'Rappels de paiement en retard' },
];

// Canaux disponibles
const CHANNELS = [
  { value: 'in_app', label: 'In-App', icon: Bell, color: 'text-blue-600' },
  { value: 'push', label: 'Push', icon: Bell, color: 'text-purple-600' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-green-600' },
  { value: 'sms', label: 'SMS', icon: MessageCircle, color: 'text-orange-600' },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone, color: 'text-green-700' },
];

interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: string;
  enabled_channels: string[];
}

export default function NotificationPreferencesPage() {
  const { profile } = useAuthContext();
  const userId = profile?.id;
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Charger les préférences
  useEffect(() => {
    if (!userId) return;

    async function loadPreferences() {
      try {
        const response = await fetch(`/api/notifications/preferences?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to load preferences');

        const data = await response.json();
        setPreferences(data.preferences || []);
      } catch (error) {
        console.error('Error loading preferences:', error);
        toast.error('Erreur lors du chargement des préférences');
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [userId]);

  // Mettre à jour une préférence
  const updatePreference = (notificationType: string, channel: string, enabled: boolean) => {
    setPreferences((prev) => {
      const updated = [...prev];
      const prefIndex = updated.findIndex((p) => p.notification_type === notificationType);

      if (prefIndex >= 0) {
        const pref = { ...updated[prefIndex] };
        if (enabled) {
          pref.enabled_channels = [...pref.enabled_channels, channel];
        } else {
          // Vérifier qu'au moins un canal reste actif
          if (pref.enabled_channels.filter((c) => c !== channel).length === 0) {
            toast.error('Au moins un canal doit être activé pour ce type de notification');
            return prev;
          }
          pref.enabled_channels = pref.enabled_channels.filter((c) => c !== channel);
        }
        updated[prefIndex] = pref;
      } else {
        // Créer une nouvelle préférence
        updated.push({
          id: '',
          user_id: userId || '',
          notification_type: notificationType,
          enabled_channels: enabled ? [channel] : [],
        });
      }

      setHasChanges(true);
      return updated;
    });
  };

  // Sauvegarder les préférences
  const savePreferences = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, preferences }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      toast.success('Préférences sauvegardées avec succès');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Erreur lors de la sauvegarde des préférences');
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser aux valeurs par défaut
  const resetToDefaults = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/notifications/preferences/default?userId=${userId}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reset preferences');

      const data = await response.json();
      setPreferences(data.preferences || []);
      setHasChanges(true);
      toast.success('Préférences réinitialisées aux valeurs par défaut');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Préférences de notifications</h1>
          <p className="text-gray-600 mt-2">Configurez comment vous souhaitez recevoir vos notifications</p>
        </div>
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Préférences de notifications</h1>
          <p className="text-gray-600 mt-2">
            Configurez comment vous souhaitez recevoir vos notifications selon le type d'événement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            Réinitialiser
          </Button>
          <Button onClick={savePreferences} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <NotificationPreferencesTable
          notificationTypes={NOTIFICATION_TYPES}
          channels={CHANNELS}
          preferences={preferences}
          onUpdatePreference={updatePreference}
        />
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">À propos des notifications</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>In-App</strong> : Notifications dans l'application NovaConnectSchool</li>
          <li>• <strong>Push</strong> : Notifications push sur votre appareil mobile</li>
          <li>• <strong>Email</strong> : Notifications envoyées par email</li>
          <li>• <strong>SMS</strong> : Notifications par SMS (tarifs d'opérateur applicables)</li>
          <li>• <strong>WhatsApp</strong> : Notifications via WhatsApp</li>
        </ul>
      </div>
    </div>
  );
}
