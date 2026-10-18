// Work to do once the answer has gone out (storing results, counting events): Next's after(), which keeps the function
// alive for it on Vercel. Outside a request (the route tests) it simply runs, unawaited.
import { after } from "next/server";

export function later(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    task().catch(() => {});
  }
}
