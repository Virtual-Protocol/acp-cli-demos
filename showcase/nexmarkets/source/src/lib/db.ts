import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { nexPrisma?: PrismaClient };

export function getPrisma() {
  if (!globalForPrisma.nexPrisma) {
    globalForPrisma.nexPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) })

  }
  return globalForPrisma.nexPrisma;
}
