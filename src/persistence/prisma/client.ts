import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  founderOsPrisma?: PrismaClient;
};

export function getPrismaClient() {
  globalForPrisma.founderOsPrisma ??= new PrismaClient();
  return globalForPrisma.founderOsPrisma;
}
