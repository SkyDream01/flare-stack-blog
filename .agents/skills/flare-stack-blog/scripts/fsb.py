#!/usr/bin/env python3
"""Admin HTTP client for a running Flare Stack Blog."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tiptap  # noqa: E402

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def read_text(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except OSError as err:
        raise SystemExit(f"{path}: {err.strerror}") from err


def config_path() -> Path:
    xdg = os.environ.get("XDG_CONFIG_HOME")
    base = Path(xdg) if xdg else Path.home() / ".config"
    return base / "flare-stack-blog" / "config.toml"


def read_config() -> dict[str, str]:
    path = config_path()
    if not path.is_file():
        raise SystemExit(
            f"missing config {path}\n"
            'write:\n  url = "https://example.com"\n  api_key = "fsb_..."'
        )
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    if not data.get("url") or not data.get("api_key"):
        raise SystemExit(f"url and api_key are required in {path}")
    return data


def request(
    method: str,
    path: str,
    *,
    query: dict | None = None,
    json_body: object | None = None,
    raw_body: bytes | None = None,
    content_type: str | None = None,
) -> tuple[int, object]:
    cfg = read_config()
    origin = cfg["url"].rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    url = origin + path
    if query:
        url += "?" + urllib.parse.urlencode(
            {k: v for k, v in query.items() if v is not None}, doseq=True
        )
    headers = {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json",
        "x-api-key": cfg["api_key"],
    }
    body = None
    if raw_body is not None:
        body = raw_body
        headers["Content-Type"] = content_type or "application/octet-stream"
    elif json_body is not None:
        body = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            parsed = json.loads(raw) if raw else None
            return resp.status, parsed
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw.decode("utf-8", "replace")
        return err.code, parsed


def emit(status: int, payload: object) -> None:
    print(json.dumps({"http": status, "body": payload}, ensure_ascii=False, indent=2))
    if status >= 400:
        raise SystemExit(1)


def require_ok(status: int, payload: object) -> object:
    if status >= 400:
        emit(status, payload)
    return payload


def cmd_request(args: argparse.Namespace) -> None:
    body = None
    if args.body:
        body = json.loads(Path(args.body).read_text(encoding="utf-8"))
    elif not sys.stdin.isatty() and args.method.upper() in {"POST", "PATCH", "PUT"}:
        raw = sys.stdin.read().strip()
        body = json.loads(raw) if raw else None
    query = dict(item.split("=", 1) for item in args.query or [])
    status, payload = request(
        args.method.upper(), args.path, query=query or None, json_body=body
    )
    emit(status, payload)


def cmd_posts_list(args: argparse.Namespace) -> None:
    query = {
        "limit": args.limit,
        "offset": args.offset,
        "search": args.search,
        "status": args.status,
    }
    status, payload = request("GET", "/api/admin/posts", query=query)
    emit(status, payload)


def cmd_posts_get(args: argparse.Namespace) -> None:
    status, payload = request("GET", f"/api/admin/posts/{args.id}")
    require_ok(status, payload)
    if args.md:
        sys.stdout.write(tiptap.to_markdown(payload.get("contentJson")))
        return
    emit(status, payload)


def cmd_posts_new(_: argparse.Namespace) -> None:
    status, payload = request("POST", "/api/admin/posts", json_body={})
    emit(status, payload)


def resolve_category_id(name: str) -> int:
    status, payload = request("GET", "/api/admin/categories")
    body = require_ok(status, payload)
    items = body.get("items") if isinstance(body, dict) else body
    for item in items or []:
        if item.get("name") == name:
            return item["id"]
    names = [item.get("name") for item in items or []]
    raise SystemExit(f"category not found: {name!r} (have {names})")


def resolve_tag_ids(names: list[str]) -> list[int]:
    status, payload = request("GET", "/api/admin/tags")
    body = require_ok(status, payload)
    items = body if isinstance(body, list) else (body.get("items") or [])
    by_name = {item["name"]: item["id"] for item in items}
    missing = [name for name in names if name not in by_name]
    if missing:
        raise SystemExit(f"tag not found: {missing} (create with: fsb.py tags create NAME)")
    return [by_name[name] for name in names]


def cmd_posts_save(args: argparse.Namespace) -> None:
    data: dict = {}
    if args.title is not None:
        data["title"] = args.title
    if args.summary is not None:
        data["summary"] = args.summary
    if args.slug is not None:
        data["slug"] = args.slug
    if args.category_id is not None:
        data["categoryId"] = args.category_id
    elif args.category is not None:
        data["categoryId"] = resolve_category_id(args.category)
    if args.md:
        data["contentJson"] = tiptap.from_markdown(read_text(args.md))
    if args.json:
        data["contentJson"] = json.loads(read_text(args.json))
    if args.title and not args.slug and "slug" not in data:
        status, payload = request(
            "GET",
            "/api/admin/posts/slug",
            query={"title": args.title, "excludeId": args.id},
        )
        body = require_ok(status, payload)
        if isinstance(body, dict) and body.get("slug"):
            data["slug"] = body["slug"]
    if not data and not args.tags:
        raise SystemExit("nothing to save")
    if data:
        status, payload = request(
            "PATCH", f"/api/admin/posts/{args.id}", json_body={"data": data}
        )
        require_ok(status, payload)
    if args.tags:
        names = [part.strip() for part in args.tags.split(",") if part.strip()]
        ids = resolve_tag_ids(names)
        status, payload = request(
            "PUT", f"/api/admin/posts/{args.id}/tags", json_body={"tagIds": ids}
        )
        require_ok(status, payload)
        emit(status, payload)
        return
    emit(status, payload)


def cmd_posts_tags(args: argparse.Namespace) -> None:
    ids = resolve_tag_ids(args.names)
    status, payload = request(
        "PUT", f"/api/admin/posts/{args.id}/tags", json_body={"tagIds": ids}
    )
    emit(status, payload)


def cmd_posts_publish(args: argparse.Namespace) -> None:
    status, payload = request("POST", f"/api/admin/posts/{args.id}/publish", json_body={})
    emit(status, payload)


def cmd_posts_unpublish(args: argparse.Namespace) -> None:
    status, payload = request(
        "POST", f"/api/admin/posts/{args.id}/unpublish", json_body={}
    )
    emit(status, payload)


def cmd_slug(args: argparse.Namespace) -> None:
    status, payload = request(
        "GET",
        "/api/admin/posts/slug",
        query={"title": args.title, "excludeId": args.exclude_id},
    )
    emit(status, payload)


def cmd_tags_list(_: argparse.Namespace) -> None:
    status, payload = request("GET", "/api/admin/tags")
    emit(status, payload)


def cmd_tags_create(args: argparse.Namespace) -> None:
    status, payload = request("POST", "/api/admin/tags", json_body={"name": args.name})
    emit(status, payload)


def cmd_categories_list(_: argparse.Namespace) -> None:
    status, payload = request("GET", "/api/admin/categories")
    emit(status, payload)


def cmd_categories_create(args: argparse.Namespace) -> None:
    status, payload = request(
        "POST", "/api/admin/categories", json_body={"name": args.name}
    )
    emit(status, payload)


def cmd_media_upload(args: argparse.Namespace) -> None:
    path = Path(args.file)
    try:
        data = path.read_bytes()
    except OSError as err:
        raise SystemExit(f"{path}: {err.strerror}") from err
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    boundary = "----FsbBoundary" + secrets.token_hex(8)
    filename = path.name.replace('"', "")
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode("utf-8") + data + f"\r\n--{boundary}--\r\n".encode("utf-8")
    status, payload = request(
        "POST",
        "/api/admin/media",
        raw_body=body,
        content_type=f"multipart/form-data; boundary={boundary}",
    )
    emit(status, payload)


def cmd_media_import(args: argparse.Namespace) -> None:
    status, payload = request(
        "POST", "/api/admin/media/import", json_body={"url": args.url}
    )
    emit(status, payload)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Flare Stack Blog admin client")
    sub = parser.add_subparsers(dest="cmd", required=True)

    req = sub.add_parser("request", help="raw Admin API call")
    req.add_argument("method")
    req.add_argument("path")
    req.add_argument("--query", nargs="*", default=[])
    req.add_argument("--body", help="JSON file")
    req.set_defaults(func=cmd_request)

    posts = sub.add_parser("posts").add_subparsers(dest="posts_cmd", required=True)
    p_list = posts.add_parser("list")
    p_list.add_argument("--search")
    p_list.add_argument("--status", choices=["draft", "published"])
    p_list.add_argument("--limit", type=int, default=50)
    p_list.add_argument("--offset", type=int, default=0)
    p_list.set_defaults(func=cmd_posts_list)

    p_get = posts.add_parser("get")
    p_get.add_argument("id", type=int)
    p_get.add_argument("--md", action="store_true")
    p_get.set_defaults(func=cmd_posts_get)

    p_new = posts.add_parser("new")
    p_new.set_defaults(func=cmd_posts_new)

    p_save = posts.add_parser("save")
    p_save.add_argument("id", type=int)
    p_save.add_argument("--title")
    p_save.add_argument("--summary")
    p_save.add_argument("--slug")
    p_save.add_argument("--md")
    p_save.add_argument("--json")
    p_save.add_argument("--category")
    p_save.add_argument("--category-id", type=int)
    p_save.add_argument("--tags", help="comma-separated existing tag names")
    p_save.set_defaults(func=cmd_posts_save)

    p_tags = posts.add_parser("tags")
    p_tags.add_argument("id", type=int)
    p_tags.add_argument("names", nargs="+")
    p_tags.set_defaults(func=cmd_posts_tags)

    p_pub = posts.add_parser("publish")
    p_pub.add_argument("id", type=int)
    p_pub.set_defaults(func=cmd_posts_publish)

    p_un = posts.add_parser("unpublish")
    p_un.add_argument("id", type=int)
    p_un.set_defaults(func=cmd_posts_unpublish)

    sl = sub.add_parser("slug")
    sl.add_argument("title")
    sl.add_argument("--exclude-id", type=int)
    sl.set_defaults(func=cmd_slug)

    tags = sub.add_parser("tags").add_subparsers(dest="tags_cmd", required=True)
    t_list = tags.add_parser("list")
    t_list.set_defaults(func=cmd_tags_list)
    t_new = tags.add_parser("create")
    t_new.add_argument("name")
    t_new.set_defaults(func=cmd_tags_create)

    cats = sub.add_parser("categories").add_subparsers(
        dest="categories_cmd", required=True
    )
    c_list = cats.add_parser("list")
    c_list.set_defaults(func=cmd_categories_list)
    c_new = cats.add_parser("create")
    c_new.add_argument("name")
    c_new.set_defaults(func=cmd_categories_create)

    media = sub.add_parser("media").add_subparsers(dest="media_cmd", required=True)
    m_up = media.add_parser("upload")
    m_up.add_argument("file")
    m_up.set_defaults(func=cmd_media_upload)
    m_im = media.add_parser("import")
    m_im.add_argument("url")
    m_im.set_defaults(func=cmd_media_import)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
