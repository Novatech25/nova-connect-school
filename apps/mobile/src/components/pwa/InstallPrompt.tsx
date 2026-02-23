/**
 * InstallPrompt Component
 *
 * Modal/banner for prompting users to install the PWA.
 * Displays only when the app is installable and not already installed.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { usePWA } from '../../hooks/usePWA';
import { X, Download } from 'lucide-react-native';

// ============================================
// TYPES
// ============================================

export interface InstallPromptProps {
  /**
   * Whether to show the prompt automatically
   * @default true
   */
  autoShow?: boolean;

  /**
   * Number of days to wait before showing the prompt again after dismissal
   * @default 7
   */
  dismissalDays?: number;

  /**
   * Custom style for the container
   */
  style?: any;

  /**
   * Callback when PWA is installed
   */
  onInstalled?: () => void;

  /**
   * Callback when prompt is dismissed
   */
  onDismissed?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function InstallPrompt({
  autoShow = true,
  dismissalDays = 7,
  style,
  onInstalled,
  onDismissed,
}: InstallPromptProps) {
  const { isInstallable, isInstalled, installPWA } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Storage key for dismissal timestamp
  const DISMISSAL_STORAGE_KEY = 'pwa-install-prompt-dismissed';

  // Check if prompt was previously dismissed
  const wasPromptDismissed = (): boolean => {
    try {
      const dismissedTimestamp = localStorage.getItem(DISMISSAL_STORAGE_KEY);
      if (!dismissedTimestamp) return false;

      const dismissedTime = parseInt(dismissedTimestamp, 10);
      const daysSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      return daysSinceDismissal < dismissalDays;
    } catch (error) {
      console.error('[InstallPrompt] Failed to check dismissal status:', error);
      return false;
    }
  };

  // Save dismissal timestamp
  const savePromptDismissal = (): void => {
    try {
      localStorage.setItem(DISMISSAL_STORAGE_KEY, Date.now().toString());
    } catch (error) {
      console.error('[InstallPrompt] Failed to save dismissal:', error);
    }
  };

  // Show the prompt
  const showPrompt = () => {
    if (isInstallable && !isInstalled && !wasPromptDismissed()) {
      setIsAnimating(true);
      setTimeout(() => setIsVisible(true), 50);
    }
  };

  // Hide the prompt
  const hidePrompt = () => {
    setIsVisible(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Handle install button click
  const handleInstall = async () => {
    try {
      await installPWA();
      hidePrompt();
      onInstalled?.();
    } catch (error) {
      console.error('[InstallPrompt] Installation failed:', error);
    }
  };

  // Handle dismiss button click
  const handleDismiss = () => {
    savePromptDismissal();
    hidePrompt();
    onDismissed?.();
  };

  // Auto-show prompt when conditions are met
  useEffect(() => {
    if (autoShow) {
      // Delay showing the prompt slightly for better UX
      const timer = setTimeout(() => {
        showPrompt();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, autoShow]);

  // Don't render if not installable, already installed, or not animating
  if (!isAnimating || !isVisible || isInstalled) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <Download size={32} color="#3b82f6" />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Installer NovaConnectSchool</Text>
          <Text style={styles.description}>
            Installez l'application sur votre appareil pour un accès rapide et hors ligne
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.installButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleInstall}
          >
            <Text style={styles.installButtonText}>Installer</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.dismissButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDismiss}
          >
            <Text style={styles.dismissButtonText}>Plus tard</Text>
          </Pressable>
        </View>

        {/* Close Button */}
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          onPress={handleDismiss}
        >
          <X size={20} color="#6b7280" />
        </Pressable>
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
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    // Add shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
    width: 56,
    height: 56,
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
    marginBottom: 4,
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
  installButton: {
    backgroundColor: '#3b82f6',
  },
  installButtonText: {
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

export default InstallPrompt;
