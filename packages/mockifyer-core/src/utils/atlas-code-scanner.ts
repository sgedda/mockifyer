/**
 * Static code scanner for Atlas endpoint discovery.
 * Uses TypeScript Compiler API to find fetch/axios calls and resolve URLs.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface ScannedEndpoint {
  method: string;
  urlTemplate: string;
  filePath: string;
  line: number;
  column: number;
  callType: 'fetch' | 'axios' | 'axios-instance' | 'wrapper' | 'unresolved';
  resolvedUrl?: string;
  baseUrl?: string;
  componentName?: string;
}

export interface ScanResult {
  endpoints: ScannedEndpoint[];
  errors: Array<{ file: string; message: string }>;
  envVars: Record<string, string>;
}

interface AxiosInstance {
  baseURL?: string;
  variableName: string;
}

/**
 * Resolve string literal, template string, or const reference to a URL.
 */
function resolveUrlExpression(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  constants: Map<string, string>,
  maxDepth: number = 3
): string | null {
  if (maxDepth <= 0) return null;

  // Parenthesized expression: (expr)
  if (ts.isParenthesizedExpression(node)) {
    return resolveUrlExpression(node.expression, sourceFile, checker, constants, maxDepth - 1);
  }

  // String literal
  if (ts.isStringLiteral(node)) {
    return node.text;
  }

  // Template string
  if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        // Try to resolve substitution
        const subst = resolveUrlExpression(span.expression, sourceFile, checker, constants, maxDepth - 1);
        if (subst) {
          result += subst;
        } else {
          result += '{param}';
        }
        result += span.literal.text;
      }
      return result;
    }
  }

  // Binary expression (string concatenation)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveUrlExpression(node.left, sourceFile, checker, constants, maxDepth - 1);
    const right = resolveUrlExpression(node.right, sourceFile, checker, constants, maxDepth - 1);
    if (left && right) return left + right;
    if (left) return left + '{param}';
    if (right) return '{param}' + right;
  }

  // Binary expression (logical OR fallback: x || 'literal')
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    // Try left first (the expression), fall back to right (the literal)
    const left = resolveUrlExpression(node.left, sourceFile, checker, constants, maxDepth - 1);
    if (left) return left;
    const right = resolveUrlExpression(node.right, sourceFile, checker, constants, maxDepth - 1);
    if (right) return right;
  }

  // Conditional expression (ternary or nullish coalescing: x ?? 'literal')
  if (ts.isConditionalExpression(node)) {
    // For ternary, try whenTrue first, fall back to whenFalse
    const whenTrue = resolveUrlExpression(node.whenTrue, sourceFile, checker, constants, maxDepth - 1);
    if (whenTrue) return whenTrue;
    const whenFalse = resolveUrlExpression(node.whenFalse, sourceFile, checker, constants, maxDepth - 1);
    if (whenFalse) return whenFalse;
  }

  // Binary expression (nullish coalescing: x ?? 'literal')
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    // Try left first, fall back to right
    const left = resolveUrlExpression(node.left, sourceFile, checker, constants, maxDepth - 1);
    if (left) return left;
    const right = resolveUrlExpression(node.right, sourceFile, checker, constants, maxDepth - 1);
    if (right) return right;
  }

  // Call expression (zero-arg functions that return literals)
  if (ts.isCallExpression(node) && node.arguments.length === 0 && ts.isIdentifier(node.expression)) {
    const fnName = node.expression.text;
    // Try to find the function declaration in the same file
    let fnDecl: ts.FunctionDeclaration | undefined;
    ts.forEachChild(sourceFile, function visit(n) {
      if (ts.isFunctionDeclaration(n) && n.name?.text === fnName) {
        fnDecl = n;
      }
      ts.forEachChild(n, visit);
    });
    
    if (fnDecl && fnDecl.body) {
      // Look for a simple return statement
      for (const stmt of fnDecl.body.statements) {
        if (ts.isReturnStatement(stmt) && stmt.expression) {
          const resolved = resolveUrlExpression(stmt.expression, sourceFile, checker, constants, maxDepth - 1);
          if (resolved) return resolved;
        }
      }
    }
  }

  // Call expression: .replace(/\/$/, '') - apply trailing slash removal
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const prop = node.expression;
    if (prop.name.text === 'replace' && node.arguments.length === 2) {
      // Check if it's .replace(/\/$/, '') or .replace(/\/$/, "")
      const arg0 = node.arguments[0];
      const arg1 = node.arguments[1];
      if (ts.isRegularExpressionLiteral(arg0) && 
          (ts.isStringLiteral(arg1) || ts.isNoSubstitutionTemplateLiteral(arg1))) {
        const regexText = arg0.text; // Includes slashes: "/\\/$/"
        const replacementText = arg1.text;
        // Match trailing slash strip patterns: /\/$/ or /\/+$/
        // The text includes the regex delimiters, so check for the full pattern
        if ((regexText === '/\\/$/' || regexText === '/\\/+$/') && replacementText === '') {
          // Resolve the base expression and remove trailing slashes
          const base = resolveUrlExpression(prop.expression, sourceFile, checker, constants, maxDepth - 1);
          if (base) {
            return base.replace(/\/+$/, '');
          }
        }
      }
    }
  }

  // Identifier - check constants map
  if (ts.isIdentifier(node)) {
    const name = node.text;
    if (constants.has(name)) {
      return constants.get(name)!;
    }
  }

  // Property access (e.g., config.baseURL)
  if (ts.isPropertyAccessExpression(node)) {
    const text = node.getText(sourceFile);
    if (constants.has(text)) {
      return constants.get(text)!;
    }
  }

  return null;
}

