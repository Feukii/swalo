import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, Shadows } from '../../constants/theme-v2';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/date';

interface TransactionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: {
    type: string;
    date: string;
    amount: number;
    note?: string;
    status?: string;
    paymentMethod?: string;
    isCredit?: boolean;
    category?: string;
    items?: Array<{ productName: string; quantity: number }>;
    customerName?: string;
    supplierName?: string;
  } | null;
}

export function TransactionDetailModal({
  visible,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  const getTypeLabel = (type: string, isCredit?: boolean, category?: string) => {
    // Si c'est un crédit, préciser le type
    if (isCredit) {
      if (type === 'entry' || category === 'ventes' || category === 'vente') {
        return 'Vente à crédit';
      }
      if (type === 'exit' || category === 'achats_marchandises') {
        return 'Achat à crédit';
      }
    }

    const labels: Record<string, string> = {
      receivable: 'Créance créée',
      payment: 'Paiement reçu',
      cash: 'Remboursement caisse',
      sale: 'Vente',
      debt: 'Dette créée',
      debt_payment: 'Paiement dette',
      entry: 'Entrée de caisse',
      exit: 'Sortie de caisse',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PAID: 'Payé',
      PARTIAL: 'Paiement partiel',
      PENDING: 'En attente',
    };
    return labels[status] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      mobile: 'Mobile Money',
      card: 'Carte bancaire',
      credit: 'À crédit',
    };
    return labels[method] || method;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {transaction
              ? getTypeLabel(transaction.type, transaction.isCredit, transaction.category)
              : 'Détail de transaction'}
          </Text>

          <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }}>
            {transaction && (
              <>
                {/* Amount */}
                <View style={styles.amountSection}>
                  <Text style={styles.amountLabel}>Montant</Text>
                  <Text
                    style={[
                      styles.amountValue,
                      { color: transaction.amount >= 0 ? Colors.success.main : Colors.danger.main },
                    ]}
                  >
                    {transaction.amount >= 0 ? '+' : ''}
                    {formatMoney(Math.abs(transaction.amount))}
                  </Text>
                </View>

                {/* Details */}
                <View style={styles.detailsSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{formatDate(transaction.date)}</Text>
                  </View>

                  {transaction.status && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Statut</Text>
                      <Text style={styles.detailValue}>{getStatusLabel(transaction.status)}</Text>
                    </View>
                  )}

                  {(transaction.paymentMethod || transaction.isCredit) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mode de paiement</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          transaction.isCredit && { color: Colors.warning.main },
                        ]}
                      >
                        {transaction.isCredit
                          ? 'À crédit'
                          : getPaymentMethodLabel(transaction.paymentMethod || '')}
                      </Text>
                    </View>
                  )}

                  {transaction.customerName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Client</Text>
                      <Text style={styles.detailValue}>{transaction.customerName}</Text>
                    </View>
                  )}

                  {transaction.supplierName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fournisseur</Text>
                      <Text style={styles.detailValue}>{transaction.supplierName}</Text>
                    </View>
                  )}

                  {transaction.note && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Note</Text>
                      <Text style={styles.detailValue}>{transaction.note}</Text>
                    </View>
                  )}
                </View>

                {/* Items */}
                {transaction.items && transaction.items.length > 0 && (
                  <View style={styles.itemsSection}>
                    <Text style={styles.sectionTitle}>Articles</Text>
                    {transaction.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing['2xl'],
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    backgroundColor: Colors.action,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  amountSection: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    marginBottom: Spacing.xs,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  detailsSection: {
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  itemsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  itemName: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
});
