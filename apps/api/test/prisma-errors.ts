import { Prisma } from '../src/generated/prisma/client.js';

/** The error Prisma throws when a unique constraint is violated. */
export const uniqueConstraintError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

/** A known Prisma error that is not a unique-constraint violation. */
export const foreignKeyError = () =>
  new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test',
  });
