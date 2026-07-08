import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client.js';
import { generateKeyPair } from '../crypto/keys.js';
import { savePrivateKey, getPrivateKey, saveSession, getStoredUser, clearSession, getToken } from '../crypto/keyStorage.js';
import { connectSocket, disconnectSocket } from '../api/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());

  const register = useCallback(async ({ username, email, password }) => {
    const { publicKey, secretKey } = generateKeyPair();
    const { data } = await client.post('/auth/register', { username, email, password, publicKey });
    const { token, user: newUser } = data.data;
    savePrivateKey(newUser.id, secretKey);
    saveSession(token, newUser);
    setUser(newUser);
    connectSocket();
    return newUser;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await client.post('/auth/login', { email, password });
    const { token, user: loggedInUser } = data.data;
    saveSession(token, loggedInUser);
    setUser(loggedInUser);
    connectSocket();
    return loggedInUser;
  }, []);

  // Issues a brand-new keypair for this device and publishes the new public
  // key to the server. Only needed when no local private key exists (e.g.
  // first login on a new device) — any history encrypted under the old key
  // becomes unreadable, which is expected for true E2E encryption.
  const regenerateKeys = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const { publicKey, secretKey } = generateKeyPair();
    const { data } = await client.patch('/users/me/public-key', { publicKey });
    savePrivateKey(user.id, secretKey);
    saveSession(getToken(), data.data);
    setUser(data.data);
    return data.data;
  }, [user]);

  const logout = useCallback(() => {
    clearSession();
    disconnectSocket();
    setUser(null);
  }, []);

  const hasLocalPrivateKey = user ? Boolean(getPrivateKey(user.id)) : false;

  return (
    <AuthContext.Provider value={{ user, register, login, logout, regenerateKeys, hasLocalPrivateKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
