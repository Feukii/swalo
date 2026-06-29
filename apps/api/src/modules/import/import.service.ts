import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as XLSX from 'xlsx';
import { mapColumnName, REQUIRED_COLUMNS, DEFAULT_VALUES } from './column-mapping';

interface ImportRow {
  sku: string;
  name: string;
  family?: string;
  article_type?: string;
  brand?: string;
  reference?: string;
  cost_price: number;
  sell_price: number;
  unit?: string;
  alert_threshold?: number;
  packaging?: string; // Nom du conditionnement (ex: Carton)
  units_per_package?: number; // Pieces par conditionnement (ex: 24)
  package_price?: number; // Prix du conditionnement complet
  stock?: number; // Stock cible (quantité) a importer
  action?: 'create' | 'update'; // create = nouveau SKU, update = SKU existant
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreviewResult {
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  valid_rows: number; // Alias for valid_count
  invalid_rows: number; // Alias for invalid_count
  to_create: number; // Nombre de nouveaux produits (SKU inconnu)
  to_update: number; // Nombre de produits existants (SKU connu) a mettre a jour
  errors: ValidationError[];
  preview_rows: ImportRow[];
  preview: ImportRow[]; // Alias for preview_rows
  columns_found: string[];
  columns_mapped: Record<string, string>;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Parse le fichier Excel/CSV et retourne un aperçu avec validation
   */
  async previewCatalogImport(
    shopId: string,
    fileContent: string,
    fileName: string
  ): Promise<ImportPreviewResult> {
    // Parse le fichier UNE SEULE FOIS puis valide. confirmCatalogImport réutilise
    // exactement le même découpage (parseFile + buildPreview) afin de ne jamais
    // parser le fichier deux fois (coûteux en mémoire/CPU sur Render free tier).
    const jsonData = this.parseFile(fileContent, fileName);
    return this.buildPreview(shopId, jsonData);
  }

  /**
   * Décode le base64 et lit le classeur (CSV ou XLSX) en une seule passe.
   * Toute la lecture du fichier est centralisée ici.
   */
  private parseFile(fileContent: string, fileName: string): Record<string, unknown>[] {
    const buffer = Buffer.from(fileContent, 'base64');
    const isCSV = fileName.toLowerCase().endsWith('.csv');

    let workbook: XLSX.WorkBook;
    try {
      if (isCSV) {
        const csvContent = buffer.toString('utf-8');
        workbook = XLSX.read(csvContent, { type: 'string' });
      } else {
        workbook = XLSX.read(buffer, { type: 'buffer' });
      }
    } catch {
      throw new BadRequestException('Impossible de lire le fichier. Vérifiez le format.');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Le fichier est vide');
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (jsonData.length === 0) {
      throw new BadRequestException('Aucune donnée trouvée dans le fichier');
    }

    return jsonData;
  }

  /**
   * Valide les lignes déjà parsées et construit l'aperçu (mapping de colonnes,
   * colonnes requises, détection création/mise à jour). Ne relit PAS le fichier.
   */
  private async buildPreview(
    shopId: string,
    jsonData: Record<string, unknown>[]
  ): Promise<ImportPreviewResult> {
    // Verifier les colonnes et appliquer le mapping
    const firstRow = jsonData[0];
    const originalColumns = Object.keys(firstRow);
    const columnMapping: Record<string, string> = {};

    // Mapper chaque colonne originale vers son nom standard
    for (const col of originalColumns) {
      const mappedName = mapColumnName(col);
      columnMapping[col] = mappedName;
    }

    const columnsFound = Object.values(columnMapping);

    // Verifier les colonnes requises (sku et name sont obligatoires)
    const missingColumns = REQUIRED_COLUMNS.filter(col => !columnsFound.includes(col));
    if (missingColumns.length > 0) {
      const suggestions = missingColumns.map(col => {
        if (col === 'sku') return 'sku (ou "Code Article")';
        if (col === 'name') return 'name (ou "Libelle Article", "Designation")';
        return col;
      });
      throw new BadRequestException(`Colonnes requises manquantes: ${suggestions.join(', ')}`);
    }

    // Récupérer les SKU existants pour détecter les doublons
    const existingSKUs = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted: false },
      select: { sku: true },
    });
    const existingSKUSet = new Set(existingSKUs.map(p => p.sku.toLowerCase()));

