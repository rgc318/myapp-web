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
