import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI workspace readability', () => {
  it('keeps long markdown, code and tables inside the message column', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/AI/styles.ts'),
      'utf8',
    );

    expect(source).toMatch(
      /markdown: css`[\s\S]*?max-width: 80ch;[\s\S]*?overflow-wrap: anywhere;/,
    );
    expect(source).toMatch(
      /markdown: css`[\s\S]*?pre \{[\s\S]*?overflow-x: auto;/,
    );
    expect(source).toMatch(
      /markdown: css`[\s\S]*?table \{[\s\S]*?overflow-x: auto;/,
    );
  });

  it('uses a sparse ordinary watermark and stronger high-risk watermark', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app.tsx'), 'utf8');

    expect(source).toContain("fontColor: 'rgba(15, 23, 42, 0.045)'");
    expect(source).toContain('gapX: 300');
    expect(source).toContain("fontColor: 'rgba(15, 23, 42, 0.13)'");
    expect(source).toContain("pathname.startsWith('/administration/ai/audit')");
    expect(source).toContain("pathname.startsWith('/printing/preview')");
  });
});
