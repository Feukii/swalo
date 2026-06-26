import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Package, Plus, Minus, AlertTriangle, ChevronRight } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { usePermissions } from '../hooks/usePermissions';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  productRepo,
  stockBatchRepo,
  inventoryMovementRepo,
  LocalStockBatch,
  LocalInventoryMovement,
} from '../db/repositories';
import { generateId } from '../db/repository';
import { createStockBatchOffline, updateProductOffline } from '../db/offlineWrite';
import { getDeviceInfo } from '../lib/deviceInfo';

interface ProductDetailsScreenProps {
  navigation: {
    goBack: () => void;
  };
  route: {
    params: {
      id: string;
    };
  };
}

interface ProductDetail {
  id: string;
  name: string;
  family: string | null;
  article_type: string | null;
  brand: string | null;
  reference: string | null;
  unit: string;
  sell_price: number;
  alert_threshold: number;
}

/** Motifs de sortie de stock (FIFO). */
const EXIT_REASONS = [
  { value: 'Vente comptoir', label: 'Vente comptoir' },
  { value: 'Perte / casse', label: 'Perte / casse' },
  { value: 'Inventaire', label: 'Inventaire' },
  { value: 'Retour fournisseur', label: 'Retour four.' },
] as const;

type EntryDateChoice = 'today' | 'yesterday' | 'week';

function getErrorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return undefined;
}

function formatBatchDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildBreadcrumb(p: ProductDetail): string {
  const parts = [p.family, p.article_type, p.brand].filter((v): v is string =>
    Boolean(v && v.trim())
  );
  return parts.join(' › ');
}

