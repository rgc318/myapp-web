import React from 'react';
import {
  resolvePriceListDisplay,
  resolvePriceListOptionLabel,
} from '@/utils/price-list-display';

export function PriceListName({
  code,
  showCode = false,
}: {
  code: string | null | undefined;
  showCode?: boolean;
}) {
  const display = showCode
    ? resolvePriceListOptionLabel(code)
    : resolvePriceListDisplay(code);
  const normalizedCode = code?.trim();

  return (
    <span
      style={{
        overflowWrap: 'normal',
        whiteSpace: 'nowrap',
        wordBreak: 'keep-all',
      }}
      title={
        normalizedCode && display !== normalizedCode
          ? `系统标识：${normalizedCode}`
          : undefined
      }
    >
      {display}
    </span>
  );
}
