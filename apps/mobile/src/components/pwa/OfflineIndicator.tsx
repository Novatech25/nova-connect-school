/**
 * OfflineIndicator Component
 *
 * Visual indicator showing the offline status and pending sync operations.
 * Displays when the app is offline or has operations waiting to sync.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { usePWA } from '../../hooks/usePWA';
import { useServiceWorker } from '../../hooks/useServiceWorker';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react-native';

// ============================================
// TYPES
// ============================================

export interface OfflineIndicatorProps {
  /**
   * Whether to show the indicator automatically
   * @default true
   */
  autoShow?: boolean;

  /**
   * Custom style for the container
   */
  style?: any;

  /**
   * Callback when sync button is pressed
   */
  onSync?: () => void;

  /**
   * Whether to integrate with useOfflineQueue hook
   * @default true
   */
  useQueueStats?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function OfflineIndicator({
  autoShow = true,
  style,
  onSync,
  useQueueStats = true,
}: OfflineIndicatorProps) {
  const { isOffline } = usePWA();
  const { getQueueStats, syncNow, isReady: swReady } = useServiceWorker();

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load queue stats on mount and when offline status changes
  useEffect(() => {
    if (!useQueueStats || !swReady) {
      return;
    }

    loadQueueStats();

    // Refresh queue stats every 5 seconds when offline
    if (isOffline) {
      const interval = setInterval(loadQueueStats, 5000);
      return () => clearInterval(interval);
    }
  }, [isOffline, swReady, useQueueStats]);

  // Listen for queue updates
  useEffect(() => {
    if (!useQueueStats) return;

    const handleQueueUpdate = async () => {
      await loadQueueStats();
    };

    // Listen for queue updates from service worker
    const cleanup = window.navigator.serviceWorker?.addEventListener(
      'message',
      (event) => {
        if (event.data?.type === 'QUEUE_UPDATED') {
          handleQueueUpdate();
        }
      }
    );

    return () => {
      if (cleanup) {
        window.navigator.serviceWorker?.removeEventListener('message', cleanup);
      }
    };
  }, [useQueueStats]);

  // Load queue statistics from service worker
  const loadQueueStats = async () => {
    if (!swReady) return;

    try {
      const stats = await getQueueStats();
      setPendingCount(stats.count);
    } catch (error) {
      console.error('[OfflineIndicator] Failed to load queue stats:', error);
    }
  };

  // Handle sync button press
  const handleSync = async () => {
    if (isSyncing || !swReady) return;

    setIsSyncing(true);

    try {
      await syncNow();
      onSync?.();

      // Reload queue stats after sync
      setTimeout(() => {
        loadQueueStats();
        setIsSyncing(false);
      }, 1000);
    } catch (error) {
      console.error('[OfflineIndicator] Sync failed:', error);
      setIsSyncing(false);
    }
  };

  // Don't render if online and no pending operations
  if (!isOffline && pendingCount === 0 && !autoShow) {
    return null;
  }

  // Don't render if syncing but nothing to sync
  if (!isOffline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const hasPendingOps = pendingCount > 0;
  const showSyncButton = hasPendingOps && !isOffline;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.badge, isOffline && styles.offlineBadge]}>
        {/* Icon */}
        {isOffline ? (
          <WifiOff size={16} color="#ef4444" />
        ) : hasPendingOps ? (
          <AlertCircle size={16} color="#f59e0b" />
        ) : (
          <CheckCircle2 size={16} color="#10b981" />
        )}

        {/* Text */}
        <Text style={[styles.text, isOffline && styles.offlineText]}>
          {isSyncing
            ? 'Synchronisation...'
            : isOffline
            ? 'Mode hors ligne'
            : hasPendingOps
            ? `${pendingCount} op. en attente`
            : 'Synchronisé'}
        </Text>

        {/* Sync Button (optional) */}
        {showSyncButton && !isSyncing && (
          <Pressable
            style={({ pressed }) => [
              styles.syncButton,
              pressed && styles.syncButtonPressed,
            ]}
            onPress={handleSync}
          >
            <RefreshCw size={14} color="#3b82f6" />
          </Pressable>
        )}

        {/* Syncing Indicator */}
        {isSyncing && (
          <View style={styles.syncingSpinner}>
            <RefreshCw size={14} color="#3b82f6" animating={true} />
          </View>
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
    zIndex: 9998,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: 8,
  },
  offlineBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  offlineText: {
    color: '#dc2626',
  },
  syncButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  syncButtonPressed: {
    opacity: 0.7,
  },
  syncingSpinner: {
    padding: 4,
  },
});

// ============================================
// COMPACT VARIANT
// ============================================

export interface OfflineIndicatorCompactProps {
  style?: any;
}

/**
 * Compact version of the offline indicator (badge only)
 */
export function OfflineIndicatorCompact({ style }: OfflineIndicatorCompactProps) {
  const { isOffline } = usePWA();
  const { getQueueStats, swReady } = useServiceWorker();

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!swReady) return;

    const loadStats = async () => {
      try {
        const stats = await getQueueStats();
        setPendingCount(stats.count);
      } catch (error) {
        console.error('[OfflineIndicatorCompact] Failed to load stats:', error);
      }
    };

    loadStats();

    if (isOffline) {
      const interval = setInterval(loadStats, 5000);
      return () => clearInterval(interval);
    }
  }, [isOffline, swReady]);

  // Don't render if online and no pending operations
  if (!isOffline && pendingCount === 0) {
    return null;
  }

  const totalBadges = (isOffline ? 1 : 0) + (pendingCount > 0 ? 1 : 0);

  return (
    <View style={[styles.compactContainer, style]}>
      {isOffline && (
        <View style={[styles.compactBadge, styles.compactOfflineBadge]}>
          <WifiOff size={12} color="#ef4444" />
        </View>
      )}
      {pendingCount > 0 && (
        <View style={[styles.compactBadge, styles.compactPendingBadge]}>
          <Text style={styles.compactBadgeText}>{pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

const compactStyles = StyleSheet.create({
  compactContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    right: 16,
    zIndex: 9998,
    flexDirection: 'row',
    gap: 8,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  compactOfflineBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  compactPendingBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  compactBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
});

// ============================================
// EXPORTS
// ============================================

export default OfflineIndicator;
