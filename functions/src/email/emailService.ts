/**
 * Email service using Nodemailer + Gmail SMTP
 */

import * as nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Get email config from environment variables
const loadEnvFromYaml = (): Record<string, string> => {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env.yaml'),
    path.resolve(process.cwd(), 'functions', '.env.yaml'),
    path.resolve(__dirname, '..', '..', '.env.yaml'),
  ];

  for (const filePath of candidatePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const env: Record<string, string> = {};

      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .forEach((line) => {
          const match = line.match(/^([A-Z0-9_]+)\s*:\s*(.*)$/);
          if (!match) return;
          const key = match[1];
          let value = match[2] || '';
          value = value.replace(/^['"]|['"]$/g, '');
          env[key] = value;
        });

      return env;
    } catch {
      // Ignore and try next path
    }
  }

  return {};
};

const getEmailConfig = () => {
  const yamlEnv = loadEnvFromYaml();
  const email = process.env.GMAIL_EMAIL || yamlEnv.GMAIL_EMAIL;
  const password = process.env.GMAIL_PASSWORD || yamlEnv.GMAIL_PASSWORD;
  const recipient =
    process.env.RECIPIENT_EMAIL ||
    yamlEnv.RECIPIENT_EMAIL ||
    process.env.GMAIL_EMAIL ||
    yamlEnv.GMAIL_EMAIL;

  return { email, password, recipient };
};

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

const getRecipientEmails = async (fallback?: string): Promise<string[]> => {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }

    const snap = await admin.firestore().collection('email_addresses').doc('recipients').get();
    const emails = snap.exists ? snap.get('emails') : [];

    if (Array.isArray(emails)) {
      const cleaned = Array.from(
        new Set(
          emails
            .map((e) => String(e).trim().toLowerCase())
            .filter((e) => isValidEmail(e))
        )
      );
      if (cleaned.length > 0) return cleaned;
    }
  } catch (error) {
    console.warn('Failed to load recipient emails from Firestore', error);
  }

  if (fallback && isValidEmail(fallback)) return [fallback];
  return [];
};

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;
  
  const config = getEmailConfig();
  
  if (!config.email || !config.password) {
    console.error('Gmail credentials not configured. Please set GMAIL_EMAIL and GMAIL_PASSWORD');
    throw new Error('Email configuration missing');
  }
  
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email,
      pass: config.password,
    },
  });
  
  return transporter;
};

/**
 * Send email using Gmail SMTP
 */
export async function sendEmail(options: {
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const config = getEmailConfig();
    const transport = getTransporter();
    const recipients = await getRecipientEmails(config.recipient);

    if (!recipients.length) {
      throw new Error('No recipient emails configured');
    }
    
    const mailOptions = {
      from: `TerraTrak Dashboard <${config.email}>`,
      to: recipients,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };
    
    const result = await transport.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Format timestamp for email display
 */
export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return 'Unknown';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
