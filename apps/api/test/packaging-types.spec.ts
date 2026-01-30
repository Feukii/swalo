import { Test, TestingModule } from '@nestjs/testing';
import { PackagingTypesService } from '../src/modules/packaging-types/packaging-types.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PackagingTypesService', () => {
  let service: PackagingTypesService;

  const mockPrismaService = {
    packagingType: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const shopId = 'shop-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackagingTypesService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<PackagingTypesService>(PackagingTypesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new packaging type', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue(null);
      mockPrismaService.packagingType.create.mockResolvedValue({
        id: 'pt-1',
        shop_id: shopId,
        name: 'Carton',
        symbol: 'ctn',
        is_default: false,
      });

      const result = await service.create(shopId, {
        name: 'Carton',
        symbol: 'ctn',
      });

      expect(result.name).toBe('Carton');
      expect(result.symbol).toBe('ctn');
      expect(mockPrismaService.packagingType.create).toHaveBeenCalledWith({
        data: {
          shop_id: shopId,
          name: 'Carton',
          symbol: 'ctn',
          is_default: false,
        },
      });
    });

    it('should throw if name already exists (case-insensitive)', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue({
        id: 'pt-existing',
        name: 'carton',
      });

      await expect(service.create(shopId, { name: 'Carton', symbol: 'ctn' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getAll', () => {
    it('should return all non-deleted packaging types ordered by default first', async () => {
      const types = [
        { id: 'pt-1', name: 'Pièce', is_default: true },
        { id: 'pt-2', name: 'Carton', is_default: false },
      ];
      mockPrismaService.packagingType.findMany.mockResolvedValue(types);

      const result = await service.getAll(shopId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.packagingType.findMany).toHaveBeenCalledWith({
        where: { shop_id: shopId, deleted: false },
        orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
      });
    });
  });

  describe('getOne', () => {
    it('should return a packaging type by ID', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue({
        id: 'pt-1',
        shop_id: shopId,
        name: 'Pièce',
      });

      const result = await service.getOne(shopId, 'pt-1');
      expect(result.name).toBe('Pièce');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue(null);

      await expect(service.getOne(shopId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update packaging type name and symbol', async () => {
      mockPrismaService.packagingType.findFirst
        .mockResolvedValueOnce({ id: 'pt-1', name: 'Carton', is_default: false })
        .mockResolvedValueOnce(null); // No duplicate name

      mockPrismaService.packagingType.update.mockResolvedValue({
        id: 'pt-1',
        name: 'Boîte',
        symbol: 'bte',
      });

      const result = await service.update(shopId, 'pt-1', {
        name: 'Boîte',
        symbol: 'bte',
      });

      expect(result.name).toBe('Boîte');
      expect(mockPrismaService.packagingType.update).toHaveBeenCalled();
    });

    it('should throw if updated name conflicts with existing', async () => {
      mockPrismaService.packagingType.findFirst
        .mockResolvedValueOnce({ id: 'pt-1', name: 'Carton' })
        .mockResolvedValueOnce({ id: 'pt-2', name: 'Douzaine' }); // Duplicate found

      await expect(service.update(shopId, 'pt-1', { name: 'Douzaine' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('delete', () => {
    it('should soft-delete a packaging type', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue({
        id: 'pt-1',
        name: 'Carton',
        is_default: false,
      });
      mockPrismaService.packagingType.update.mockResolvedValue({});

      const result = await service.delete(shopId, 'pt-1');

      expect(result.message).toContain('supprimé');
      expect(mockPrismaService.packagingType.update).toHaveBeenCalledWith({
        where: { id: 'pt-1' },
        data: {
          deleted: true,
          deleted_at: expect.any(Date),
        },
      });
    });

    it('should refuse to delete a default packaging type', async () => {
      mockPrismaService.packagingType.findFirst.mockResolvedValue({
        id: 'pt-1',
        name: 'Pièce',
        is_default: true,
      });

      await expect(service.delete(shopId, 'pt-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('initDefaults', () => {
    it('should create default packaging types if not existing', async () => {
      // All findFirst return null (no existing types)
      mockPrismaService.packagingType.findFirst.mockResolvedValue(null);
      mockPrismaService.packagingType.create.mockResolvedValue({});

      const result = await service.initDefaults(shopId);

      expect(result.message).toContain('initialisés');
      // 5 default types: Pièce, Carton, Douzaine, Paquet, Boîte
      expect(mockPrismaService.packagingType.create).toHaveBeenCalledTimes(5);
    });

    it('should not duplicate existing packaging types', async () => {
      // First two exist, rest don't
      mockPrismaService.packagingType.findFirst
        .mockResolvedValueOnce({ name: 'Pièce' })
        .mockResolvedValueOnce({ name: 'Carton' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockPrismaService.packagingType.create.mockResolvedValue({});

      await service.initDefaults(shopId);

      // Only 3 new types created
      expect(mockPrismaService.packagingType.create).toHaveBeenCalledTimes(3);
    });
  });
});
