import nodemailer from 'nodemailer';

const CONTACT_EMAIL = 'sebastian.gedda@gmail.com';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;
let verificationAttempted = false;
let verificationFailed = false;

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  // If we already have a verified transporter, return it
  if (transporter && !verificationFailed) {
    return transporter;
  }

  // If verification previously failed, don't retry on every request
  if (verificationFailed) {
    return null;
  }

  // Check if email is configured via environment variables
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // If SMTP is not configured, return null (emails won't be sent)
  if (!smtpHost || !smtpUser || !smtpPassword) {
    if (!verificationAttempted) {
      console.error('[Email] ❌ SMTP NOT CONFIGURED - Emails will not be sent!');
      console.error('[Email] Missing environment variables:');
      console.error(`[Email]   SMTP_HOST: ${smtpHost || '❌ NOT SET'}`);
      console.error(`[Email]   SMTP_USER: ${smtpUser || '❌ NOT SET'}`);
      console.error(`[Email]   SMTP_PASSWORD: ${smtpPassword ? '✅ SET' : '❌ NOT SET'}`);
      console.error('[Email] Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables to enable email notifications.');
      verificationAttempted = true;
    }
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Add connection timeout to prevent hanging
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
      // Add debug logging
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    });

    // Verify connection with timeout (5 seconds max)
    // Don't block the request if verification fails - we'll try to send anyway
    try {
      await withTimeout(transporter.verify(), 5000);
      console.log(`[Email] ✅ SMTP transporter configured and verified for ${smtpHost}:${smtpPort}`);
      console.log(`[Email] Sending emails to: ${CONTACT_EMAIL}`);
      verificationAttempted = true;
      return transporter;
    } catch (verifyError: any) {
      console.warn('[Email] ⚠️ SMTP verification failed or timed out, but transporter created. Emails may still work.');
      console.warn('[Email] Verification error:', verifyError.message);
      // Don't mark as failed - allow sending to proceed (some SMTP servers don't support verify)
      verificationAttempted = true;
      return transporter;
    }
  } catch (error: any) {
    console.error('[Email] ❌ Failed to create SMTP transporter');
    console.error('[Email] Error:', error.message);
    if (error.code) {
      console.error('[Email] Error code:', error.code);
    }
    verificationFailed = true;
    verificationAttempted = true;
    transporter = null;
    return null;
  }
}

export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip?: string;
}

export async function sendContactEmail(submission: ContactSubmission): Promise<boolean> {
  const emailTransporter = await getTransporter();
  
  if (!emailTransporter) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    
    console.error('[Email] ❌ Cannot send email - SMTP not configured');
    console.error('[Email] Missing environment variables:');
    console.error(`[Email]   SMTP_HOST: ${smtpHost || '❌ NOT SET'}`);
    console.error(`[Email]   SMTP_USER: ${smtpUser || '❌ NOT SET'}`);
    console.error(`[Email]   SMTP_PASSWORD: ${smtpPassword ? '✅ SET (hidden)' : '❌ NOT SET'}`);
    console.error('[Email] Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Mockifyer Contact Form" <${process.env.SMTP_USER}>`,
      to: CONTACT_EMAIL,
      replyTo: submission.email,
      subject: `[Mockifyer Contact] ${submission.subject}`,
      text: `
New contact form submission from Mockifyer website:

Name: ${submission.name}
Email: ${submission.email}
Subject: ${submission.subject}
IP Address: ${submission.ip || 'unknown'}

Message:
${submission.message}

---
This message was sent from the Mockifyer contact form.
You can reply directly to this email to respond to ${submission.name}.
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
            <p><strong>Email:</strong> <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></p>
            <p><strong>Subject:</strong> ${escapeHtml(submission.subject)}</p>
            ${submission.ip ? `<p><strong>IP Address:</strong> ${escapeHtml(submission.ip)}</p>` : ''}
          </div>
          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Message:</h3>
            <div style="background-color: #fff; padding: 15px; border-left: 4px solid #007bff; white-space: pre-wrap;">${escapeHtml(submission.message)}</div>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            This message was sent from the Mockifyer contact form.<br>
            You can reply directly to this email to respond to ${escapeHtml(submission.name)}.
          </p>
        </div>
      `.trim(),
    };

    console.log(`[Email] Attempting to send email to ${CONTACT_EMAIL} from ${process.env.SMTP_USER}`);
    // Add timeout to prevent hanging (30 seconds should be enough for most SMTP servers)
    const info = await withTimeout(emailTransporter.sendMail(mailOptions), 30000);
    console.log(`[Email] ✅ Contact form email sent successfully!`);
    console.log(`[Email] Message ID: ${info.messageId}`);
    console.log(`[Email] Response: ${info.response}`);
    return true;
  } catch (error: any) {
    console.error('[Email] ❌ Failed to send contact form email');
    console.error('[Email] Error code:', error.code);
    console.error('[Email] Error message:', error.message);
    if (error.response) {
      console.error('[Email] SMTP Response:', error.response);
    }
    if (error.responseCode) {
      console.error('[Email] Response Code:', error.responseCode);
    }
    console.error('[Email] Full error:', error);
    return false;
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

