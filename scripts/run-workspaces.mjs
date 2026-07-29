#!/usr/bin/env node
// 대상 목록을 `npm query .workspace`가 소유하므로 배포 단위가 늘어도 이 파일은 고치지 않는다.

import { execFile, spawn } from "node:child_process";
import { cpus } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const script = process.argv[2];
if (!script) {
  console.error("사용: node scripts/run-workspaces.mjs <스크립트> [--jobs N]");
  process.exit(2);
}

const jobsFlag = process.argv.indexOf("--jobs");
// tsc 한 프로세스가 수백 MB를 쓰므로 코어 수만큼 띄우면 메모리 압박으로 되레 느려진다.
const DEFAULT_JOBS = Math.max(1, Math.min(4, cpus().length - 1));
const jobs = jobsFlag > 0 ? Number(process.argv[jobsFlag + 1]) : DEFAULT_JOBS;

async function listWorkspaces() {
  const { stdout } = await execFileAsync("npm", ["query", ".workspace"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout)
    .filter((workspace) => workspace.scripts?.[script])
    .map((workspace) => workspace.name)
    .sort();
}

function runOne(name) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script, "--workspace", name], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ name, code: code ?? 1, output }));
  });
}

// 출력은 워크스페이스 단위로 묶어 내보낸다.
async function main() {
  const names = await listWorkspaces();
  if (names.length === 0) {
    console.log(`run-workspaces: '${script}'를 가진 워크스페이스가 없다`);
    return;
  }

  const queue = [...names];
  const failures = [];
  const started = process.hrtime.bigint();

  async function worker() {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const result = await runOne(name);
      if (result.code !== 0) {
        failures.push(result.name);
        process.stdout.write(`\n--- ${result.name}: 실패 ---\n${result.output}\n`);
      } else {
        process.stdout.write(`✓ ${result.name}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, worker));

  const seconds = (Number(process.hrtime.bigint() - started) / 1e9).toFixed(1);
  if (failures.length > 0) {
    console.error(`\n${script}: ${failures.length}개 실패 (${failures.join(", ")}), ${seconds}s`);
    process.exit(1);
  }
  console.log(`${script}: ${names.length}개 통과, ${seconds}s (동시 ${jobs})`);
}

await main();
