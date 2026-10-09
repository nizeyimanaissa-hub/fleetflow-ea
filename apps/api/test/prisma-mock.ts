import { type Mock } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';

export type PrismaMock = Record<string, Record<string, Mock>> & {
  $transaction: Mock;
};

/**
 * A stand-in for PrismaService in unit tests. Any `prisma.<model>.<method>`
 * is a vi.fn() created on first access (resolving to undefined until a test
 * sets it), and `$transaction` resolves an array of operations the way
 * Prisma does.
 */
export function createPrismaMock(): PrismaMock {
  const models = new Map<string, Record<string, Mock>>();
  const $transaction = vi.fn((operations: unknown[]) =>
    Promise.all(operations),
  );

  return new Proxy({} as PrismaMock, {
    get(_target, model: string) {
      if (model === '$transaction') {
        return $transaction;
      }
      if (!models.has(model)) {
        const methods = new Map<string, Mock>();
        models.set(
          model,
          new Proxy({} as Record<string, Mock>, {
            get(_t, method: string) {
              if (!methods.has(method)) {
                methods.set(method, vi.fn());
              }
              return methods.get(method);
            },
          }),
        );
      }
      return models.get(model);
    },
  });
}

/** Casts the mock to what service constructors expect. */
export const asPrisma = (mock: PrismaMock) => mock as unknown as PrismaService;
