/**
 * Generate ready-to-run code snippets for Atlas endpoints.
 * Includes cURL, fetch, and axios with placeholders for auth (never real secrets).
 */

import type { NetworkEvent } from './network-event-types';
import type { EndpointAuthInfo } from './atlas-auth-detection';
import type { JsonSchema } from './atlas-schema-inference';

export interface SnippetOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: EndpointAuthInfo;
  queryParams?: Record<string, string>;
}

/**
 * Redact sensitive header values to placeholders.
 * For cURL: returns $VAR_NAME (shell expansion)
 * For fetch/axios: returns process.env.VAR_NAME
 */
function redactHeaderValue(name: string, value: string, auth?: EndpointAuthInfo, format: 'curl' | 'js' = 'curl'): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName === 'authorization') {
    if (value.toLowerCase().startsWith('bearer ')) {
      // Use auth source if available
      const envSource = auth?.staticSources.find(s => s.sourceType === 'env');
      if (envSource?.identifier) {
        return format === 'curl' 
          ? `Bearer $${envSource.identifier}`
          : `Bearer \${process.env.${envSource.identifier}}`;
      }
      return 'Bearer <token>';
    }
    if (value.toLowerCase().startsWith('basic ')) {
      return 'Basic <base64-encoded-credentials>';
    }
    if (value.toLowerCase().startsWith('oauth ')) {
      return 'OAuth <token>';
    }
  }
  
  if (lowerName === 'x-api-key' || lowerName === 'x-rapidapi-key' || lowerName === 'api-key') {
    const envSource = auth?.staticSources.find(s => s.sourceType === 'env');
    if (envSource?.identifier) {
      return format === 'curl'
        ? `$${envSource.identifier}`
        : `\${process.env.${envSource.identifier}}`;
    }
    return '<api-key>';
  }
  
  if (lowerName === 'cookie') {
    return '<session-cookie>';
  }
  
  // Check for any header name that suggests auth/secret
  if (lowerName.includes('token') || 
      lowerName.includes('secret') || 
      lowerName.includes('password') ||
      lowerName.includes('credential')) {
    return '<redacted>';
  }
  
  // For other headers, only redact if value looks like a secret (longer tokens)
  // Don't redact regular values like "test-value" or "application/json"
  if (value.length > 30 && /^[A-Za-z0-9+/=_-]{30,}$/.test(value)) {
    return '<api-key>';
  }
  
  return value;
}

/**
 * Generate a sample request body from schema or example.
 */
function generateSampleBody(schema?: JsonSchema, example?: unknown): unknown {
  if (example) {
    // Redact any potential secrets in example
    return redactObjectSecrets(example);
  }
  
  if (!schema) return undefined;
  
  // Generate sample from schema
  if (schema.type === 'object' && schema.properties) {
    const sample: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      sample[key] = generateSampleFromSchema(propSchema, key);
    }
    return sample;
  }
  
  if (schema.type === 'array' && schema.items) {
    return [generateSampleFromSchema(schema.items)];
  }
  
  return undefined;
}

function generateSampleFromSchema(schema: JsonSchema, key?: string): unknown {
  if (Array.isArray(schema.type)) {
    // Union type - use first non-null
    const nonNull = schema.type.find(t => t !== 'null');
    if (nonNull) {
      return generateSampleFromSchema({ type: nonNull });
    }
  }
  
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  
  switch (type) {
    case 'string':
      if (key?.toLowerCase().includes('email')) return 'user@example.com';
      if (key?.toLowerCase().includes('name')) return 'John Doe';
      if (key?.toLowerCase().includes('id')) return 'abc123';
      return 'string';
    case 'number':
      return 123;
    case 'boolean':
      return true;
    case 'array':
      return schema.items ? [generateSampleFromSchema(schema.items)] : [];
    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(schema.properties)) {
          obj[k] = generateSampleFromSchema(v, k);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}

/**
 * Redact potential secrets from an object recursively.
 */
function redactObjectSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Redact long strings that look like tokens/keys
    if (obj.length > 30 && /^[A-Za-z0-9+/=_-]{30,}$/.test(obj)) {
      return '<redacted>';
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObjectSecrets(item));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // Redact keys that look like secrets
      if (lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('password') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key')) {
        result[key] = '<redacted>';
      } else {
        result[key] = redactObjectSecrets(value);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Redact sensitive patterns in non-JSON body strings.
 * Handles form data, query strings, and other text formats.
 */
function redactNonJsonBody(body: string): string {
  // Redact query-string-like patterns (token=..., apikey=..., password=...)
  let redacted = body.replace(
    /([?&]|^)(token|apikey|api_key|password|secret|auth|authorization|key)=([^&\s]*)/gi,
    '$1$2=<redacted>'
  );
  
  // Redact form-data-like patterns
  redacted = redacted.replace(
    /(token|apikey|api_key|password|secret|auth|authorization|key)\s*[:=]\s*([^\s&]+)/gi,
    '$1: <redacted>'
  );
  
  return redacted;
}

/**
 * Check if a string contains shell variable placeholders.
 */
function containsShellVariable(str: string): boolean {
  return str.includes('$');
}

/**
 * Generate cURL command.
 */
export function generateCurlSnippet(options: SnippetOptions): string {
  const { method, url, headers = {}, body, auth } = options;
  
  // Use double quotes if URL contains env var placeholder
  const urlQuote = containsShellVariable(url) ? '"' : "'";
  let curl = `curl -X ${method.toUpperCase()} ${urlQuote}${url}${urlQuote}`;
  
  // Add headers
  const safeHeaders = { ...headers };
  delete safeHeaders['host'];
  delete safeHeaders['content-length'];
  delete safeHeaders['user-agent'];
  
  for (const [name, value] of Object.entries(safeHeaders)) {
    const redacted = redactHeaderValue(name, value, auth);
    // Use double quotes if header value contains env var placeholder
    const headerQuote = containsShellVariable(redacted) ? '"' : "'";
    curl += ` \\\n  -H ${headerQuote}${name}: ${redacted}${headerQuote}`;
  }
  
  // Add body
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    const bodyQuote = containsShellVariable(bodyStr) ? '"' : "'";
    curl += ` \\\n  -d ${bodyQuote}${bodyStr}${bodyQuote}`;
  }
  
  return curl;
}

/**
 * Generate fetch() snippet.
 */
export function generateFetchSnippet(options: SnippetOptions): string {
  const { method, url, headers = {}, body, auth } = options;
  
  const fetchOptions: Record<string, unknown> = {
    method: method.toUpperCase()
  };
  
  // Add headers
  const safeHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'host' && 
        name.toLowerCase() !== 'content-length' &&
        name.toLowerCase() !== 'user-agent') {
      safeHeaders[name] = redactHeaderValue(name, value, auth, 'js');
    }
  }
  
  // Add body
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    if (typeof body === 'object') {
      fetchOptions.body = 'JSON.stringify(...)';
      if (!safeHeaders['content-type'] && !safeHeaders['Content-Type']) {
        safeHeaders['content-type'] = 'application/json';
      }
    } else {
      fetchOptions.body = body;
    }
  }
  
  // Add headers to options after body logic
  if (Object.keys(safeHeaders).length > 0) {
    fetchOptions.headers = safeHeaders;
  }
  
  let code = `const response = await fetch('${url}', ${JSON.stringify(fetchOptions, null, 2)});\n`;
  
  if (body && typeof body === 'object') {
    const bodyStr = JSON.stringify(body, null, 2);
    code = code.replace('"JSON.stringify(...)"', `JSON.stringify(${bodyStr})`);
  }
  
  // Replace escaped env var placeholders with template literal expressions
  // JSON.stringify turns "${process.env.X}" into "\${process.env.X}" (backslash-escaped)
  code = code.replace(/"\\?\$\{process\.env\.([A-Z_]+)\}"/g, '`${process.env.$1}`');
  code = code.replace(/"Bearer \\?\$\{process\.env\.([A-Z_]+)\}"/g, '`Bearer ${process.env.$1}`');
  
  code += 'const data = await response.json();';
  
  return code;
}

