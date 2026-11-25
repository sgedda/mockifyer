/**
 * Browser-safe type emit from generated JSON for several languages.
 * Merges shapes across array items; fields missing on some items become optional.
 */

export const TYPE_LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'zod', label: 'Zod schema' },
  { id: 'json-schema', label: 'JSON Schema' },
  { id: 'csharp', label: 'C#' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
] as const

export type TypesLanguage = (typeof TYPE_LANGUAGES)[number]['id']

export const DEFAULT_TYPES_LANGUAGE: TypesLanguage = 'typescript'

const LANGUAGE_IDS = new Set<string>(TYPE_LANGUAGES.map((item) => item.id))

export function isTypesLanguage(value: unknown): value is TypesLanguage {
  return typeof value === 'string' && LANGUAGE_IDS.has(value)
}

export function parseTypesLanguage(value: unknown): TypesLanguage {
  return isTypesLanguage(value) ? value : DEFAULT_TYPES_LANGUAGE
}

type JsonPrimitive = string | number | boolean | null

type TypeNode =
  | { kind: 'primitive'; name: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'array'; element: TypeNode }
  | { kind: 'object'; fields: Map<string, FieldNode>; nameHint: string }
  | { kind: 'union'; options: TypeNode[] }
  | { kind: 'unknown' }

interface FieldNode {
  type: TypeNode
  optional: boolean
}

export interface EmitTypesOptions {
  /** Root type name when the value is an object (default: Root). */
  rootName?: string
  language?: TypesLanguage
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function capitalize(word: string): string {
  if (!word) return 'Item'
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** users → User, addresses → Address, entries → Entry, data → Data */
export function singularizeKey(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '')
  if (!cleaned) return 'Item'
  const lower = cleaned.toLowerCase()
  if (lower.endsWith('ies') && lower.length > 3) {
    return capitalize(`${cleaned.slice(0, -3)}y`)
  }
  if (lower.endsWith('sses') || lower.endsWith('uses')) {
    return capitalize(cleaned.slice(0, -2))
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 1) {
    return capitalize(cleaned.slice(0, -1))
  }
  return capitalize(cleaned)
}

function primitiveNode(value: JsonPrimitive): TypeNode {
  if (value === null) return { kind: 'primitive', name: 'null' }
  if (typeof value === 'string') return { kind: 'primitive', name: 'string' }
  if (typeof value === 'number') return { kind: 'primitive', name: 'number' }
  return { kind: 'primitive', name: 'boolean' }
}

function typeKey(node: TypeNode): string {
  switch (node.kind) {
    case 'primitive':
      return `p:${node.name}`
    case 'unknown':
      return 'unknown'
    case 'array':
      return `a:${typeKey(node.element)}`
    case 'object':
      return `o:${node.nameHint}:${[...node.fields.keys()].sort().join(',')}`
    case 'union':
      return `u:${node.options.map(typeKey).sort().join('|')}`
    default:
      return 'unknown'
  }
}

function mergeTypes(a: TypeNode, b: TypeNode): TypeNode {
  if (typeKey(a) === typeKey(b)) {
    if (a.kind === 'object' && b.kind === 'object') {
      return mergeObjects(a, b)
    }
    if (a.kind === 'array' && b.kind === 'array') {
      return { kind: 'array', element: mergeTypes(a.element, b.element) }
    }
    return a
  }

  if (a.kind === 'object' && b.kind === 'object') {
    return mergeObjects(a, b)
  }
  if (a.kind === 'array' && b.kind === 'array') {
    return { kind: 'array', element: mergeTypes(a.element, b.element) }
  }

  const options: TypeNode[] = []
  const pushUnique = (node: TypeNode) => {
    if (node.kind === 'union') {
      for (const opt of node.options) pushUnique(opt)
      return
    }
    if (!options.some((opt) => typeKey(opt) === typeKey(node))) {
      options.push(node)
    }
  }
  pushUnique(a)
  pushUnique(b)
  if (options.length === 1) return options[0]!
  return { kind: 'union', options }
}

function mergeObjects(
  a: Extract<TypeNode, { kind: 'object' }>,
  b: Extract<TypeNode, { kind: 'object' }>
): TypeNode {
  const fields = new Map<string, FieldNode>()
  const keys = new Set([...a.fields.keys(), ...b.fields.keys()])
  for (const key of keys) {
    const left = a.fields.get(key)
    const right = b.fields.get(key)
    if (left && right) {
      fields.set(key, {
        type: mergeTypes(left.type, right.type),
        optional: left.optional || right.optional,
      })
    } else if (left) {
      fields.set(key, { type: left.type, optional: true })
    } else if (right) {
      fields.set(key, { type: right.type, optional: true })
    }
  }
  return {
    kind: 'object',
    nameHint: a.nameHint || b.nameHint,
    fields,
  }
}

function inferValue(value: unknown, nameHint: string): TypeNode {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return primitiveNode(value as JsonPrimitive)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: 'array', element: { kind: 'unknown' } }
    }
    let element = inferValue(value[0], singularizeKey(nameHint))
    for (let i = 1; i < value.length; i++) {
      element = mergeTypes(element, inferValue(value[i], singularizeKey(nameHint)))
    }
    return { kind: 'array', element }
  }
  if (isPlainObject(value)) {
    const fields = new Map<string, FieldNode>()
    for (const [key, child] of Object.entries(value)) {
      fields.set(key, {
        type: inferValue(child, singularizeKey(key)),
        optional: false,
      })
    }
    return { kind: 'object', nameHint, fields }
  }
  return { kind: 'unknown' }
}

