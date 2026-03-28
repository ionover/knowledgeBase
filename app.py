from __future__ import annotations

import os
from pathlib import Path, PurePosixPath

from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = BASE_DIR / "docs"

app = Flask(__name__)


def normalize_doc_path(raw_path: str) -> Path:
    if not raw_path or not raw_path.strip():
        raise ValueError("Path is required.")

    normalized = raw_path.strip().replace("\\", "/")
    posix_path = PurePosixPath(normalized)

    if posix_path.is_absolute():
        raise ValueError("Absolute paths are not allowed.")
    if any(part in {"", ".", ".."} for part in posix_path.parts):
        raise ValueError("Invalid path segments.")

    if posix_path.suffix.lower() != ".md":
        posix_path = posix_path.with_suffix(".md")

    target = DOCS_DIR.joinpath(*posix_path.parts).resolve()
    docs_root = DOCS_DIR.resolve()
    if os.path.commonpath([str(docs_root), str(target)]) != str(docs_root):
        raise ValueError("Path escapes docs directory.")

    return target


def to_relative(path: Path) -> str:
    return path.relative_to(DOCS_DIR).as_posix()


def build_tree() -> list[dict]:
    root = {"type": "dir", "name": "docs", "path": "", "children": []}

    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rel_path = md_file.relative_to(DOCS_DIR).as_posix()
        parts = rel_path.split("/")
        cursor = root
        current_parts: list[str] = []

        for part in parts[:-1]:
            current_parts.append(part)
            dir_path = "/".join(current_parts)
            found = next(
                (
                    child
                    for child in cursor["children"]
                    if child["type"] == "dir" and child["name"] == part
                ),
                None,
            )
            if found is None:
                found = {"type": "dir", "name": part, "path": dir_path, "children": []}
                cursor["children"].append(found)
            cursor = found

        cursor["children"].append({"type": "file", "name": parts[-1], "path": rel_path})

    def sort_node(node: dict) -> None:
        if node["type"] != "dir":
            return
        node["children"].sort(key=lambda item: (item["type"] != "dir", item["name"].lower()))
        for child in node["children"]:
            sort_node(child)

    sort_node(root)
    return root["children"]


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/tree")
def api_tree():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    return jsonify({"tree": build_tree()})


@app.get("/api/article")
def api_get_article():
    raw_path = request.args.get("path", "")
    try:
        target = normalize_doc_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not target.exists():
        return jsonify({"error": "Article does not exist."}), 404

    return jsonify({"path": to_relative(target), "content": target.read_text(encoding="utf-8")})


@app.post("/api/article")
def api_create_article():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    content = payload.get("content", "")

    try:
        target = normalize_doc_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if target.exists():
        return jsonify({"error": "Article already exists."}), 409

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return jsonify({"message": "Article created.", "path": to_relative(target)}), 201


@app.put("/api/article")
def api_update_article():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    content = payload.get("content", "")

    try:
        target = normalize_doc_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not target.exists():
        return jsonify({"error": "Article does not exist."}), 404

    target.write_text(content, encoding="utf-8")
    return jsonify({"message": "Article updated.", "path": to_relative(target)})


@app.delete("/api/article")
def api_delete_article():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", request.args.get("path", ""))

    try:
        target = normalize_doc_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not target.exists():
        return jsonify({"error": "Article does not exist."}), 404

    target.unlink()

    parent = target.parent
    while parent != DOCS_DIR and parent.exists() and not any(parent.iterdir()):
        parent.rmdir()
        parent = parent.parent

    return jsonify({"message": "Article deleted.", "path": to_relative(target)})


if __name__ == "__main__":
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="127.0.0.1", port=5000, debug=True)

