import { Resend } from 'resend';
import { env } from '../env';
import { createLogger } from '@marketmind/logger';
import { AUTH_EXPIRY } from './auth';

const logger = createLogger('email-service');

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const FROM_EMAIL = 'MarketMind <noreply@marketmind.app>';

const EMAIL_COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  TEXT: '#111827',
  TEXT_SECONDARY: '#374151',
  TEXT_MUTED: '#6b7280',
  BG: '#f4f4f5',
  BG_CARD: '#fff',
  BG_FOOTER: '#f9fafb',
  BG_CODE: '#f3f4f6',
} as const;

const msToHumanReadable = (ms: number): string => {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
  const days = hours / 24;
  return `${days} day${days > 1 ? 's' : ''}`;
};

const sendEmail = async (to: string, subject: string, html: string) => {
  if (!resend) {
    logger.info(`[DEV] Email to=${to} subject="${subject}"`);
    logger.info(html);
    return;
  }

  await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
};

const actionButton = (href: string, label: string, color: string = EMAIL_COLORS.PRIMARY) =>
  `<div style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600">${label}</a></div>`;

const wrapHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:480px;margin:40px auto;background:${EMAIL_COLORS.BG_CARD};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:linear-gradient(135deg,${EMAIL_COLORS.PRIMARY},${EMAIL_COLORS.SUCCESS});padding:32px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:24px">MarketMind</h1>
</div>
<div style="padding:32px">${content}</div>
<div style="padding:16px 32px;background:${EMAIL_COLORS.BG_FOOTER};text-align:center;color:${EMAIL_COLORS.TEXT_MUTED};font-size:12px">
<p style="margin:0">&copy; ${new Date().getFullYear()} MarketMind. All rights reserved.</p>
</div>
</div>
</body>
</html>`;

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${env.APP_URL}/reset-password/${token}`;
  const expiry = msToHumanReadable(AUTH_EXPIRY.PASSWORD_RESET_TOKEN);

  logger.info('Password reset requested', { email, resetUrl });

  await sendEmail(
    email,
    'Reset your password - MarketMind',
    wrapHtml(`
      <h2 style="color:${EMAIL_COLORS.TEXT};margin:0 0 16px">Reset your password</h2>
      <p style="color:${EMAIL_COLORS.TEXT_SECONDARY};line-height:1.6">You requested a password reset for your MarketMind account. Click the button below to set a new password.</p>
      ${actionButton(resetUrl, 'Reset Password')}
      <p style="color:${EMAIL_COLORS.TEXT_MUTED};font-size:13px">This link expires in ${expiry}. If you didn't request this, you can safely ignore this email.</p>
    `)
  );
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const verifyUrl = `${env.APP_URL}/verify-email/${token}`;
  const expiry = msToHumanReadable(AUTH_EXPIRY.EMAIL_VERIFICATION_TOKEN);

  logger.info('Email verification requested', { email, verifyUrl });

  await sendEmail(
    email,
    'Verify your email - MarketMind',
    wrapHtml(`
      <h2 style="color:${EMAIL_COLORS.TEXT};margin:0 0 16px">Verify your email</h2>
      <p style="color:${EMAIL_COLORS.TEXT_SECONDARY};line-height:1.6">Welcome to MarketMind! Please verify your email address by clicking the button below.</p>
      ${actionButton(verifyUrl, 'Verify Email', EMAIL_COLORS.SUCCESS)}
      <p style="color:${EMAIL_COLORS.TEXT_MUTED};font-size:13px">This link expires in ${expiry}.</p>
    `)
  );
};

export const sendTwoFactorCode = async (email: string, code: string) => {
  const expiry = msToHumanReadable(AUTH_EXPIRY.TWO_FACTOR_CODE);

  logger.info('2FA code sent', { email });

  await sendEmail(
    email,
    'Your login code - MarketMind',
    wrapHtml(`
      <h2 style="color:${EMAIL_COLORS.TEXT};margin:0 0 16px">Your login code</h2>
      <p style="color:${EMAIL_COLORS.TEXT_SECONDARY};line-height:1.6">Enter this code to complete your sign-in:</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:${EMAIL_COLORS.BG_CODE};padding:16px 32px;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:${EMAIL_COLORS.TEXT}">${code}</div>
      </div>
      <p style="color:${EMAIL_COLORS.TEXT_MUTED};font-size:13px">This code expires in ${expiry}. If you didn't try to sign in, please change your password immediately.</p>
    `)
  );
};
