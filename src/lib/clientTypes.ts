// What /api/verify sends back, as the screens read it. Types only: nothing from the server-side checks is bundled.
import type { GradeDisplay } from "./gradeMap";
import type { GradedNarration } from "./hadithMatch";
import type { VerifiedClaim } from "./verify";

export type NarrationView = GradedNarration & { display?: GradeDisplay };

export type ClaimResult = Omit<VerifiedClaim, "dorar"> & {
  dorar?: Omit<NonNullable<VerifiedClaim["dorar"]>, "narrations"> & { narrations: NarrationView[] };
};

export interface VerifyResponse {
  claims: ClaimResult[];
  dropped?: Array<{ text: string; reason: string }>;
  ms?: { extract: number; total: number };
  error?: string;
  detail?: string;
}
