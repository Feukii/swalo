import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * Donnees necessaires pour generer une facture PDF
 */
export interface InvoicePdfData {
  invoice_number: string;
  issue_date: Date;
  due_date?: Date;

  // Boutique
  shop_name: string;
  shop_address?: string;
  shop_phone?: string;
  shop_email?: string;

  // Client
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;

  // Lignes
  items: {
    description: string;
    qty: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    subtotal: number;
    tax_total: number;
    total: number;
  }[];

  // Totaux
  subtotal: number;
  discount: number;
  tax_total: number;
  grand_total: number;
  paid_total: number;
  balance_due: number;

  // Caissier
  cashier_name?: string;
}

@Injectable()
export class PdfGeneratorService {
  private pdfmake: any;

  constructor() {
    // pdfmake 0.3.3 exports a singleton for server-side usage
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.pdfmake = require('pdfmake');

    // Resolve font paths from pdfmake package
    // In webpack mode, require.resolve may point to dist/ instead of node_modules
    let fontsDir = '';
    try {
      const pdfmakePath = path.dirname(require.resolve('pdfmake/package.json'));
      fontsDir = path.join(pdfmakePath, 'fonts', 'Roboto');
    } catch {
      fontsDir = '';
    }

    // Fallback: walk up from cwd to find node_modules/pdfmake/fonts/Roboto
    if (!fontsDir || !existsSync(fontsDir)) {
      const candidates = [
        path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto'),
        path.join(__dirname, '..', '..', '..', 'node_modules', 'pdfmake', 'fonts', 'Roboto'),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          fontsDir = candidate;
          break;
        }
      }
    }

