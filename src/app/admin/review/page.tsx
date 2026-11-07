import type { Metadata } from "next";
import { ReviewReports } from "./ReviewReports";

// The specialist's page: not for visitors, not for search engines, and closed without the token.
export const metadata: Metadata = {
  title: "رپورٹوں کا جائزہ · Tathabbut",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReviewReports />;
}
