import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI workspace scroll ownership', () => {
  it('keeps flex ancestors shrinkable and assigns scrolling to Bubble.List', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/AI/styles.ts'),
      'utf8',
    );

    expect(source).toMatch(
      /main: css`[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
    );
    expect(source).toMatch(
      /messages: css`[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
    );
    expect(source).toMatch(
      /> \.ant-bubble-list \{[\s\S]*?height: 100%;[\s\S]*?min-height: 0;/,
    );
    expect(source).toMatch(
      /\.ant-bubble-list-scroll-box \{[\s\S]*?height: 100%;[\s\S]*?overflow-y: auto;/,
    );
    expect(source).toMatch(
      /page: css`[\s\S]*?height: calc\(100dvh - 56px\);[\s\S]*?overflow: hidden;/,
    );
    expect(source).toMatch(
      /> \.ant-pro-grid-content \{[\s\S]*?flex: 1;[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
    );
    expect(source).toMatch(
      /> \.ant-pro-grid-content > \.ant-pro-grid-content-children \{[\s\S]*?flex: 1;[\s\S]*?min-height: 0;/,
    );
    expect(source).toMatch(
      /ant-pro-page-container-children-container[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
    );
  });
});
