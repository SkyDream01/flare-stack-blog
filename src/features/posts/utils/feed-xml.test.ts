import { Feed } from "feed";
import { childNamed, parseXml } from "tests/xml";
import { describe, expect, it } from "vitest";
import {
  cdataField,
  finishXml,
  htmlFromText,
  textField,
  withoutXmlForbiddenCharacters,
} from "./feed-xml";

/**
 * The feed library's CDATA and text handling, which feed-xml.ts works around:
 * the unit under test is the library plus the workaround, read back with a
 * strict XML parser.
 */

function rssItemOf(fields: {
  title: string;
  description: string;
  content: string;
}) {
  const feed = new Feed({
    title: "Site",
    id: "https://blog.example/",
    link: "https://blog.example/",
    copyright: "",
  });
  feed.addItem({
    id: "1",
    link: "https://blog.example/post/one",
    date: new Date("2026-01-01T00:00:00Z"),
    title: cdataField(fields.title),
    description: cdataField(fields.description),
    content: cdataField(fields.content),
  });
  const channel = childNamed(parseXml(finishXml(feed.rss2())), "channel");
  return childNamed(channel, "item");
}

describe("withoutXmlForbiddenCharacters", () => {
  it("removes what XML 1.0 forbids and keeps the rest", () => {
    const forbidden = "\u0000\u0008\u000B\u000C\u000E\u001B\uFFFE\uFFFF\uD800";
    expect(withoutXmlForbiddenCharacters(`a${forbidden}b`)).toBe("ab");
    expect(
      withoutXmlForbiddenCharacters("tab\t line\n cr\r 你好 👩‍💻 \u{10FFFF}"),
    ).toBe("tab\t line\n cr\r 你好 👩‍💻 \u{10FFFF}");
  });
});

describe("the feed library", () => {
  it("does not escape a second ]]> in CDATA, which is why fields are split here", () => {
    const feed = new Feed({
      title: "Site",
      id: "https://blog.example/",
      link: "https://blog.example/",
      copyright: "",
    });
    feed.addItem({
      id: "1",
      link: "https://blog.example/post/one",
      date: new Date(),
      title: "a]]>b]]>c",
    });
    expect(() => parseXml(feed.rss2())).toThrow();
  });
});

describe("cdataField", () => {
  it("keeps any number of ]]> as text, without adding markup", () => {
    const hostile = 'x]]>y]]><evil a="1"/>]]>]]]]>z';
    const item = rssItemOf({
      title: hostile,
      description: hostile,
      content: hostile,
    });

    expect(item.children.map((child) => child.name)).toEqual([
      "title",
      "link",
      "guid",
      "pubDate",
      "description",
      "content:encoded",
    ]);
    expect(childNamed(item, "title").text).toBe(hostile);
    expect(childNamed(item, "description").text).toBe(hostile);
    expect(childNamed(item, "content:encoded").text).toBe(hostile);
  });

  it("drops forbidden characters and keeps the text around them", () => {
    const item = rssItemOf({
      title: "a\u0000b\u000Bc",
      description: "\u001B[31mred\u001B[0m",
      content: "<pre><code>\uFFFE x \uD800</code></pre>",
    });

    expect(childNamed(item, "title").text).toBe("abc");
    expect(childNamed(item, "description").text).toBe("[31mred[0m");
    expect(childNamed(item, "content:encoded").text).toBe(
      "<pre><code> x </code></pre>",
    );
  });
});

describe("textField", () => {
  it("keeps a literal &amp; and escapes the rest", () => {
    const title = 'Tom &amp; Jerry <T> & "q" \u0000';
    const feed = new Feed({
      title: textField(title),
      description: textField(title),
      id: "https://blog.example/",
      link: "https://blog.example/",
      copyright: "",
    });

    const channel = childNamed(parseXml(finishXml(feed.rss2())), "channel");
    expect(childNamed(channel, "title").text).toBe(
      'Tom &amp; Jerry <T> & "q" ',
    );
    expect(childNamed(channel, "description").text).toBe(
      'Tom &amp; Jerry <T> & "q" ',
    );
  });
});

describe("htmlFromText", () => {
  it("makes plain text HTML that reads back as the same text", () => {
    expect(htmlFromText('Promise<void> & "q"')).toBe(
      "Promise&lt;void&gt; &amp; &quot;q&quot;",
    );
  });
});
