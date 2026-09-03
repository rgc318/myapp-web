export type PriceListDisplayLocale = 'en-US' | 'zh-CN' | 'zh-TW';

const PRICE_LIST_LABELS: Record<
  Exclude<PriceListDisplayLocale, 'en-US'>,
  Record<string, string>
> = {
  'zh-CN': {
    Retail: '零售',
    'Standard Buying': '标准采购',
    'Standard Selling': '标准销售',
    Wholesale: '批发',
  },
  'zh-TW': {
    Retail: '零售',
    'Standard Buying': '標準採購',
    'Standard Selling': '標準銷售',
    Wholesale: '批發',
  },
};

function normalizeLocale(locale: string): PriceListDisplayLocale {
  const normalized = locale.replace('_', '-').toLowerCase();
  if (
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (normalized.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

function activeLocale() {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  return 'zh-CN';
}

export function resolvePriceListDisplay(
  priceList: string | null | undefined,
  locale = activeLocale(),
) {
  const code = priceList?.trim();
  if (!code) return '-';
  const resolvedLocale = normalizeLocale(locale);
  if (resolvedLocale === 'en-US') return code;
  return PRICE_LIST_LABELS[resolvedLocale][code] ?? code;
}

export function resolvePriceListOptionLabel(
  priceList: string | null | undefined,
  locale = activeLocale(),
) {
  const code = priceList?.trim();
  if (!code) return '-';
  const display = resolvePriceListDisplay(code, locale);
  return display === code ? code : `${display}（${code}）`;
}

export function resolvePriceListReferenceDisplay(
  value: string | null | undefined,
  locale = activeLocale(),
) {
  const text = value?.trim();
  if (!text) return '-';
  for (const code of [
    'Standard Selling',
    'Standard Buying',
    'Wholesale',
    'Retail',
  ]) {
    if (text === code || text.startsWith(`${code} ·`)) {
      return `${resolvePriceListDisplay(code, locale)}${text.slice(code.length)}`;
    }
  }
  return text;
}
