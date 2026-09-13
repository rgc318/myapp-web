import {
  buildAiProductPricing,
  readAiProductPricing,
} from './ai-product-pricing';

const payload = {
  pricing_contract_version: 'product-pricing-v1',
  prices: [
    {
      row_id: 'retail',
      price_list: 'Retail',
      rate: 3.5,
      uom: 'Bottle',
      currency: 'CNY',
      interpretation: 'inferred',
      evidence: '3.5元每瓶',
    },
    {
      row_id: 'standard',
      price_list: 'Standard Selling',
      rate: 30,
      uom: 'Box',
      currency: 'CNY',
      interpretation: 'default',
      evidence: '默认参考',
    },
  ],
  uom_relations: [
    { from_uom: 'Bottle', from_qty: null, to_uom: 'Box', to_qty: 1 },
  ],
  wholesale_default_uom: 'Box',
  retail_default_uom: 'Bottle',
};

describe('AI product pricing DTO', () => {
  it('round trips price units and unresolved packaging without guessing', () => {
    const form = readAiProductPricing(payload);
    if (!form) throw new Error('Expected valid pricing data');
    expect(form.productPrices[0]).toMatchObject({ rate: 3.5, uom: 'Bottle' });
    expect(form.productUomRelations[0].fromQty).toBeUndefined();
    const result = buildAiProductPricing(form, payload);
    expect(result.prices).toEqual(payload.prices);
    expect(result.uom_relations?.[0]).toMatchObject({
      from_qty: null,
      to_qty: 1,
    });
  });
  it('marks edited default prices as user decisions while preserving unchanged provenance', () => {
    const form = readAiProductPricing(payload);
    if (!form) throw new Error('Expected valid pricing data');
    form.productPrices[1].rate = 40;
    const result = buildAiProductPricing(form, payload);
    expect(result.prices?.[0].interpretation).toBe('inferred');
    expect(result.prices?.[1]).toMatchObject({
      rate: 40,
      interpretation: 'user',
    });
  });
  it('keeps legacy drafts on their existing contract', () => {
    expect(readAiProductPricing({ retail_rate: 3.5 })).toBeUndefined();
    expect(buildAiProductPricing({}, {})).toEqual({});
  });
});
