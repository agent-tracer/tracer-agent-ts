import assert from "node:assert/strict";
import test from "node:test";
import { buildModule, readJobActivities } from "./gen-job-workflow-activities.mjs";

const CONTRACT = [
  "jobWorkflows:",
  "  perKind:",
  "    titleSuggestion:",
  "      name: titleSuggestionWorkflow",
  "      queue: jobs",
  '      id: "title.suggestion:{jobId}"',
  "      activities:",
  "        - name: prepareTitleSuggestion",
  "          queue: jobs",
  "          startToCloseSeconds: 60",
  "          maximumAttempts: 5",
  "        - name: generateTitleSuggestion",
  "          queue: generate",
  "          startToCloseSeconds: 300",
  "          scheduleToCloseSeconds: 1200",
  "          heartbeatTimeoutSeconds: 30",
  "          maximumAttempts: 3",
  "",
  "  singleKind:",
  "    agentJob:",
  "      activities:",
  "        - name: prepareAgentJob",
  "          startToCloseSeconds: 60",
  "",
].join("\n");

test("perKind가 적은 활동의 이름과 상한만 읽는다", () => {
  assert.deepEqual(readJobActivities(CONTRACT), {
    titleSuggestion: [
      { name: "prepareTitleSuggestion", startToCloseSeconds: 60, maximumAttempts: 5 },
      {
        name: "generateTitleSuggestion",
        startToCloseSeconds: 300,
        scheduleToCloseSeconds: 1200,
        heartbeatTimeoutSeconds: 30,
        maximumAttempts: 3,
      },
    ],
  });
});

test("생성한 모듈은 파일을 읽는 import를 갖지 않는다", () => {
  const module = buildModule(readJobActivities(CONTRACT));

  assert.equal(module.includes("node:"), false);
  assert.equal(module.includes("import "), false);
  assert.match(module, /startToCloseSeconds: 300/u);
});

test("계약의 상한을 바꾸면 생성 선언도 반드시 달라진다", () => {
  const current = buildModule(readJobActivities(CONTRACT));
  const changed = buildModule(readJobActivities(CONTRACT.replace("startToCloseSeconds: 300", "startToCloseSeconds: 420")));

  assert.notEqual(changed, current);
  assert.match(changed, /startToCloseSeconds: 420/u);
});

test("계약이 perKind를 갖지 않거나 잘못 적으면 생성을 거절한다", () => {
  assert.throws(() => readJobActivities("jobWorkflows:\n  singleKind: {}\n"), /perKind/u);
  assert.throws(
    () => readJobActivities(CONTRACT.replace("startToCloseSeconds: 60", "startToCloseSeconds: soon")),
    /양의 정수/u,
  );
  const duplicated = CONTRACT.replace(
    "\n  singleKind:",
    "\n    titleSuggestion:\n      activities:\n        - name: prepareTitleSuggestion\n\n  singleKind:",
  );
  assert.throws(() => readJobActivities(duplicated), /두 번 적었다/u);
});
