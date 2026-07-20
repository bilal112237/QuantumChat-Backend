const HEX_64 = /^[0-9a-f]{64}$/i;

/** Sealed-box envelope shape used for call signaling (matches Message envelopes). */
export function isSealedEnvelope(envelope) {
  return (
    envelope &&
    typeof envelope.ciphertext === 'string' &&
    envelope.ciphertext.length > 0 &&
    typeof envelope.nonce === 'string' &&
    envelope.nonce.length > 0 &&
    HEX_64.test(envelope.ephemeralPublicKey || '') &&
    HEX_64.test(envelope.targetPublicKey || '')
  );
}

/** Reject legacy plaintext WebRTC signaling fields. */
export function hasForbiddenPlaintextSignaling(payload = {}) {
  if (payload.sdp != null) return true;
  if (payload.candidate != null) return true;
  if (typeof payload.video === 'boolean' && !payload.envelope) return false;
  return false;
}
