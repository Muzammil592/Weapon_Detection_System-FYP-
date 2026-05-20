const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@weapon-detection.local';

const hasSmtpConfig = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;

function getTransporter() {
  if (!hasSmtpConfig) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter();

  if (!tx) {
    throw new Error('Email service is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
  }

  const info = await tx.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return info;
}

module.exports = {
  sendEmail,
};
