import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@hexapanel.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123456";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin déjà présent:", email);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, role: "admin" },
  });
  console.log("Admin seed:", email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