/**
 * Clean up URL templates: collapse consecutive {param} placeholders.
 * Examples:
 *   /{param}{param} -> /{param}
 *   /{param}/graphql{param} -> /{param}/graphql
 */
function cleanUrlTemplate(url: string): string {
  // Collapse consecutive {param} into single {param}
  let result = url.replace(/(\{param\})+/g, '{param}');
  
  // Convert trailing {param} without slash to ?{query} for query strings
  // Patterns like /graphql{param} or radius{param} become /graphql?{query} or radius?{query}
  result = result.replace(/([^\/\?])\{param\}$/g, '$1?{query}');
  
  return result;
}

/**
 * Extract method from fetch/axios call or default to GET.
 */
function extractMethod(node: ts.CallExpression, sourceFile: ts.SourceFile): string {
  // axios.get, axios.post, etc.
  if (ts.isPropertyAccessExpression(node.expression)) {
    const methodName = node.expression.name.text.toUpperCase();
    if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(methodName)) {
      return methodName;
    }
  }

  // fetch(url, { method: 'POST' })
  if (node.arguments.length >= 2) {
    const optionsArg = node.arguments[1];
    if (ts.isObjectLiteralExpression(optionsArg)) {
      for (const prop of optionsArg.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'method') {
          if (ts.isStringLiteral(prop.initializer)) {
            return prop.initializer.text.toUpperCase();
          }
        }
      }
    }
  }

  // axios({ method: 'POST', url: ... })
  if (node.arguments.length >= 1 && ts.isObjectLiteralExpression(node.arguments[0])) {
    for (const prop of node.arguments[0].properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'method') {
        if (ts.isStringLiteral(prop.initializer)) {
          return prop.initializer.text.toUpperCase();
        }
      }
    }
  }

  return 'GET';
}

/**
 * Find axios.create calls and track base URLs.
 */
