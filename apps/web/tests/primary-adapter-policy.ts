import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

export function restrictedCoreExports(): ReadonlySet<string> {
  const repositoryRoot = path.resolve(__dirname, '../../..');
  const configPath = path.join(repositoryRoot, 'packages/core/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );
  const cache = new Map<string, Map<string, boolean>>();

  function exportsOf(file: string): Map<string, boolean> {
    const cached = cache.get(file);
    if (cached) return cached;
    const symbols = new Map<string, boolean>();
    cache.set(file, symbols);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const normalized = file.replaceAll('\\', '/');
    const restricted =
      /\/(infrastructure|application\/use-cases|domain\/entities|domain\/value-objects)\//.test(
        normalized,
      ) && !/exception/.test(normalized);
    for (const statement of source.statements) {
      if (
        ts.canHaveModifiers(statement) &&
        ts
          .getModifiers(statement)
          ?.some((modifier): boolean => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        if (
          (ts.isClassDeclaration(statement) ||
            ts.isFunctionDeclaration(statement) ||
            ts.isEnumDeclaration(statement)) &&
          statement.name
        )
          symbols.set(statement.name.text, restricted);
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) symbols.set(declaration.name.text, restricted);
          }
        }
      }
      if (
        !ts.isExportDeclaration(statement) ||
        statement.isTypeOnly ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const resolved = ts.resolveModuleName(
        statement.moduleSpecifier.text,
        file,
        options,
        ts.sys,
      ).resolvedModule;
      if (!resolved) continue;
      const exported = exportsOf(resolved.resolvedFileName);
      if (!statement.exportClause) {
        for (const [name, technical] of exported) symbols.set(name, technical);
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const technical = exported.get((element.propertyName ?? element.name).text);
          if (!element.isTypeOnly && technical !== undefined)
            symbols.set(element.name.text, technical);
        }
      }
    }
    return symbols;
  }
  return new Set(
    [...exportsOf(path.join(repositoryRoot, 'packages/core/src/index.ts'))]
      .filter(([, technical]): boolean => technical)
      .map(([name]): string => name),
  );
}

export function primaryAdapterViolations(
  file: string,
  content: string,
  restricted: ReadonlySet<string>,
): string[] {
  const normalized = file.replaceAll('\\', '/');
  const source = ts.createSourceFile(
    normalized,
    content,
    ts.ScriptTarget.Latest,
    true,
    normalized.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const di = normalized.endsWith('.di.ts');
  const component =
    normalized.includes('/components/') ||
    source.statements.some(
      (statement): boolean =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === 'use client',
    );
  const violations: string[] = [];
  const constructors = new Set<string>();
  const namespaces = new Set<string>();
  const first = source.statements[0];
  if (
    di &&
    !(
      first &&
      ts.isImportDeclaration(first) &&
      ts.isStringLiteral(first.moduleSpecifier) &&
      first.moduleSpecifier.text === 'server-only'
    )
  )
    violations.push('server-only');
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const modulePath = statement.moduleSpecifier.text;
    const technical = /\/(infrastructure|domain\/entities|domain\/value-objects)\//.test(
      modulePath,
    );
    if (!di && (technical || modulePath === '@/lib/postgres/server'))
      violations.push('technical-import');
    if (modulePath !== '@canaldigital/packages/core') continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      if (component) violations.push('technical-import');
    }
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        if (!restricted.has((binding.propertyName ?? binding.name).text)) continue;
        constructors.add(binding.name.text);
        if (component) violations.push('technical-import');
      }
    }
  }
  function visit(node: ts.Node): void {
    if (!di && ts.isNewExpression(node)) {
      const expression = node.expression;
      if (
        (ts.isIdentifier(expression) && constructors.has(expression.text)) ||
        (ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          namespaces.has(expression.expression.text) &&
          restricted.has(expression.name.text))
      )
        violations.push('direct-construction');
    }
    if (
      normalized.endsWith('.actions.ts') &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const call = node.expression;
      if (
        ['from', 'rpc'].includes(call.name.text) &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'supabase'
      )
        violations.push('direct-database-access');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(violations)];
}
