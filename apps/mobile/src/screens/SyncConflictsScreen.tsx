/**
 * SyncConflictsScreen - Display and resolve sync conflicts.
 * Allows user to accept server version or force client version.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Server,
  Smartphone,
} from '../components/icons/SimpleIcons';
import { syncEngine } from '../db/sync';
import { retryMutation } from '../db/queue';

interface ConflictRecord {
  id: string;
  entity: string;
  entity_id: string;
  reason: string;
  client_data: string | null;
  server_data: string | null;
  mutation_id: string | null;
  resolved: number;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
}

const ENTITY_LABELS: Record<string, string> = {
  products: 'Produit',
  stock_batches: 'Lot de stock',
  customers: 'Client',
  sales: 'Vente',
  sale_items: 'Article de vente',
  cash_entries: 'Entree de caisse',
  inventory_movements: 'Mouvement de stock',
};

export default function SyncConflictsScreen({ navigation }: any) {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadConflicts = useCallback(async () => {
    const data = await syncEngine.getConflicts();
    setConflicts(data as ConflictRecord[]);
  }, []);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConflicts();
    setRefreshing(false);
  }, [loadConflicts]);

  const handleAcceptServer = useCallback(
    async (conflict: ConflictRecord) => {
      Alert.alert(
        'Accepter la version serveur',
        'Vos modifications locales seront perdues. Continuer ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Accepter',
            style: 'destructive',
            onPress: async () => {
              await syncEngine.resolveConflict(conflict.id, 'accept_server');
              await loadConflicts();
            },
          },
        ]
      );
    },
    [loadConflicts]
  );

  const handleForceClient = useCallback(
    async (conflict: ConflictRecord) => {
      // Check if this is a financial operation that can't be forced
      const financialEntities = ['sales', 'cash_entries'];
      if (financialEntities.includes(conflict.entity) && conflict.reason.includes('stock')) {
        Alert.alert(
          'Operation impossible',
          'Cette operation ne peut pas etre forcee car le stock est insuffisant sur le serveur.'
        );
        return;
      }

      Alert.alert(
        'Forcer la version locale',
        'La version du serveur sera ecrasee par votre version. Continuer ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Forcer',
            style: 'destructive',
            onPress: async () => {
              // Retry the mutation
              if (conflict.mutation_id) {
                await retryMutation(conflict.mutation_id);
              }
              await syncEngine.resolveConflict(conflict.id, 'force_client');
              await loadConflicts();
              // Trigger sync to push the retried mutation
              syncEngine.fullSync().catch(() => undefined);
            },
          },
        ]
      );
    },
    [loadConflicts]
  );

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderConflict = ({ item }: { item: ConflictRecord }) => (
    <View style={styles.conflictCard}>
      <View style={styles.conflictHeader}>
        <AlertTriangle size={18} color="#EA580C" />
        <Text style={styles.conflictEntity}>{ENTITY_LABELS[item.entity] || item.entity}</Text>
        <Text style={styles.conflictDate}>{formatDate(item.created_at)}</Text>
      </View>

      <Text style={styles.conflictReason}>{item.reason}</Text>
      <Text style={styles.conflictId}>ID: {item.entity_id.substring(0, 8)}...</Text>

      <View style={styles.conflictActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptServer(item)}
        >
          <Server size={14} color="#fff" />
          <Text style={styles.actionButtonText}>Accepter serveur</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.forceButton]}
          onPress={() => handleForceClient(item)}
        >
          <Smartphone size={14} color="#fff" />
          <Text style={styles.actionButtonText}>Forcer local</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conflits de synchronisation</Text>
        <View style={{ width: 24 }} />
      </View>

      {conflicts.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color="#16A34A" />
          <Text style={styles.emptyTitle}>Aucun conflit</Text>
          <Text style={styles.emptyDescription}>Toutes vos donnees sont synchronisees.</Text>
        </View>
      ) : (
        <FlatList
          data={conflicts}
          keyExtractor={item => item.id}
          renderItem={renderConflict}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
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
  list: { padding: 16 },
  conflictCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  conflictEntity: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  conflictDate: { fontSize: 12, color: '#64748B' },
  conflictReason: { fontSize: 14, color: '#9A3412', marginBottom: 4 },
  conflictId: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: { backgroundColor: '#2563EB' },
  forceButton: { backgroundColor: '#EA580C' },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptyDescription: { fontSize: 14, color: '#64748B', marginTop: 4 },
});
