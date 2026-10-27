import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emailHtmlToText } from "./email-text";
import { AuthEmail } from "./templates/AuthEmail";

describe("emailHtmlToText", () => {
  it("puts the Sign-in Code on a line of its own", () => {
    const html = renderToStaticMarkup(
      AuthEmail({
        locale: "zh",
        site: { title: "测试站", primaryHue: 250 },
        type: "sign-in-code",
        code: "153105",
      }),
    );

    const lines = emailHtmlToText(html).split("\n");
    expect(lines).toContain("153105");
    expect(lines[0]).toBe("测试站");
  });

  it("drops the hidden preview text", () => {
    expect(
      emailHtmlToText(
        '<div style="display:none;max-height:0px">预览</div><p>正文</p>',
      ),
    ).toBe("正文");
  });

  it("keeps link targets and decodes entities", () => {
    expect(
      emailHtmlToText(
        '<p>查看 <a href="https://example.com/post?a=1&amp;b=2">&quot;评论&quot;</a></p>',
      ),
    ).toBe('查看 "评论" (https://example.com/post?a=1&b=2)');
  });
});
