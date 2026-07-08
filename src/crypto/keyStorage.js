const PRIVATE_KEY_PREFIX = 'qc_privatekey_';
const TOKEN_KEY = 'qc_token';
const USER_KEY = 'qc_user';

// Private keys are namespaced per user id so multiple accounts on the same
// browser don't collide, and are never sent anywhere.
export function savePrivateKey(userId, secretKeyHex) {
  localStorage.setItem(PRIVATE_KEY_PREFIX + userId, secretKeyHex);
}

export function getPrivateKey(userId) {
  return localStorage.getItem(PRIVATE_KEY_PREFIX + userId);
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
