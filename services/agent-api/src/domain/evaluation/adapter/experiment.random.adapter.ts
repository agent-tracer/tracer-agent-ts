import type { ExperimentRandomPort } from "../port/experiment.support.port.js";

export class ExperimentRandomAdapter implements ExperimentRandomPort {
    number(): number {
        return Math.random();
    }

    boolean(): boolean {
        return this.number() >= 0.5;
    }
}
