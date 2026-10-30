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
    <AuthCtx.Provider value={{ user, setUser, ready }}>
      <Routes>
        <Route path="/display" element={<Display />} />
        <Route path="*" element={
          <div className={'wrap' + (loc.pathname === '/' ? ' wide' : '')}>
            <header>
              <Link to="/" className="brand"><h1>Maison Lilac</h1></Link>
              <nav>
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/book">Book</NavLink>
                {isStaff && <NavLink to="/staff">Staff</NavLink>}
                {user && <Bell />}
                {user ? <button className="ghost sm" onClick={logout}>Sign out ({user.name})</button> : <NavLink to="/login">Sign in</NavLink>}
              </nav>
            </header>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/book" element={<Guard><Book /></Guard>} />
              <Route path="/staff" element={<Guard roles={['staff', 'admin']}><Staff /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        } />
      </Routes>
    </AuthCtx.Provider>
  );
}
