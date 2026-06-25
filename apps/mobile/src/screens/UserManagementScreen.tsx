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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return Colors.info.main;
      case 'BOSS':
        return Colors.danger.main;
      case 'MANAGER':
        return Colors.warning.main;
      case 'EMPLOYEE':
        return Colors.action;
      default:
        return Colors.muted.foreground;
    }
  };

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

    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.display_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.display_name}</Text>
            <Text style={styles.userContact}>{user.phone || user.email}</Text>
            {work_start_time && work_end_time && (
              <Text style={styles.userSchedule}>
                Horaires: {work_start_time} - {work_end_time}
              </Text>
            )}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(role) }]}>
            <Text style={styles.roleBadgeText}>{getRoleLabel(role)}</Text>
          </View>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleViewDevices(user.id, user.display_name)}
          >
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
        <ScreenHeader title="Utilisateurs" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Utilisateurs" showBack={true} onBack={() => navigation.goBack()} />

      {/* Stats summary */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>{users.length} utilisateur(s)</Text>
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.user.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
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
  statsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statsText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.lg,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.action,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userAvatarText: {
    color: Colors.primary.foreground,
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  userContact: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: 2,
  },
  userSchedule: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    color: Colors.action,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted.foreground,
  },
});
