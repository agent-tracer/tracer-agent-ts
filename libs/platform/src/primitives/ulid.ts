import { randomBytes } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(timeMs: number): string {
    let value = Math.floor(timeMs);
    let output = "";
    for (let i = 0; i < 10; i++) {
        output = ENCODING[value % 32]! + output;
        value = Math.floor(value / 32);
    }
    return output;
}

function encodeRandom(): string {
    const bytes = randomBytes(10);
    let bits = 0;
    let bitLength = 0;
    let output = "";

    for (const byte of bytes) {
        bits = (bits << 8) | byte;
        bitLength += 8;
        while (bitLength >= 5 && output.length < 16) {
            const index = (bits >> (bitLength - 5)) & 31;
            output += ENCODING[index]!;
            bitLength -= 5;
        }
    }

    while (output.length < 16) {
        output += ENCODING[randomBytes(1)[0]! & 31]!;
    }
    return output;
}

/** 시각을 받아야만 만들며, 기본 인자로 벽시계를 숨기면 부르는 쪽의 결정성이 사라진다. */
export function generateUlid(timeMs: number): string {
    return `${encodeTime(timeMs)}${encodeRandom()}`;
}
