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
const CONTACT_SUBMISSIONS_FILE = path.join(__dirname, '../../persisted/contact-submissions.json');

// Ensure persisted directory exists
const persistedDir = path.dirname(CONTACT_SUBMISSIONS_FILE);
if (!fs.existsSync(persistedDir)) {
  fs.mkdirSync(persistedDir, { recursive: true });
}

// Initialize submissions file if it doesn't exist
if (!fs.existsSync(CONTACT_SUBMISSIONS_FILE)) {
  fs.writeFileSync(CONTACT_SUBMISSIONS_FILE, JSON.stringify([]), 'utf-8');
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

// Helper to read submissions
function readSubmissions(): any[] {
  try {
    const data = fs.readFileSync(CONTACT_SUBMISSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Contact] Error reading submissions:', error);
    return [];
  }
}

// Helper to save submission
function saveSubmission(submission: any): void {
  try {
    const submissions = readSubmissions();
    submissions.push({
      ...submission,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(CONTACT_SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Contact] Error saving submission:', error);
  }
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contact form submission endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message, website } = req.body;
    const ip = getClientIp(req);

    // Honeypot check - if website field is filled, it's likely a bot
    if (website && website.trim() !== '') {
      console.warn(`[Contact] Honeypot triggered for IP: ${ip}`);
      // Return success to avoid revealing the honeypot
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

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / (60 * 1000));
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        resetInMinutes: resetMinutes,
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

    // Send email notification
    const emailSent = await sendContactEmail(submission);
    if (!emailSent) {
      console.warn(`[Contact] Email notification failed for submission from ${trimmedEmail}, but submission was saved`);
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
      message: 'This is a test email to verify SMTP configuration.',
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
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
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

