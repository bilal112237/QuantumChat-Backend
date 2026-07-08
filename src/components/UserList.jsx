export default function UserList({ users, selectedUserId, onSelect }) {
  return (
    <div className="user-list">
      {users.map((u) => (
        <button
          key={u.id}
          className={`user-list-item ${u.id === selectedUserId ? 'active' : ''}`}
          onClick={() => onSelect(u)}
        >
          <span className="avatar">{u.username.slice(0, 2).toUpperCase()}</span>
          <span>{u.username}</span>
        </button>
      ))}
      {users.length === 0 && <p className="empty-hint">No other users yet.</p>}
    </div>
  );
}