    // Valider chaque ligne
    const errors: ValidationError[] = [];
    const validRows: ImportRow[] = [];
    const seenSKUs = new Set<string>();

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // +2 car ligne 1 = headers, index commence a 0

      // Normaliser les cles avec le mapping de colonnes
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = mapColumnName(key);
        normalizedRow[mappedKey] = value;
      }

      // Extraire les valeurs
      const sku = this.toTrimmedString(normalizedRow.sku);
      const name = this.toTrimmedString(normalizedRow.name);

      // Appliquer les valeurs par defaut pour les prix si non specifies
      const costPriceRaw = normalizedRow.cost_price;
      const sellPriceRaw = normalizedRow.sell_price;
      const costPrice =
        costPriceRaw !== undefined && costPriceRaw !== ''
          ? this.parseNumber(costPriceRaw)
          : (DEFAULT_VALUES.cost_price as number);
      const sellPrice =
        sellPriceRaw !== undefined && sellPriceRaw !== ''
          ? this.parseNumber(sellPriceRaw)
          : (DEFAULT_VALUES.sell_price as number);

      // Validations
      let hasError = false;

      if (!sku) {
        errors.push({ row: rowNumber, field: 'sku', message: 'SKU requis' });
        hasError = true;
      } else if (seenSKUs.has(sku.toLowerCase())) {
        // Un SKU existant n'est PAS une erreur (= mise a jour). Seul un doublon
        // a l'interieur du fichier reste une vraie erreur.
        errors.push({
          row: rowNumber,
          field: 'sku',
          message: `SKU "${sku}" en doublon dans le fichier`,
        });
        hasError = true;
      }

      if (!name) {
        errors.push({ row: rowNumber, field: 'name', message: 'Nom requis' });
        hasError = true;
      }

      // Les prix peuvent etre 0 par defaut, mais pas negatifs
      if (costPrice === null || costPrice < 0) {
        errors.push({
          row: rowNumber,
          field: 'cost_price',
          message: "Prix d'achat invalide (doit etre >= 0)",
        });
        hasError = true;
      }

      if (sellPrice === null || sellPrice < 0) {
        errors.push({
          row: rowNumber,
          field: 'sell_price',
          message: 'Prix de vente invalide (doit etre >= 0)',
        });
        hasError = true;
      }

      if (!hasError && costPrice !== null && sellPrice !== null) {
        seenSKUs.add(sku.toLowerCase());
        const action: 'create' | 'update' = existingSKUSet.has(sku.toLowerCase())
          ? 'update'
          : 'create';
        const stockRaw = normalizedRow.stock;
        const stock =
          stockRaw !== undefined && stockRaw !== ''
            ? (this.parseNumber(stockRaw) ?? undefined)
            : undefined;
        validRows.push({
          sku,
          name,
          family: this.toOptionalString(normalizedRow.family),
          article_type: this.toOptionalString(normalizedRow.article_type),
          brand: this.toOptionalString(normalizedRow.brand),
          reference: this.toOptionalString(normalizedRow.reference),
          cost_price: costPrice,
          sell_price: sellPrice,
          unit: this.toTrimmedString(normalizedRow.unit) || 'unit',
          alert_threshold: this.parseNumber(normalizedRow.alert_threshold) ?? 5,
          packaging: this.toOptionalString(normalizedRow.packaging),
          units_per_package: this.parsePositiveInt(normalizedRow.units_per_package),
          package_price: this.parseNumber(normalizedRow.package_price) ?? undefined,
          stock,
          action,
        });
      }
    }

    const toCreate = validRows.filter(r => r.action === 'create').length;
    const toUpdate = validRows.filter(r => r.action === 'update').length;

    return {
      total_rows: jsonData.length,
      valid_count: validRows.length,
      invalid_count: jsonData.length - validRows.length,
      // Aliases for backward compatibility
      valid_rows: validRows.length,
      invalid_rows: jsonData.length - validRows.length,
      to_create: toCreate,
      to_update: toUpdate,
      errors: errors.slice(0, 100), // Limiter a 100 erreurs
      preview_rows: validRows.slice(0, 10), // Apercu des 10 premiers
      preview: validRows.slice(0, 10), // Alias
      columns_found: columnsFound,
      columns_mapped: columnMapping,
    };
  }

  /**
   * Confirmer et exécuter l'import du catalogue
   */
  async confirmCatalogImport(shopId: string, fileContent: string, fileName: string) {
    // Parse le fichier UNE SEULE FOIS, puis valide sur ces mêmes lignes
    // (plus de double parsing : parseFile + buildPreview partagés avec le preview).
    const jsonData = this.parseFile(fileContent, fileName);
    const preview = await this.buildPreview(shopId, jsonData);

    if (preview.valid_rows === 0) {
      throw new BadRequestException('Aucune ligne valide à importer');
    }

    // Récupérer les produits existants (id + sku) pour distinguer création / mise à jour.
    // Un SKU connu (même boutique, non supprimé, insensible à la casse) => UPDATE par son id.
    const existingProducts = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted: false },
      select: { id: true, sku: true },
    });
    const existingProductMap = new Map<string, string>(); // sku lowercase -> product id
    for (const p of existingProducts) {
      existingProductMap.set(p.sku.toLowerCase(), p.id);
    }

    // Précharger les conditionnements existants (résolution / création à la volée)
    const existingPackaging = await this.prisma.packagingType.findMany({
      where: { shop_id: shopId, deleted: false },
      select: { id: true, name: true },
    });
    const packagingCache = new Map<string, string>();
    for (const pt of existingPackaging) {
      packagingCache.set(pt.name.trim().toLowerCase(), pt.id);
    }

    // Importer / mettre à jour les produits valides
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const seenSKUs = new Set<string>();

    for (const row of jsonData) {
      // Normaliser les cles avec le mapping de colonnes
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = mapColumnName(key);
        normalizedRow[mappedKey] = value;
      }

      const sku = this.toTrimmedString(normalizedRow.sku);
      const name = this.toTrimmedString(normalizedRow.name);

      // Appliquer les valeurs par defaut pour les prix
      const costPriceRaw = normalizedRow.cost_price;
      const sellPriceRaw = normalizedRow.sell_price;
      const costPrice =
        costPriceRaw !== undefined && costPriceRaw !== ''
          ? this.parseNumber(costPriceRaw)
          : (DEFAULT_VALUES.cost_price as number);
      const sellPrice =
        sellPriceRaw !== undefined && sellPriceRaw !== ''
          ? this.parseNumber(sellPriceRaw)
          : (DEFAULT_VALUES.sell_price as number);

      // Skip si invalide ou doublon DANS le fichier (un SKU existant n'est PAS skippé : update)
      if (
        !sku ||
        !name ||
        costPrice === null ||
        sellPrice === null ||
        seenSKUs.has(sku.toLowerCase())
      ) {
        skipped++;
        continue;
      }

      seenSKUs.add(sku.toLowerCase());

      // Conditionnement : nom -> packaging_type_id (résolution / création à la volée)
      const packagingName = this.toTrimmedString(normalizedRow.packaging);
      const unitsPerPackage = this.parsePositiveInt(normalizedRow.units_per_package);
      const packagePrice = this.parseNumber(normalizedRow.package_price);
      let packagingTypeId: string | null = null;
      if (packagingName) {
        packagingTypeId = await this.resolvePackagingTypeId(shopId, packagingName, packagingCache);
      }

      // Stock cible : seulement si la colonne « stock » est présente et non vide pour la ligne.
      const stockRaw = normalizedRow.stock;
      const targetStock =
        stockRaw !== undefined && stockRaw !== '' ? this.parseNumber(stockRaw) : null;

      const existingId = existingProductMap.get(sku.toLowerCase());

      try {
        let productId: string;
        if (existingId) {
          // UPDATE : ne pas écraser un champ existant avec une valeur vide du fichier.
          const updateData: Record<string, unknown> = { name }; // name est requis (toujours présent)
          if (this.hasValue(normalizedRow.family))
            updateData.family = this.toNullableString(normalizedRow.family);
          if (this.hasValue(normalizedRow.article_type))
            updateData.article_type = this.toNullableString(normalizedRow.article_type);
          if (this.hasValue(normalizedRow.brand))
            updateData.brand = this.toNullableString(normalizedRow.brand);
          if (this.hasValue(normalizedRow.reference))
            updateData.reference = this.toNullableString(normalizedRow.reference);
          if (this.hasValue(normalizedRow.cost_price)) updateData.cost_price = costPrice;
          if (this.hasValue(normalizedRow.sell_price)) updateData.sell_price = sellPrice;
          if (this.hasValue(normalizedRow.unit))
            updateData.unit = this.toTrimmedString(normalizedRow.unit) || 'unit';
          if (this.hasValue(normalizedRow.alert_threshold))
            updateData.alert_threshold = this.parseNumber(normalizedRow.alert_threshold) ?? 5;
          if (packagingTypeId) updateData.packaging_type_id = packagingTypeId;
          if (unitsPerPackage !== undefined) updateData.units_per_package = unitsPerPackage;
          if (packagePrice !== null) updateData.package_price = packagePrice;

          await this.prisma.product.update({ where: { id: existingId }, data: updateData });
          productId = existingId;
          updated++;
        } else {
          const createdProduct = await this.prisma.product.create({
            data: {
              shop_id: shopId,
              sku,
              name,
              family: this.toNullableString(normalizedRow.family),
              article_type: this.toNullableString(normalizedRow.article_type),
              brand: this.toNullableString(normalizedRow.brand),
              reference: this.toNullableString(normalizedRow.reference),
              cost_price: costPrice,
              sell_price: sellPrice,
              unit: this.toTrimmedString(normalizedRow.unit) || 'unit',
              alert_threshold: this.parseNumber(normalizedRow.alert_threshold) ?? 5,
              packaging_type_id: packagingTypeId,
              units_per_package: unitsPerPackage ?? null,
              package_price: packagePrice ?? null,
              is_active: true,
            },
            select: { id: true },
          });
          productId = createdProduct.id;
          created++;
        }

        // Import du stock : ajuste le stock à la cible via UN mouvement INVENTORY (delta).
        if (targetStock !== null) {
          await this.applyStockTarget(
            shopId,
            productId,
            targetStock,
            costPrice,
            sellPrice,
            !!existingId
          );
        }
      } catch (error) {
        // Log l'erreur avec le détail du produit concerné
        const errorMessage = error instanceof Error ? error.message : '';
        const errorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        const detail = errorMessage || errorCode || 'Unknown';
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Failed to import product: sku=${sku}, name=${name}, error=${detail}`,
          stack
        );
        skipped++;
      }
    }

    const imported = created + updated;
    return {
      message: `Import terminé: ${String(created)} créé(s), ${String(updated)} mis à jour`,
      imported, // Alias = created + updated
      skipped,
      total: jsonData.length,
      // Counts réels pour le frontend
      created_count: created,
      updated_count: updated,
    };
  }

  /**
   * Ajuste le stock d'un produit pour atteindre la cible `targetStock`.
   * Le stock = somme des inventory_movements.qty. On crée donc UN mouvement de type
   * INVENTORY avec qty = targetStock - stock_actuel (rien si delta = 0). Pour un delta
   * positif on crée aussi un StockBatch (cohérence valorisation FIFO).
   */
  private async applyStockTarget(
    shopId: string,
    productId: string,
    targetStock: number,
    costPrice: number,
    sellPrice: number,
    isExisting: boolean
  ): Promise<void> {
    let currentStock = 0;
    if (isExisting) {
      const movements = await this.prisma.inventoryMovement.findMany({
        where: { product_id: productId, shop_id: shopId, deleted: false },
        select: { qty: true },
      });
      currentStock = movements.reduce((sum, m) => sum + m.qty, 0);
    }

    const delta = targetStock - currentStock;
    if (delta === 0) return;

    await this.prisma.inventoryMovement.create({
      data: {
        shop_id: shopId,
        product_id: productId,
        type: 'INVENTORY',
        qty: delta,
        reason: 'Import catalogue',
        ref_type: 'IMPORT',
        unit_cost: costPrice,
        device_id: 'import',
        client_op_id: randomUUID(),
      },
    });

    // Delta positif : créer un lot pour la valorisation FIFO. Delta négatif : mouvement seul.
    if (delta > 0) {
      await this.prisma.stockBatch.create({
        data: {
          shop_id: shopId,
          product_id: productId,
          quantity: delta,
          remaining_quantity: delta,
          cost_price: costPrice,
          sell_price: sellPrice,
        },
      });
    }
  }

  /**
   * Vrai si la valeur de cellule est présente et non vide (après trim pour les chaînes).
   */
  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  }

  /**
   * Convertit une valeur quelconque en chaine nettoyee (trim)
   */
  private toTrimmedString(value: unknown): string {
    return this.coerceToString(value).trim();
  }

  /**
   * Convertit une valeur de cellule (string, number, boolean, Date) en chaine.
   * Les valeurs nullish ou objets non supportes renvoient une chaine vide.
   */
  private coerceToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return '';
  }

  /**
   * Comme toTrimmedString mais retourne undefined si la chaine est vide
   */
  private toOptionalString(value: unknown): string | undefined {
    const str = this.toTrimmedString(value);
    return str ? str : undefined;
  }

  /**
   * Comme toTrimmedString mais retourne null si la chaine est vide
   */
  private toNullableString(value: unknown): string | null {
    const str = this.toTrimmedString(value);
    return str ? str : null;
  }

  /**
   * Parse un entier strictement positif (ex: pièces par conditionnement).
   * Retourne undefined si absent, nul ou <= 0.
   */
  private parsePositiveInt(value: unknown): number | undefined {
    const num = this.parseNumber(value);
    return num !== null && num > 0 ? num : undefined;
  }

  /**
   * Résout un nom de conditionnement vers un packaging_type_id, en créant le
   * PackagingType s'il n'existe pas encore pour la boutique. Le cache évite les
   * doublons et les requêtes répétées au sein d'un même import.
   */
  private async resolvePackagingTypeId(
    shopId: string,
    name: string,
    cache: Map<string, string>
  ): Promise<string | null> {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const cached = cache.get(key);
    if (cached) return cached;

    try {
      const created = await this.prisma.packagingType.create({
        data: { shop_id: shopId, name: name.trim() },
        select: { id: true },
      });
      cache.set(key, created.id);
      return created.id;
    } catch {
      // Course possible sur l'unique [shop_id, name] : on relit.
      const existing = await this.prisma.packagingType.findFirst({
        where: { shop_id: shopId, name: name.trim(), deleted: false },
        select: { id: true },
      });
      if (existing) {
        cache.set(key, existing.id);
        return existing.id;
      }
      return null;
    }
  }

  /**
   * Parse un nombre depuis une valeur quelconque
   */
  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Si c'est déjà un nombre
    if (typeof value === 'number') {
      return Math.round(value);
    }

    // Convertir en string et nettoyer
    const str = this.coerceToString(value)
      .replace(/\s/g, '') // Supprimer espaces
      .replace(/,/g, '.') // Remplacer virgule par point
      .replace(/[^0-9.-]/g, ''); // Garder que chiffres, point, tiret

    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num);
  }
}
