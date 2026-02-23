import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@novaconnect/data/src/client';
import * as Location from 'expo-location';
import { MapPin, CheckCircle, Building2, Navigation } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistance } from '@novaconnect/core';

interface Campus {
  id: string;
  name: string;
  code: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  is_main: boolean;
}

interface DistanceInfo {
  distance: number | null;
  withinRadius: boolean;
  loading: boolean;
}

export default function CampusSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [distances, setDistances] = useState<Record<string, DistanceInfo>>({});

  // Fetch user's accessible campuses
  const {
    data: campuses = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['accessibleCampuses'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's school_id
      const { data: userData } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!userData) {
        throw new Error('User data not found');
      }

      // Get accessible campuses via RPC
      const { data, error } = await supabase.rpc('get_accessible_campuses', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data as Campus[];
    },
  });

  // Calculate distance to each campus
  const calculateDistances = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'La permission de localisation est nécessaire pour calculer les distances.'
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const newDistances: Record<string, DistanceInfo> = {};

    for (const campus of campuses) {
      if (!campus.latitude || !campus.longitude) {
        newDistances[campus.id] = {
          distance: null,
          withinRadius: true, // Assume within radius if no GPS configured
          loading: false,
        };
        continue;
      }

      // Calculate distance using Haversine formula
      const lat1 = (location.coords.latitude * Math.PI) / 180;
      const lon1 = (location.coords.longitude * Math.PI) / 180;
      const lat2 = (campus.latitude * Math.PI) / 180;
      const lon2 = (campus.longitude * Math.PI) / 180;

      const R = 6371e3; // Earth radius in meters
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      newDistances[campus.id] = {
        distance,
        withinRadius: distance <= campus.radius_meters,
        loading: false,
      };
    }

    setDistances(newDistances);
  };

  React.useEffect(() => {
    if (campuses.length > 0) {
      calculateDistances();
    }
  }, [campuses]);

  const selectCampus = async (campus: Campus) => {
    try {
      // Store selected campus in AsyncStorage
      await AsyncStorage.setItem('selectedCampusId', campus.id);
      await AsyncStorage.setItem('selectedCampusName', campus.name);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['accessibleCampuses'] });

      Alert.alert('Campus sélectionné', `Vous êtes maintenant sur le campus ${campus.name}`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner ce campus');
    }
  };

  const openMaps = (campus: Campus) => {
    if (!campus.latitude || !campus.longitude) {
      Alert.alert('Info', 'Ce campus n\'a pas de coordonnées GPS configurées');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${campus.latitude},${campus.longitude}`;
    // In a real app, you would use Linking.openURL(url)
    Alert.alert('Navigation', `Ouverture de Google Maps vers ${campus.name}`);
  };

  const renderCampusCard = (campus: Campus) => {
    const distanceInfo = distances[campus.id];
    const isLoadingDistance = distanceInfo?.loading || false;
    const distance = distanceInfo?.distance;
    const withinRadius = distanceInfo?.withinRadius;

    return (
      <TouchableOpacity
        key={campus.id}
        style={styles.campusCard}
        onPress={() => selectCampus(campus)}
      >
        <View style={styles.campusHeader}>
          <View style={styles.campusInfo}>
            <Building2 size={24} color="#6366f1" />
            <View style={styles.campusNameContainer}>
              <Text style={styles.campusName}>{campus.name}</Text>
              <View style={styles.campusMeta}>
                <Text style={styles.campusCode}>{campus.code}</Text>
                {campus.is_main && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>Principal</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <CheckCircle size={20} color="#22c55e" />
        </View>

        {campus.address && (
          <Text style={styles.campusAddress}>{campus.address}</Text>
        )}

        <View style={styles.locationSection}>
          <MapPin size={16} color="#6b7280" />
          {isLoadingDistance ? (
            <Text style={styles.distanceText}>Calcul en cours...</Text>
          ) : distance !== null ? (
            <View style={styles.distanceContainer}>
              <Text
                style={[
                  styles.distanceText,
                  withinRadius && styles.distanceWithin,
                  !withinRadius && styles.distanceOutside,
                ]}
              >
                {formatDistance(distance)}
              </Text>
              <Text style={styles.radiusText}>
                (Rayon: {campus.radius_meters}m)
              </Text>
              {withinRadius && (
                <View style={styles.withinBadge}>
                  <Text style={styles.withinBadgeText}>À proximité</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.distanceText}>Localisation non configurée</Text>
          )}
        </View>

        {campus.latitude && campus.longitude && (
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={(e) => {
              e.stopPropagation();
              openMaps(campus);
            }}
          >
            <Navigation size={16} color="#6366f1" />
            <Text style={styles.navigationButtonText}>Itinéraire</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Chargement des campus...</Text>
      </View>
    );
  }

  if (campuses.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Building2 size={48} color="#9ca3af" />
        <Text style={styles.emptyTitle}>Aucun campus accessible</Text>
        <Text style={styles.emptyText}>
          Vous n'avez pas accès à un campus pour le moment.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sélectionner un campus</Text>
        <Text style={styles.subtitle}>
          Choisissez le campus sur lequel vous vous trouvez
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {campuses.map((campus) => renderCampusCard(campus))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  campusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  campusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  campusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  campusNameContainer: {
    marginLeft: 12,
    flex: 1,
  },
  campusName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  campusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  campusCode: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 8,
  },
  mainBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  mainBadgeText: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '600',
  },
  campusAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  distanceWithin: {
    color: '#22c55e',
    fontWeight: '600',
  },
  distanceOutside: {
    color: '#ef4444',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  radiusText: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  withinBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  withinBadgeText: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  navigationButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 8,
  },
});
