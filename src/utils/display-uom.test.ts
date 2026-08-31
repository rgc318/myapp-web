import {
  formatDisplayUom,
  resolveDisplayUom,
  sortUomsByBusinessPriority,
} from './display-uom';

describe('display-uom', () => {
  it('keeps Box, Case, and Carton labels distinct', () => {
    expect(formatDisplayUom('Box')).toBe('箱');
    expect(formatDisplayUom('Case')).toBe('箱装');
    expect(formatDisplayUom('Carton')).toBe('纸箱');
  });

  it('does not reuse a stale ambiguous 箱 display for legacy codes', () => {
    expect(resolveDisplayUom('Case', '箱')).toBe('箱装');
    expect(resolveDisplayUom('Carton', '箱')).toBe('纸箱');
  });

  it('continues prioritizing Box and Nos in business selectors', () => {
    const values = [
      { displayName: '纸箱', name: 'Carton' },
      { displayName: '件', name: 'Nos' },
      { displayName: '箱', name: 'Box' },
    ];

    expect(
      sortUomsByBusinessPriority(
        values,
        (value) => value.name,
        (value) => value.displayName,
      ).map((value) => value.name),
    ).toEqual(['Box', 'Nos', 'Carton']);
  });
});
