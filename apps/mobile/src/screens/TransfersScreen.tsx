import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeftRight,
  Package,
  CheckCircle,
  XCircle,
  Upload,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { transfersApi } from '../lib/api';
import type { RootStackParamList } from '../../App';

// Mapping colonne fichier -> champ SWALO (apercu de classification a l'import)
interface ColumnMapping {
  fileColumn: string;
  swaloField: string;
  required: boolean;
  example: string;
}

const CATALOG_MAPPING: ColumnMapping[] = [
  { fileColumn: 'Famille', swaloField: 'Famille produit', required: true, example: 'Connecti…' },
  { fileColumn: 'Article', swaloField: 'Article', required: true, example: 'Câble' },
  { fileColumn: 'Type', swaloField: "Type d'article", required: true, example: 'USB-C' },
  { fileColumn: 'Marque', swaloField: 'Marque', required: true, example: 'Oraimo' },
  { fileColumn: 'Cond.', swaloField: 'Conditionnement', required: true, example: 'Carton' },
  { fileColumn: 'Sous-cond.', swaloField: 'Pièces / cart…', required: true, example: '24' },
  { fileColumn: 'P. revient', swaloField: 'Prix de revient', required: true, example: '920' },
  { fileColumn: 'P. vente', swaloField: 'Prix de vente', required: true, example: '1 500' },
];

interface Transfer {
  id: string;
  status: string;
  notes?: string;
  created_at: string;
  source_shop: { id: string; code: string; name: string; shop_type?: string };
  target_shop: { id: string; code: string; name: string; shop_type?: string };
  creator: { id: string; display_name: string };
  items: Array<{
    id: string;
    product_sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
    total: number;
  }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  DRAFT: { label: 'Brouillon', variant: 'warning' },
  CONFIRMED: { label: 'Confirme', variant: 'info' },
  SHIPPED: { label: 'Expedie', variant: 'info' },
  RECEIVED: { label: 'Recu', variant: 'success' },
  CANCELLED: { label: 'Annule', variant: 'danger' },
};

interface TransfersScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Transfers'>;
}

type TransferFilter = 'all' | 'pending' | 'completed';

const FILTER_TABS: Array<{ key: TransferFilter; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En cours' },
  { key: 'completed', label: 'Terminés' },
];

