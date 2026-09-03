import type {
  ProductPriceRecord,
  ProductSummary,
} from '@/services/myapp/master-data';

export type ProductQualityAction =
  | 'basic'
  | 'units'
  | 'selling-prices'
  | 'buying-prices'
  | 'barcodes'
  | 'inventory'
  | 'ledger';

export type ProductQualityIssue = {
  action: ProductQualityAction;
  description: string;
  key: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
};

export type ProductQualityAssessment = {
  errorCount: number;
  issues: ProductQualityIssue[];
  status: 'healthy' | 'attention' | 'critical';
  suggestionCount: number;
  warningCount: number;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasPositiveAmount(value: number | null | undefined) {
  return Number(value ?? 0) > 0;
}

function isPriceActive(record: ProductPriceRecord, today: string) {
  if (record.validFrom && record.validFrom > today) return false;
  if (record.validUpto && record.validUpto < today) return false;
  return true;
}

export function assessProductQuality(
  product: ProductSummary,
  options: { prices?: ProductPriceRecord[]; today?: string } = {},
): ProductQualityAssessment {
  const issues: ProductQualityIssue[] = [];
  const totalQty = Number(product.totalQty ?? product.stockQty ?? 0);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const configuredUoms = new Set(
    product.uomConversions
      .filter((row) => hasText(row.uom))
      .map((row) => row.uom),
  );
  const stockConversion = product.uomConversions.find(
    (row) => row.uom === product.stockUom,
  );

  if (!hasText(product.stockUom)) {
    issues.push({
      action: 'units',
      description: '库存基准单位是数量、库存价值和交易换算的基础字段。',
      key: 'stock-uom-missing',
      severity: 'error',
      title: '缺少库存基准单位',
    });
  } else if (
    !stockConversion ||
    Number(stockConversion.conversionFactor) !== 1
  ) {
    issues.push({
      action: 'units',
      description: '库存基准单位必须存在且换算系数为 1，否则数量换算不可信。',
      key: 'stock-uom-conversion',
      severity: 'error',
      title: '库存基准单位换算异常',
    });
  }

  const duplicateUoms = product.uomConversions
    .map((row) => row.uom)
    .filter((uom, index, rows) => rows.indexOf(uom) !== index);
  if (duplicateUoms.length) {
    issues.push({
      action: 'units',
      description: `同一商品单位不能重复配置：${Array.from(new Set(duplicateUoms)).join('、')}。`,
      key: 'duplicate-uoms',
      severity: 'error',
      title: '存在重复单位换算',
    });
  }
  if (
    product.uomConversions.some(
      (row) =>
        !Number.isFinite(Number(row.conversionFactor)) ||
        Number(row.conversionFactor) <= 0,
    )
  ) {
    issues.push({
      action: 'units',
      description: '所有商品单位的换算系数都必须是大于 0 的有效数字。',
      key: 'invalid-uom-factor',
      severity: 'error',
      title: '存在无效换算系数',
    });
  }

  for (const [modeCode, modeLabel, uom] of [
    ['wholesale', '批发', product.wholesaleDefaultUom],
    ['retail', '零售', product.retailDefaultUom],
  ] as const) {
    if (uom && !configuredUoms.has(uom)) {
      issues.push({
        action: 'units',
        description: `${modeLabel}默认单位 ${uom} 不在当前商品换算表中。`,
        key: `${modeCode}-default-uom`,
        severity: 'error',
        title: `${modeLabel}默认单位不可用`,
      });
    }
  }

  if (!hasText(product.itemGroup)) {
    issues.push({
      action: 'basic',
      description: '商品分类缺失会影响权限、筛选和经营分析口径。',
      key: 'item-group',
      severity: 'warning',
      title: '未维护商品分类',
    });
  }
  if (totalQty < 0) {
    issues.push({
      action: 'ledger',
      description: '负库存会影响可售数量、成本和毛利，应优先核对库存流水。',
      key: 'negative-stock',
      severity: 'error',
      title: '存在负库存',
    });
  } else if (product.disabled && totalQty > 0) {
    issues.push({
      action: 'inventory',
      description: '停用商品仍有库存，建议确认清仓、调拨或重新启用方案。',
      key: 'disabled-with-stock',
      severity: 'warning',
      title: '停用商品仍有库存',
    });
  }

  const barcodeWithoutUom = product.barcodes.filter((row) => !hasText(row.uom));
  const barcodeWithInvalidUom = product.barcodes.filter(
    (row) => row.uom && !configuredUoms.has(row.uom),
  );
  if (barcodeWithInvalidUom.length) {
    issues.push({
      action: 'barcodes',
      description: '部分条码绑定了商品换算表之外的单位，扫码数量语义不可信。',
      key: 'barcode-invalid-uom',
      severity: 'error',
      title: '条码单位不可用',
    });
  } else if (barcodeWithoutUom.length) {
    issues.push({
      action: 'barcodes',
      description:
        '历史条码缺少对应单位，建议明确它代表件码、箱码或其他包装码。',
      key: 'barcode-missing-uom',
      severity: 'warning',
      title: '条码单位不明确',
    });
  } else if (!product.barcodes.length) {
    issues.push({
      action: 'barcodes',
      description: '条码不是建档必填项；如业务使用扫码，可后续维护件码或箱码。',
      key: 'barcode-optional',
      severity: 'info',
      title: '尚未维护条码（可选）',
    });
  }

  const activePrices = (options.prices ?? []).filter((price) =>
    isPriceActive(price, today),
  );
  for (const [priceType, action, label] of [
    ['selling', 'selling-prices', '销售'],
    ['buying', 'buying-prices', '采购'],
  ] as const) {
    const relevantPrices = activePrices.filter(
      (price) =>
        price.priceListType === priceType || price.priceListType === 'both',
    );
    const invalidUomPrices = relevantPrices.filter(
      (price) => price.uom && !configuredUoms.has(price.uom),
    );
    const missingUomPrices = relevantPrices.filter(
      (price) => !hasText(price.uom),
    );
    if (invalidUomPrices.length) {
      issues.push({
        action,
        description: `部分有效${label}价格绑定了商品换算表之外的单位，应新增正确价格并终止错误记录。`,
        key: `${priceType}-price-invalid-uom`,
        severity: 'error',
        title: `${label}价格单位不可用`,
      });
    } else if (missingUomPrices.length) {
      issues.push({
        action,
        description: `部分历史有效${label}价格没有明确单位，无法区分件价、箱价或其他包装价。`,
        key: `${priceType}-price-missing-uom`,
        severity: 'warning',
        title: `${label}价格单位不明确`,
      });
    }
  }

  const hasSellingPrice = options.prices
    ? activePrices.some(
        (price) =>
          price.priceListType === 'selling' || price.priceListType === 'both',
      )
    : Boolean(product.priceSummary?.sellingPrices?.length) ||
      hasPositiveAmount(product.priceSummary?.standardSellingRate) ||
      hasPositiveAmount(product.priceSummary?.wholesaleRate) ||
      hasPositiveAmount(product.priceSummary?.retailRate);
  if (product.isSalesItem !== false && !hasSellingPrice) {
    issues.push({
      action: 'selling-prices',
      description:
        '销售价格可以在订单中人工输入，并非商品建档必填；维护价目表可提高报价一致性。',
      key: 'selling-price-optional',
      severity: 'info',
      title: '尚未维护销售价格（可选）',
    });
  }

  const hasBuyingPrice = options.prices
    ? activePrices.some(
        (price) =>
          price.priceListType === 'buying' || price.priceListType === 'both',
      )
    : Boolean(product.priceSummary?.buyingPrices?.length) ||
      hasPositiveAmount(product.priceSummary?.standardBuyingRate);
  if (product.isPurchaseItem !== false && !hasBuyingPrice) {
    issues.push({
      action: 'buying-prices',
      description:
        '采购价格可来自供应商报价或采购单，并非商品建档必填；标准采购价只作为录单参考。',
      key: 'buying-price-optional',
      severity: 'info',
      title: '尚未维护采购参考价（可选）',
    });
  }

  if (!hasText(product.imageUrl)) {
    issues.push({
      action: 'basic',
      description: '图片不是业务必填项；维护后可提高选品和现场识别效率。',
      key: 'image-optional',
      severity: 'info',
      title: '尚未维护商品图片（可选）',
    });
  }
  if (!hasText(product.brand)) {
    issues.push({
      action: 'basic',
      description: '品牌不是业务必填项；需要按品牌分析或采购时可补充。',
      key: 'brand-optional',
      severity: 'info',
      title: '尚未维护品牌（可选）',
    });
  }
  if (!hasText(product.description) && !hasText(product.specification)) {
    issues.push({
      action: 'basic',
      description:
        '描述和规格不是必填项；同名多规格商品较多时建议至少维护规格。',
      key: 'description-optional',
      severity: 'info',
      title: '尚未维护描述或规格（可选）',
    });
  }

  const severityOrder = { error: 0, warning: 1, info: 2 } as const;
  issues.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity],
  );
  const errorCount = issues.filter(
    (issue) => issue.severity === 'error',
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === 'warning',
  ).length;
  const suggestionCount = issues.filter(
    (issue) => issue.severity === 'info',
  ).length;
  return {
    errorCount,
    issues,
    status: errorCount ? 'critical' : warningCount ? 'attention' : 'healthy',
    suggestionCount,
    warningCount,
  };
}
