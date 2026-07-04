import {
  calculateLineAmount,
  formatCurrencyCode,
  formatCurrencyValue,
  formatDisplayUom,
  formatStatusLabel,
  getCurrencyDisplayUnit,
} from '../myapp-display';

describe('myapp display utilities', () => {
  it('formats currency values with mobile-compatible display units', () => {
    expect(getCurrencyDisplayUnit('CNY')).toBe('元');
    expect(getCurrencyDisplayUnit('rmb')).toBe('元');
    expect(getCurrencyDisplayUnit('USD')).toBe('USD');
    expect(formatCurrencyCode('CNY')).toBe('人民币');
    expect(formatCurrencyValue(12, 'CNY')).toBe('12.00 元');
    expect(formatCurrencyValue('12.5', 'USD')).toBe('12.50 USD');
    expect(formatCurrencyValue(null, 'CNY')).toBe('-');
  });

  it('calculates transaction line amounts defensively', () => {
    expect(calculateLineAmount({ price: 12.5, qty: 4 })).toBe(50);
    expect(calculateLineAmount({ price: null, qty: 4 })).toBe(0);
    expect(calculateLineAmount({ price: 12.5, qty: null })).toBe(0);
  });

  it('formats stock uom codes with mobile-compatible labels', () => {
    expect(formatDisplayUom('NOS')).toBe('件');
    expect(formatDisplayUom('PCS')).toBe('件');
    expect(formatDisplayUom('BOX')).toBe('箱');
    expect(formatDisplayUom('KG')).toBe('千克');
    expect(formatDisplayUom('Custom UOM')).toBe('Custom UOM');
  });

  it('formats business status labels in Chinese', () => {
    expect(formatStatusLabel('submitted')).toBe('已提交');
    expect(formatStatusLabel('to_deliver')).toBe('待发货');
    expect(formatStatusLabel('partially_paid')).toBe('部分收款');
    expect(formatStatusLabel('unknown_status')).toBe('unknown_status');
    expect(formatStatusLabel('')).toBe('未知');
  });
});
