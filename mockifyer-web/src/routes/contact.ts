import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { sendContactEmail } from '../services/email';

const router = express.Router();

// Rate limiting storage (in-memory, resets on server restart)
// In production, consider using Redis or a proper rate limiting library
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_HOUR = 3; // Max 3 submissions per IP per hour
const MAX_SUBMISSIONS_PER_EMAIL = 2; // Max 2 submissions per email per hour
const MIN_FORM_FILL_TIME_MS = 3000; // Minimum 3 seconds to fill form (bots fill instantly)

// Determine persisted directory path (Railway volume or local)
// This function is called dynamically at runtime to ensure Railway volumes are available
function getPersistedDir(): string {
  // Check for Railway environment variables (more reliable than checking file system)
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_ENVIRONMENT_ID || 
                       process.env.RAILWAY_PROJECT_ID;
  
  if (isProduction) {
    const railwayPath = '/persisted';
    
    // In production, /persisted MUST be a Railway volume mount - don't try to create it
    // Check if it exists and is writable (but don't block or wait)
    if (fs.existsSync(railwayPath)) {
      try {
        // Verify it's actually a directory (not a file)
        const stats = fs.statSync(railwayPath);
        if (!stats.isDirectory()) {
          console.error('[Contact] ❌ /persisted exists but is not a directory!');
          // Still return it, but log the error
          return railwayPath;
        }
        
        // Verify we can actually write to this directory
        const testFile = path.join(railwayPath, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        return railwayPath;
      } catch (error) {
        console.error('[Contact] ❌ Railway volume /persisted exists but is not writable:', error);
        console.error('[Contact] Make sure volume is properly mounted at /persisted in Railway dashboard');
        // In production, still return railway path - don't fall back to local (would cause data loss)
        return railwayPath;
      }
    } else {
      // Volume not mounted yet - this is OK during build, will be available at runtime
      // Log warning but don't block or wait (that caused Railway build timeouts)
      console.warn('[Contact] ⚠️  Railway volume not mounted yet at /persisted');
      console.warn('[Contact] This is normal during build. Volume will be checked again on first request.');
      // Return railway path anyway - it will be available when the app runs
      return railwayPath;
    }
  }
  
  // Check if /persisted exists (for Railway volumes that might be mounted but env vars not set)
  if (fs.existsSync('/persisted')) {
    try {
      // Verify we can write to it
      const testFile = path.join('/persisted', '.test-write');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return '/persisted';
    } catch (error) {
      console.warn('[Contact] /persisted exists but is not writable, falling back to local:', error);
      // Fall through to local path
    }
  }
  
  // Local development: use persisted/ in project directory (using process.cwd() for better compatibility)
  const localPath = path.join(process.cwd(), 'persisted');
  return localPath;
}

// Get contact submissions file path dynamically (called at runtime, not module load time)
function getContactSubmissionsFilePath(): string {
  const persistedDir = getPersistedDir();
  return path.join(persistedDir, 'contact-submissions.json');
}

// Common spam keywords/phrases
const SPAM_KEYWORDS = [
  'viagra', 'cialis', 'casino', 'poker', 'lottery', 'winner', 'prize',
  'click here', 'buy now', 'limited time', 'act now', 'urgent',
  'make money', 'work from home', 'get rich', 'guaranteed',
  'free money', 'no credit check', 'debt relief', 'loan',
  'seo services', 'backlinks', 'increase traffic', 'rank higher',
  'crypto', 'bitcoin', 'investment opportunity', 'forex',
  'pharmacy', 'prescription', 'medication', 'pills',
];

// Track form start times (in-memory, resets on server restart)
const formStartTimes: Map<string, number> = new Map();

// Ensure persisted directory and file exist (called at runtime, not module load time)
function ensurePersistedFilesExist(): void {
  try {
    const persistedDir = getPersistedDir();
    
    // In production, don't create /persisted - it must be a Railway volume
    const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_ENVIRONMENT_ID;
    
    if (!fs.existsSync(persistedDir)) {
      if (isProduction && persistedDir === '/persisted') {
        console.error('[Contact] ❌ Cannot create /persisted - it must be a Railway volume!');
        console.error('[Contact] Please ensure volume is mounted at /persisted in Railway dashboard');
        // Don't throw - let individual operations handle the error gracefully
      } else {
        fs.mkdirSync(persistedDir, { recursive: true });
      }
    }
    
    // Initialize submissions file if it doesn't exist
    const submissionsFile = getContactSubmissionsFilePath();
    if (!fs.existsSync(submissionsFile)) {
      fs.writeFileSync(submissionsFile, JSON.stringify([]), 'utf-8');
    }
  } catch (error) {
    console.error('[Contact] Failed to initialize persisted directory:', error);
    // Don't crash - file operations will handle errors gracefully later
  }
}

// Helper to get client IP address
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Helper to check rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // No entry or window expired, create new entry
    rateLimitStore.set(ip, {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: MAX_SUBMISSIONS_PER_HOUR,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (entry.count >= MAX_SUBMISSIONS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: MAX_SUBMISSIONS_PER_HOUR - entry.count - 1,
    resetTime: entry.resetTime,
  };
}

// Helper to increment rate limit counter
function incrementRateLimit(ip: string): void {
  const entry = rateLimitStore.get(ip);
  if (entry) {
    entry.count++;
  }
}

// Helper to check email-based rate limit
function checkEmailRateLimit(email: string): boolean {
  const submissions = readSubmissions();
  const now = Date.now();
  const oneHourAgo = now - RATE_LIMIT_WINDOW_MS;
  
  const recentSubmissions = submissions.filter((sub: any) => {
    if (!sub.timestamp) return false;
    const subTime = new Date(sub.timestamp).getTime();
    return sub.email?.toLowerCase() === email.toLowerCase() && subTime > oneHourAgo;
  });
  
  return recentSubmissions.length < MAX_SUBMISSIONS_PER_EMAIL;
}

// Helper to detect spam content
function containsSpamContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SPAM_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

// Helper to check form fill time
function checkFormFillTime(formStartTime: number | null): boolean {
  if (!formStartTime) {
    // If no start time, assume it's suspicious (form might have been prefilled)
    return false;
  }
  const fillTime = Date.now() - formStartTime;
  return fillTime >= MIN_FORM_FILL_TIME_MS;
}

// Helper to read submissions
function readSubmissions(): any[] {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before reading
    const submissionsFile = getContactSubmissionsFilePath();
    if (!fs.existsSync(submissionsFile)) {
      return [];
    }
    const data = fs.readFileSync(submissionsFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Contact] Error reading submissions:', error);
    return [];
  }
}

// Helper to save submission
function saveSubmission(submission: any): void {
  try {
    ensurePersistedFilesExist(); // Ensure files exist before writing
    const submissions = readSubmissions();
    submissions.push({
      ...submission,
      timestamp: new Date().toISOString(),
    });
    const submissionsFile = getContactSubmissionsFilePath();
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Contact] Error saving submission:', error);
    // Log but don't throw - submission will still be processed
  }
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Endpoint to track form start time
router.post('/start', (req: Request, res: Response) => {
  const sessionId = req.body.sessionId || req.headers['x-session-id'] || Math.random().toString(36).substring(7);
  formStartTimes.set(sessionId, Date.now());
  res.json({ sessionId });
});

// Contact form submission endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message, website, formStartTime, sessionId } = req.body;
    const ip = getClientIp(req);

    // Honeypot check - if website field is filled, it's likely a bot
    if (website && website.trim() !== '') {
      console.warn(`[Contact] Honeypot triggered for IP: ${ip}`);
      // Return success to avoid revealing the honeypot
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    // Time-based validation - check if form was filled too quickly
    let startTime: number | null = null;
    if (formStartTime && typeof formStartTime === 'number') {
      startTime = formStartTime;
    } else if (sessionId && formStartTimes.has(sessionId)) {
      startTime = formStartTimes.get(sessionId)!;
      formStartTimes.delete(sessionId); // Clean up
    }
    
    if (!checkFormFillTime(startTime)) {
      console.warn(`[Contact] Form filled too quickly (suspected bot) from IP: ${ip}, Email: ${email}`);
      // Return success to avoid revealing the check
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Trim and validate lengths
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = (subject || '').trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (trimmedEmail.length > 255) {
      return res.status(400).json({ error: 'Email address is too long' });
    }

    if (trimmedSubject.length > 200) {
      return res.status(400).json({ error: 'Subject must be less than 200 characters' });
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return res.status(400).json({ error: 'Message must be between 10 and 5000 characters' });
    }

    // Spam content detection
    const fullText = `${trimmedSubject} ${trimmedMessage}`.toLowerCase();
    if (containsSpamContent(fullText)) {
      console.warn(`[Contact] Spam content detected from IP: ${ip}, Email: ${trimmedEmail}`);
      // Return success to avoid revealing the check
      return res.status(200).json({ success: true, message: 'Message received' });
    }

    // Check IP-based rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / (60 * 1000));
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        resetInMinutes: resetMinutes,
      });
    }

    // Check email-based rate limit
    if (!checkEmailRateLimit(trimmedEmail)) {
      console.warn(`[Contact] Email rate limit exceeded for: ${trimmedEmail}`);
      return res.status(429).json({
        error: 'Too many requests from this email address. Please try again later.',
      });
    }

    // Increment rate limit counter
    incrementRateLimit(ip);

    // Prepare submission data
    const submission = {
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject || 'Contact Form Submission',
      message: trimmedMessage,
      ip,
    };

    // Save submission
    saveSubmission(submission);

    // Log submission
    console.log(`[Contact] New submission from ${trimmedEmail} (${ip})`);

    // Send email notification (non-blocking - don't fail the request if email fails)
    try {
      const emailSent = await sendContactEmail(submission);
      if (!emailSent) {
        console.error(`[Contact] ❌ EMAIL NOTIFICATION FAILED for submission from ${trimmedEmail}`);
        console.error(`[Contact] Submission was saved, but email was not sent. Check Resend configuration.`);
        console.error(`[Contact] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET' : 'NOT SET'}`);
        console.error(`[Contact] RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || 'NOT SET (using default)'}`);
      } else {
        console.log(`[Contact] ✅ Email notification sent successfully for submission from ${trimmedEmail}`);
      }
    } catch (emailError: any) {
      // Email sending failed, but don't fail the request
      console.error(`[Contact] Email sending error (non-fatal) for submission from ${trimmedEmail}:`, emailError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Message received successfully',
      remaining: rateLimit.remaining,
    });
  } catch (error: any) {
    console.error('[Contact] Error processing submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test email configuration endpoint (for debugging)
router.get('/test-email', async (req: Request, res: Response) => {
  try {
    const testSubmission = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Email Configuration',
      message: 'This is a test email to verify Resend email configuration.',
      ip: getClientIp(req),
    };

    const emailSent = await sendContactEmail(testSubmission);
    
    if (emailSent) {
      res.json({
        success: true,
        message: 'Test email sent successfully! Check sebastian.gedda@gmail.com',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email. Check server logs for details.',
        resendConfigured: !!process.env.RESEND_API_KEY,
      });
    }
  } catch (error: any) {
    console.error('[Contact] Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export { router as contactRouter };

