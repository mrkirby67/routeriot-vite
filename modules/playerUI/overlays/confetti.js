// ============================================================================
// MODULE: confetti.js
// PURPOSE: Lightweight confetti utilities replacing overlays_FULL.js
// ============================================================================

let isActive = false;
let canvas = null;
let ctx = null;
let particles = [];
let animationFrameId = 0;

export function startConfetti() {
  if (isActive) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureCanvas();
  if (!canvas || !ctx) return;

  isActive = true;
  resizeCanvas();
  particles = Array.from({ length: 180 }, createParticle);
  animationFrameId = requestAnimationFrame(updateParticles);
  window.addEventListener('resize', resizeCanvas);
}

export function stopConfetti() {
  if (!isActive) return;
  isActive = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }

  window.removeEventListener('resize', resizeCanvas);

  if (canvas) {
    canvas.remove();
  }

  canvas = null;
  ctx = null;
  particles = [];
}

function ensureCanvas() {
  canvas = document.getElementById('confetti-canvas');
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
      zIndex: 9998
    });
    document.body.appendChild(canvas);
  }
  ctx = canvas.getContext('2d');
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticle() {
  return {
    x: Math.random() * (canvas?.width || window.innerWidth),
    y: Math.random() * (canvas?.height || window.innerHeight),
    radius: Math.random() * 4 + 3,
    dx: Math.random() * 2 - 1,
    dy: Math.random() * 3 + 2,
    hue: Math.random() * 360
  };
}

function updateParticles() {
  if (!isActive || !ctx || !canvas) return;
  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);

  particles.forEach((particle) => {
    particle.x += particle.dx;
    particle.y += particle.dy;
    if (particle.y > height) {
      particle.y = -10;
      particle.x = Math.random() * width;
    }
    if (particle.x > width) particle.x = 0;
    if (particle.x < 0) particle.x = width;

    particle.hue = (particle.hue + 1) % 360;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${particle.hue}, 100%, 60%)`;
    ctx.fill();
  });

  animationFrameId = requestAnimationFrame(updateParticles);
}
