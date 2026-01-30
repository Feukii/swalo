import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfGeneratorService, InvoicePdfData } from './pdf-generator.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService
  ) {}

  /**
   * Generer un numero de facture unique pour une boutique
   * Format: {SHOP_CODE}-{ANNEE}-{NUMERO_SEQUENTIEL}
   */
  private async generateInvoiceNumber(shopId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { code: true },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvée');
    }

    const year = new Date().getFullYear();
    const prefix = `${shop.code}-${year}`;

    // Trouver le dernier numero de facture de cette annee
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        shop_id: shopId,
        number: { startsWith: prefix },
      },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    let nextNum = 1;
    if (lastInvoice) {
      const parts = lastInvoice.number.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Creer une facture a partir d'une vente et generer le PDF
   */
  async createFromSale(shopId: string, saleId: string): Promise<any> {
    // Verifier si une facture existe deja pour cette vente
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        shop_id: shopId,
        sale_id: saleId,
        deleted: false,
      },
    });

    if (existingInvoice) {
      // Si le PDF n'existe pas encore, le generer
      if (!existingInvoice.pdf_data) {
        return this.regeneratePdf(shopId, existingInvoice.id);
      }
      return existingInvoice;
    }

    // Recuperer la vente avec ses items et relations
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        items: {
          where: { deleted: false },
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
        customer: true,
        cashier: { select: { display_name: true } },
        shop: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Vente non trouvée');
    }

    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException('La facture ne peut être générée que pour une vente terminée');
    }

    const invoiceNumber = await this.generateInvoiceNumber(shopId);

    // Preparer les donnees pour le PDF
    const pdfData: InvoicePdfData = {
      invoice_number: invoiceNumber,
      issue_date: new Date(),
      shop_name: sale.shop.name,
      shop_address: sale.shop.address || undefined,
      shop_phone: sale.shop.phone || undefined,
      shop_email: sale.shop.email || undefined,
      customer_name: sale.customer?.name,
      customer_phone: sale.customer?.phone || undefined,
      customer_email: sale.customer?.email || undefined,
      customer_address: sale.customer?.address || undefined,
      cashier_name: sale.cashier?.display_name,
      items: sale.items.map(item => ({
        description: item.product_name || item.product?.name || 'Produit',
        qty: item.qty,
        unit_price: item.unit_price,
        discount: item.discount,
        tax_rate: item.tax_rate,
        subtotal: item.subtotal,
        tax_total: item.tax_total,
        total: item.total,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax_total: sale.tax_total,
      grand_total: sale.grand_total,
      paid_total: sale.paid_total,
      balance_due: Math.max(0, sale.grand_total - sale.paid_total),
    };

    // Generer le PDF en base64
    const pdfBase64 = await this.pdfGenerator.generateInvoicePdfBase64(pdfData);

    // Creer la facture en base
    const invoice = await this.prisma.invoice.create({
      data: {
        shop_id: shopId,
        sale_id: saleId,
        customer_id: sale.customer_id || null,
        number: invoiceNumber,
        status: 'ISSUED',
        issue_date: new Date(),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax_total: sale.tax_total,
        grand_total: sale.grand_total,
        paid_total: sale.paid_total,
        balance_due: Math.max(0, sale.grand_total - sale.paid_total),
        pdf_data: pdfBase64,
        items: {
          create: sale.items.map(item => ({
            product_id: item.product_id,
            description: item.product_name || item.product?.name || 'Produit',
            qty: item.qty,
            unit_price: item.unit_price,
            discount: item.discount,
            tax_rate: item.tax_rate,
            subtotal: item.subtotal,
            tax_total: item.tax_total,
            total: item.total,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    return invoice;
  }

  /**
   * Re-generer le PDF d'une facture existante
   */
  async regeneratePdf(shopId: string, invoiceId: string): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        items: { where: { deleted: false } },
        customer: true,
        shop: true,
        sale: {
          include: {
            cashier: { select: { display_name: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }

    const pdfData: InvoicePdfData = {
      invoice_number: invoice.number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date || undefined,
      shop_name: invoice.shop.name,
      shop_address: invoice.shop.address || undefined,
      shop_phone: invoice.shop.phone || undefined,
      shop_email: invoice.shop.email || undefined,
      customer_name: invoice.customer?.name,
      customer_phone: invoice.customer?.phone || undefined,
      customer_email: invoice.customer?.email || undefined,
      customer_address: invoice.customer?.address || undefined,
      cashier_name: invoice.sale?.cashier?.display_name,
      items: invoice.items.map(item => ({
        description: item.description,
        qty: item.qty,
        unit_price: item.unit_price,
        discount: item.discount,
        tax_rate: item.tax_rate,
        subtotal: item.subtotal,
        tax_total: item.tax_total,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax_total: invoice.tax_total,
      grand_total: invoice.grand_total,
      paid_total: invoice.paid_total,
      balance_due: invoice.balance_due,
    };

    const pdfBase64 = await this.pdfGenerator.generateInvoicePdfBase64(pdfData);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdf_data: pdfBase64 },
    });

    return {
      ...invoice,
      pdf_data: pdfBase64,
    };
  }

  /**
   * Recuperer le PDF d'une facture (base64)
   */
  async getPdf(shopId: string, invoiceId: string): Promise<{ pdf_data: string; number: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        shop_id: shopId,
        deleted: false,
      },
      select: {
        id: true,
        number: true,
        pdf_data: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }

    if (!invoice.pdf_data) {
      // Regenerer le PDF si absent
      const regenerated = await this.regeneratePdf(shopId, invoiceId);
      return { pdf_data: regenerated.pdf_data, number: regenerated.number };
    }

    return { pdf_data: invoice.pdf_data, number: invoice.number };
  }

  /**
   * Lister les factures d'une boutique
   */
  async findAll(
    shopId: string,
    query: { customer_id?: string; start_date?: string; end_date?: string }
  ): Promise<any[]> {
    const where: any = {
      shop_id: shopId,
      deleted: false,
    };

    if (query.customer_id) {
      where.customer_id = query.customer_id;
    }

    if (query.start_date || query.end_date) {
      where.issue_date = {};
      if (query.start_date) {
        where.issue_date.gte = new Date(query.start_date);
      }
      if (query.end_date) {
        where.issue_date.lte = new Date(query.end_date);
      }
    }

    return this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        issue_date: true,
        grand_total: true,
        paid_total: true,
        balance_due: true,
        customer: {
          select: { id: true, name: true, phone: true },
        },
        sale_id: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Recuperer une facture par ID
   */
  async findOne(shopId: string, invoiceId: string): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        items: { where: { deleted: false } },
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }

    return invoice;
  }
}
