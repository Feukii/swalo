import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { Search, ChevronDown, Check } from '../icons/SimpleIcons';
import { Colors, Spacing } from '../../constants/theme-v2';

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ id: string; name: string; first_name?: string }>;
  placeholder?: string;
  label?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Sélectionner...',
  label,
}: SearchableSelectProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find(opt => opt.id === value);
  const displayText = selectedOption
    ? selectedOption.first_name
      ? `${selectedOption.first_name} ${selectedOption.name}`
      : selectedOption.name
    : placeholder;

  const filteredOptions = options.filter(option => {
    const fullName = option.first_name ? `${option.first_name} ${option.name}` : option.name;
    return fullName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelect = (id: string) => {
    onValueChange(id);
    setShowModal(false);
    setSearchQuery('');
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity style={styles.selectButton} onPress={() => setShowModal(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]}>{displayText}</Text>
        <ChevronDown size={20} color={Colors.muted.foreground} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner un client</Text>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.muted.foreground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={Colors.muted.foreground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {/* Options List */}
            <ScrollView style={styles.optionsList}>
              {filteredOptions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Aucun client trouvé</Text>
                </View>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = option.id === value;
                  const fullName = option.first_name
                    ? `${option.first_name} ${option.name}`
                    : option.name;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => handleSelect(option.id)}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {fullName}
                      </Text>
                      {isSelected && <Check size={20} color={Colors.primary[900]} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowModal(false);
                setSearchQuery('');
              }}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  selectText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  placeholder: {
    color: Colors.muted.foreground,
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
    maxHeight: '80%',
    paddingTop: Spacing['2xl'],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  optionsList: {
    maxHeight: 400,
    paddingHorizontal: Spacing['2xl'],
  },
  emptyState: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: Colors.primary[50],
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.primary[900],
  },
  closeButton: {
    marginHorizontal: Spacing['2xl'],
    marginVertical: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