function collectNamedObjects(
  node: TypeNode,
  named: Map<string, Extract<TypeNode, { kind: 'object' }>>,
  usedNames: Set<string>
): void {
  if (node.kind === 'array') {
    collectNamedObjects(node.element, named, usedNames)
    return
  }
  if (node.kind === 'union') {
    for (const opt of node.options) collectNamedObjects(opt, named, usedNames)
    return
  }
  if (node.kind !== 'object') return

  const key = typeKey(node)
  if (!named.has(key)) {
    let base = node.nameHint || 'Item'
    let candidate = base
    let n = 2
    while (usedNames.has(candidate)) {
      candidate = `${base}${n}`
      n += 1
    }
    usedNames.add(candidate)
    named.set(key, { ...node, nameHint: candidate })
  }

  const stored = named.get(key)!
  for (const field of stored.fields.values()) {
    collectNamedObjects(field.type, named, usedNames)
  }
}

interface NamedModel {
  rootName: string
  root: TypeNode
  rootKey: string | null
  namedKeys: Map<string, string>
  objects: Array<Extract<TypeNode, { kind: 'object' }>>
}

function buildNamedModel(value: unknown, rootName: string): NamedModel {
  const root = inferValue(value, rootName)

  if (root.kind === 'primitive' || root.kind === 'unknown') {
    return { rootName, root, rootKey: null, namedKeys: new Map(), objects: [] }
  }

  if (root.kind === 'array') {
    const named = new Map<string, Extract<TypeNode, { kind: 'object' }>>()
    const usedNames = new Set<string>()
    collectNamedObjects(root.element, named, usedNames)
    const namedKeys = new Map<string, string>()
    for (const [key, obj] of named) {
      namedKeys.set(key, obj.nameHint)
    }
    const objects = [...named.values()].sort((a, b) => a.nameHint.localeCompare(b.nameHint))
    return { rootName, root, rootKey: null, namedKeys, objects }
  }

  if (root.kind !== 'object') {
    return { rootName, root, rootKey: null, namedKeys: new Map(), objects: [] }
  }

  const named = new Map<string, Extract<TypeNode, { kind: 'object' }>>()
  const usedNames = new Set<string>([rootName])
  const rootKey = typeKey(root)
  named.set(rootKey, { ...root, nameHint: rootName })
  for (const field of root.fields.values()) {
    collectNamedObjects(field.type, named, usedNames)
  }
  const namedKeys = new Map<string, string>()
  for (const [key, obj] of named) {
    namedKeys.set(key, key === rootKey ? rootName : obj.nameHint)
  }
  const objects = [...named.entries()]
    .filter(([key]) => key !== rootKey)
    .map(([, obj]) => obj)
    .sort((a, b) => a.nameHint.localeCompare(b.nameHint))
  return { rootName, root, rootKey, namedKeys, objects }
}

