import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from 'antd';
import * as React from 'react';
import { ITEM_IMAGE_EDIT_PROFILE } from '@/utils/image-processing';
import { ImageEditorUpload } from './ImageEditorUpload';

const mockCropperApi = {
  destroy: jest.fn(),
  getCroppedCanvas: jest.fn(),
  getData: jest.fn(() => ({ height: 300, width: 400 })),
  getImageData: jest.fn(() => ({ naturalWidth: 1200, width: 600 })),
  reset: jest.fn(),
  rotate: jest.fn(),
  setAspectRatio: jest.fn(),
  zoomTo: jest.fn(),
};
const mockCropperConstructor = jest.fn(
  (_element: unknown, _options?: unknown) => mockCropperApi,
);

jest.mock('cropperjs', () => ({
  __esModule: true,
  default: function MockCropper(element: unknown, options?: unknown) {
    return mockCropperConstructor(element, options);
  },
}));

describe('ImageEditorUpload', () => {
  const originalFetch = global.fetch;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    jest.clearAllMocks();
  });

  it('loads an existing managed image into the same editor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => new Blob(['image'], { type: 'image/png' }),
      ok: true,
    });
    URL.createObjectURL = jest.fn(() => 'blob:current-image');
    URL.revokeObjectURL = jest.fn();

    render(
      <ImageEditorUpload
        onPrepared={jest.fn()}
        profile={ITEM_IMAGE_EDIT_PROFILE}
        sourceUrl="http://api.example.test/files/current.png"
      >
        <Button>上传图片</Button>
      </ImageEditorUpload>,
    );

    fireEvent.click(screen.getByRole('button', { name: /重新裁剪/ }));

    expect(await screen.findByText('编辑商品图片')).toBeTruthy();
    expect(screen.getByText('16:9')).toBeTruthy();
    expect(screen.getByText('自由')).toBeTruthy();
    expect(screen.getByText(/四边和四角均可调整范围/)).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.example.test/files/current.png',
      { credentials: 'include' },
    );
  });

  it('enables a movable and resizable crop frame', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => new Blob(['image'], { type: 'image/png' }),
      ok: true,
    });
    URL.createObjectURL = jest.fn(() => 'blob:current-image');
    URL.revokeObjectURL = jest.fn();

    render(
      <ImageEditorUpload
        onPrepared={jest.fn()}
        profile={ITEM_IMAGE_EDIT_PROFILE}
        sourceUrl="http://api.example.test/files/current.png"
      >
        <Button>上传图片</Button>
      </ImageEditorUpload>,
    );

    fireEvent.click(screen.getByRole('button', { name: /重新裁剪/ }));
    const image = await screen.findByAltText('待裁剪图片');
    Object.defineProperty(image, 'naturalWidth', { value: 1200 });
    Object.defineProperty(image, 'naturalHeight', { value: 800 });
    fireEvent.load(image);

    expect(mockCropperConstructor).toHaveBeenCalledTimes(1);
    const options = mockCropperConstructor.mock.calls[0][1] as
      | Record<string, unknown>
      | undefined;
    expect(options).toMatchObject({
      cropBoxMovable: true,
      cropBoxResizable: true,
      dragMode: 'move',
      guides: true,
      viewMode: 1,
    });

    fireEvent.click(screen.getByText('自由'));
    expect(mockCropperApi.setAspectRatio).toHaveBeenCalledWith(Number.NaN);
  });
});
