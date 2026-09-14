#!/usr/bin/env python3
"""Markdown subset <-> TipTap/ProseMirror contentJson for Flare Stack Blog."""

from __future__ import annotations

import json
import re
import sys
from typing import Any

Node = dict[str, Any]

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
FENCE_RE = re.compile(r"^```(\w*)\s*$")
HR_RE = re.compile(r"^(-{3,}|\*{3,}|_{3,})\s*$")
UL_RE = re.compile(r"^(\s*)([-*+])\s+(.*)$")
OL_RE = re.compile(r"^(\s*)(\d+)\.\s+(.*)$")
BQ_RE = re.compile(r"^>\s?(.*)$")
TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")
IMAGE_LINE_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")

INLINE_RE = re.compile(
    r"!\[([^\]]*)\]\(([^)]+)\)"
    r"|\[([^\]]+)\]\(([^)]+)\)"
    r"|`([^`]+)`"
    r"|\*\*([^*]+)\*\*"
    r"|~~([^~]+)~~"
    r"|\$([^$]+)\$"
    r"|\*([^*]+)\*"
)


def slugify(text: str) -> str:
    cleaned = text.lower().strip()
    cleaned = re.sub(r"[\s_]+", "-", cleaned)
    cleaned = re.sub(r"[^a-z0-9\-\u4e00-\u9fa5]+", "", cleaned)
    cleaned = re.sub(r"-{2,}", "-", cleaned)
    return cleaned.strip("-") or "heading"


def clamp_heading_level(n: int) -> int:
    if n <= 2:
        return 2
    if n >= 4:
        return 4
    return n


def text_node(text: str, marks: list[dict] | None = None) -> Node:
    node: Node = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return node


def link_mark(href: str) -> dict:
    return {
        "type": "link",
        "attrs": {
            "href": href,
            "target": "_blank",
            "rel": "noopener noreferrer nofollow",
            "class": None,
            "title": None,
        },
    }


def parse_inline(s: str) -> list[Node]:
    nodes: list[Node] = []
    pos = 0
    for m in INLINE_RE.finditer(s):
        if m.start() > pos:
            nodes.append(text_node(s[pos : m.start()]))
        if m.group(1) is not None:
            nodes.append(
                {
                    "type": "image",
                    "attrs": {
                        "src": m.group(2),
                        "alt": m.group(1),
                        "title": None,
                        "width": None,
                        "height": None,
                    },
                }
            )
        elif m.group(3) is not None:
            nodes.append(text_node(m.group(3), [link_mark(m.group(4))]))
        elif m.group(5) is not None:
            nodes.append(text_node(m.group(5), [{"type": "code"}]))
        elif m.group(6) is not None:
            nodes.append(text_node(m.group(6), [{"type": "bold"}]))
        elif m.group(7) is not None:
            nodes.append(text_node(m.group(7), [{"type": "strike"}]))
        elif m.group(8) is not None:
            nodes.append({"type": "inlineMath", "attrs": {"latex": m.group(8)}})
        else:
            nodes.append(text_node(m.group(9), [{"type": "italic"}]))
        pos = m.end()
    if pos < len(s):
        nodes.append(text_node(s[pos:]))
    return nodes


def paragraph(text: str) -> Node:
    content = parse_inline(text)
    node: Node = {"type": "paragraph"}
    if content:
        node["content"] = content
    return node


def heading(level: int, text: str, used: set[str]) -> Node:
    level = clamp_heading_level(level)
    base = slugify(text)
    hid = base
    n = 2
    while hid in used:
        hid = f"{base}-{n}"
        n += 1
    used.add(hid)
    return {
        "type": "heading",
        "attrs": {"id": hid, "level": level},
        "content": parse_inline(text),
    }


def code_block(language: str, code: str) -> Node:
    return {
        "type": "codeBlock",
        "attrs": {"language": language or None, "highlightedHtml": None},
        "content": [text_node(code)],
    }


def image_block(alt: str, src: str) -> Node:
    return {
        "type": "image",
        "attrs": {
            "src": src,
            "alt": alt,
            "title": None,
            "width": None,
            "height": None,
        },
    }


def list_item(text: str, children: list[Node] | None = None) -> Node:
    content: list[Node] = [paragraph(text)]
    if children:
        content.extend(children)
    return {"type": "listItem", "content": content}


def wrap_list(kind: str, items: list[Node]) -> Node:
    return {"type": "bulletList" if kind == "ul" else "orderedList", "content": items}


def parse_table_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [cell.strip() for cell in line.split("|")]


def table_node(header: list[str], rows: list[list[str]]) -> Node:
    def cells(values: list[str], header_row: bool) -> list[Node]:
        kind = "tableHeader" if header_row else "tableCell"
        return [
            {"type": kind, "content": [paragraph(value)]} for value in values
        ]

    body = [{"type": "tableRow", "content": cells(header, True)}]
    for row in rows:
        padded = row + [""] * (len(header) - len(row))
        body.append({"type": "tableRow", "content": cells(padded[: len(header)], False)})
    return {"type": "table", "content": body}


