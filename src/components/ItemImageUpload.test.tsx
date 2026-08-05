import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import {
  deleteItemImage,
  replaceItemImage,
  uploadItemImage,
} from '@/services/myapp/media';
import { ItemImageUpload } from './ItemImageUpload';

jest.mock('./ImageEditorUpload', () => ({
  ImageEditorUpload: ({
    children,
    onPrepared,
  }: {
    children: unknown;
    onPrepared: (value: unknown) => Promise<void>;
  }) => (
    <div>
      {children as string}
      <input
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void onPrepared({
            aspectRatio: 1.5,
            file,
            height: 1067,
            mimeType: file.type,
            originalHeight: 800,
            originalSize: file.size,
            originalWidth: 1200,
            profile: 'item-flexible-v2',
            width: 1600,
          });
        }}
      />
    </div>
  ),
}));

jest.mock('@/services/myapp/media', () => ({
  deleteItemImage: jest.fn(),
  replaceItemImage: jest.fn(),
  uploadItemImage: jest.fn(),
}));

jest.mock('@/services/myapp/media-url', () => ({
  resolveMediaUrl: (value?: string) =>
    value?.startsWith('/') ? `http://api.example.test${value}` : (value ?? ''),
}));

const uploaded = {
  attachedToDoctype: null,
  attachedToName: null,
  fileId: 'FILE-1',
  fileName: 'item.png',
  fileUrl: '/files/item.png',
  isPrivate: false,
  previewUrl: 'http://api.example.test/files/item.png',
  storageProvider: 'frappe_file',
};

function selectImage(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('upload input missing');
  fireEvent.change(input, {
    target: {
      files: [new File(['image'], 'item.webp', { type: 'image/webp' })],
    },
  });
}

describe('ItemImageUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (uploadItemImage as jest.Mock).mockResolvedValue(uploaded);
    (replaceItemImage as jest.Mock).mockResolvedValue(uploaded);
    (deleteItemImage as jest.Mock).mockResolvedValue({ deleted: true });
  });

  it('stages an edit image without changing the formal Item immediately', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <ItemImageUpload
        itemCode="ITEM-001"
        onChange={onChange}
        value="http://api.example.test/files/old.png"
      />,
    );

    selectImage(container);

    await waitFor(() => expect(uploadItemImage).toHaveBeenCalledTimes(1));
    expect(replaceItemImage).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('/files/item.png');
  });

  it('keeps immediate replacement available for explicit image actions', async () => {
    const { container } = render(
      <ItemImageUpload commitMode="immediate" itemCode="ITEM-001" />,
    );

    selectImage(container);

    await waitFor(() => expect(replaceItemImage).toHaveBeenCalledTimes(1));
    expect(uploadItemImage).not.toHaveBeenCalled();
  });

  it('labels an empty existing item as an upload action', () => {
    render(<ItemImageUpload commitMode="immediate" itemCode="ITEM-001" />);

    expect(screen.getByRole('button', { name: /上传图片/ })).toBeTruthy();
  });

  it('only clears the staged form value when deleting in staged mode', () => {
    const onChange = jest.fn();
    render(
      <ItemImageUpload
        itemCode="ITEM-001"
        onChange={onChange}
        value="http://api.example.test/files/old.png"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /删除图片/ }));

    expect(deleteItemImage).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('resolves a staged relative file URL against the API origin', () => {
    render(<ItemImageUpload value="/files/staged.png" />);

    expect(
      screen.getByRole('img', { name: '商品图片' }).getAttribute('src'),
    ).toBe('http://api.example.test/files/staged.png');
  });
});