    this.pdfmake.setFonts({
      Roboto: {
        normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
        bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
        italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
      },
    });
  }

  /**
   * Formater un montant en FCFA
   * Ex: 12500 -> "12 500 FCFA"
   */
  formatFCFA(amount: number): string {
    const formatted = new Intl.NumberFormat('fr-FR').format(amount);
    return `${formatted} FCFA`;
  }

  /**
   * Formater une date en format francais
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Generer le PDF d'une facture et retourner le buffer
   */
  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    const docDefinition = this.buildDocDefinition(data);
    const pdfDoc = this.pdfmake.createPdf(docDefinition);
    return pdfDoc.getBuffer();
  }

  /**
   * Generer le PDF et retourner en base64
   */
  async generateInvoicePdfBase64(data: InvoicePdfData): Promise<string> {
    const docDefinition = this.buildDocDefinition(data);
    const pdfDoc = this.pdfmake.createPdf(docDefinition);
    return pdfDoc.getBase64();
  }

  private buildDocDefinition(data: InvoicePdfData): any {
    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],

      content: [
        this.buildShopHeader(data),
        {
          text: `FACTURE N° ${data.invoice_number}`,
          style: 'invoiceTitle',
          margin: [0, 20, 0, 10],
        },
        this.buildInfoSection(data),
        this.buildItemsTable(data),
        this.buildTotals(data),
        this.buildFooter(data),
      ],

      styles: {
        invoiceTitle: {
          fontSize: 16,
          bold: true,
          alignment: 'center',
        },
        shopName: {
          fontSize: 14,
          bold: true,
        },
        shopInfo: {
          fontSize: 9,
          color: '#555555',
        },
        sectionTitle: {
          fontSize: 10,
          bold: true,
          margin: [0, 5, 0, 3],
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          fillColor: '#333333',
          color: '#FFFFFF',
        },
        tableCell: {
          fontSize: 9,
        },
        totalLabel: {
          fontSize: 10,
          bold: true,
          alignment: 'right',
        },
        totalValue: {
          fontSize: 10,
          alignment: 'right',
        },
        grandTotal: {
          fontSize: 12,
          bold: true,
          alignment: 'right',
        },
      },

      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
    };
  }

  private buildShopHeader(data: InvoicePdfData): any {
    const shopInfoLines: string[] = [];
    if (data.shop_address) shopInfoLines.push(data.shop_address);
    if (data.shop_phone) shopInfoLines.push(`Tél: ${data.shop_phone}`);
    if (data.shop_email) shopInfoLines.push(data.shop_email);

    return {
      columns: [
        {
          width: '*',
          stack: [
            { text: data.shop_name, style: 'shopName' },
            ...(shopInfoLines.length > 0
              ? [{ text: shopInfoLines.join(' | '), style: 'shopInfo' }]
              : []),
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              text: `Date: ${this.formatDate(data.issue_date)}`,
              alignment: 'right',
              fontSize: 9,
            },
            ...(data.due_date
              ? [
                  {
                    text: `Échéance: ${this.formatDate(data.due_date)}`,
                    alignment: 'right',
                    fontSize: 9,
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }

  private buildInfoSection(data: InvoicePdfData): any {
    const columns: any[] = [];

    if (data.customer_name) {
      const customerLines: string[] = [data.customer_name];
      if (data.customer_phone) customerLines.push(`Tél: ${data.customer_phone}`);
      if (data.customer_email) customerLines.push(data.customer_email);
      if (data.customer_address) customerLines.push(data.customer_address);

      columns.push({
        width: '*',
        stack: [
          { text: 'CLIENT', style: 'sectionTitle' },
          ...customerLines.map(line => ({ text: line, fontSize: 9 })),
        ],
        margin: [0, 10, 0, 15],
      });
    }

    if (data.cashier_name) {
      columns.push({
        width: 'auto',
        stack: [
          { text: 'CAISSIER', style: 'sectionTitle' },
          { text: data.cashier_name, fontSize: 9 },
        ],
        margin: [0, 10, 0, 15],
      });
    }

    if (columns.length === 0) {
      return { text: '', margin: [0, 10, 0, 0] };
    }

    return { columns, margin: [0, 0, 0, 0] };
  }

  private buildItemsTable(data: InvoicePdfData): any {
    const tableBody: any[][] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'Description', style: 'tableHeader' },
        { text: 'Qté', style: 'tableHeader', alignment: 'center' },
        { text: 'Prix unit.', style: 'tableHeader', alignment: 'right' },
        { text: 'Remise', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    data.items.forEach((item, index) => {
      tableBody.push([
        { text: String(index + 1), style: 'tableCell', alignment: 'center' },
        { text: item.description, style: 'tableCell' },
        { text: String(item.qty), style: 'tableCell', alignment: 'center' },
        { text: this.formatFCFA(item.unit_price), style: 'tableCell', alignment: 'right' },
        {
          text: item.discount > 0 ? this.formatFCFA(item.discount) : '-',
          style: 'tableCell',
          alignment: 'right',
        },
        { text: this.formatFCFA(item.total), style: 'tableCell', alignment: 'right' },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        widths: [25, '*', 40, 80, 65, 80],
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number, node: any) => {
          if (i === 0 || i === 1 || i === node.table.body.length) return 1;
          return 0.5;
        },
        vLineWidth: () => 0,
        hLineColor: (i: number) => (i <= 1 ? '#333333' : '#CCCCCC'),
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 15],
    };
  }

  private buildTotals(data: InvoicePdfData): any {
    const totals: any[] = [];

    totals.push({
      columns: [
        { text: '', width: '*' },
        { text: 'Sous-total:', style: 'totalLabel', width: 100 },
        { text: this.formatFCFA(data.subtotal), style: 'totalValue', width: 110 },
      ],
    });

    if (data.discount > 0) {
      totals.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Remise:', style: 'totalLabel', width: 100 },
          { text: `-${this.formatFCFA(data.discount)}`, style: 'totalValue', width: 110 },
        ],
      });
    }

    if (data.tax_total > 0) {
      totals.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Taxes:', style: 'totalLabel', width: 100 },
          { text: this.formatFCFA(data.tax_total), style: 'totalValue', width: 110 },
        ],
      });
    }

    totals.push({
      canvas: [
        {
          type: 'line',
          x1: 300,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1,
          lineColor: '#333333',
        },
      ],
      margin: [0, 5, 0, 5],
    });

    totals.push({
      columns: [
        { text: '', width: '*' },
        { text: 'TOTAL TTC:', style: 'grandTotal', width: 100 },
        { text: this.formatFCFA(data.grand_total), style: 'grandTotal', width: 110 },
      ],
    });

    if (data.paid_total > 0) {
      totals.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Payé:', style: 'totalLabel', width: 100 },
          { text: this.formatFCFA(data.paid_total), style: 'totalValue', width: 110 },
        ],
        margin: [0, 3, 0, 0],
      });
    }

    if (data.balance_due > 0) {
      totals.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Reste à payer:', style: 'totalLabel', width: 100, color: '#CC0000' },
          {
            text: this.formatFCFA(data.balance_due),
            style: 'totalValue',
            width: 110,
            color: '#CC0000',
          },
        ],
        margin: [0, 3, 0, 0],
      });
    }

    return { stack: totals };
  }

  private buildFooter(_data: InvoicePdfData): any {
    return {
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#CCCCCC',
            },
          ],
          margin: [0, 20, 0, 10],
        },
        {
          text: 'Merci pour votre achat !',
          alignment: 'center',
          fontSize: 9,
          italics: true,
          color: '#666666',
        },
        {
          text: `Facture générée le ${this.formatDate(new Date())}`,
          alignment: 'center',
          fontSize: 8,
          color: '#999999',
          margin: [0, 5, 0, 0],
        },
      ],
    };
  }
}
