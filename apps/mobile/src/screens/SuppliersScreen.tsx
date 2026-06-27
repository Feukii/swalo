import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building, Plus, Eye, Search } from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton, SyncPill } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatPhoneOnInput, formatCameroonPhone, isValidCameroonPhone } from '../utils/phone';
import { useLocalSuppliers, useLocalSupplierDebts } from '../hooks/useLocalData';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import { createSupplierOffline, createSupplierDebtOffline } from '../db/offlineWrite';

interface SuppliersScreenNavigation {
  goBack: () => void;
  navigate: {
    (screen: 'SupplierBalancesSummary'): void;
    (screen: 'SupplierDetails', params: { id: string }): void;
  };
}

interface SuppliersScreenProps {
  navigation: SuppliersScreenNavigation;
}

// Teintes d'avatar stables dérivées du nom (tokens uniquement)
const AVATAR_PALETTE = [
  { bg: Colors.warning.background, fg: Colors.warning.text },
  { bg: Colors.danger.background, fg: Colors.danger.text },
  { bg: Colors.info.background, fg: Colors.info.text },
  { bg: Colors.muted.main, fg: Colors.muted.foreground },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFcfa(amount: number): string {
  // Normalise les espaces insécables/étroits (format fr-FR) en espace simple
  const grouped = Math.round(amount).toLocaleString('fr-FR').replace(/\s/g, ' ');
  return `${grouped} F`;
}

export default function SuppliersScreen({ navigation }: SuppliersScreenProps) {
  const { shop } = useCurrentUser();
  const { can } = usePermissions();
  const canCreateSupplier = can('suppliers', 'create');
  const shopId = shop?.id || null;
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Local data hook - reads from SQLite
  const { data: suppliers, loading: isLoading, refresh } = useLocalSuppliers(shopId);
  // Dettes actives du shop (une seule requête) — agrégées par fournisseur en mémoire
  const { data: debts, refresh: refreshDebts } = useLocalSupplierDebts(shopId);

  // Form state
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [borrowingLimit, setBorrowingLimit] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = () => {
    setName('');
    setFirstName('');
    setPhone('');
    setBorrowingLimit('');
    setInitialBalance('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setName('');
    setFirstName('');
    setPhone('');
    setBorrowingLimit('');
    setInitialBalance('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }
    if (!shopId) {
      Alert.alert('Erreur', 'Boutique non identifiée');
      return;
    }

    // Vérifier les doublons (insensible à la casse)
    const newFullName = `${firstName.trim()} ${name.trim()}`.toLowerCase().trim();
    const isDuplicate = suppliers.some(supplier => {
      const existingFullName = `${supplier.first_name || ''} ${supplier.name}`.toLowerCase().trim();
      return existingFullName === newFullName;
    });

    if (isDuplicate) {
      Alert.alert(
        'Fournisseur existant',
        `Un fournisseur avec le nom "${firstName.trim() ? `${firstName.trim()} ${name.trim()}` : name.trim()}" existe déjà.`
      );
      return;
    }

    // Valider le téléphone camerounais si fourni
    if (phone.trim() && !isValidCameroonPhone(phone)) {
      Alert.alert(
        'Téléphone invalide',
        'Entrez un numéro camerounais valide au format +237 6XX XXX XXX.'
      );
      return;
    }

    // Valider la limite d'endettement si fournie (0 ou vide = illimité)
    let borrowingLimitFCFA: number | undefined;
    if (borrowingLimit.trim()) {
      const limit = parseFloat(borrowingLimit);
      if (isNaN(limit) || limit < 0) {
        Alert.alert('Erreur', "La limite d'endettement doit être un nombre positif");
        return;
      }
      borrowingLimitFCFA = Math.round(limit);
    }

    // Valider la dette de départ si fournie
    let initialBalanceFCFA: number | undefined;
    if (initialBalance.trim()) {
      const balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance < 0) {
        Alert.alert('Erreur', 'La dette de départ doit être un nombre positif');
        return;
      }
      initialBalanceFCFA = Math.round(balance);
    }

    setIsSaving(true);
    try {
      const { supplierId } = await createSupplierOffline({
        shopId,
        name: name.trim(),
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
        borrowingLimit: borrowingLimitFCFA,
      });

      // If initial balance provided, create a supplier debt
      if (initialBalanceFCFA && initialBalanceFCFA > 0) {
        await createSupplierDebtOffline({
          shopId,
          supplierId,
          amount: initialBalanceFCFA,
          description: 'Solde initial',
        });
      }

      Alert.alert('Succes', 'Fournisseur cree avec succes');
      handleCloseModal();
      await refresh();
      await refreshDebts();
    } catch (error: unknown) {
      console.error('Erreur lors de la creation:', error);
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Erreur', message || 'Erreur lors de la creation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    await refresh();
    await refreshDebts();
  };

  const getPersonName = (person: { name: string; first_name?: string | null }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Solde par fournisseur (positif = on doit / dette en cours)
  const balanceBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of debts) {
      map.set(d.supplier_id, (map.get(d.supplier_id) ?? 0) + d.balance);
    }
    return map;
  }, [debts]);

  // Total des dettes + nombre de fournisseurs avec dette (depuis les données déjà chargées)
  const { totalDebt, debtorCount } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const balance of balanceBySupplier.values()) {
      if (balance > 0) {
        total += balance;
        count += 1;
      }
    }
    return { totalDebt: total, debtorCount: count };
  }, [balanceBySupplier]);

  const filteredSuppliers = suppliers.filter(supplier => {
    const fullName = `${supplier.first_name || ''} ${supplier.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      supplier.phone?.includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Fournisseurs"
        subtitle="Dettes & paiements"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <SyncPill />
            <IconButton onPress={() => navigation.navigate('SupplierBalancesSummary')}>
              <Eye size={22} color={Colors.action} />
            </IconButton>
            {canCreateSupplier && (
              <IconButton onPress={handleOpenModal}>
                <Plus size={22} color={Colors.action} />
              </IconButton>
            )}
          </View>
        }
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            colors={[Colors.action]}
            tintColor={Colors.action}
          />
        }
      >
        {/* Carte HERO — Dettes fournisseurs */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Dettes fournisseurs en cours</Text>
          <Text style={styles.heroAmount}>{formatFcfa(totalDebt)}</Text>
          <Text style={styles.heroSub}>
            {debtorCount} {debtorCount > 1 ? 'fournisseurs à payer' : 'fournisseur à payer'}
          </Text>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchCard}>
          <Search size={18} color={Colors.action} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un fournisseur…"
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Liste fournisseurs */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyState}>
            <Building size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
            </Text>
          </View>
        ) : (
          filteredSuppliers.map(supplier => {
            const fullName = getPersonName(supplier);
            const balance = balanceBySupplier.get(supplier.id) ?? 0;
            const avatar = AVATAR_PALETTE[hashString(fullName) % AVATAR_PALETTE.length];
            const borrowingLimitValue = supplier.borrowing_limit ?? 0;
            const hasLimit = borrowingLimitValue > 0 && balance > 0;
            const ratio = hasLimit ? Math.min(balance / borrowingLimitValue, 1) : 0;

            return (
              <TouchableOpacity
                key={supplier.id}
                style={styles.supplierCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('SupplierDetails', { id: supplier.id })}
              >
                <View style={styles.supplierRow}>
                  <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.avatarText, { color: avatar.fg }]}>
                      {getInitials(fullName)}
                    </Text>
                  </View>

                  <View style={styles.supplierInfo}>
                    <View style={styles.supplierNameRow}>
                      <Text style={styles.supplierName} numberOfLines={1}>
                        {fullName}
                      </Text>
                    </View>
                    {supplier.phone ? (
                      <Text style={styles.supplierPhone} numberOfLines={1}>
                        {formatCameroonPhone(supplier.phone)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.amountBlock}>
                    {balance > 0 ? (
                      <>
                        <Text style={styles.amountDue}>{formatFcfa(balance)}</Text>
                        <Text style={styles.statusDue}>À payer</Text>
                      </>
                    ) : balance < 0 ? (
                      <>
                        <Text style={styles.amountCredit}>{formatFcfa(-balance)}</Text>
                        <Text style={styles.statusCredit}>Avoir</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.amountOk}>{formatFcfa(0)}</Text>
                        <Text style={styles.statusOk}>Soldé</Text>
                      </>
                    )}
                  </View>
                </View>

                {hasLimit ? (
                  <View style={styles.limitBlock}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${ratio * 100}%`,
                            backgroundColor: Colors.action,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.limitLabels}>
                      <Text style={styles.limitText}>Plafond d'emprunt</Text>
                      <Text style={styles.limitText}>{formatFcfa(borrowingLimitValue)}</Text>
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Supplier Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Fournisseur</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nom <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom du fournisseur"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Prénom (optionnel)"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={text => setPhone(formatPhoneOnInput(text))}
                placeholder="+237 6XX XXX XXX"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Limite d'endettement (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={borrowingLimit}
                onChangeText={setBorrowingLimit}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Plafond d'endettement autorisé pour ce fournisseur. 0 ou vide = illimité. Ne crée
                aucune dette.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Dette de départ (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>Crée une dette de départ — laisser vide si aucune.</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseModal}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Créer</Text>
                )}
              </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  // Hero
  hero: {
    backgroundColor: '#4A1414',
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: Spacing.xs,
  },
  // Search
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  // Supplier card
  supplierCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  supplierInfo: {
    flex: 1,
  },
  supplierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  supplierName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  supplierPhone: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amountDue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger.main,
  },
  statusDue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger.main,
    marginTop: 1,
  },
  amountCredit: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.action,
  },
  statusCredit: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.action,
    marginTop: 1,
  },
  amountOk: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  statusOk: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  // Borrowing limit progress
  limitBlock: {
    marginTop: Spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.muted.main,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  limitLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  limitText: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
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
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing['2xl'],
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.danger.main,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  hint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: Colors.muted.main,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.action,
  },
  submitButtonText: {
    color: Colors.primary.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
});
