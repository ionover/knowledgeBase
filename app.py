from __future__ import annotations

import os
import shutil
from pathlib import Path, PurePosixPath

from flask import Flask, jsonify, render_template, request
import markdown as md


BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = BASE_DIR / "docs"
MARKDOWN_EXTENSIONS = [
    "admonition",
    "toc",
    "tables",
    "fenced_code",
    "codehilite",
]

app = Flask(__name__)


def normalize_relative_path(raw_path: str) -> PurePosixPath:
    if not raw_path or not raw_path.strip():
        raise ValueError("Path is required.")

    normalized = raw_path.strip().replace("\\", "/")
    posix_path = PurePosixPath(normalized)

    if posix_path.is_absolute():
        raise ValueError("Absolute paths are not allowed.")
    if any(part in {"", ".", ".."} for part in posix_path.parts):
        raise ValueError("Invalid path segments.")

    return posix_path


def resolve_under_docs(posix_path: PurePosixPath) -> Path:
    target = DOCS_DIR.joinpath(*posix_path.parts).resolve()
    docs_root = DOCS_DIR.resolve()
    if os.path.commonpath([str(docs_root), str(target)]) != str(docs_root):
        raise ValueError("Path escapes docs directory.")
    return target


def normalize_doc_path(raw_path: str) -> Path:
    posix_path = normalize_relative_path(raw_path)
    if posix_path.suffix.lower() != ".md":
        posix_path = posix_path.with_suffix(".md")
    return resolve_under_docs(posix_path)


def normalize_dir_path(raw_path: str) -> Path:
    posix_path = normalize_relative_path(raw_path)
    if posix_path.suffix.lower() == ".md":
        raise ValueError("Folder path must not end with .md.")
    return resolve_under_docs(posix_path)


def to_relative(path: Path) -> str:
    return path.relative_to(DOCS_DIR).as_posix()


def build_tree() -> list[dict]:
    def list_children(dir_path: Path) -> list[dict]:
        children: list[dict] = []
        for child in sorted(dir_path.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
            if child.name.startswith("."):
                continue
            if child.is_dir():
                children.append(
                    {
                        "type": "dir",
                        "name": child.name,
                        "path": child.relative_to(DOCS_DIR).as_posix(),
                        "children": list_children(child),
                    }
                )
                continue

            if child.is_file() and child.suffix.lower() == ".md":
                children.append(
                    {
                        "type": "file",
                        "name": child.name,
                        "path": child.relative_to(DOCS_DIR).as_posix(),
                    }
                )
        return children

    return list_children(DOCS_DIR)


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


@app.post("/api/folder")
def api_create_folder():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")

    try:
        target = normalize_dir_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if target.exists():
        return jsonify({"error": "Folder already exists."}), 409

    target.mkdir(parents=True, exist_ok=False)
    return jsonify({"message": "Folder created.", "path": to_relative(target)}), 201


@app.delete("/api/folder")
def api_delete_folder():
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", request.args.get("path", ""))

    try:
        target = normalize_dir_path(raw_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not target.exists():
        return jsonify({"error": "Folder does not exist."}), 404
    if not target.is_dir():
        return jsonify({"error": "Target path is not a folder."}), 400
    if target.resolve() == DOCS_DIR.resolve():
        return jsonify({"error": "Deleting docs root is not allowed."}), 400

    shutil.rmtree(target)
    return jsonify({"message": "Folder deleted.", "path": to_relative(target)})


@app.post("/api/preview")
def api_preview():
    payload = request.get_json(silent=True) or {}
    content = payload.get("content", "")
    rendered = md.markdown(
        content,
        extensions=MARKDOWN_EXTENSIONS,
        output_format="html5",
    )
    return jsonify({"html": rendered})


if __name__ == "__main__":
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="127.0.0.1", port=5000, debug=True)
