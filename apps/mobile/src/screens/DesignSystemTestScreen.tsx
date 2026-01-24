import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, KPICard, ListItem, ProductCard, StatusBadge } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney, formatMoneyWithSign } from '../utils/money';

export default function DesignSystemTestScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Test Design System" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section: Colors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Couleurs Primaires</Text>
          <View style={styles.colorRow}>
            <View style={[styles.colorBox, { backgroundColor: Colors.primary[900] }]}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Primary 900</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: Colors.success.main }]}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Success</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: Colors.warning.main }]}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Warning</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: Colors.danger.main }]}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Danger</Text>
            </View>
          </View>
        </View>

        {/* Section: Status Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Badges</Text>
          <View style={styles.badgeRow}>
            <StatusBadge text="Complété" variant="success" />
            <StatusBadge text="En attente" variant="warning" />
            <StatusBadge text="Annulé" variant="danger" />
            <StatusBadge text="Neutre" variant="default" />
          </View>
        </View>

        {/* Section: KPI Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KPI Cards</Text>
          <View style={styles.kpiGrid}>
            <View style={{ width: '48%' }}>
              <KPICard
                label="Ventes totales"
                value={formatMoney(354200)}
                change={{ value: '+12.5%', isPositive: true }}
              />
            </View>
            <View style={{ width: '48%' }}>
              <KPICard
                label="Articles en stock"
                value="324"
                change={{ value: '-2.1%', isPositive: false }}
              />
            </View>
            <View style={{ width: '48%' }}>
              <KPICard label="Solde caisse" value={formatMoney(1250000)} />
            </View>
            <View style={{ width: '48%' }}>
              <KPICard label="Transactions" value="48" />
            </View>
          </View>
        </View>

        {/* Section: List Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>List Items</Text>
          <View style={styles.card}>
            <ListItem
              title="Vente #1847"
              subtitle="14:45 - Espèces"
              amount={formatMoneyWithSign(43500)}
              amountColor="success"
              badge={{ text: 'Complété', variant: 'success' }}
              onClick={() => console.log('Clicked')}
            />
            <ListItem
              title="Client - Jean Dupont"
              subtitle="3 achats ce mois"
              onClick={() => console.log('Clicked')}
            />
            <ListItem
              title="Sortie caisse"
              subtitle="13:55 - Paiement fournisseur"
              amount={formatMoneyWithSign(-500000)}
              amountColor="danger"
              badge={{ text: 'Payé', variant: 'default' }}
            />
          </View>
        </View>

        {/* Section: Product Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Cards</Text>
          <View style={styles.productGrid}>
            <View style={{ width: '48%' }}>
              <ProductCard
                name="Savon Palmolive"
                price={2500}
                stock={45}
                formatMoney={formatMoney}
                onClick={() => console.log('Product clicked')}
              />
            </View>
            <View style={{ width: '48%' }}>
              <ProductCard
                name="Eau Orion 1.5L"
                price={500}
                stock={0}
                formatMoney={formatMoney}
                disabled={true}
              />
            </View>
            <View style={{ width: '48%' }}>
              <ProductCard
                name="Riz Thaï 25kg"
                price={18500}
                stock={8}
                formatMoney={formatMoney}
                onClick={() => console.log('Product clicked')}
              />
            </View>
          </View>
        </View>

        {/* Section: Typography */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Typographie</Text>
          <View style={styles.card}>
            <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: Colors.text }}>
                Display - 32px Bold
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.text }}>
                H1 - 24px Bold
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '600', color: Colors.text }}>
                H2 - 20px SemiBold
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.text }}>
                H3 - 18px SemiBold
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '400', color: Colors.text }}>
                Body - 16px Regular
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '400', color: Colors.muted.foreground }}>
                Caption - 13px Regular
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: Colors.muted.foreground }}>
                Micro - 11px Medium
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Money Formatting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formatage Monétaire</Text>
          <View style={styles.card}>
            <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>Positif:</Text>
                <Text
                  style={{
                    fontWeight: '600',
                    color: Colors.success.main,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatMoneyWithSign(125000)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>Négatif:</Text>
                <Text
                  style={{
                    fontWeight: '600',
                    color: Colors.danger.main,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatMoneyWithSign(-125000)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>Montant large:</Text>
                <Text
                  style={{ fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(2500000)}
                </Text>
              </View>
            </View>
          </View>
        </View>
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
    marginBottom: Spacing['3xl'],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorBox: {
    width: 70,
    height: 70,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
});
