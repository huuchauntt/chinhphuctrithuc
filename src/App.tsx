/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './services/firebase';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Player from './pages/Player';
import PaperMode from './pages/PaperMode';
import Printables from './pages/Printables';
import Guide from './pages/Guide';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/player" element={<Player />} />
          <Route path="/paper-mode/:sessionId" element={<PaperMode />} />
          <Route path="/printables" element={<Printables />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
