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
  Switch,
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

  // Édition de l'article — sheet « Modifier l'article »
  // (CONDITIONNEMENT obligatoire + SOUS-CONDITIONNEMENT optionnel)
  const [editName, setEditName] = useState('');
  const [editCost, setEditCost] = useState(''); // prix de revient AU CARTON
  const [editSell, setEditSell] = useState(''); // prix de DÉTAIL (pièce)
  const [editDetailEnabled, setEditDetailEnabled] = useState(false); // toggle sous-cond
  const [editAlertThreshold, setEditAlertThreshold] = useState(''); // seuil en cartons

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

  // AUTO-ADAPT : dès que le prix de gros (carton) ou l'UPP change, si le prix de détail
  // saisi passe sous le plancher ceil(gros/UPP), on le remonte automatiquement au plancher
  // (live). On ne le baisse jamais : le détail peut être supérieur au plancher.
  useEffect(() => {
    if (!editDetailEnabled) return;
    const pkg = parseInt(editPackagePrice, 10);
    const u = parseInt(editUnitsPerPackage, 10);
    if (isNaN(pkg) || pkg <= 0 || isNaN(u) || u <= 1) return;
    const floor = Math.ceil(pkg / u);
    const cur = parseInt(editSell, 10);
    if (isNaN(cur) || cur < floor) {
      setEditSell(String(floor));
    }
  }, [editPackagePrice, editUnitsPerPackage, editDetailEnabled, editSell]);

  // Dérivés (valorisation FIFO)
  const activeBatches = batches.filter(b => b.remaining_quantity > 0);
  const currentStock = activeBatches.reduce((s, b) => s + b.remaining_quantity, 0);
  const stockValue = activeBatches.reduce((s, b) => s + b.remaining_quantity * b.cost_price, 0);
  const pmp = currentStock > 0 ? Math.round(stockValue / currentStock) : 0;
  const sellPrice = product?.sell_price ?? 0;

  // Modèle carton-primary : l'unité atomique reste la PIÈCE (lots/FIFO inchangés),
  // mais le carton (units_per_package > 1) devient l'unité d'affichage du stock,
  // du coût et du seuil d'alerte. null/1 = vendu uniquement à la pièce.
  const upp =
    product?.units_per_package && product.units_per_package > 1 ? product.units_per_package : 0;
  const isConditioned = upp > 0;
  // UPP "réel" (≥1) pour les conversions cartons↔pièces (UPP=1 = carton = unité simple).
  const uppReal =
    product?.units_per_package && product.units_per_package > 0 ? product.units_per_package : 1;
  // Sous-conditionnement (vente au détail) actif ⟺ UPP>1 ET prix de détail défini (>0).
  const hasDetail = isConditioned && (product?.sell_price ?? 0) > 0;
  // Plancher de détail courant (gros ramené à la pièce).
  const detailFloor =
    isConditioned && product?.package_price ? Math.ceil(product.package_price / upp) : 0;
  const cartons = isConditioned ? Math.floor(currentStock / upp) : 0;
  const looseUnits = isConditioned ? currentStock % upp : 0;
  // Coût par carton = PMP/pièce × pièces par carton.
  const pmpPerCarton = isConditioned ? pmp * upp : pmp;
  // Prix de vente affiché sur la carte : DÉTAIL (pièce) si sous-cond actif, sinon GROS (carton).
  const saleDisplayPrice = hasDetail ? sellPrice : (product?.package_price ?? 0);
  const saleDisplayCost = hasDetail ? pmp : pmpPerCarton;
  const saleMargin = saleDisplayPrice - saleDisplayCost;
  const saleMarginPct =
    saleDisplayPrice > 0 ? Math.round((saleMargin / saleDisplayPrice) * 100) : 0;
  const saleDisplayUnit = hasDetail ? '/ pièce' : isConditioned ? '/ carton' : '';
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
    // Prix de revient TOUJOURS saisi PAR CARTON : on pré-remplit avec le coût/pièce
    // (PMP courant, sinon coût catalogue) × pièces par conditionnement.
    const baseCostPiece = pmp > 0 ? pmp : product.cost_price;
    setEditCost(String(baseCostPiece * uppReal));
    // Conditionnement OBLIGATOIRE : on sélectionne par défaut le type courant, sinon le 1er.
    setEditPkgTypeId(product.packaging_type_id ?? packagingList[0]?.id ?? null);
    setEditUnitsPerPackage(String(uppReal));
    setEditPackagePrice(product.package_price ? String(product.package_price) : '');
    // Sous-conditionnement (détail) : activé si déjà un prix de détail défini.
    setEditDetailEnabled(hasDetail);
    setEditSell(product.sell_price > 0 ? String(product.sell_price) : String(detailFloor || ''));
    setEditAlertThreshold(String(product.alert_threshold));
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
      // Réception saisie EN CARTONS quand l'article est conditionné : on convertit
      // en unité atomique (pièce). quantité_pièces = cartons × UPP ;
      // coût/pièce = round(coût_carton / UPP). UPP=1 ⇒ aucune conversion.
      const quantityPieces = qty * uppReal;
      const costPiece = Math.round(cost / uppReal);
      // La date de prise en compte est propagée au lot (local + serveur via la sync)
      await createStockBatchOffline({
        shopId,
        productId: product.id,
        quantity: quantityPieces,
        costPrice: costPiece,
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

  // Sheet « Modifier l'article » : CONDITIONNEMENT (obligatoire) + SOUS-CONDITIONNEMENT (optionnel).
  // - Prix de revient saisi AU CARTON → stocké PAR PIÈCE (round(coût_carton / UPP)).
  // - package_price = prix de vente au CARTON (gros), obligatoire.
  // - sell_price = prix de DÉTAIL (pièce), clampé au plancher ceil(gros/UPP) si sous-cond,
  //   0 si la vente au détail est désactivée (article vendu uniquement au carton).
  const handleSubmitEdit = async () => {
    if (!product || !shopId) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert('Erreur', 'Veuillez saisir une désignation');
      return;
    }
    const costCarton = parseInt(editCost, 10);
    if (isNaN(costCarton) || costCarton < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de revient (au carton) valide');
      return;
    }
    const unitsPerPackage = parseInt(editUnitsPerPackage, 10);
    if (isNaN(unitsPerPackage) || unitsPerPackage < 1) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre de pièces par conditionnement (≥ 1)');
      return;
    }
    const packagePrice = parseInt(editPackagePrice, 10);
    if (isNaN(packagePrice) || packagePrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de vente au carton (gros) valide');
      return;
    }
    if (packagingList.length > 0 && !editPkgTypeId) {
      Alert.alert('Erreur', 'Veuillez choisir un type de conditionnement');
      return;
    }
    const threshold = parseInt(editAlertThreshold, 10);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Erreur', "Veuillez entrer un seuil d'alerte (en cartons) valide");
      return;
    }

    // Vente au détail seulement possible avec un sous-conditionnement (UPP > 1).
    const detailOn = editDetailEnabled && unitsPerPackage > 1;
    let sellPiece = 0;
    if (detailOn) {
      const floor = Math.ceil(packagePrice / unitsPerPackage);
      const raw = parseInt(editSell, 10);
      sellPiece = isNaN(raw) || raw < floor ? floor : raw; // clamp au plancher
    }
    // Coût saisi AU CARTON → stocké PAR PIÈCE.
    const costPerPiece = Math.round(costCarton / unitsPerPackage);

    setIsSubmitting(true);
    try {
      await updateProductOffline(product.id, {
        name,
        costPrice: costPerPiece,
        sellPrice: sellPiece,
        packagingTypeId: editPkgTypeId,
        unitsPerPackage,
        packagePrice,
        alertThreshold: threshold,
      });

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

  // Prix par conditionnement :
  //  • GROS (toujours) : le carton au prix de vente `package_price`
  //    (+ "soit X / pièce" quand UPP > 1).
  //  • DÉTAIL (uniquement si sous-conditionnement actif) : la pièce, au prix `sell_price`.
  const grosTile = product.package_price
    ? [
        {
          key: 'gros',
          title: isConditioned
            ? `${packagingName ?? 'Carton'} · ${uppReal} pièces`
            : (packagingName ?? 'Carton'),
          price: product.package_price,
          sub: isConditioned
            ? `soit ${formatMoney(Math.round(product.package_price / upp))} / pièce`
            : 'au carton',
          subColor: Colors.success.main,
        },
      ]
    : [];
  const detailTile = hasDetail
    ? [
        {
          key: 'detail',
          title: 'Pièce · Détail',
          price: sellPrice,
          sub: "à l'unité",
          subColor: Colors.textColors.tertiary,
        },
      ]
    : [];
  const packagingTiles = [...grosTile, ...detailTile];

  // Valeurs dérivées (live) de la sheet d'édition. Le prix de revient est saisi AU CARTON ;
  // on le ramène au coût/pièce pour la marge détail. Le plancher de détail = ceil(gros/UPP).
  const editUnits = parseInt(editUnitsPerPackage, 10);
  const editUnitsValid = !isNaN(editUnits) && editUnits >= 1;
  const editDetailPossible = editUnitsValid && editUnits > 1;
  const editCostCartonNum = parseInt(editCost, 10);
  const editPackagePriceNum = parseInt(editPackagePrice, 10);
  const editSellNum = parseInt(editSell, 10);
  const editGrosMarginPct =
    !isNaN(editPackagePriceNum) && editPackagePriceNum > 0 && !isNaN(editCostCartonNum)
      ? Math.round(((editPackagePriceNum - editCostCartonNum) / editPackagePriceNum) * 100)
      : 0;
  const editDetailFloor =
    editDetailPossible && !isNaN(editPackagePriceNum) && editPackagePriceNum > 0
      ? Math.ceil(editPackagePriceNum / editUnits)
      : 0;
  const editCostPerPiece =
    editUnitsValid && !isNaN(editCostCartonNum) ? Math.round(editCostCartonNum / editUnits) : 0;
  const editDetailMarginPct =
    !isNaN(editSellNum) && editSellNum > 0
      ? Math.round(((editSellNum - editCostPerPiece) / editSellNum) * 100)
      : 0;

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
              <Text style={styles.metricLabel}>
                {hasDetail ? 'Prix de détail · marge' : 'Prix de gros · marge'}
              </Text>
              <Text style={styles.metricValue}>
                {formatMoney(saleDisplayPrice)}
                {saleDisplayUnit ? (
                  <Text style={styles.metricUnit}> {saleDisplayUnit}</Text>
                ) : null}{' '}
                <Text
                  style={[styles.marginText, saleMargin >= 0 ? styles.marginPos : styles.marginNeg]}
                >
                  · {saleMarginPct}%
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
        {packagingTiles.length > 0 && (
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
        )}

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
              <Text style={styles.formLabel}>
                {isConditioned ? 'Quantité (cartons)' : 'Quantité'}
              </Text>
              <TextInput
                style={styles.input}
                value={entryQty}
                onChangeText={text => setEntryQty(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.muted.foreground}
              />

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                {isConditioned
                  ? 'Prix de revient (au carton, FCFA)'
                  : 'Prix de revient unitaire (FCFA)'}
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
            <Text style={styles.sheetSubtitle}>
              Conditionnement (obligatoire) et vente au détail (optionnel)
            </Text>

            <ScrollView
              style={styles.editScroll}
              contentContainerStyle={styles.sheetBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ===== CONDITIONNEMENT (obligatoire) ===== */}
              <Text style={styles.editSectionTitle}>CONDITIONNEMENT</Text>

              <Text style={styles.formLabel}>Désignation</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nom de l'article"
                placeholderTextColor={Colors.muted.foreground}
              />

              {packagingList.length > 0 && (
                <>
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    Type de conditionnement
                  </Text>
                  <View style={styles.pkgChipRow}>
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
                </>
              )}

              <View style={styles.editPriceRow}>
                <View style={styles.editPriceCol}>
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    Pièces / conditionnement
                  </Text>
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
                  <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                    Prix de revient (carton)
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
              </View>

              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                Prix de vente (carton · gros)
              </Text>
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

              <View style={styles.marginRow}>
                <TrendingUp size={16} color={Colors.info.text} />
                <Text style={styles.marginRowLabel}>Marge gros (carton)</Text>
                <Text style={styles.marginRowValue}>{editGrosMarginPct} %</Text>
              </View>

              {/* ===== SOUS-CONDITIONNEMENT (optionnel) ===== */}
              <Text style={[styles.editSectionTitle, styles.formLabelSpaced]}>
                SOUS-CONDITIONNEMENT
              </Text>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>Vendre aussi au détail (pièce)</Text>
                  <Text style={styles.toggleSubtitle}>
                    {editDetailPossible
                      ? 'Active la vente à la pièce en plus du carton'
                      : 'Nécessite plus d’1 pièce par conditionnement'}
                  </Text>
                </View>
                <Switch
                  value={editDetailEnabled && editDetailPossible}
                  onValueChange={setEditDetailEnabled}
                  disabled={!editDetailPossible}
                  trackColor={{ false: Colors.muted.main, true: Colors.action }}
                  thumbColor={Colors.surface}
                  ios_backgroundColor={Colors.muted.main}
                />
              </View>

              {editDetailEnabled && editDetailPossible && (
                <>
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
                  <Text style={styles.adjustHint}>
                    min {formatMoney(editDetailFloor)} / pièce (= prix de gros ÷ quantité)
                  </Text>
                  <View style={styles.marginRow}>
                    <TrendingUp size={16} color={Colors.info.text} />
                    <Text style={styles.marginRowLabel}>Marge détail (pièce)</Text>
                    <Text style={styles.marginRowValue}>{editDetailMarginPct} %</Text>
                  </View>
                </>
              )}

              {/* ===== SEUIL D'ALERTE (en cartons) ===== */}
              <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                Seuil d&apos;alerte (cartons)
              </Text>
              <View style={styles.inputSuffixWrap}>
                <TextInput
                  style={styles.inputSuffix}
                  value={editAlertThreshold}
                  onChangeText={text => setEditAlertThreshold(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.muted.foreground}
                />
                <Text style={styles.inputSuffixText}>cartons</Text>
              </View>

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
            </ScrollView>
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
    maxHeight: '92%',
    ...Shadows.lg,
  },
  editScroll: {
    flexGrow: 0,
  },
  editSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 1,
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
