import express from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const router = express.Router();

const VOTES_FILE = path.join(__dirname, '../../feature-votes.json');
const USER_VOTES_FILE = path.join(__dirname, '../../user-votes.json');
const IP_VOTES_FILE = path.join(__dirname, '../../ip-votes.json');
const COOKIE_NAME = 'mockifyer-user-id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// Initialize files if they don't exist
if (!fs.existsSync(VOTES_FILE)) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify({}), 'utf-8');
}
if (!fs.existsSync(USER_VOTES_FILE)) {
  fs.writeFileSync(USER_VOTES_FILE, JSON.stringify({}), 'utf-8');
}
if (!fs.existsSync(IP_VOTES_FILE)) {
  fs.writeFileSync(IP_VOTES_FILE, JSON.stringify({}), 'utf-8');
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
    const data = fs.readFileSync(USER_VOTES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Helper to write user votes
function writeUserVotes(userVotes: Record<string, string[]>): void {
  fs.writeFileSync(USER_VOTES_FILE, JSON.stringify(userVotes, null, 2), 'utf-8');
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
  // First try to read from file
  let votes: Record<string, number> = {};
  try {
    if (fs.existsSync(VOTES_FILE)) {
      const data = fs.readFileSync(VOTES_FILE, 'utf-8');
      votes = JSON.parse(data);
    }
  } catch (error) {
    console.warn('[FeatureVotes] Could not read votes file, recalculating:', error);
  }
  
  // Recalculate from user votes to ensure consistency and restore any missing votes
  const recalculatedVotes = recalculateVotes();
  
  // Merge: use recalculated votes as source of truth, but keep any features that might exist in file but not in user votes yet
  // This handles edge cases where vote file might have data but user votes file doesn't
  const mergedVotes = { ...votes, ...recalculatedVotes };
  
  // If recalculated votes differ from file, update the file (restore consistency)
  const needsUpdate = JSON.stringify(mergedVotes) !== JSON.stringify(votes);
  if (needsUpdate) {
    try {
      fs.writeFileSync(VOTES_FILE, JSON.stringify(mergedVotes, null, 2), 'utf-8');
    } catch (error) {
      console.error('[FeatureVotes] Could not write votes file:', error);
    }
  }
  
  return mergedVotes;
}

// Helper to write vote counts
function writeVotes(votes: Record<string, number>): void {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2), 'utf-8');
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
    const data = fs.readFileSync(IP_VOTES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Helper to write IP votes
function writeIpVotes(ipVotes: Record<string, string[]>): void {
  fs.writeFileSync(IP_VOTES_FILE, JSON.stringify(ipVotes, null, 2), 'utf-8');
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

