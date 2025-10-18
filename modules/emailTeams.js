/**
 * Generates and opens Gmail compose links for teams with active racers.
 *
 * @param {string} rulesText - The editable rules text from Control.
 * @param {object} activeTeams - Object of active teams with member arrays.
 * @param {boolean} batchMode - If true, returns an array of URLs instead of opening them.
 * @returns {string[]|void}
 */
export function emailAllTeams(rulesText = '', activeTeams = {}, batchMode = false) {
  const teamsToSend = Object.keys(activeTeams).length > 0
    ? activeTeams
    : {};

  const composeLinks = [];

  Object.entries(teamsToSend).forEach(([teamName, members]) => {
    if (!Array.isArray(members) || members.length === 0) {
      console.warn(`⚠️ Skipping ${teamName}: No assigned racers.`);
      return;
    }

    const emails = members
      .map(m => m.email)
      .filter(email => typeof email === 'string' && email.includes('@'))
      .join(',');

    if (!emails) {
      console.warn(`⚠️ Skipping ${teamName}: No valid email addresses.`);
      return;
    }

    const playerUrl = `${window.location.origin}/player.html?teamName=${encodeURIComponent(teamName)}`;

    const teamObj = allTeams.find(t => t.name === teamName);
    const slogan = teamObj?.slogan ? `"${teamObj.slogan}"` : '';

    const subject = encodeURIComponent(`🚗 Route Riot - Team ${teamName} Player Link`);
    const body = encodeURIComponent(
`Hey Team ${teamName}!

${slogan}

Your team is ready to race! 🎯

Click your unique team page:
${playerUrl}

------------------------------
📜 GAME RULES
------------------------------
${rulesText || '(No rules have been set yet)'}

Good luck racers! 🏁
— Route Riot Control`
    );

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emails}&su=${subject}&body=${body}`;

    if (batchMode) {
      composeLinks.push(gmailUrl);
    } else {
      // Stagger the window.open calls to avoid being blocked by the browser's pop-up blocker
      setTimeout(() => {
        try {
          window.open(gmailUrl, '_blank');
        } catch (err) {
          console.error(`❌ Could not open Gmail compose for ${teamName}:`, err);
        }
      }, 200 * composeLinks.length);
    }
  });

  if (batchMode) {
    console.log(`📬 Generated ${composeLinks.length} Gmail compose links for preview.`);
    return composeLinks;
  }
}

