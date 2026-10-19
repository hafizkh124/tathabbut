// What /api/verify sends back, as the screens read it. Types only: nothing from the server-side checks is bundled.
import type { GradeDisplay } from "./gradeMap";
import type { GradedNarration, TurathLookupOutcome } from "./hadithMatch";
import type { VerifiedClaim } from "./verify";

export type NarrationView = GradedNarration & { display?: GradeDisplay };

/** What the screen knows of the books of Turath for a claim: asked for after /api/verify, so first «loading». */
export type TurathView = { status: "loading" } | TurathLookupOutcome;

export type ClaimResult = Omit<VerifiedClaim, "dorar"> & {
  turath?: TurathView;
  /** the id of this result's link, /r/<id> (src/lib/sharedClaims.ts); none for a personal question */
  shareId?: string;
  dorar?: Omit<NonNullable<VerifiedClaim["dorar"]>, "narrations" | "weakVariants" | "cited"> & {
    narrations: NarrationView[];
    weakVariants?: NarrationView[];
    cited?: { book: string; known: boolean; narration?: NarrationView };
  };
};

export interface VerifyResponse {
  claims: ClaimResult[];
  dropped?: Array<{ text: string; reason: string }>;
  ms?: { extract: number; total: number };
  error?: string;
  detail?: string;
}
