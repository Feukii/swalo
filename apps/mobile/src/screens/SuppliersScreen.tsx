import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building, Plus, Eye } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, KPICard, StatusBadge, IconButton } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { formatPhoneOnInput } from '../utils/phone';
import { suppliersApi } from '../lib/api';

interface SuppliersScreenProps {
  navigation: any;
}

interface Supplier {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
}

export default function SuppliersScreen({ navigation }: SuppliersScreenProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await suppliersApi.getAll();
      setSuppliers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
      Alert.alert('Erreur', 'Impossible de charger les fournisseurs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    setName('');
    setFirstName('');
    setPhone('');
    setInitialBalance('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setName('');
    setFirstName('');
    setPhone('');
    setInitialBalance('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
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

    // Valider le solde initial si fourni
    let initialBalanceInCentimes: number | undefined;
    if (initialBalance.trim()) {
      const balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance < 0) {
        Alert.alert('Erreur', 'Le solde initial doit être un nombre positif');
        return;
      }
      initialBalanceInCentimes = Math.round(balance); // Already in FCFA
    }

    setIsSaving(true);
    try {
      const supplierData: any = {
        name: name.trim(),
      };

      if (firstName.trim()) {
        supplierData.first_name = firstName.trim();
      }

      if (phone.trim()) {
        supplierData.phone = phone.trim();
      }

      if (initialBalanceInCentimes !== undefined) {
        supplierData.initial_balance = initialBalanceInCentimes;
      }

      await suppliersApi.create(supplierData);

      Alert.alert('Succès', 'Fournisseur créé avec succès');
      handleCloseModal();
      loadSuppliers();
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const fullName = `${supplier.first_name || ''} ${supplier.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      supplier.phone?.includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.is_active).length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Fournisseurs"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton onPress={() => navigation.navigate('SupplierBalancesSummary')}>
              <Eye size={24} color={Colors.primary[900]} />
            </IconButton>
            <IconButton onPress={handleOpenModal}>
              <Plus size={24} color={Colors.primary[900]} />
            </IconButton>
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Total fournisseurs"
              value={String(stats.total)}
              icon={<Building size={20} color={Colors.muted.foreground} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard label="Fournisseurs actifs" value={String(stats.active)} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un fournisseur..."
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Suppliers List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Liste des fournisseurs</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary[900]} />
            </View>
          ) : filteredSuppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Building size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
              </Text>
            </View>
          ) : (
            filteredSuppliers.map(supplier => (
              <ListItem
                key={supplier.id}
                icon={<Building size={20} color={Colors.primary[900]} />}
                title={getPersonName(supplier)}
                subtitle={
                  supplier.phone
                    ? `📱 ${supplier.phone}`
                    : supplier.email
                      ? `✉️ ${supplier.email}`
                      : undefined
                }
                badge={{
                  text: supplier.is_active ? 'Actif' : 'Inactif',
                  variant: supplier.is_active ? 'success' : 'danger',
                }}
                onClick={() => navigation.navigate('SupplierDetails', { id: supplier.id })}
              />
            ))
          )}
        </View>
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
              <Text style={styles.label}>Solde initial (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={initialBalance}
                onChangeText={setInitialBalance}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Montant de la dette initiale envers le fournisseur (optionnel)
              </Text>
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  searchCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  searchInput: {
    fontSize: 16,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing['2xl'],
  },
  cardHeader: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
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
    borderRadius: 18,
    padding: Spacing['2xl'],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
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
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
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
    backgroundColor: Colors.primary[900],
  },
  submitButtonText: {
    color: Colors.primary.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
});
