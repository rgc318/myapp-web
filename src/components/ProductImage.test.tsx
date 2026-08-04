import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ProductImage } from './ProductImage';

describe('ProductImage', () => {
  it('shows a discoverable placeholder when the product has no image', () => {
    render(<ProductImage alt="测试商品" height={64} width={64} />);

    expect(screen.getByRole('img', { name: '测试商品：无图' })).toBeTruthy();
    expect(screen.getByText('无图')).toBeTruthy();
  });

  it('falls back to the placeholder when the image cannot be loaded', () => {
    render(
      <ProductImage alt="测试商品" height={64} src="/missing.png" width={64} />,
    );

    fireEvent.error(screen.getByRole('img', { name: '测试商品' }));

    expect(screen.getByRole('img', { name: '测试商品：无图' })).toBeTruthy();
  });
});