def from_markdown(md: str) -> Node:
    lines = md.replace("\r\n", "\n").split("\n")
    blocks: list[Node] = []
    used_ids: set[str] = set()
    i = 0

    def flush_paragraph(buf: list[str]) -> None:
        text = " ".join(part.strip() for part in buf if part.strip())
        if text:
            blocks.append(paragraph(text))
        buf.clear()

    para: list[str] = []

    while i < len(lines):
        line = lines[i]

        if FENCE_RE.match(line):
            flush_paragraph(para)
            lang = FENCE_RE.match(line).group(1)
            i += 1
            body: list[str] = []
            while i < len(lines) and not FENCE_RE.match(lines[i]):
                body.append(lines[i])
                i += 1
            blocks.append(code_block(lang, "\n".join(body)))
            i += 1
            continue

        if line.strip() == "$$":
            flush_paragraph(para)
            i += 1
            body = []
            while i < len(lines) and lines[i].strip() != "$$":
                body.append(lines[i])
                i += 1
            blocks.append(
                {"type": "blockMath", "attrs": {"latex": "\n".join(body).strip()}}
            )
            i += 1
            continue

        hm = HEADING_RE.match(line)
        if hm:
            flush_paragraph(para)
            blocks.append(heading(len(hm.group(1)), hm.group(2).strip(), used_ids))
            i += 1
            continue

        if HR_RE.match(line.strip()) and not UL_RE.match(line):
            flush_paragraph(para)
            blocks.append({"type": "horizontalRule"})
            i += 1
            continue

        im = IMAGE_LINE_RE.match(line.strip())
        if im:
            flush_paragraph(para)
            blocks.append(image_block(im.group(1), im.group(2)))
            i += 1
            continue

        if TABLE_ROW_RE.match(line) and i + 1 < len(lines) and TABLE_SEP_RE.match(
            lines[i + 1]
        ):
            flush_paragraph(para)
            header = parse_table_row(line)
            i += 2
            rows: list[list[str]] = []
            while i < len(lines) and TABLE_ROW_RE.match(lines[i]):
                rows.append(parse_table_row(lines[i]))
                i += 1
            blocks.append(table_node(header, rows))
            continue

        if BQ_RE.match(line):
            flush_paragraph(para)
            quote: list[str] = []
            while i < len(lines) and BQ_RE.match(lines[i]):
                quote.append(BQ_RE.match(lines[i]).group(1))
                i += 1
            inner = from_markdown("\n".join(quote)).get("content") or []
            if not inner:
                inner = [paragraph("")]
            blocks.append({"type": "blockquote", "content": inner})
            continue

        ul = UL_RE.match(line)
        ol = OL_RE.match(line)
        if ul or ol:
            flush_paragraph(para)
            kind = "ul" if ul else "ol"
            items: list[Node] = []
            while i < len(lines):
                m = UL_RE.match(lines[i]) if kind == "ul" else OL_RE.match(lines[i])
                if not m:
                    break
                items.append(list_item(m.group(3)))
                i += 1
            blocks.append(wrap_list(kind, items))
            continue

        if not line.strip():
            flush_paragraph(para)
            i += 1
            continue

        para.append(line)
        i += 1

    flush_paragraph(para)
    return {"type": "doc", "content": blocks}


def plain_inline(nodes: list[Node] | None) -> str:
    if not nodes:
        return ""
    parts: list[str] = []
    for node in nodes:
        t = node.get("type")
        if t == "text":
            s = node.get("text") or ""
            marks = {m.get("type"): m for m in node.get("marks") or []}
            if "code" in marks:
                s = f"`{s}`"
            if "bold" in marks:
                s = f"**{s}**"
            if "italic" in marks:
                s = f"*{s}*"
            if "strike" in marks:
                s = f"~~{s}~~"
            if "underline" in marks:
                s = f"*{s}*"
            if "link" in marks:
                href = (marks["link"].get("attrs") or {}).get("href") or ""
                s = f"[{s}]({href})"
            parts.append(s)
        elif t == "inlineMath":
            parts.append(f"${(node.get('attrs') or {}).get('latex', '')}$")
        elif t == "hardBreak":
            parts.append("  \n")
        elif t == "image":
            attrs = node.get("attrs") or {}
            parts.append(f"![{attrs.get('alt') or ''}]({attrs.get('src') or ''})")
        else:
            parts.append(plain_inline(node.get("content")))
    return "".join(parts)


