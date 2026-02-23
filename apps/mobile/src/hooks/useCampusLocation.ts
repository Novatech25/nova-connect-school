import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@novaconnect/data/src/client';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: Date | null;
}

interface CampusLocation {
  campusId: string;
  campusName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface ValidationState {
  isValid: boolean;
  distance: number | null;
  error: string | null;
  lastValidated: Date | null;
}

interface UseCampusLocationResult {
  location: LocationState;
  campus: CampusLocation | null;
  validation: ValidationState;
  isLoading: boolean;
  refreshValidation: () => Promise<void>;
}

export function useCampusLocation(campusId?: string | null): UseCampusLocationResult {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
  });
  const [campus, setCampus] = useState<CampusLocation | null>(null);
  const [validation, setValidation] = useState<ValidationState>({
    isValid: true, // Default to true if not checking
    distance: null,
    error: null,
    lastValidated: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch campus info
  useEffect(() => {
    if (!campusId) return;

    const fetchCampus = async () => {
      try {
        const { data, error } = await supabase
          .from('campuses')
          .select('*')
          .eq('id', campusId)
          .single();

        if (error) throw error;
        if (!data) return;

        // Only set campus if it has GPS configured
        if (data.latitude && data.longitude) {
          setCampus({
            campusId: data.id,
            campusName: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            radiusMeters: data.radius_meters || 200,
          });
        }
      } catch (error) {
        console.error('Error fetching campus:', error);
      }
    };

    fetchCampus();
  }, [campusId]);

  // Watch location and validate
  useEffect(() => {
    if (!campus) return;

    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setValidation({
            isValid: false,
            distance: null,
            error: 'Location permission not granted',
            lastValidated: new Date(),
          });
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10, // Update every 10 meters
            timeInterval: 30000, // Or every 30 seconds
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              timestamp: new Date(),
            });

            // Validate location against campus
            validateLocation(newLocation.coords.latitude, newLocation.coords.longitude);
          }
        );
      } catch (error) {
        console.error('Error starting location watch:', error);
        setValidation({
          isValid: false,
          distance: null,
          error: 'Failed to start location tracking',
          lastValidated: new Date(),
        });
      }
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [campus]);

  const validateLocation = async (lat: number, lon: number) => {
    if (!campus) return;

    setIsLoading(true);

    try {
      // Calculate distance using Haversine formula
      const lat1 = (lat * Math.PI) / 180;
      const lon1 = (lon * Math.PI) / 180;
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

      const isValid = distance <= campus.radiusMeters;

      setValidation({
        isValid,
        distance,
        error: null,
        lastValidated: new Date(),
      });
    } catch (error) {
      console.error('Error validating location:', error);
      setValidation({
        isValid: false,
        distance: null,
        error: 'Failed to validate location',
        lastValidated: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshValidation = async () => {
    if (!location.latitude || !location.longitude || !campus) {
      return;
    }

    await validateLocation(location.latitude, location.longitude);
  };

  return {
    location,
    campus,
    validation,
    isLoading,
    refreshValidation,
  };
}

// Hook to get selected campus from AsyncStorage
export function useSelectedCampus() {
  const [campusId, setCampusId] = useState<string | null>(null);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSelectedCampus = async () => {
      try {
        const id = await AsyncStorage.getItem('selectedCampusId');
        const name = await AsyncStorage.getItem('selectedCampusName');

        setCampusId(id);
        setCampusName(name);
      } catch (error) {
        console.error('Error loading selected campus:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCampus();
  }, []);

  const selectCampus = async (id: string, name: string) => {
    try {
      await AsyncStorage.setItem('selectedCampusId', id);
      await AsyncStorage.setItem('selectedCampusName', name);

      setCampusId(id);
      setCampusName(name);
    } catch (error) {
      console.error('Error selecting campus:', error);
      throw error;
    }
  };

  const clearCampus = async () => {
    try {
      await AsyncStorage.removeItem('selectedCampusId');
      await AsyncStorage.removeItem('selectedCampusName');

      setCampusId(null);
      setCampusName(null);
    } catch (error) {
      console.error('Error clearing campus:', error);
      throw error;
    }
  };

  return {
    campusId,
    campusName,
    isLoading,
    selectCampus,
    clearCampus,
  };
}
