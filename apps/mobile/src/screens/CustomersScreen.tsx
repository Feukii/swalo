import React, { useState } from 'react';
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
import { Users, Plus, Eye } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, KPICard, IconButton } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatPhoneOnInput } from '../utils/phone';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useLocalCustomers } from '../hooks/useLocalData';
import { createCustomerOffline, createReceivableOffline } from '../db/offlineWrite';

interface CustomersScreenNavigation {
  goBack: () => void;
  navigate: {
    (screen: 'CustomerBalancesSummary'): void;
    (screen: 'CustomerDetails', params: { id: string }): void;
  };
}

interface CustomersScreenProps {
  navigation: CustomersScreenNavigation;
}

export default function CustomersScreen({ navigation }: CustomersScreenProps) {
  const { shop } = useCurrentUser();
  const shopId = shop?.id || null;
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Local data hook - reads from SQLite
  const { data: customers, loading: isLoading, refresh } = useLocalCustomers(shopId);

  // Form state
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    const isDuplicate = customers.some(customer => {
      const existingFullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase().trim();
      return existingFullName === newFullName;
    });

    if (isDuplicate) {
      Alert.alert(
        'Client existant',
        `Un client avec le nom "${firstName.trim() ? `${firstName.trim()} ${name.trim()}` : name.trim()}" existe déjà.`
      );
      return;
    }

    // Valider le solde initial si fourni
    let initialBalanceValue: number | undefined;
    if (initialBalance.trim()) {
      const balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance < 0) {
        Alert.alert('Erreur', 'Le solde initial doit être un nombre positif');
        return;
      }
      initialBalanceValue = Math.round(balance);
    }

    if (!shopId) {
      Alert.alert('Erreur', 'Boutique non identifiée');
      return;
    }

    setIsSaving(true);
    try {
      const { customerId } = await createCustomerOffline({
        shopId,
        name: name.trim(),
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      // If initial balance provided, create a receivable
      if (initialBalanceValue && initialBalanceValue > 0) {
        await createReceivableOffline({
          shopId,
          customerId,
          amount: initialBalanceValue,
          description: 'Solde initial',
        });
      }

      Alert.alert('Succes', 'Client cree avec succes');
      handleCloseModal();
      await refresh();
    } catch (error: unknown) {
      console.error('Erreur lors de la creation:', error);
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Erreur', message || 'Erreur lors de la creation');
    } finally {
      setIsSaving(false);
    }
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      customer.phone?.includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: customers.length,
    active: customers.filter(s => s.is_active).length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Clients"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton onPress={() => navigation.navigate('CustomerBalancesSummary')}>
              <Eye size={24} color={Colors.action} />
            </IconButton>
            <IconButton onPress={handleOpenModal}>
              <Plus size={24} color={Colors.action} />
            </IconButton>
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Total clients"
              value={String(stats.total)}
              icon={<Users size={20} color={Colors.action} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard label="Clients actifs" value={String(stats.active)} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un client..."
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Customers List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Liste des clients</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.action} />
            </View>
          ) : filteredCustomers.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
              </Text>
            </View>
          ) : (
            filteredCustomers.map(customer => (
              <ListItem
                key={customer.id}
                icon={<Users size={20} color={Colors.action} />}
                title={getPersonName(customer)}
                subtitle={
                  customer.phone
                    ? `📱 ${customer.phone}`
                    : customer.email
                      ? `✉️ ${customer.email}`
                      : undefined
                }
                badge={{
                  text: customer.is_active ? 'Actif' : 'Inactif',
                  variant: customer.is_active ? 'success' : 'danger',
                }}
                onClick={() => navigation.navigate('CustomerDetails', { id: customer.id })}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Client</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nom <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom du client"
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
              <Text style={styles.hint}>Montant de la créance initiale du client (optionnel)</Text>
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
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchInput: {
    fontSize: 16,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
