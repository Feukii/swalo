import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfGeneratorService, InvoicePdfData } from './pdf-generator.service';
import { SearchInvoiceDto } from './dto/create-invoice.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService
  ) {}

  /**
   * Generate the next sequential invoice number for a shop
   * Format: {SHOP_CODE}-{YYYY}-{SEQ:4} (e.g., BTQ01-2026-0001)
   */
  private async generateInvoiceNumber(
    tx: Prisma.TransactionClient,
    shopId: string
  ): Promise<string> {
    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { code: true },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    const year = new Date().getFullYear();
    const prefix = `${shop.code}-${String(year)}-`;

    // Find the highest existing invoice number for this shop and year
    const lastInvoice = await tx.invoice.findFirst({
      where: {
        shop_id: shopId,
        number: { startsWith: prefix },
      },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    let seq = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.number.split('-').pop() ?? '0', 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create an invoice from an existing sale
   */
  async createFromSale(shopId: string, saleId: string, notes?: string) {
    // Fetch the sale with items
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        items: {
          where: { deleted: false },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                tax_rate: true,
              },
            },
          },
        },
        cashier: { select: { display_name: true } },
        shop: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Vente ${saleId} non trouvee`);
    }

    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException('Impossible de facturer une vente non completee');
    }

    // Create invoice in a transaction for atomic number generation
    return this.prisma.$transaction(async tx => {
      const invoiceNumber = await this.generateInvoiceNumber(tx, shopId);

      // Build invoice items from sale items
      const invoiceItems = sale.items.map(item => {
        const description = `${item.product.name} (${item.product.sku})`;
        const taxRate = item.tax_rate || 0;
        const itemSubtotal = Math.round(item.unit_price * item.qty);
        const itemDiscount = item.discount || 0;
        const netAmount = itemSubtotal - itemDiscount;
        const itemTaxTotal = Math.round(netAmount * taxRate);
        const itemTotal = netAmount + itemTaxTotal;

        return {
          id: uuidv4(),
          product_id: item.product_id,
          description,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: itemDiscount,
          tax_rate: taxRate,
          subtotal: itemSubtotal,
          tax_total: itemTaxTotal,
          total: itemTotal,
        };
      });

      const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discount = sale.discount || 0;
      const taxTotal = invoiceItems.reduce((sum, item) => sum + item.tax_total, 0);
      const grandTotal = subtotal - discount + taxTotal;
      const paidTotal = sale.paid_total || 0;
      const balanceDue = grandTotal - paidTotal;

      // Generate PDF data
      const pdfData: InvoicePdfData = {
        invoice_number: invoiceNumber,
        issue_date: new Date(),
        shop_name: sale.shop.name,
        shop_address: sale.shop.address ?? undefined,
        shop_phone: sale.shop.phone ?? undefined,
        shop_email: sale.shop.email ?? undefined,
        customer_name: sale.customer?.name,
        customer_phone: sale.customer?.phone ?? undefined,
        customer_email: sale.customer?.email ?? undefined,
        customer_address: sale.customer?.address ?? undefined,
        cashier_name: sale.cashier.display_name,
        items: invoiceItems.map(item => ({
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_rate: item.tax_rate,
          subtotal: item.subtotal,
          tax_total: item.tax_total,
          total: item.total,
        })),
        subtotal,
        discount,
        tax_total: taxTotal,
        grand_total: grandTotal,
        paid_total: paidTotal,
        balance_due: balanceDue < 0 ? 0 : balanceDue,
      };

      const pdfBase64 = await this.pdfGenerator.generateInvoicePdfBase64(pdfData);

      const invoice = await tx.invoice.create({
        data: {
          id: uuidv4(),
          shop_id: shopId,
          sale_id: saleId,
          customer_id: sale.customer_id ?? null,
          number: invoiceNumber,
          status: paidTotal >= grandTotal ? 'PAID' : 'ISSUED',
          issue_date: new Date(),
          subtotal,
          discount,
          tax_total: taxTotal,
          grand_total: grandTotal,
          paid_total: paidTotal,
          balance_due: balanceDue < 0 ? 0 : balanceDue,
          notes: notes ?? null,
          pdf_data: pdfBase64,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: {
            where: { deleted: false },
          },
          customer: {
            select: {
              id: true,
              name: true,
              first_name: true,
              phone: true,
              email: true,
              address: true,
            },
          },
          shop: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              currency: true,
              tax_rate: true,
            },
          },
        },
      });

      return invoice;
    });
  }

  /**
   * Re-generer le PDF d'une facture existante
   */
  async regeneratePdf(shopId: string, invoiceId: string) {
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
      throw new NotFoundException(`Facture ${invoiceId} non trouvee`);
    }

    const pdfData: InvoicePdfData = {
      invoice_number: invoice.number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date ?? undefined,
      shop_name: invoice.shop.name,
      shop_address: invoice.shop.address ?? undefined,
      shop_phone: invoice.shop.phone ?? undefined,
      shop_email: invoice.shop.email ?? undefined,
      customer_name: invoice.customer?.name,
      customer_phone: invoice.customer?.phone ?? undefined,
      customer_email: invoice.customer?.email ?? undefined,
      customer_address: invoice.customer?.address ?? undefined,
      cashier_name: invoice.sale?.cashier.display_name,
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
      throw new NotFoundException(`Facture ${invoiceId} non trouvee`);
    }

    if (!invoice.pdf_data) {
      // Regenerer le PDF si absent
      const regenerated = await this.regeneratePdf(shopId, invoiceId);
      return { pdf_data: regenerated.pdf_data, number: regenerated.number };
    }

    return { pdf_data: invoice.pdf_data, number: invoice.number };
  }

  /**
   * List all invoices for a shop with filters
   */
  async findAll(shopId: string, query: SearchInvoiceDto) {
    const where: Prisma.InvoiceWhereInput = {
      shop_id: shopId,
      deleted: false,
    };

    if (query.customer_id) {
      where.customer_id = query.customer_id;
    }

    if (query.status) {
      where.status = query.status as InvoiceStatus;
    }

    if (query.start_date || query.end_date) {
      const issueDate: Prisma.DateTimeFilter = {};
      if (query.start_date) {
        issueDate.gte = new Date(query.start_date);
      }
      if (query.end_date) {
        issueDate.lte = new Date(query.end_date);
      }
      where.issue_date = issueDate;
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
          },
        },
        items: {
          where: { deleted: false },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get a single invoice by ID with full details
   */
  async findOne(shopId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        items: {
          where: { deleted: false },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        sale: {
          select: {
            id: true,
            status: true,
            payment_method: true,
            created_at: true,
          },
        },
        shop: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            currency: true,
            tax_rate: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture ${id} non trouvee`);
    }

    return invoice;
  }

  /**
   * Cancel an invoice
   */
  async cancel(shopId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture ${id} non trouvee`);
    }

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cette facture est deja annulee');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        version: { increment: 1 },
      },
      include: {
        items: { where: { deleted: false } },
        customer: {
          select: { id: true, name: true, first_name: true },
        },
      },
    });
  }
}
