import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4201');

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  homeBase: string;
  jetLagTolerance: number;
  preferredChaos: 'mild' | 'spicy' | 'existential';
  passportColor: string;
  bio: string;
  notifications: {
    serendipityPings: boolean;
    luggageLottery: boolean;
    weatherWeirdness: boolean;
  };
}

interface AuthUser extends UserProfile {
  password: string;
}

const USERS: AuthUser[] = [
  {
    id: 'u-wanderer',
    username: 'wanderer',
    password: 'wanderer',
    displayName: 'Casey Compass',
    email: 'casey@wanderweird.mock',
    homeBase: 'Lisbon',
    jetLagTolerance: 62,
    preferredChaos: 'spicy',
    passportColor: '#FF5C4D',
    bio: 'Weekend trips, packing lists, and long walks in new cities.',
    notifications: {
      serendipityPings: true,
      luggageLottery: true,
      weatherWeirdness: true,
    },
  },
  {
    id: 'u-jetlag',
    username: 'jetlag',
    password: 'jetlag',
    displayName: 'Riley Timezone',
    email: 'riley@wanderweird.mock',
    homeBase: 'Berlin',
    jetLagTolerance: 18,
    preferredChaos: 'existential',
    passportColor: '#3DDC97',
    bio: 'Frequent flyer. Always chasing a good café near the hotel.',
    notifications: {
      serendipityPings: false,
      luggageLottery: true,
      weatherWeirdness: true,
    },
  },
];

const sessions = new Map<string, string>();

function stripPassword(user: AuthUser): UserProfile {
  const { password: _password, ...profile } = user;
  return profile;
}

function findUserByToken(authHeader: string | undefined): AuthUser | undefined {
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const userId = sessions.get(token);
  if (!userId) {
    return undefined;
  }
  return USERS.find((u) => u.id === userId);
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'auth-api' });

  const app = express();
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'auth-api' });
  });

  app.post('/login', (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = USERS.find((u) => u.username === username && u.password === password);

    if (!user) {
      res.status(401).json({
        error: 'invalid_credentials',
        hint: 'Try wanderer / wanderer or jetlag / jetlag',
      });
      return;
    }

    const token = `ww_${user.id}_${Date.now()}`;
    sessions.set(token, user.id);

    res.json({
      token,
      user: stripPassword(user),
      welcomeMessage: `Welcome back, ${user.displayName}.`,
    });
  });

  app.get('/me', (req, res) => {
    const user = findUserByToken(req.header('authorization') ?? undefined);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: stripPassword(user) });
  });

  app.patch('/me', (req, res) => {
    const user = findUserByToken(req.header('authorization') ?? undefined);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const body = req.body ?? {};
    if (typeof body.displayName === 'string' && body.displayName.trim()) {
      user.displayName = body.displayName.trim();
    }
    if (typeof body.homeBase === 'string' && body.homeBase.trim()) {
      user.homeBase = body.homeBase.trim();
    }
    if (typeof body.bio === 'string') {
      user.bio = body.bio;
    }
    if (typeof body.jetLagTolerance === 'number') {
      user.jetLagTolerance = Math.max(0, Math.min(100, body.jetLagTolerance));
    }
    if (body.preferredChaos === 'mild' || body.preferredChaos === 'spicy' || body.preferredChaos === 'existential') {
      user.preferredChaos = body.preferredChaos;
    }
    if (typeof body.passportColor === 'string' && body.passportColor.trim()) {
      user.passportColor = body.passportColor.trim();
    }
    if (body.notifications && typeof body.notifications === 'object') {
      user.notifications = {
        ...user.notifications,
        ...body.notifications,
      };
    }

    res.json({ user: stripPassword(user) });
  });

  app.post('/logout', (req, res) => {
    const authHeader = req.header('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      sessions.delete(authHeader.slice('Bearer '.length).trim());
    }
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    console.log(`[auth-api] http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[auth-api] fatal', err);
  process.exit(1);
});
