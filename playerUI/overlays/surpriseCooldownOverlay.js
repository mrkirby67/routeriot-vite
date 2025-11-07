export function showSurpriseCooldownOverlay({ type, remainingMs }) {
  const seconds = Math.ceil(remainingMs / 1000);
  let message = "";

  switch (type) {
    case "flat-tire":
      message = `They are still waiting for roadside assistance... (${seconds}s left)`;
      break;
    case "speed-bump":
      message = `They are still recovering from their orbital launch... (${seconds}s left)`;
      break;
    case "bug-strike":
      message = `They are still scraping bug guts off their windshield... (${seconds}s left)`;
      break;
    default:
      message = `This team is still cooling down... (${seconds}s left)`;
  }

  const div = document.createElement("div");
  div.className = "surprise-cooldown-overlay";
  div.innerHTML = `
    <div class="surprise-cooldown-content">
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 3000);
}
