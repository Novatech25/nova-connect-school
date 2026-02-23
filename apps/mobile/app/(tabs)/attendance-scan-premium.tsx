import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Vibration,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Camera, CameraView } from 'expo-camera'
import * as Device from 'expo-device'
import * as SecureStore from 'expo-secure-store'
import { Dimensions } from 'react-native'
import { supabase } from '../../lib/supabase'
import { collectDeviceInfo } from '../../utils/deviceInfo'

interface ScanResult {
  success: boolean
  attendanceRecordId?: string
  message: string
  error?: string
}

export default function AttendanceScanPremiumScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanningHistory, setScanningHistory] = useState<ScanResult[]>([])
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')

      // Collect device info
      const info = await collectDeviceInfo()
      setDeviceInfo(info)
    })()
  }, [])

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return

    setScanned(true)
    Vibration.vibrate(100)

    try {
      // Parse QR data (should be base64 encoded JSON)
      // Use atob for React Native compatible base64 decoding
      const decoded = atob(data)
      const { token, signature } = JSON.parse(decoded)

      // Get current location (optional)
      let location: { latitude?: number; longitude?: number } = {}
      try {
        // In real app, get GPS location here
        // location = await getLocation()
      } catch (error) {
        console.log('Location not available')
      }

      // Call validate-qr-scan Edge Function
      const { data: result, error } = await supabase.functions.invoke('validate-qr-scan', {
        body: {
          token,
          signature,
          ...location,
          deviceInfo,
        },
      })

      if (error) {
        setScanResult({
          success: false,
          message: error.message || 'Scan failed',
        })
      } else {
        setScanResult(result as ScanResult)

        // Add to history
        setScanningHistory((prev) => [result as ScanResult, ...prev].slice(0, 10))
      }

      // Reset scanned state after 3 seconds
      setTimeout(() => {
        setScanned(false)
        setScanResult(null)
      }, 3000)
    } catch (error) {
      setScanResult({
        success: false,
        message: 'Invalid QR code format',
      })
      setTimeout(() => {
        setScanned(false)
        setScanResult(null)
      }, 3000)
    }
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {!showHistory ? (
        <>
          {/* Camera View */}
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />

          {/* Scan Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>

          {/* Result Overlay */}
          {scanResult && (
            <View
              style={[
                styles.resultOverlay,
                scanResult.success ? styles.successOverlay : styles.errorOverlay,
              ]}
            >
              <View style={styles.resultContent}>
                <Text style={styles.resultTitle}>
                  {scanResult.success ? '✓ Success' : '✗ Failed'}
                </Text>
                <Text style={styles.resultMessage}>{scanResult.message}</Text>
              </View>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>
              {scanned ? 'Processing...' : 'Position QR code within the frame'}
            </Text>
          </View>

          {/* History Button */}
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowHistory(true)}
          >
            <Text style={styles.historyButtonText}>View History</Text>
          </TouchableOpacity>
        </>
      ) : (
        <HistoryView
          history={scanningHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </View>
  )
}

function HistoryView({
  history,
  onClose,
}: {
  history: ScanResult[]
  onClose: () => void
}) {
  return (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Scan History</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.historyList}>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No scan history</Text>
        ) : (
          history.map((result, index) => (
            <View
              key={index}
              style={[
                styles.historyItem,
                result.success ? styles.successItem : styles.errorItem,
              ]}
            >
              <Text
                style={[
                  styles.historyItemTitle,
                  result.success ? styles.successText : styles.errorText,
                ]}
              >
                {result.success ? '✓ Success' : '✗ Failed'}
              </Text>
              <Text style={styles.historyItemMessage}>{result.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  resultOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successOverlay: {
    backgroundColor: '#4CAF50',
  },
  errorOverlay: {
    backgroundColor: '#F44336',
  },
  resultContent: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  instructions: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  historyButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#2196F3',
    fontSize: 16,
  },
  historyList: {
    flex: 1,
    padding: 16,
  },
  historyItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  successItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  errorItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  historyItemMessage: {
    fontSize: 14,
    color: '#666',
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#F44336',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    textAlign: 'center',
  },
})
