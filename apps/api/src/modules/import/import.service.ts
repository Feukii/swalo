import { Injectable, BadRequestException } from '@nestjs/common';
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
  valid_rows: number;
  invalid_rows: number;
  errors: ValidationError[];
  preview: ImportRow[];
  columns_found: string[];
  columns_mapped: Record<string, string>;
}

@Injectable()
export class ImportService {
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
    const firstRow = jsonData[0] as Record<string, any>;
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
      const row = jsonData[i] as Record<string, any>;
      const rowNumber = i + 2; // +2 car ligne 1 = headers, index commence a 0

      // Normaliser les cles avec le mapping de colonnes
      const normalizedRow: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = mapColumnName(key);
        normalizedRow[mappedKey] = value;
      }

      // Extraire les valeurs
      const sku = String(normalizedRow.sku || '').trim();
      const name = String(normalizedRow.name || '').trim();

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
          family: normalizedRow.family?.toString().trim() || undefined,
          article_type: normalizedRow.article_type?.toString().trim() || undefined,
          brand: normalizedRow.brand?.toString().trim() || undefined,
          reference: normalizedRow.reference?.toString().trim() || undefined,
          cost_price: costPrice,
          sell_price: sellPrice,
          unit: normalizedRow.unit?.toString().trim() || 'unit',
          alert_threshold: this.parseNumber(normalizedRow.alert_threshold) || 5,
        });
      }
    }

    return {
      total_rows: jsonData.length,
      valid_rows: validRows.length,
      invalid_rows: jsonData.length - validRows.length,
      errors: errors.slice(0, 100), // Limiter a 100 erreurs
      preview: validRows.slice(0, 10), // Apercu des 10 premiers
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
      const normalizedRow: Record<string, any> = {};
      for (const [key, value] of Object.entries(row as Record<string, any>)) {
        const mappedKey = mapColumnName(key);
        normalizedRow[mappedKey] = value;
      }

      const sku = String(normalizedRow.sku || '').trim();
      const name = String(normalizedRow.name || '').trim();

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
            family: normalizedRow.family?.toString().trim() || null,
            article_type: normalizedRow.article_type?.toString().trim() || null,
            brand: normalizedRow.brand?.toString().trim() || null,
            reference: normalizedRow.reference?.toString().trim() || null,
            cost_price: costPrice,
            sell_price: sellPrice,
            unit: normalizedRow.unit?.toString().trim() || 'unit',
            alert_threshold: this.parseNumber(normalizedRow.alert_threshold) || 5,
            is_active: true,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return {
      message: `Import terminé: ${imported} produit(s) importé(s)`,
      imported,
      skipped,
      total: jsonData.length,
    };
  }

  /**
   * Parse un nombre depuis une valeur quelconque
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Si c'est déjà un nombre
    if (typeof value === 'number') {
      return Math.round(value);
    }

    // Convertir en string et nettoyer
    const str = String(value)
      .replace(/\s/g, '') // Supprimer espaces
      .replace(/,/g, '.') // Remplacer virgule par point
      .replace(/[^0-9.-]/g, ''); // Garder que chiffres, point, tiret

    const num = parseFloat(str);
    return isNaN(num) ? null : Math.round(num);
  }
}
