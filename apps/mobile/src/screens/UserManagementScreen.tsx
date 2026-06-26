import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users, Smartphone, Clock } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { adminApi } from '../lib/api';
import type { RootStackParamList } from '../../App';

interface UserDevice {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  last_login_at: string;
  is_active: boolean;
}

interface User {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  pin_code: string;
  is_active: boolean;
  devices: UserDevice[];
}

interface UserRole {
  role: string;
  work_start_time?: string;
  work_end_time?: string;
  work_days?: string;
  user: User;
}

interface UserManagementScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'UserManagement'>;
}

// Teintes d'avatar stables dérivées du rôle (tokens uniquement)
const AVATAR_BY_ROLE: Record<string, { bg: string; fg: string }> = {
  SUPERADMIN: { bg: Colors.info.background, fg: Colors.info.text },
  BOSS: { bg: Colors.danger.background, fg: Colors.danger.text },
  MANAGER: { bg: Colors.warning.background, fg: Colors.warning.text },
  EMPLOYEE: { bg: Colors.primary[100], fg: Colors.primary[700] },
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserManagementScreen({ navigation }: UserManagementScreenProps) {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await adminApi.getShopUsers<UserRole>();
      setUsers(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Erreur', message || 'Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleViewDevices = (userId: string, userName: string) => {
    const userRole = users.find(ur => ur.user.id === userId);
    if (!userRole) return;

    const deviceList = userRole.user.devices
      .map(
        (d, i) =>
          `${i + 1}. ${d.device_name}\n   ${d.is_active ? '✓ Actif' : '✗ Révoqué'}\n   Dernière connexion: ${new Date(d.last_login_at).toLocaleDateString()}`
      )
      .join('\n\n');

    Alert.alert(`Appareils de ${userName}`, deviceList || 'Aucun appareil enregistré', [
      { text: 'OK' },
    ]);
  };

  const _handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Révoquer l'appareil",
      `Êtes-vous sûr de vouloir révoquer l'accès de "${deviceName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.revokeDevice(deviceId);
              Alert.alert('Succès', 'Appareil révoqué avec succès');
              loadUsers();
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : '';
              Alert.alert('Erreur', message || "Impossible de révoquer l'appareil");
            }
          },
        },
      ]
    );
  };

  const getRoleAvatar = (role: string) => AVATAR_BY_ROLE[role] ?? AVATAR_BY_ROLE.EMPLOYEE;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPERADMIN: 'Super Admin',
      BOSS: 'Propriétaire',
      MANAGER: 'Manager',
      EMPLOYEE: 'Employé',
    };
    return labels[role] || role;
  };

  const renderUser = ({ item }: { item: UserRole }) => {
    const { user, role, work_start_time, work_end_time } = item;
    const activeDevices = user.devices.filter(d => d.is_active).length;
    const avatar = getRoleAvatar(role);

    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={[styles.userAvatar, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.userAvatarText, { color: avatar.fg }]}>
              {getInitials(user.display_name)}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.display_name}
            </Text>
            {user.phone || user.email ? (
              <Text style={styles.userContact} numberOfLines={1}>
                {user.phone || user.email}
              </Text>
            ) : null}
            {work_start_time && work_end_time ? (
              <View style={styles.scheduleRow}>
                <Clock size={12} color={Colors.textColors.tertiary} />
                <Text style={styles.userSchedule}>
                  {work_start_time} - {work_end_time}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.roleChip, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.roleChipText, { color: avatar.fg }]}>{getRoleLabel(role)}</Text>
          </View>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={() => handleViewDevices(user.id, user.display_name)}
          >
            <Smartphone size={16} color={Colors.action} />
            <Text style={styles.actionButtonText}>
              Appareils ({activeDevices}/{user.devices.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="Utilisateurs"
          subtitle="Équipe & accès"
          showBack={true}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Utilisateurs"
        subtitle="Équipe & accès"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.user.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCount}>{users.length}</Text>
            <Text style={styles.summaryLabel}>
              {users.length > 1 ? 'membres de l’équipe' : 'membre de l’équipe'}
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
          </View>
        }
      />
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
  listContent: {
    padding: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  summaryCount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.primary[300],
    marginTop: Spacing.xs,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  userContact: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userSchedule: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
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
  userActions: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    flex: 1,
    minHeight: 44,
  },
  actionButtonText: {
    fontSize: 13,
    color: Colors.action,
    fontWeight: '600',
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
});
