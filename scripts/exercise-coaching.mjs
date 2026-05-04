#!/usr/bin/env node
/**
 * Exercises slice 2: spins up the MCP server with INTERVALS_COACHING_DIR
 * pointed at a temp dir, calls initialize + prompts/list + prompts/get,
 * and prints the coaching instructions and prompt payload.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "..", "dist", "mcp", "stdio.js");

const coachingDir = mkdtempSync(join(tmpdir(), "ex-coaching-"));
writeFileSync(
  join(coachingDir, "philosophy.md"),
  "# Philosophy\n\nMAP-anchored. Polarized.\n"
);
writeFileSync(
  join(coachingDir, "athlete.md"),
  "# Athlete\n\nMAP=380W, FTP=290W.\n"
);

const child = spawn("node", [serverPath], {
  env: { ...process.env, INTERVALS_COACHING_DIR: coachingDir },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("non-JSON:", line);
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
  );
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 15_000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function header(s) {
  console.log("\n" + "=".repeat(70) + "\n" + s + "\n" + "=".repeat(70));
}

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "ex-coaching", version: "0.0.1" },
  });
  notify("notifications/initialized", {});

  header("1. initialize.instructions (truncated)");
  const instr = init.instructions ?? "";
  console.log("instructions length:", instr.length);
  console.log(
    "contains workout syntax block:",
    instr.includes("Workout text syntax")
  );
  console.log(
    "contains coaching context:",
    instr.includes("# Coaching context")
  );
  console.log("contains philosophy file body:", instr.includes("MAP-anchored"));
  console.log("contains athlete file body:", instr.includes("MAP=380W"));
  console.log("contains absent season:", instr.includes("## Season"));
  console.log("\n--- last 800 chars of instructions ---");
  console.log(instr.slice(-800));

  header("2. prompts/list");
  const prompts = await send("prompts/list", {});
  console.log(
    "prompt names:",
    prompts.prompts.map((p) => p.name)
  );
  const setup = prompts.prompts.find((p) => p.name === "setup_coaching");
  console.log("setup_coaching title:", setup?.title);
  console.log("setup_coaching description:", setup?.description?.slice(0, 80));

  header("3. prompts/get setup_coaching");
  const got = await send("prompts/get", { name: "setup_coaching" });
  console.log("messages length:", got.messages.length);
  console.log("first message role:", got.messages[0].role);
  console.log("first 400 chars of prompt text:");
  console.log(got.messages[0].content.text.slice(0, 400));

  child.kill();
  rmSync(coachingDir, { recursive: true, force: true });
  console.log("\n✓ exercise complete");
}

main().catch((err) => {
  console.error("FAIL:", err);
  child.kill();
  rmSync(coachingDir, { recursive: true, force: true });
  process.exit(1);
});
