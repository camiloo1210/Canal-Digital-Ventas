import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const INTEGRATION_TEST = path.join(
  process.cwd(),
  'packages',
  'core',
  'src',
  'features',
  'shared',
  'infrastructure',
  'adapters',
  'outbox-worker-migrations.integration.test.ts',
);

type Rule =
  | 'forbidden-import'
  | 'forbidden-global'
  | 'env-read'
  | 'connection-options'
  | 'wrapper-structure'
  | 'sentinel'
  | 'begin-outside-wrapper'
  | 'forbidden-client-api'
  | 'top-level-client-statement'
  | 'uncontained-statement'
  | 'write-in-read-only'
  | 'set-local-role-outside-write'
  | 'transaction-control'
  | 'session-state'
  | 'non-transactional-sql'
  | 'helper-outside-transaction'
  | 'unawaited'
  | 'it-transaction-count'
  | 'wrapper-outside-it'
  | 'concurrency';

type WrapperKind = 'write' | 'read';

interface Violation {
  rule: Rule;
  line: number;
  detail: string;
}

interface CaseReport {
  title: string;
  wrappers: string[];
  statements: number;
  helperCalls: string[];
}

interface Analysis {
  violations: Violation[];
  cases: CaseReport[];
}

type Context = { kind: 'write' | 'read' } | { kind: 'helper'; name: string } | { kind: 'none' };

interface HelperInfo {
  writes: boolean;
  statements: number;
}

const WRAPPERS: ReadonlyMap<string, WrapperKind> = new Map<string, WrapperKind>([
  ['rolledBack', 'write'],
  ['readOnly', 'read'],
]);
const SENTINEL = 'RollbackSignal';
const TOP_LEVEL_CLIENT = 'sql';
const ALLOWED_ENV = 'OUTBOX_TEST_DATABASE_URL';
const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['postgres', 'vitest']);
const FORBIDDEN_GLOBALS: ReadonlySet<string> = new Set([
  'require',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'eval',
]);
const FORBIDDEN_CLIENT_API: ReadonlySet<string> = new Set([
  'unsafe',
  'file',
  'reserve',
  'listen',
  'notify',
  'subscribe',
  'prepare',
  'largeObject',
]);
const ALLOWED_SET_LOCAL: ReadonlySet<string> = new Set([
  'STATEMENT_TIMEOUT',
  'LOCK_TIMEOUT',
  'IDLE_IN_TRANSACTION_SESSION_TIMEOUT',
  'ROLE',
]);
const REQUIRED_PROLOGUE: readonly string[] = [
  "SET LOCAL STATEMENT_TIMEOUT = '15S'",
  "SET LOCAL LOCK_TIMEOUT = '5S'",
  "SET LOCAL IDLE_IN_TRANSACTION_SESSION_TIMEOUT = '30S'",
];
const READ_FUNCTIONS: ReadonlySet<string> = new Set([
  'IN',
  'EXISTS',
  'ANY',
  'ALL',
  'AND',
  'OR',
  'NOT',
  'ON',
  'WHERE',
  'FROM',
  'JOIN',
  'SELECT',
  'COUNT',
  'UNNEST',
  'PG_CATALOG.UNNEST',
  'HAS_TABLE_PRIVILEGE',
  'PG_CATALOG.HAS_TABLE_PRIVILEGE',
  'HAS_SCHEMA_PRIVILEGE',
  'PG_CATALOG.HAS_SCHEMA_PRIVILEGE',
  'PG_HAS_ROLE',
  'PG_CATALOG.PG_HAS_ROLE',
]);
const WRITE_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT|REFRESH|LOCK|DO|CALL|IMPORT|REASSIGN|COPY|SECURITY\s+LABEL)\b/;
const TRANSACTION_CONTROL: readonly RegExp[] = [
  /\b(COMMIT|ROLLBACK|RELEASE|SAVEPOINT|ABORT)\b/,
  /\bPREPARE\s+TRANSACTION\b/,
  /\bSTART\s+TRANSACTION\b/,
];
const SESSION_STATE: readonly RegExp[] = [
  /(^|;|\bTHEN\b|\bELSE\b|\bBEGIN\b|\bLOOP\b|')\s*(SET|RESET)\s+(?!LOCAL\b)/,
  /\bSET\s+SESSION\b/,
  /\bSET_CONFIG\s*\(/,
  /\bDISCARD\b/,
];
const NON_TRANSACTIONAL: readonly RegExp[] = [
  /\b(LISTEN|UNLISTEN|NOTIFY|PG_NOTIFY)\b/,
  /\bDBLINK\w*/,
  /\bNET\.HTTP_\w+/,
  /\bPG_NET\b/,
  /\b(NEXTVAL|SETVAL)\s*\(/,
  /\bPG_(TRY_)?ADVISORY_LOCK(_SHARED)?\b/,
  /\bPG_ADVISORY_UNLOCK\w*/,
  /\b(LO_IMPORT|LO_EXPORT|PG_READ_FILE|PG_READ_BINARY_FILE|PG_LS_DIR)\b/,
  /\b(PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_RELOAD_CONF)\b/,
  /\b(VACUUM|CLUSTER|REINDEX|CHECKPOINT|CONCURRENTLY)\b/,
  /\bALTER\s+SYSTEM\b/,
  /\b(CREATE|DROP|ALTER)\s+(DATABASE|TABLESPACE|SUBSCRIPTION|PUBLICATION)\b/,
  /\bCOPY\b[\s\S]*\b(PROGRAM|TO)\b/,
];

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function walk(node: ts.Node, visit: (child: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child: ts.Node): void => walk(child, visit));
}

function descendants(root: ts.Node): ts.Node[] {
  const found: ts.Node[] = [];
  ts.forEachChild(root, (child: ts.Node): void =>
    walk(child, (node: ts.Node): void => {
      found.push(node);
    }),
  );
  return found;
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node)
  );
}

