import express from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const router = express.Router();

const COOKIE_NAME = 'mockifyer-user-id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// Determine persisted directory path (Railway volume or local)
// This function is called dynamically at runtime to ensure Railway volumes are available
// Matches the pattern used in mocks.ts which successfully persists files
function getPersistedDir(): string {
  // Check for MOCKIFYER_PATH first (for consistency with mocks.ts)
  if (process.env.MOCKIFYER_PATH) {
    const basePath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
    // For feature votes, we want the persisted root, not mock-data subdirectory
    if (basePath.includes('mock-data')) {
      // Go up one level if it's mock-data path
      return path.dirname(basePath);
    }
    return basePath;
  }
  
  // Check for Railway environment or if /persisted exists (matches mocks.ts pattern)
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID || fs.existsSync('/persisted')) {
    return '/persisted';
  }
  
  // Local development: use persisted/ in project directory (using process.cwd() like mocks.ts)
  return path.join(process.cwd(), 'persisted');
}

// Get vote file paths dynamically (called at runtime, not module load time)
function getVotesFilePath(): string {
  const persistedDir = getPersistedDir();
  return path.join(persistedDir, 'feature-votes.json');
}

function getUserVotesFilePath(): string {
  const persistedDir = getPersistedDir();
  return path.join(persistedDir, 'user-votes.json');
}

function getIpVotesFilePath(): string {
  const persistedDir = getPersistedDir();
  return path.join(persistedDir, 'ip-votes.json');
}

// Track if we've logged the persisted directory path (to avoid spam)
let persistedDirLogged = false;

// Ensure persisted directory and files exist (called at runtime)
// Only creates directories/files in development - in production, Railway volume must exist
function ensurePersistedFilesExist(): void {
  try {
    const persistedDir = getPersistedDir();
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.RAILWAY_ENVIRONMENT || 
                         process.env.RAILWAY_ENVIRONMENT_ID;
    
    // Log persisted directory path once on first initialization
    if (!persistedDirLogged) {
      console.log(`[FeatureVotes] Using persisted directory: ${persistedDir}`);
      if (isProduction && persistedDir !== '/persisted') {
        console.error('[FeatureVotes] ⚠️  WARNING: In production but not using /persisted volume!');
      }
      persistedDirLogged = true;
    }
    
    // In production, don't create /persisted - it must be a Railway volume mount
    // In development, create the directory if it doesn't exist
    if (!fs.existsSync(persistedDir)) {
      if (isProduction && persistedDir === '/persisted') {
        console.error('[FeatureVotes] ❌ Cannot create /persisted - it must be a Railway volume!');
        console.error('[FeatureVotes] Please ensure volume is mounted at /persisted in Railway dashboard');
        // Don't throw - let individual operations handle the error gracefully
        return;
      } else {
        // Development: create directory
        fs.mkdirSync(persistedDir, { recursive: true });
        console.log(`[FeatureVotes] Created persisted directory: ${persistedDir}`);
      }
    }
    
    // Initialize files if they don't exist (only if directory exists)
    if (fs.existsSync(persistedDir)) {
      const votesFile = getVotesFilePath();
      const userVotesFile = getUserVotesFilePath();
      const ipVotesFile = getIpVotesFilePath();
      
      if (!fs.existsSync(votesFile)) {
        fs.writeFileSync(votesFile, JSON.stringify({}), 'utf-8');
        console.log(`[FeatureVotes] Created votes file: ${votesFile}`);
      }
      if (!fs.existsSync(userVotesFile)) {
        fs.writeFileSync(userVotesFile, JSON.stringify({}), 'utf-8');
        console.log(`[FeatureVotes] Created user votes file: ${userVotesFile}`);
      }
      if (!fs.existsSync(ipVotesFile)) {
        fs.writeFileSync(ipVotesFile, JSON.stringify({}), 'utf-8');
        console.log(`[FeatureVotes] Created IP votes file: ${ipVotesFile}`);
      }
    }
  } catch (error) {
    console.error('[FeatureVotes] Failed to initialize persisted files:', error);
    // Don't throw - let individual operations handle errors
  }
}

