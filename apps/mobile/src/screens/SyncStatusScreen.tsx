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
import { Colors, Spacing, Shadows } from '../constants/theme-v2';

interface SyncStatusScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: 'SyncConflicts') => void;
  };
}

export default function SyncStatusScreen({ navigation }: SyncStatusScreenProps) {
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <ArrowLeft size={24} color={Colors.action} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Synchronisation</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            {isOnline ? (
              <Wifi size={24} color={Colors.success.main} />
            ) : (
              <WifiOff size={24} color={Colors.warning.main} />
            )}
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Connexion</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: isOnline ? Colors.success.main : Colors.warning.main },
                ]}
              >
                {isOnline ? 'En ligne' : 'Hors-ligne'}
              </Text>
            </View>
          </View>
        </View>

        {/* Last Sync */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Clock size={24} color={Colors.action} />
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
              <Text style={[styles.statNumber, failedCount > 0 && { color: Colors.danger.main }]}>
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
            <AlertTriangle size={20} color={Colors.warning.main} />
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
            <CloudOff size={20} color={Colors.danger.main} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: Spacing.lg },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 13, color: Colors.textColors.tertiary },
  statusValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  section: { marginTop: Spacing.xs, marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textColors.tertiary, marginTop: 4 },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning.background,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  conflictInfo: { flex: 1 },
  conflictTitle: { fontSize: 15, fontWeight: '600', color: Colors.warning.text },
  conflictDescription: { fontSize: 13, color: Colors.warning.text, marginTop: 2 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger.background,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger.text },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.action,
    borderRadius: 12,
    padding: Spacing.lg,
    minHeight: 48,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing['3xl'],
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: Colors.surface, fontSize: 16, fontWeight: '600' },
});
