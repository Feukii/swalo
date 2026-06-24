import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMoney } from '../utils/money';
import { Colors, Spacing } from '../constants/theme-v2';
import { ScreenHeader } from '../components/ui';
import DateRangePicker from '../components/ui/DateRangePicker';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useSyncFreshness, FreshnessLevel } from '../hooks/useOfflineReports';
import {
  cashEntryRepo,
  clientReceivableRepo,
  clientReceivablePaymentRepo,
  supplierDebtRepo,
  supplierDebtPaymentRepo,
  customerRepo,
  supplierRepo,
} from '../db/repositories';

interface BusinessReportsScreenNavigation {
  goBack: () => void;
}

interface BusinessReportsScreenProps {
  navigation: BusinessReportsScreenNavigation;
}

interface SalesStats {
  totalEntries: number;
  totalExits: number;
  net: number;
  balance: number;
  entriesCount: number;
  exitsCount: number;
  // Ventes par mode
  totalSales: number;
  salesCash: number;
  salesCredit: number;
  // Achats par mode
  totalPurchases: number;
  purchasesCash: number;
  purchasesCredit: number;
  entriesByCategory: Array<{ category: string; amount: number; count: number }>;
  exitsByCategory: Array<{ category: string; amount: number; count: number }>;
}

interface CustomerStats {
  // Solde actuel (toutes périodes confondues)
  totalBalance: number; // Solde net (positif - négatif)
  totalPositiveBalance: number; // Créances clients (ils nous doivent)
  totalNegativeBalance: number; // Remboursements dus (nous leur devons)
  customersWithDebt: number; // Clients qui nous doivent
  customersToRefund: number; // Clients à qui nous devons
  // Transactions de la période
  receivablesCreated: number; // Créances créées pendant la période
  paymentsReceived: number; // Paiements reçus pendant la période
  periodNet: number; // Net de la période (créances - paiements)
  receivablesCount: number;
  paymentsCount: number;
  top3Debtors: Array<{ name: string; amount: number }>;
  top3ToRefund: Array<{ name: string; amount: number }>; // Clients à rembourser
}

interface SupplierStats {
  // Solde actuel (toutes périodes confondues)
  totalBalance: number; // Solde net (positif - négatif)
  totalPositiveBalance: number; // Dettes fournisseurs (on leur doit)
  totalNegativeBalance: number; // Remboursements dus par fournisseurs (ils nous doivent)
  suppliersWithDebt: number; // Fournisseurs à qui on doit
  suppliersToRefund: number; // Fournisseurs qui nous doivent
  // Transactions de la période
  debtsCreated: number; // Dettes créées pendant la période
  paymentsMade: number; // Paiements effectués pendant la période
  periodNet: number; // Net de la période (dettes - paiements)
  debtsCount: number;
  paymentsCount: number;
  top3Creditors: Array<{ name: string; amount: number }>;
  top3ToRefund: Array<{ name: string; amount: number }>; // Fournisseurs qui nous doivent
}

type Period = 'today' | 'week' | 'month' | 'year';

const freshnessColors: Record<FreshnessLevel, string> = {
  fresh: Colors.success.main,
  stale: Colors.warning.main,
  old: Colors.danger.main,
  unknown: Colors.muted.foreground,
};

