// Where each claim sits inside the pasted text, so the text can be shown with a coloured underline under every claim.
// A claim is always a verbatim piece of the post (src/lib/claims.ts checks that), so a plain search finds it; if the
// model's wording differs only by punctuation at the edges, the Arabic span or the query is tried next.

export interface ClaimLike {
  textAsWritten: string;
  arabicSpan?: string | null;
  query?: string;
}

export interface Segment {
  text: string;
  /** index into the claims array, or null for plain text between claims */
  claim: number | null;
}

const EDGE = /^[\s"'«»“”‘’.,:;،؛۔!؟?()[\]-]+|[\s"'«»“”‘’.,:;،؛۔!؟?()[\]-]+$/g;
const trim = (s: string) => s.replace(EDGE, "");

/** [start, end) of the first free place for any of the candidates; null if none. */
function locate(text: string, candidates: string[], taken: Array<[number, number]>): [number, number] | null {
  for (const raw of candidates) {
    const c = trim(raw);
    if (c.length < 3) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(c, from);
      if (at < 0) break;
      const end = at + c.length;
      if (!taken.some(([a, b]) => at < b && end > a)) return [at, end];
      from = at + 1;
    }
  }
  return null;
}

/** Splits the post into plain pieces and claim pieces, in reading order. A claim that cannot be placed is left out of
 *  the segments (`placed[i]` is false); the caller still lists it in the summary. */
export function segmentPost(post: string, claims: ClaimLike[]): { segments: Segment[]; placed: boolean[] } {
  const taken: Array<[number, number]> = [];
  const spans: Array<{ at: [number, number]; claim: number }> = [];
  const placed = claims.map((c, i) => {
    const at = locate(post, [c.textAsWritten, c.arabicSpan ?? "", c.query ?? ""], taken);
    if (!at) return false;
    taken.push(at);
    spans.push({ at, claim: i });
    return true;
  });

  spans.sort((a, b) => a.at[0] - b.at[0]);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const { at, claim } of spans) {
    if (at[0] > cursor) segments.push({ text: post.slice(cursor, at[0]), claim: null });
    segments.push({ text: post.slice(at[0], at[1]), claim });
    cursor = at[1];
  }
  if (cursor < post.length) segments.push({ text: post.slice(cursor), claim: null });
  return { segments, placed };
}
