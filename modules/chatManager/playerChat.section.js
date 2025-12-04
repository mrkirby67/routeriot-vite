// ============================================================================
// FILE: modules/chatManager/playerChat.section.js
// PURPOSE: Builds and ensures the Team Surprises section DOM structure
// ============================================================================

function ensurePlaceholder(list, placeholderHtml) {
  if (!list) return;
  if (!list.innerHTML.trim()) {
    list.innerHTML = placeholderHtml;
  }
}

export function ensureTeamSurprisesSection() {
  const scoreboard = document.getElementById('scoreboard-container');
  if (!scoreboard) return null;

  let section = document.getElementById('team-surprises-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'team-surprises-section';
    section.className = 'control-section team-surprises-section';
    section.innerHTML = `
      <div class="team-surprises-header">
        <h2>🎉 Team Surprises</h2>
        <span class="team-surprises-shield" data-role="shield-status">🛡️ Shield inactive</span>
      </div>
      <div class="team-surprises-columns">
        <div class="team-surprises-self">
          <h3>Your Inventory</h3>
          <div id="team-surprises-body" class="team-surprises-myteam">
            <p class="team-surprises-placeholder">Loading your wild cards…</p>
          </div>
        </div>
        <div class="team-surprises-inventory">
          <h3>All Teams</h3>
          <ul id="team-surprise-inventory" class="team-surprises-list"></ul>
        </div>
      </div>
    `;
    scoreboard.insertAdjacentElement('afterend', section);
  } else if (section.previousElementSibling !== scoreboard) {
    // Keep the placement immediately following the scoreboard block
    scoreboard.insertAdjacentElement('afterend', section);
  }

  ensurePlaceholder(
    section.querySelector('#team-surprise-inventory'),
    '<li class="team-surprises-empty">No surprise data yet.</li>'
  );
  ensurePlaceholder(
    section.querySelector('#team-surprises-body'),
    '<p class="team-surprises-placeholder">Loading your wild cards…</p>'
  );

  return section;
}