function sortedFields(node: Extract<TypeNode, { kind: 'object' }>): Array<[string, FieldNode]> {
  return [...node.fields.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function safeIdent(name: string, fallback = 'Field'): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_')
  if (!cleaned || !/^[A-Za-z_]/.test(cleaned)) return fallback
  return cleaned
}

function pascalCase(name: string): string {
  return safeIdent(name, 'Item')
    .split(/_+/g)
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join('')
}

function camelCase(name: string): string {
  const pascal = pascalCase(name)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function goFieldName(name: string): string {
  return pascalCase(name)
}

function resolveObjectName(node: TypeNode, namedKeys: Map<string, string>, fallback: string): string {
  if (node.kind === 'object') {
    return namedKeys.get(typeKey(node)) ?? node.nameHint ?? fallback
  }
  return fallback
}

// —— TypeScript ——

function tsInline(node: TypeNode, namedKeys: Map<string, string>): string {
  switch (node.kind) {
    case 'primitive':
      return node.name
    case 'unknown':
      return 'unknown'
    case 'array':
      return `${tsInline(node.element, namedKeys)}[]`
    case 'union':
      return node.options.map((opt) => tsInline(opt, namedKeys)).join(' | ')
    case 'object':
      return namedKeys.get(typeKey(node)) ?? 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

function emitTsInterface(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`export interface ${name} {`]
  for (const [key, field] of sortedFields(node)) {
    const optional = field.optional ? '?' : ''
    const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key)
    lines.push(`  ${safeKey}${optional}: ${tsInline(field.type, namedKeys)};`)
  }
  lines.push('}')
  return lines.join('\n')
}

function emitTypeScriptFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  if (root.kind === 'primitive' || root.kind === 'unknown' || root.kind === 'union') {
    return `export type ${rootName} = ${tsInline(root, namedKeys)};\n`
  }
  if (root.kind === 'array') {
    const parts = objects.map((obj) => emitTsInterface(obj.nameHint, obj, namedKeys))
    parts.push(`export type ${rootName} = ${tsInline(root, namedKeys)};`)
    return `${parts.join('\n\n')}\n`
  }
  const parts = objects.map((obj) => emitTsInterface(obj.nameHint, obj, namedKeys))
  parts.push(emitTsInterface(rootName, root, namedKeys))
  return `${parts.join('\n\n')}\n`
}

// —— Zod ——

function zodInline(node: TypeNode, namedKeys: Map<string, string>): string {
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'null') return 'z.null()'
      if (node.name === 'string') return 'z.string()'
      if (node.name === 'number') return 'z.number()'
      return 'z.boolean()'
    case 'unknown':
      return 'z.unknown()'
    case 'array':
      return `z.array(${zodInline(node.element, namedKeys)})`
    case 'union':
      if (node.options.length === 0) return 'z.unknown()'
      if (node.options.length === 1) return zodInline(node.options[0]!, namedKeys)
      return `z.union([${node.options.map((opt) => zodInline(opt, namedKeys)).join(', ')}])`
    case 'object': {
      const name = namedKeys.get(typeKey(node))
      return name ? `${camelCase(name)}Schema` : 'z.record(z.unknown())'
    }
    default:
      return 'z.unknown()'
  }
}

function emitZodObject(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const schemaName = `${camelCase(name)}Schema`
  const lines: string[] = [`export const ${schemaName} = z.object({`]
  for (const [key, field] of sortedFields(node)) {
    const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key)
    const base = zodInline(field.type, namedKeys)
    lines.push(`  ${safeKey}: ${field.optional ? `${base}.optional()` : base},`)
  }
  lines.push('})')
  lines.push(`export type ${name} = z.infer<typeof ${schemaName}>`)
  return lines.join('\n')
}

function emitZodFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  const header = `import { z } from 'zod'\n`
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `${header}\nexport const ${camelCase(rootName)}Schema = ${zodInline(root, namedKeys)}\nexport type ${rootName} = z.infer<typeof ${camelCase(rootName)}Schema>\n`
  }
  if (root.kind === 'array') {
    const parts = objects.map((obj) => emitZodObject(obj.nameHint, obj, namedKeys))
    parts.push(
      `export const ${camelCase(rootName)}Schema = ${zodInline(root, namedKeys)}\nexport type ${rootName} = z.infer<typeof ${camelCase(rootName)}Schema>`
    )
    return `${header}\n${parts.join('\n\n')}\n`
  }
  const parts = objects.map((obj) => emitZodObject(obj.nameHint, obj, namedKeys))
  parts.push(emitZodObject(rootName, root, namedKeys))
  return `${header}\n${parts.join('\n\n')}\n`
}

// —— JSON Schema ——

function jsonSchemaNode(
  node: TypeNode,
  namedKeys: Map<string, string>,
  defs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'null') return { type: 'null' }
      return { type: node.name }
    case 'unknown':
      return {}
    case 'array':
      return { type: 'array', items: jsonSchemaNode(node.element, namedKeys, defs) }
    case 'union':
      return { anyOf: node.options.map((opt) => jsonSchemaNode(opt, namedKeys, defs)) }
    case 'object': {
      const name = resolveObjectName(node, namedKeys, node.nameHint || 'Item')
      if (!defs.has(name)) {
        // placeholder to break cycles
        defs.set(name, {})
        const properties: Record<string, unknown> = {}
        const required: string[] = []
        for (const [key, field] of sortedFields(node)) {
          properties[key] = jsonSchemaNode(field.type, namedKeys, defs)
          if (!field.optional) required.push(key)
        }
        defs.set(name, {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
          additionalProperties: false,
        })
      }
      return { $ref: `#/$defs/${name}` }
    }
    default:
      return {}
  }
}

function emitJsonSchemaFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  const defs = new Map<string, Record<string, unknown>>()
  // Pre-register nested objects so refs are stable
  for (const obj of objects) {
    jsonSchemaNode(obj, namedKeys, defs)
  }
  let rootSchema: Record<string, unknown>
  if (root.kind === 'object') {
    jsonSchemaNode(root, namedKeys, defs)
    rootSchema = { $ref: `#/$defs/${rootName}` }
  } else {
    rootSchema = jsonSchemaNode(root, namedKeys, defs)
  }
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: rootName,
    title: rootName,
    ...rootSchema,
    ...(defs.size > 0 ? { $defs: Object.fromEntries(defs) } : {}),
  }
  return `${JSON.stringify(schema, null, 2)}\n`
}

// —— C# ——

function csharpType(node: TypeNode, namedKeys: Map<string, string>, optional: boolean): string {
  const wrap = (t: string) => (optional ? `${t}?` : t)
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'string') return wrap('string')
      if (node.name === 'number') return wrap('double')
      if (node.name === 'boolean') return wrap('bool')
      return wrap('object')
    case 'unknown':
      return wrap('object')
    case 'array':
      return wrap(`List<${csharpType(node.element, namedKeys, false)}>`)
    case 'union':
      return wrap('object')
    case 'object':
      return wrap(resolveObjectName(node, namedKeys, 'object'))
    default:
      return wrap('object')
  }
}

function emitCSharpClass(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`public sealed record ${name}(`]
  const fields = sortedFields(node)
  fields.forEach(([key, field], index) => {
    const prop = pascalCase(key)
    const comma = index < fields.length - 1 ? ',' : ''
    lines.push(`    ${csharpType(field.type, namedKeys, field.optional)} ${prop}${comma}`)
  })
  lines.push(');')
  return lines.join('\n')
}

function emitCSharpFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  const usings = 'using System.Collections.Generic;\n'
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `${usings}\n// Root value type: ${csharpType(root, namedKeys, false)}\n`
  }
  const parts = objects.map((obj) => emitCSharpClass(obj.nameHint, obj, namedKeys))
  if (root.kind === 'object') {
    parts.push(emitCSharpClass(rootName, root, namedKeys))
  } else {
    parts.push(
      `// Root is an array: List<${csharpType(root.element, namedKeys, false)}>`
    )
  }
  return `${usings}\n${parts.join('\n\n')}\n`
}

