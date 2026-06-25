import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PinLoginDto, RegisterDto } from './auth.dto';

async function validatePin(shop_code: string): Promise<{ dto: PinLoginDto; errorCount: number }> {
  const dto = plainToInstance(PinLoginDto, {
    shop_code,
    pin_code: '1234',
  });
  const errors = await validate(dto);
  // On ne s'intéresse qu'aux erreurs liées au champ shop_code.
  const shopCodeErrors = errors.filter(e => e.property === 'shop_code');
  return { dto, errorCount: shopCodeErrors.length };
}

describe('PinLoginDto.shop_code', () => {
  it('normalizes lowercase input to uppercase via @Transform', async () => {
    const { dto, errorCount } = await validatePin('btq01');
    expect(dto.shop_code).toBe('BTQ01');
    expect(errorCount).toBe(0);
  });

  it('trims surrounding whitespace', async () => {
    const { dto } = await validatePin('  abc12  ');
    expect(dto.shop_code).toBe('ABC12');
  });

  it('accepts a legacy numeric 6-digit code', async () => {
    const { dto, errorCount } = await validatePin('123456');
    expect(dto.shop_code).toBe('123456');
    expect(errorCount).toBe(0);
  });

  it('rejects a code shorter than 4 characters', async () => {
    const { errorCount } = await validatePin('AB1');
    expect(errorCount).toBeGreaterThan(0);
  });

  it('rejects a code longer than 10 characters', async () => {
    const { errorCount } = await validatePin('ABCDEFGHIJK');
    expect(errorCount).toBeGreaterThan(0);
  });

  it('rejects a hyphenated code (protects invoice number parsing)', async () => {
    const { errorCount } = await validatePin('BTQ-1');
    expect(errorCount).toBeGreaterThan(0);
  });
});

describe('RegisterDto.shop_code', () => {
  it('normalizes and accepts a valid alphanumeric code', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'owner@example.com',
      password: 'password123',
      display_name: 'Owner',
      shop_code: 'shop99',
      shop_name: 'Ma Boutique',
    });
    const errors = await validate(dto);
    expect(dto.shop_code).toBe('SHOP99');
    expect(errors.filter(e => e.property === 'shop_code')).toHaveLength(0);
  });
});
