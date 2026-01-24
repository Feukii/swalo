import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../src/modules/products/products.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('ProductsService - Hierarchy Management', () => {
  let service: ProductsService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    product: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    _prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('batchUpdateHierarchy', () => {
    const shopId = 'shop-123';

    it('should batch update family level for all products', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 15 });

      const updateDto = {
        level: 'family',
        old_value: 'GLASS',
        new_value: 'GLASSES',
      };

      const result = await service.batchUpdateHierarchy(shopId, updateDto);

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          family: 'GLASS',
        },
        data: {
          family: 'GLASSES',
          version: { increment: 1 },
        },
      });

      expect(result.count).toBe(15);
      expect(result.message).toBe('15 produit(s) mis à jour avec succès');
    });

    it('should batch update article_type with family filter', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 8 });

      const updateDto = {
        level: 'article_type',
        old_value: 'Glass 2D',
        new_value: 'Glass 3D',
        family: 'GLASSES',
      };

      const result = await service.batchUpdateHierarchy(shopId, updateDto);

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          article_type: 'Glass 2D',
          family: 'GLASSES',
        },
        data: {
          article_type: 'Glass 3D',
          version: { increment: 1 },
        },
      });

      expect(result.count).toBe(8);
    });

    it('should batch update brand with family and article_type filters', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 5 });

      const updateDto = {
        level: 'brand',
        old_value: 'Samsng',
        new_value: 'Samsung',
        family: 'GLASSES',
        article_type: 'Glass 3D',
      };

      const result = await service.batchUpdateHierarchy(shopId, updateDto);

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          brand: 'Samsng',
          family: 'GLASSES',
          article_type: 'Glass 3D',
        },
        data: {
          brand: 'Samsung',
          version: { increment: 1 },
        },
      });

      expect(result.count).toBe(5);
    });

    it('should batch update reference level', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 3 });

      const updateDto = {
        level: 'reference',
        old_value: 'A10',
        new_value: 'A10E',
        family: 'GLASSES',
        article_type: 'Glass 3D',
        brand: 'Samsung',
      };

      const result = await service.batchUpdateHierarchy(shopId, updateDto);

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          reference: 'A10',
          family: 'GLASSES',
          article_type: 'Glass 3D',
          brand: 'Samsung',
        },
        data: {
          reference: 'A10E',
          version: { increment: 1 },
        },
      });

      expect(result.count).toBe(3);
    });

    it('should return zero count when no products match', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 0 });

      const updateDto = {
        level: 'family',
        old_value: 'NONEXISTENT',
        new_value: 'NEW_FAMILY',
      };

      const result = await service.batchUpdateHierarchy(shopId, updateDto);

      expect(result.count).toBe(0);
      expect(result.message).toBe('0 produit(s) mis à jour avec succès');
    });

    it('should increment version field for optimistic concurrency', async () => {
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 10 });

      const updateDto = {
        level: 'brand',
        old_value: 'Old Brand',
        new_value: 'New Brand',
      };

      await service.batchUpdateHierarchy(shopId, updateDto);

      const updateCall = mockPrismaService.product.updateMany.mock.calls[0][0];
      expect(updateCall.data.version).toEqual({ increment: 1 });
    });
  });

  describe('getFilters with cascade', () => {
    const shopId = 'shop-123';

    it('should return all filters when no cascade filters applied', async () => {
      const mockFamilies = [{ family: 'GLASSES' }, { family: 'CASES' }];
      const mockBrands = [{ brand: 'Samsung' }, { brand: 'Tecno' }];
      const mockTypes = [{ article_type: 'Glass 3D' }, { article_type: 'Glass 2D' }];

      mockPrismaService.product.findMany
        .mockResolvedValueOnce(mockFamilies)
        .mockResolvedValueOnce(mockBrands)
        .mockResolvedValueOnce(mockTypes);

      const result = await service.getFilters(shopId);

      expect(result.families).toEqual(['GLASSES', 'CASES']);
      expect(result.brands).toEqual(['Samsung', 'Tecno']);
      expect(result.article_types).toEqual(['Glass 3D', 'Glass 2D']);
    });

    it('should cascade filter brands and types when family is selected', async () => {
      const mockFamilies = [{ family: 'GLASSES' }];
      const mockBrands = [{ brand: 'Samsung' }, { brand: 'Tecno' }];
      const mockTypes = [{ article_type: 'Glass 3D' }];

      mockPrismaService.product.findMany
        .mockResolvedValueOnce(mockFamilies)
        .mockResolvedValueOnce(mockBrands)
        .mockResolvedValueOnce(mockTypes);

      const result = await service.getFilters(shopId, { family: 'GLASSES' });

      // Check that brands query includes family filter
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          family: 'GLASSES',
          brand: { not: null },
        },
        select: { brand: true },
        distinct: ['brand'],
      });

      expect(result.families).toEqual(['GLASSES']);
      expect(result.brands).toEqual(['Samsung', 'Tecno']);
    });

    it('should cascade filter types when family and brand are selected', async () => {
      const mockFamilies = [{ family: 'GLASSES' }];
      const mockBrands = [{ brand: 'Samsung' }];
      const mockTypes = [{ article_type: 'Glass 3D' }];

      mockPrismaService.product.findMany
        .mockResolvedValueOnce(mockFamilies)
        .mockResolvedValueOnce(mockBrands)
        .mockResolvedValueOnce(mockTypes);

      const result = await service.getFilters(shopId, {
        family: 'GLASSES',
        brand: 'Samsung',
      });

      // Check that types query includes both filters
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          shop_id: shopId,
          deleted: false,
          family: 'GLASSES',
          brand: 'Samsung',
          article_type: { not: null },
        },
        select: { article_type: true },
        distinct: ['article_type'],
      });

      expect(result.article_types).toEqual(['Glass 3D']);
    });

    it('should handle null values in hierarchy fields', async () => {
      const mockFamilies = [{ family: 'GLASSES' }, { family: null }];
      const mockBrands = [{ brand: 'Samsung' }, { brand: null }];

      mockPrismaService.product.findMany
        .mockResolvedValueOnce(mockFamilies)
        .mockResolvedValueOnce(mockBrands)
        .mockResolvedValueOnce([]);

      const result = await service.getFilters(shopId);

      // Should filter out null values
      expect(result.families).toEqual(['GLASSES']);
      expect(result.brands).toEqual(['Samsung']);
    });
  });
});
