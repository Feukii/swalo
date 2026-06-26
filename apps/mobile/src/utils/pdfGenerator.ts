/**
 * PDF Generator utility for invoice generation on mobile
 * Uses expo-print for PDF rendering and expo-sharing for sharing
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { generateInvoiceHTML, type InvoiceData } from './invoiceTemplate';
export type { InvoiceData } from './invoiceTemplate';

/**
 * Generate a PDF file from invoice data
 * @returns The URI of the generated PDF file, or null if generation failed
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<string | null> {
  try {
    const html = generateInvoiceHTML(data);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });
    return uri;
  } catch (error: unknown) {
    console.error('Erreur generation PDF:', error);
    Alert.alert('Erreur', 'Impossible de generer le PDF de la facture');
    return null;
  }
}

/**
 * Print an invoice directly (opens system print dialog)
 */
export async function printInvoice(data: InvoiceData): Promise<void> {
  try {
    const html = generateInvoiceHTML(data);
    await Print.printAsync({ html });
  } catch (error: unknown) {
    console.error('Erreur impression:', error);
    Alert.alert('Erreur', "Impossible d'imprimer la facture");
  }
}

/**
 * Share an invoice PDF via the system share sheet
 */
export async function shareInvoicePDF(data: InvoiceData): Promise<void> {
  try {
    const uri = await generateInvoicePDF(data);
    if (!uri) return;

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'Partage non disponible',
        "Le partage de fichiers n'est pas disponible sur cet appareil"
      );
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Facture ${data.number}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error: unknown) {
    console.error('Erreur partage PDF:', error);
    Alert.alert('Erreur', 'Impossible de partager la facture');
  }
}

/**
 * Show action sheet to print or share an invoice
 */
export function showInvoiceActions(data: InvoiceData): void {
  Alert.alert('Facture ' + data.number, 'Que souhaitez-vous faire ?', [
    {
      text: 'Imprimer',
      onPress: () => printInvoice(data),
    },
    {
      text: 'Partager (PDF)',
      onPress: () => shareInvoicePDF(data),
    },
    {
      text: 'Annuler',
      style: 'cancel',
    },
  ]);
}
