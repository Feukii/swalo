/**
 * SyncStatusScreen - Shows sync status, pending operations, and last sync time.
 * Accessible from the More menu.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  CloudOff,
} from '../components/icons/SimpleIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { getFailedCount, getTotalQueueCount } from '../db/queue';
import { syncEngine } from '../db/sync';

const Colors = {
  primary: { 900: '#1E3A8A', 700: '#1D4ED8' },
  success: '#16A34A',
  warning: '#EA580C',
  error: '#DC2626',
  muted: { foreground: '#64748B', background: '#F1F5F9' },
  border: '#E2E8F0',
};

export default function SyncStatusScreen({ navigation }: any) {
  const { isOnline, isSyncing, pendingCount, lastError, triggerSync } = useOfflineStatus();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [totalQueue, setTotalQueue] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const [sync, failed, total] = await Promise.all([
      AsyncStorage.getItem('sync_last_sync_at'),
      getFailedCount(),
      getTotalQueueCount(),
    ]);
    setLastSyncAt(sync);
    setFailedCount(failed);
    setTotalQueue(total);

    const conflicts = await syncEngine.getConflicts();
    setConflictCount(conflicts.length);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, pendingCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Jamais';
    const d = new Date(isoString);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Synchronisation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            {isOnline ? (
              <Wifi size={24} color={Colors.success} />
            ) : (
              <WifiOff size={24} color={Colors.warning} />
            )}
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Connexion</Text>
              <Text
                style={[styles.statusValue, { color: isOnline ? Colors.success : Colors.warning }]}
              >
                {isOnline ? 'En ligne' : 'Hors-ligne'}
              </Text>
            </View>
          </View>
        </View>

        {/* Last Sync */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Clock size={24} color={Colors.primary[700]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Derniere synchronisation</Text>
              <Text style={styles.statusValue}>{formatDate(lastSyncAt)}</Text>
            </View>
          </View>
        </View>

        {/* Queue Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>File d'attente</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{pendingCount}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, failedCount > 0 && { color: Colors.error }]}>
                {failedCount}
              </Text>
              <Text style={styles.statLabel}>Echouees</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalQueue}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Conflicts */}
        {conflictCount > 0 && (
          <TouchableOpacity
            style={styles.conflictCard}
            onPress={() => navigation.navigate('SyncConflicts')}
          >
            <AlertTriangle size={20} color={Colors.warning} />
            <View style={styles.conflictInfo}>
              <Text style={styles.conflictTitle}>
                {conflictCount} conflit{conflictCount > 1 ? 's' : ''} a resoudre
              </Text>
              <Text style={styles.conflictDescription}>
                Appuyez pour voir et resoudre les conflits
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Error */}
        {lastError && (
          <View style={styles.errorCard}>
            <CloudOff size={20} color={Colors.error} />
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}

        {/* Sync Button */}
        <TouchableOpacity
          style={[styles.syncButton, (!isOnline || isSyncing) && styles.syncButtonDisabled]}
          onPress={triggerSync}
          disabled={!isOnline || isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <RefreshCw size={20} color="#fff" />
          )}
          <Text style={styles.syncButtonText}>
            {isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 13, color: '#64748B' },
  statusValue: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#1E293B' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
    gap: 12,
  },
  conflictInfo: { flex: 1 },
  conflictTitle: { fontSize: 15, fontWeight: '600', color: '#9A3412' },
  conflictDescription: { fontSize: 13, color: '#C2410C', marginTop: 2 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
