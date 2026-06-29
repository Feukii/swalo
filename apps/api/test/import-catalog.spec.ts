import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { ImportService } from '../src/modules/import/import.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

const SHOP_ID = 'shop-123';

/**
 * Construit un fichier XLSX en mémoire (en-têtes français réels) et renvoie son
 * contenu encodé en base64, exactement comme le frontend l'envoie à l'API.
 */
function buildXlsxBase64(rows: Record<string, string | number>[]): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

/**
 * Deux lignes couvrant TOUTES les colonnes supportées, avec des en-têtes
 * français accentués / espacés tels qu'on les trouve dans un export réel.
 */
function sampleRows(): Record<string, string | number>[] {
  return [
    {
      'Code Article': 'A001',
      'Libelle Article': 'Chargeur USB-C 20W',
      Famille: 'Accessoires',
      Article: 'Chargeur',
      Marque: 'Anker',
      'Reference (Serie)': 'A2633',
      "Prix d'achat": 3000,
      'Prix de vente': 5000,
      Unite: 'piece',
      'Seuil alerte': 4,
      Conditionnement: 'Carton',
      'Sous-cond.': 24,
      'Prix carton': 110000,
      Stock: 10,
    },
    {
      'Code Article': 'B002',
      'Libelle Article': 'Cable Lightning 1m',
      Famille: 'Accessoires',
      Article: 'Cable',
      Marque: 'Belkin',
      'Reference (Serie)': 'CAA001',
      "Prix d'achat": 1500,
      'Prix de vente': 3000,
      Unite: 'piece',
      'Seuil alerte': 5,
      Conditionnement: 'Carton',
      'Sous-cond.': 50,
      'Prix carton': 70000,
      Stock: 25,
    },
  ];
}

describe('ImportService - Catalog import (toutes colonnes)', () => {
  let service: ImportService;

  const mockPrisma = {
    product: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    packagingType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    inventoryMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    stockBatch: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ImportService>(ImportService);
    jest.clearAllMocks();
  });

  describe('previewCatalogImport', () => {
    it('mappe toutes les colonnes françaises et valide les lignes', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]); // aucun SKU existant

      const result = await service.previewCatalogImport(
        SHOP_ID,
        buildXlsxBase64(sampleRows()),
        'catalogue.xlsx'
      );

      expect(result.total_rows).toBe(2);
      expect(result.valid_count).toBe(2);
      expect(result.invalid_count).toBe(0);
      expect(result.to_create).toBe(2);
      expect(result.to_update).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Chaque en-tête français doit être mappé sur le bon champ standard
      expect(result.columns_mapped).toMatchObject({
        'Code Article': 'sku',
        'Libelle Article': 'name',
        Famille: 'family',
        Article: 'article_type',
        Marque: 'brand',
        'Reference (Serie)': 'reference',
        "Prix d'achat": 'cost_price',
        'Prix de vente': 'sell_price',
        Unite: 'unit',
        'Seuil alerte': 'alert_threshold',
        Conditionnement: 'packaging',
        'Sous-cond.': 'units_per_package',
        'Prix carton': 'package_price',
        Stock: 'stock',
      });

      // La première ligne d'aperçu doit contenir toutes les valeurs parsées
      expect(result.preview_rows[0]).toMatchObject({
        sku: 'A001',
        name: 'Chargeur USB-C 20W',
        family: 'Accessoires',
        article_type: 'Chargeur',
        brand: 'Anker',
        reference: 'A2633',
        cost_price: 3000,
        sell_price: 5000,
        unit: 'piece',
        alert_threshold: 4,
        packaging: 'Carton',
        units_per_package: 24,
        package_price: 110000,
        stock: 10,
        action: 'create',
      });
    });

    it('détecte un SKU existant comme mise à jour (upsert), pas comme erreur', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'existing-1', sku: 'A001' }]);

      const result = await service.previewCatalogImport(
        SHOP_ID,
        buildXlsxBase64(sampleRows()),
        'catalogue.xlsx'
      );

      expect(result.to_create).toBe(1); // B002
      expect(result.to_update).toBe(1); // A001 existe déjà
      expect(result.invalid_count).toBe(0);
    });

    it('rejette un fichier sans les colonnes requises (sku/name)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const base64 = buildXlsxBase64([{ Famille: 'X', Marque: 'Y' }]);

      await expect(service.previewCatalogImport(SHOP_ID, base64, 'mauvais.xlsx')).rejects.toThrow(
        /Colonnes requises manquantes/
      );
    });

    it("signale un doublon de SKU à l'intérieur du fichier", async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const rows = sampleRows();
      rows[1]['Code Article'] = 'A001'; // doublon intra-fichier

      const result = await service.previewCatalogImport(
        SHOP_ID,
        buildXlsxBase64(rows),
        'catalogue.xlsx'
      );

      expect(result.invalid_count).toBe(1);
      expect(result.errors.some(e => e.field === 'sku' && e.message.includes('doublon'))).toBe(
        true
      );
    });
  });

  describe('confirmCatalogImport', () => {
    it('crée les nouveaux produits, met à jour les existants et importe le stock', async () => {
      // A001 existe déjà -> update ; B002 est nouveau -> create
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'existing-A001', sku: 'A001' }]);
      mockPrisma.packagingType.findMany.mockResolvedValue([]);
      mockPrisma.packagingType.create.mockResolvedValue({ id: 'pkg-carton' });
      mockPrisma.product.update.mockResolvedValue({ id: 'existing-A001' });
      mockPrisma.product.create.mockResolvedValue({ id: 'new-B002' });
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]); // stock actuel = 0
      mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'mov-1' });
      mockPrisma.stockBatch.create.mockResolvedValue({ id: 'batch-1' });

      const result = await service.confirmCatalogImport(
        SHOP_ID,
        buildXlsxBase64(sampleRows()),
        'catalogue.xlsx'
      );

      expect(result.created_count).toBe(1);
      expect(result.updated_count).toBe(1);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);

      // Le nouveau produit B002 est créé avec tous les champs mappés
      expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shop_id: SHOP_ID,
            sku: 'B002',
            name: 'Cable Lightning 1m',
            family: 'Accessoires',
            article_type: 'Cable',
            brand: 'Belkin',
            reference: 'CAA001',
            cost_price: 1500,
            sell_price: 3000,
            unit: 'piece',
            alert_threshold: 5,
            packaging_type_id: 'pkg-carton',
            units_per_package: 50,
            package_price: 70000,
          }),
        })
      );

      // Le conditionnement "Carton" n'est créé qu'une seule fois (cache partagé)
      expect(mockPrisma.packagingType.create).toHaveBeenCalledTimes(1);

      // Le stock est importé : un mouvement INVENTORY par produit + un lot FIFO (delta positif)
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.stockBatch.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shop_id: SHOP_ID,
            type: 'INVENTORY',
            ref_type: 'IMPORT',
          }),
        })
      );
    });

    it('ne réimporte pas de stock quand la colonne Stock est absente', async () => {
      const rowsNoStock = sampleRows().map(r => {
        const copy = { ...r };
        delete copy.Stock;
        return copy;
      });
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.packagingType.findMany.mockResolvedValue([]);
      mockPrisma.packagingType.create.mockResolvedValue({ id: 'pkg-carton' });
      mockPrisma.product.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.confirmCatalogImport(
        SHOP_ID,
        buildXlsxBase64(rowsNoStock),
        'catalogue.xlsx'
      );

      expect(result.created_count).toBe(2);
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(mockPrisma.stockBatch.create).not.toHaveBeenCalled();
    });
  });
});
