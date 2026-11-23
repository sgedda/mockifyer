import { Faker, en } from '@faker-js/faker';
import { hashSeed } from './prng';

/**
 * Create a Faker instance seeded for deterministic output.
 *
 * Uses a single locale (`en`) so browser bundles stay reasonable.
 * SGE-71 can switch locale via {@link GenerateOptions.locale} by extending
 * this helper (e.g. dynamic locale map) without changing the public API.
 */
export function createSeededFaker(seed: number | string): Faker {
  const faker = new Faker({ locale: [en] });
  // faker.seed expects number | number[]; use our FNV-hashed 32-bit int
  faker.seed(hashSeed(seed) || 1);
  return faker;
}
