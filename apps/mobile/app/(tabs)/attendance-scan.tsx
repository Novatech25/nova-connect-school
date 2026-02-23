'use client';

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, Platform } from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import * as Location from 'expo-location';
import * as Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useValidateQrScan, useStudentScanLogs, useCurrentStudentId } from '@novaconnect/data';

export default function AttendanceScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const router = useRouter();
  const validateMutation = useValidateQrScan();
  const { data: studentId, isLoading: studentLoading } = useCurrentStudentId();

  // Fetch scan logs for current student
  const { data: scanLogs } = useStudentScanLogs(studentId || '');

  useEffect(() => {
    (async () => {
      // Request camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');

      // Request location permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus === 'granted');

      // Get current location
      if (locationStatus === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }

      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Veuillez autoriser l\'accès à la caméra pour scanner les QR codes'
        );
      }

      if (locationStatus !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Veuillez autoriser l\'accès à la localisation pour valider votre présence'
        );
      }
    })();
  }, []);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    if (!studentId) {
      Alert.alert('Erreur', 'Impossible de charger votre profil étudiant');
      return;
    }

    setScanned(true);

    try {
      // Parse QR data
      // Format: novaconnect://attendance/scan?token=...&sig=...
      const url = new URL(result.data);
      const token = url.searchParams.get('token');
      const signature = url.searchParams.get('sig');

      if (!token || !signature) {
        Alert.alert('Erreur', 'Code QR invalide');
        setScanned(false);
        return;
      }

      // Get app version from Constants
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      // Validate scan
      const response = await validateMutation.mutateAsync({
        token,
        signature,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
        deviceInfo: {
          platform: Platform.OS,
          appVersion,
        },
      });

      if (response.success) {
        // Success feedback
        Vibration.vibrate(200); // 200ms vibration
        Alert.alert(
          'Succès ✓',
          'Présence enregistrée avec succès !',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        // Error feedback
        Vibration.vibrate([100, 50, 100]); // Pattern vibration for error
        Alert.alert(
          'Erreur ❌',
          response.message,
          [
            {
              text: 'Réessayer',
              onPress: () => setScanned(false),
            },
            {
              text: 'Annuler',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      Vibration.vibrate([100, 50, 100]);
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue lors de la validation',
        [
          {
            text: 'Réessayer',
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  if (hasPermission === null || locationPermission === null || studentLoading) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (hasPermission === false || locationPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Vous devez autoriser l'accès à la caméra et à la localisation
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!studentId) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Cette fonctionnalité est réservée aux étudiants
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing={facing}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Scanner le QR Code</Text>
          <Text style={styles.subtitle}>
            Placez le QR code dans le cadre
          </Text>
        </View>

        {/* Scanning Area */}
        <View style={styles.scanArea}>
          <View style={styles.corner} />
          <View style={[styles.corner, { alignSelf: 'flex-end' }]} />
          <View style={[styles.corner, { position: 'absolute', bottom: 0 }]} />
          <View style={[styles.corner, { position: 'absolute', bottom: 0, right: 0 }]} />
        </View>

        {/* Status Message */}
        {scanned && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {validateMutation.isPending ? 'Validation...' : 'Traitement...'}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {/* Location Info */}
          {location && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>
                📍 GPS: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </Text>
            </View>
          )}

          {/* Recent Scans */}
          {scanLogs && scanLogs.length > 0 && (
            <View style={styles.recentScans}>
              <Text style={styles.recentScansTitle}>
                Scans récents: {scanLogs.length}
              </Text>
            </View>
          )}

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Annuler</Text>
          </TouchableOpacity>

          {/* Flip Camera Button */}
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          >
            <Text style={styles.flipButtonText}>🔄 Retourner caméra</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    alignSelf: 'center',
    marginTop: 40,
    position: 'relative',
  },
  corner: {
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 4,
    borderRadius: 8,
  },
  statusContainer: {
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  locationInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  recentScans: {
    alignItems: 'center',
  },
  recentScansTitle: {
    color: '#ccc',
    fontSize: 14,
  },
  backButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  flipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#fff',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    marginHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
