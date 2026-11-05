#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { createAdminPasswordHash } from "../lib/server/admin-auth.js";

function maskedPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Run this command in an interactive terminal to enter a masked password.");
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const decoder = new StringDecoder("utf8");
    const input = process.stdin;
    const previousRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(previousRaw));
      input.pause();
      process.stdout.write("\n");
    };
    function onData(bytes) {
      for (const character of decoder.write(bytes)) {
        if (character === "\u0003" || character === "\u0004") {
          cleanup(); reject(new Error("Setup cancelled.")); return;
        }
        if (character === "\r" || character === "\n") { cleanup(); resolve(value); return; }
        if (character === "\u007f" || character === "\b") {
          if (value) { value = [...value].slice(0, -1).join(""); process.stdout.write("\b \b"); }
        } else if (!/[\u0000-\u001f]/.test(character)) {
          if (value.length + character.length <= 256) { value += character; process.stdout.write("*"); }
        }
      }
    }
    input.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--write-local")) throw new Error("Usage: node scripts/admin-setup.mjs [--write-local]");
  console.log("Create the portfolio owner's admin credentials. Use a unique password of at least 12 characters.");
  const password = await maskedPassword("Admin password: ");
  const confirmation = await maskedPassword("Confirm password: ");
  if (password !== confirmation) throw new Error("The passwords did not match. No settings were changed.");
  const hash = await createAdminPasswordHash(password);
  const secret = randomBytes(32).toString("base64url");
  // Single quotes preserve scrypt's dollar separators in Next.js dotenv expansion.
  const settings = `ADMIN_PASSWORD_HASH='${hash.replaceAll("$", "\\$")}'\nADMIN_SESSION_SECRET=${secret}\n`;
  if (args.includes("--write-local")) {
    const destination = new URL("../.env.local", import.meta.url);
    let existing = "";
    try { existing = await readFile(destination, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
    const retained = existing.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?ADMIN_(?:PASSWORD_HASH|SESSION_SECRET)\s*=/.test(line)).join("\n").replace(/\n*$/, "");
    await writeFile(destination, `${retained}${retained ? "\n\n" : ""}${settings}`, { mode: 0o600 });
    await chmod(destination, 0o600);
    console.log(`Saved ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET to ${fileURLToPath(destination)}. Restart the local server.`);
    console.log("Existing environment settings were preserved. Configure the production values in Vercel separately.");
    return;
  }
  console.log("\nFor Vercel, paste these values into server-only Environment Variables. Keep them private:");
  console.log(`ADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${secret}`);
  console.log("\nFor a local .env.local file, use this escaped form so Next.js preserves the dollar signs:");
  console.log(settings);
  console.log("Public production sign-in also needs the shared Redis settings described in docs/admin-auth.md.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
