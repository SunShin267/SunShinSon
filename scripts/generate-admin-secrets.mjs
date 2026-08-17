import { randomBytes } from "node:crypto";

const sessionSecret = randomBytes(32);
const loginAttemptSalt = randomBytes(32);

console.log("Set ADMIN_PASSWORD separately with: wrangler secret put ADMIN_PASSWORD");
console.log(`ADMIN_SESSION_SECRET=${sessionSecret.toString("base64url")}`);
console.log(`LOGIN_ATTEMPT_SALT=${loginAttemptSalt.toString("base64url")}`);
