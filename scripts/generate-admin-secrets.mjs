import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.env.SUNSHINSON_ADMIN_PASSWORD;

if (!password) {
  console.error("SUNSHINSON_ADMIN_PASSWORD must not be empty.");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const passwordHash = pbkdf2Sync(password, salt, 210_000, 32, "sha256");
  const sessionSecret = randomBytes(32);
  const loginAttemptSalt = randomBytes(32);

  console.log(`ADMIN_PASSWORD_HASH=${passwordHash.toString("base64url")}`);
  console.log(`ADMIN_PASSWORD_SALT=${salt.toString("base64url")}`);
  console.log(`ADMIN_SESSION_SECRET=${sessionSecret.toString("base64url")}`);
  console.log(`LOGIN_ATTEMPT_SALT=${loginAttemptSalt.toString("base64url")}`);
}
