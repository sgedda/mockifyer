/**
 * Playground field-kind helpers.
 *
 * Keep {@link FIELD_KIND_OPTIONS} in sync with `FieldKind` in
 * `@sgedda/mockifyer-generator` — every inferred kind must be selectable.
 */

import type { FieldDescriptor } from '@sgedda/mockifyer-generator'

/**
 * All editable field kinds (mirrors `FieldKind` enum string values).
 * Tests assert this matches `Object.values(FieldKind)`.
 */
export const FIELD_KIND_OPTIONS = [
  'email',
  'firstName',
  'lastName',
  'fullName',
  'productName',
  'uuid',
  'integerId',
  'money',
  'currency',
  'date',
  'isoTimestamp',
  'enum',
  'url',
  'phone',
  'street',
  'city',
  'zip',
  'country',
  'latitude',
  'longitude',
  'boolean',
  'freeText',
  'number',
  'integer',
  'null',
  'unknown',
] as const

export type FieldKindOption = (typeof FIELD_KIND_OPTIONS)[number]

/**
 * Dropdown options for a path: every known kind, plus the current value if a
 * future engine kind is not yet listed (never render a blank Select).
 */
export function kindOptionsIncluding(current: string): string[] {
  if ((FIELD_KIND_OPTIONS as readonly string[]).includes(current)) {
    return [...FIELD_KIND_OPTIONS]
  }
  return [current, ...FIELD_KIND_OPTIONS]
}

/**
 * Array-container rows from inference (`arrayLength` set, no leaf samples).
 * Shown as structural labels, not editable kinds.
 */
export function isStructuralArrayField(field: FieldDescriptor): boolean {
  return typeof field.arrayLength === 'number'
}

/**
 * Human label for a structural array path, e.g. "array of objects".
 */
export function structuralArrayLabel(
  field: FieldDescriptor,
  allFields: ReadonlyArray<FieldDescriptor>
): string {
  const childPrefix = `${field.path}[*].`
  const hasObjectChildren = allFields.some((other) => other.path.startsWith(childPrefix))
  if (hasObjectChildren) {
    return 'array of objects'
  }
  const itemPath = `${field.path}[*]`
  const itemField = allFields.find((other) => other.path === itemPath)
  if (itemField && !isStructuralArrayField(itemField)) {
    return `array of ${itemField.kind}`
  }
  return 'array'
}

/** Split fields into editable leaves vs structural array rows. */
export function partitionFieldRows(fields: ReadonlyArray<FieldDescriptor>): {
  editable: FieldDescriptor[]
  structural: FieldDescriptor[]
} {
  const editable: FieldDescriptor[] = []
  const structural: FieldDescriptor[] = []
  for (const field of fields) {
    if (isStructuralArrayField(field)) {
      structural.push(field)
    } else {
      editable.push(field)
    }
  }
  return { editable, structural }
}
