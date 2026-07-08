export default function MessageBubble({ message, isMine }) {
  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
        {message.text === null ? <em>[Unable to decrypt message]</em> : message.text}
        <div className="message-time">{new Date(message.createdAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
