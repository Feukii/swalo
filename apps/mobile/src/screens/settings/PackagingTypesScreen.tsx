import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ui';
import { Colors, Spacing } from '../../constants/theme-v2';
import { Plus, Edit, Trash, Package } from '../../components/icons/SimpleIcons';
import { packagingTypesApi } from '../../lib/api';

interface PackagingType {
  id: string;
  name: string;
  symbol: string | null;
  is_default: boolean;
  shop_id: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  symbol: string;
}

const INITIAL_FORM: FormData = { name: '', symbol: '' };

export default function PackagingTypesScreen({ navigation }: any) {
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingType | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await packagingTypesApi.getAll();
      const data = (response as any).data ?? response;
      setPackagingTypes(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de charger les conditionnements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM);
    setShowModal(true);
  };

  const openEditModal = (item: PackagingType) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      symbol: item.symbol || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(INITIAL_FORM);
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    setSaving(true);
    try {
      const payload: { name: string; symbol?: string } = { name: trimmedName };
      const trimmedSymbol = formData.symbol.trim();
      if (trimmedSymbol) {
        payload.symbol = trimmedSymbol;
      }

      if (editingItem) {
        await packagingTypesApi.update(editingItem.id, payload);
        Alert.alert('Succes', 'Conditionnement modifie avec succes');
      } else {
        await packagingTypesApi.create(payload);
        Alert.alert('Succes', 'Conditionnement cree avec succes');
      }

      closeModal();
      loadData();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder le conditionnement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: PackagingType) => {
    if (item.is_default) {
      Alert.alert(
        'Action impossible',
        'Les conditionnements par defaut ne peuvent pas etre supprimes.'
      );
      return;
    }

    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer le conditionnement "${item.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await packagingTypesApi.delete(item.id);
              Alert.alert('Succes', 'Conditionnement supprime avec succes');
              loadData();
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de supprimer le conditionnement');
            }
          },
        },
      ]
    );
  };

  const handleInitDefaults = () => {
    Alert.alert(
      'Initialiser les types par defaut',
      'Cela va creer les conditionnements standards (Unite, Carton, Boite, etc.). Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Initialiser',
          onPress: async () => {
            setInitializing(true);
            try {
              await packagingTypesApi.initDefaults();
              Alert.alert('Succes', 'Les conditionnements par defaut ont ete crees');
              loadData();
            } catch (error: any) {
              Alert.alert(
                'Erreur',
                error.message || "Impossible d'initialiser les conditionnements"
              );
            } finally {
              setInitializing(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PackagingType }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemIconBox}>
        <Package size={20} color={Colors.primary[900]} />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Par defaut</Text>
            </View>
          )}
        </View>
        {item.symbol ? (
          <Text style={styles.itemSymbol}>Symbole : {item.symbol}</Text>
        ) : (
          <Text style={styles.itemSymbolEmpty}>Aucun symbole</Text>
        )}
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <Edit size={18} color={Colors.primary[900]} />
        </TouchableOpacity>

        {!item.is_default && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Trash size={18} color={Colors.danger.main} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Package size={48} color={Colors.muted.foreground} />
      <Text style={styles.emptyTitle}>Aucun conditionnement</Text>
      <Text style={styles.emptySubtitle}>
        Commencez par initialiser les types par defaut ou creez-en un nouveau.
      </Text>
      <TouchableOpacity
        style={styles.initButton}
        onPress={handleInitDefaults}
        disabled={initializing}
        activeOpacity={0.7}
      >
        {initializing ? (
          <ActivityIndicator size="small" color={Colors.primary.foreground} />
        ) : (
          <Text style={styles.initButtonText}>Initialiser les types par defaut</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => {
    if (packagingTypes.length > 0) {
      return (
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            {packagingTypes.length} conditionnement{packagingTypes.length > 1 ? 's' : ''}
          </Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Conditionnements" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Conditionnements"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={openCreateModal}
            style={styles.headerAddButton}
            activeOpacity={0.7}
          >
            <Plus size={20} color={Colors.primary[900]} />
            <Text style={styles.headerAddText}>Ajouter</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={packagingTypes}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary[900]]}
            tintColor={Colors.primary[900]}
          />
        }
      />

      {/* Modal Formulaire */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Modifier le conditionnement' : 'Nouveau conditionnement'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Nom <Text style={styles.formRequired}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Ex : Carton, Boite, Unite..."
                placeholderTextColor={Colors.muted.foreground}
                autoFocus={true}
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Symbole</Text>
              <TextInput
                style={styles.formInput}
                value={formData.symbol}
                onChangeText={text => setFormData(prev => ({ ...prev, symbol: text }))}
                placeholder="Ex : ctn, bte, u..."
                placeholderTextColor={Colors.muted.foreground}
                maxLength={10}
              />
              <Text style={styles.formHint}>
                Abreviation courte utilisee dans les listes (optionnel)
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.primary.foreground} />
                ) : (
                  <Text style={styles.submitButtonText}>{editingItem ? 'Modifier' : 'Creer'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  listHeader: {
    paddingBottom: Spacing.md,
  },
  listHeaderText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  // Item card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.muted.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  defaultBadge: {
    backgroundColor: Colors.info.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.info.text,
  },
  itemSymbol: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  itemSymbolEmpty: {
    fontSize: 13,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.muted.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 20,
  },
  initButton: {
    backgroundColor: Colors.primary[900],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  initButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  // Modal
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
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  formRequired: {
    color: Colors.danger.main,
  },
  formInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  formHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: Spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: Colors.muted.main,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.primary[900],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
