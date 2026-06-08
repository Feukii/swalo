/**
 * Invoice HTML template for PDF generation
 * CEMAC/Central Africa compliant format
 * Uses inline CSS for PDF rendering compatibility (expo-print uses WebView)
 */

interface InvoiceShop {
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface InvoiceCustomer {
  name: string;
  first_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface InvoiceItem {
  description: string;
  qty: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  subtotal: number;
  tax_total: number;
  total: number;
}

export interface InvoiceData {
  number: string;
  issue_date: string;
  due_date?: string | null;
  status: string;
  shop: InvoiceShop;
  customer?: InvoiceCustomer | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax_total: number;
  grand_total: number;
  paid_total: number;
  balance_due: number;
  notes?: string | null;
}

function formatAmount(amount: number): string {
  return Math.abs(amount)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const customerName = data.customer
    ? data.customer.first_name
      ? `${data.customer.first_name} ${data.customer.name}`
      : data.customer.name
    : 'Client comptant';

  const itemsRows = data.items
    .map(
      (item, index) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">${index + 1}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAmount(item.unit_price)} F</td>
      ${item.discount > 0 ? `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">-${formatAmount(item.discount)} F</td>` : `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">-</td>`}
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatAmount(item.total)} F</td>
    </tr>`
    )
    .join('');

  const hasTax = data.tax_total > 0;
  const hasDiscount = data.discount > 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; font-size: 13px; line-height: 1.5; padding: 24px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px;">
    <div>
      <h1 style="font-size: 24px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px;">${data.shop.name}</h1>
      <p style="font-size: 12px; color: #6b7280;">Code: ${data.shop.code}</p>
      ${data.shop.address ? `<p style="font-size: 12px; color: #6b7280;">${data.shop.address}</p>` : ''}
      ${data.shop.phone ? `<p style="font-size: 12px; color: #6b7280;">Tel: ${data.shop.phone}</p>` : ''}
      ${data.shop.email ? `<p style="font-size: 12px; color: #6b7280;">${data.shop.email}</p>` : ''}
    </div>
    <div style="text-align: right;">
      <h2 style="font-size: 22px; font-weight: 700; color: #1e3a5f; text-transform: uppercase;">FACTURE</h2>
      <p style="font-size: 16px; font-weight: 600; color: #374151; margin-top: 4px;">${data.number}</p>
    </div>
  </div>

  <!-- Invoice Info + Customer -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; width: 48%;">
      <p style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 8px;">INFORMATIONS FACTURE</p>
      <p><strong>Date:</strong> ${formatDate(data.issue_date)}</p>
      ${data.due_date ? `<p><strong>Echeance:</strong> ${formatDate(data.due_date)}</p>` : ''}
      <p><strong>Statut:</strong> ${data.status === 'PAID' ? 'Payee' : data.status === 'ISSUED' ? 'Emise' : data.status === 'CANCELLED' ? 'Annulee' : 'Brouillon'}</p>
    </div>
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; width: 48%;">
      <p style="font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 8px;">CLIENT</p>
      <p style="font-weight: 600;">${customerName}</p>
      ${data.customer?.phone ? `<p>Tel: ${data.customer.phone}</p>` : ''}
      ${data.customer?.email ? `<p>${data.customer.email}</p>` : ''}
      ${data.customer?.address ? `<p>${data.customer.address}</p>` : ''}
    </div>
  </div>

  <!-- Items Table -->
  <table style="margin-bottom: 24px;">
    <thead>
      <tr style="background-color: #1e3a5f; color: white;">
        <th style="padding: 10px 12px; text-align: center; width: 40px; font-size: 12px;">#</th>
        <th style="padding: 10px 12px; text-align: left; font-size: 12px;">Description</th>
        <th style="padding: 10px 12px; text-align: center; width: 60px; font-size: 12px;">Qte</th>
        <th style="padding: 10px 12px; text-align: right; width: 100px; font-size: 12px;">P.U.</th>
        <th style="padding: 10px 12px; text-align: right; width: 80px; font-size: 12px;">Remise</th>
        <th style="padding: 10px 12px; text-align: right; width: 110px; font-size: 12px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
    <div style="width: 280px;">
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #6b7280;">Sous-total</span>
        <span style="font-weight: 500;">${formatAmount(data.subtotal)} F</span>
      </div>
      ${
        hasDiscount
          ? `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #6b7280;">Remise</span>
        <span style="font-weight: 500; color: #dc2626;">-${formatAmount(data.discount)} F</span>
      </div>`
          : ''
      }
      ${
        hasTax
          ? `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #6b7280;">Taxes</span>
        <span style="font-weight: 500;">${formatAmount(data.tax_total)} F</span>
      </div>`
          : ''
      }
      <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #1e3a5f; margin-top: 4px;">
        <span style="font-size: 16px; font-weight: 700; color: #1e3a5f;">TOTAL</span>
        <span style="font-size: 16px; font-weight: 700; color: #1e3a5f;">${formatAmount(data.grand_total)} FCFA</span>
      </div>
      ${
        data.paid_total > 0 && data.balance_due > 0
          ? `<div style="display: flex; justify-content: space-between; padding: 6px 0;">
        <span style="color: #6b7280;">Paye</span>
        <span style="font-weight: 500;">${formatAmount(data.paid_total)} F</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 6px 0; background-color: #fef2f2; border-radius: 4px; padding: 8px;">
        <span style="color: #dc2626; font-weight: 600;">Reste a payer</span>
        <span style="color: #dc2626; font-weight: 700;">${formatAmount(data.balance_due)} F</span>
      </div>`
          : ''
      }
    </div>
  </div>

  ${data.notes ? `<div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 24px;"><p style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: 600; margin-bottom: 4px;">NOTES</p><p style="color: #78350f; font-size: 12px;">${data.notes}</p></div>` : ''}

  <!-- Footer / Legal -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 32px; text-align: center;">
    <p style="font-size: 11px; color: #9ca3af;">Merci pour votre confiance !</p>
    <p style="font-size: 10px; color: #d1d5db; margin-top: 8px;">
      Facture generee par SWALO - Systeme de gestion commerciale
    </p>
    <p style="font-size: 10px; color: #d1d5db;">
      ${data.shop.name} - ${data.shop.code}${data.shop.phone ? ` - Tel: ${data.shop.phone}` : ''}
    </p>
  </div>
</body>
</html>`;
}
