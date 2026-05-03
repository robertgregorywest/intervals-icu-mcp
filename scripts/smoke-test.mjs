#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, "..", "dist", "mcp", "stdio.js");

const child = spawn("node", [serverPath], {
  env: process.env,
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
  const req = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(req) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 30_000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}
function header(s) {
  console.log("\n" + "=".repeat(60) + "\n" + s + "\n" + "=".repeat(60));
}

async function main() {
  await send("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.1" },
  });
  notify("notifications/initialized", {});

  header("1. tools/list — verify count, annotations, new tool, schema fields");
  const list = await send("tools/list", {});
  const names = list.tools.map((t) => t.name).sort();
  console.log("Tool count:", list.tools.length);
  console.log("Tools:", names);

  const weekTool = list.tools.find(
    (t) => t.name === "get_training_week_summary"
  );
  console.log("\nNew tool present:", !!weekTool);
  if (weekTool)
    console.log("  description:", weekTool.description.slice(0, 80) + "...");

  const deleteTool = list.tools.find((t) => t.name === "delete_events");
  console.log("\ndelete_events annotations:", deleteTool?.annotations);

  const getActivities = list.tools.find((t) => t.name === "get_activities");
  console.log(
    "\nget_activities inputSchema keys:",
    Object.keys(getActivities.inputSchema.properties || {})
  );
  console.log("get_activities annotations:", getActivities?.annotations);

  const updateEvent = list.tools.find((t) => t.name === "update_event");
  const cat = updateEvent?.inputSchema?.properties?.category;
  console.log("\nupdate_event.category schema:", pretty(cat));

  header("2. invalid date format → should fail-fast with regex error");
  const badDate = await send("tools/call", {
    name: "get_wellness",
    arguments: { oldest: "2026/05/01", newest: "2026-05-02" },
  });
  console.log("isError:", badDate.isError);
  console.log("text:", badDate.content[0].text.slice(0, 200));

  header("3. date range too large (>365d) → custom error");
  const bigRange = await send("tools/call", {
    name: "get_wellness",
    arguments: { oldest: "2024-01-01", newest: "2026-01-01" },
  });
  console.log("isError:", bigRange.isError);
  console.log("text:", bigRange.content[0].text.slice(0, 250));

  header("4. delete_events with empty {} → schema rejects");
  const badDelete = await send("tools/call", {
    name: "delete_events",
    arguments: { ids: [{}] },
  });
  console.log("isError:", badDelete.isError);
  console.log("text:", badDelete.content[0].text.slice(0, 250));

  header("5. real get_wellness call — verify enveloped response");
  const wellness = await send("tools/call", {
    name: "get_wellness",
    arguments: { oldest: "2026-04-25", newest: "2026-04-27" },
  });
  const wRes = JSON.parse(wellness.content[0].text);
  console.log("envelope keys:", Object.keys(wRes));
  console.log(
    "total:",
    wRes.total,
    "count:",
    wRes.count,
    "truncated:",
    wRes.truncated
  );
  console.log(
    "first record id/keys:",
    wRes.records[0]?.id,
    Object.keys(wRes.records[0] || {}).slice(0, 10)
  );

  header("6. limit cap takes effect");
  const limited = await send("tools/call", {
    name: "get_wellness",
    arguments: { oldest: "2026-04-01", newest: "2026-04-30", limit: 3 },
  });
  const lRes = JSON.parse(limited.content[0].text);
  console.log(
    "total:",
    lRes.total,
    "count:",
    lRes.count,
    "truncated:",
    lRes.truncated
  );
  console.log("message:", lRes.message);

  header("7. new workflow tool: get_training_week_summary");
  const week = await send("tools/call", {
    name: "get_training_week_summary",
    arguments: { weekStart: "2026-04-27" },
  });
  if (week.isError) {
    console.log("WORKFLOW TOOL ERROR:", week.content[0].text);
    child.kill();
    return;
  }
  const wkRes = JSON.parse(week.content[0].text);
  console.log("week:", wkRes.week);
  console.log("totals:", wkRes.totals);
  console.log("by_sport:", wkRes.by_sport);
  console.log("fitness:", wkRes.fitness);
  console.log("activities:", wkRes.completed_activities.length);
  console.log("events:", wkRes.events.length);

  header("8. invalid sportType enum → schema rejects");
  const badSport = await send("tools/call", {
    name: "create_workout",
    arguments: {
      name: "test",
      date: "2026-12-31",
      sportType: "Skydiving",
      steps: [{ duration: "10m", target: "Z2" }],
    },
  });
  console.log("isError:", badSport.isError);
  console.log("text:", badSport.content[0].text.slice(0, 250));

  child.kill();
  console.log("\n✓ smoke test complete");
}

main().catch((err) => {
  console.error("FAIL:", err);
  child.kill();
  process.exit(1);
});
