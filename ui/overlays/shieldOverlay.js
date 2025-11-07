export function showShieldOverlay() {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.add('rr-shield-active');
}

export function hideShieldOverlay() {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove('rr-shield-active');
}

export function renderShieldCountdown(msRemaining) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('rr-shield-timer');
  if (!el) return;
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    el.textContent = '';
    return;
  }
  const sec = Math.max(1, Math.ceil(msRemaining / 1000));
  el.textContent = `Shield active: ${sec}s`;
}
