import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import React from 'react';
import { ProductUomFields } from './ProductUomFields';

jest.mock('./UomSelect', () => ({
  UomSelect: ({ disabled, onChange, value }: any) => {
    const React = jest.requireActual('react');
    return React.createElement(
      'select',
      {
        'data-testid': 'uom-select',
        disabled,
        onChange: (event: { target: { value: string } }) =>
          onChange?.(event.target.value),
        value: value || '',
      },
      React.createElement('option', { value: '' }, '选择单位'),
      React.createElement('option', { value: 'Box' }, '箱'),
      React.createElement('option', { value: 'Bottle' }, '瓶'),
      React.createElement(
        'option',
        { value: 'Wavelength In Megametres' },
        'Wavelength In Megametres',
      ),
    );
  },
}));

function TestForm() {
  const [form] = Form.useForm();
  return React.createElement(
    Form,
    {
      form,
      initialValues: {
        retailDefaultUom: 'Wavelength In Megametres',
        stockUom: 'Box',
        uomConversions: [
          { conversionFactor: 1, uom: 'Box' },
          { conversionFactor: 1, uom: 'Box' },
          { conversionFactor: 1, uom: 'Box' },
        ],
        wholesaleDefaultUom: 'Box',
      },
    },
    React.createElement(ProductUomFields, { form }),
  );
}

describe('ProductUomFields', () => {
  it('locks only the canonical stock-UOM row when duplicate rows use the same unit', () => {
    render(React.createElement(TestForm));

    const [stockUomSelect, canonicalRow, duplicateRow1, duplicateRow2] =
      screen.getAllByTestId<HTMLSelectElement>('uom-select');

    expect(stockUomSelect.disabled).toBe(false);
    expect(canonicalRow.disabled).toBe(true);
    expect(duplicateRow1.disabled).toBe(false);
    expect(duplicateRow2.disabled).toBe(false);

    const [canonicalRemove, duplicateRemove1, duplicateRemove2, addButton] =
      Array.from(document.querySelectorAll('button'));
    expect(canonicalRemove.disabled).toBe(true);
    expect(duplicateRemove1.disabled).toBe(false);
    expect(duplicateRemove2.disabled).toBe(false);
    expect(addButton.disabled).toBe(false);

    fireEvent.change(duplicateRow1, { target: { value: 'Bottle' } });
    expect(duplicateRow1.value).toBe('Bottle');
  });
});
