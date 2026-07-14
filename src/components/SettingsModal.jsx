import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function SettingsModal({ user, onClose, onImportKeys, onGenerateKeys }) {
  const { theme, toggleTheme } = useTheme();
  const closeRef = useRef(null);
  const fileInputRef = useRef(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="create-group-overlay" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-group-modal-header">
          <div className="create-group-modal-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div className="create-group-modal-heading">
            <h2 id="settings-title">Settings</h2>
            <p>Account, appearance, and keys</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="create-group-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <section className="settings-section">
          <h3 className="settings-section-title">Account</h3>
          <div className="settings-account">
            <span className="avatar">{(user?.username || '?').slice(0, 2).toUpperCase()}</span>
            <div className="settings-account-meta">
              <span className="settings-account-name">{user?.username}</span>
              <span className="settings-account-email">{user?.email || 'No email'}</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <button type="button" className="settings-row" onClick={toggleTheme}>
            <span className="settings-row-left">
              <span className="settings-row-label">Theme</span>
              <span className="settings-row-hint">{isDark ? 'Dark' : 'Light'}</span>
            </span>
            <span className={`menu-switch ${isDark ? 'on' : ''}`} aria-hidden="true">
              <span className="menu-switch-knob" />
            </span>
          </button>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Encryption keys</h3>
          <p className="settings-section-copy">
            Keys stay on this device. Import a backup to recover old messages, or generate a new set if the old keys are gone.
          </p>
          <div className="settings-key-actions">
            <button type="button" className="confirm-btn cancel" onClick={() => fileInputRef.current?.click()}>
              Import keys.txt
            </button>
            <input ref={fileInputRef} type="file" accept=".txt" hidden onChange={onImportKeys} />
            <button type="button" className="confirm-btn primary" onClick={onGenerateKeys}>
              Generate new keys
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
