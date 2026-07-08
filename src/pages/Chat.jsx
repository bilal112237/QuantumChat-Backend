import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import { connectSocket, getSocket } from '../api/socket.js';
import { encryptMessage, decryptMessage } from '../crypto/keys.js';
import { getPrivateKey } from '../crypto/keyStorage.js';
import UserList from '../components/UserList.jsx';
import MessageBubble from '../components/MessageBubble.jsx';

export default function Chat() {
  const { user, logout, regenerateKeys, hasLocalPrivateKey } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const selectedUserRef = useRef(null);
  selectedUserRef.current = selectedUser;

  const myPrivateKey = user ? getPrivateKey(user.id) : null;

  const decorate = useCallback(
    (raw, otherPublicKey) => ({
      ...raw,
      text: myPrivateKey ? decryptMessage(raw.ciphertext, raw.nonce, otherPublicKey, myPrivateKey) : null,
    }),
    [myPrivateKey]
  );

  useEffect(() => {
    if (!hasLocalPrivateKey) return;
    client.get('/users').then((res) => setUsers(res.data.data));
  }, [hasLocalPrivateKey]);

  useEffect(() => {
    if (!hasLocalPrivateKey) return;
    connectSocket();
    const socket = getSocket();

    function handleIncoming(raw) {
      const current = selectedUserRef.current;
      const otherId = raw.from === user.id ? raw.to : raw.from;
      if (!current || current.id !== otherId) return;
      setMessages((prev) => [...prev, decorate(raw, current.publicKey)]);
    }

    socket.on('message:new', handleIncoming);
    return () => socket.off('message:new', handleIncoming);
  }, [hasLocalPrivateKey, user, decorate]);

  useEffect(() => {
    if (!selectedUser || !hasLocalPrivateKey) return;
    client.get(`/messages/${selectedUser.id}`).then((res) => {
      setMessages(res.data.data.map((raw) => decorate(raw, selectedUser.publicKey)));
    });
  }, [selectedUser, hasLocalPrivateKey, decorate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canChat = hasLocalPrivateKey;

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !selectedUser) return;
    try {
      const { ciphertext, nonce } = encryptMessage(draft, selectedUser.publicKey, myPrivateKey);
      const { data } = await client.post('/messages', { to: selectedUser.id, ciphertext, nonce });
      setMessages((prev) => [...prev, decorate(data.data, selectedUser.publicKey)]);
      setDraft('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
    }
  }

  async function handleRegenerate() {
    await regenerateKeys();
    setError('');
  }

  const title = useMemo(() => selectedUser?.username || 'Select a conversation', [selectedUser]);

  return (
    <div className="chat-page">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>{user.username}</span>
          <button className="link-button" onClick={logout}>
            Log out
          </button>
        </div>
        {canChat ? (
          <UserList users={users} selectedUserId={selectedUser?.id} onSelect={setSelectedUser} />
        ) : (
          <p className="empty-hint">Set up your device key to see people.</p>
        )}
      </aside>

      <main className="chat-main">
        {!canChat && (
          <div className="key-warning">
            <p>
              No private key found on this device. Either you cleared local storage or this is a new device.
              Old messages encrypted under your previous key will remain unreadable, but you can generate a
              new keypair to continue chatting.
            </p>
            <button onClick={handleRegenerate}>Generate new keypair for this device</button>
          </div>
        )}

        {canChat && (
          <>
            <header className="chat-header">{title}</header>
            <div className="message-list">
              {messages.map((m) => (
                <MessageBubble key={m.id || m._id} message={m} isMine={m.from === user.id} />
              ))}
              <div ref={bottomRef} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            {selectedUser && (
              <form className="composer" onSubmit={handleSend}>
                <input
                  placeholder="Type an encrypted message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit">Send</button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
