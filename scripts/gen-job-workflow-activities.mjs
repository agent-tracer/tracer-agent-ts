#!/usr/bin/env node
// 잡 워크플로의 상한은 계약이 갖지만 워크플로 번들은 파일을 읽지 못하므로 계약에서 생성해 커밋하고 CI가 신선도를 본다.
//
// 사용:
//   node scripts/gen-job-workflow-activities.mjs            생성
//   node scripts/gen-job-workflow-activities.mjs --check    커밋된 파일이 계약과 일치하는지 검사

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "contract", "workflow", "queues.yaml");
const TARGET = path.join(
  ROOT, "services", "agent-worker", "src", "support", "job.workflow.declaration.ts",
);

const PER_KIND = "  perKind:";
const KIND = /^ {4}(?<kind>[A-Za-z]\w*):$/u;
const ACTIVITIES = /^ {6}activities:$/u;
const ACTIVITY = /^ {8}- name: (?<name>[A-Za-z]\w*)$/u;
const FIELD = /^ {10}(?<key>[A-Za-z]\w*): (?<value>.+)$/u;

/** 워크플로가 활동에 거는 상한이며 계약이 적지 않은 칸은 생성물에도 없다. */
const LIMIT_FIELDS = [
  "startToCloseSeconds",
  "scheduleToCloseSeconds",
  "heartbeatTimeoutSeconds",
  "maximumAttempts",
];

/** 계약의 jobWorkflows.perKind에서 잡 종류마다의 활동 이름과 상한을 읽는다. */
export function readJobActivities(text) {
  const lines = text.split("\n");
  const start = lines.indexOf(PER_KIND);
  if (start < 0) throw new Error("계약이 jobWorkflows.perKind를 갖지 않는다");

  const perKind = {};
  let kind = null;
  let activity = null;

  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (!line.startsWith("    ")) break;

    const kindFound = KIND.exec(line);
    if (kindFound) {
      kind = kindFound.groups.kind;
      if (perKind[kind] !== undefined) throw new Error(`계약이 잡 종류를 두 번 적었다: ${kind}`);
      perKind[kind] = [];
      activity = null;
      continue;
    }
    if (kind === null) throw new Error(`잡 종류 없이 나타난 줄이다: ${line}`);
    if (ACTIVITIES.test(line)) continue;

    const activityFound = ACTIVITY.exec(line);
    if (activityFound) {
      activity = { name: activityFound.groups.name };
      if (perKind[kind].some((other) => other.name === activity.name)) {
        throw new Error(`계약이 활동 이름을 두 번 적었다: ${kind}.${activity.name}`);
      }
      perKind[kind].push(activity);
      continue;
    }

    const fieldFound = FIELD.exec(line);
    if (activity === null || fieldFound === null) continue;
    if (!LIMIT_FIELDS.includes(fieldFound.groups.key)) continue;

    const value = Number(fieldFound.groups.value);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`상한이 양의 정수가 아니다: ${activity.name}.${fieldFound.groups.key}`);
    }
    activity[fieldFound.groups.key] = value;
  }

  const kinds = Object.keys(perKind);
  if (kinds.length === 0) throw new Error("계약의 jobWorkflows.perKind가 비었다");
  for (const name of kinds) {
    if (perKind[name].length === 0) throw new Error(`계약이 활동 없는 잡 종류를 적었다: ${name}`);
  }
  return perKind;
}

/** 활동 하나를 상수 하나로 적으며 계약이 적은 칸만 낸다. */
function activityLine(activity) {
  const fields = [`name: "${activity.name}"`]
    .concat(LIMIT_FIELDS.filter((key) => activity[key] !== undefined).map((key) => `${key}: ${activity[key]}`));
  return `        { ${fields.join(", ")} },`;
}

/** 계약이 적은 활동 목록에서 워크플로가 읽을 순수 상수 모듈을 만든다. */
export function buildModule(perKind) {
  const entries = Object.entries(perKind).flatMap(([kind, activities]) => [
    `    ${kind}: [`,
    ...activities.map((activity) => activityLine(activity)),
    "    ],",
  ]);

  return [
    "// contract/workflow/queues.yaml의 jobWorkflows.perKind에서 만든 파일이라 손으로 고치지 않는다.",
    "",
    "/** 계약이 활동 하나에 적은 벽시계 상한과 시도 수다. */",
    "export interface DeclaredJobActivity {",
    "    readonly name: string;",
    "    readonly startToCloseSeconds?: number;",
    "    readonly scheduleToCloseSeconds?: number;",
    "    readonly heartbeatTimeoutSeconds?: number;",
    "    readonly maximumAttempts?: number;",
    "}",
    "",
    "/** 워크플로 번들은 결정적 샌드박스라 파일을 읽지 못하므로 계약의 값을 빌드 시점에 상수로 만든다. */",
    "export const DECLARED_JOB_ACTIVITIES: Readonly<Record<string, readonly DeclaredJobActivity[]>> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

function main() {
  const generated = buildModule(readJobActivities(fs.readFileSync(SOURCE, "utf8")));
  if (process.argv.includes("--check")) {
    const committed = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (committed !== generated) {
      console.error("잡 워크플로의 활동 상한이 계약과 어긋난다. npm run gen:job-workflow-activities를 실행한다.");
      process.exit(1);
    }
    console.log("gen:job-workflow-activities 최신");
    return;
  }
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, generated);
  console.log(`gen:job-workflow-activities -> ${path.relative(ROOT, TARGET)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
