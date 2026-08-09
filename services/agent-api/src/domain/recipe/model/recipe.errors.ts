import { DomainError } from "@tracer-agent/platform";

/** 후보가 아닌 레시피를 채택하거나 보류하려 했음을 알린다. */
export class RecipeNotCandidateError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "recipe.not-candidate";

    constructor() {
        super("Recipe is not a candidate");
    }
}

/** 채택되지 않은 레시피를 폐기하거나 고치려 했음을 알린다. */
export class RecipeNotActiveError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "recipe.not-active";

    constructor() {
        super("Recipe is not active");
    }
}

/** 보류하거나 폐기하지 않은 레시피를 지우려 했음을 알린다. */
export class RecipeNotDeletableError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "recipe.not-deletable";

    constructor() {
        super("Recipe is not deletable");
    }
}
