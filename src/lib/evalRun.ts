// The evaluation suite (eval/run-eval.ts) calls the route handlers in its own process against the live database. Set there
// and nowhere else, this flag keeps such a run from touching what belongs to real visitors: it is not counted against a
// client's limit, it neither reads nor fills the cache of checked posts (a cached answer would hide the model under test),
// and it logs no analytics events. Never set it on Vercel.
export const EVAL_RUN_ENV = "TATHABBUT_EVAL_RUN";

export const isEvalRun = (): boolean => process.env[EVAL_RUN_ENV] === "1";
