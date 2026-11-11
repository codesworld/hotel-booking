import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { prisma } from '../db';
import { AppError, conflict, isUniqueViolation } from '../errors';
import { toUserDto } from '../mappers';
import { requireAuth, signAccessToken } from '../middleware/auth';
import { loginSchema, parse, registerSchema } from '../validation';

export const authRouter = Router();

// Used when the email does not exist, so a login for an unknown user takes
// about as long as one with a wrong password (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('timing-protection-only', config.bcryptRounds);

const INVALID_CREDENTIALS = 'Invalid email or password'; // same text for both cases

authRouter.post('/register', async (req, res) => {
  const body = parse(registerSchema, req.body ?? {});
  const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);

  try {
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, fullName: body.fullName, role: 'GUEST' },
    });
    res.status(201).json(toUserDto(user));
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const body = parse(loginSchema, req.body ?? {});
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const passwordOk = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  }

  const { token, expiresIn } = signAccessToken(user);
  res.json({ accessToken: token, tokenType: 'Bearer', expiresIn, user: toUserDto(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json(toUserDto(user));
});
