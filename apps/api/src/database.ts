import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface Database {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
}
export function prismaDatabase(url: string): { db: Database; close: () => Promise<void> } {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis:10000 }),transactionOptions:{maxWait:10000,timeout:15000} });
  function wrap(c: Pick<PrismaClient, '$queryRawUnsafe'>): Database {
    return {
      query: <T>(sql: string, values: unknown[] = []) => c.$queryRawUnsafe<T[]>(sql, ...values),
      transaction: (fn) => c===client ? client.$transaction(tx => fn(wrap(tx))) : fn(wrap(c)),
    };
  }
  return { db: wrap(client), close: () => client.$disconnect() };
}