def to_markdown(doc: Node | None) -> str:
    if not doc:
        return ""
    chunks: list[str] = []

    def emit_blocks(nodes: list[Node] | None) -> None:
        if not nodes:
            return
        for node in nodes:
            t = node.get("type")
            if t == "paragraph":
                chunks.append(plain_inline(node.get("content")))
                chunks.append("")
            elif t == "heading":
                level = clamp_heading_level(int((node.get("attrs") or {}).get("level") or 2))
                chunks.append(f"{'#' * level} {plain_inline(node.get('content'))}")
                chunks.append("")
            elif t == "codeBlock":
                lang = (node.get("attrs") or {}).get("language") or ""
                code = "".join(
                    child.get("text") or "" for child in node.get("content") or []
                )
                chunks.append(f"```{lang}".rstrip())
                chunks.append(code)
                chunks.append("```")
                chunks.append("")
            elif t == "blockquote":
                inner = to_markdown(
                    {"type": "doc", "content": node.get("content") or []}
                ).rstrip()
                quoted = "\n".join(
                    f"> {line}" if line else ">" for line in inner.split("\n")
                )
                chunks.append(quoted)
                chunks.append("")
            elif t in ("bulletList", "orderedList"):
                for idx, item in enumerate(node.get("content") or [], start=1):
                    item_blocks = item.get("content") or []
                    first = item_blocks[0] if item_blocks else {}
                    text = (
                        plain_inline(first.get("content"))
                        if first.get("type") == "paragraph"
                        else to_markdown({"type": "doc", "content": [first]}).strip()
                    )
                    prefix = "- " if t == "bulletList" else f"{idx}. "
                    chunks.append(prefix + text)
                    rest = item_blocks[1:]
                    if rest:
                        nested = to_markdown({"type": "doc", "content": rest}).rstrip()
                        for line in nested.split("\n"):
                            chunks.append(f"  {line}" if line else "")
                chunks.append("")
            elif t == "image":
                attrs = node.get("attrs") or {}
                chunks.append(f"![{attrs.get('alt') or ''}]({attrs.get('src') or ''})")
                chunks.append("")
            elif t == "horizontalRule":
                chunks.append("---")
                chunks.append("")
            elif t == "blockMath":
                chunks.append("$$")
                chunks.append((node.get("attrs") or {}).get("latex") or "")
                chunks.append("$$")
                chunks.append("")
            elif t == "table":
                rows = node.get("content") or []
                parsed: list[list[str]] = []
                for row in rows:
                    cells = []
                    for cell in row.get("content") or []:
                        cells.append(plain_inline((cell.get("content") or [{}])[0].get("content")))
                    parsed.append(cells)
                if parsed:
                    chunks.append("| " + " | ".join(parsed[0]) + " |")
                    chunks.append("| " + " | ".join("---" for _ in parsed[0]) + " |")
                    for row in parsed[1:]:
                        chunks.append("| " + " | ".join(row) + " |")
                    chunks.append("")
            elif t == "doc":
                emit_blocks(node.get("content"))
            else:
                emit_blocks(node.get("content"))

    emit_blocks(doc.get("content") if doc.get("type") == "doc" else [doc])
    text = "\n".join(chunks).strip() + "\n"
    return text


def self_test() -> None:
    md = """## Title

Paragraph with **bold**, *italic*, ~~strike~~, `code`, and [a link](https://example.com).

- one
- two

```ts
const x = 1;
```

![cover](/images/a.png)

> quoted

$$
E=mc^2
$$

Inline $x^2$ math.
"""
    doc = from_markdown(md)
    types = [n["type"] for n in doc["content"]]
    assert types == [
        "heading",
        "paragraph",
        "bulletList",
        "codeBlock",
        "image",
        "blockquote",
        "blockMath",
        "paragraph",
    ], types
    heading = doc["content"][0]
    assert heading["attrs"]["level"] == 2
    assert heading["attrs"]["id"] == "title"
    back = to_markdown(doc)
    again = from_markdown(back)
    assert again["content"][0]["attrs"]["id"] == "title"
    assert any(
        (n.get("marks") or [{}])[0].get("type") == "bold"
        for n in again["content"][1].get("content") or []
        if n.get("type") == "text"
    )


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(
            "Usage:\n"
            "  tiptap.py encode [file.md]   Markdown subset -> contentJson\n"
            "  tiptap.py decode [file.json] contentJson -> Markdown subset\n"
            "  tiptap.py --self-test\n"
            "\n"
            "Subset: headings 2-4, paragraphs, lists, quotes, fences,\n"
            "links, images, tables, **bold** *italic* ~~strike~~ `code`,\n"
            "$inline math$, $$block math$$, ---."
        )
        return
    if args[0] == "--self-test":
        self_test()
        print("ok")
        return
    cmd = args[0]
    path = args[1] if len(args) > 1 else None
    raw = sys.stdin.read() if path is None else open(path, encoding="utf-8").read()
    if cmd == "encode":
        json.dump(from_markdown(raw), sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    elif cmd == "decode":
        sys.stdout.write(to_markdown(json.loads(raw)))
    else:
        raise SystemExit(f"unknown command: {cmd}")


if __name__ == "__main__":
    main()
