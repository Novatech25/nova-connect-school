import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@novaconnect/data';
import { Bell, Mail, MessageCircle, Phone, RefreshCw } from 'lucide-react-native';

// Types de notifications disponibles
const NOTIFICATION_TYPES = [
  {
    value: 'grade_posted',
    label: 'Notes publiées',
    description: 'Lorsque de nouvelles notes sont publiées',
    category: 'Scolaire',
  },
  {
    value: 'assignment_added',
    label: 'Nouveaux devoirs',
    description: 'Lorsqu\'un nouveau devoir est ajouté',
    category: 'Scolaire',
  },
  {
    value: 'schedule_published',
    label: 'Emploi du temps publié',
    description: 'Lorsque l\'emploi du temps est publié',
    category: 'Scolaire',
  },
  {
    value: 'schedule_updated',
    label: 'Emploi du temps modifié',
    description: 'Lorsque l\'emploi du temps est modifié',
    category: 'Scolaire',
  },
  {
    value: 'attendance_marked',
    label: 'Présence marquée',
    description: 'Lorsque la présence est marquée',
    category: 'Scolaire',
  },
  {
    value: 'hours_validated',
    label: 'Heures validées',
    description: 'Lorsque vos heures sont validées',
    category: 'Financier',
  },
  {
    value: 'payroll_payment',
    label: 'Paiement effectué',
    description: 'Lorsqu\'un paiement est effectué',
    category: 'Financier',
  },
  {
    value: 'document_blocked',
    label: 'Document bloqué',
    description: 'Lorsqu\'un document est bloqué',
    category: 'Administratif',
  },
  {
    value: 'payment_overdue',
    label: 'Paiement en retard',
    description: 'Rappels de paiement en retard',
    category: 'Financier',
  },
];

// Canaux disponibles
const CHANNELS = [
  { value: 'in_app', label: 'In-App', icon: Bell, color: '#3B82F6' },
  { value: 'push', label: 'Push', icon: Bell, color: '#8B5CF6' },
  { value: 'email', label: 'Email', icon: Mail, color: '#10B981' },
  { value: 'sms', label: 'SMS', icon: MessageCircle, color: '#F59E0B' },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone, color: '#059669' },
];

interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: string;
  enabled_channels: string[];
}

export default function NotificationPreferencesScreen() {
  const { profile } = useAuthContext();
  const userId = profile?.id;
  const router = useRouter();

  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Charger les préférences
  const loadPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/notifications/preferences?userId=${userId}`
      );
      if (!response.ok) throw new Error('Failed to load preferences');

      const data = await response.json();
      setPreferences(data.preferences || []);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Erreur', 'Impossible de charger les préférences');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

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
            Alert.alert('Erreur', 'Au moins un canal doit être activé pour ce type de notification');
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
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/notifications/preferences`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, preferences }),
        }
      );

      if (!response.ok) throw new Error('Failed to save preferences');

      Alert.alert('Succès', 'Préférences sauvegardées');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences');
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser aux valeurs par défaut
  const resetToDefaults = async () => {
    if (!userId) return;

    Alert.alert(
      'Réinitialiser',
      'Voulez-vous vraiment réinitialiser toutes les préférences aux valeurs par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL}/api/notifications/preferences/default?userId=${userId}`,
                { method: 'POST' }
              );

              if (!response.ok) throw new Error('Failed to reset preferences');

              const data = await response.json();
              setPreferences(data.preferences || []);
              setHasChanges(true);
              Alert.alert('Succès', 'Préférences réinitialisées');
            } catch (error) {
              console.error('Error resetting preferences:', error);
              Alert.alert('Erreur', 'Impossible de réinitialiser les préférences');
            }
          },
        },
      ]
    );
  };

  // Grouper les préférences par catégorie
  const groupedPreferences = NOTIFICATION_TYPES.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, typeof NOTIFICATION_TYPES>);

  const getPreference = (notificationType: string) => {
    return preferences.find((p) => p.notification_type === notificationType);
  };

  const isChannelEnabled = (notificationType: string, channel: string) => {
    const pref = getPreference(notificationType);
    return pref?.enabled_channels.includes(channel) ?? false;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Chargement des préférences...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex flex-row justify-between items-center mb-2">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">Préférences de notifications</Text>
            <Text className="text-sm text-gray-600 mt-1">
              Configurez comment vous souhaitez recevoir vos notifications
            </Text>
          </View>
        </View>

        {/* Boutons d'action */}
        <View className="flex flex-row gap-2 mt-4">
          <TouchableOpacity
            onPress={resetToDefaults}
            className="flex-1 bg-gray-100 py-3 px-4 rounded-lg"
            disabled={saving}
          >
            <View className="flex items-center justify-center">
              <RefreshCw size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-700 font-medium">Réinitialiser</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={savePreferences}
            disabled={!hasChanges || saving}
            className={`flex-1 py-3 px-4 rounded-lg ${
              hasChanges && !saving ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <View className="flex items-center justify-center">
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-medium">Enregistrer</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des préférences */}
      <ScrollView className="flex-1 p-4">
        {Object.entries(groupedPreferences).map(([category, types]) => (
          <View key={category} className="mb-6 bg-white rounded-lg shadow-sm">
            <View className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">{category}</Text>
            </View>

            {types.map((type) => (
              <View key={type.value} className="border-b border-gray-100 p-4">
                <View className="mb-3">
                  <Text className="font-medium text-gray-900 mb-1">{type.label}</Text>
                  <Text className="text-sm text-gray-500">{type.description}</Text>
                </View>

                <View className="flex flex-wrap gap-3">
                  {CHANNELS.map((channel) => (
                    <View key={channel.value} className="flex items-center">
                      <channel.icon size={18} color={channel.color} />
                      <Text className="ml-2 text-sm text-gray-700 w-16">{channel.label}</Text>
                      <Switch
                        value={isChannelEnabled(type.value, channel.value)}
                        onValueChange={(value) =>
                          updatePreference(type.value, channel.value, value)
                        }
                        trackColor={{ false: '#D1D5DB', true: channel.color }}
                        thumbColor={isChannelEnabled(type.value, channel.value) ? '#FFFFFF' : '#F3F4F6'}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Légende */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <Text className="font-semibold text-blue-900 mb-2">À propos des notifications</Text>
          <View className="space-y-1">
            <Text className="text-sm text-blue-800">• In-App : Dans l'application NovaConnectSchool</Text>
            <Text className="text-sm text-blue-800">• Push : Notifications push sur mobile</Text>
            <Text className="text-sm text-blue-800">• Email : Notifications par email</Text>
            <Text className="text-sm text-blue-800">• SMS : Notifications par SMS</Text>
            <Text className="text-sm text-blue-800">• WhatsApp : Notifications via WhatsApp</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
