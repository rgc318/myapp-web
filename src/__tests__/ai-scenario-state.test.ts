import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI conversation scenario state', () => {
  it('restores automatic intent detection instead of the last executed scenario', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/AI/index.tsx'),
      'utf8',
    );

    expect(source).toContain("setScenario('auto');");
    expect(source).not.toMatch(/setScenario\(latestScenario\)/);
  });
});
