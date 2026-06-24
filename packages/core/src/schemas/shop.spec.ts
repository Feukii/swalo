import {
  SHOP_CODE_REGEX,
  SHOP_CODE_MIN_LENGTH,
  SHOP_CODE_MAX_LENGTH,
  normalizeShopCode,
  Shop,
} from './shop';

describe('Shop code policy', () => {
  describe('normalizeShopCode', () => {
    it('uppercases lowercase input', () => {
      expect(normalizeShopCode('btq01')).toBe('BTQ01');
    });

    it('trims surrounding whitespace', () => {
      expect(normalizeShopCode('  abc12  ')).toBe('ABC12');
    });

    it('is idempotent on already-normalized input', () => {
      expect(normalizeShopCode('ABC12')).toBe('ABC12');
      expect(normalizeShopCode(normalizeShopCode('abc12'))).toBe('ABC12');
    });

    it('keeps numeric-only codes unchanged (legacy codes remain valid)', () => {
      expect(normalizeShopCode('123456')).toBe('123456');
    });
  });

  describe('SHOP_CODE_REGEX', () => {
    it('accepts uppercase alphanumeric', () => {
      expect(SHOP_CODE_REGEX.test('BTQ01')).toBe(true);
    });

    it('accepts numeric-only (legacy numeric codes)', () => {
      expect(SHOP_CODE_REGEX.test('123456')).toBe(true);
    });

    it('rejects lowercase letters', () => {
      expect(SHOP_CODE_REGEX.test('btq01')).toBe(false);
    });

    it('rejects the hyphen (protects invoice number parsing)', () => {
      expect(SHOP_CODE_REGEX.test('BTQ-1')).toBe(false);
    });

    it('rejects other special characters and spaces', () => {
      expect(SHOP_CODE_REGEX.test('BTQ 1')).toBe(false);
      expect(SHOP_CODE_REGEX.test('BTQ_1')).toBe(false);
      expect(SHOP_CODE_REGEX.test('BTQ@1')).toBe(false);
    });
  });

  describe('length bounds', () => {
    it('exposes 4..10 bounds', () => {
      expect(SHOP_CODE_MIN_LENGTH).toBe(4);
      expect(SHOP_CODE_MAX_LENGTH).toBe(10);
    });
  });

  describe('Shop schema code field', () => {
    // On valide directement le champ `code` du schéma (isolé des champs de sync).
    const codeSchema = Shop.shape.code;

    it('accepts a valid alphanumeric uppercase code', () => {
      expect(codeSchema.safeParse('BTQ01').success).toBe(true);
    });

    it('accepts a legacy numeric code', () => {
      expect(codeSchema.safeParse('123456').success).toBe(true);
    });

    it('rejects a too-short code (< 4)', () => {
      expect(codeSchema.safeParse('AB1').success).toBe(false);
    });

    it('rejects a too-long code (> 10)', () => {
      expect(codeSchema.safeParse('ABCDEFGHIJK').success).toBe(false);
    });

    it('rejects lowercase and hyphenated codes', () => {
      expect(codeSchema.safeParse('btq01').success).toBe(false);
      expect(codeSchema.safeParse('BTQ-01').success).toBe(false);
    });
  });
});
