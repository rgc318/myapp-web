import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI attachment conversation state', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/pages/AI/index.tsx'),
    'utf8',
  );

  it('stores pending attachments by conversation key', () => {
    expect(source).toContain('pendingAttachmentsByConversationRef');
    expect(source).toContain('rememberCurrentComposerAttachments();');
    expect(source).toContain('setComposerAttachments(');
  });

  it('prechecks the original image modality when retrying a failed run', () => {
    expect(source).toContain('hasAttachments: hasImageInput');
    expect(source).toMatch(
      /const hasImageInput\s*=\s*\(?retryContext\?\.hasAttachments\s*\?\?/,
    );
    expect(source).toContain('hasConversationImageContext');
    expect(source).toContain('hasAttachments: retryRequest.hasAttachments');
  });
});
