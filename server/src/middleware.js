import jwt from 'jsonwebtoken';

export const COOKIE = 'token';
export const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 3600 * 1000,
});
export const signToken = (u) =>
  jwt.sign({ id: String(u._id), role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Reads the cookie on every request; sets req.user when valid.
export function auth(req, _res, next) {
  const t = req.cookies?.[COOKIE];
  if (t) { try { req.user = jwt.verify(t, process.env.JWT_SECRET); } catch { /* ignore bad token */ } }
  next();
}

// need() = any signed-in user. need('staff','admin') = only those roles. Checked on the server, every time.
export const need = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed.' });
  next();
};
