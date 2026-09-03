import {
  resolvePriceListDisplay,
  resolvePriceListOptionLabel,
  resolvePriceListReferenceDisplay,
} from '../price-list-display';

describe('price list display', () => {
  it('localizes governed price lists without changing their stable codes', () => {
    expect(resolvePriceListDisplay('Standard Selling')).toBe('标准销售');
    expect(resolvePriceListDisplay('Standard Buying')).toBe('标准采购');
    expect(resolvePriceListDisplay('Wholesale')).toBe('批发');
    expect(resolvePriceListDisplay('Retail')).toBe('零售');
    expect(resolvePriceListOptionLabel('Standard Selling')).toBe(
      '标准销售（Standard Selling）',
    );
    expect(resolvePriceListReferenceDisplay('Standard Selling · 件')).toBe(
      '标准销售 · 件',
    );
  });

  it('supports traditional Chinese and preserves custom price list names', () => {
    expect(resolvePriceListDisplay('Standard Buying', 'zh-TW')).toBe(
      '標準採購',
    );
    expect(resolvePriceListDisplay('VIP 2026')).toBe('VIP 2026');
    expect(resolvePriceListReferenceDisplay('VIP 2026 · 件')).toBe(
      'VIP 2026 · 件',
    );
    expect(resolvePriceListDisplay('Retail', 'en-US')).toBe('Retail');
  });
});
