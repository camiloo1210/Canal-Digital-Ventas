import { test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recurses through Web app directory to find all TypeScript files.
 */
function getWebFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === 'tests') continue;
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getWebFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(fullPath);
      }
    }
  }
  return arrayOfFiles;
}

test('Frontend Primary Adapter Architectural Constraint', () => {
  const webDir = path.resolve(__dirname, '..');
  const files = getWebFiles(webDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Rule: UI Pages/Actions cannot instantiate Infrastructure Repositories or Use Cases using 'new' bypassing the DI container.
    // Exceptions allowed: ONLY within explicit '.di.ts' and specific configuration files
    if (
      content.includes('new Supabase') &&
      !file.includes('.di.ts') &&
      !file.includes('supabase/server.ts') &&
      !file.includes('lib/storage')
    ) {
      expect.fail(
        `File ${file} instantiated an infrastructure resource directly! Must use DI container.`,
      );
    }

    // Rule: UI cannot import internal transaction managers
    if (content.match(/import.*TransactionManager/)) {
      expect.fail(
        `File ${file} imported TransactionManager. UI must rely strictly on UseCases/Ports.`,
      );
    }

    // Rule: UI Components cannot import Domain Entities directly. They must be mapped to View Models
    // (We permit type imports if necessary for bounds, but typically discourage standard entity importing)
    if (file.includes('/components/') && content.match(/from.*\/domain\/entities/)) {
      expect.fail(
        `Component ${file} imported a Domain Entity directly. Ensure View Models are used for presentation.`,
      );
    }

    // Rule: UI Components cannot import from infrastructure directly
    if (file.includes('/components/') && content.match(/from.*\/infrastructure/)) {
      expect.fail(
        `Component ${file} imported infrastructure directly! Components are pure rendering modules.`,
      );
    }

    // Rule: Server Actions cannot utilize direct database instances
    if (file.includes('.actions.ts') && content.match(/this\.supabase\./)) {
      expect.fail(
        `Server Action ${file} attempted direct database queries. Must rely on Core Use Cases.`,
      );
    }
  }
});