export default function ProductDetailsScreen({ navigation, route }: ProductDetailsScreenProps) {
  const { id } = route.params;
  const { can } = usePermissions();
  const { shopId } = useCurrentUser();
  const canEditProduct = can('products', 'edit');

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [batches, setBatches] = useState<LocalStockBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sheets
  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [showThresholdSheet, setShowThresholdSheet] = useState(false);

  // Entrée form
  const [entryQty, setEntryQty] = useState('');
  const [entryCost, setEntryCost] = useState('');
  const [entryDate, setEntryDate] = useState<EntryDateChoice>('today');

  // Sortie form
  const [exitQty, setExitQty] = useState('');
  const [exitReason, setExitReason] = useState<string>(EXIT_REASONS[0].value);

  // Seuil form
  const [thresholdValue, setThresholdValue] = useState('');

  const loadProduct = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const local = await productRepo.getById(id);
      if (!local) {
        Alert.alert('Erreur', 'Produit introuvable');
        navigation.goBack();
        return;
      }
      setProduct({
        id: local.id,
        name: local.name,
        family: local.family,
        article_type: local.article_type,
        brand: local.brand,
        reference: local.reference,
        unit: local.unit,
        sell_price: local.sell_price,
        alert_threshold: local.alert_threshold,
      });
      const localBatches = await stockBatchRepo.getByProduct(shopId, id, false);
      setBatches(localBatches);
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de charger le produit');
    } finally {
      setIsLoading(false);
    }
  }, [id, shopId, navigation]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  // Dérivés (valorisation FIFO)
  const activeBatches = batches.filter(b => b.remaining_quantity > 0);
  const currentStock = activeBatches.reduce((s, b) => s + b.remaining_quantity, 0);
  const stockValue = activeBatches.reduce((s, b) => s + b.remaining_quantity * b.cost_price, 0);
  const pmp = currentStock > 0 ? Math.round(stockValue / currentStock) : 0;
  const sellPrice = product?.sell_price ?? 0;
  const margin = sellPrice - pmp;
  const marginPct = sellPrice > 0 ? Math.round((margin / sellPrice) * 100) : 0;
  const isLowStock = product ? currentStock <= product.alert_threshold : false;
  const statusLabel = isLowStock ? 'Stock bas' : 'En stock';

  const resetEntryForm = () => {
    setEntryQty('');
    setEntryCost('');
    setEntryDate('today');
  };

  const resetExitForm = () => {
    setExitQty('');
    setExitReason(EXIT_REASONS[0].value);
  };

  const openEntrySheet = () => {
    resetEntryForm();
    setShowEntrySheet(true);
  };

  const openExitSheet = () => {
    resetExitForm();
    setShowExitSheet(true);
  };

  const openThresholdSheet = () => {
    if (!product) return;
    setThresholdValue(String(product.alert_threshold));
    setShowThresholdSheet(true);
  };

  const computeEntryDateISO = (choice: EntryDateChoice): string => {
    const d = new Date();
    if (choice === 'yesterday') d.setDate(d.getDate() - 1);
    else if (choice === 'week') d.setDate(d.getDate() - 7);
    return d.toISOString();
  };

  // Entrée de stock → crée un lot daté (réception, nouveau prix de revient)
  const handleSubmitEntry = async () => {
    if (!product || !shopId) return;
    const qty = parseInt(entryQty, 10);
    const cost = parseInt(entryCost, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de revient valide');
      return;
    }

    setIsSubmitting(true);
    try {
      // La date de prise en compte est propagée au lot (local + serveur via la sync)
      await createStockBatchOffline({
        shopId,
        productId: product.id,
        quantity: qty,
        costPrice: cost,
        sellPrice: product.sell_price,
        notes: 'Réception',
        priceValidFrom: computeEntryDateISO(entryDate),
      });

      setShowEntrySheet(false);
      resetEntryForm();
      await loadProduct();
      Alert.alert('Succès', 'Réception enregistrée');
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? "Impossible d'enregistrer la réception");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sortie de stock (FIFO) + enregistrement du mouvement avec motif
  const handleSubmitExit = async () => {
    if (!product || !shopId) return;
    const qty = parseInt(exitQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide');
      return;
    }
    if (qty > currentStock) {
      Alert.alert('Erreur', `Stock insuffisant (${currentStock} ${product.unit} disponibles)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const deductions = await stockBatchRepo.deductFIFO(shopId, product.id, qty);
      const totalDeducted = deductions.reduce((s, d) => s + d.deducted, 0);

      const deviceInfo = await getDeviceInfo();
      const movement: Partial<LocalInventoryMovement> = {
        id: generateId(),
        shop_id: shopId,
        product_id: product.id,
        type: 'OUT',
        qty: totalDeducted,
        reason: exitReason,
        ref_type: 'manual',
        ref_id: null,
        unit_cost: pmp,
        device_id: deviceInfo.device_id,
        client_op_id: `inv_out_${product.id}_${Date.now()}`,
        version: 1,
      };
      await inventoryMovementRepo.create(movement);

      setShowExitSheet(false);
      resetExitForm();
      await loadProduct();
      Alert.alert('Succès', 'Sortie enregistrée');
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? "Impossible d'enregistrer la sortie");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitThreshold = async () => {
    if (!product) return;
    const value = parseInt(thresholdValue, 10);
    if (isNaN(value) || value < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un seuil valide');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProductOffline(product.id, { alertThreshold: value });
      setShowThresholdSheet(false);
      await loadProduct();
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de mettre à jour le seuil');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !product) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Produit" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  const breadcrumb = buildBreadcrumb(product);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={product.name}
        subtitle={breadcrumb || undefined}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* CARTE PRODUIT */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardIcon}>
              <Package size={22} color={Colors.action} />
            </View>
            <View style={styles.cardTitleBlock}>
              <Text style={styles.cardName} numberOfLines={1}>
                {product.name}
              </Text>
              {breadcrumb ? (
                <Text style={styles.cardBreadcrumb} numberOfLines={1}>
                  {breadcrumb}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.statusBadge,
                isLowStock ? styles.statusBadgeLow : styles.statusBadgeOk,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isLowStock ? styles.statusBadgeTextLow : styles.statusBadgeTextOk,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Stock actuel</Text>
              <Text style={styles.metricValue}>
                {currentStock}
                <Text style={styles.metricUnit}> {product.unit}</Text>
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Valeur du stock</Text>
              <Text style={styles.metricValue}>{formatMoney(stockValue)}</Text>
            </View>
          </View>

          <View style={[styles.metricsRow, styles.metricsRowBordered]}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Prix de revient (PMP)</Text>
              <Text style={styles.metricValue}>{formatMoney(pmp)}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Prix de vente · marge</Text>
              <Text style={styles.metricValue}>
                {formatMoney(sellPrice)}{' '}
                <Text
                  style={[styles.marginText, margin >= 0 ? styles.marginPos : styles.marginNeg]}
                >
                  · {marginPct}%
                </Text>
              </Text>
            </View>
          </View>

          {/* Seuil d'alerte (tapable pour éditer) */}
          <TouchableOpacity
            style={styles.thresholdRow}
            onPress={openThresholdSheet}
            disabled={!canEditProduct}
            activeOpacity={canEditProduct ? 0.7 : 1}
          >
            <AlertTriangle size={18} color={Colors.warning.main} />
            <Text style={styles.thresholdLabel}>Seuil d&apos;alerte</Text>
            <Text style={styles.thresholdValue}>
              {product.alert_threshold} {product.unit}
            </Text>
            {canEditProduct ? <ChevronRight size={18} color={Colors.warning.main} /> : null}
          </TouchableOpacity>
        </View>

        {/* BOUTONS ENTRÉE / SORTIE */}
        {canEditProduct ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonEntry]}
              onPress={openEntrySheet}
            >
              <View style={[styles.actionIcon, styles.actionIconEntry]}>
                <Plus size={16} color={Colors.success.foreground} />
              </View>
              <Text style={[styles.actionButtonText, styles.actionButtonTextEntry]}>Entrée</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonExit]}
              onPress={openExitSheet}
            >
              <View style={[styles.actionIcon, styles.actionIconExit]}>
                <Minus size={16} color={Colors.danger.foreground} />
              </View>
              <Text style={[styles.actionButtonText, styles.actionButtonTextExit]}>Sortie</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* PRIX DE REVIENT & LOTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIX DE REVIENT &amp; LOTS</Text>
          <Text style={styles.sectionSubtitle}>
            Chaque réception fixe un prix de revient daté. Le coût d&apos;un même article évolue
            dans le temps (sortie FIFO).
          </Text>

          <View style={styles.lotsCard}>
            <View style={styles.lotsHeader}>
              <Text style={[styles.lotsHeaderCell, styles.lotsColDate]}>
                DATE DE PRISE EN COMPTE
              </Text>
              <Text style={[styles.lotsHeaderCell, styles.lotsColQty]}>QTÉ</Text>
              <Text style={[styles.lotsHeaderCell, styles.lotsColPrice]}>PRIX DE REVIENT</Text>
            </View>

            {activeBatches.length === 0 ? (
              <View style={styles.lotsEmpty}>
                <Package size={28} color={Colors.muted.foreground} />
                <Text style={styles.lotsEmptyText}>Aucun lot en stock</Text>
              </View>
            ) : (
              activeBatches.map(batch => (
                <View key={batch.id} style={styles.lotRow}>
                  <View style={styles.lotColDate}>
                    <View style={styles.lotDot} />
                    <Text style={styles.lotDateText}>{formatBatchDate(batch.created_at)}</Text>
                  </View>
                  <Text style={[styles.lotCell, styles.lotsColQty]}>
                    {batch.remaining_quantity} {product.unit}
                  </Text>
                  <View style={styles.lotColPrice}>
                    <Text style={styles.lotPriceText}>{formatMoney(batch.cost_price)}</Text>
                    <Text style={styles.lotValueText}>
                      val. {formatMoney(batch.remaining_quantity * batch.cost_price)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* SHEET — ENTRÉE DE STOCK */}
      <Modal
        visible={showEntrySheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEntrySheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Entrée de stock</Text>
              <Text style={styles.sheetStock}>
                Stock : {currentStock} {product.unit}
              </Text>
            </View>
            <Text style={styles.sheetSubtitle}>
              {product.name} · Réception · nouveau prix de revient
            </Text>

            <View style={styles.sheetBody}>
              <Text style={styles.formLabel}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={entryQty}
                onChangeText={text => setEntryQty(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.muted.foreground}
              />

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                Prix de revient unitaire (FCFA)
              </Text>
              <TextInput
                style={styles.input}
                value={entryCost}
                onChangeText={text => setEntryCost(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.muted.foreground}
              />

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                Date de prise en compte
              </Text>
              <View style={styles.chipsRow}>
                {[
                  { value: 'today' as const, label: "Aujourd'hui" },
                  { value: 'yesterday' as const, label: 'Hier' },
                  { value: 'week' as const, label: 'Il y a 1 sem.' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, entryDate === opt.value && styles.chipActiveDark]}
                    onPress={() => setEntryDate(opt.value)}
                  >
                    <Text
                      style={[styles.chipText, entryDate === opt.value && styles.chipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowEntrySheet(false)}
                >
                  <Text style={styles.sheetCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, styles.sheetSubmitEntry]}
                  onPress={handleSubmitEntry}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.success.foreground} />
                  ) : (
                    <Text style={styles.sheetSubmitText}>Enregistrer la réception</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* SHEET — SORTIE DE STOCK (FIFO) */}
      <Modal
        visible={showExitSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExitSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sortie de stock</Text>
              <Text style={styles.sheetStock}>
                Stock : {currentStock} {product.unit}
              </Text>
            </View>
            <Text style={styles.sheetSubtitle}>{product.name} · Retrait du stock (FIFO)</Text>

            <View style={styles.sheetBody}>
              <Text style={styles.formLabel}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={exitQty}
                onChangeText={text => setExitQty(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.muted.foreground}
              />

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>Motif</Text>
              <View style={styles.chipsWrap}>
                {EXIT_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[styles.chip, exitReason === reason.value && styles.chipActiveSky]}
                    onPress={() => setExitReason(reason.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        exitReason === reason.value && styles.chipTextActive,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowExitSheet(false)}
                >
                  <Text style={styles.sheetCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, styles.sheetSubmitExit]}
                  onPress={handleSubmitExit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.danger.foreground} />
                  ) : (
                    <Text style={styles.sheetSubmitText}>Valider la sortie</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* SHEET — SEUIL D'ALERTE */}
      <Modal
        visible={showThresholdSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowThresholdSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Seuil d&apos;alerte</Text>
            </View>
            <Text style={styles.sheetSubtitle}>{product.name}</Text>

            <View style={styles.sheetBody}>
              <Text style={styles.formLabel}>Seuil ({product.unit})</Text>
              <TextInput
                style={styles.input}
                value={thresholdValue}
                onChangeText={text => setThresholdValue(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.muted.foreground}
              />

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowThresholdSheet(false)}
                >
                  <Text style={styles.sheetCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, styles.sheetSubmitSky]}
                  onPress={handleSubmitThreshold}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.primary.foreground} />
                  ) : (
                    <Text style={styles.sheetSubmitText}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  // CARD
  card: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  cardBreadcrumb: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeOk: {
    backgroundColor: Colors.success.main + '1A',
  },
  statusBadgeLow: {
    backgroundColor: Colors.warning.main + '1A',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextOk: {
    color: Colors.success.text,
  },
  statusBadgeTextLow: {
    color: Colors.warning.text,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  metricsRowBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  metricCol: {
    flex: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  marginText: {
    fontSize: 13,
    fontWeight: '700',
  },
  marginPos: {
    color: Colors.success.main,
  },
  marginNeg: {
    color: Colors.danger.main,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning.background,
  },
  thresholdLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning.text,
  },
  thresholdValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.warning.main,
    fontVariant: ['tabular-nums'],
  },
  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 52,
    borderWidth: 1.5,
  },
  actionButtonEntry: {
    backgroundColor: Colors.success.background,
    borderColor: Colors.success.main + '55',
  },
  actionButtonExit: {
    backgroundColor: Colors.danger.background,
    borderColor: Colors.danger.main + '55',
  },
  actionIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconEntry: {
    backgroundColor: Colors.success.main,
  },
  actionIconExit: {
    backgroundColor: Colors.danger.main,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonTextEntry: {
    color: Colors.success.text,
  },
  actionButtonTextExit: {
    color: Colors.danger.text,
  },
  // SECTION
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  // LOTS
  lotsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  lotsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lotsHeaderCell: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.3,
  },
  lotsColDate: {
    flex: 1.6,
  },
  lotsColQty: {
    flex: 1,
    textAlign: 'center',
  },
  lotsColPrice: {
    flex: 1.2,
    textAlign: 'right',
  },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lotColDate: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.action,
  },
  lotDateText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
  },
  lotCell: {
    fontSize: 13.5,
    color: Colors.textColors.secondary,
    fontWeight: '500',
  },
  lotColPrice: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  lotPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  lotValueText: {
    fontSize: 11,
    color: Colors.warning.main,
    fontWeight: '600',
    marginTop: 1,
  },
  lotsEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.sm,
  },
  lotsEmptyText: {
    fontSize: 13.5,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  // SHEETS
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingBottom: Spacing['2xl'],
    ...Shadows.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetStock: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    fontWeight: '600',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    paddingHorizontal: Spacing.xl,
    marginTop: 2,
  },
  sheetBody: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  formLabelSpaced: {
    marginTop: Spacing.lg,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActiveDark: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  chipActiveSky: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  chipTextActive: {
    color: Colors.primary.foreground,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing['2xl'],
  },
  sheetCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  sheetSubmitButton: {
    flex: 1.6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  sheetSubmitEntry: {
    backgroundColor: Colors.success.main,
  },
  sheetSubmitExit: {
    backgroundColor: Colors.danger.main,
  },
  sheetSubmitSky: {
    backgroundColor: Colors.action,
  },
  sheetSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary.foreground,
  },
});
