/**
 * POSScreen.tsx
 *
 * Écran principal de la caisse (Point of Sale)
 *
 * Fonctionnalités:
 * - Affichage du solde de caisse en temps réel
 * - Création d'entrées (IN) : Ventes, Remboursements clients, Autres
 * - Création de sorties (OUT) : Achats, Règlements fournisseurs, Dépenses, Divers
 * - Affichage des statistiques du jour (entrées, sorties, net)
 * - Liste des opérations du jour
 * - Navigation rapide vers Fournisseurs et Clients
 * - Menu de paramètres (⚙️) avec accès aux Bilans et Administration (selon le rôle)
 * - Déconnexion
 *
 * Permissions:
 * - EMPLOYEE : Peut créer des entrées/sorties positives
 * - BOSS : Peut créer des entrées/sorties positives ET négatives (corrections)
 */

import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  Building,
  Users,
  ClipboardList,
  BarChart3,
  LogOut,
  X,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  cashEntryRepo,
  supplierRepo,
  customerRepo,
  LocalCashEntry,
  LocalCustomer,
  LocalSupplier,
} from '../db/repositories';
import { createCashEntryOffline } from '../db/offlineWrite';
import { formatMoney } from '../utils/money';
import { ENTRY_CATEGORIES, EXIT_CATEGORIES, MIN_NOTE_LENGTH, requiresNote } from '@swalo/core';

// Interface pour les statistiques de caisse du jour
interface CashStats {
  balance: number; // Solde total de la caisse
  todayEntries: number; // Total des entrées du jour
  todayExits: number; // Total des sorties du jour
  todayNet: number; // Solde net du jour (entrées - sorties)
  entriesCount: number; // Nombre d'opérations d'entrée
  exitsCount: number; // Nombre d'opérations de sortie
}

// Props du composant POSScreen
interface POSScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    reset: (state: { index: number; routes: { name: string }[] }) => void;
  };
}

/**
 * Composant principal de l'écran de caisse
 * Gère toutes les opérations de caisse (entrées/sorties) et affiche les statistiques du jour
 */
