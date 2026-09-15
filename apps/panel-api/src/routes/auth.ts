import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { toPublicUser } from "../serializers.js";
import {
  requireAuth,
  signToken,
  type AuthedRequest,
} from "../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email ou mot de passe invalide (min. 6 caractères)" });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email déjà utilisé" });
    return;
  }

  const count = await prisma.user.count();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: count === 0 ? "admin" : "user",
    },
  });

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as "admin" | "user",
  });

  res.status(201).json({ token, user: toPublicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email ou mot de passe invalide" });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as "admin" | "user",
  });

  res.json({ token, user: toPublicUser(user) });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }
  res.json({ user: toPublicUser(user) });
});
