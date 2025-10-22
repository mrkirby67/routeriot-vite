// ============================================================================
// FILE: modules/playerUI/overlays.js
// PURPOSE: Pause/Game Over overlays + confetti animation
// ============================================================================

function $(id) {
  return document.getElementById(id);
}

export function showPausedOverlay() {
  if ($('paused-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'paused-overlay';
  overlay.innerHTML = `
    <div class="paused-message">
      ⏸️ Paused<br><small>Wait for host to resume...</small>
    </div>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.5rem', fontWeight: 'bold', zIndex: '5000',
    opacity: '0', transition: 'opacity 0.6s ease-in-out'
  });
  const styleTag = document.createElement('style');
  styleTag.textContent = `@keyframes pulse {0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.85;}}`;
  document.head.appendChild(styleTag);
  const msg = overlay.querySelector('.paused-message');
  if (msg) {
    msg.style.textAlign = 'center';
    msg.style.animation = 'pulse 1.5s infinite';
  }
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
}

export function hidePausedOverlay() {
  const overlay = $('paused-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 600);
  }
}

export function showSpeedBumpOverlay({ by, challenge, onRelease } = {}) {
  let overlay = document.getElementById('speedbump-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'speedbump-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.88)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      zIndex: '6000',
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'Montserrat, sans-serif'
    });
    const message = document.createElement('div');
    message.id = 'speedbump-overlay-message';
    message.style.maxWidth = '480px';
    message.style.fontSize = '1.1rem';
    overlay.appendChild(message);

    const releaseBtn = document.createElement('button');
    releaseBtn.id = 'speedbump-release-btn';
    releaseBtn.textContent = 'Release Me';
    Object.assign(releaseBtn.style, {
      padding: '10px 20px',
      borderRadius: '999px',
      border: 'none',
      background: '#ffb74d',
      color: '#1a1200',
      fontWeight: '700',
      cursor: 'pointer',
      fontSize: '1rem'
    });
    overlay.appendChild(releaseBtn);
    document.body.appendChild(overlay);
  }

  const message = document.getElementById('speedbump-overlay-message');
  const releaseBtn = document.getElementById('speedbump-release-btn');
  if (message) {
    const sender = by ? `by ${by}` : 'by another team';
    message.innerHTML = `🚧 You're Speed Bumped ${sender}!<br><br><strong>Challenge:</strong> ${challenge || 'Complete your photo challenge!'}`;
  }
  if (releaseBtn) {
    releaseBtn.onclick = async () => {
      releaseBtn.disabled = true;
      try {
        await onRelease?.();
      } catch (err) {
        console.error('Speed bump release failed:', err);
      } finally {
        releaseBtn.disabled = false;
      }
    };
  }
  overlay.style.display = 'flex';
}

export function hideSpeedBumpOverlay() {
  const overlay = document.getElementById('speedbump-overlay');
  if (overlay) overlay.style.display = 'none';
}


export function showGameOverOverlay() {
  if ($('gameover-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  overlay.innerHTML = `
    <div class="finish-message">🏁 GAME OVER<br><small>Return to base!</small></div>
    <canvas id="confetti-canvas"></canvas>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.9)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '3rem', fontWeight: 'bold', zIndex: '6000',
    opacity: '0', transition: 'opacity 0.8s ease-in-out'
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
  startConfetti();
  setTimeout(stopConfetti, 7000);
}

let confettiActive = false;
let confettiPieces = [];
let confettiAnimation;

export function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;

  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '99998'
    });
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    'hsl(0, 100%, 60%)',
    'hsl(30, 100%, 60%)',
    'hsl(60, 100%, 60%)',
    'hsl(120, 100%, 60%)',
    'hsl(200, 100%, 60%)',
    'hsl(280, 100%, 70%)'
  ];

  confettiPieces = Array.from({ length: 250 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 1 + Math.random() * 3,
    opacity: 1,
    drift: (Math.random() - 0.5) * 1.5,
    hueShift: Math.random() * 360
  }));

  function draw() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confettiPieces.forEach((p) => {
      p.hueShift = (p.hueShift + 2) % 360;
      const hueColor = `hsl(${p.hueShift}, 100%, 65%)`;

      p.opacity -= 0.002;
      if (p.opacity < 0.2) p.opacity = 1;

      ctx.fillStyle = hueColor;
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      p.y += p.speed;
      p.x += p.drift;
      if (p.y > canvas.height) p.y = -10;
      if (p.x > canvas.width) p.x = 0;
      if (p.x < 0) p.x = canvas.width;
    });

    confettiAnimation = requestAnimationFrame(draw);
  }

  draw();
  console.log('🎆 Sparkling confetti started!');
}

export function stopConfetti() {
  if (!confettiActive) return;
  confettiActive = false;

  cancelAnimationFrame(confettiAnimation);
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    canvas.style.transition = 'opacity 0.8s ease';
    canvas.style.opacity = '0';
    setTimeout(() => canvas.remove(), 1000);
  }
  console.log('✨ Confetti stopped.');
}
