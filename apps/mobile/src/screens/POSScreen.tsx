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
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#102A43', '#a855f7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>💰 Caisse</Text>
          <View style={styles.headerButtons}>
            {/* Bouton de rafraîchissement manuel des données */}
            <TouchableOpacity onPress={loadData} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>🔄</Text>
            </TouchableOpacity>
            {/* Bouton d'accès au menu de paramètres */}
            <TouchableOpacity onPress={() => setShowSettingsMenu(true)} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.balanceLabel}>Solde de caisse</Text>
        <Text style={styles.balanceAmount}>{formatMoney(stats?.balance || 0)}</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Entrées</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.todayEntries || 0)}</Text>
            <Text style={styles.statSubtext}>{stats?.entriesCount || 0} op.</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sorties</Text>
            <Text style={styles.statValue}>{formatMoney(stats?.todayExits || 0)}</Text>
            <Text style={styles.statSubtext}>{stats?.exitsCount || 0} op.</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Net</Text>
            <Text
              style={[styles.statValue, (stats?.todayNet || 0) < 0 && styles.statValueNegative]}
            >
              {formatMoney(stats?.todayNet || 0)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSuccess]}
          onPress={() => handleOpenModal('IN')}
        >
          <Text style={styles.actionButtonIcon}>↗️</Text>
          <Text style={styles.actionButtonText}>Entrée</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={() => handleOpenModal('OUT')}
        >
          <Text style={styles.actionButtonIcon}>↙️</Text>
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
          <Text style={styles.quickNavIcon}>🏭</Text>
          <Text style={styles.quickNavText}>Fournisseurs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickNavButton}
          onPress={() => navigation.navigate('Customers')}
        >
          <Text style={styles.quickNavIcon}>👥</Text>
          <Text style={styles.quickNavText}>Clients</Text>
        </TouchableOpacity>
      </View>

      {/* Operations List */}
      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>📊 Opérations du jour</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{entries.length}</Text>
          </View>
        </View>

        <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
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
                        <Text style={styles.entryBadgeText}>
                          {entry.type === 'IN' ? '↗️' : '↙️'} {entry.category}
                        </Text>
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
                          {supplier && `🏭 ${getPersonName(supplier)}`}
                          {customer && `👤 ${getPersonName(customer)}`}
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
            <LinearGradient
              colors={showModal === 'IN' ? ['#10b981', '#059669'] : ['#ef4444', '#dc2626']}
              style={styles.modalHeader}
            >
              <View>
                <Text style={styles.modalHeaderTitle}>
                  {showModal === 'IN' ? '↗️ Nouvelle entrée' : '↙️ Nouvelle sortie'}
                </Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {showModal === 'IN'
                    ? "Ajouter de l'argent en caisse"
                    : "Retirer de l'argent de la caisse"}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

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
                    placeholderTextColor="#9ca3af"
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
                    placeholderTextColor="#9ca3af"
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
                  <Text style={styles.settingsMenuItemIconText}>📊</Text>
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
                  <Text style={styles.settingsMenuItemIconText}>⚙️</Text>
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
              <View style={styles.settingsMenuItemIcon}>
                <Text style={styles.settingsMenuItemIconText}>🚪</Text>
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
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    fontSize: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statValueNegative: {
    color: '#fbbf24',
  },
  statSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonSuccess: {
    backgroundColor: '#10b981',
  },
  actionButtonDanger: {
    backgroundColor: '#ef4444',
  },
  actionButtonIcon: {
    fontSize: 24,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickNav: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickNavButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickNavIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickNavText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  listCard: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#102A43',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  entriesList: {
    gap: 12,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  entryLeft: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  entryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  entryBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  entryBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  entryTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  entryPerson: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  entryNote: {
    fontSize: 12,
    color: '#6b7280',
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryAmountSuccess: {
    color: '#10b981',
  },
  entryAmountDanger: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
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
  modalCloseButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: '#fff',
  },
  formHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 12,
  },
  amountCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 80,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
  },
  dropdownList: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#111827',
  },
  dropdownItemTextEmpty: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalSubmitButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSubmitButtonSuccess: {
    backgroundColor: '#10b981',
  },
  modalSubmitButtonDanger: {
    backgroundColor: '#ef4444',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  ownerHint: {
    fontSize: 12,
    color: '#7c3aed',
    marginTop: 4,
    fontStyle: 'italic',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  settingsMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingsMenuItemDanger: {
    borderBottomWidth: 0,
  },
  settingsMenuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsMenuItemIconText: {
    fontSize: 20,
  },
  settingsMenuItemContent: {
    flex: 1,
  },
  settingsMenuItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  settingsMenuItemTitleDanger: {
    color: '#ef4444',
  },
  settingsMenuItemSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  settingsMenuItemSubtitleDanger: {
    color: '#ef4444',
  },
  settingsMenuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
});