function findAxiosInstances(sourceFile: ts.SourceFile, checker: ts.TypeChecker, constants: Map<string, string>): AxiosInstance[] {
  const instances: AxiosInstance[] = [];

  function visit(node: ts.Node) {
    // Look for axios.create({ baseURL: '...' })
    if (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'create') {
      
      if (node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
        const config = node.arguments[0];
        let baseURL: string | undefined;

        for (const prop of config.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'baseURL') {
            const resolved = resolveUrlExpression(prop.initializer, sourceFile, checker, constants);
            baseURL = resolved || undefined;
            break;
          }
        }

        // Try to find variable name
        if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
          instances.push({
            baseURL: baseURL || undefined,
            variableName: node.parent.name.text
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return instances;
}

/**
 * Collect string constants and config values from the file.
 */
function collectConstants(sourceFile: ts.SourceFile): Map<string, string> {
  const constants = new Map<string, string>();

  function tryResolve(node: ts.Node): string | null {
    if (ts.isStringLiteral(node)) {
      return node.text;
    }
    
    // Handle parenthesized expressions: (expr)
    if (ts.isParenthesizedExpression(node)) {
      return tryResolve(node.expression);
    }
    
    // Handle ?? and || fallback patterns: process.env.X ?? 'fallback'
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        // Try right side (the fallback literal)
        const right = tryResolve(node.right);
        if (right) return right;
      }
      
      // Handle string concatenation: CONST + '/path'
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = tryResolve(node.left);
        const right = tryResolve(node.right);
        if (left && right) return left + right;
        if (left) return left + '{param}';
        if (right) return '{param}' + right;
      }
    }
    
    // Identifier - check constants map
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (constants.has(name)) {
        return constants.get(name)!;
      }
    }
    
    // Handle template literals without substitutions
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    
    // Handle function calls to zero-arg functions
    if (ts.isCallExpression(node) && node.arguments.length === 0 && ts.isIdentifier(node.expression)) {
      const fnName = node.expression.text;
      // Try to find function in same file
      let fnDecl: ts.FunctionDeclaration | undefined;
      ts.forEachChild(sourceFile, function visitFn(n) {
        if (ts.isFunctionDeclaration(n) && n.name?.text === fnName) {
          fnDecl = n;
        }
        ts.forEachChild(n, visitFn);
      });
      
      if (fnDecl && fnDecl.body) {
        // Look for return statements
        for (const stmt of fnDecl.body.statements) {
          if (ts.isReturnStatement(stmt) && stmt.expression) {
            const resolved = tryResolve(stmt.expression);
            if (resolved) return resolved;
          }
        }
      }
    }
    
    // Handle .replace(/\/$/, '') - trailing slash removal
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const prop = node.expression;
      if (prop.name.text === 'replace' && node.arguments.length === 2) {
        const arg0 = node.arguments[0];
        const arg1 = node.arguments[1];
        if (ts.isRegularExpressionLiteral(arg0) && 
            (ts.isStringLiteral(arg1) || ts.isNoSubstitutionTemplateLiteral(arg1))) {
          const regexText = arg0.text; // Includes slashes: "/\\/$/"
          const replacementText = arg1.text;
          // Match trailing slash strip patterns
          if ((regexText === '/\\/$/' || regexText === '/\\/+$/') && replacementText === '') {
            const base = tryResolve(prop.expression);
            if (base) {
              // Actually remove trailing slashes
              return base.replace(/\/+$/, '');
            }
          }
        }
      }
    }
    
    return null;
  }

  function visit(node: ts.Node) {
    // const BASE_URL = 'https://...' or process.env.X ?? 'https://...'
    if (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer) {
      const resolved = tryResolve(node.initializer);
      if (resolved) {
        constants.set(node.name.text, resolved);
      }
    }

    // Look for process.env.X or import.meta.env.X
    if (ts.isPropertyAccessExpression(node)) {
      const full = node.getText(sourceFile);
      if (full.startsWith('process.env.') || full.startsWith('import.meta.env.')) {
        // We can't resolve env vars, but we can note them
        if (!constants.has(full)) {
          constants.set(full, ''); // Empty means unresolved
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constants;
}

/**
 * Scan a single source file for HTTP calls.
 */
function scanSourceFile(
  filePath: string,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ScannedEndpoint[] {
  const endpoints: ScannedEndpoint[] = [];
  const constants = collectConstants(sourceFile);
  const axiosInstances = findAxiosInstances(sourceFile, checker, constants);

  // Get component/function name if in a React component or function
  function getContainingComponentName(node: ts.Node): string | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
      // Function declaration: function MyComponent() {}
      if (ts.isFunctionDeclaration(current) && current.name) {
        return current.name.text;
      }
      // Arrow function in variable: const MyComponent = () => {}
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && 
          current.initializer && (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))) {
        return current.name.text;
      }
      // Class method
      if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
        return current.name.text;
      }
      current = current.parent;
    }
    return undefined;
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const componentName = getContainingComponentName(node);

      // fetch(url, options)
      if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch' && node.arguments.length > 0) {
        const urlArg = node.arguments[0];
        const url = resolveUrlExpression(urlArg, sourceFile, checker, constants);
        const method = extractMethod(node, sourceFile);

        endpoints.push({
          method,
          urlTemplate: url ? cleanUrlTemplate(url) : 'unresolved',
          filePath,
          line: line + 1,
          column: character + 1,
          callType: url ? 'fetch' : 'unresolved',
          resolvedUrl: url ? cleanUrlTemplate(url) : undefined,
          componentName
        });
      }

      // axios.get/post/etc(url, config)
      if (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'axios') {
        const methodName = node.expression.name.text;
        if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(methodName.toLowerCase())) {
          const url = node.arguments.length > 0 ? resolveUrlExpression(node.arguments[0], sourceFile, checker, constants) : null;
          
          endpoints.push({
            method: methodName.toUpperCase(),
            urlTemplate: url ? cleanUrlTemplate(url) : 'unresolved',
            filePath,
            line: line + 1,
            column: character + 1,
            callType: url ? 'axios' : 'unresolved',
            resolvedUrl: url ? cleanUrlTemplate(url) : undefined,
            componentName
          });
        }
      }

      // axios({ method, url })
      if (ts.isIdentifier(node.expression) && node.expression.text === 'axios' && 
          node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
        const config = node.arguments[0];
        let url: string | null = null;
        let method = 'GET';

        for (const prop of config.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            if (prop.name.text === 'url') {
              url = resolveUrlExpression(prop.initializer, sourceFile, checker, constants);
            }
            if (prop.name.text === 'method' && ts.isStringLiteral(prop.initializer)) {
              method = prop.initializer.text.toUpperCase();
            }
          }
        }

        endpoints.push({
          method,
          urlTemplate: url ? cleanUrlTemplate(url) : 'unresolved',
          filePath,
          line: line + 1,
          column: character + 1,
          callType: url ? 'axios' : 'unresolved',
          resolvedUrl: url ? cleanUrlTemplate(url) : undefined,
          componentName
        });
      }

      // httpClient.get/post (axios instance)
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
        const instanceName = node.expression.expression.text;
        const instance = axiosInstances.find(i => i.variableName === instanceName);

        if (instance) {
          const methodName = node.expression.name.text;
          if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(methodName.toLowerCase())) {
            const urlPath = node.arguments.length > 0 ? resolveUrlExpression(node.arguments[0], sourceFile, checker, constants) : null;
            const fullUrl = instance.baseURL && urlPath ? instance.baseURL + urlPath : urlPath;

            endpoints.push({
              method: methodName.toUpperCase(),
              urlTemplate: fullUrl ? cleanUrlTemplate(fullUrl) : 'unresolved',
              filePath,
              line: line + 1,
              column: character + 1,
              callType: fullUrl ? 'axios-instance' : 'unresolved',
              resolvedUrl: fullUrl ? cleanUrlTemplate(fullUrl) : undefined,
              baseUrl: instance.baseURL,
              componentName
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return endpoints;
}

/**
 * Load environment variables from .env file.
 */
function loadEnvFile(envPath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Parse KEY=value
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only store non-empty values, but don't store the actual secrets
        // Just store that the var exists
        envVars[key] = '<env-value>';
      }
    }
  } catch {
    // .env file not found or not readable
  }
  
  return envVars;
}

