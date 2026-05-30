import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

/** Drop cached client when schema delegates are missing (e.g. after `prisma generate`). */
function isStalePrismaClient(client: PrismaClientSingleton | undefined): boolean {
  return !client || !("netWorthAccount" in client);
}

let prisma = globalForPrisma.prisma;
if (isStalePrismaClient(prisma)) {
  if (prisma) {
    void prisma.$disconnect().catch(() => {});
  }
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma!;
