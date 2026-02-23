import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
// @ts-ignore
import * as DocumentPicker from 'expo-document-picker';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  currentFileCount?: number;
  disabled?: boolean;
}

export function FileUploadZone({
  onFilesSelected,
  allowedMimeTypes,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 5,
  currentFileCount = 0,
  disabled = false,
}: FileUploadZoneProps) {
  const handlePickDocuments = useCallback(async () => {
    if (disabled) return;

    if (currentFileCount >= maxFiles) {
      Alert.alert('Limite atteinte', `Vous ne pouvez ajouter que ${maxFiles} fichiers maximum.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes || ['*/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const files: File[] = [];

      for (const asset of result.assets) {
        // Validate file size
        if (asset.size && asset.size > maxFileSize) {
          Alert.alert(
            'Fichier trop volumineux',
            `Le fichier "${asset.name}" dépasse la limite de ${Math.round(maxFileSize / 1024 / 1024)}MB.`
          );
          continue;
        }

        // Convert asset to File object
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const file = new File([blob], asset.name, { type: asset.mimeType || 'application/octet-stream' });

        files.push(file);

        // Check max files limit
        if (files.length + currentFileCount >= maxFiles) {
          break;
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
      }
    } catch (error) {
      console.error('Error picking documents:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner les fichiers.');
    }
  }, [allowedMimeTypes, maxFileSize, maxFiles, currentFileCount, disabled, onFilesSelected]);

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={handlePickDocuments}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📎</Text>
        </View>
        <Text style={styles.title}>
          {disabled ? 'Zone désactivée' : 'Ajouter des fichiers'}
        </Text>
        <Text style={styles.subtitle}>
          {allowedMimeTypes
            ? 'Formats acceptés : PDF, Word, Images, ZIP'
            : 'Tous les formats acceptés'}
        </Text>
        <Text style={styles.limit}>
          {currentFileCount}/{maxFiles} fichiers • Max {Math.round(maxFileSize / 1024 / 1024)}MB par fichier
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  disabled: {
    opacity: 0.5,
    borderColor: '#E5E7EB',
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  limit: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

export default FileUploadZone;