function calleeName(call: ts.CallExpression): string | null {
  return ts.isIdentifier(call.expression) ? call.expression.text : null;
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isPropertySignature(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  return true;
}

function templateText(node: ts.TaggedTemplateExpression): string {
  const template = node.template;
  if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text;
  return (
    template.head.text +
    template.templateSpans
      .map((span: ts.TemplateSpan, index: number): string => `$${index + 1}${span.literal.text}`)
      .join('')
  );
}

function normalizeSql(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toUpperCase();
}

function stripLiterals(upperSql: string): string {
  return upperSql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, '');
}

function withoutDollarBodies(upperSql: string): string {
  return upperSql.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$');
}

function isReadSafe(stripped: string): boolean {
  if (!/^(SELECT|WITH)\b/.test(stripped) || WRITE_KEYWORDS.test(stripped)) return false;
  const calls = stripped.matchAll(/(\bAS\s+)?([A-Z_][A-Z0-9_$]*(?:\.[A-Z_][A-Z0-9_$]*)?)\s*\(/g);
  for (const call of calls) {
    if (!call[1] && !READ_FUNCTIONS.has(call[2])) return false;
  }
  return true;
}

function isSetLocalTimeout(stripped: string): boolean {
  return /^SET LOCAL (STATEMENT_TIMEOUT|LOCK_TIMEOUT|IDLE_IN_TRANSACTION_SESSION_TIMEOUT) = ''$/.test(
    stripped,
  );
}

function isConsumed(node: ts.Node): boolean {
  let current: ts.Node = node;
  for (;;) {
    const parent = current.parent;
    if (ts.isAwaitExpression(parent) || ts.isReturnStatement(parent)) return true;
    if (ts.isArrowFunction(parent) && parent.body === current) return true;
    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isPropertyAccessExpression(parent) ||
      ts.isCallExpression(parent)
    ) {
      current = parent;
      continue;
    }
    return false;
  }
}

function contextOf(node: ts.Node): Context {
  for (let current: ts.Node = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      const wrapper = WRAPPERS.get(current.name.text);
      return wrapper ? { kind: wrapper } : { kind: 'helper', name: current.name.text };
    }
    if (isFunctionLike(current) && ts.isCallExpression(current.parent)) {
      const call = current.parent;
      const wrapper = WRAPPERS.get(calleeName(call) ?? '');
      if (wrapper && call.arguments.some((arg: ts.Expression): boolean => arg === current)) {
        return { kind: wrapper };
      }
    }
  }
  return { kind: 'none' };
}