/**
 * Scan a directory recursively for TypeScript/JavaScript files and find HTTP calls.
 */
export function scanCodeForEndpoints(
  rootDir: string,
  options?: {
    exclude?: string[];
    include?: string[];
    wrapperFunctions?: Array<{ name: string; urlArgIndex: number }>;
  }
): ScanResult {
  const endpoints: ScannedEndpoint[] = [];
  const errors: Array<{ file: string; message: string }> = [];
  const exclude = options?.exclude || ['node_modules', 'dist', 'build', '.git'];
  const include = options?.include || ['.ts', '.tsx', '.js', '.jsx'];
  
  // Try to load .env file from root
  const envVars = loadEnvFile(path.join(rootDir, '../.env')) || 
                  loadEnvFile(path.join(rootDir, '.env')) ||
                  {};

  function shouldIncludeFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (!include.includes(ext)) return false;
    
    for (const exc of exclude) {
      if (filePath.includes(path.sep + exc + path.sep) || filePath.includes(path.sep + exc)) {
        return false;
      }
    }
    return true;
  }

  function scanDirectory(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!exclude.includes(entry.name)) {
            scanDirectory(fullPath);
          }
        } else if (entry.isFile() && shouldIncludeFile(fullPath)) {
          try {
            const sourceText = fs.readFileSync(fullPath, 'utf8');
            const sourceFile = ts.createSourceFile(
              fullPath,
              sourceText,
              ts.ScriptTarget.Latest,
              true
            );

            // Create a minimal program for type checking
            const compilerOptions: ts.CompilerOptions = {
              target: ts.ScriptTarget.Latest,
              module: ts.ModuleKind.ESNext,
              allowJs: true,
              checkJs: false,
              noEmit: true
            };
            
            const host = ts.createCompilerHost(compilerOptions);
            const program = ts.createProgram([fullPath], compilerOptions, host);
            const checker = program.getTypeChecker();

            const fileEndpoints = scanSourceFile(fullPath, sourceFile, checker);
            endpoints.push(...fileEndpoints);
          } catch (error) {
            errors.push({
              file: fullPath,
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      errors.push({
        file: dir,
        message: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  if (!fs.existsSync(rootDir)) {
    errors.push({ file: rootDir, message: 'Directory does not exist' });
    return { endpoints, errors, envVars: {} };
  }

  scanDirectory(rootDir);
  return { endpoints, errors, envVars };
}
