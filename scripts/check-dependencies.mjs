#!/usr/bin/env node
// 배포 단위가 사는 최상위 디렉터리마다 한 번씩 돌며 루트 tsconfig의 별칭으로 import를 해석한다.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { ROOTS } from "../architecture.manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPCRUISE = path.join(ROOT, "node_modules/.bin/depcruise");

/** 실제로 존재하는 최상위 디렉터리만 검사 대상이 된다. */
export function cruiseTargets(exists = (dir) => fs.existsSync(path.join(ROOT, dir))) {
  return ROOTS.filter(exists);
}

function main() {
  let failed = false;
  for (const source of cruiseTargets()) {
    const result = spawnSync(
      DEPCRUISE,
      [
        "--config", path.join(ROOT, ".dependency-cruiser.mjs"),
        "--ts-config", path.join(ROOT, "tsconfig.base.json"),
        source,
      ],
      { cwd: ROOT, stdio: "inherit", maxBuffer: 32 * 1024 * 1024 },
    );
    if (result.error) throw result.error;
    failed ||= result.status !== 0;
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