function nearestFunction(node: ts.Node): ts.FunctionLikeDeclaration | null {
  for (let current: ts.Node = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (isFunctionLike(current)) return current;
  }
  return null;
}

function isItCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  let callee: ts.Expression = node.expression;
  while (ts.isPropertyAccessExpression(callee)) callee = callee.expression;
  return ts.isIdentifier(callee) && callee.text === 'it';
}

function testCallback(call: ts.CallExpression): ts.FunctionLikeDeclaration | null {
  const last = call.arguments[call.arguments.length - 1];
  return last && isFunctionLike(last) ? last : null;
}

function awaitedTemplate(statement: ts.Statement | undefined): string | null {
  if (!statement || !ts.isExpressionStatement(statement)) return null;
  const expression = statement.expression;
  if (!ts.isAwaitExpression(expression)) return null;
  if (!ts.isTaggedTemplateExpression(expression.expression)) return null;
  return normalizeSql(templateText(expression.expression));
}

function checkWrapper(
  sf: ts.SourceFile,
  decl: ts.FunctionDeclaration,
  kind: WrapperKind,
  report: (rule: Rule, node: ts.Node, detail: string) => void,
): void {
  const name = decl.name?.text ?? '?';
  const fail = (node: ts.Node, detail: string): void =>
    report('wrapper-structure', node, `${name}: ${detail}`);
  const first = decl.parameters[0];
  const workName = first && ts.isIdentifier(first.name) ? first.name.text : '';
  const body = decl.body;
  if (!body || !workName) return fail(decl, 'needs a body and a work parameter');

  const tries = body.statements.filter(ts.isTryStatement);
  if (tries.length !== 1 || body.statements[body.statements.length - 1] !== tries[0]) {
    return fail(decl, 'must end with exactly one try statement');
  }
  const attempt = tries[0];
  if (attempt.finallyBlock) fail(attempt, 'must not have a finally block');

  const beginStatement = attempt.tryBlock.statements[0];
  if (
    attempt.tryBlock.statements.length !== 1 ||
    !ts.isExpressionStatement(beginStatement) ||
    !ts.isAwaitExpression(beginStatement.expression) ||
    !ts.isCallExpression(beginStatement.expression.expression)
  ) {
    return fail(attempt, 'try block must only await the top-level begin call');
  }
  const begin = beginStatement.expression.expression;
  if (
    !ts.isPropertyAccessExpression(begin.expression) ||
    begin.expression.name.text !== 'begin' ||
    !ts.isIdentifier(begin.expression.expression) ||
    begin.expression.expression.text !== TOP_LEVEL_CLIENT
  ) {
    return fail(begin, `must call ${TOP_LEVEL_CLIENT}.begin`);
  }
  const options = begin.arguments.length === 2 ? begin.arguments[0] : null;
  if (kind === 'read') {
    if (
      !options ||
      !ts.isStringLiteral(options) ||
      options.text.trim().toLowerCase() !== 'read only'
    ) {
      fail(begin, "must begin a 'read only' transaction");
    }
  } else if (begin.arguments.length !== 1) {
    fail(begin, 'must begin a default transaction without options');
  }

  const callback = begin.arguments[begin.arguments.length - 1];
  if (!callback || !isFunctionLike(callback) || !callback.body || !ts.isBlock(callback.body)) {
    return fail(begin, 'transaction callback must have a block body');
  }
  const statements = callback.body.statements;
  const prologue = statements
    .slice(0, REQUIRED_PROLOGUE.length)
    .map((statement: ts.Statement): string => awaitedTemplate(statement) ?? '');
  if (prologue.join('\n') !== REQUIRED_PROLOGUE.join('\n')) {
    fail(callback, `must open with: ${REQUIRED_PROLOGUE.join('; ')}`);
  }

  const last = statements[statements.length - 1];
  if (
    !last ||
    !ts.isThrowStatement(last) ||
    !ts.isNewExpression(last.expression) ||
    !ts.isIdentifier(last.expression.expression) ||
    last.expression.expression.text !== SENTINEL ||
    (last.expression.arguments?.length ?? 0) !== 0
  ) {
    fail(callback, `must always end by throwing new ${SENTINEL}()`);
  }
  const beforeLast = statements[statements.length - 2];
  const runsWork =
    beforeLast !== undefined &&
    ts.isExpressionStatement(beforeLast) &&
    ts.isAwaitExpression(beforeLast.expression) &&
    ts.isCallExpression(beforeLast.expression.expression) &&
    calleeName(beforeLast.expression.expression) === workName;
  if (!runsWork) fail(callback, `must await ${workName}(...) right before the sentinel throw`);

  for (const node of descendants(callback.body)) {
    if (ts.isReturnStatement(node) || ts.isTryStatement(node) || isFunctionLike(node)) {
      fail(node, 'transaction callback must not return early, catch, or nest functions');
    }
    if (ts.isThrowStatement(node) && node !== last) fail(node, 'only the sentinel may be thrown');
  }
  const workUses = descendants(body).filter(
    (node: ts.Node): boolean => ts.isIdentifier(node) && node.text === workName,
  );
  if (workUses.length !== 1) fail(decl, `${workName} must be invoked exactly once`);

  const clause = attempt.catchClause;
  const errorName =
    clause?.variableDeclaration && ts.isIdentifier(clause.variableDeclaration.name)
      ? clause.variableDeclaration.name.text
      : '';
  const rethrow = clause?.block.statements[0];
  const guarded =
    clause !== undefined &&
    clause.block.statements.length === 1 &&
    rethrow !== undefined &&
    ts.isIfStatement(rethrow) &&
    !rethrow.elseStatement &&
    ts.isPrefixUnaryExpression(rethrow.expression) &&
    rethrow.expression.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isParenthesizedExpression(rethrow.expression.operand) &&
    ts.isBinaryExpression(rethrow.expression.operand.expression) &&
    rethrow.expression.operand.expression.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
    rethrow.expression.operand.expression.left.getText(sf) === errorName &&
    rethrow.expression.operand.expression.right.getText(sf) === SENTINEL &&
    ts.isThrowStatement(rethrow.thenStatement) &&
    rethrow.thenStatement.expression.getText(sf) === errorName;
  if (!guarded) {
    fail(attempt, `catch must only swallow ${SENTINEL} and rethrow every other error`);
  }
}

