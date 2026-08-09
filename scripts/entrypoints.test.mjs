// 배포 단위가 실제로 서려면 기동 스크립트와 이미지가 같은 진입점을 가리켜야 하므로 두 자리를 대조한다.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVICES = path.join(ROOT, "services");

/** 이미지가 주석으로 적어 둔 진입점 명령이며 배포는 이 가운데 하나를 CMD 로 고른다. */
function imageEntrypoints() {
  const dockerfile = fs.readFileSync(path.join(ROOT, "Dockerfile"), "utf8");
  return dockerfile
    .split("\n")
    .map((line) => /^#\s+cd (\S+) && (node .+)$/u.exec(line))
    .filter((match) => match !== null)
    .map((match) => `${match[1]} :: ${match[2]}`)
    .sort();
}

/** 워크스페이스가 기동 스크립트로 선언한 진입점이다. */
function scriptEntrypoints() {
  const found = [];
  for (const name of fs.readdirSync(SERVICES).sort()) {
    const manifest = path.join(SERVICES, name, "package.json");
    if (!fs.existsSync(manifest)) continue;
    const scripts = JSON.parse(fs.readFileSync(manifest, "utf8")).scripts ?? {};
    for (const [script, command] of Object.entries(scripts)) {
      if (script !== "start" && !script.startsWith("start:")) continue;
      found.push(`services/${name} :: ${command}`);
    }
  }
  return found.sort();
}

/** 명령의 끝에 있는 소스 경로다. */
function sourceOf(entrypoint) {
  const [dir, command] = entrypoint.split(" :: ");
  return path.join(ROOT, dir, command.slice(command.lastIndexOf(" ") + 1));
}

test("이미지가 적은 진입점과 워크스페이스 기동 스크립트가 같다", () => {
  assert.deepEqual(imageEntrypoints(), scriptEntrypoints());
});

test("진입점 명령이 가리키는 소스가 실재한다", () => {
  const missing = scriptEntrypoints().filter((entrypoint) => !fs.existsSync(sourceOf(entrypoint)));
  assert.deepEqual(missing, []);
});

test("이미지의 기본 명령이 선언한 진입점 가운데 하나다", () => {
  const dockerfile = fs.readFileSync(path.join(ROOT, "Dockerfile"), "utf8");
  const cmd = /cd (\S+) && exec (node [^"]+)"/u.exec(dockerfile);
  assert.notEqual(cmd, null, "Dockerfile 이 기본 명령을 적지 않는다");
  assert.ok(imageEntrypoints().includes(`${cmd[1]} :: ${cmd[2]}`));
});
