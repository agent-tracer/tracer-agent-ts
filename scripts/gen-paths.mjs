#!/usr/bin/env node
// 경로 별칭만은 계산할 수 없는 정적 JSON이라 매니페스트에서 생성해 커밋하고 CI가 신선도를 본다.
//
// 사용:
//   node scripts/gen-paths.mjs            생성
//   node scripts/gen-paths.mjs --check    커밋된 파일이 매니페스트와 일치하는지 검사

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCOPE, UNITS } from "../architecture.manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "tsconfig.paths.json");

/** 배포 단위 목록에서 tsconfig의 paths 블록을 만든다. */
export function buildPaths(units) {
  const paths = {};
  for (const unit of units) {
    const source = `${unit.dir}/src`;
    if (unit.importable) {
      paths[`${SCOPE}/${unit.name}`] = [`${source}/index.ts`];
      paths[`${SCOPE}/${unit.name}/*`] = [`${source}/*`];
    }
    paths[`${unit.alias}/*`] = [`${source}/*`];
  }
  return paths;
}

const content = JSON.stringify(
  { compilerOptions: { baseUrl: ".", paths: buildPaths(UNITS) } },
  null,
  2,
) + "\n";

function main() {
  if (!process.argv.includes("--check")) {
    fs.writeFileSync(TARGET, content);
    console.log(`gen:paths 생성 완료 (별칭 ${Object.keys(buildPaths(UNITS)).length}개)`);
    return;
  }

  const committed = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
  if (committed !== content) {
    console.error("tsconfig.paths.json이 매니페스트와 어긋난다. `npm run gen:paths`로 다시 만든다.");
    process.exit(1);
  }
  console.log("gen:paths 최신");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
