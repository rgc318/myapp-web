import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from 'antd';
import React from 'react';
import { ITEM_IMAGE_EDIT_PROFILE } from '@/utils/image-processing';
import { ImageEditorUpload } from './ImageEditorUpload';

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
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.example.test/files/current.png',
      { credentials: 'include' },
    );
  });
});
