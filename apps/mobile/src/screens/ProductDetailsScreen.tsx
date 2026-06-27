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
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  ChevronRight,
  Edit,
  TrendingUp,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { usePermissions } from '../hooks/usePermissions';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  productRepo,
  stockBatchRepo,
  inventoryMovementRepo,
  packagingTypeRepo,
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
  cost_price: number;
  sell_price: number;
  alert_threshold: number;
  packaging_type_id: string | null;
  units_per_package: number | null;
  package_price: number | null;
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
  const [packagingName, setPackagingName] = useState<string | null>(null);
  const [packagingList, setPackagingList] = useState<{ id: string; name: string }[]>([]);
  // Conditionnement (édition)
  const [editPkgTypeId, setEditPkgTypeId] = useState<string | null>(null);
  const [editUnitsPerPackage, setEditUnitsPerPackage] = useState('');
  const [editPackagePrice, setEditPackagePrice] = useState('');
  const [batches, setBatches] = useState<LocalStockBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sheets
  const [showEntrySheet, setShowEntrySheet] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [showThresholdSheet, setShowThresholdSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);

  // Entrée form
  const [entryQty, setEntryQty] = useState('');
  const [entryCost, setEntryCost] = useState('');
  const [entryDate, setEntryDate] = useState<EntryDateChoice>('today');

  // Sortie form
  const [exitQty, setExitQty] = useState('');
  const [exitReason, setExitReason] = useState<string>(EXIT_REASONS[0].value);

  // Seuil form
  const [thresholdValue, setThresholdValue] = useState('');

  // Édition de l'article (nom, prix, ajustement de stock) — sheet unifiée
  const [editName, setEditName] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editSell, setEditSell] = useState('');
  const [editStock, setEditStock] = useState('');

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
        cost_price: local.cost_price,
        sell_price: local.sell_price,
        alert_threshold: local.alert_threshold,
        packaging_type_id: local.packaging_type_id,
        units_per_package: local.units_per_package,
        package_price: local.package_price,
      });
      if (local.packaging_type_id) {
        const pkg = await packagingTypeRepo.getById(local.packaging_type_id);
        setPackagingName(pkg?.name ?? null);
      } else {
        setPackagingName(null);
      }
      const pkgList = await packagingTypeRepo.getAll(shopId, { orderBy: 'name ASC' });
      setPackagingList(pkgList.map(p => ({ id: p.id, name: p.name })));
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

  // Modèle carton-primary : l'unité atomique reste la PIÈCE (lots/FIFO inchangés),
  // mais le carton (units_per_package > 1) devient l'unité d'affichage du stock,
  // du coût et du seuil d'alerte. null/1 = vendu uniquement à la pièce.
  const upp =
    product?.units_per_package && product.units_per_package > 1 ? product.units_per_package : 0;
  const isConditioned = upp > 0;
  const cartons = isConditioned ? Math.floor(currentStock / upp) : 0;
  const looseUnits = isConditioned ? currentStock % upp : 0;
  // Coût par carton = PMP/pièce × pièces par carton.
  const pmpPerCarton = isConditioned ? pmp * upp : pmp;
  // Stock affiché : "N cartons (+ M pièces)" si conditionné, sinon "N pièces".
  const stockLabel = isConditioned
    ? `${cartons} carton${cartons > 1 ? 's' : ''}${
        looseUnits ? ` (+ ${looseUnits} pièce${looseUnits > 1 ? 's' : ''})` : ''
      }`
    : `${currentStock} ${product?.unit ?? ''}`;
  // Seuil d'alerte en cartons quand conditionné (sinon en pièces).
  const isLowStock = product
    ? isConditioned
      ? cartons <= product.alert_threshold
      : currentStock <= product.alert_threshold
    : false;
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

  const openEditSheet = () => {
    if (!product) return;
    setEditName(product.name);
    // Prix de revient saisi PAR CARTON quand l'article est conditionné :
    // on pré-remplit avec le coût/pièce (PMP courant, sinon coût catalogue) × pièces/carton.
    const baseCostPiece = pmp > 0 ? pmp : product.cost_price;
    setEditCost(String(isConditioned ? baseCostPiece * upp : baseCostPiece));
    setEditSell(String(product.sell_price));
    setEditStock(String(currentStock));
    setEditPkgTypeId(product.packaging_type_id);
    setEditUnitsPerPackage(product.units_per_package ? String(product.units_per_package) : '');
    setEditPackagePrice(product.package_price ? String(product.package_price) : '');
    setShowEditSheet(true);
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

  // Ajustement de stock à une quantité cible (correction d'inventaire tracée)
  // - cible < stock : déstockage FIFO + mouvement d'ajustement
  // - cible > stock : nouveau lot daté (entrée) au PMP courant + mouvement d'ajustement
  // Ne déclenche pas loadProduct/alerte : utilisé en composition par handleSubmitEdit.
  const applyStockAdjustment = async (target: number, costForNewBatch: number) => {
    if (!product || !shopId) return;
    const delta = target - currentStock;
    if (delta === 0) return;

    const deviceInfo = await getDeviceInfo();

    if (delta < 0) {
      // Correction négative : on retire l'excédent en FIFO
      const removeQty = -delta;
      const deductions = await stockBatchRepo.deductFIFO(shopId, product.id, removeQty);
      const totalDeducted = deductions.reduce((s, d) => s + d.deducted, 0);

      const movement: Partial<LocalInventoryMovement> = {
        id: generateId(),
        shop_id: shopId,
        product_id: product.id,
        type: 'ADJUSTMENT',
        qty: -totalDeducted,
        reason: 'Ajustement de stock',
        ref_type: 'manual',
        ref_id: null,
        unit_cost: pmp,
        device_id: deviceInfo.device_id,
        client_op_id: `inv_adj_${product.id}_${Date.now()}`,
        version: 1,
      };
      await inventoryMovementRepo.create(movement);
    } else {
      // Correction positive : on crée un lot d'entrée (au prix de revient saisi)
      // createStockBatchOffline crée déjà le mouvement d'inventaire IN associé.
      await createStockBatchOffline({
        shopId,
        productId: product.id,
        quantity: delta,
        costPrice: costForNewBatch,
        sellPrice: product.sell_price,
        notes: 'Ajustement de stock',
      });
    }
  };

  // Sheet unifiée « Modifier l'article » : nom + prix (revient/vente) + ajustement de stock.
  const handleSubmitEdit = async () => {
    if (!product || !shopId) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert('Erreur', 'Veuillez saisir une désignation');
      return;
    }
    const cost = parseInt(editCost, 10);
    if (isNaN(cost) || cost < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de revient valide');
      return;
    }
    const sell = parseInt(editSell, 10);
    if (isNaN(sell) || sell < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de vente valide');
      return;
    }
    const target = parseInt(editStock, 10);
    if (isNaN(target) || target < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un stock valide');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1) Nom + prix + conditionnement (mise à jour produit + sync)
      const unitsPerPackage = parseInt(editUnitsPerPackage, 10);
      const packagePrice = parseInt(editPackagePrice, 10);
      const hasPackaging =
        !!editPkgTypeId && !isNaN(unitsPerPackage) && unitsPerPackage > 0 && !isNaN(packagePrice);
      // Le coût est saisi PAR CARTON quand l'article est conditionné. On le stocke
      // toujours PAR PIÈCE : cost_price = round(coût_carton / pièces par carton).
      const costPerPiece =
        hasPackaging && unitsPerPackage > 1 ? Math.round(cost / unitsPerPackage) : cost;
      await updateProductOffline(product.id, {
        name,
        costPrice: costPerPiece,
        sellPrice: sell,
        packagingTypeId: hasPackaging ? editPkgTypeId : null,
        unitsPerPackage: hasPackaging ? unitsPerPackage : null,
        packagePrice: hasPackaging ? packagePrice : null,
      });
      // 2) Ajustement de stock (mouvement d'inventaire tracé si écart) — coût/pièce.
      await applyStockAdjustment(target, costPerPiece);

      setShowEditSheet(false);
      await loadProduct();
      Alert.alert('Succès', 'Article mis à jour');
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? "Impossible de mettre à jour l'article");
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

  // Prix par conditionnement — deux tuiles :
  //  • Gros : carton complet (units_per_package pièces) au prix de gros `package_price`.
  //  • Détail : la pièce, au prix de vente unitaire `sell_price`.
  const grosTile =
    isConditioned && product.package_price
      ? [
          {
            key: 'gros',
            title: `${packagingName ?? 'Carton'} · ${product.units_per_package} pièces`,
            price: product.package_price,
            sub: `soit ${formatMoney(Math.round(product.package_price / upp))} / pièce`,
            subColor: Colors.success.main,
          },
        ]
      : [];
  const packagingTiles = [
    ...grosTile,
    {
      key: 'detail',
      title: 'Pièce',
      price: sellPrice,
      sub: "à l'unité",
      subColor: Colors.textColors.tertiary,
    },
  ];

  // Marge estimée en direct dans la sheet d'édition. Le coût est saisi PAR CARTON
  // quand l'article est conditionné → on le ramène au coût/pièce pour la marge détail.
  const editSellNum = parseInt(editSell, 10);
  const editCostNum = parseInt(editCost, 10);
  const editUnitsNum = parseInt(editUnitsPerPackage, 10);
  const editConditioned = !!editPkgTypeId && !isNaN(editUnitsNum) && editUnitsNum > 1;
  const editCostPerPiece =
    editConditioned && !isNaN(editCostNum) ? Math.round(editCostNum / editUnitsNum) : editCostNum;
  const editMarginPct =
    !isNaN(editSellNum) && editSellNum > 0 && !isNaN(editCostPerPiece)
      ? Math.round(((editSellNum - editCostPerPiece) / editSellNum) * 100)
      : 0;
  // Indice de cohérence des prix : le détail/pièce devrait être ≥ gros/pièce.
  const editPackagePriceNum = parseInt(editPackagePrice, 10);
  const editGrosPerPiece =
    editConditioned && !isNaN(editPackagePriceNum) && editUnitsNum > 0
      ? Math.round(editPackagePriceNum / editUnitsNum)
      : 0;
  const editPriceWarning =
    editGrosPerPiece > 0 &&
    !isNaN(editSellNum) &&
    editSellNum > 0 &&
    editSellNum < editGrosPerPiece;

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
            <View style={styles.cardTopRight}>
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
              {canEditProduct ? (
                <TouchableOpacity
                  style={styles.editIconButton}
                  onPress={openEditSheet}
                  activeOpacity={0.7}
                >
                  <Edit size={16} color={Colors.action} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Stock actuel</Text>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                {stockLabel}
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
              <Text style={styles.metricValue}>
                {formatMoney(pmpPerCarton)}
                {isConditioned ? <Text style={styles.metricUnit}> / carton</Text> : null}
              </Text>
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
              {product.alert_threshold}{' '}
              {isConditioned ? `carton${product.alert_threshold > 1 ? 's' : ''}` : product.unit}
            </Text>
            {canEditProduct ? <ChevronRight size={18} color={Colors.warning.main} /> : null}
          </TouchableOpacity>
        </View>

        {/* PRIX PAR CONDITIONNEMENT */}
        <View style={styles.packCard}>
          <View style={styles.packTitleRow}>
            <Package size={18} color={Colors.success.main} />
            <Text style={styles.packTitle}>Prix par conditionnement</Text>
          </View>
          <View style={styles.packTiles}>
            {packagingTiles.map(tile => (
              <View key={tile.key} style={styles.packTile}>
                <Text style={styles.packTileLabel} numberOfLines={1}>
                  {tile.title}
                </Text>
                <Text style={styles.packTilePrice}>{formatMoney(tile.price)}</Text>
                <Text style={[styles.packTileSub, { color: tile.subColor }]} numberOfLines={1}>
                  {tile.sub}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* BOUTONS ENTRÉE / SORTIE — MANAGER+ uniquement */}
        {canEditProduct ? (
          <View style={styles.actionGroup}>
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
          </View>
        ) : null}

        {/* PRIX DE REVIENT & LOTS */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>PRIX DE REVIENT &amp; LOTS</Text>
            <Text style={styles.sectionCount}>
              {activeBatches.length} lot{activeBatches.length > 1 ? 's' : ''}
            </Text>
          </View>
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
              <Text style={styles.formLabel}>
                Seuil ({isConditioned ? 'cartons' : product.unit})
              </Text>
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

      {/* SHEET — MODIFIER L'ARTICLE (nom + prix + ajustement de stock) */}
      <Modal
        visible={showEditSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Modifier l&apos;article</Text>
            </View>
            <Text style={styles.sheetSubtitle}>Corrigez le nom, les prix et ajustez le stock</Text>

            <View style={styles.sheetBody}>
              <Text style={styles.formLabel}>Désignation</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nom de l'article"
                placeholderTextColor={Colors.muted.foreground}
              />

              <View style={styles.editPriceRow}>
                <View style={styles.editPriceCol}>
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    {editConditioned ? 'Prix de revient (carton)' : 'Prix de revient'}
                  </Text>
                  <View style={styles.inputSuffixWrap}>
                    <TextInput
                      style={styles.inputSuffix}
                      value={editCost}
                      onChangeText={text => setEditCost(text.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={Colors.muted.foreground}
                    />
                    <Text style={styles.inputSuffixText}>F</Text>
                  </View>
                </View>
                <View style={styles.editPriceCol}>
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    Prix de détail (pièce)
                  </Text>
                  <View style={styles.inputSuffixWrap}>
                    <TextInput
                      style={styles.inputSuffix}
                      value={editSell}
                      onChangeText={text => setEditSell(text.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={Colors.muted.foreground}
                    />
                    <Text style={styles.inputSuffixText}>F</Text>
                  </View>
                </View>
              </View>

              <View style={styles.marginRow}>
                <TrendingUp size={16} color={Colors.info.text} />
                <Text style={styles.marginRowLabel}>Marge estimée (détail)</Text>
                <Text style={styles.marginRowValue}>{editMarginPct} %</Text>
              </View>

              {editPriceWarning ? (
                <Text style={styles.adjustHint}>
                  Le prix de détail/pièce ({formatMoney(editSellNum)}) est inférieur au prix de
                  gros/pièce ({formatMoney(editGrosPerPiece)}). Le détail devrait être ≥ au gros.
                </Text>
              ) : null}

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                Stock (ajustement d&apos;inventaire)
              </Text>
              <View style={styles.inputSuffixWrap}>
                <TextInput
                  style={styles.inputSuffix}
                  value={editStock}
                  onChangeText={text => setEditStock(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.muted.foreground}
                />
                <Text style={styles.inputSuffixText}>{product.unit}</Text>
              </View>
              <Text style={styles.adjustHint}>
                Modifier le stock crée un mouvement d&apos;inventaire tracé (écart corrigé).
              </Text>

              {packagingList.length > 0 && (
                <>
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    Conditionnement (optionnel)
                  </Text>
                  <View style={styles.pkgChipRow}>
                    <TouchableOpacity
                      style={[styles.pkgChip, !editPkgTypeId && styles.pkgChipActive]}
                      onPress={() => setEditPkgTypeId(null)}
                    >
                      <Text
                        style={[styles.pkgChipText, !editPkgTypeId && styles.pkgChipTextActive]}
                      >
                        Aucun
                      </Text>
                    </TouchableOpacity>
                    {packagingList.map(pkg => (
                      <TouchableOpacity
                        key={pkg.id}
                        style={[styles.pkgChip, editPkgTypeId === pkg.id && styles.pkgChipActive]}
                        onPress={() => setEditPkgTypeId(pkg.id)}
                      >
                        <Text
                          style={[
                            styles.pkgChipText,
                            editPkgTypeId === pkg.id && styles.pkgChipTextActive,
                          ]}
                        >
                          {pkg.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {!!editPkgTypeId && (
                    <View style={styles.editPriceRow}>
                      <View style={styles.editPriceCol}>
                        <Text style={styles.formLabel}>Pièces / carton</Text>
                        <View style={styles.inputSuffixWrap}>
                          <TextInput
                            style={styles.inputSuffix}
                            value={editUnitsPerPackage}
                            onChangeText={t => setEditUnitsPerPackage(t.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            placeholder="24"
                            placeholderTextColor={Colors.muted.foreground}
                          />
                          <Text style={styles.inputSuffixText}>{product.unit}</Text>
                        </View>
                      </View>
                      <View style={styles.editPriceCol}>
                        <Text style={styles.formLabel}>Prix de gros (carton)</Text>
                        <View style={styles.inputSuffixWrap}>
                          <TextInput
                            style={styles.inputSuffix}
                            value={editPackagePrice}
                            onChangeText={t => setEditPackagePrice(t.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={Colors.muted.foreground}
                          />
                          <Text style={styles.inputSuffixText}>F</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetCancelButton}
                  onPress={() => setShowEditSheet(false)}
                >
                  <Text style={styles.sheetCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSubmitButton, styles.sheetSubmitSky]}
                  onPress={handleSubmitEdit}
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
  cardTopRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  editIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.action + '14',
    borderWidth: 1,
    borderColor: Colors.action + '33',
    alignItems: 'center',
    justifyContent: 'center',
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
  actionGroup: {
    gap: Spacing.md,
  },
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
  // PRIX PAR CONDITIONNEMENT
  packCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  packTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success.text,
  },
  packTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  packTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 4,
  },
  packTileLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  packTilePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  packTileSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  // SECTION
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    fontVariant: ['tabular-nums'],
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
  adjustHint: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  pkgChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pkgChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pkgChipActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  pkgChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  pkgChipTextActive: {
    color: '#FFFFFF',
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
  inputSuffixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  inputSuffix: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputSuffixText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
    marginLeft: Spacing.sm,
  },
  editPriceRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  editPriceCol: {
    flex: 1,
  },
  marginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.info.background,
  },
  marginRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.info.text,
  },
  marginRowValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.info.text,
    fontVariant: ['tabular-nums'],
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
