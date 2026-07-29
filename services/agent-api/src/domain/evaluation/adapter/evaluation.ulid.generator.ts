import { generateUlid } from "@tracer-agent/platform";
import type { EvaluationIdGeneratorPort } from "../port/id.generator.port.js";

export class EvaluationUlidGenerator implements EvaluationIdGeneratorPort {
    next(): string {
        return generateUlid();
    }
}
