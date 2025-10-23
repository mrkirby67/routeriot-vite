import * as OTPAuth from "otpauth";

// This is a placeholder secret. You will need to generate a real one.
const SECRET = "JBSWY3DPEHPK3PXP";
const ACCESS_KEY = "routeRiotAdminSession";

export function requireAuthenticatorAccess() {
  // Check if there’s an active session token in localStorage
  const existing = localStorage.getItem(ACCESS_KEY);
  if (existing && Date.now() < Number(existing)) {
    console.log("🔓 Auth session valid.");
    return true;
  }

  const code = prompt("Enter your 6-digit Google Authenticator code:");
  if (!code) {
    alert("Access denied.");
    location.href = "/"; // kick out
    return false;
  }

  const totp = new OTPAuth.TOTP({
    issuer: "RouteRiot",
    label: "GameMaster",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromB32(SECRET),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    alert("Invalid or expired code.");
    location.href = "/";
    return false;
  }

  // ✅ Valid → set expiry for 8 hours
  const expiry = Date.now() + 8 * 60 * 60 * 1000;
  localStorage.setItem(ACCESS_KEY, expiry);
  console.log("✅ Control unlocked until", new Date(expiry).toLocaleTimeString());
  return true;
}
