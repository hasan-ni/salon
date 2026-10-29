// Sends a text message. With TWILIO_SID, TWILIO_TOKEN and TWILIO_FROM set, it uses Twilio.
// Without them it only prints the message in the server log (fine for development).
// Phone numbers must include the country code (for example +447700900123).
export async function sendSms(to, body) {
  const { TWILIO_SID: sid, TWILIO_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (!sid || !token || !from) {
    console.log(`[SMS to ${to}] ${body}`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to.startsWith('+') ? to : '+' + to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`SMS provider returned ${res.status}`);
}
