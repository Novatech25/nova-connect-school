import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getSupabaseClient } from '@novaconnect/data';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ScanResult {
  id: string;
  studentName: string;
  studentPhoto: string | null;
  className: string;
  cardNumber: string;
  status: string;
  timestamp: Date;
  valid: boolean;
}

export default function StudentCardScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  useEffect(() => {
    // Load recent scans from storage or state
    // This is a placeholder - in a real app, you'd load from AsyncStorage
    setRecentScans([]);
  }, []);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={80} color="#9ca3af" />
          <Text style={styles.permissionTitle}>Accès caméra requis</Text>
          <Text style={styles.permissionText}>
            Nous avons besoin de votre permission pour utiliser la caméra afin de scanner les QR codes des cartes.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Accorder la permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);

    try {
      // Parse QR data
      const qrPayload = JSON.parse(data);
      const { data: qrData, sig: signature } = qrPayload;

      if (!qrData || !signature) {
        throw new Error('Invalid QR code format');
      }

      // Call validate-card-qr Edge Function
      const supabase = getSupabaseClient();
      const { data: validationResult, error } = await supabase.functions.invoke('validate-card-qr', {
        body: {
          qrData,
          signature,
        },
      });

      if (error || !validationResult?.success) {
        throw new Error(error?.message || validationResult?.message || 'Validation failed');
      }

      // Map response to ScanResult
      const scanResult: ScanResult = {
        id: validationResult.card?.id || 'unknown',
        studentName: `${validationResult.student?.firstName || ''} ${validationResult.student?.lastName || ''}`.trim() || 'Élève inconnu',
        studentPhoto: validationResult.student?.photoUrl || null,
        className: validationResult.student?.class?.name || 'N/A',
        cardNumber: validationResult.card?.cardNumber || 'N/A',
        status: validationResult.card?.status || 'unknown',
        timestamp: new Date(),
        valid: validationResult.valid || false,
      };

      setScanResult(scanResult);
      setRecentScans([scanResult, ...recentScans].slice(0, 10)); // Keep last 10 scans
    } catch (error: any) {
      Alert.alert('Erreur de scan', error.message || 'QR code invalide');
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const renderScanResult = () => {
    if (!scanResult) return null;

    return (
      <View style={styles.resultContainer}>
        <View style={[
          styles.resultHeader,
          { backgroundColor: scanResult.valid ? '#dcfce7' : '#fee2e2' }
        ]}>
          <Ionicons
            name={scanResult.valid ? 'checkmark-circle' : 'close-circle'}
            size={32}
            color={scanResult.valid ? '#22c55e' : '#ef4444'}
          />
          <Text style={[
            styles.resultTitle,
            { color: scanResult.valid ? '#166534' : '#991b1b' }
          ]}>
            {scanResult.valid ? 'Carte valide' : 'Carte invalide'}
          </Text>
        </View>

        {scanResult.valid && (
          <View style={styles.resultContent}>
            {scanResult.studentPhoto && (
              <Image
                source={{ uri: scanResult.studentPhoto }}
                style={styles.resultPhoto}
              />
            )}
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{scanResult.studentName}</Text>
              <Text style={styles.resultDetail}>Classe: {scanResult.className}</Text>
              <Text style={styles.resultDetail}>Carte: {scanResult.cardNumber}</Text>
              <Text style={styles.resultDetail}>
                Statut: <Text style={{ color: '#22c55e' }}>Active</Text>
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={() => {
            setScanResult(null);
            setScanned(false);
          }}
        >
          <Text style={styles.scanAgainButtonText}>Scanner à nouveau</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCamera = () => {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanInstruction}>
            Alignez le QR code avec le cadre
          </Text>
        </View>
      </View>
    );
  };

  const renderRecentScans = () => {
    if (recentScans.length === 0) return null;

    return (
      <View style={styles.recentScansContainer}>
        <Text style={styles.recentScansTitle}>Scans récents</Text>
        <FlatList
          data={recentScans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.recentScanItem}>
              <View>
                <Text style={styles.recentScanName}>{item.studentName}</Text>
                <Text style={styles.recentScanDetail}>{item.className}</Text>
              </View>
              <View style={styles.recentScanMeta}>
                <Text style={styles.recentScanTime}>
                  {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Ionicons
                  name={item.valid ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={item.valid ? '#22c55e' : '#ef4444'}
                />
              </View>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scanner Carte Scolaire</Text>
        <Text style={styles.headerSubtitle}>
          Scannez le QR code d'une carte pour valider l'identité
        </Text>
      </View>

      {scanResult ? (
        renderScanResult()
      ) : (
        <>
          {renderCamera()}
          {renderRecentScans()}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  cameraContainer: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanInstruction: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    padding: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  resultContent: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  resultPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  resultDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  scanAgainButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentScansContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  recentScansTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  recentScanItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recentScanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  recentScanDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  recentScanMeta: {
    alignItems: 'flex-end',
  },
  recentScanTime: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
});
