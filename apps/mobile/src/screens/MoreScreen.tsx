import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Users,
  Building,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Package,
  Clock,
  Receipt,
  RefreshCw,
  ArrowLeftRight,
  Store,
  Lock,
  Bell,
  AlertTriangle,
  FileText,
  ChevronRight,
  IconProps,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import { usePermissions } from '../hooks/usePermissions';
import { sellerTasksApi } from '../lib/api';
import { PERMISSION_MODULES } from '@swalo/core/modules/permissions';

const PERMISSION_MODULE_SET = new Set<string>(PERMISSION_MODULES);

type IconComponent = (props: IconProps) => React.JSX.Element;

interface MenuItem {
  icon: IconComponent;
  title: string;
  screen: string;
  module?: string;
  /** Couleur d'accent de l'icône (token) */
  tint: string;
  /** Affiche le badge « clients à relancer » (compteur seller-tasks) sur cette entrée */
  showRelanceBadge?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Sections de la maquette PLUS (libellés gris + carte blanche par section).
// La logique (screen / module / navigation) reste inchangée : seules la
// couleur d'accent et l'organisation en sections sont des choix de rendu.
const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Relances client',
    items: [
      {
        icon: Bell,
        title: 'Relances & tâches',
        screen: 'Relances',
        module: 'customers',
        tint: Colors.warning.main,
        showRelanceBadge: true,
      },
      {
        icon: Settings,
        title: 'Réglages relances',
        screen: 'ReminderSettings',
        module: 'customers',
        tint: Colors.tertiary,
      },
    ],
  },
  {
    title: 'Gestion',
    items: [
      {
        icon: Users,
        title: 'Clients & créances',
        screen: 'Customers',
        module: 'customers',
        tint: Colors.warning.main,
        showRelanceBadge: true,
      },
      {
        icon: Building,
        title: 'Fournisseurs & dettes',
        screen: 'Suppliers',
        module: 'suppliers',
        tint: Colors.danger.main,
      },
      {
        icon: Package,
        title: 'Produits & prix',
        screen: 'ProductCatalog',
        module: 'products',
        tint: Colors.action,
      },
    ],
  },
  {
    title: 'Pilotage',
    items: [
      {
        icon: BarChart3,
        title: 'Rapports',
        screen: 'BusinessReports',
        module: 'reports',
        tint: Colors.primary.main,
      },
      {
        icon: AlertTriangle,
        title: 'Supervision',
        screen: 'Supervision',
        tint: Colors.danger.main,
      },
      {
        icon: FileText,
        title: 'Comptabilité',
        screen: 'Comptability',
        tint: Colors.tertiary,
      },
      {
        icon: Receipt,
        title: 'Factures',
        screen: 'InvoiceList',
        module: 'invoices',
        tint: Colors.action,
      },
      {
        icon: Clock,
        title: 'Historique des transactions',
        screen: 'TransactionHistory',
        module: 'sales',
        tint: Colors.tertiary,
      },
    ],
  },
  {
    title: 'Boutique',
    items: [
      {
        icon: ArrowLeftRight,
        title: 'Transferts inter-boutiques',
        screen: 'Transfers',
        module: 'transfers',
        tint: Colors.success.main,
      },
      {
        icon: Store,
        title: 'Mes boutiques',
        screen: 'ShopSwitcher',
        module: 'enterprise',
        tint: Colors.action,
      },
      {
        icon: UserCog,
        title: 'Utilisateurs',
        screen: 'UserManagement',
        module: 'admin',
        tint: Colors.tertiary,
      },
      {
        icon: RefreshCw,
        title: 'Synchronisation',
        screen: 'SyncStatus',
        tint: Colors.tertiary,
      },
      {
        icon: Settings,
        title: 'Administration',
        screen: 'ShopAdmin',
        tint: Colors.tertiary,
      },
    ],
  },
];

interface ParentNavigator {
  reset: (state: { index: number; routes: { name: string }[] }) => void;
  navigate: (screen: string) => void;
}

interface MoreScreenProps {
  navigation: {
    getParent: () => ParentNavigator | undefined;
  };
}

interface ModuleRowProps {
  item: MenuItem;
  isLast: boolean;
  disabled?: boolean;
  badge?: number;
  onPress: () => void;
}

