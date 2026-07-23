const UOM_BUSINESS_PRIORITY: Record<string, number> = {
  BOX: 0,
  BOXES: 0,
  箱: 0,
  NOS: 1,
  NO: 1,
  PCS: 1,
  PC: 1,
  件: 1,
};

export function getUomBusinessPriority(
  uom: string | null | undefined,
  displayName?: string | null,
) {
  for (const value of [uom, displayName]) {
    const normalized =
      typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized && UOM_BUSINESS_PRIORITY[normalized] !== undefined) {
      return UOM_BUSINESS_PRIORITY[normalized];
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function sortUomsByBusinessPriority<T>(
  values: readonly T[],
  getUom: (value: T) => string | null | undefined,
  getDisplayName?: (value: T) => string | null | undefined,
) {
  return values
    .map((value, index) => ({ index, value }))
    .sort((left, right) => {
      const priorityDifference =
        getUomBusinessPriority(
          getUom(left.value),
          getDisplayName?.(left.value),
        ) -
        getUomBusinessPriority(
          getUom(right.value),
          getDisplayName?.(right.value),
        );
      return priorityDifference || left.index - right.index;
    })
    .map(({ value }) => value);
}

export function formatDisplayUom(uom: string | null | undefined) {
  const normalized = typeof uom === 'string' ? uom.trim() : '';

  if (!normalized) {
    return '件';
  }

  switch (normalized.toUpperCase()) {
    case 'NOS':
    case 'NO':
    case 'PCS':
    case 'PC':
    case 'PIECE':
    case 'PIECES':
      return '件';
    case 'BOX':
    case 'BOXES':
    case 'CASE':
    case 'CASES':
      return '箱';
    case 'BOTTLE':
    case 'BOTTLES':
      return '瓶';
    case 'BAG':
    case 'BAGS':
      return '袋';
    case 'KG':
    case 'KGS':
      return '千克';
    case 'G':
    case 'GRAM':
    case 'GRAMS':
      return '克';
    case 'L':
    case 'LTR':
    case 'LITER':
    case 'LITRE':
      return '升';
    case 'ML':
      return '毫升';
    case 'M':
    case 'METER':
    case 'METRE':
      return '米';
    case 'YARD':
    case 'YD':
    case 'YDS':
      return '码';
    case 'CM':
      return '厘米';
    case 'MM':
      return '毫米';
    case 'SET':
    case 'SETS':
      return '套';
    case 'PACK':
    case 'PACKS':
      return '包';
    case 'ROLL':
    case 'ROLLS':
      return '卷';
    default:
      return normalized;
  }
}

export function resolveDisplayUom(
  uom: string | null | undefined,
  displayName?: string | null,
) {
  const normalizedUom = typeof uom === 'string' ? uom.trim() : '';
  const normalizedDisplayName =
    typeof displayName === 'string' ? displayName.trim() : '';

  if (
    normalizedDisplayName &&
    (!normalizedUom ||
      normalizedDisplayName.toUpperCase() !== normalizedUom.toUpperCase())
  ) {
    return normalizedDisplayName;
  }

  return formatDisplayUom(uom);
}

export function resolveDisplayUomFromMap(
  uom: string | null | undefined,
  displays?: Record<string, string> | null,
  directDisplay?: string | null,
) {
  const normalizedUom = typeof uom === 'string' ? uom.trim() : '';
  return resolveDisplayUom(
    normalizedUom,
    directDisplay || displays?.[normalizedUom],
  );
}
