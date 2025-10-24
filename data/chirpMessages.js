// =========================================================
// 😂 Route Riot Chirp Messages Data
// =========================================================
export const CHIRP_MESSAGES = [
  "Thanks for the love tap, champ. Hope your GPS leads you into a lake.",
  "Nice play, speed demon. Did your grandma code your strategy?",
  "Appreciate the pit stop — I was getting tired anyway.",
  "Congrats, you just made my team’s group chat way funnier.",
  "Your sabotage skills are strong. Your math skills? Not so much.",
  "That was cute. My grandma drives faster than your Wi-Fi.",
  "Oh great, now my driver thinks the tire light is emotional support.",
  "We’ll send you the bill — and a glitter bomb.",
  "Hey! Was that necessary? (Yes, yes it was.)",
  "Enjoy your lead while it lasts, hotshot.",
  "Still laughing about your ‘strategy.’ It’s adorable.",
  "We see you. We just don’t respect you.",
  "Is that all you got? My dog could code a better ambush.",
  "Good hit — too bad karma’s got better aim.",
  "We were due for some cardio anyway, thanks!",
  "Flat tire? More like flat performance — yours, not ours.",
  "You play dirty, and I respect that.",
  "That’s it? My kindergartners prank harder.",
  "Nice move! We’ll remember this… forever.",
  "Keep it up — our memes are getting stronger with every attack."
];

export function getRandomChirp() {
  return CHIRP_MESSAGES[Math.floor(Math.random() * CHIRP_MESSAGES.length)];
}