import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret.js";

describe("secret", () => {
    it("암호화한 값을 복호화하면 같은 평문이 된다", () => {
        const sealed = encryptSecret("sk-ant-0123456789");

        expect(decryptSecret(sealed)).toBe("sk-ant-0123456789");
    });

    it("암호화한 값의 형식을 알아본다", () => {
        expect(isEncryptedSecret(encryptSecret("value"))).toBe(true);
    });

    it("같은 평문도 암호화할 때마다 다른 문자열이 된다", () => {
        expect(encryptSecret("value")).not.toBe(encryptSecret("value"));
    });

    it("초기벡터와 인증태그와 암호문 세 조각을 담는다", () => {
        const sealed = encryptSecret("value");

        expect(sealed.slice("enc:v1:".length).split(":")).toHaveLength(3);
    });

    it("암호화되지 않은 값의 복호화를 거절한다", () => {
        expect(() => decryptSecret("plain")).toThrow();
    });
});
