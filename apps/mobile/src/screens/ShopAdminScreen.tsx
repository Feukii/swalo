import React, { useState, useEffect, useCallback } from 'react';
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
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Smartphone, Lock, Trash, Check } from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton } from '../components/ui';
import { pinInvitesApi, adminApi } from '../lib/api';
import { formatDate, formatDateTime } from '../utils/date';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';

interface ShopAdminScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
  };
}

interface PinInvite {
  id: string;
  pin_code: string;
  invited_name: string;
  role: string;
  expires_at: string;
  is_used: boolean;
  used_at?: string;
  used_by?: { id: string; name: string } | null;
  created_at: string;
}

interface Device {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  last_used_at: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    first_name?: string;
    role: string;
  };
}

interface PinStats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

// Appareil brut tel que renvoyé dans le payload /admin/users
interface RawDevice {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  last_used_at: string;
  created_at: string;
}

// Élément user-role brut renvoyé par adminApi.getShopUsers()
interface RawUserRole {
  role: string;
  user?: {
    id: string;
    name?: string;
    display_name?: string;
    first_name?: string;
    devices?: RawDevice[];
  };
}

export default function ShopAdminScreen({ navigation }: ShopAdminScreenProps) {
  const [pinInvites, setPinInvites] = useState<PinInvite[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pinStats, setPinStats] = useState<PinStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState('EMPLOYEE');
  const [isCreating, setIsCreating] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);

  const roles = [
    { value: 'EMPLOYEE', label: 'Employé' },
    { value: 'MANAGER', label: 'Manager' },
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invitesData, statsData, usersData] = await Promise.all([
        pinInvitesApi.getAll(),
        pinInvitesApi.getStats(),
        adminApi.getShopUsers(),
      ]);

      const invites: PinInvite[] = invitesData.map(raw => {
        const invite = raw as Partial<PinInvite>;
        return {
          id: String(invite.id ?? ''),
          pin_code: String(invite.pin_code ?? ''),
          invited_name: String(invite.invited_name ?? ''),
          role: String(invite.role ?? ''),
          expires_at: String(invite.expires_at ?? ''),
          is_used: Boolean(invite.is_used),
          used_at: invite.used_at,
          used_by: invite.used_by ?? null,
          created_at: String(invite.created_at ?? ''),
        };
      });
      setPinInvites(invites);
      setPinStats(statsData);

      // Get all devices from the payload
      const allDevices: Device[] = usersData.flatMap(raw => {
        const userRole = raw as Partial<RawUserRole>;
        const user = userRole.user;
        if (!user) return [];
        const userDevices = user.devices ?? [];
        return userDevices.map(device => ({
          ...device,
          user: {
            id: user.id,
            name: user.display_name || user.name || 'Utilisateur',
            first_name: user.first_name,
            role: userRole.role,
          },
        }));
      });
      setDevices(allDevices);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkAccess = useCallback(async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const role = user.role || 'EMPLOYEE';

        if (role === 'EMPLOYEE') {
          Alert.alert('Accès refusé', "Vous n'avez pas les permissions pour accéder à cette page");
          navigation.goBack();
          return;
        }
      }
      loadData();
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      navigation.goBack();
    }
  }, [navigation, loadData]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const handleCreatePinInvite = async () => {
    if (!displayName.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    setIsCreating(true);
    try {
      const result = await pinInvitesApi.create({
        invited_name: displayName.trim(),
        role: selectedRole,
      });

      Alert.alert(
        'Code PIN créé',
        `Code: ${result.pin_code}\nPour: ${result.invited_name}\nRôle: ${result.role}`,
        [
          {
            text: 'Partager',
            onPress: () => {
              Share.share({
                message: `Code PIN Swalo\n\nCode: ${result.pin_code}\nPour: ${result.invited_name}\nRôle: ${result.role}\nValide jusqu'au: ${formatDate(result.expires_at)}`,
              });
            },
          },
          { text: 'OK' },
        ]
      );

      setShowCreateModal(false);
      setDisplayName('');
      setSelectedRole('EMPLOYEE');
      loadData();
    } catch (error: unknown) {
      console.error('Erreur lors de la création:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de la création';
      Alert.alert('Erreur', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokePin = (invite: PinInvite) => {
    Alert.alert(
      'Révoquer le code PIN',
      `Voulez-vous vraiment révoquer le code PIN pour "${invite.invited_name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await pinInvitesApi.revoke(invite.id);
              Alert.alert('Succès', 'Code PIN révoqué');
              loadData();
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : 'Erreur lors de la révocation';
              Alert.alert('Erreur', message);
            }
          },
        },
      ]
    );
  };

  const handleRevokeDevice = (device: Device) => {
    Alert.alert(
      "Révoquer l'appareil",
      `Voulez-vous vraiment révoquer l'appareil "${device.device_name}" de ${getPersonName(device.user)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.revokeDevice(device.id);
              Alert.alert('Succès', 'Appareil révoqué');
              loadData();
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : 'Erreur lors de la révocation';
              Alert.alert('Erreur', message);
            }
          },
        },
      ]
    );
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Teintes de chip de rôle (tokens uniquement) — alignées avec UserManagementScreen
  const getRoleTint = (role: string): { bg: string; fg: string } => {
    switch (role) {
      case 'BOSS':
        return { bg: Colors.danger.background, fg: Colors.danger.text };
      case 'MANAGER':
        return { bg: Colors.warning.background, fg: Colors.warning.text };
      case 'EMPLOYEE':
      default:
        return { bg: Colors.primary[100], fg: Colors.primary[700] };
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'EMPLOYEE':
        return 'Employé';
      case 'MANAGER':
        return 'Manager';
      case 'BOSS':
        return 'Propriétaire';
      default:
        return role;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Administration"
        subtitle="Boutique"
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <IconButton onPress={() => setShowCreateModal(true)}>
            <Plus size={22} color={Colors.action} />
          </IconButton>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : (
          <>
            {/* Carte HERO — Codes PIN actifs */}
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Codes PIN actifs</Text>
              <Text style={styles.heroAmount}>{pinStats?.active ?? 0}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{pinStats?.used ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Codes utilisés</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{devices.length}</Text>
                  <Text style={styles.heroStatLabel}>Appareils</Text>
                </View>
              </View>
            </View>

            {/* Codes PIN d'invitation */}
            <Text style={styles.sectionTitle}>Codes PIN d'invitation</Text>
            {pinInvites.length === 0 ? (
              <View style={styles.emptyCard}>
                <Lock size={40} color={Colors.muted.foreground} />
                <Text style={styles.emptyText}>Aucun code PIN créé</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {pinInvites.map((invite, index) => {
                  const tint = getRoleTint(invite.role);
                  return (
                    <View
                      key={invite.id}
                      style={[styles.row, index < pinInvites.length - 1 && styles.rowDivider]}
                    >
                      <View style={[styles.iconSquare, { backgroundColor: tint.bg }]}>
                        <Lock size={20} color={tint.fg} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {invite.invited_name}
                        </Text>
                        <Text style={styles.rowSubtitle}>Code : {invite.pin_code}</Text>
                        <Text style={styles.rowSubtitle}>
                          Expire le {formatDate(invite.expires_at)}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <View style={[styles.roleChip, { backgroundColor: tint.bg }]}>
                          <Text style={[styles.roleChipText, { color: tint.fg }]}>
                            {getRoleLabel(invite.role)}
                          </Text>
                        </View>
                        {invite.is_used ? (
                          <View style={styles.usedChip}>
                            <Check size={12} color={Colors.success.main} />
                            <Text style={styles.usedChipText}>Utilisé</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleRevokePin(invite)}
                            style={styles.revokeButton}
                            activeOpacity={0.7}
                          >
                            <Trash size={13} color={Colors.danger.main} />
                            <Text style={styles.revokeText}>Révoquer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Appareils connectés */}
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
              Appareils connectés
            </Text>
            {devices.length === 0 ? (
              <View style={styles.emptyCard}>
                <Smartphone size={40} color={Colors.muted.foreground} />
                <Text style={styles.emptyText}>Aucun appareil connecté</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {devices.map((device, index) => {
                  const tint = getRoleTint(device.user.role);
                  return (
                    <View
                      key={device.id}
                      style={[styles.row, index < devices.length - 1 && styles.rowDivider]}
                    >
                      <View style={[styles.iconSquare, { backgroundColor: tint.bg }]}>
                        <Smartphone size={20} color={tint.fg} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {device.device_name}
                        </Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          {getPersonName(device.user)}
                        </Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          Dernière utilisation : {formatDateTime(device.last_used_at)}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <View style={[styles.roleChip, { backgroundColor: tint.bg }]}>
                          <Text style={[styles.roleChipText, { color: tint.fg }]}>
                            {getRoleLabel(device.user.role)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRevokeDevice(device)}
                          style={styles.revokeButton}
                          activeOpacity={0.7}
                        >
                          <Trash size={13} color={Colors.danger.main} />
                          <Text style={styles.revokeText}>Révoquer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create PIN Modal — bottom sheet */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Créer un code PIN</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nom d'affichage <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isNameFocused && styles.inputFocused]}
                value={displayName}
                onChangeText={setDisplayName}
                onFocus={() => setIsNameFocused(true)}
                onBlur={() => setIsNameFocused(false)}
                placeholder="Ex: Jean Dupont"
                placeholderTextColor={Colors.textColors.disabled}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rôle</Text>
              <View style={styles.roleButtons}>
                {roles.map(role => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleButton,
                      selectedRole === role.value && styles.roleButtonActive,
                    ]}
                    onPress={() => setSelectedRole(role.value)}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        selectedRole === role.value && styles.roleButtonTextActive,
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setDisplayName('');
                  setSelectedRole('EMPLOYEE');
                }}
                disabled={isCreating}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCreatePinInvite}
                disabled={isCreating}
              >
                {isCreating ? (
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
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  // Hero marine
  hero: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary[300],
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.lg,
  },
  heroStat: {
    flex: 1,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  heroStatLabel: {
    fontSize: 12,
    color: Colors.primary[300],
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.primary[700],
  },
  // Sections
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleSpaced: {
    marginTop: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  usedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.success.background,
  },
  usedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success.text,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.danger.background,
  },
  revokeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger.main,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
    ...Shadows.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
  },
  // Modal styles — bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing['3xl'],
    ...Shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.muted.main,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.secondary,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.danger.main,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.action,
    backgroundColor: Colors.surface,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  roleButtonActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  roleButtonTextActive: {
    color: Colors.onMarine,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.muted.main,
  },
  cancelButtonText: {
    color: Colors.textColors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.action,
  },
  submitButtonText: {
    color: Colors.onMarine,
    fontSize: 16,
    fontWeight: '600',
  },
});