// —— Kotlin ——

function kotlinType(node: TypeNode, namedKeys: Map<string, string>, optional: boolean): string {
  const wrap = (t: string) => (optional ? `${t}?` : t)
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'string') return wrap('String')
      if (node.name === 'number') return wrap('Double')
      if (node.name === 'boolean') return wrap('Boolean')
      return wrap('Any')
    case 'unknown':
      return wrap('Any')
    case 'array':
      return wrap(`List<${kotlinType(node.element, namedKeys, false)}>`)
    case 'union':
      return wrap('Any')
    case 'object':
      return wrap(resolveObjectName(node, namedKeys, 'Any'))
    default:
      return wrap('Any')
  }
}

function emitKotlinClass(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`data class ${name}(`]
  const fields = sortedFields(node)
  fields.forEach(([key, field], index) => {
    const prop = camelCase(key)
    const comma = index < fields.length - 1 ? ',' : ''
    const defaultSuffix = field.optional ? ' = null' : ''
    lines.push(
      `    val ${prop}: ${kotlinType(field.type, namedKeys, field.optional)}${defaultSuffix}${comma}`
    )
  })
  lines.push(')')
  return lines.join('\n')
}

function emitKotlinFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `// Root value type: ${kotlinType(root, namedKeys, false)}\n`
  }
  const parts = objects.map((obj) => emitKotlinClass(obj.nameHint, obj, namedKeys))
  if (root.kind === 'object') {
    parts.push(emitKotlinClass(rootName, root, namedKeys))
  } else {
    parts.push(`// Root is a list: List<${kotlinType(root.element, namedKeys, false)}>`)
  }
  return `${parts.join('\n\n')}\n`
}

// —— Swift ——

function swiftType(node: TypeNode, namedKeys: Map<string, string>, optional: boolean): string {
  const wrap = (t: string) => (optional ? `${t}?` : t)
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'string') return wrap('String')
      if (node.name === 'number') return wrap('Double')
      if (node.name === 'boolean') return wrap('Bool')
      return wrap('AnyCodable')
    case 'unknown':
      return wrap('AnyCodable')
    case 'array':
      return wrap(`[${swiftType(node.element, namedKeys, false)}]`)
    case 'union':
      return wrap('AnyCodable')
    case 'object':
      return wrap(resolveObjectName(node, namedKeys, 'AnyCodable'))
    default:
      return wrap('AnyCodable')
  }
}

function emitSwiftStruct(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`struct ${name}: Codable {`]
  for (const [key, field] of sortedFields(node)) {
    lines.push(`    let ${camelCase(key)}: ${swiftType(field.type, namedKeys, field.optional)}`)
  }
  lines.push('}')
  return lines.join('\n')
}

function emitSwiftFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `// Root value type: ${swiftType(root, namedKeys, false)}\n`
  }
  const parts = objects.map((obj) => emitSwiftStruct(obj.nameHint, obj, namedKeys))
  if (root.kind === 'object') {
    parts.push(emitSwiftStruct(rootName, root, namedKeys))
  } else {
    parts.push(`// Root is an array: [${swiftType(root.element, namedKeys, false)}]`)
  }
  return `${parts.join('\n\n')}\n`
}

// —— Python (TypedDict) ——

function pythonType(node: TypeNode, namedKeys: Map<string, string>, optional: boolean): string {
  const wrap = (t: string) => (optional ? `NotRequired[${t}]` : t)
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'string') return wrap('str')
      if (node.name === 'number') return wrap('float')
      if (node.name === 'boolean') return wrap('bool')
      return wrap('None')
    case 'unknown':
      return wrap('object')
    case 'array':
      return wrap(`list[${pythonType(node.element, namedKeys, false)}]`)
    case 'union': {
      const inner = node.options.map((opt) => pythonType(opt, namedKeys, false)).join(' | ')
      return wrap(inner || 'object')
    }
    case 'object':
      return wrap(resolveObjectName(node, namedKeys, 'dict'))
    default:
      return wrap('object')
  }
}

