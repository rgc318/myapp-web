export type AiProductPrice = {
  rowId?: string;
  priceList?: string;
  rate?: number;
  uom?: string;
  uomDisplay?: string;
  currency?: string;
  interpretation?: string;
  evidence?: string;
};
export type AiProductUomRelation = {
  fromUom?: string;
  fromQty?: number;
  toUom?: string;
  toQty?: number;
  evidence?: string;
};
const text = (v: unknown) => (typeof v === 'string' ? v : undefined);
const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((r) => r && typeof r === 'object') : [];

export function readAiProductPricing(payload: Record<string, unknown>) {
  if (payload.pricing_contract_version !== 'product-pricing-v1')
    return undefined;
  return {
    productPrices: rows(payload.prices).map(
      (r): AiProductPrice => ({
        rowId: text(r.row_id),
        priceList: text(r.price_list),
        rate: number(r.rate),
        uom: text(r.uom),
        uomDisplay: text(r.uom_display),
        currency: text(r.currency),
        interpretation: text(r.interpretation),
        evidence: text(r.evidence),
      }),
    ),
    productUomRelations: rows(payload.uom_relations).map(
      (r): AiProductUomRelation => ({
        fromUom: text(r.from_uom),
        fromQty: number(r.from_qty),
        toUom: text(r.to_uom),
        toQty: number(r.to_qty),
        evidence: text(r.evidence),
      }),
    ),
    wholesaleDefaultUom: text(payload.wholesale_default_uom),
    retailDefaultUom: text(payload.retail_default_uom),
  };
}

export function buildAiProductPricing(
  values: {
    productPrices?: AiProductPrice[];
    productUomRelations?: AiProductUomRelation[];
    wholesaleDefaultUom?: string;
    retailDefaultUom?: string;
  },
  original: Record<string, unknown>,
) {
  const previous = readAiProductPricing(original);
  if (!previous) return {};
  return {
    pricing_contract_version: 'product-pricing-v1',
    prices: (values.productPrices ?? []).map((r) => {
      const prior = previous.productPrices.find(
        (p) =>
          (r.rowId && p.rowId === r.rowId) ||
          (p.priceList === r.priceList && p.uom === r.uom),
      );
      const currency = r.currency ?? prior?.currency;
      const unchanged = Boolean(
        prior &&
          prior.priceList === r.priceList &&
          prior.uom === r.uom &&
          prior.rate === r.rate &&
          prior.currency === currency,
      );
      return {
        row_id: r.rowId ?? prior?.rowId,
        price_list: r.priceList,
        rate: r.rate ?? null,
        uom: r.uom,
        currency,
        interpretation: unchanged ? prior?.interpretation : 'user',
        evidence: unchanged ? prior?.evidence : '用户编辑确认',
      };
    }),
    uom_relations: (values.productUomRelations ?? []).map((r) => ({
      from_uom: r.fromUom,
      from_qty: r.fromQty ?? null,
      to_uom: r.toUom,
      to_qty: r.toQty ?? null,
      evidence: r.evidence,
    })),
    wholesale_default_uom: values.wholesaleDefaultUom,
    retail_default_uom: values.retailDefaultUom,
  };
}
