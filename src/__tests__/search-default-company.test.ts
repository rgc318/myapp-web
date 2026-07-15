import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SEARCH_SURFACES = [
  'src/components/BusinessDocumentsTablePage.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Finance/index.tsx',
  'src/pages/Inventory/Alerts/index.tsx',
  'src/pages/Inventory/Stock/index.tsx',
  'src/pages/InventoryLedger/index.tsx',
  'src/pages/MasterData/Products/index.tsx',
  'src/pages/Payments/index.tsx',
  'src/pages/PendingConfirmations/index.tsx',
  'src/pages/Purchase/Orders/index.tsx',
  'src/pages/Reports/index.tsx',
  'src/pages/Sales/Orders/index.tsx',
];

function source(file: string) {
  return readFileSync(resolve(process.cwd(), file), 'utf8');
}

describe('search company defaults', () => {
  it.each(
    SEARCH_SURFACES,
  )('%s does not inject workspace default company into queries', (file) => {
    const content = source(file);
    expect(content).not.toContain('useWorkspacePreferences');
    expect(content).not.toMatch(/initialValue:\s*defaultCompany/);
    expect(content).not.toMatch(/company:\s*defaultCompany/);
    expect(content).not.toMatch(/key=.*defaultCompany/);
  });

  it('keeps warehouse creation defaults separate from warehouse list filters', () => {
    const content = source('src/pages/MasterData/Warehouses/index.tsx');
    const listQueryInitializer = content.match(
      /useState<WarehouseListQuery>\(\{([\s\S]*?)\n\s*\}\);/,
    )?.[1];
    expect(content).not.toMatch(/initialValue:\s*defaultCompany/);
    expect(listQueryInitializer).toBeDefined();
    expect(listQueryInitializer).not.toMatch(/company:\s*defaultCompany/);
  });

  it.each([
    'src/pages/Inventory/Stock/Detail.tsx',
    'src/pages/MasterData/Products/Detail.tsx',
  ])('%s only scopes company when it is present in the URL', (file) => {
    const content = source(file);
    expect(content).not.toContain('useWorkspacePreferences');
    expect(content).toContain("query.get('company') || undefined");
  });
});
