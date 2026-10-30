// Sends email through Brevo's web API. Render's free plan blocks normal email (SMTP) ports,
// so an HTTP API is used instead. Needs BREVO_API_KEY and MAIL_FROM (a sender address you
// have verified in Brevo). Without them, emails are only printed in the server log.
export const mailEnabled = () => !!(process.env.BREVO_API_KEY && process.env.MAIL_FROM);

export async function sendMail(to, subject, text) {
  if (!mailEnabled()) {
    console.log(`[EMAIL to ${to}] ${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Maison Lilac', email: process.env.MAIL_FROM }, to: [{ email: to }], subject, textContent: text }),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
}