function analyzeContainment(source: string): Analysis {
  const sf = ts.createSourceFile(
    'subject.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: Violation[] = [];
  const report = (rule: Rule, node: ts.Node, detail: string): void => {
    violations.push({ rule, line: lineOf(sf, node), detail });
  };
  const all = descendants(sf);

  let postgresName = '';
  const wrapperDecls = new Map<string, ts.FunctionDeclaration>();
  const helpers = new Map<string, HelperInfo>();
  for (const node of all) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (!ALLOWED_IMPORTS.has(specifier)) report('forbidden-import', node, specifier);
      if (specifier === 'postgres' && node.importClause?.name) {
        postgresName = node.importClause.name.text;
      }
    }
    if (
      ts.isImportEqualsDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      report('forbidden-import', node, node.getText(sf));
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      report('forbidden-import', node, 'dynamic import');
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (WRAPPERS.has(node.name.text)) wrapperDecls.set(node.name.text, node);
      else if (
        descendants(node).some(
          (child: ts.Node): boolean =>
            ts.isTaggedTemplateExpression(child) ||
            (ts.isPropertyAccessExpression(child) && child.name.text === 'savepoint'),
        )
      ) {
        helpers.set(node.name.text, { writes: false, statements: 0 });
      }
    }
  }

  if (!wrapperDecls.has('rolledBack'))
    report('wrapper-structure', sf, 'rolledBack is not declared');
  for (const [name, decl] of wrapperDecls) {
    checkWrapper(sf, decl, WRAPPERS.get(name) ?? 'write', report);
  }

  const sentinelClass = all.find(
    (node: ts.Node): boolean =>
      ts.isClassDeclaration(node) && node.name !== undefined && node.name.text === SENTINEL,
  );
  if (
    !sentinelClass ||
    !ts.isClassDeclaration(sentinelClass) ||
    sentinelClass.members.length !== 0 ||
    sentinelClass.heritageClauses?.[0]?.types[0]?.expression.getText(sf) !== 'Error'
  ) {
    report('sentinel', sentinelClass ?? sf, `${SENTINEL} must be an empty subclass of Error`);
  }

  let postgresCalls = 0;
  for (const node of all) {
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      const parent = node.parent;
      if (node.text === 'process') {
        const allowed =
          ts.isPropertyAccessExpression(parent) &&
          parent.name.text === 'env' &&
          ts.isPropertyAccessExpression(parent.parent) &&
          parent.parent.expression === parent &&
          parent.parent.name.text === ALLOWED_ENV;
        if (!allowed) report('env-read', node, parent.parent.getText(sf));
      }
      if (FORBIDDEN_GLOBALS.has(node.text)) report('forbidden-global', node, node.text);
      if (node.text === SENTINEL && !(ts.isClassDeclaration(parent) && parent.name === node)) {
        const owner = nearestDeclaration(node);
        if (!owner || !WRAPPERS.has(owner))
          report('sentinel', node, 'sentinel used outside wrappers');
      }
      if (node.text === TOP_LEVEL_CLIENT) {
        const allowed =
          (ts.isVariableDeclaration(parent) && parent.name === node) ||
          (ts.isBinaryExpression(parent) &&
            parent.left === node &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isCallExpression(parent.right) &&
            calleeName(parent.right) === postgresName) ||
          (ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            (parent.name.text === 'begin' || parent.name.text === 'end')) ||
          (ts.isIfStatement(parent) && parent.expression === node);
        if (!allowed) report('top-level-client-statement', node, parent.getText(sf).slice(0, 80));
      }
      if (helpers.has(node.text)) {
        const isDeclName = ts.isFunctionDeclaration(parent) && parent.name === node;
        const isCallee = ts.isCallExpression(parent) && parent.expression === node;
        if (!isDeclName && !isCallee) {
          report('helper-outside-transaction', node, `${node.text} escapes as a value`);
        }
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const member = node.name.text;
      if (FORBIDDEN_CLIENT_API.has(member)) report('forbidden-client-api', node, member);
      if (member === 'concurrent' || member === 'only') report('concurrency', node, member);
      if (member === 'begin' && ts.isCallExpression(node.parent)) {
        const owner = nearestFunction(node);
        const ownerName =
          owner && ts.isFunctionDeclaration(owner) && owner.name ? owner.name.text : '';
        if (!WRAPPERS.has(ownerName)) report('begin-outside-wrapper', node, node.getText(sf));
      }
    }
    if (ts.isCallExpression(node) && postgresName && calleeName(node) === postgresName) {
      postgresCalls += 1;
      const options = node.arguments[1];
      const props =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.map((p: ts.ObjectLiteralElementLike): string => p.getText(sf))
          : [];
      const exact =
        props.length === 2 && props.includes('max: 1') && props.includes('prepare: false');
      if (!exact) {
        report(
          'connection-options',
          node,
          'client options must be exactly { max: 1, prepare: false }',
        );
      }
    }
  }
  if (postgresName && postgresCalls !== 1) {
    report('connection-options', sf, `expected one postgres client, found ${postgresCalls}`);
  }

  for (const node of all) {
    if (!ts.isTaggedTemplateExpression(node)) continue;
    const upper = normalizeSql(templateText(node));
    const stripped = stripLiterals(upper);
    const statementLevel = stripLiterals(withoutDollarBodies(upper));
    const snippet = upper.slice(0, 80);
    if (TRANSACTION_CONTROL.some((re: RegExp): boolean => re.test(upper))) {
      report('transaction-control', node, snippet);
    }
    if (/(^|;)\s*(BEGIN|END)\b/.test(statementLevel)) report('transaction-control', node, snippet);
    if (SESSION_STATE.some((re: RegExp): boolean => re.test(upper))) {
      report('session-state', node, snippet);
    }
    for (const match of stripped.matchAll(/\bSET\s+LOCAL\s+([A-Z_]+)/g)) {
      if (!ALLOWED_SET_LOCAL.has(match[1])) report('session-state', node, snippet);
    }
    if (NON_TRANSACTIONAL.some((re: RegExp): boolean => re.test(upper))) {
      report('non-transactional-sql', node, snippet);
    }
    if (!isConsumed(node)) report('unawaited', node, snippet);

    const context = contextOf(node);
    const readSafe = isReadSafe(stripped) || isSetLocalTimeout(stripped);
    if (context.kind === 'none') report('uncontained-statement', node, snippet);
    if (context.kind === 'read' && !readSafe) report('write-in-read-only', node, snippet);
    if (context.kind !== 'write' && /\bSET\s+LOCAL\s+ROLE\b/.test(stripped)) {
      report('set-local-role-outside-write', node, snippet);
    }
    if (context.kind === 'helper') {
      const info = helpers.get(context.name);
      if (info) {
        info.statements += 1;
        info.writes = info.writes || !readSafe;
      }
    }
  }

  for (const node of all) {
    if (!ts.isCallExpression(node)) continue;
    const name = calleeName(node) ?? '';
    const helper = helpers.get(name);
    if (helper) {
      const context = contextOf(node);
      if (context.kind === 'none' || context.kind === 'helper') {
        report('helper-outside-transaction', node, name);
      }
      if (context.kind === 'read' && helper.writes) report('write-in-read-only', node, name);
      if (!isConsumed(node)) report('unawaited', node, name);
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'savepoint'
    ) {
      const context = contextOf(node);
      if (context.kind === 'none') report('uncontained-statement', node, 'savepoint');
      if (!isConsumed(node)) report('unawaited', node, 'savepoint');
    }
    if (WRAPPERS.has(name)) {
      if (!isConsumed(node)) report('unawaited', node, name);
      const owner = nearestFunction(node);
      if (!owner || !isItCall(owner.parent)) {
        report('wrapper-outside-it', node, name);
        continue;
      }
      for (let current: ts.Node = node.parent; current !== owner; current = current.parent) {
        if (ts.isIterationStatement(current, false)) report('wrapper-outside-it', node, name);
      }
    }
  }

  const cases: CaseReport[] = [];
  for (const node of all) {
    if (!isItCall(node)) continue;
    const callback = testCallback(node);
    const title =
      node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : '?';
    if (!callback) {
      report('it-transaction-count', node, `${title}: no callback`);
      continue;
    }
    const inside = descendants(callback);
    const wrappers = inside
      .filter(
        (child: ts.Node): child is ts.CallExpression =>
          ts.isCallExpression(child) && WRAPPERS.has(calleeName(child) ?? ''),
      )
      .map((call: ts.CallExpression): string => calleeName(call) ?? '');
    if (wrappers.length !== 1) {
      report('it-transaction-count', node, `${title}: ${wrappers.length} transactions`);
    }
    const helperCalls = inside
      .filter(
        (child: ts.Node): child is ts.CallExpression =>
          ts.isCallExpression(child) && helpers.has(calleeName(child) ?? ''),
      )
      .map((call: ts.CallExpression): string => calleeName(call) ?? '');
    const direct = inside.filter((child: ts.Node): boolean => ts.isTaggedTemplateExpression(child));
    const viaHelpers = helperCalls.reduce(
      (sum: number, helper: string): number => sum + (helpers.get(helper)?.statements ?? 0),
      0,
    );
    cases.push({ title, wrappers, statements: direct.length + viaHelpers, helperCalls });
  }

  return { violations, cases };
}

