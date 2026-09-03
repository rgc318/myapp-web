import { render, screen } from '@testing-library/react';
import React from 'react';
import { PriceListName } from './PriceListName';

describe('PriceListName', () => {
  const originalLang = document.documentElement.lang;

  afterEach(() => {
    document.documentElement.lang = originalLang;
  });

  it('uses the active locale and prevents narrow tables from wrapping each character', () => {
    document.documentElement.lang = 'zh-CN';
    render(<PriceListName code="Standard Selling" />);

    const label = screen.getByText('标准销售');
    expect(label.getAttribute('title')).toBe('系统标识：Standard Selling');
    expect(label.style.whiteSpace).toBe('nowrap');
    expect(label.style.wordBreak).toBe('keep-all');
  });

  it('falls back to the stable name for unsupported locales and custom lists', () => {
    document.documentElement.lang = 'en-US';
    render(<PriceListName code="VIP 2026" />);

    expect(screen.getByText('VIP 2026')).toBeTruthy();
  });
});
