import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { CameraCaptureModal } from './CameraCaptureModal';

describe('CameraCaptureModal', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalSecureContext = window.isSecureContext;
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecureContext,
    });
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    jest.clearAllMocks();
  });

  it('captures a camera frame and returns a file for image editing', async () => {
    const stop = jest.fn();
    const stream = {
      getTracks: () => [{ stop }],
      getVideoTracks: () => [
        { getSettings: () => ({ deviceId: 'external-camera' }), stop },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([
          {
            deviceId: 'external-camera',
            kind: 'videoinput',
            label: 'USB Camera',
          },
        ]),
        getUserMedia: jest.fn().mockResolvedValue(stream),
      },
    });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = jest.fn((callback) => {
      callback(new Blob(['photo'], { type: 'image/jpeg' }));
    });
    URL.createObjectURL = jest.fn(() => 'blob:captured-photo');
    URL.revokeObjectURL = jest.fn();
    const onCaptured = jest.fn();

    render(
      <CameraCaptureModal onCancel={jest.fn()} onCaptured={onCaptured} open />,
    );

    const video = await screen.findByLabelText('摄像头预览');
    Object.defineProperty(video, 'videoWidth', { value: 1280 });
    Object.defineProperty(video, 'videoHeight', { value: 720 });
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /拍照/ }));

    expect(await screen.findByAltText('拍摄预览')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /使用照片并裁剪/ }));

    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(onCaptured.mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'image/jpeg' }),
    );
    expect(stop).toHaveBeenCalled();
  });
});
