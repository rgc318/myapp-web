import {
  compactPayload,
  readPaginationMeta,
  readRows,
  toNumber,
  toOptionalNumber,
  toOptionalText,
  toStringList,
} from '../api-utils';

describe('myapp api utils', () => {
  it('normalizes primitive values', () => {
    expect(toOptionalNumber('12.5')).toBe(12.5);
    expect(toOptionalNumber('bad')).toBeNull();
    expect(toNumber(null, 9)).toBe(9);
    expect(toOptionalText('  abc  ')).toBe('abc');
    expect(toOptionalText('   ')).toBeUndefined();
    expect(toStringList(['A', null, 'B'])).toEqual(['A', 'B']);
  });

  it('compacts payload and reads common list envelopes', () => {
    expect(
      compactPayload({
        a: 'value',
        b: '',
        c: undefined,
        d: null,
        e: 0,
      }),
    ).toEqual({ a: 'value', e: 0 });

    expect(readRows({ data: [{ name: 'A' }] })).toEqual([{ name: 'A' }]);
    expect(readRows({ items: [{ name: 'B' }] })).toEqual([{ name: 'B' }]);
    expect(readRows({ rows: [{ name: 'C' }] })).toEqual([{ name: 'C' }]);
    expect(readPaginationMeta({ meta: { total: 12, has_more: true } })).toEqual(
      {
        hasMore: true,
        total: 12,
      },
    );
  });
});