function nearestDeclaration(node: ts.Node): string | null {
  for (let current: ts.Node = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  }
  return null;
}

function rulesOf(analysis: Analysis): Rule[] {
  return Array.from(new Set(analysis.violations.map((v: Violation): Rule => v.rule))).sort();
}

const BAD_FIXTURE = [
  "import { readFileSync } from 'node:fs';",
  "import postgres from 'postgres';",
  "import { it } from 'vitest';",
  'type Tx = postgres.TransactionSql<Record<string, unknown>>;',
  'const url = process.env.DATABASE_URL;',
  'class RollbackSignal extends Error {}',
  'const sql = postgres(url!, { max: 1, connection: { statement_timeout: 1 } });',
  'async function rolledBack(work: (tx: Tx) => Promise<void>): Promise<void> {',
  '  await sql.begin(async (tx: Tx): Promise<void> => {',
  '    await work(tx);',
  '  });',
  '}',
  "it('leaks', async (): Promise<void> => {",
  '  await sql`INSERT INTO core.tenants (id) VALUES (1)`;',
  '  await rolledBack(async (tx: Tx): Promise<void> => {',
  '    await tx`SET ROLE authenticated`;',
  '    await tx`COMMIT`;',
  '    tx`DELETE FROM core.outbox_events`;',
  '  });',
  '  await rolledBack(async (tx: Tx): Promise<void> => {',
  '    await tx`SELECT pg_advisory_lock(1)`;',
  '  });',
  "  await sql.begin(async (tx: Tx): Promise<void> => { await tx`UPDATE core.tenants SET name = 'x'`; });",
  '  readFileSync(url!);',
  '});',
].join('\n');

