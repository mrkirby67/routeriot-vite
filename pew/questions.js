// ============================================================================
// Pew Pursuit zone question scaffolding.
// ============================================================================

let containerEl = null;
let titleEl = null;
let questionEl = null;
let actionsEl = null;
let dismissBtn = null;
let submitBtn = null;

let activeZone = null;
let submitHandler = null;
let dismissHandler = null;

export function initQuestionUi({
  container,
  titleNode,
  questionNode,
  actionsNode,
  dismissButton,
  submitButton,
  onSubmit,
  onDismiss,
}) {
  containerEl = container;
  titleEl = titleNode;
  questionEl = questionNode;
  actionsEl = actionsNode;
  dismissBtn = dismissButton;
  submitBtn = submitButton;
  submitHandler = onSubmit || null;
  dismissHandler = onDismiss || null;

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      dismissHandler?.(activeZone);
      hideQuestion();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const answerInput = actionsEl?.querySelector('input, textarea');
      const answer = answerInput?.value?.trim() || '';
      submitHandler?.({
        zone: activeZone,
        answer,
      });
      console.log('📝 Pew Pursuit answer submitted (placeholder).', {
        zoneId: activeZone?.id,
        answer,
      });
    });
  }

  hideQuestion();
}

export function showQuestion(zone, options = {}) {
  if (!containerEl) {
    console.warn('⚠️ Pew Pursuit question UI not initialized yet.');
    return;
  }
  activeZone = zone;
  const zoneName = zone?.name || zone?.id || 'Unknown Zone';
  if (titleEl) titleEl.textContent = `Challenge: ${zoneName}`;
  if (questionEl) {
    questionEl.textContent =
      zone?.question ||
      'Answer the zone-specific challenge to secure your points.';
  }
  containerEl.style.display = 'block';
  options.onShow?.(zone);
  console.log('🎯 Pew Pursuit challenge shown (placeholder).', {
    zoneId: zone?.id,
  });
}

export function hideQuestion(options = {}) {
  if (!containerEl) return;
  containerEl.style.display = 'none';
  const input = actionsEl?.querySelector('input');
  if (input) input.value = '';
  options.onHide?.(activeZone);
  activeZone = null;
}

export function getActiveChallengeZone() {
  return activeZone;
}

// TODO: Add multiple choice / media prompt rendering hooks once puzzles defined.