export default function TransfersScreen({ navigation }: TransfersScreenProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TransferFilter>('all');
  // Fichier catalogue selectionne pour l'import (nom affiche dans le chip)
  const [importFileName, setImportFileName] = useState<string | null>('catalogue_juin.xlsx');

  const handleBrowseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setImportFileName(asset.name);
      // TODO: brancher importApi.previewCatalog/confirmCatalog pour l'import du catalogue
      Alert.alert('Fichier selectionne', asset.name);
    } catch {
      Alert.alert('Erreur', 'Impossible de selectionner le fichier.');
    }
  };

  const loadTransfers = useCallback(async () => {
    try {
      const data = await transfersApi.getAll<Transfer>();
      setTransfers(data);
    } catch (error: unknown) {
      console.error('Erreur chargement transferts:', error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        Alert.alert('Session expiree', 'Veuillez vous reconnecter.', [
          { text: 'OK', onPress: () => navigation.replace('LoginPin') },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadTransfers();
    }, [loadTransfers])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  }, [loadTransfers]);

  const handleAction = async (
    transfer: Transfer,
    action: 'confirm' | 'ship' | 'receive' | 'cancel'
  ) => {
    const actionLabels: Record<string, { title: string; message: string; destructive?: boolean }> =
      {
        confirm: {
          title: 'Confirmer le transfert',
          message:
            'Le stock sera deduit de la boutique source et ajoute a la boutique cible. Confirmer ?',
        },
        ship: {
          title: 'Marquer comme expedie',
          message: "Confirmer l'expedition du transfert ?",
        },
        receive: {
          title: 'Confirmer la reception',
          message: 'Confirmer la reception du transfert ?',
        },
        cancel: {
          title: 'Annuler le transfert',
          message: 'Le stock sera restaure si deja confirme. Cette action est irreversible.',
          destructive: true,
        },
      };

    const config = actionLabels[action];

    Alert.alert(config.title, config.message, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: config.destructive ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await transfersApi[action](transfer.id);
            Alert.alert('Succes', `Transfert ${config.title.toLowerCase()} avec succes`);
            loadTransfers();
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '';
            Alert.alert('Erreur', message || "Erreur lors de l'operation");
          }
        },
      },
    ]);
  };

  const getTransferTotal = (transfer: Transfer) => {
    return transfer.items.reduce((sum, item) => sum + item.total, 0);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const stats = {
    total: transfers.length,
    pending: transfers.filter(t => ['DRAFT', 'CONFIRMED', 'SHIPPED'].includes(t.status)).length,
    completed: transfers.filter(t => t.status === 'RECEIVED').length,
  };

  const renderTransferCard = (transfer: Transfer) => {
    const total = getTransferTotal(transfer);
    const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
    const itemCount = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <View key={transfer.id} style={styles.transferCard}>
        <View style={styles.transferHeader}>
          <View style={styles.transferIcon}>
            <ArrowLeftRight size={20} color={Colors.action} />
          </View>
          <View style={styles.transferDirection}>
            <Text style={styles.shopName} numberOfLines={1}>
              {transfer.source_shop.name}
              <Text style={styles.shopArrow}> → </Text>
              {transfer.target_shop.name}
            </Text>
            <Text style={styles.transferDate}>{formatDate(transfer.created_at)}</Text>
          </View>
          <StatusBadge text={statusConfig.label} variant={statusConfig.variant} />
        </View>

        <View style={styles.transferInfo}>
          <Text style={styles.transferMeta}>
            {transfer.items.length} article{transfer.items.length > 1 ? 's' : ''} · {itemCount}{' '}
            unite{itemCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.transferTotal}>{formatMoney(total)}</Text>
        </View>

        {transfer.notes ? (
          <Text style={styles.transferNotes} numberOfLines={1}>
            {transfer.notes}
          </Text>
        ) : null}

        <View style={styles.transferActions}>
          {transfer.status === 'DRAFT' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.confirmBtn]}
                onPress={() => handleAction(transfer, 'confirm')}
              >
                <CheckCircle size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleAction(transfer, 'cancel')}
              >
                <XCircle size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
          {transfer.status === 'CONFIRMED' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shipBtn]}
                onPress={() => handleAction(transfer, 'ship')}
              >
                <Package size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Expedier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleAction(transfer, 'cancel')}
              >
                <XCircle size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
          {transfer.status === 'SHIPPED' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.receiveBtn]}
              onPress={() => handleAction(transfer, 'receive')}
            >
              <CheckCircle size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Confirmer reception</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredTransfers = transfers.filter(t => {
    if (filter === 'pending') {
      return ['DRAFT', 'CONFIRMED', 'SHIPPED'].includes(t.status);
    }
    if (filter === 'completed') {
      return t.status === 'RECEIVED';
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Transferts & import"
        subtitle="Inter-boutiques & catalogue"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[900]}
          />
        }
      >
        {/* IMPORT CATALOGUE */}
        <View style={styles.importSection}>
          <Text style={styles.sectionHeader}>IMPORT CATALOGUE</Text>

          {/* Dropzone */}
          <View style={styles.dropzone}>
            <View style={styles.dropzoneIcon}>
              <Upload size={26} color={Colors.action} />
            </View>
            <Text style={styles.dropzoneTitle}>Importer un fichier CSV / Excel</Text>
            <Text style={styles.dropzoneHelper}>
              Glissez votre catalogue ou parcourez vos fichiers. Colonnes détectées automatiquement.
            </Text>
            <TouchableOpacity style={styles.browseBtn} onPress={handleBrowseFile}>
              <Text style={styles.browseBtnText}>Parcourir</Text>
            </TouchableOpacity>
          </View>

          {/* Classification + mapping (visible uniquement si un fichier est selectionne) */}
          {importFileName ? (
            <>
              <View style={styles.classificationRow}>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>2</Text>
                </View>
                <Text style={styles.classificationTitle}>Classification obligatoire</Text>
                <View style={styles.fileChip}>
                  <Text style={styles.fileChipText} numberOfLines={1}>
                    {importFileName}
                  </Text>
                </View>
              </View>

              <View style={styles.mappingTable}>
                <View style={styles.mappingHeaderRow}>
                  <Text style={[styles.mappingHeaderCell, styles.colFile]}>COLONNE FICHIER</Text>
                  <Text style={[styles.mappingHeaderCell, styles.colField]}>CHAMP SWALO</Text>
                  <Text style={[styles.mappingHeaderCell, styles.colExample]}>EXEMPLE</Text>
                </View>
                {CATALOG_MAPPING.map(row => (
                  <View key={row.fileColumn} style={styles.mappingRow}>
                    <Text style={[styles.mappingFileText, styles.colFile]} numberOfLines={1}>
                      {row.fileColumn}
                    </Text>
                    <View style={[styles.colField, styles.mappingFieldCell]}>
                      <Text style={styles.mappingArrow}>→</Text>
                      <Text style={styles.mappingFieldText} numberOfLines={1}>
                        {row.swaloField}
                        {row.required ? <Text style={styles.requiredStar}> *</Text> : null}
                      </Text>
                    </View>
                    <Text style={[styles.mappingExampleText, styles.colExample]} numberOfLines={1}>
                      {row.example}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* HERO MARINE — Transferts en attente */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Transferts en attente</Text>
          <Text style={styles.heroAmount}>{stats.pending}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>Total</Text>
              <Text style={styles.heroStatValue}>{stats.total}</Text>
            </View>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>Terminés</Text>
              <Text style={[styles.heroStatValue, styles.heroStatPositive]}>{stats.completed}</Text>
            </View>
          </View>
        </View>

        {/* SEGMENTS */}
        <View style={styles.chipsRow}>
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Transfer List */}
        <View style={styles.section}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.action} />
            </View>
          ) : filteredTransfers.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <ArrowLeftRight size={32} color={Colors.action} />
              </View>
              <Text style={styles.emptyText}>Aucun transfert</Text>
              <Text style={styles.emptySubtext}>
                Les transferts inter-boutiques apparaitront ici
              </Text>
            </View>
          ) : (
            filteredTransfers.map(renderTransferCard)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.xl,
  },
  // IMPORT CATALOGUE
  importSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.textColors.tertiary,
  },
  dropzone: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    borderStyle: 'dashed',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dropzoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  dropzoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  dropzoneHelper: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  browseBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.action,
    borderRadius: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  browseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  classificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.action,
  },
  classificationTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  fileChip: {
    maxWidth: 130,
  },
  fileChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.action,
  },
  mappingTable: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  mappingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mappingHeaderCell: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.textColors.tertiary,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colFile: {
    flex: 1.1,
  },
  colField: {
    flex: 1.5,
  },
  colExample: {
    flex: 0.9,
    textAlign: 'right',
  },
  mappingFileText: {
    fontSize: 13,
    color: Colors.text,
  },
  mappingFieldCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mappingArrow: {
    fontSize: 13,
    color: Colors.success.main,
    fontWeight: '700',
  },
  mappingFieldText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  requiredStar: {
    color: Colors.danger.main,
    fontWeight: '700',
  },
  mappingExampleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  // HERO MARINE
  hero: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.action,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
  },
  heroStatCol: {
    flex: 1,
    gap: 4,
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onMarine,
    fontVariant: ['tabular-nums'],
  },
  heroStatPositive: {
    color: Colors.success.main,
  },
  // SEGMENTS / CHIPS
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.info.background,
    borderColor: Colors.action,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  chipTextActive: {
    color: Colors.action,
  },
  // LIST
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  transferCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  transferIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferDirection: {
    flex: 1,
    gap: 2,
  },
  shopName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.text,
  },
  shopArrow: {
    color: Colors.action,
    fontWeight: '700',
  },
  transferInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  transferDate: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  transferMeta: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
  },
  transferTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary[900],
    marginLeft: 'auto',
    fontVariant: ['tabular-nums'],
  },
  transferNotes: {
    fontSize: 12,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  transferActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: Colors.action,
  },
  shipBtn: {
    backgroundColor: Colors.action,
  },
  receiveBtn: {
    backgroundColor: Colors.success.main,
  },
  cancelBtn: {
    backgroundColor: Colors.danger.main,
  },
});
