# Knowledge Base (MkDocs + Local Editor)

Personal knowledge base with a local web editor:
- articles are stored as `.md` files in `docs/`;
- deep nesting is supported via path input (example: `Java/Core/Spring/Beans.md`);
- folders can be created and deleted directly from the UI;
- Markdown preview is available directly in the editor;
- the site is built by MkDocs and published to GitHub Pages via GitHub Actions.

## 1. Run the local editor

```powershell
pip install --user -r requirements.txt
python app.py
```

Open: `http://127.0.0.1:5000`

## 2. Preview the docs locally

```powershell
python -m mkdocs serve
```

Open: `http://127.0.0.1:8000`

## 3. Publish to GitHub Pages

1. Push changes to the `main` branch.
2. Workflow `.github/workflows/deploy-pages.yml` builds and deploys automatically.
3. In repository settings set:
   - `Settings -> Pages -> Source: GitHub Actions`.

## 4. Create nested structure

In the path field you can use values like:
- `Java/Core/OOP/Principles`
- `Go/Concurrency/Channels.md`

If `.md` is missing, it is added automatically.