interface Mutation {
  name: string;
  from: string;
  to: string;
  rule: Rule;
}

const MUTATIONS: readonly Mutation[] = [
  {
    name: 'drops the rollback sentinel',
    from: '        await work(tx, tenantId);\n        throw new RollbackSignal();',
    to: '        await work(tx, tenantId);',
    rule: 'wrapper-structure',
  },
  {
    name: 'turns the read-only wrapper into a writable transaction',
    from: "sql.begin('read only', ",
    to: 'sql.begin(',
    rule: 'wrapper-structure',
  },
  {
    name: 'swallows every error in a wrapper',
    from: 'if (!(error instanceof RollbackSignal)) throw error;',
    to: 'void error;',
    rule: 'wrapper-structure',
  },
  {
    name: 'writes inside a read-only case',
    from: 'SELECT r.event_type FROM core.outbox_relay_routes r',
    to: 'DELETE FROM core.outbox_relay_routes r',
    rule: 'write-in-read-only',
  },
  {
    name: 'calls a mutating function inside a read-only case',
    from: 'SELECT COUNT(*)::int AS n FROM pg_catalog.pg_roles r',
    to: 'SELECT core.claim_outbox_events(NULL, 1) AS n FROM pg_catalog.pg_roles r',
    rule: 'write-in-read-only',
  },
  {
    name: 'opens a second transaction in one case',
    from: "  it('claims only the requested aggregate type and event types', async (): Promise<void> => {\n",
    to: "  it('claims only the requested aggregate type and event types', async (): Promise<void> => {\n    await rolledBack(async (): Promise<void> => {});\n",
    rule: 'it-transaction-count',
  },
  {
    name: 'adds startup parameters',
    from: '{ max: 1, prepare: false }',
    to: '{ max: 1, prepare: false, connection: { statement_timeout: 15_000 } }',
    rule: 'connection-options',
  },
  {
    name: 'reads another environment variable',
    from: 'process.env.OUTBOX_TEST_DATABASE_URL',
    to: 'process.env.DATABASE_URL',
    rule: 'env-read',
  },
  {
    name: 'uses a session-level SET',
    from: "await tx`SET LOCAL lock_timeout = '5s'`;",
    to: "await tx`SET lock_timeout = '5s'`;",
    rule: 'session-state',
  },
  {
    name: 'uses SET ROLE without LOCAL',
    from: 'SET LOCAL ROLE authenticated',
    to: 'SET ROLE authenticated',
    rule: 'session-state',
  },
  {
    name: 'issues a statement on the top-level client',
    from: 'if (sql) await sql.end({ timeout: 5 });',
    to: 'if (sql) await sql`DELETE FROM core.outbox_relay_exclusions`;',
    rule: 'uncontained-statement',
  },
  {
    name: 'leaves a helper call unawaited',
    from: '      await makeSweepable(tx, sweepable);\n      const rows',
    to: '      void makeSweepable(tx, sweepable);\n      const rows',
    rule: 'unawaited',
  },
  {
    name: 'imports the file system',
    from: "import postgres from 'postgres';",
    to: "import { writeFileSync } from 'node:fs';\nimport postgres from 'postgres';",
    rule: 'forbidden-import',
  },
  {
    name: 'calls a helper outside any transaction',
    from: '    sql = postgres(url!, { max: 1, prepare: false });',
    to: "    sql = postgres(url!, { max: 1, prepare: false });\n    void statusOf(sql as unknown as Tx, 'x');",
    rule: 'helper-outside-transaction',
  },
  {
    name: 'commits explicitly',
    from: "await tx`SET LOCAL lock_timeout = '5s'`;",
    to: 'await tx`COMMIT`;',
    rule: 'transaction-control',
  },
  {
    name: 'takes a session-level advisory lock',
    from: 'SELECT status FROM core.outbox_events WHERE id = ${id}',
    to: 'SELECT status FROM core.outbox_events WHERE id = ${id} AND pg_advisory_lock(1) IS NOT NULL',
    rule: 'non-transactional-sql',
  },
  {
    name: 'opens a transaction outside the wrappers',
    from: '    await readOnly(async (tx: Tx): Promise<void> => {\n      const rows',
    to: '    await sql.begin(async (tx: Tx): Promise<void> => {\n      const rows',
    rule: 'begin-outside-wrapper',
  },
  {
    name: 'runs cases concurrently',
    from: 'describe.skipIf(!url)(',
    to: 'describe.concurrent.skipIf(!url)(',
    rule: 'concurrency',
  },
  {
    name: 'drops the idle-in-transaction guard',
    from: "        await tx`SET LOCAL idle_in_transaction_session_timeout = '30s'`;\n",
    to: '',
    rule: 'wrapper-structure',
  },
  {
    name: 'sets a non-allow-listed parameter locally',
    from: "await tx`SET LOCAL lock_timeout = '5s'`;",
    to: "await tx`SET LOCAL lock_timeout = '5s'`;\n        await tx`SET LOCAL session_replication_role = 'replica'`;",
    rule: 'session-state',
  },
];

