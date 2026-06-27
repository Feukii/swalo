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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users, Smartphone, Plus } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import { adminApi } from '../lib/api';
import { useCurrentUser } from '../hooks/useCurrentUser';
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

// Dernière connexion d'un membre = la plus récente de ses appareils.
function getLastSeen(devices: UserDevice[]): string | null {
  const times = devices
    .map(d => d.last_login_at)
    .filter(Boolean)
    .map(t => new Date(t).getTime())
    .filter(t => !Number.isNaN(t));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

// Présence relative (FR) : "En ligne" / "Il y a 12 min" / "Il y a 2 h" / "Hier" / date.
function formatPresence(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return null;
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 2) return 'En ligne';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffHours < 48) return 'Hier';
  return new Date(timestamp).toLocaleDateString();
}

export default function UserManagementScreen({ navigation }: UserManagementScreenProps) {
  const { userId: currentUserId } = useCurrentUser();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Surcouche locale d'activation d'accès (clé = user.id). Voir handleToggleAccess.
  const [accessOverrides, setAccessOverrides] = useState<Record<string, boolean>>({});

  const isAccessActive = (ur: UserRole) => {
    const override = accessOverrides[ur.user.id];
    return override !== undefined ? override : !!ur.user.is_active;
  };

  const activeAccessCount = users.filter(isAccessActive).length;

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

  // Flux d'invitation existant (création de code PIN) hébergé par ShopAdminScreen.
  const handleInvite = () => {
    navigation.navigate('ShopAdmin');
  };

  // TODO(api): brancher sur l'endpoint d'activation/désactivation d'accès quand il
  // sera exposé (adminApi). Pour l'instant l'état est purement local (optimiste).
  const handleToggleAccess = (userId: string, value: boolean) => {
    setAccessOverrides(prev => ({ ...prev, [userId]: value }));
  };

  const getRoleAvatar = (role: string) => AVATAR_BY_ROLE[role] ?? AVATAR_BY_ROLE.EMPLOYEE;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPERADMIN: 'SUPERADMIN',
      BOSS: 'BOSS',
      MANAGER: 'MANAGER',
      EMPLOYEE: 'EMPLOYÉ',
    };
    return labels[role] || role.toUpperCase();
  };

  const renderUser = ({ item }: { item: UserRole }) => {
    const { user, role } = item;
    const deviceCount = user.devices.length;
    const avatar = getRoleAvatar(role);
    const isSelf = !!currentUserId && user.id === currentUserId;
    const accessActive = isAccessActive(item);
    const presence = formatPresence(getLastSeen(user.devices));
    const contactLine = user.phone || user.email || '';

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
            {contactLine || presence ? (
              <Text style={styles.userContact} numberOfLines={1}>
                {contactLine}
                {contactLine && presence ? ' · ' : ''}
                {presence ?? ''}
              </Text>
            ) : null}
          </View>
          <View style={[styles.roleChip, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.roleChipText, { color: avatar.fg }]}>{getRoleLabel(role)}</Text>
          </View>
        </View>

        <View style={styles.userFooter}>
          <TouchableOpacity
            style={styles.deviceRow}
            activeOpacity={0.7}
            onPress={() => handleViewDevices(user.id, user.display_name)}
          >
            <Smartphone size={16} color={Colors.textColors.tertiary} />
            <Text style={styles.deviceText}>
              {deviceCount} appareil{deviceCount > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerRight}>
            <Text style={accessActive ? styles.accessActiveText : styles.accessInactiveText}>
              {accessActive ? 'Accès actif' : 'Accès suspendu'}
            </Text>
            {isSelf ? (
              <>
                <Text style={styles.selfTag}>Vous</Text>
                <Switch
                  value={accessActive}
                  onValueChange={v => handleToggleAccess(user.id, v)}
                  trackColor={{ false: Colors.primary[200], true: Colors.success.main }}
                  thumbColor={Colors.surface}
                />
              </>
            ) : null}
          </View>
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
        subtitle={`${activeAccessCount} accès actif${activeAccessCount > 1 ? 's' : ''}`}
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.user.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <View style={styles.summaryIcon}>
                  <Users size={18} color={Colors.onMarine} />
                </View>
                <Text style={styles.summaryCount}>{activeAccessCount}</Text>
              </View>
              <Text style={styles.summarySub}>accès actifs sur la boutique</Text>
            </View>

            <TouchableOpacity style={styles.inviteCard} activeOpacity={0.85} onPress={handleInvite}>
              <View style={styles.inviteIcon}>
                <Plus size={20} color={Colors.onMarine} />
              </View>
              <View style={styles.inviteTextWrap}>
                <Text style={styles.inviteTitle}>Inviter un employé</Text>
                <Text style={styles.inviteSubtitle}>Génère un code PIN d’accès</Text>
              </View>
            </TouchableOpacity>

            {users.length > 0 ? <Text style={styles.sectionTitle}>Membres de l’équipe</Text> : null}
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
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: -0.5,
  },
  summarySub: {
    fontSize: 13,
    color: Colors.primary[300],
    marginTop: Spacing.sm,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.action,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteTextWrap: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  inviteSubtitle: {
    fontSize: 13,
    color: Colors.onMarine,
    opacity: 0.85,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
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
    borderRadius: BorderRadius.md,
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
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.primary[100],
    paddingTop: Spacing.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 28,
  },
  deviceText: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  accessActiveText: {
    fontSize: 13,
    color: Colors.success.main,
    fontWeight: '700',
  },
  accessInactiveText: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    fontWeight: '600',
  },
  selfTag: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
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
