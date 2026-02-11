/**
 * OfflineBanner - Visual indicator shown when the device is offline.
 * Displays pending operation count and sync status.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export function OfflineBanner(): React.ReactElement | null {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useOfflineStatus();

  // Don't show anything if online and no pending operations
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  // Show syncing indicator when online with pending changes
  if (isOnline && (isSyncing || pendingCount > 0)) {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <RefreshCw size={16} color="#fff" />
        )}
        <Text style={styles.bannerText}>
          {isSyncing
            ? 'Synchronisation en cours...'
            : `${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente`}
        </Text>
        {!isSyncing && pendingCount > 0 && (
          <TouchableOpacity onPress={triggerSync} style={styles.syncButton}>
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show offline banner
  return (
    <View style={[styles.banner, styles.offlineBanner]}>
      <WifiOff size={16} color="#fff" />
      <Text style={styles.bannerText}>
        Mode hors-ligne
        {pendingCount > 0
          ? ` - ${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineBanner: {
    backgroundColor: '#EA580C', // Orange-600
  },
  syncingBanner: {
    backgroundColor: '#2563EB', // Blue-600
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