/**
 * Generate axios snippet.
 */
export function generateAxiosSnippet(options: SnippetOptions): string {
  const { method, url, headers = {}, body, auth } = options;
  
  const methodLower = method.toLowerCase();
  const configParts: string[] = [];
  
  // Add headers
  const safeHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'host' && 
        name.toLowerCase() !== 'content-length' &&
        name.toLowerCase() !== 'user-agent') {
      safeHeaders[name] = redactHeaderValue(name, value, auth, 'js');
    }
  }
  
  if (Object.keys(safeHeaders).length > 0) {
    configParts.push(`  headers: ${JSON.stringify(safeHeaders, null, 2).split('\n').join('\n  ')}`);
  }
  
  let code = '';
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    if (configParts.length > 0) {
      code = `const response = await axios.${methodLower}('${url}', ${bodyStr}, {\n${configParts.join(',\n')}\n});`;
    } else {
      code = `const response = await axios.${methodLower}('${url}', ${bodyStr});`;
    }
  } else {
    if (configParts.length > 0) {
      code = `const response = await axios.${methodLower}('${url}', {\n${configParts.join(',\n')}\n});`;
    } else {
      code = `const response = await axios.${methodLower}('${url}');`;
    }
  }
  
  return code;
}

/**
 * Generate all snippets for an endpoint.
 */
export function generateEndpointSnippets(
  method: string,
  url: string,
  events?: NetworkEvent[],
  auth?: EndpointAuthInfo,
  requestSchema?: JsonSchema,
  responseSchema?: JsonSchema
): {
  curl: string;
  fetch: string;
  axios: string;
} {
  // Use first event as example, or construct from schema
  const exampleEvent = events?.[0];
  
  const headers: Record<string, string> = exampleEvent?.requestHeaders 
    ? { ...exampleEvent.requestHeaders }
    : {};
  
  // Add common headers if missing
  if (!headers['content-type'] && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    headers['content-type'] = 'application/json';
  }
  
  // Get sample body
  let body: unknown = undefined;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    if (exampleEvent?.requestBodyPreview) {
      try {
        body = JSON.parse(exampleEvent.requestBodyPreview);
        body = redactObjectSecrets(body);
      } catch {
        // Non-JSON body: check if it contains sensitive patterns and redact if needed
        if (typeof exampleEvent.requestBodyPreview === 'string') {
          body = redactNonJsonBody(exampleEvent.requestBodyPreview);
        } else {
          body = exampleEvent.requestBodyPreview;
        }
      }
    } else if (requestSchema) {
      body = generateSampleBody(requestSchema);
    }
  }
  
  const options: SnippetOptions = {
    method,
    url,
    headers,
    body,
    auth
  };
  
  return {
    curl: generateCurlSnippet(options),
    fetch: generateFetchSnippet(options),
    axios: generateAxiosSnippet(options)
  };
}

/**
 * Validate that a snippet contains no real secret values.
 */
export function snippetContainsSecrets(snippet: string, knownSecrets: string[]): boolean {
  for (const secret of knownSecrets) {
    if (secret.length < 8) continue; // Skip very short values
    if (snippet.includes(secret)) return true;
  }
  return false;
}