// Helper to get or create user ID from cookie
function getOrCreateUserId(req: express.Request, res: express.Response): string {
  let userId: string | undefined = (req as any).cookies?.[COOKIE_NAME];
  
  if (!userId) {
    userId = randomUUID();
    res.cookie(COOKIE_NAME, userId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }
  
  return userId;
}

// Helper to read user votes
function readUserVotes(): Record<string, string[]> {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before reading
    const userVotesFile = getUserVotesFilePath();
    const data = fs.readFileSync(userVotesFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[FeatureVotes] Error reading user votes:', error);
    return {};
  }
}

// Helper to write user votes
function writeUserVotes(userVotes: Record<string, string[]>): void {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before writing
    const userVotesFile = getUserVotesFilePath();
    fs.writeFileSync(userVotesFile, JSON.stringify(userVotes, null, 2), 'utf-8');
  } catch (error) {
    console.error('[FeatureVotes] Error writing user votes:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Helper to recalculate vote counts from user votes (ensures consistency)
function recalculateVotes(): Record<string, number> {
  const userVotes = readUserVotes();
  const votes: Record<string, number> = {};
  
  // Count votes for each feature by iterating through all users' votes
  for (const userId in userVotes) {
    const userFeatureVotes = userVotes[userId] || [];
    for (const featureId of userFeatureVotes) {
      votes[featureId] = (votes[featureId] || 0) + 1;
    }
  }
  
  return votes;
}

// Helper to read vote counts (with restoration from user votes)
function readVotes(): Record<string, number> {
  // Recalculate from user votes - this is the source of truth
  const recalculatedVotes = recalculateVotes();
  
  // Read current file to check if update is needed (avoid unnecessary writes)
  let fileVotes: Record<string, number> = {};
  try {
    ensurePersistedFilesExist(); // Ensure files exist before reading
    const votesFile = getVotesFilePath();
    if (fs.existsSync(votesFile)) {
      const data = fs.readFileSync(votesFile, 'utf-8');
      fileVotes = JSON.parse(data);
    }
  } catch (error) {
    console.warn('[FeatureVotes] Could not read votes file, will update:', error);
  }
  
  // Use recalculated votes as source of truth (derived from user votes)
  // Only update file if it differs from recalculated votes
  const needsUpdate = JSON.stringify(recalculatedVotes) !== JSON.stringify(fileVotes);
  if (needsUpdate) {
    try {
      ensurePersistedFilesExist(); // Ensure files exist before writing
      const votesFile = getVotesFilePath();
      fs.writeFileSync(votesFile, JSON.stringify(recalculatedVotes, null, 2), 'utf-8');
    } catch (error) {
      console.error('[FeatureVotes] Could not write votes file:', error);
    }
  }
  
  return recalculatedVotes;
}

// Helper to write vote counts
function writeVotes(votes: Record<string, number>): void {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before writing
    const votesFile = getVotesFilePath();
    fs.writeFileSync(votesFile, JSON.stringify(votes, null, 2), 'utf-8');
  } catch (error) {
    console.error('[FeatureVotes] Error writing votes:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Helper to get client IP address
function getClientIp(req: express.Request): string {
  // Check various headers for IP (handles proxies, load balancers, etc.)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Helper to read IP votes
function readIpVotes(): Record<string, string[]> {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before reading
    const ipVotesFile = getIpVotesFilePath();
    const data = fs.readFileSync(ipVotesFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[FeatureVotes] Error reading IP votes:', error);
    return {};
  }
}

// Helper to write IP votes
function writeIpVotes(ipVotes: Record<string, string[]>): void {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before writing
    const ipVotesFile = getIpVotesFilePath();
    fs.writeFileSync(ipVotesFile, JSON.stringify(ipVotes, null, 2), 'utf-8');
  } catch (error) {
    console.error('[FeatureVotes] Error writing IP votes:', error);
    throw error; // Re-throw to let caller handle
  }
}

// Helper to check if IP has voted for a feature
function hasIpVoted(ip: string, featureId: string): boolean {
  const ipVotes = readIpVotes();
  return (ipVotes[ip] || []).includes(featureId);
}

// Helper to add IP vote
function addIpVote(ip: string, featureId: string): void {
  const ipVotes = readIpVotes();
  if (!ipVotes[ip]) {
    ipVotes[ip] = [];
  }
  if (!ipVotes[ip].includes(featureId)) {
    ipVotes[ip].push(featureId);
  }
  writeIpVotes(ipVotes);
}

// Helper to remove IP vote
function removeIpVote(ip: string, featureId: string): void {
  const ipVotes = readIpVotes();
  if (ipVotes[ip]) {
    ipVotes[ip] = ipVotes[ip].filter(id => id !== featureId);
    writeIpVotes(ipVotes);
  }
}

// Get all feature votes and user's voted features
router.get('/', (req: express.Request, res: express.Response) => {
  try {
    const userId = getOrCreateUserId(req, res);
    const votes = readVotes();
    const userVotes = readUserVotes();
    
    res.json({
      votes,
      userVotedFeatures: userVotes[userId] || [],
    });
  } catch (error: any) {
    console.error('[FeatureVotes] GET Error:', error);
    res.status(500).json({ error: 'Failed to load votes', details: error.message });
  }
});

// Toggle vote (vote or unvote)
router.post('/:featureId/toggle', (req: express.Request, res: express.Response) => {
  try {
    const { featureId } = req.params;
    const userId = getOrCreateUserId(req, res);
    const clientIp = getClientIp(req);
    
    // Read current state
    const votes = readVotes();
    const userVotes = readUserVotes();
    
    // Initialize user's vote list if needed
    if (!userVotes[userId]) {
      userVotes[userId] = [];
    }
    
    const hasVoted = userVotes[userId].includes(featureId);
    const hasIpVotedForFeature = hasIpVoted(clientIp, featureId);
    
    if (hasVoted) {
      // Unvote: remove from user's list and decrement count
      userVotes[userId] = userVotes[userId].filter(id => id !== featureId);
      votes[featureId] = Math.max(0, (votes[featureId] || 0) - 1);
      removeIpVote(clientIp, featureId);
    } else {
      // Check if IP has already voted (prevents incognito bypass)
      if (hasIpVotedForFeature) {
        return res.status(403).json({ 
          success: false,
          error: 'You have already voted for this feature from this network',
          featureId,
          voteCount: votes[featureId] || 0,
          hasVoted: false,
        });
      }
      
      // Vote: add to user's list and increment count
      userVotes[userId].push(featureId);
      votes[featureId] = (votes[featureId] || 0) + 1;
      addIpVote(clientIp, featureId);
    }
    
    // Save changes
    writeUserVotes(userVotes);
    writeVotes(votes);
    
    res.json({ 
      success: true, 
      featureId, 
      voteCount: votes[featureId] || 0,
      hasVoted: !hasVoted,
    });
  } catch (error: any) {
    console.error('[FeatureVotes] Toggle Error:', error);
    res.status(500).json({ error: 'Failed to toggle vote', details: error.message });
  }
});

// Legacy POST endpoint for backward compatibility (now just calls toggle)
router.post('/:featureId', async (req: express.Request, res: express.Response) => {
  // Call toggle endpoint logic directly
  try {
    const { featureId } = req.params;
    const userId = getOrCreateUserId(req, res);
    const clientIp = getClientIp(req);
    
    // Read current state
    const votes = readVotes();
    const userVotes = readUserVotes();
    
    // Initialize user's vote list if needed
    if (!userVotes[userId]) {
      userVotes[userId] = [];
    }
    
    const hasVoted = userVotes[userId].includes(featureId);
    const hasIpVotedForFeature = hasIpVoted(clientIp, featureId);
    
    // Only vote if not already voted (legacy behavior)
    if (!hasVoted) {
      // Check if IP has already voted (prevents incognito bypass)
      if (hasIpVotedForFeature) {
        return res.status(403).json({ 
          success: false,
          error: 'You have already voted for this feature from this network',
          featureId,
          voteCount: votes[featureId] || 0,
          hasVoted: false,
        });
      }
      
      userVotes[userId].push(featureId);
      votes[featureId] = (votes[featureId] || 0) + 1;
      addIpVote(clientIp, featureId);
      
      // Save changes
      writeUserVotes(userVotes);
      writeVotes(votes);
    }
    
    res.json({ 
      success: true, 
      featureId, 
      voteCount: votes[featureId] || 0,
      hasVoted: true,
    });
  } catch (error: any) {
    console.error('[FeatureVotes] POST Error:', error);
    res.status(500).json({ error: 'Failed to save vote', details: error.message });
  }
});

export { router as featureVotesRouter };

