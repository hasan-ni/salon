import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { socket } from './socket.js';
import Bell from './components/Bell.jsx';
import { disablePush } from './push.js';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Book from './pages/Book.jsx';
import Staff from './pages/Staff.jsx';
import Display from './pages/Display.jsx';
import Account from './pages/Account.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Only lets the right roles in. The server checks again on every request; this just keeps the screens tidy.
// If you are signed out we remember where you were going, so login can send you back there.
function Guard({ roles, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Material-style icons for the bottom bar on phones.
const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  book: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z',
  staff: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};
const Tab = ({ to, end, icon, label }) => (
  <NavLink to={to} end={end}>
    <span className="ic"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={ICONS[icon]} fill="currentColor" /></svg></span>
    <span>{label}</span>
  </NavLink>
);
// App-style navigation along the bottom of the screen (phones only; hidden on larger screens by CSS).
function BottomNav({ isStaff, user }) {
  return (
    <nav className="bottomnav" aria-label="Main">
      <Tab to="/" end icon="home" label="Home" />
      <Tab to="/book" icon="book" label="Book" />
      {isStaff && <Tab to="/staff" icon="staff" label="Staff" />}
      <Tab to="/account" icon="person" label={user ? 'Account' : 'Sign in'} />
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { api('/auth/me').then((d) => setUser(d.user)).finally(() => setReady(true)); }, []);
  // The live connection reads the login cookie when it connects, so reconnect when someone signs in or out.
  useEffect(() => { socket.disconnect(); socket.connect(); }, [user?.id]);
  const logout = async () => { await disablePush().catch(() => {}); /* stop this device getting the old account's alerts */ await api('/auth/logout', { method: 'POST' }); setUser(null); nav('/'); };
  const isStaff = user && ['staff', 'admin'].includes(user.role);

  return (
    <AuthCtx.Provider value={{ user, setUser, ready, logout }}>
      <Routes>
        <Route path="/display" element={<Display />} />
        <Route path="*" element={
          <div className={'wrap' + (loc.pathname === '/' ? ' wide' : '')}>
            <header>
              <Link to="/" className="brand"><h1>Maison Lilac</h1></Link>
              <nav>
                <NavLink className="navlink" to="/" end>Home</NavLink>
                <NavLink className="navlink" to="/book">Book</NavLink>
                {isStaff && <NavLink className="navlink" to="/staff">Staff</NavLink>}
                {user && <Bell />}
                {user ? <button className="ghost sm navlink" onClick={logout}>Sign out ({user.name})</button> : <NavLink className="navlink" to="/login">Sign in</NavLink>}
              </nav>
            </header>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<Account />} />
              <Route path="/book" element={<Guard><Book /></Guard>} />
              <Route path="/staff" element={<Guard roles={['staff', 'admin']}><Staff /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <BottomNav isStaff={isStaff} user={user} />
          </div>
        } />
      </Routes>
    </AuthCtx.Provider>
  );
}