function emitPythonTypedDict(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`class ${name}(TypedDict):`]
  const fields = sortedFields(node)
  if (fields.length === 0) {
    lines.push('    pass')
    return lines.join('\n')
  }
  for (const [key, field] of fields) {
    lines.push(`    ${safeIdent(key, 'field')}: ${pythonType(field.type, namedKeys, field.optional)}`)
  }
  return lines.join('\n')
}

function emitPythonFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  const header = [
    'from typing import NotRequired, TypedDict',
    '',
  ].join('\n')
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `${header}# Root value type: ${pythonType(root, namedKeys, false)}\n`
  }
  const parts = objects.map((obj) => emitPythonTypedDict(obj.nameHint, obj, namedKeys))
  if (root.kind === 'object') {
    parts.push(emitPythonTypedDict(rootName, root, namedKeys))
  } else {
    parts.push(`# Root is a list: list[${pythonType(root.element, namedKeys, false)}]`)
  }
  return `${header}${parts.join('\n\n')}\n`
}

// —— Go ——

function goType(node: TypeNode, namedKeys: Map<string, string>, optional: boolean): string {
  const ptr = (t: string) => (optional ? `*${t}` : t)
  switch (node.kind) {
    case 'primitive':
      if (node.name === 'string') return ptr('string')
      if (node.name === 'number') return ptr('float64')
      if (node.name === 'boolean') return ptr('bool')
      return ptr('any')
    case 'unknown':
      return ptr('any')
    case 'array':
      return ptr(`[]${goType(node.element, namedKeys, false)}`)
    case 'union':
      return ptr('any')
    case 'object':
      return ptr(resolveObjectName(node, namedKeys, 'any'))
    default:
      return ptr('any')
  }
}

function emitGoStruct(
  name: string,
  node: Extract<TypeNode, { kind: 'object' }>,
  namedKeys: Map<string, string>
): string {
  const lines: string[] = [`type ${name} struct {`]
  for (const [key, field] of sortedFields(node)) {
    const jsonTag = field.optional ? `json:"${key},omitempty"` : `json:"${key}"`
    lines.push(`\t${goFieldName(key)} ${goType(field.type, namedKeys, field.optional)} \`${jsonTag}\``)
  }
  lines.push('}')
  return lines.join('\n')
}

function emitGoFromModel(model: NamedModel): string {
  const { rootName, root, namedKeys, objects } = model
  if (root.kind !== 'object' && root.kind !== 'array') {
    return `// Root value type: ${goType(root, namedKeys, false)}\n`
  }
  const parts = objects.map((obj) => emitGoStruct(obj.nameHint, obj, namedKeys))
  if (root.kind === 'object') {
    parts.push(emitGoStruct(rootName, root, namedKeys))
  } else {
    parts.push(`// Root is a slice: []${goType(root.element, namedKeys, false)}`)
  }
  return `${parts.join('\n\n')}\n`
}

/**
 * Infer and emit types for the selected language from a JSON value.
 */
export function emitTypes(value: unknown, options: EmitTypesOptions = {}): string {
  const rootName = options.rootName?.trim() || 'Root'
  const language = parseTypesLanguage(options.language)
  const model = buildNamedModel(value, rootName)

  switch (language) {
    case 'typescript':
      return emitTypeScriptFromModel(model)
    case 'zod':
      return emitZodFromModel(model)
    case 'json-schema':
      return emitJsonSchemaFromModel(model)
    case 'csharp':
      return emitCSharpFromModel(model)
    case 'kotlin':
      return emitKotlinFromModel(model)
    case 'swift':
      return emitSwiftFromModel(model)
    case 'python':
      return emitPythonFromModel(model)
    case 'go':
      return emitGoFromModel(model)
    default:
      return emitTypeScriptFromModel(model)
  }
}

/** @deprecated Prefer emitTypes({ language: 'typescript' }) */
export function emitTypeScript(
  value: unknown,
  options: { rootName?: string } = {}
): string {
  return emitTypes(value, { ...options, language: 'typescript' })
}

export function typesLanguageLabel(language: TypesLanguage): string {
  return TYPE_LANGUAGES.find((item) => item.id === language)?.label ?? 'TypeScript'
}
