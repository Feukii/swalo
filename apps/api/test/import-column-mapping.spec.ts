import {
  mapColumnName,
  normalizeColumnName,
  removeAccents,
  COLUMN_ALIASES,
  REQUIRED_COLUMNS,
  DEFAULT_VALUES,
} from '../src/modules/import/column-mapping';

describe('Import Column Mapping', () => {
  describe('removeAccents', () => {
    it('should remove French accents', () => {
      expect(removeAccents('reference')).toBe('reference');
      expect(removeAccents('categorie')).toBe('categorie');
      expect(removeAccents('libelle')).toBe('libelle');
      expect(removeAccents('depense')).toBe('depense');
    });

    it('should handle apostrophes', () => {
      expect(removeAccents("type d'article")).toBe("type d'article");
      expect(removeAccents("prix d'achat")).toBe("prix d'achat");
    });

    it('should return unchanged string if no accents', () => {
      expect(removeAccents('family')).toBe('family');
      expect(removeAccents('brand')).toBe('brand');
    });
  });

  describe('normalizeColumnName', () => {
    it('should lowercase and trim', () => {
      expect(normalizeColumnName('  Family  ')).toBe('family');
      expect(normalizeColumnName('BRAND')).toBe('brand');
      expect(normalizeColumnName('Code Article')).toBe('code article');
    });

    it('should remove accents', () => {
      expect(normalizeColumnName('Reference')).toBe('reference');
      expect(normalizeColumnName('Categorie')).toBe('categorie');
    });
  });

  describe('mapColumnName', () => {
    describe('SKU mapping', () => {
      it('should map "Code Article" to "sku"', () => {
        expect(mapColumnName('Code Article')).toBe('sku');
        expect(mapColumnName('CODE ARTICLE')).toBe('sku');
        expect(mapColumnName('code_article')).toBe('sku');
      });

      it('should map other SKU aliases', () => {
        expect(mapColumnName('sku')).toBe('sku');
        expect(mapColumnName('code')).toBe('sku');
        expect(mapColumnName('ref')).toBe('sku');
      });
    });

    describe('Name mapping', () => {
      it('should map "Libelle Article" to "name"', () => {
        expect(mapColumnName('Libelle Article')).toBe('name');
        expect(mapColumnName('LIBELLE ARTICLE')).toBe('name');
      });

      it('should map other name aliases', () => {
        expect(mapColumnName('name')).toBe('name');
        expect(mapColumnName('nom')).toBe('name');
        expect(mapColumnName('libelle')).toBe('name');
        expect(mapColumnName('designation')).toBe('name');
        expect(mapColumnName('Designation')).toBe('name');
      });
    });

    describe('Family mapping', () => {
      it('should map "Famille" to "family"', () => {
        expect(mapColumnName('Famille')).toBe('family');
        expect(mapColumnName('FAMILLE')).toBe('family');
      });

      it('should map other family aliases', () => {
        expect(mapColumnName('family')).toBe('family');
        expect(mapColumnName('categorie')).toBe('family');
        expect(mapColumnName('category')).toBe('family');
      });
    });

    describe('Article Type mapping', () => {
      it('should map "Article" to "article_type"', () => {
        expect(mapColumnName('Article')).toBe('article_type');
        expect(mapColumnName('ARTICLE')).toBe('article_type');
      });

      it('should map other article_type aliases', () => {
        expect(mapColumnName('article_type')).toBe('article_type');
        expect(mapColumnName('type')).toBe('article_type');
        expect(mapColumnName('type article')).toBe('article_type');
        expect(mapColumnName('sous categorie')).toBe('article_type');
      });
    });

    describe('Brand mapping', () => {
      it('should map "Marque" to "brand"', () => {
        expect(mapColumnName('Marque')).toBe('brand');
        expect(mapColumnName('MARQUE')).toBe('brand');
      });

      it('should map other brand aliases', () => {
        expect(mapColumnName('brand')).toBe('brand');
        expect(mapColumnName('fabricant')).toBe('brand');
      });
    });

    describe('Reference mapping', () => {
      it('should map "Reference (Serie)" to "reference"', () => {
        expect(mapColumnName('Reference (Serie)')).toBe('reference');
        expect(mapColumnName('REFERENCE (SERIE)')).toBe('reference');
      });

      it('should map other reference aliases', () => {
        expect(mapColumnName('reference')).toBe('reference');
        expect(mapColumnName('serie')).toBe('reference');
        expect(mapColumnName('modele')).toBe('reference');
      });
    });

    describe('Price mapping', () => {
      it('should map French price columns', () => {
        expect(mapColumnName('Prix Achat')).toBe('cost_price');
        expect(mapColumnName('prix_achat')).toBe('cost_price');
        expect(mapColumnName("prix d'achat")).toBe('cost_price');
        expect(mapColumnName('PA')).toBe('cost_price');
      });

      it('should map sell price columns', () => {
        expect(mapColumnName('Prix Vente')).toBe('sell_price');
        expect(mapColumnName('prix_vente')).toBe('sell_price');
        expect(mapColumnName('prix de vente')).toBe('sell_price');
        expect(mapColumnName('PV')).toBe('sell_price');
      });
    });

    describe('Unknown columns', () => {
      it('should return normalized name for unknown columns', () => {
        expect(mapColumnName('Custom Column')).toBe('custom column');
        expect(mapColumnName('SOME_FIELD')).toBe('some_field');
      });
    });
  });

  describe('Constants', () => {
    it('should have required columns defined', () => {
      expect(REQUIRED_COLUMNS).toContain('sku');
      expect(REQUIRED_COLUMNS).toContain('name');
    });

    it('should have default values for prices', () => {
      expect(DEFAULT_VALUES.cost_price).toBe(0);
      expect(DEFAULT_VALUES.sell_price).toBe(0);
      expect(DEFAULT_VALUES.unit).toBe('unit');
      expect(DEFAULT_VALUES.alert_threshold).toBe(5);
    });
  });

  describe('COLUMN_ALIASES coverage', () => {
    it('should have all expected French column aliases', () => {
      const frenchColumns = [
        'famille',
        'article',
        'marque',
        'reference',
        'code article',
        'libelle article',
        'prix achat',
        'prix vente',
      ];

      for (const col of frenchColumns) {
        expect(COLUMN_ALIASES[col]).toBeDefined();
      }
    });

    it('should have all expected English column aliases', () => {
      const englishColumns = [
        'sku',
        'name',
        'family',
        'article_type',
        'brand',
        'reference',
        'cost_price',
        'sell_price',
      ];

      for (const col of englishColumns) {
        expect(COLUMN_ALIASES[col]).toBeDefined();
      }
    });
  });
});
