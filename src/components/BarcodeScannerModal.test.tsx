import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { BarcodeScannerModal } from './BarcodeScannerModal';

const mockStop = jest.fn();
const mockDecodeFromConstraints = jest.fn();
const mockDecodeFromVideoDevice = jest.fn();
const mockListVideoInputDevices = jest.fn();

jest.mock('@zxing/browser', () => ({
  BrowserCodeReader: {
    listVideoInputDevices: (...args: unknown[]) =>
      mockListVideoInputDevices(...args),
  },
  BrowserMultiFormatReader: function MockBrowserMultiFormatReader() {
    return {
      decodeFromConstraints: (...args: unknown[]) =>
        mockDecodeFromConstraints(...args),
      decodeFromVideoDevice: (...args: unknown[]) =>
        mockDecodeFromVideoDevice(...args),
    };
  },
}));

describe('BarcodeScannerModal', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalSecureContext = window.isSecureContext;

  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn() },
    });
    mockDecodeFromConstraints.mockResolvedValue({ stop: mockStop });
    mockDecodeFromVideoDevice.mockResolvedValue({ stop: mockStop });
    mockListVideoInputDevices.mockResolvedValue([]);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecureContext,
    });
    jest.clearAllMocks();
  });

  it('supports manual barcode entry as a camera fallback', async () => {
    const onScanned = jest.fn();
    const onCancel = jest.fn();
    render(
      <BarcodeScannerModal onCancel={onCancel} onScanned={onScanned} open />,
    );

    await waitFor(() => expect(mockDecodeFromConstraints).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('手动输入条码'), {
      target: { value: ' 6901234567890 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '使用条码' }));

    await waitFor(() =>
      expect(onScanned).toHaveBeenCalledWith('6901234567890'),
    );
    expect(onCancel).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it('submits only the first decoded result', async () => {
    let decodeCallback:
      | ((result?: { getText: () => string }) => void)
      | undefined;
    mockDecodeFromConstraints.mockImplementation(
      async (_constraints, _video, callback) => {
        decodeCallback = callback;
        return { stop: mockStop };
      },
    );
    const onScanned = jest.fn();
    render(
      <BarcodeScannerModal onCancel={jest.fn()} onScanned={onScanned} open />,
    );
    await waitFor(() => expect(decodeCallback).toBeDefined());

    decodeCallback?.({ getText: () => 'CODE-001' });
    decodeCallback?.({ getText: () => 'CODE-002' });

    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1));
    expect(onScanned).toHaveBeenCalledWith('CODE-001');
  });
});
