import {
  buildOutputFilename,
  clampImageAspect,
  getOutputDimensions,
  ITEM_IMAGE_EDIT_PROFILE,
  validateCropAspect,
  validateImageDimensions,
  validateImageSource,
} from './image-processing';

describe('image processing policy', () => {
  it('uses the canonical product profile', () => {
    expect(ITEM_IMAGE_EDIT_PROFILE).toMatchObject({
      outputHeight: 1600,
      outputMimeType: 'image/webp',
      outputWidth: 1600,
      profile: 'item-flexible-v2',
      preserveAspect: true,
    });
    expect(
      ITEM_IMAGE_EDIT_PROFILE.aspectPresets?.map(({ label }) => label),
    ).toEqual(['1:1', '4:3', '3:2', '16:9']);
  });

  it('calculates bounded output dimensions for preset and free ratios', () => {
    expect(getOutputDimensions(ITEM_IMAGE_EDIT_PROFILE, 16 / 9)).toEqual({
      height: 900,
      width: 1600,
    });
    expect(getOutputDimensions(ITEM_IMAGE_EDIT_PROFILE, 3 / 4)).toEqual({
      height: 1600,
      width: 1200,
    });
    expect(clampImageAspect(5, ITEM_IMAGE_EDIT_PROFILE)).toBe(2.5);
    expect(clampImageAspect(0.1, ITEM_IMAGE_EDIT_PROFILE)).toBe(0.4);
  });

  it('rejects crop frames outside the governed free-aspect range', () => {
    expect(validateCropAspect(4 / 3, ITEM_IMAGE_EDIT_PROFILE)).toBe(4 / 3);
    expect(() => validateCropAspect(3, ITEM_IMAGE_EDIT_PROFILE)).toThrow(
      '0.40:1 到 2.50:1',
    );
    expect(() => validateCropAspect(0.2, ITEM_IMAGE_EDIT_PROFILE)).toThrow(
      '0.40:1 到 2.50:1',
    );
  });

  it('rejects unsupported and oversized source files', () => {
    expect(() =>
      validateImageSource(
        new File(['x'], 'animated.gif', { type: 'image/gif' }),
        ITEM_IMAGE_EDIT_PROFILE,
      ),
    ).toThrow('JPG、PNG 或 WebP');

    const oversized = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 21 * 1024 * 1024 });
    expect(() =>
      validateImageSource(oversized, ITEM_IMAGE_EDIT_PROFILE),
    ).toThrow('20MB');
  });

  it('rejects low-resolution images before opening the editor', () => {
    expect(() =>
      validateImageDimensions(1200, 200, ITEM_IMAGE_EDIT_PROFILE),
    ).toThrow('最短边至少需要 300 像素');
  });

  it('renames the edited file to match its real output format', () => {
    expect(buildOutputFilename('product.final.png', 'image/webp')).toBe(
      'product.final.webp',
    );
  });
});
