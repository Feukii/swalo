import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../components/ui';
import { Package, Wallet, Edit, AlertTriangle, IconProps } from '../components/icons/SimpleIcons';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme-v2';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getSupervisionAlerts, SupervisionAlert } from '../db/reports';
import { adminApi } from '../lib/api';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formatLongDate(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

const KIND_ICON: Record<SupervisionAlert['kind'], (p: IconProps) => React.JSX.Element> = {
  stock_out_no_sale: Package,
  cash_correction: Wallet,
  manual_stock_edit: Edit,
  unusual_discount: AlertTriangle,
};

interface SupervisionScreenProps {
  navigation: { goBack: () => void };
}

export default function SupervisionScreen({ navigation }: SupervisionScreenProps) {
  const { shopId } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SupervisionAlert[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // Journal du jour
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const result = await getSupervisionAlerts(shopId, start.toISOString(), end.toISOString());
      setAlerts(result);

      // Résolution des auteurs (en ligne, dégradation silencieuse hors-ligne)
      try {
        const users = await adminApi.getShopUsers<{ user: { id: string; display_name: string } }>();
        const map: Record<string, string> = {};
        for (const u of users) {
          if (u.user?.id) map[u.user.id] = u.user.display_name;
        }
        setAuthors(map);
      } catch {
        // Pas de réseau : on affiche l'alerte sans le nom de l'auteur.
      }
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const reviewCount = alerts.filter(a => a.severity === 'review').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Supervision"
        subtitle="Actions anormales du jour"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Bannière */}
        <View style={styles.banner}>
          <AlertTriangle size={22} color="#FFFFFF" />
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={styles.bannerTitle}>Tableau de supervision</Text>
            <Text style={styles.bannerDate}>{formatLongDate(new Date())}</Text>
          </View>
        </View>

        {/* Compteurs */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.danger.main }]}>{criticalCount}</Text>
            <Text style={styles.statLabel}>Critiques</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.warning.main }]}>{reviewCount}</Text>
            <Text style={styles.statLabel}>À vérifier</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Colors.text }]}>{alerts.length}</Text>
            <Text style={styles.statLabel}>Total du jour</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>JOURNAL DES ALERTES</Text>

        {loading ? (
          <ActivityIndicator color={Colors.action} style={{ marginTop: Spacing['3xl'] }} />
        ) : alerts.length === 0 ? (
          <Text style={styles.emptyText}>Aucune action anormale détectée aujourd'hui.</Text>
        ) : (
          alerts.map(a => {
            const Icon = KIND_ICON[a.kind];
            const isCritical = a.severity === 'critical';
            const tint = isCritical ? Colors.danger.main : Colors.warning.main;
            const author = a.authorId ? authors[a.authorId] : null;
            return (
              <View key={a.id} style={styles.alertCard}>
                <View style={[styles.alertIcon, { backgroundColor: `${tint}1A` }]}>
                  <Icon size={20} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertTitle} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          backgroundColor: isCritical
                            ? Colors.danger.background
                            : Colors.warning.background,
                        },
                      ]}
                    >
                      <Text style={[styles.severityText, { color: tint }]}>
                        {isCritical ? 'Critique' : 'À vérifier'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertDetail}>{a.detail}</Text>
                  <Text style={styles.alertMeta}>
                    {author ? `${author}  ·  ` : ''}
                    {formatTime(a.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A1414',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bannerDate: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12.5, color: Colors.textColors.tertiary, marginTop: 4 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.8,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },

  alertCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  alertTitle: { flex: 1, fontSize: 15.5, fontWeight: '700', color: Colors.text },
  severityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  severityText: { fontSize: 11.5, fontWeight: '700' },
  alertDetail: { fontSize: 14, color: Colors.textColors.secondary, marginTop: 4 },
  alertMeta: { fontSize: 12.5, color: Colors.textColors.tertiary, marginTop: 6 },

  emptyText: {
    textAlign: 'center',
    color: Colors.textColors.tertiary,
    marginTop: Spacing['3xl'],
    fontSize: 14,
  },
});
