import { Resend } from 'resend';

const CONTACT_EMAIL = 'sebastian.gedda@gmail.com';

// Create reusable Resend client
let resendClient: Resend | null = null;
let verificationAttempted = false;
let verificationFailed = false;

function getResendClient(): Resend | null {
  // If we already have a client, return it
  if (resendClient && !verificationFailed) {
    return resendClient;
  }

  // If verification previously failed, don't retry on every request
  if (verificationFailed) {
    return null;
  }

  // Check if Resend API key is configured
  const resendApiKey = process.env.RESEND_API_KEY;

  // If Resend is not configured, return null (emails won't be sent)
  if (!resendApiKey) {
    if (!verificationAttempted) {
      console.error('[Email] ❌ RESEND NOT CONFIGURED - Emails will not be sent!');
      console.error('[Email] Missing environment variable: RESEND_API_KEY');
      console.error('[Email] Get your API key from https://resend.com/api-keys');
      console.error('[Email] Set RESEND_API_KEY environment variable to enable email notifications.');
      verificationAttempted = true;
    }
    return null;
  }

  try {
    resendClient = new Resend(resendApiKey);
    console.log(`[Email] ✅ Resend client configured`);
    console.log(`[Email] Sending emails to: ${CONTACT_EMAIL}`);
    verificationAttempted = true;
    return resendClient;
  } catch (error: any) {
    console.error('[Email] ❌ Failed to create Resend client');
    console.error('[Email] Error:', error.message);
    verificationFailed = true;
    verificationAttempted = true;
    resendClient = null;
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
  const client = getResendClient();
  
  if (!client) {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    console.error('[Email] ❌ Cannot send email - Resend not configured');
    console.error('[Email] Missing environment variable: RESEND_API_KEY');
    console.error('[Email] Get your API key from https://resend.com/api-keys');
    return false;
  }

  // Get the "from" email address from environment variable or use default
  // Resend requires a verified domain or uses their default domain
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  try {
    const textContent = `
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
    `.trim();

    const htmlContent = `
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
    `.trim();

    console.log(`[Email] Attempting to send email to ${CONTACT_EMAIL} from ${fromEmail}`);
    
    const { data, error } = await client.emails.send({
      from: `Mockifyer Contact Form <${fromEmail}>`,
      to: CONTACT_EMAIL,
      replyTo: submission.email,
      subject: `[Mockifyer Contact] ${submission.subject}`,
      text: textContent,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] ❌ Failed to send contact form email');
      console.error('[Email] Error:', error);
      return false;
    }

    console.log(`[Email] ✅ Contact form email sent successfully!`);
    console.log(`[Email] Message ID: ${data?.id}`);
    return true;
  } catch (error: any) {
    console.error('[Email] ❌ Failed to send contact form email');
    console.error('[Email] Error message:', error.message);
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

