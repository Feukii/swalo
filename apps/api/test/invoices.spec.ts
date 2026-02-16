import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { PdfGeneratorService } from '../src/modules/invoices/pdf-generator.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const shopId = 'shop-123';
  const saleId = 'sale-456';

  const mockShop = {
    id: shopId,
    code: 'BTQ01',
    name: 'Boutique Test',
    address: '123 Rue Test, Douala',
    phone: '+237 699 000 000',
    email: 'test@swalo.com',
  };

  const mockCustomer = {
    id: 'cust-1',
    name: 'Jean Dupont',
    phone: '+237 699 111 111',
    email: 'jean@test.com',
    address: 'Douala',
  };

  const mockSale = {
    id: saleId,
    shop_id: shopId,
    status: 'COMPLETED',
    customer_id: 'cust-1',
    customer: mockCustomer,
    cashier: { display_name: 'Marie Caissière' },
    shop: mockShop,
    subtotal: 25000,
    discount: 0,
    tax_total: 0,
    grand_total: 25000,
    paid_total: 25000,
    items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        product_name: 'Glass Samsung A10',
        product: { name: 'Glass Samsung A10', sku: 'GL-SA10' },
        qty: 2,
        unit_price: 5000,
        discount: 0,
        tax_rate: 0,
        subtotal: 10000,
        tax_total: 0,
        total: 10000,
      },
      {
        id: 'item-2',
        product_id: 'prod-2',
        product_name: 'Coque iPhone 12',
        product: { name: 'Coque iPhone 12', sku: 'CQ-IP12' },
        qty: 1,
        unit_price: 15000,
        discount: 0,
        tax_rate: 0,
        subtotal: 15000,
        tax_total: 0,
        total: 15000,
      },
    ],
  };

  const mockPrismaService = {
    shop: { findUnique: jest.fn() },
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sale: { findFirst: jest.fn() },
  };

  const mockPdfGenerator = {
    generateInvoicePdfBase64: jest.fn(),
    generateInvoicePdf: jest.fn(),
    formatFCFA: jest.fn((amount: number) => {
      const formatted = new Intl.NumberFormat('fr-FR').format(amount);
      return `${formatted} FCFA`;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PdfGeneratorService, useValue: mockPdfGenerator },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  describe('createFromSale', () => {
    it('should create invoice and generate PDF from a completed sale', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(null); // No existing invoice
      mockPrismaService.sale.findFirst.mockResolvedValue(mockSale);
      mockPrismaService.shop.findUnique.mockResolvedValue(mockShop);
      // No previous invoices for number generation
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(null); // generateInvoiceNumber lookup

      mockPdfGenerator.generateInvoicePdfBase64.mockResolvedValue('base64pdfdata');

      const createdInvoice = {
        id: 'inv-1',
        number: 'BTQ01-2026-0001',
        shop_id: shopId,
        sale_id: saleId,
        status: 'ISSUED',
        grand_total: 25000,
        pdf_data: 'base64pdfdata',
        items: [],
        customer: mockCustomer,
      };
      mockPrismaService.invoice.create.mockResolvedValue(createdInvoice);

      const result = await service.createFromSale(shopId, saleId);

      expect(result.id).toBe('inv-1');
      expect(result.number).toBe('BTQ01-2026-0001');
      expect(result.pdf_data).toBe('base64pdfdata');
      expect(mockPdfGenerator.generateInvoicePdfBase64).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_number: 'BTQ01-2026-0001',
          shop_name: 'Boutique Test',
          customer_name: 'Jean Dupont',
          grand_total: 25000,
        })
      );
      expect(mockPrismaService.invoice.create).toHaveBeenCalled();
    });

    it('should return existing invoice if already created for the sale', async () => {
      const existingInvoice = {
        id: 'inv-existing',
        number: 'BTQ01-2026-0001',
        pdf_data: 'existing_pdf_data',
      };
      mockPrismaService.invoice.findFirst.mockResolvedValue(existingInvoice);

      const result = await service.createFromSale(shopId, saleId);

      expect(result.id).toBe('inv-existing');
      expect(mockPrismaService.sale.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.invoice.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if sale not found', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);
      mockPrismaService.sale.findFirst.mockResolvedValue(null);

      await expect(service.createFromSale(shopId, 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if sale is not COMPLETED', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);
      mockPrismaService.sale.findFirst.mockResolvedValue({
        ...mockSale,
        status: 'DRAFT',
      });

      await expect(service.createFromSale(shopId, saleId)).rejects.toThrow(BadRequestException);
    });

    it('should generate sequential invoice numbers', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(null); // No existing invoice for this sale
      mockPrismaService.sale.findFirst.mockResolvedValue(mockSale);
      mockPrismaService.shop.findUnique.mockResolvedValue(mockShop);
      // Previous invoice exists with number 0005
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce({ number: 'BTQ01-2026-0005' });

      mockPdfGenerator.generateInvoicePdfBase64.mockResolvedValue('pdf');
      mockPrismaService.invoice.create.mockResolvedValue({
        id: 'inv-new',
        number: 'BTQ01-2026-0006',
        pdf_data: 'pdf',
      });

      await service.createFromSale(shopId, saleId);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 'BTQ01-2026-0006',
          }),
        })
      );
    });
  });

  describe('getPdf', () => {
    it('should return existing PDF data', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        number: 'BTQ01-2026-0001',
        pdf_data: 'existing_pdf',
      });

      const result = await service.getPdf(shopId, 'inv-1');

      expect(result.pdf_data).toBe('existing_pdf');
      expect(result.number).toBe('BTQ01-2026-0001');
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(service.getPdf(shopId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return invoices for the shop', async () => {
      const invoices = [
        { id: 'inv-1', number: 'BTQ01-2026-0001', grand_total: 25000 },
        { id: 'inv-2', number: 'BTQ01-2026-0002', grand_total: 15000 },
      ];
      mockPrismaService.invoice.findMany.mockResolvedValue(invoices);

      const result = await service.findAll(shopId, {});

      expect(result).toHaveLength(2);
      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shop_id: shopId, deleted: false },
          orderBy: { created_at: 'desc' },
        })
      );
    });

    it('should filter by customer_id when provided', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      await service.findAll(shopId, { customer_id: 'cust-1' });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customer_id: 'cust-1' }),
        })
      );
    });

    it('should filter by date range when provided', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      await service.findAll(shopId, {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issue_date: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice with items and customer', async () => {
      const invoice = {
        id: 'inv-1',
        number: 'BTQ01-2026-0001',
        items: [{ description: 'Glass Samsung A10' }],
        customer: mockCustomer,
      };
      mockPrismaService.invoice.findFirst.mockResolvedValue(invoice);

      const result = await service.findOne(shopId, 'inv-1');

      expect(result.number).toBe('BTQ01-2026-0001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findOne(shopId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('PdfGeneratorService', () => {
  describe('formatFCFA', () => {
    it('should format amounts with French number formatting', () => {
      const pdfService = new PdfGeneratorService();

      expect(pdfService.formatFCFA(0)).toContain('0');
      expect(pdfService.formatFCFA(0)).toContain('FCFA');
      expect(pdfService.formatFCFA(12500)).toContain('12');
      expect(pdfService.formatFCFA(12500)).toContain('500');
      expect(pdfService.formatFCFA(12500)).toContain('FCFA');
      expect(pdfService.formatFCFA(1000000)).toContain('1');
      expect(pdfService.formatFCFA(1000000)).toContain('000');
      expect(pdfService.formatFCFA(1000000)).toContain('FCFA');
    });
  });
});
