import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
    // Décoder le contenu base64
    const buffer = Buffer.from(fileContent, 'base64');

    // Déterminer le type de fichier
    const isCSV = fileName.toLowerCase().endsWith('.csv');

    // Parser le fichier
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

    // Prendre la première feuille
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Le fichier est vide');
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) {
      throw new BadRequestException('Aucune donnée trouvée dans le fichier');
    }

    // Verifier les colonnes et appliquer le mapping
    const firstRow = jsonData[0] as Record<string, unknown>;
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
      const row = jsonData[i] as Record<string, unknown>;
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
      } else if (existingSKUSet.has(sku.toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: 'sku',
          message: `SKU "${sku}" existe déjà`,
        });
        hasError = true;
      } else if (seenSKUs.has(sku.toLowerCase())) {
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
        });
      }
    }

    return {
      total_rows: jsonData.length,
      valid_count: validRows.length,
      invalid_count: jsonData.length - validRows.length,
      // Aliases for backward compatibility
      valid_rows: validRows.length,
      invalid_rows: jsonData.length - validRows.length,
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
    // Re-parser et valider
    const preview = await this.previewCatalogImport(shopId, fileContent, fileName);

    if (preview.valid_rows === 0) {
      throw new BadRequestException('Aucune ligne valide à importer');
    }

    // Parser à nouveau pour récupérer toutes les lignes valides
    const buffer = Buffer.from(fileContent, 'base64');
    const isCSV = fileName.toLowerCase().endsWith('.csv');

    let workbook: XLSX.WorkBook;
    if (isCSV) {
      const csvContent = buffer.toString('utf-8');
      workbook = XLSX.read(csvContent, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Récupérer les SKU existants
    const existingSKUs = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted: false },
      select: { sku: true },
    });
    const existingSKUSet = new Set(existingSKUs.map(p => p.sku.toLowerCase()));

    // Importer les produits valides
    let imported = 0;
    let skipped = 0;
    const seenSKUs = new Set<string>();

    for (const row of jsonData) {
      // Normaliser les cles avec le mapping de colonnes
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
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

      // Skip si invalide ou doublon
      if (
        !sku ||
        !name ||
        costPrice === null ||
        sellPrice === null ||
        existingSKUSet.has(sku.toLowerCase()) ||
        seenSKUs.has(sku.toLowerCase())
      ) {
        skipped++;
        continue;
      }

      seenSKUs.add(sku.toLowerCase());

      try {
        await this.prisma.product.create({
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
            is_active: true,
          },
        });
        imported++;
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

    return {
      message: `Import terminé: ${String(imported)} produit(s) importé(s)`,
      imported,
      skipped,
      total: jsonData.length,
      // Aliases for frontend compatibility
      created_count: imported,
      updated_count: 0, // This import only creates, doesn't update
    };
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
