/**
 * JSON schema inference from multiple samples for Atlas data contracts.
 * Merges observations to detect optional fields and type unions.
 */

export type JsonSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface JsonSchema {
  type: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  examples?: unknown[];
}

/**
 * Infer a JSON schema from a single value.
 */
function inferSchemaFromValue(value: unknown): JsonSchema {
  if (value === null) {
    return { type: 'null' };
  }

  const jsType = typeof value;

  if (jsType === 'string' || jsType === 'number' || jsType === 'boolean') {
    return { type: jsType as JsonSchemaType };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] } };
    }
    
    // Merge schemas from all array elements
    const itemSchemas = value.map(v => inferSchemaFromValue(v));
    const merged = mergeSchemas(itemSchemas);
    
    return { type: 'array', items: merged };
  }

  if (jsType === 'object') {
    const obj = value as Record<string, unknown>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(obj)) {
      properties[key] = inferSchemaFromValue(val);
      required.push(key);
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  return { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] };
}

/**
 * Merge multiple schemas into a unified schema with optional fields.
 */
export function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  if (schemas.length === 0) {
    return { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] };
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  // Collect all types
  const types = new Set<JsonSchemaType>();
  schemas.forEach(s => {
    if (Array.isArray(s.type)) {
      s.type.forEach(t => types.add(t));
    } else {
      types.add(s.type);
    }
  });

  const typeArray = Array.from(types);

  // If only objects, merge properties
  if (typeArray.length === 1 && typeArray[0] === 'object') {
    const allProperties = new Map<string, JsonSchema[]>();
    const propertyCounts = new Map<string, number>();

    schemas.forEach(schema => {
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (!allProperties.has(key)) {
            allProperties.set(key, []);
            propertyCounts.set(key, 0);
          }
          allProperties.get(key)!.push(propSchema);
          propertyCounts.set(key, propertyCounts.get(key)! + 1);
        }
      }
    });

    const mergedProperties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, propSchemas] of allProperties.entries()) {
      mergedProperties[key] = mergeSchemas(propSchemas);
      
      // Only required if present in all schemas
      if (propertyCounts.get(key) === schemas.length) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties: mergedProperties,
      required: required.length > 0 ? required : undefined
    };
  }

  // If only arrays, merge items
  if (typeArray.length === 1 && typeArray[0] === 'array') {
    const itemSchemas = schemas
      .map(s => s.items)
      .filter((items): items is JsonSchema => items !== undefined);
    
    const mergedItems: JsonSchema = itemSchemas.length > 0 
      ? mergeSchemas(itemSchemas) 
      : { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] as JsonSchemaType[] };
    
    return {
      type: 'array',
      items: mergedItems
    };
  }

  // Multiple types - union
  return {
    type: typeArray.length === 1 ? typeArray[0] : typeArray
  };
}

/**
 * Infer a JSON schema from multiple sample values (request/response bodies).
 */
export function inferSchemaFromSamples(samples: unknown[]): JsonSchema {
  if (samples.length === 0) {
    return { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] };
  }

  const schemas = samples
    .filter(s => s !== undefined)
    .map(s => {
      // Parse if string
      if (typeof s === 'string') {
        try {
          return inferSchemaFromValue(JSON.parse(s));
        } catch {
          return inferSchemaFromValue(s);
        }
      }
      return inferSchemaFromValue(s);
    });

  return mergeSchemas(schemas);
}

/**
 * Simplify schema for display - limit depth and remove overly complex nesting.
 */
export function simplifySchema(schema: JsonSchema, maxDepth: number = 3, currentDepth: number = 0): JsonSchema {
  if (currentDepth >= maxDepth) {
    return { type: schema.type };
  }

  if (schema.type === 'object' && schema.properties) {
    const simplified: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      simplified[key] = simplifySchema(value, maxDepth, currentDepth + 1);
    }
    return {
      type: 'object',
      properties: simplified,
      required: schema.required
    };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      type: 'array',
      items: simplifySchema(schema.items, maxDepth, currentDepth + 1)
    };
  }

  return schema;
}