export default function BusinessReportsScreen({ navigation }: BusinessReportsScreenProps) {
  const { shopId, user } = useCurrentUser();
  const userRole = user?.role || 'EMPLOYEE';
  const freshness = useSyncFreshness();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');

  // Date range filter
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [datesWithData, setDatesWithData] = useState<string[]>([]);

  // Accordion states
  const [entriesExpanded, setEntriesExpanded] = useState(true);
  const [exitsExpanded, setExitsExpanded] = useState(true);
  const [customersExpanded, setCustomersExpanded] = useState(true);
  const [suppliersExpanded, setSuppliersExpanded] = useState(true);

  // Stats par section
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [supplierStats, setSupplierStats] = useState<SupplierStats | null>(null);

  const getPeriodDates = useCallback((): {
    start: Date;
    end: Date;
    start_date: string;
    end_date: string;
  } => {
    // Si des dates personnalisées sont sélectionnées, les utiliser
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      };
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999); // Fin de journée

    const start = new Date();

    switch (selectedPeriod) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return {
      start,
      end,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
  }, [startDate, endDate, selectedPeriod]);

  // Fonction utilitaire pour vérifier si une date est dans la plage
  const isInPeriod = useCallback((dateStr: string, start: Date, end: Date): boolean => {
    const date = new Date(dateStr);
    return date >= start && date <= end;
  }, []);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today':
        return "Aujourd'hui";
      case 'week':
        return 'Cette semaine';
      case 'month':
        return 'Ce mois';
      case 'year':
        return 'Cette année';
      default:
        return '';
    }
  };

  const getCategoryLabel = (category: string): string => {
    const labels: { [key: string]: string } = {
      ventes: 'Ventes',
      remboursement_client: 'Remb. client',
      divers: 'Divers',
      achats_marchandises: 'Achats marchandises',
      loyers: 'Loyers',
      reglement_fournisseur: 'Règl. fournisseur',
      depenses_courantes: 'Dépenses courantes',
    };
    return labels[category] || category;
  };

  const loadSalesStats = useCallback(async () => {
    if (!shopId) return;
    try {
      const periodDates = getPeriodDates();

      // Récupérer toutes les entrées de caisse depuis le repo local
      const allCashEntries = await cashEntryRepo.getAll(shopId);

      // Filtrer par période pour les stats de la période
      const periodEntries = allCashEntries.filter(entry =>
        isInPeriod(entry.created_at, periodDates.start, periodDates.end)
      );

      // Calculer les répartitions par catégorie à partir des données brutes
      let totalEntries = 0;
      let totalExits = 0;
      let entriesCount = 0;
      let exitsCount = 0;
      const entriesByCategory: { [key: string]: { amount: number; count: number } } = {};
      const exitsByCategory: { [key: string]: { amount: number; count: number } } = {};

      periodEntries.forEach(entry => {
        if (entry.type === 'IN') {
          totalEntries += entry.amount;
          entriesCount += 1;
          const cat = entry.category || 'divers';
          if (!entriesByCategory[cat]) {
            entriesByCategory[cat] = { amount: 0, count: 0 };
          }
          entriesByCategory[cat].amount += entry.amount;
          entriesByCategory[cat].count += 1;
        } else if (entry.type === 'OUT') {
          totalExits += entry.amount;
          exitsCount += 1;
          const cat = entry.category || 'divers';
          if (!exitsByCategory[cat]) {
            exitsByCategory[cat] = { amount: 0, count: 0 };
          }
          exitsByCategory[cat].amount += entry.amount;
          exitsByCategory[cat].count += 1;
        }
      });

      const entriesByCategoryArray = Object.entries(entriesByCategory)
        .map(([category, data]) => ({ category, amount: data.amount, count: data.count }))
        .sort((a, b) => b.amount - a.amount);

      const exitsByCategoryArray = Object.entries(exitsByCategory)
        .map(([category, data]) => ({ category, amount: data.amount, count: data.count }))
        .sort((a, b) => b.amount - a.amount);

      // Net = entrées - sorties
      const net = totalEntries - totalExits;

      // Calculer le solde de caisse global (toutes entrées - toutes sorties, toutes périodes)
      let globalTotalIn = 0;
      let globalTotalOut = 0;
      allCashEntries.forEach(entry => {
        if (entry.type === 'IN') globalTotalIn += entry.amount;
        else if (entry.type === 'OUT') globalTotalOut += entry.amount;
      });
      const balance = globalTotalIn - globalTotalOut;

      // Ventes cash = somme des entrées avec catégorie 'ventes' ou 'vente'
      const salesCash = periodEntries
        .filter(e => e.type === 'IN' && (e.category === 'ventes' || e.category === 'vente'))
        .reduce((sum, e) => sum + e.amount, 0);

      // Ventes crédit = somme des créances créées pendant la période
      const allReceivables = await clientReceivableRepo.getAll(shopId);
      const salesCredit = allReceivables
        .filter(
          r =>
            r.amount > 0 &&
            r.created_at &&
            isInPeriod(r.created_at, periodDates.start, periodDates.end)
        )
        .reduce((sum, r) => sum + r.amount, 0);

      // Achats cash = somme des sorties avec catégorie 'achats_marchandises'
      const purchasesCash = periodEntries
        .filter(e => e.type === 'OUT' && e.category === 'achats_marchandises')
        .reduce((sum, e) => sum + e.amount, 0);

      // Achats crédit = somme des dettes créées pendant la période
      const allDebts = await supplierDebtRepo.getAll(shopId);
      const purchasesCredit = allDebts
        .filter(
          d =>
            d.amount > 0 &&
            d.created_at &&
            isInPeriod(d.created_at, periodDates.start, periodDates.end)
        )
        .reduce((sum, d) => sum + d.amount, 0);

      const totalSales = salesCash + salesCredit;
      const totalPurchases = purchasesCash + purchasesCredit;

      setSalesStats({
        totalEntries,
        totalExits,
        net,
        balance,
        entriesCount,
        exitsCount,
        totalSales,
        salesCash,
        salesCredit,
        totalPurchases,
        purchasesCash,
        purchasesCredit,
        entriesByCategory: entriesByCategoryArray,
        exitsByCategory: exitsByCategoryArray,
      });

      // Extraire les dates uniques avec données pour le calendrier
      const uniqueDates = new Set<string>();
      allCashEntries.forEach(entry => {
        const date = new Date(entry.created_at);
        const dateKey = date.toISOString().split('T')[0];
        uniqueDates.add(dateKey);
      });
      setDatesWithData(Array.from(uniqueDates));
    } catch (error) {
      console.error('Erreur chargement stats ventes:', error);
      setSalesStats({
        totalEntries: 0,
        totalExits: 0,
        net: 0,
        balance: 0,
        entriesCount: 0,
        exitsCount: 0,
        totalSales: 0,
        salesCash: 0,
        salesCredit: 0,
        totalPurchases: 0,
        purchasesCash: 0,
        purchasesCredit: 0,
        entriesByCategory: [],
        exitsByCategory: [],
      });
    }
  }, [shopId, getPeriodDates, isInPeriod]);

  const loadCustomerStats = useCallback(async () => {
    if (!shopId) return;
    try {
      const periodDates = getPeriodDates();

      // Récupérer les créances et les entrées de caisse depuis les repos locaux
      const [receivablesData, allCashEntries, allCustomers] = await Promise.all([
        clientReceivableRepo.getAll(shopId),
        cashEntryRepo.getAll(shopId),
        customerRepo.getAll(shopId),
      ]);

      // Construire un lookup map pour les noms de clients
      const customerMap = new Map<string, string>();
      allCustomers.forEach(c => {
        const name = c.first_name ? `${c.first_name} ${c.name}` : c.name;
        customerMap.set(c.id, name);
      });

      // Filtrer les entrées de caisse par période
      const cashEntriesData = allCashEntries.filter(entry =>
        isInPeriod(entry.created_at, periodDates.start, periodDates.end)
      );

      let totalBalance = 0;
      let totalPositiveBalance = 0; // Créances (clients nous doivent)
      let totalNegativeBalance = 0; // Remboursements (nous devons aux clients)
      const customersWithDebtSet = new Set<string>();
      const customersToRefundSet = new Set<string>();
      let receivablesCreated = 0;
      let paymentsReceived = 0;
      let receivablesCount = 0;
      let paymentsCount = 0;
      const debtorsList: Array<{ name: string; amount: number; customerId: string }> = [];
      const refundList: Array<{ name: string; amount: number; customerId: string }> = [];
      const customerBalances: { [customerId: string]: { name: string; balance: number } } = {};

      // Traiter les créances (ventes à crédit et ajustements)
      for (const receivable of receivablesData) {
        if (!receivable) continue;

        const balance = receivable.balance || 0;
        const customerName = customerMap.get(receivable.customer_id) || 'Client inconnu';

        // Calculer le solde actuel - inclure toutes les créances non annulées
        // Les créances PAID avec balance négatif sont des remboursements dus
        if (receivable.status !== 'CANCELLED') {
          // Pour les créances PENDING/PARTIAL avec balance > 0 (client nous doit)
          if ((receivable.status === 'PENDING' || receivable.status === 'PARTIAL') && balance > 0) {
            totalBalance += balance;
            totalPositiveBalance += balance;

            if (receivable.customer_id) {
              customersWithDebtSet.add(receivable.customer_id);

              if (!customerBalances[receivable.customer_id]) {
                customerBalances[receivable.customer_id] = { name: customerName, balance: 0 };
              }
              customerBalances[receivable.customer_id].balance += balance;
            }
          }

          // Pour les créances avec balance négatif (nous devons au client - remboursement)
          // Cela inclut les créances PAID avec montant négatif (ajustements)
          if (balance < 0) {
            totalBalance += balance;
            totalNegativeBalance += Math.abs(balance);

            if (receivable.customer_id) {
              customersToRefundSet.add(receivable.customer_id);

              if (!customerBalances[receivable.customer_id]) {
                customerBalances[receivable.customer_id] = { name: customerName, balance: 0 };
              }
              customerBalances[receivable.customer_id].balance += balance;
            }
          }
        }

        // Créances créées pendant la période (seulement montants positifs = ventes à crédit)
        if (
          receivable.created_at &&
          receivable.amount > 0 &&
          isInPeriod(receivable.created_at, periodDates.start, periodDates.end)
        ) {
          receivablesCreated += receivable.amount || 0;
          receivablesCount++;
        }

        // Paiements reçus pendant la période (sur les créances)
        const payments = await clientReceivablePaymentRepo.getByReceivable(receivable.id);
        payments.forEach(payment => {
          const paymentDate = payment.payment_date || payment.created_at;
          if (paymentDate && isInPeriod(paymentDate, periodDates.start, periodDates.end)) {
            paymentsReceived += payment.amount || 0;
            paymentsCount++;
          }
        });
      }

      // Ajouter les remboursements clients des entrées de caisse (catégorie remboursement_client)
      cashEntriesData.forEach(entry => {
        if (entry.type === 'IN' && entry.category === 'remboursement_client') {
          paymentsReceived += entry.amount || 0;
          paymentsCount++;
        }
      });

      // Construire les listes des débiteurs et des clients à rembourser
      Object.entries(customerBalances).forEach(([customerId, data]) => {
        if (data.balance > 0) {
          debtorsList.push({ name: data.name, amount: data.balance, customerId });
        } else if (data.balance < 0) {
          refundList.push({ name: data.name, amount: Math.abs(data.balance), customerId });
        }
      });

      // Net de la période = créances créées - paiements reçus
      const periodNet = receivablesCreated - paymentsReceived;

      // Top 3 débiteurs (clients qui nous doivent le plus)
      const top3Debtors = debtorsList
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map(d => ({ name: d.name, amount: d.amount }));

      // Top 3 clients à rembourser (nous leur devons le plus)
      const top3ToRefund = refundList
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map(d => ({ name: d.name, amount: d.amount }));

      setCustomerStats({
        totalBalance,
        totalPositiveBalance,
        totalNegativeBalance,
        customersWithDebt: customersWithDebtSet.size,
        customersToRefund: customersToRefundSet.size,
        receivablesCreated,
        paymentsReceived,
        periodNet,
        receivablesCount,
        paymentsCount,
        top3Debtors,
        top3ToRefund,
      });
    } catch (error) {
      console.error('Erreur chargement stats clients:', error);
      setCustomerStats({
        totalBalance: 0,
        totalPositiveBalance: 0,
        totalNegativeBalance: 0,
        customersWithDebt: 0,
        customersToRefund: 0,
        receivablesCreated: 0,
        paymentsReceived: 0,
        periodNet: 0,
        receivablesCount: 0,
        paymentsCount: 0,
        top3Debtors: [],
        top3ToRefund: [],
      });
    }
  }, [shopId, getPeriodDates, isInPeriod]);

  const loadSupplierStats = useCallback(async () => {
    if (!shopId) return;
    try {
      const periodDates = getPeriodDates();

      // Récupérer les dettes et les entrées de caisse depuis les repos locaux
      const [debtsData, allCashEntries, allSuppliers] = await Promise.all([
        supplierDebtRepo.getAll(shopId),
        cashEntryRepo.getAll(shopId),
        supplierRepo.getAll(shopId),
      ]);

      // Construire un lookup map pour les noms de fournisseurs
      const supplierMap = new Map<string, string>();
      allSuppliers.forEach(s => {
        const name = s.first_name ? `${s.first_name} ${s.name}` : s.name;
        supplierMap.set(s.id, name);
      });

      // Filtrer les entrées de caisse par période
      const cashEntriesData = allCashEntries.filter(entry =>
        isInPeriod(entry.created_at, periodDates.start, periodDates.end)
      );

      let totalBalance = 0;
      let totalPositiveBalance = 0; // Dettes (on leur doit)
      let totalNegativeBalance = 0; // Remboursements (ils nous doivent)
      const suppliersWithDebtSet = new Set<string>();
      const suppliersToRefundSet = new Set<string>();
      let debtsCreated = 0;
      let paymentsMade = 0;
      let debtsCount = 0;
      let paymentsCount = 0;
      const supplierBalances: { [supplierId: string]: { name: string; balance: number } } = {};

      // Traiter les dettes (achats à crédit et ajustements)
      for (const debt of debtsData) {
        if (!debt) continue;

        const balance = debt.balance || 0;
        const supplierName = supplierMap.get(debt.supplier_id) || 'Fournisseur inconnu';

        // Calculer le solde actuel - inclure toutes les dettes non annulées
        // Les dettes PAID avec balance négatif sont des remboursements dus par le fournisseur
        if (debt.status !== 'CANCELLED') {
          // Pour les dettes PENDING/PARTIAL avec balance > 0 (on leur doit)
          if ((debt.status === 'PENDING' || debt.status === 'PARTIAL') && balance > 0) {
            totalBalance += balance;
            totalPositiveBalance += balance;

            if (debt.supplier_id) {
              suppliersWithDebtSet.add(debt.supplier_id);

              if (!supplierBalances[debt.supplier_id]) {
                supplierBalances[debt.supplier_id] = { name: supplierName, balance: 0 };
              }
              supplierBalances[debt.supplier_id].balance += balance;
            }
          }

          // Pour les dettes avec balance négatif (fournisseur nous doit - remboursement)
          // Cela inclut les dettes PAID avec montant négatif (ajustements)
          if (balance < 0) {
            totalBalance += balance;
            totalNegativeBalance += Math.abs(balance);

            if (debt.supplier_id) {
              suppliersToRefundSet.add(debt.supplier_id);

              if (!supplierBalances[debt.supplier_id]) {
                supplierBalances[debt.supplier_id] = { name: supplierName, balance: 0 };
              }
              supplierBalances[debt.supplier_id].balance += balance;
            }
          }
        }

        // Dettes créées pendant la période (seulement montants positifs = achats à crédit)
        if (
          debt.created_at &&
          debt.amount > 0 &&
          isInPeriod(debt.created_at, periodDates.start, periodDates.end)
        ) {
          debtsCreated += debt.amount || 0;
          debtsCount++;
        }

        // Paiements effectués pendant la période (sur les dettes)
        const payments = await supplierDebtPaymentRepo.getByDebt(debt.id);
        payments.forEach(payment => {
          const paymentDate = payment.payment_date || payment.created_at;
          if (paymentDate && isInPeriod(paymentDate, periodDates.start, periodDates.end)) {
            paymentsMade += payment.amount || 0;
            paymentsCount++;
          }
        });
      }

      // Ajouter les règlements fournisseurs des sorties de caisse (catégorie reglement_fournisseur)
      cashEntriesData.forEach(entry => {
        if (entry.type === 'OUT' && entry.category === 'reglement_fournisseur') {
          paymentsMade += entry.amount || 0;
          paymentsCount++;
        }
      });

      // Construire les listes des créditeurs et des fournisseurs qui nous doivent
      const creditorsList: Array<{ name: string; amount: number }> = [];
      const refundList: Array<{ name: string; amount: number }> = [];
      Object.entries(supplierBalances).forEach(([, data]) => {
        if (data.balance > 0) {
          creditorsList.push({ name: data.name, amount: data.balance });
        } else if (data.balance < 0) {
          refundList.push({ name: data.name, amount: Math.abs(data.balance) });
        }
      });

      // Net de la période = dettes créées - paiements effectués
      const periodNet = debtsCreated - paymentsMade;

      // Trier par montant décroissant et prendre les 3 premiers
      const top3Creditors = creditorsList.sort((a, b) => b.amount - a.amount).slice(0, 3);
      const top3ToRefund = refundList.sort((a, b) => b.amount - a.amount).slice(0, 3);

      setSupplierStats({
        totalBalance,
        totalPositiveBalance,
        totalNegativeBalance,
        suppliersWithDebt: suppliersWithDebtSet.size,
        suppliersToRefund: suppliersToRefundSet.size,
        debtsCreated,
        paymentsMade,
        periodNet,
        debtsCount,
        paymentsCount,
        top3Creditors,
        top3ToRefund,
      });
    } catch (error) {
      console.error('Erreur chargement stats fournisseurs:', error);
      setSupplierStats({
        totalBalance: 0,
        totalPositiveBalance: 0,
        totalNegativeBalance: 0,
        suppliersWithDebt: 0,
        suppliersToRefund: 0,
        debtsCreated: 0,
        paymentsMade: 0,
        periodNet: 0,
        debtsCount: 0,
        paymentsCount: 0,
        top3Creditors: [],
        top3ToRefund: [],
      });
    }
  }, [shopId, getPeriodDates, isInPeriod]);

  const loadAllStats = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      await Promise.all([loadSalesStats(), loadCustomerStats(), loadSupplierStats()]);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, loadSalesStats, loadCustomerStats, loadSupplierStats]);

  useEffect(() => {
    if (userRole !== 'EMPLOYEE' && shopId) {
      loadAllStats();
    }
  }, [userRole, shopId, loadAllStats]);

  if (userRole === 'EMPLOYEE') {
    return null;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Bilans & Rapports" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Bilans & Rapports" showBack onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sync Freshness Badge */}
        <View style={styles.freshnessBadge}>
          <View
            style={[styles.freshnessDot, { backgroundColor: freshnessColors[freshness.level] }]}
          />
          <Text style={styles.freshnessText}>{freshness.label}</Text>
        </View>

        {/* Date Range Picker */}
        <View style={styles.datePickerContainer}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              if (start || end) {
                setSelectedPeriod('today');
              }
            }}
            datesWithData={datesWithData}
          />
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['today', 'week', 'month', 'year'] as Period[]).map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && !startDate && !endDate && styles.periodButtonActive,
              ]}
              onPress={() => {
                setSelectedPeriod(period);
                setStartDate(null);
                setEndDate(null);
              }}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period &&
                    !startDate &&
                    !endDate &&
                    styles.periodButtonTextActive,
                ]}
              >
                {period === 'today'
                  ? 'Jour'
                  : period === 'week'
                    ? 'Semaine'
                    : period === 'month'
                      ? 'Mois'
                      : 'Année'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SECTION 1: ENTRÉES */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setEntriesExpanded(!entriesExpanded)}
          >
            <Text style={styles.sectionTitle}>Entrées</Text>
            <Text style={styles.accordionIcon}>{entriesExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionSubtitle}>
            Entrées de caisse et ventes - {getPeriodLabel()}
          </Text>

          {entriesExpanded && salesStats && (
            <>
              {/* Entrées totales */}
              <View style={[styles.kpiBox, styles.kpiBoxSuccess]}>
                <Text style={styles.kpiLabel}>Entrées Totales</Text>
                <Text style={styles.kpiValue}>{formatMoney(salesStats.totalEntries)}</Text>
                <Text style={styles.kpiSubtext}>{salesStats.entriesCount} opération(s)</Text>
              </View>

              {/* Ventes totales */}
              <View style={styles.salesSummaryBox}>
                <Text style={styles.salesSummaryLabel}>Ventes Totales</Text>
                <Text style={styles.salesSummaryValue}>{formatMoney(salesStats.totalSales)}</Text>
              </View>

              {/* Répartition des ventes par mode */}
              <View style={styles.modeBreakdownRow}>
                <View style={styles.modeBreakdownItem}>
                  <Text style={styles.modeBreakdownLabel}>Cash</Text>
                  <Text style={[styles.modeBreakdownValue, { color: Colors.success.main }]}>
                    {formatMoney(salesStats.salesCash)}
                  </Text>
                </View>
                <View style={styles.modeBreakdownItem}>
                  <Text style={styles.modeBreakdownLabel}>Crédit</Text>
                  <Text style={[styles.modeBreakdownValue, { color: Colors.warning.main }]}>
                    {formatMoney(salesStats.salesCredit)}
                  </Text>
                </View>
              </View>

              {/* Répartition des Entrées par catégorie */}
              {salesStats.entriesByCategory.length > 0 && (
                <View style={styles.distributionSection}>
                  <Text style={styles.distributionTitle}>Répartition par Catégorie</Text>
                  {salesStats.entriesByCategory.map((item, index) => {
                    const percentage =
                      salesStats.totalEntries > 0
                        ? (item.amount / salesStats.totalEntries) * 100
                        : 0;
                    return (
                      <View key={index} style={styles.distributionItem}>
                        <View style={styles.distributionRow}>
                          <Text style={styles.distributionCategory}>
                            {getCategoryLabel(item.category)}
                          </Text>
                          <Text style={styles.distributionPercentage}>
                            {percentage.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.distributionBarTrack}>
                          <View
                            style={[
                              styles.distributionBarFill,
                              styles.distributionBarGreen,
                              { width: `${percentage}%` },
                            ]}
                          />
                        </View>
                        <View style={styles.distributionDetails}>
                          <Text style={styles.distributionAmount}>{formatMoney(item.amount)}</Text>
                          <Text style={styles.distributionCount}>{item.count} op.</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* SECTION 2: SORTIES */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setExitsExpanded(!exitsExpanded)}
          >
            <Text style={styles.sectionTitle}>Sorties</Text>
            <Text style={styles.accordionIcon}>{exitsExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionSubtitle}>
            Sorties de caisse et achats - {getPeriodLabel()}
          </Text>

          {exitsExpanded && salesStats && (
            <>
              {/* Sorties totales */}
              <View style={[styles.kpiBox, styles.kpiBoxDanger]}>
                <Text style={styles.kpiLabel}>Sorties Totales</Text>
                <Text style={styles.kpiValue}>{formatMoney(salesStats.totalExits)}</Text>
                <Text style={styles.kpiSubtext}>{salesStats.exitsCount} opération(s)</Text>
              </View>

              {/* Achats totaux */}
              <View style={styles.salesSummaryBox}>
                <Text style={styles.salesSummaryLabel}>Achats Totaux</Text>
                <Text style={styles.salesSummaryValue}>
                  {formatMoney(salesStats.totalPurchases)}
                </Text>
              </View>

              {/* Répartition des achats par mode */}
              <View style={styles.modeBreakdownRow}>
                <View style={styles.modeBreakdownItem}>
                  <Text style={styles.modeBreakdownLabel}>Cash</Text>
                  <Text style={[styles.modeBreakdownValue, { color: Colors.danger.main }]}>
                    {formatMoney(salesStats.purchasesCash)}
                  </Text>
                </View>
                <View style={styles.modeBreakdownItem}>
                  <Text style={styles.modeBreakdownLabel}>Crédit</Text>
                  <Text style={[styles.modeBreakdownValue, { color: Colors.warning.main }]}>
                    {formatMoney(salesStats.purchasesCredit)}
                  </Text>
                </View>
              </View>

              {/* Répartition des Sorties par catégorie */}
              {salesStats.exitsByCategory.length > 0 && (
                <View style={styles.distributionSection}>
                  <Text style={styles.distributionTitle}>Répartition par Catégorie</Text>
                  {salesStats.exitsByCategory.map((item, index) => {
                    const percentage =
                      salesStats.totalExits > 0 ? (item.amount / salesStats.totalExits) * 100 : 0;
                    return (
                      <View key={index} style={styles.distributionItem}>
                        <View style={styles.distributionRow}>
                          <Text style={styles.distributionCategory}>
                            {getCategoryLabel(item.category)}
                          </Text>
                          <Text style={styles.distributionPercentage}>
                            {percentage.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.distributionBarTrack}>
                          <View
                            style={[
                              styles.distributionBarFill,
                              styles.distributionBarRed,
                              { width: `${percentage}%` },
                            ]}
                          />
                        </View>
                        <View style={styles.distributionDetails}>
                          <Text style={styles.distributionAmount}>{formatMoney(item.amount)}</Text>
                          <Text style={styles.distributionCount}>{item.count} op.</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* SECTION 3: CLIENTS */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setCustomersExpanded(!customersExpanded)}
          >
            <Text style={styles.sectionTitle}>Clients</Text>
            <Text style={styles.accordionIcon}>{customersExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionSubtitle}>Créances clients - {getPeriodLabel()}</Text>

          {customersExpanded && customerStats && (
            <>
              {/* Soldes clients (créances et remboursements séparés) */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.statBoxGreen]}>
                  <Text style={styles.statLabel}>Clients nous doivent</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(customerStats.totalPositiveBalance)}
                  </Text>
                  <Text style={styles.statCount}>
                    {customerStats.customersWithDebt} client
                    {customerStats.customersWithDebt > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={[styles.statBox, styles.statBoxRed]}>
                  <Text style={styles.statLabel}>Remboursements dus</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(customerStats.totalNegativeBalance)}
                  </Text>
                  <Text style={styles.statCount}>
                    {customerStats.customersToRefund} client
                    {customerStats.customersToRefund > 1 ? 's' : ''} à rembourser
                  </Text>
                </View>
              </View>

              {/* Alerte si remboursements dus */}
              {customerStats.totalNegativeBalance > 0 && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertText}>
                    ⚠️ Vous devez rembourser {formatMoney(customerStats.totalNegativeBalance)} à vos
                    clients
                  </Text>
                </View>
              )}

              {/* Créances / Paiements de la période */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.statBoxOrange]}>
                  <Text style={styles.statLabel}>Créances créées</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(customerStats.receivablesCreated)}
                  </Text>
                  <Text style={styles.statCount}>{customerStats.receivablesCount} créance(s)</Text>
                </View>

                <View style={[styles.statBox, styles.statBoxGreen]}>
                  <Text style={styles.statLabel}>Paiements reçus</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(customerStats.paymentsReceived)}
                  </Text>
                  <Text style={styles.statCount}>{customerStats.paymentsCount} paiement(s)</Text>
                </View>
              </View>

              {/* Top 3 clients débiteurs */}
              {customerStats.top3Debtors.length > 0 && (
                <View style={styles.topSection}>
                  <Text style={styles.topTitle}>Top 3 - Clients débiteurs</Text>
                  {customerStats.top3Debtors.map((debtor, index) => (
                    <View key={index} style={styles.topItem}>
                      <View style={styles.topRank}>
                        <Text style={styles.topRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.topName}>{debtor.name}</Text>
                      <Text style={styles.topAmount}>{formatMoney(debtor.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Top 3 clients à rembourser */}
              {customerStats.top3ToRefund.length > 0 && (
                <View style={[styles.topSection, { borderTopColor: Colors.danger.main }]}>
                  <Text style={[styles.topTitle, { color: Colors.danger.main }]}>
                    Clients à rembourser
                  </Text>
                  {customerStats.top3ToRefund.map((client, index) => (
                    <View key={index} style={styles.topItem}>
                      <View style={[styles.topRank, { backgroundColor: Colors.danger.background }]}>
                        <Text style={[styles.topRankText, { color: Colors.danger.main }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.topName}>{client.name}</Text>
                      <Text style={[styles.topAmount, { color: Colors.danger.main }]}>
                        -{formatMoney(client.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {customerStats.receivablesCount === 0 &&
                customerStats.paymentsCount === 0 &&
                customerStats.top3Debtors.length === 0 &&
                customerStats.top3ToRefund.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aucune activité client sur cette période</Text>
                  </View>
                )}
            </>
          )}
        </View>

        {/* SECTION 4: FOURNISSEURS */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setSuppliersExpanded(!suppliersExpanded)}
          >
            <Text style={styles.sectionTitle}>Fournisseurs</Text>
            <Text style={styles.accordionIcon}>{suppliersExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionSubtitle}>Dettes fournisseurs - {getPeriodLabel()}</Text>

          {suppliersExpanded && supplierStats && (
            <>
              {/* Soldes fournisseurs (dettes et remboursements séparés) */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.statBoxOrange]}>
                  <Text style={styles.statLabel}>Nous leur devons</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(supplierStats.totalPositiveBalance)}
                  </Text>
                  <Text style={styles.statCount}>
                    {supplierStats.suppliersWithDebt} fournisseur
                    {supplierStats.suppliersWithDebt > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={[styles.statBox, styles.statBoxGreen]}>
                  <Text style={styles.statLabel}>Ils nous doivent</Text>
                  <Text style={styles.statValue}>
                    {formatMoney(supplierStats.totalNegativeBalance)}
                  </Text>
                  <Text style={styles.statCount}>
                    {supplierStats.suppliersToRefund} fournisseur
                    {supplierStats.suppliersToRefund > 1 ? 's' : ''} à récupérer
                  </Text>
                </View>
              </View>

              {/* Alerte si fournisseurs nous doivent */}
              {supplierStats.totalNegativeBalance > 0 && (
                <View style={[styles.alertBox, { backgroundColor: Colors.success.background }]}>
                  <Text style={[styles.alertText, { color: Colors.success.main }]}>
                    💰 Vos fournisseurs vous doivent{' '}
                    {formatMoney(supplierStats.totalNegativeBalance)}
                  </Text>
                </View>
              )}

              {/* Dettes / Paiements de la période */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.statBoxOrange]}>
                  <Text style={styles.statLabel}>Dettes créées</Text>
                  <Text style={styles.statValue}>{formatMoney(supplierStats.debtsCreated)}</Text>
                  <Text style={styles.statCount}>{supplierStats.debtsCount} dette(s)</Text>
                </View>

                <View style={[styles.statBox, styles.statBoxGreen]}>
                  <Text style={styles.statLabel}>Paiements effectués</Text>
                  <Text style={styles.statValue}>{formatMoney(supplierStats.paymentsMade)}</Text>
                  <Text style={styles.statCount}>{supplierStats.paymentsCount} paiement(s)</Text>
                </View>
              </View>

              {/* Top 3 fournisseurs à payer */}
              {supplierStats.top3Creditors.length > 0 && (
                <View style={styles.topSection}>
                  <Text style={styles.topTitle}>Top 3 - Plus grandes dettes</Text>
                  {supplierStats.top3Creditors.map((creditor, index) => (
                    <View key={index} style={styles.topItem}>
                      <View style={styles.topRank}>
                        <Text style={styles.topRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.topName}>{creditor.name}</Text>
                      <Text style={styles.topAmount}>{formatMoney(creditor.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Top 3 fournisseurs qui nous doivent */}
              {supplierStats.top3ToRefund.length > 0 && (
                <View style={[styles.topSection, { borderTopColor: Colors.success.main }]}>
                  <Text style={[styles.topTitle, { color: Colors.success.main }]}>
                    Fournisseurs qui nous doivent
                  </Text>
                  {supplierStats.top3ToRefund.map((supplier, index) => (
                    <View key={index} style={styles.topItem}>
                      <View
                        style={[styles.topRank, { backgroundColor: Colors.success.background }]}
                      >
                        <Text style={[styles.topRankText, { color: Colors.success.main }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.topName}>{supplier.name}</Text>
                      <Text style={[styles.topAmount, { color: Colors.success.main }]}>
                        +{formatMoney(supplier.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {supplierStats.debtsCount === 0 &&
                supplierStats.paymentsCount === 0 &&
                supplierStats.top3Creditors.length === 0 &&
                supplierStats.top3ToRefund.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      Aucune activité fournisseur sur cette période
                    </Text>
                  </View>
                )}
            </>
          )}
        </View>

        {/* Résumé Global */}
        {salesStats && customerStats && supplierStats && (
          <View style={[styles.sectionCard, styles.summaryCard]}>
            <Text style={styles.sectionTitle}>Résumé Global</Text>
            <Text style={styles.sectionSubtitle}>{getPeriodLabel()}</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Ventes</Text>
              <Text style={[styles.summaryValue, styles.summaryValueGreen]}>
                {formatMoney(salesStats.totalSales)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Sorties</Text>
              <Text style={[styles.summaryValue, styles.summaryValueRed]}>
                {formatMoney(salesStats.totalExits)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Créances Clients</Text>
              <Text style={[styles.summaryValue, styles.summaryValueGreen]}>
                {formatMoney(customerStats.totalBalance)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Dettes Fournisseurs</Text>
              <Text style={[styles.summaryValue, styles.summaryValueRed]}>
                {formatMoney(supplierStats.totalBalance)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Solde de Caisse</Text>
              <Text style={styles.summaryValueBold}>{formatMoney(salesStats.balance)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Trésorerie Prévisionnelle</Text>
              <Text
                style={[
                  styles.summaryValueBold,
                  salesStats.balance + customerStats.totalBalance - supplierStats.totalBalance >= 0
                    ? styles.summaryValueGreen
                    : styles.summaryValueRed,
                ]}
              >
                {formatMoney(
                  salesStats.balance + customerStats.totalBalance - supplierStats.totalBalance
                )}
              </Text>
            </View>
            <Text style={styles.summaryHint}>
              = Caisse + Créances clients - Dettes fournisseurs
            </Text>
          </View>
        )}
      </ScrollView>
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
    padding: Spacing['2xl'],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  freshnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  freshnessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessText: {
    fontSize: 11,
    color: Colors.muted.foreground,
  },
  datePickerContainer: {
    marginBottom: Spacing.md,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  periodButtonTextActive: {
    color: Colors.primary.foreground,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing['2xl'],
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  accordionIcon: {
    fontSize: 18,
    color: Colors.primary[900],
    marginLeft: Spacing.md,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  kpiBox: {
    padding: Spacing.lg,
    borderRadius: 14,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  kpiBoxPrimary: {
    backgroundColor: Colors.primary[900],
  },
  kpiBoxSuccess: {
    backgroundColor: Colors.success.main,
  },
  kpiBoxDanger: {
    backgroundColor: Colors.danger.main,
  },
  kpiLabel: {
    fontSize: 14,
    color: Colors.primary.foreground,
    marginBottom: Spacing.sm,
    opacity: 0.9,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary.foreground,
    marginBottom: Spacing.xs,
  },
  kpiSubtext: {
    fontSize: 12,
    color: Colors.primary.foreground,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  statBoxGreen: {
    backgroundColor: '#dcfce7',
  },
  statBoxRed: {
    backgroundColor: '#fee2e2',
  },
  statBoxOrange: {
    backgroundColor: '#fef3c7',
  },
  salesSummaryBox: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  salesSummaryLabel: {
    fontSize: 14,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  salesSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  modeBreakdownRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  modeBreakdownItem: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeBreakdownLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  modeBreakdownValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: Spacing.sm,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  statCount: {
    fontSize: 11,
    color: Colors.muted.foreground,
  },
  netBox: {
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  netBoxPositive: {
    backgroundColor: '#dcfce7',
  },
  netBoxNegative: {
    backgroundColor: '#fee2e2',
  },
  netLabel: {
    fontSize: 14,
    color: Colors.muted.foreground,
    marginBottom: Spacing.sm,
  },
  netValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  netValuePositive: {
    color: Colors.success.main,
  },
  netValueNegative: {
    color: Colors.danger.main,
  },
  netHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  topSection: {
    marginTop: Spacing.md,
  },
  topTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  topRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary.foreground,
  },
  topName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  topAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  summaryCard: {
    borderWidth: 2,
    borderColor: Colors.primary[900],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryValueBold: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryValueGreen: {
    color: Colors.success.main,
  },
  summaryValueRed: {
    color: Colors.danger.main,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  summaryHint: {
    fontSize: 11,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  distributionSection: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  distributionItem: {
    marginBottom: Spacing.lg,
  },
  distributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  distributionCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  distributionPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  distributionBarTrack: {
    height: 20,
    backgroundColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  distributionBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  distributionBarGreen: {
    backgroundColor: Colors.success.main,
  },
  distributionBarRed: {
    backgroundColor: Colors.danger.main,
  },
  distributionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  distributionCount: {
    fontSize: 11,
    color: Colors.muted.foreground,
  },
  alertBox: {
    backgroundColor: Colors.danger.background,
    borderWidth: 1,
    borderColor: Colors.danger.main,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger.main,
    textAlign: 'center',
  },
});