const subject = readFileSync(INTEGRATION_TEST, 'utf8').replace(/\r\n/g, '\n');
const analysis = analyzeContainment(subject);

describe('integration test containment (static)', (): void => {
  it('finds no containment violation in the outbox migration integration test', (): void => {
    expect(analysis.violations).toEqual([]);
  });

  it('runs every case in exactly one transaction', (): void => {
    expect(analysis.cases).toHaveLength(13);
    for (const testCase of analysis.cases) {
      expect(testCase.wrappers, testCase.title).toHaveLength(1);
      expect(testCase.statements, testCase.title).toBeGreaterThan(0);
    }
    const readOnlyCases = analysis.cases
      .filter((testCase: CaseReport): boolean => testCase.wrappers[0] === 'readOnly')
      .map((testCase: CaseReport): string => testCase.title);
    expect(readOnlyCases).toEqual([
      'seeds the order notification routes and closes the routes table to web roles',
      'keeps every historical order event excluded and pending',
      'leaves no temporary CREATE privilege and no function that calls has_role',
    ]);
  });

  it('flags every violation planted in the negative control fixture', (): void => {
    expect(rulesOf(analyzeContainment(BAD_FIXTURE))).toEqual(
      expect.arrayContaining<Rule>([
        'forbidden-import',
        'env-read',
        'connection-options',
        'wrapper-structure',
        'top-level-client-statement',
        'uncontained-statement',
        'session-state',
        'transaction-control',
        'unawaited',
        'non-transactional-sql',
        'it-transaction-count',
        'begin-outside-wrapper',
      ]),
    );
  });

  it.each(MUTATIONS.map((m: Mutation): [string, Mutation] => [m.name, m]))(
    'flags a mutant that %s',
    (_name: string, mutation: Mutation): void => {
      expect(subject).toContain(mutation.from);
      const mutant = subject.replace(mutation.from, mutation.to);
      expect(rulesOf(analyzeContainment(mutant))).toContain(mutation.rule);
    },
  );
});
