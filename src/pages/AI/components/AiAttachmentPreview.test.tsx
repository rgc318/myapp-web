import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { fetchAiAttachmentPreview } from '@/services/myapp/ai';
import { AiAttachmentPreview } from './AiAttachmentPreview';

jest.mock('@/services/myapp/ai', () => ({
  fetchAiAttachmentPreview: jest.fn(),
}));

const mockedFetchPreview = jest.mocked(fetchAiAttachmentPreview);

const attachment = {
  attachmentId: 'AI-ATT-1',
  contentType: 'image/webp',
  filename: '订单图片.webp',
  fileSize: 128,
  height: 200,
  previewUrl: '/private/files/order.webp',
  retentionUntil: null,
  sha256: 'sha256',
  status: 'bound',
  width: 300,
};

describe('AiAttachmentPreview', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    mockedFetchPreview.mockResolvedValue(
      new Blob(['image'], { type: 'image/webp' }),
    );
    URL.createObjectURL = jest.fn(() => 'blob:ai-attachment');
    URL.revokeObjectURL = jest.fn();
  });

  afterAll(() => {
    if (originalCreateObjectUrl) {
      URL.createObjectURL = originalCreateObjectUrl;
    }
    if (originalRevokeObjectUrl) {
      URL.revokeObjectURL = originalRevokeObjectUrl;
    }
  });

  it('renders the authenticated blob and releases it on unmount', async () => {
    const { unmount } = render(
      React.createElement(AiAttachmentPreview, { attachment, size: 88 }),
    );

    await waitFor(() => {
      expect(screen.getByAltText('订单图片.webp').getAttribute('src')).toBe(
        'blob:ai-attachment',
      );
    });
    expect(mockedFetchPreview).toHaveBeenCalledWith(
      '/private/files/order.webp',
    );

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ai-attachment');
  });
});