export default function POSScreen({ navigation }: POSScreenProps) {
  // Utilisateur courant (depuis AsyncStorage via hook)
  const { shopId, userId, user } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';

  // États pour les données de caisse
  const [entries, setEntries] = useState<LocalCashEntry[]>([]); // Liste des opérations du jour
  const [stats, setStats] = useState<CashStats | null>(null); // Statistiques de caisse
  const [isLoading, setIsLoading] = useState(false); // Indicateur de chargement
  const [showModal, setShowModal] = useState<'IN' | 'OUT' | null>(null); // Modal d'ajout d'opération
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); // Menu de paramètres

  // Listes pour les sélecteurs (fournisseurs et clients actifs)
  const [suppliers, setSuppliers] = useState<LocalSupplier[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);

  // États pour la recherche dans les dropdowns
  const [supplierSearchText, setSupplierSearchText] = useState('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // États du formulaire d'ajout d'opération
  const [category, setCategory] = useState(''); // Catégorie sélectionnée
  const [amount, setAmount] = useState(''); // Montant saisi
  const [note, setNote] = useState(''); // Note optionnelle
  const [selectedSupplierId, setSelectedSupplierId] = useState(''); // Fournisseur sélectionné
  const [selectedCustomerId, setSelectedCustomerId] = useState(''); // Client sélectionné

  /**
   * Charge les données de caisse du jour depuis la base locale SQLite
   * - Liste des opérations depuis minuit
   * - Statistiques calculées localement (solde, entrées, sorties, net)
   */
  const loadData = useCallback(async () => {
    if (!shopId) return;
    try {
      const todayEntries = await cashEntryRepo.getToday(shopId);
      setEntries(todayEntries);

      // Calcul des statistiques localement à partir des entrées du jour
      let todayIn = 0,
        todayOut = 0,
        inCount = 0,
        outCount = 0;
      todayEntries.forEach(e => {
        if (e.type === 'IN') {
          todayIn += e.amount;
          inCount++;
        } else if (e.type === 'OUT') {
          todayOut += e.amount;
          outCount++;
        }
      });

      // Récupérer le solde global depuis toutes les entrées de caisse
      const balanceData = await cashEntryRepo.getBalance(shopId);
      const balance = balanceData.totalIn - balanceData.totalOut;

      setStats({
        balance,
        todayEntries: todayIn,
        todayExits: todayOut,
        todayNet: todayIn - todayOut,
        entriesCount: inCount,
        exitsCount: outCount,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  }, [shopId]);

  /**
   * Charge la liste des fournisseurs actifs depuis la base locale SQLite
   * Utilisé pour le sélecteur de fournisseur lors des règlements
   */
  const loadSuppliers = useCallback(async () => {
    if (!shopId) return;
    try {
      const data = await supplierRepo.getAll(shopId, {
        where: { is_active: 1 },
        orderBy: 'name ASC',
      });
      setSuppliers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
    }
  }, [shopId]);

  /**
   * Charge la liste des clients actifs depuis la base locale SQLite
   * Utilisé pour le sélecteur de client lors des remboursements
   */
  const loadCustomers = useCallback(async () => {
    if (!shopId) return;
    try {
      const data = await customerRepo.getAll(shopId, {
        where: { is_active: 1 },
        orderBy: 'name ASC',
      });
      setCustomers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    }
  }, [shopId]);

  /**
   * Rechargement des données à chaque fois que l'écran reçoit le focus
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadSuppliers();
      loadCustomers();
    }, [loadData, loadSuppliers, loadCustomers])
  );

  const handleOpenModal = (type: 'IN' | 'OUT') => {
    setShowModal(type);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedSupplierId('');
    setSelectedCustomerId('');
    setSupplierSearchText('');
    setCustomerSearchText('');
    setShowSupplierDropdown(false);
    setShowCustomerDropdown(false);
  };

  const handleCloseModal = () => {
    setShowModal(null);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedSupplierId('');
    setSelectedCustomerId('');
    setSupplierSearchText('');
    setCustomerSearchText('');
    setShowSupplierDropdown(false);
    setShowCustomerDropdown(false);
  };

  // Filtrer les fournisseurs selon la recherche
  const getFilteredSuppliers = () => {
    if (!supplierSearchText.trim()) {
      return suppliers;
    }
    const query = supplierSearchText.toLowerCase();
    return suppliers.filter(supplier => {
      const name = supplier.name.toLowerCase();
      const firstName = supplier.first_name?.toLowerCase() || '';
      return name.includes(query) || firstName.includes(query);
    });
  };

  // Filtrer les clients selon la recherche
  const getFilteredCustomers = () => {
    if (!customerSearchText.trim()) {
      return customers;
    }
    const query = customerSearchText.toLowerCase();
    return customers.filter(customer => {
      const name = customer.name.toLowerCase();
      const firstName = customer.first_name?.toLowerCase() || '';
      return name.includes(query) || firstName.includes(query);
    });
  };

  // Sélectionner un fournisseur
  const handleSelectSupplier = (supplier: LocalSupplier) => {
    setSelectedSupplierId(supplier.id);
    setSupplierSearchText(getPersonName(supplier));
    setShowSupplierDropdown(false);
  };

  // Sélectionner un client
  const handleSelectCustomer = (customer: LocalCustomer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchText(getPersonName(customer));
    setShowCustomerDropdown(false);
  };

  const handleSubmit = async () => {
    try {
      if (!category || !amount) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Validation pour catégorie "Divers" - commentaire obligatoire
      const trimmedNote = (note || '').trim();
      if (requiresNote(category) && trimmedNote.length < MIN_NOTE_LENGTH) {
        Alert.alert(
          'Commentaire requis',
          `Rajoutez un commentaire après le choix de la catégorie Divers (minimum ${MIN_NOTE_LENGTH} caractères)`
        );
        return;
      }

      // Validation pour règlement fournisseur
      if (category === 'Règlement fournisseur' && !selectedSupplierId) {
        Alert.alert('Erreur', 'Veuillez sélectionner un fournisseur');
        return;
      }

      // Validation pour remboursement client
      if (category === 'Remboursement client' && !selectedCustomerId) {
        Alert.alert('Erreur', 'Veuillez sélectionner un client');
        return;
      }

      const amountInCentimes = Math.round(parseFloat(amount)); // Already in FCFA

      if (isNaN(amountInCentimes)) {
        Alert.alert('Erreur', 'Montant invalide');
        return;
      }

      // Seuls les BOSS peuvent entrer des montants négatifs (corrections)
      if (amountInCentimes < 0 && userRole !== 'BOSS') {
        Alert.alert(
          'Permission refusée',
          'Seuls les propriétaires peuvent effectuer des corrections avec des montants négatifs'
        );
        return;
      }

      if (amountInCentimes === 0) {
        Alert.alert('Erreur', 'Le montant ne peut pas être zéro');
        return;
      }

      // Validation solde pour une sortie
      if (showModal === 'OUT' && amountInCentimes > 0) {
        const currentBalance = stats?.balance || 0;
        if (amountInCentimes > currentBalance) {
          Alert.alert('Solde insuffisant', 'Le montant de la sortie dépasse le solde de caisse');
          return;
        }
      }

      if (!shopId || !userId || !showModal) {
        Alert.alert('Erreur', 'Session invalide');
        return;
      }

      setIsLoading(true);

      await createCashEntryOffline({
        shopId,
        cashierId: userId,
        type: showModal,
        category,
        amount: amountInCentimes,
        note: trimmedNote || undefined,
        supplierId: selectedSupplierId || undefined,
        customerId: selectedCustomerId || undefined,
      });

      Alert.alert('Succès', 'Opération enregistrée avec succès');
      handleCloseModal();
      await loadData();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement";
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getPersonName = (person?: { name: string; first_name?: string }) => {
    if (!person || !person.name) return '';
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  const showSupplierSelect = category === 'Règlement fournisseur';
  const showCustomerSelect = category === 'Remboursement client';

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shop');
      navigation.reset({
        index: 0,
        routes: [{ name: 'LoginPin' }],
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <ScreenHeader
        title="Caisse"
        rightElement={
          <View style={styles.headerButtons}>
            {/* Bouton de rafraîchissement manuel des données */}
            <TouchableOpacity onPress={loadData} style={styles.menuButton}>
              <RefreshCw size={22} color={Colors.action} />
            </TouchableOpacity>
            {/* Bouton d'accès au menu de paramètres */}
            <TouchableOpacity onPress={() => setShowSettingsMenu(true)} style={styles.menuButton}>
              <Settings size={22} color={Colors.action} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Carte solde + stats */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde de caisse</Text>
        <Text style={styles.balanceAmount}>{formatMoney(stats?.balance || 0)}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Entrées</Text>
            <Text style={[styles.statValue, { color: Colors.success.main }]}>
              {formatMoney(stats?.todayEntries || 0)}
            </Text>
            <Text style={styles.statSubtext}>{stats?.entriesCount || 0} op.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sorties</Text>
            <Text style={[styles.statValue, { color: Colors.danger.main }]}>
              {formatMoney(stats?.todayExits || 0)}
            </Text>
            <Text style={styles.statSubtext}>{stats?.exitsCount || 0} op.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Net</Text>
            <Text
              style={[
                styles.statValue,
                { color: (stats?.todayNet || 0) < 0 ? Colors.danger.main : Colors.primary[900] },
              ]}
            >
              {formatMoney(stats?.todayNet || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSuccess]}
          onPress={() => handleOpenModal('IN')}
        >
          <TrendingUp size={22} color={Colors.surface} />
          <Text style={styles.actionButtonText}>Entrée</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={() => handleOpenModal('OUT')}
        >
          <TrendingDown size={22} color={Colors.surface} />
          <Text style={styles.actionButtonText}>Sortie</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Navigation - Navigation rapide vers Fournisseurs et Clients */}
      {/* Les options Bilans et Admin sont désormais accessibles via le menu ⚙️ en haut à droite */}
      <View style={styles.quickNav}>
        <TouchableOpacity
          style={styles.quickNavButton}
          onPress={() => navigation.navigate('Suppliers')}
        >
          <View style={styles.quickNavIcon}>
            <Building size={24} color={Colors.action} />
          </View>
          <Text style={styles.quickNavText}>Fournisseurs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickNavButton}
          onPress={() => navigation.navigate('Customers')}
        >
          <View style={styles.quickNavIcon}>
            <Users size={24} color={Colors.action} />
          </View>
          <Text style={styles.quickNavText}>Clients</Text>
        </TouchableOpacity>
      </View>

      {/* Operations List */}
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Opérations du jour</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{entries.length}</Text>
          </View>
        </View>

        <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <ClipboardList size={48} color={Colors.textColors.disabled} />
              <Text style={styles.emptyText}>Aucune opération aujourd'hui</Text>
              <Text style={styles.emptySubtext}>
                Commencez par enregistrer une entrée ou sortie
              </Text>
            </View>
          ) : (
            <View style={styles.entriesList}>
              {entries.map(entry => (
                <View key={entry.id} style={styles.entryItem}>
                  <View style={styles.entryLeft}>
                    <View style={styles.entryHeader}>
                      <View
                        style={[
                          styles.entryBadge,
                          entry.type === 'IN' ? styles.entryBadgeSuccess : styles.entryBadgeDanger,
                        ]}
                      >
                        {entry.type === 'IN' ? (
                          <TrendingUp size={14} color={Colors.success.main} />
                        ) : (
                          <TrendingDown size={14} color={Colors.danger.main} />
                        )}
                        <Text style={styles.entryBadgeText}>{entry.category}</Text>
                      </View>
                      <Text style={styles.entryTime}>{formatTime(entry.created_at)}</Text>
                    </View>
                    {(() => {
                      const supplier = entry.supplier_id
                        ? suppliers.find(s => s.id === entry.supplier_id)
                        : null;
                      const customer = entry.customer_id
                        ? customers.find(c => c.id === entry.customer_id)
                        : null;
                      return supplier || customer ? (
                        <Text style={styles.entryPerson}>
                          {supplier && getPersonName(supplier)}
                          {customer && getPersonName(customer)}
                        </Text>
                      ) : null;
                    })()}
                    {entry.note && <Text style={styles.entryNote}>{entry.note}</Text>}
                  </View>
                  <Text
                    style={[
                      styles.entryAmount,
                      entry.type === 'IN' ? styles.entryAmountSuccess : styles.entryAmountDanger,
                    ]}
                  >
                    {entry.type === 'IN' ? '+' : '-'}
                    {formatMoney(entry.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Modal */}
      <Modal
        visible={showModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: showModal === 'IN' ? Colors.success.main : Colors.danger.main },
              ]}
            >
              <View style={styles.modalHeaderTitleRow}>
                {showModal === 'IN' ? (
                  <TrendingUp size={22} color={Colors.surface} />
                ) : (
                  <TrendingDown size={22} color={Colors.surface} />
                )}
                <View>
                  <Text style={styles.modalHeaderTitle}>
                    {showModal === 'IN' ? 'Nouvelle entrée' : 'Nouvelle sortie'}
                  </Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    {showModal === 'IN'
                      ? "Ajouter de l'argent en caisse"
                      : "Retirer de l'argent de la caisse"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <X size={20} color={Colors.surface} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category Select */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={category}
                    onValueChange={(itemValue: string) => {
                      setCategory(itemValue);
                      setSelectedSupplierId('');
                      setSelectedCustomerId('');
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sélectionner une catégorie..." value="" />
                    {(showModal === 'IN' ? ENTRY_CATEGORIES : EXIT_CATEGORIES).map(cat => (
                      <Picker.Item key={cat} label={cat} value={cat} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Supplier Select with searchable dropdown */}
              {showSupplierSelect && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Fournisseur <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={supplierSearchText}
                    onChangeText={setSupplierSearchText}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Rechercher un fournisseur..."
                    placeholderTextColor={Colors.textColors.disabled}
                  />
                  {showSupplierDropdown && suppliers.length > 0 && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                        {getFilteredSuppliers().map(supplier => (
                          <TouchableOpacity
                            key={supplier.id}
                            style={styles.dropdownItem}
                            onPress={() => handleSelectSupplier(supplier)}
                          >
                            <Text style={styles.dropdownItemText}>{getPersonName(supplier)}</Text>
                          </TouchableOpacity>
                        ))}
                        {getFilteredSuppliers().length === 0 && (
                          <View style={styles.dropdownItem}>
                            <Text style={styles.dropdownItemTextEmpty}>Aucun résultat</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  {suppliers.length === 0 && (
                    <Text style={styles.formHint}>
                      Aucun fournisseur actif. Ajoutez-en un dans l'onglet Fournisseurs.
                    </Text>
                  )}
                </View>
              )}

              {/* Customer Select with searchable dropdown */}
              {showCustomerSelect && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Client <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={customerSearchText}
                    onChangeText={setCustomerSearchText}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Rechercher un client..."
                    placeholderTextColor={Colors.textColors.disabled}
                  />
                  {showCustomerDropdown && customers.length > 0 && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                        {getFilteredCustomers().map(customer => (
                          <TouchableOpacity
                            key={customer.id}
                            style={styles.dropdownItem}
                            onPress={() => handleSelectCustomer(customer)}
                          >
                            <Text style={styles.dropdownItemText}>{getPersonName(customer)}</Text>
                          </TouchableOpacity>
                        ))}
                        {getFilteredCustomers().length === 0 && (
                          <View style={styles.dropdownItem}>
                            <Text style={styles.dropdownItemTextEmpty}>Aucun résultat</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  {customers.length === 0 && (
                    <Text style={styles.formHint}>
                      Aucun client actif. Ajoutez-en un dans l'onglet Clients.
                    </Text>
                  )}
                </View>
              )}

              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Montant (FCFA)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
                {userRole === 'BOSS' && (
                  <Text style={styles.ownerHint}>
                    💡 Propriétaires: vous pouvez entrer des montants négatifs pour corriger des
                    erreurs
                  </Text>
                )}
              </View>

              {/* Note Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Note {requiresNote(category) && <Text style={styles.required}>*</Text>}
                </Text>
                <TextInput
                  style={styles.noteInput}
                  value={note || ''}
                  onChangeText={text => setNote(text || '')}
                  placeholder={
                    requiresNote(category)
                      ? `Commentaire requis (min. ${MIN_NOTE_LENGTH} caractères)`
                      : 'Ajouter une note ou description...'
                  }
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  textAlignVertical="top"
                />
                {requiresNote(category) && (
                  <Text style={styles.formHint}>
                    Commentaire obligatoire pour la catégorie "Divers"
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={handleCloseModal}>
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    showModal === 'IN'
                      ? styles.modalSubmitButtonSuccess
                      : styles.modalSubmitButtonDanger,
                  ]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Menu Modal */}
      <Modal
        visible={showSettingsMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <TouchableOpacity
          style={styles.settingsOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsMenu(false)}
        >
          <View style={styles.settingsMenu}>
            {/* Bilans - Pour tous sauf EMPLOYEE */}
            {userRole !== 'EMPLOYEE' && (
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('BusinessReports');
                }}
              >
                <View style={styles.settingsMenuItemIcon}>
                  <BarChart3 size={20} color={Colors.action} />
                </View>
                <View style={styles.settingsMenuItemContent}>
                  <Text style={styles.settingsMenuItemTitle}>Bilans</Text>
                  <Text style={styles.settingsMenuItemSubtitle}>Analyses et rapports</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Administration - Pour MANAGER, BOSS, SUPERADMIN */}
            {(userRole === 'MANAGER' || userRole === 'BOSS' || userRole === 'SUPERADMIN') && (
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setShowSettingsMenu(false);
                  navigation.navigate('ShopAdmin');
                }}
              >
                <View style={styles.settingsMenuItemIcon}>
                  <Settings size={20} color={Colors.action} />
                </View>
                <View style={styles.settingsMenuItemContent}>
                  <Text style={styles.settingsMenuItemTitle}>Administration</Text>
                  <Text style={styles.settingsMenuItemSubtitle}>Gestion boutique et PIN</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.settingsMenuDivider} />

            {/* Déconnexion */}
            <TouchableOpacity
              style={[styles.settingsMenuItem, styles.settingsMenuItemDanger]}
              onPress={() => {
                setShowSettingsMenu(false);
                handleLogout();
              }}
            >
              <View style={[styles.settingsMenuItemIcon, styles.settingsMenuItemIconDanger]}>
                <LogOut size={20} color={Colors.danger.main} />
              </View>
              <View style={styles.settingsMenuItemContent}>
                <Text style={[styles.settingsMenuItemTitle, styles.settingsMenuItemTitleDanger]}>
                  Déconnexion
                </Text>
                <Text style={styles.settingsMenuItemSubtitleDanger}>Quitter l'application</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    marginBottom: 0,
    borderRadius: 16,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary[900],
    marginBottom: Spacing.xl,
    fontVariant: ['tabular-nums'],
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  statSubtext: {
    fontSize: 11,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success.main,
  },
  actionButtonDanger: {
    backgroundColor: Colors.danger.main,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  quickNav: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  quickNavButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  quickNavIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  listCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    backgroundColor: Colors.action,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textColors.secondary,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  entriesList: {
    gap: Spacing.md,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.md,
  },
  entryLeft: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  entryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  entryBadgeSuccess: {
    backgroundColor: Colors.success.background,
  },
  entryBadgeDanger: {
    backgroundColor: Colors.danger.background,
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  entryTime: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
  },
  entryPerson: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textColors.secondary,
    marginBottom: Spacing.xs,
  },
  entryNote: {
    fontSize: 12,
    color: Colors.textColors.secondary,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  entryAmountSuccess: {
    color: Colors.success.main,
  },
  entryAmountDanger: {
    color: Colors.danger.main,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.surface,
    marginBottom: 2,
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.danger.main,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  picker: {
    backgroundColor: Colors.surface,
  },
  formHint: {
    fontSize: 12,
    color: Colors.textColors.secondary,
    marginTop: Spacing.xs,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    height: 80,
    textAlignVertical: 'top',
    backgroundColor: Colors.surface,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    maxHeight: 200,
    ...Shadows.sm,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownItemTextEmpty: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSubmitButton: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalSubmitButtonSuccess: {
    backgroundColor: Colors.success.main,
  },
  modalSubmitButtonDanger: {
    backgroundColor: Colors.danger.main,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  ownerHint: {
    fontSize: 12,
    color: Colors.action,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: Spacing.lg,
  },
  settingsMenu: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: 280,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsMenuItemDanger: {
    borderBottomWidth: 0,
  },
  settingsMenuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingsMenuItemIconDanger: {
    backgroundColor: Colors.danger.background,
  },
  settingsMenuItemContent: {
    flex: 1,
  },
  settingsMenuItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  settingsMenuItemTitleDanger: {
    color: Colors.danger.main,
  },
  settingsMenuItemSubtitle: {
    fontSize: 12,
    color: Colors.textColors.secondary,
  },
  settingsMenuItemSubtitleDanger: {
    color: Colors.danger.main,
  },
  settingsMenuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
});