function ModuleRow({ item, isLast, disabled = false, badge, onPress }: ModuleRowProps) {
  const Icon = disabled ? Lock : item.icon;
  const tint = disabled ? Colors.textColors.disabled : item.tint;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconSquare, { backgroundColor: `${tint}1A` }]}>
        <Icon size={20} color={tint} />
      </View>

      <Text style={[styles.rowTitle, disabled && styles.rowTitleDisabled]} numberOfLines={1}>
        {item.title}
      </Text>

      {typeof badge === 'number' && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}

      <ChevronRight size={20} color={Colors.textColors.disabled} />
    </Pressable>
  );
}

export default function MoreScreen({ navigation }: MoreScreenProps) {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [licenseTier, setLicenseTier] = useState<string>('STARTER');
  const [relanceCount, setRelanceCount] = useState(0);
  const { can } = usePermissions();

  // Bug 9: Recharger les modules a chaque focus (au lieu de useEffect([]))
  useFocusEffect(
    useCallback(() => {
      const loadModules = async () => {
        try {
          const modules = await AsyncStorage.getItem('enabled_modules');
          const tier = await AsyncStorage.getItem('license_tier');
          if (modules) setEnabledModules(JSON.parse(modules));
          if (tier) setLicenseTier(tier);
        } catch {
          // Fallback: all modules allowed
        }
      };
      const loadRelanceCount = async () => {
        try {
          const { count } = await sellerTasksApi.getCount();
          setRelanceCount(count);
        } catch {
          // Hors-ligne ou serveur indisponible : on garde la valeur précédente
        }
      };
      loadModules();
      loadRelanceCount();
    }, [])
  );

  const isModuleEnabled = (moduleCode?: string): boolean => {
    if (!moduleCode) return true;
    // Empty array = all allowed (backwards compat)
    if (enabledModules.length === 0) return true;
    return enabledModules.includes(moduleCode);
  };

  // Gating par permission fine : on masque une entrée si le module est connu de
  // la matrice de permissions et que l'utilisateur n'a pas la capacité 'view'.
  // Les modules hors matrice (enterprise, admin, sync...) ne sont pas filtrés ici.
  const hasViewPermission = (moduleCode?: string): boolean => {
    if (!moduleCode || !PERMISSION_MODULE_SET.has(moduleCode)) return true;
    return can(moduleCode, 'view');
  };

  const handleDisabledModule = (name: string) => {
    Alert.alert(
      'Module non disponible',
      `Vous avez une licence ${licenseTier}. Le module "${name}" n'est pas inclus dans votre licence actuelle. Contactez votre administrateur.`
    );
  };

  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('access_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('shop');
            await AsyncStorage.removeItem('permissions');
            navigation.getParent()?.reset({
              index: 0,
              routes: [{ name: 'LoginPin' }],
            });
          } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
          }
        },
      },
    ]);
  };

  const navigateToScreen = (screenName: string) => {
    // Utiliser getParent() pour accéder au Stack Navigator parent
    navigation.getParent()?.navigate(screenName);
  };

  // Bug 8a: Séparer modules actifs et non disponibles (par section).
  // Un module licencié mais sans permission 'view' est simplement masqué.
  const sections = MENU_SECTIONS.map(section => ({
    title: section.title,
    enabled: section.items.filter(
      item => isModuleEnabled(item.module) && hasViewPermission(item.module)
    ),
  })).filter(section => section.enabled.length > 0);

  const disabledItems = MENU_SECTIONS.flatMap(section => section.items).filter(
    item => !isModuleEnabled(item.module)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Plus" subtitle="Tous les modules" />

      <ScrollView contentContainerStyle={styles.content}>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.enabled.map((item, index) => (
                <ModuleRow
                  key={item.screen}
                  item={item}
                  isLast={index === section.enabled.length - 1}
                  badge={item.showRelanceBadge ? relanceCount : undefined}
                  onPress={() => navigateToScreen(item.screen)}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Modules non disponibles */}
        {disabledItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modules non disponibles</Text>
            <View style={styles.card}>
              {disabledItems.map((item, index) => (
                <ModuleRow
                  key={item.screen}
                  item={item}
                  isLast={index === disabledItems.length - 1}
                  disabled
                  onPress={() => handleDisabledModule(item.title)}
                />
              ))}
            </View>
          </View>
        )}

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutCard, pressed && styles.rowPressed]}
        >
          <View style={[styles.iconSquare, { backgroundColor: `${Colors.danger.main}1A` }]}>
            <LogOut size={20} color={Colors.danger.main} />
          </View>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  section: {
    marginBottom: Spacing.xl,
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 60,
    gap: Spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.primary[50],
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  rowTitleDisabled: {
    color: Colors.textColors.disabled,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: Colors.danger.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.danger.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 60,
    ...Shadows.sm,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger.main,
  },
});
