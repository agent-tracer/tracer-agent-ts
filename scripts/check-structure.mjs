#!/usr/bin/env node
// 상한은 매니페스트가 소유하고 전부 0이므로 예산 파일도 백로그도 두지 않는다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BUDGETS, ID_GENERATION_GUARDED, ROOTS, SERVICE_LOG_DOMAINS, UNITS } from "../architecture.manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".venv", "__pycache__"]);
const SOURCE = /\.(?:ts|tsx)$/;
const TEST = /\.(?:test|spec)\.tsx?$/;
const DECLARATION = /\.d\.ts$/;
const LOG_NAME = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const GUARDED_DIRS = UNITS
  .filter((unit) => ID_GENERATION_GUARDED.includes(unit.name))
  .map((unit) => `${unit.dir}/src/`);

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

/** 300줄을 넘는 파일은 책임이 여럿이라는 신호다. */
export function findOversized(files, maxLines) {
  return files
    .filter((file) => SOURCE.test(file) && !TEST.test(file) && !DECLARATION.test(file))
    .map((file) => ({ file, lines: fs.readFileSync(file, "utf8").split("\n").length }))
    .filter((candidate) => candidate.lines > maxLines)
    .sort((left, right) => right.lines - left.lines);
}

/** 유스케이스는 예외 없이 인접 테스트를 갖는다. */
export function findUntestedUsecases(files) {
  return files
    .filter((file) => file.endsWith(".usecase.ts"))
    .filter((file) => !fs.existsSync(file.replace(/\.ts$/, ".test.ts")))
    .map((file) => ({ file }));
}

/** 운영 로그 이름은 서비스 이름 없이 domain.action.outcome 세 세그먼트를 쓴다. */
export function findInvalidLogNames(files) {
  const found = [];
  for (const file of files.filter((candidate) => SOURCE.test(candidate) && !TEST.test(candidate))) {
    const content = fs.readFileSync(file, "utf8");
    const pattern = /\bmsg\s*:\s*["']([^"']+)["']/g;
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      const domain = name.split(".", 1)[0];
      if (!LOG_NAME.test(name) || SERVICE_LOG_DOMAINS.includes(domain)) {
        found.push({ file, name, line: content.slice(0, match.index).split("\n").length });
      }
    }
  }
  return found;
}

/** 식별자 생성은 슬라이스 adapter만 직접 하고 나머지는 소유 포트를 통해 받는다. */
export function findDirectIdGeneration(files) {
  return files
    .filter((file) => SOURCE.test(file) && !TEST.test(file))
    .filter((file) => GUARDED_DIRS.some((dir) => path.relative(ROOT, file).startsWith(dir)))
    .filter((file) => !file.includes("/adapter/"))
    .filter((file) => fs.readFileSync(file, "utf8").includes("generateUlid"))
    .map((file) => ({ file }));
}

function main() {
  const files = ROOTS
    .map((root) => path.join(ROOT, root))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => walk(dir));

  const metrics = {
    oversizedFiles: findOversized(files, BUDGETS.maxFileLines),
    untestedUsecases: findUntestedUsecases(files),
    invalidLogNames: findInvalidLogNames(files),
    directIdGeneration: findDirectIdGeneration(files),
  };

  const violations = Object.entries(metrics).filter(
    ([key, offenders]) => offenders.length > BUDGETS[key],
  );

  if (violations.length > 0) {
    console.error("구조 상한을 넘었다.\n");
    for (const [key, offenders] of violations) {
      console.error(`  ✗ ${key}: ${offenders.length}개 (상한 ${BUDGETS[key]})`);
      for (const offender of offenders) {
        const where = path.relative(ROOT, offender.file);
        const detail = offender.lines
          ? ` (${offender.lines}줄)`
          : offender.name ? `:${offender.line} (${offender.name})` : "";
        console.error(`      ${where}${detail}`);
      }
    }
    console.error("\n상한을 올리지 않는다. 파일을 나누거나 테스트를 더한다.");
    process.exit(1);
  }

  const summary = Object.entries(metrics)
    .map(([key, offenders]) => `${key} ${offenders.length}/${BUDGETS[key]}`)
    .join(", ");
  console.log(`구조 상한 통과 (${summary})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
