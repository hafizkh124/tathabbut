import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/lib/i18n/i18n";
import { translate, DEFAULT_LOCALE } from "@/lib/i18n/dict";
import { ErrorView, type ErrorKind } from "./ErrorView";

const render = (kind: ErrorKind) => renderToStaticMarkup(<LocaleProvider><ErrorView kind={kind} text="old submitted text" onRetry={() => {}} onEdit={() => {}} /></LocaleProvider>);

describe("retry after a failed picture", () => {
  it("offers a return instead of retrying a previously submitted text", () => {
    const html = render("pictureNetwork");
    expect(html).toContain(translate(DEFAULT_LOCALE, "error.network"));
    expect(html).toContain(translate(DEFAULT_LOCALE, "action.back"));
    expect(html).not.toContain("old submitted text");
    expect(html).not.toContain(translate(DEFAULT_LOCALE, "action.retry"));
  });
  it("retains text and retry for a failed text request", () => {
    const html = render("network");
    expect(html).toContain("old submitted text");
    expect(html).toContain(translate(DEFAULT_LOCALE, "action.retry"));
  });
});
