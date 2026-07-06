import {
  isValidPhone,
  normalizePhoneInput,
  validatePhoneValue,
} from '../phone-validation';

describe('phone-validation', () => {
  it('keeps only digits and limits length', () => {
    expect(normalizePhoneInput(' +86 138-0000-0000 ext.1234567890')).toBe(
      '86138000000001234567',
    );
  });

  it('allows empty optional phone values', () => {
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone(undefined)).toBe(true);
  });

  it('validates digit-only phone length', () => {
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('123456')).toBe(true);
    expect(isValidPhone('12345678901234567890')).toBe(true);
  });

  it('rejects invalid values through form validator', async () => {
    await expect(validatePhoneValue(null, '12345')).rejects.toThrow(
      '联系电话只能输入',
    );
    await expect(
      validatePhoneValue(null, '13800000000'),
    ).resolves.toBeUndefined();
  });
});
