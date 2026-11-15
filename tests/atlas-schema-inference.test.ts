import { inferSchemaFromSamples, mergeSchemas, simplifySchema } from '../packages/mockifyer-core/src/utils/atlas-schema-inference';

describe('atlas-schema-inference', () => {
  describe('inferSchemaFromSamples', () => {
    it('should infer schema from simple object', () => {
      const samples = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties!.name.type).toBe('string');
      expect(schema.properties!.age.type).toBe('number');
      expect(schema.required).toEqual(['name', 'age']);
    });

    it('should handle optional fields', () => {
      const samples = [
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25 }
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toEqual(['name', 'age']); // city is optional
    });

    it('should handle arrays', () => {
      const samples = [
        { items: [1, 2, 3] },
        { items: [4, 5] }
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties!.items.type).toBe('array');
      expect(schema.properties!.items.items).toBeDefined();
      expect(schema.properties!.items.items!.type).toBe('number');
    });

    it('should handle nested objects', () => {
      const samples = [
        { user: { name: 'Alice', id: 1 } },
        { user: { name: 'Bob', id: 2 } }
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties!.user.type).toBe('object');
      expect(schema.properties!.user.properties).toBeDefined();
      expect(schema.properties!.user.properties!.name.type).toBe('string');
      expect(schema.properties!.user.properties!.id.type).toBe('number');
    });

    it('should handle type unions', () => {
      const samples = [
        { value: 'string' },
        { value: 42 }
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties!.value.type).toEqual(expect.arrayContaining(['string', 'number']));
    });

    it('should parse JSON strings', () => {
      const samples = [
        '{"name": "Alice"}',
        '{"name": "Bob"}'
      ];
      const schema = inferSchemaFromSamples(samples);
      
      expect(schema.type).toBe('object');
      expect(schema.properties!.name.type).toBe('string');
    });

    it('should handle empty array', () => {
      const schema = inferSchemaFromSamples([]);
      expect(schema.type).toBeDefined();
    });
  });

  describe('mergeSchemas', () => {
    it('should merge object schemas with different fields', () => {
      const schemas: any[] = [
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        },
        {
          type: 'object',
          properties: { age: { type: 'number' } },
          required: ['age']
        }
      ];
      
      const merged = mergeSchemas(schemas);
      expect(merged.type).toBe('object');
      expect(merged.properties!.name).toBeDefined();
      expect(merged.properties!.age).toBeDefined();
      expect(merged.required).toBeUndefined(); // Neither is in all schemas
    });

    it('should handle array schemas', () => {
      const schemas: any[] = [
        { type: 'array', items: { type: 'number' } },
        { type: 'array', items: { type: 'number' } }
      ];
      
      const merged = mergeSchemas(schemas);
      expect(merged.type).toBe('array');
      expect(merged.items!.type).toBe('number');
    });
  });

  describe('simplifySchema', () => {
    it('should limit depth of nested objects', () => {
      const schema: any = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const simplified = simplifySchema(schema, 2);
      expect(simplified.properties!.level1.properties!.level2.properties).toBeUndefined();
    });

    it('should preserve structure within max depth', () => {
      const schema: any = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      const simplified = simplifySchema(schema, 3);
      expect(simplified.properties!.name.type).toBe('string');
      expect(simplified.properties!.age.type).toBe('number');
      expect(simplified.required).toEqual(['name', 'age']);
    });
  });
});
