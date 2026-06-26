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
import { Plus, Smartphone, Lock } from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton } from '../components/ui';
import { pinInvitesApi, adminApi } from '../lib/api';
import { formatDate, formatDateTime } from '../utils/date';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';

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

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'EMPLOYEE':
        return styles.badgeEmployee;
      case 'MANAGER':
        return styles.badgeManager;
      case 'BOSS':
        return styles.badgeOwner;
      default:
        return styles.badgeEmployee;
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
            {/* PIN Stats */}
            {pinStats && (
              <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardPrimary]}>
                  <Text style={styles.statLabel}>Codes actifs</Text>
                  <Text style={styles.statValue}>{pinStats.active}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Codes utilisés</Text>
                  <Text style={styles.statValue}>{pinStats.used}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Appareils</Text>
                  <Text style={styles.statValue}>{devices.length}</Text>
                </View>
              </View>
            )}

            {/* PIN Invites Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Codes PIN d'invitation</Text>
              {pinInvites.length === 0 ? (
                <View style={styles.emptyState}>
                  <Lock size={40} color={Colors.muted.foreground} />
                  <Text style={styles.emptyText}>Aucun code PIN créé</Text>
                </View>
              ) : (
                pinInvites.map(invite => (
                  <View key={invite.id} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemTitle}>{invite.invited_name}</Text>
                      <Text style={styles.listItemSubtitle}>Code: {invite.pin_code}</Text>
                      <Text style={styles.listItemSubtitle}>
                        Expire: {formatDate(invite.expires_at)}
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <View style={[styles.badge, getRoleBadgeStyle(invite.role)]}>
                        <Text style={styles.badgeText}>{getRoleLabel(invite.role)}</Text>
                      </View>
                      {invite.is_used ? (
                        <View style={[styles.badge, styles.badgeUsed]}>
                          <Text style={styles.badgeText}>Utilisé</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleRevokePin(invite)}
                          style={styles.revokeButton}
                        >
                          <Text style={styles.revokeText}>Révoquer</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Devices Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Appareils connectés</Text>
              {devices.length === 0 ? (
                <View style={styles.emptyState}>
                  <Smartphone size={40} color={Colors.muted.foreground} />
                  <Text style={styles.emptyText}>Aucun appareil connecté</Text>
                </View>
              ) : (
                devices.map(device => (
                  <View key={device.id} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemTitle}>{device.device_name}</Text>
                      <Text style={styles.listItemSubtitle}>
                        Utilisateur: {getPersonName(device.user)}
                      </Text>
                      <Text style={styles.listItemSubtitle}>
                        Dernière utilisation: {formatDateTime(device.last_used_at)}
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <View style={[styles.badge, getRoleBadgeStyle(device.user.role)]}>
                        <Text style={styles.badgeText}>{getRoleLabel(device.user.role)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevokeDevice(device)}
                        style={styles.revokeButton}
                      >
                        <Text style={styles.revokeText}>Révoquer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  statCardPrimary: {
    backgroundColor: Colors.primary[50],
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textColors.tertiary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeEmployee: {
    backgroundColor: Colors.info.background,
  },
  badgeAdmin: {
    backgroundColor: Colors.warning.background,
  },
  badgeManager: {
    backgroundColor: Colors.warning.background,
  },
  badgeOwner: {
    backgroundColor: Colors.danger.background,
  },
  badgeUsed: {
    backgroundColor: Colors.muted.main,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  revokeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.danger.background,
  },
  revokeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger.main,
  },
  // Modal styles — bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    borderRadius: 10,
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
    borderRadius: 8,
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
