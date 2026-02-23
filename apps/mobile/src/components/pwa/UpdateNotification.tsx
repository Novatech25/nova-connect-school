/**
 * UpdateNotification Component
 *
 * Toast/banner notification for Service Worker updates.
 * Shows when a new version of the app is available.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useServiceWorker } from '../../hooks/useServiceWorker';
import { X, Download, RefreshCw } from 'lucide-react-native';

// ============================================
// TYPES
// ============================================

export interface UpdateNotificationProps {
  /**
   * Whether to automatically reload after update
   * @default true
   */
  autoReload?: boolean;

  /**
   * Delay in milliseconds before auto-reloading
   * @default 3000
   */
  autoReloadDelay?: number;

  /**
   * Custom style for the container
   */
  style?: any;

  /**
   * Callback when update is applied
   */
  onUpdated?: () => void;

  /**
   * Callback when update is dismissed
   */
  onDismissed?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function UpdateNotification({
  autoReload = true,
  autoReloadDelay = 3000,
  style,
  onUpdated,
  onDismissed,
}: UpdateNotificationProps) {
  const { updateAvailable, skipWaiting } = useServiceWorker();
  const [isVisible, setIsVisible] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Show/hide notification
  useEffect(() => {
    if (updateAvailable) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [updateAvailable]);

  // Handle update button click
  const handleUpdate = async () => {
    setIsReloading(true);

    try {
      await skipWaiting();
      onUpdated?.();

      // The page will reload automatically when the new service worker activates
      // If autoReload is enabled, also trigger a manual reload as backup
      if (autoReload) {
        setTimeout(() => {
          window.location.reload();
        }, autoReloadDelay);
      }
    } catch (error) {
      console.error('[UpdateNotification] Update failed:', error);
      setIsReloading(false);
    }
  };

  // Handle dismiss button click
  const handleDismiss = () => {
    setIsVisible(false);
    onDismissed?.();
  };

  // Don't render if no update available or dismissed
  if (!isVisible || !updateAvailable) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          {isReloading ? (
            <RefreshCw size={24} color="#3b82f6" animating={true} />
          ) : (
            <Download size={24} color="#3b82f6" />
          )}
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.description}>
            {isReloading
              ? 'Mise à jour en cours...'
              : 'Une nouvelle version de NovaConnectSchool est disponible'}
          </Text>
        </View>

        {/* Action Buttons */}
        {!isReloading && (
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.updateButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>Mettre à jour</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.dismissButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Ignorer</Text>
            </Pressable>
          </View>
        )}

        {/* Close Button */}
        {!isReloading && (
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            onPress={handleDismiss}
          >
            <X size={20} color="#6b7280" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    left: 16,
    right: 16,
    zIndex: 9999,
    // Add shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // Shadow for Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  updateButton: {
    backgroundColor: '#3b82f6',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dismissButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  closeButtonPressed: {
    backgroundColor: '#e5e7eb',
  },
});

// ============================================
// EXPORTS
// ============================================

export default UpdateNotification;
