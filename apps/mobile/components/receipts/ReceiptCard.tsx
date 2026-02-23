import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Download, Share, CheckCircle } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../../src/config/pwa';

interface Props {
  receipt: any;
  type: 'payment' | 'salary';
}

export function ReceiptCard({ receipt, type }: Props) {
  const handleDownload = async () => {
    try {
      // Get signed URL from backend
      const response = await fetch(`${API_URL}/receipts/${receipt.id}/download`);
      const { signedUrl } = await response.json();

      // Download file
      const fileUri = FileSystem.documentDirectory + `receipt-${receipt.receipt_number}.pdf`;
      await FileSystem.downloadAsync(signedUrl, fileUri);

      // Share or open
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {receipt.receipt_number || receipt.slip_number}
          </Text>
          <Text style={styles.date}>
            {new Date(receipt.generated_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        {receipt.verification_token_id && (
          <CheckCircle size={20} color="#10b981" />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleDownload}
          style={styles.primaryButton}
        >
          <Download size={16} color="white" />
          <Text style={styles.primaryButtonText}>Télécharger</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDownload}
          style={styles.secondaryButton}
        >
          <Share size={16} color="#374151" />
          <Text style={styles.secondaryButtonText}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontWeight: '600',
    fontSize: 18,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    marginLeft: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    marginLeft: 8,
  },
});
