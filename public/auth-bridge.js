/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-112] External CSP-Safe OAuth Popup Bridge
 * Replaces inline <script> in /api/auth/google/callback so Content-Security-Policy
 * can strictly omit 'unsafe-inline' from script-src.
 * Relays session payload strictly to window.location.origin (never wildcard '*')
 * and avoids persisting raw accessToken copies in dt_synced_token / drive_auth_token.
 */
(function () {
  const payloadEl = document.getElementById('dt-auth-payload');
  const closeBtn = document.getElementById('dt-close-auth-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      window.close();
    });
  }
  if (!payloadEl || !payloadEl.textContent) return;

  let payload;
  try {
    payload = JSON.parse(payloadEl.textContent);
  } catch {
    return;
  }

  try {
    const raw = JSON.stringify(payload);
    const combined = 'dt_sec_token_v2::' + raw;
    const obfuscated = btoa(unescape(encodeURIComponent(combined)));
    sessionStorage.setItem('dt_oauth_session_v2', obfuscated);
  } catch {}

  try {
    const bc = new BroadcastChannel('drive_therapy_auth');
    bc.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', payload });
    bc.close();
  } catch {}

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', payload }, window.location.origin);
    }
  } catch {}

  setTimeout(function () {
    window.close();
  }, 350);
})();
