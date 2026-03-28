const treeEl = document.getElementById("tree");
const pathEl = document.getElementById("articlePath");
const contentEl = document.getElementById("articleContent");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");

const refreshTreeBtn = document.getElementById("refreshTreeBtn");
const createBtn = document.getElementById("createBtn");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");
const createFolderBtn = document.getElementById("createFolderBtn");
const deleteFolderBtn = document.getElementById("deleteFolderBtn");

let activePath = "";
let previewTimer = null;
let previewRequestSeq = 0;

function setStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function normalizePath(rawPath) {
  return (rawPath || "").trim().replaceAll("\\", "/");
}

async function renderPreview(markdownText = contentEl.value) {
  const seq = ++previewRequestSeq;
  const response = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: markdownText }),
  });
  const data = await response.json();

  if (seq !== previewRequestSeq) {
    return;
  }

  if (!response.ok) {
    previewEl.innerHTML = '<p class="preview-placeholder">Preview error.</p>';
    return;
  }

  const html = (data.html || "").trim();
  previewEl.innerHTML = html || '<p class="preview-placeholder">Preview is empty.</p>';
}

function schedulePreview() {
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
  previewTimer = setTimeout(() => {
    renderPreview().catch(() => {
      previewEl.innerHTML = '<p class="preview-placeholder">Preview error.</p>';
    });
  }, 250);
}

async function loadTree() {
  const response = await fetch("/api/tree");
  const data = await response.json();
  renderTree(data.tree || []);
}

function renderTree(nodes) {
  treeEl.innerHTML = "";

  if (!nodes.length) {
    treeEl.textContent = "No articles yet. Create one in the editor.";
    return;
  }

  const ul = document.createElement("ul");
  for (const node of nodes) {
    ul.appendChild(renderNode(node));
  }
  treeEl.appendChild(ul);
}

function renderNode(node) {
  const li = document.createElement("li");

  if (node.type === "dir") {
    const label = document.createElement("button");
    label.type = "button";
    label.className = "tree-item";
    label.textContent = `[DIR] ${node.name}`;
    label.dataset.path = node.path;
    label.addEventListener("click", () => {
      activePath = "";
      pathEl.value = node.path;
      setStatus(`Folder selected: ${node.path}`);
      loadTree();
    });
    li.appendChild(label);

    if (node.children?.length) {
      const childUl = document.createElement("ul");
      for (const child of node.children) {
        childUl.appendChild(renderNode(child));
      }
      li.appendChild(childUl);
    }
    return li;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tree-item";
  btn.textContent = node.name;
  btn.dataset.path = node.path;

  if (node.path === activePath) {
    btn.classList.add("active");
  }

  btn.addEventListener("click", async () => {
    await loadArticle(node.path);
  });

  li.appendChild(btn);
  return li;
}

async function loadArticle(path) {
  const queryPath = encodeURIComponent(path);
  const response = await fetch(`/api/article?path=${queryPath}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not open article.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  contentEl.value = data.content;
  setStatus(`Opened article: ${data.path}`);
  await renderPreview(data.content);
  await loadTree();
}

async function createArticle() {
  const path = normalizePath(pathEl.value);
  const content = contentEl.value;

  if (!path) {
    setStatus("Enter article path.", "error");
    return;
  }

  const response = await fetch("/api/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not create article.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  setStatus(`Article created: ${data.path}`);
  await renderPreview(content);
  await loadTree();
}

async function saveArticle() {
  const path = normalizePath(pathEl.value);
  const content = contentEl.value;

  if (!path) {
    setStatus("Enter article path.", "error");
    return;
  }

  const response = await fetch("/api/article", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not save article.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  setStatus(`Article saved: ${data.path}`);
  await renderPreview(content);
  await loadTree();
}

async function deleteArticle() {
  const path = normalizePath(pathEl.value);
  if (!path) {
    setStatus("Enter article path to delete.", "error");
    return;
  }

  const ok = window.confirm(`Delete article "${path}"?`);
  if (!ok) {
    return;
  }

  const response = await fetch("/api/article", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not delete article.", "error");
    return;
  }

  activePath = "";
  pathEl.value = "";
  contentEl.value = "";
  setStatus(`Article deleted: ${data.path}`);
  await renderPreview("");
  await loadTree();
}

async function createFolder() {
  const path = normalizePath(pathEl.value);
  if (!path) {
    setStatus("Enter folder path.", "error");
    return;
  }

  const response = await fetch("/api/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not create folder.", "error");
    return;
  }

  activePath = "";
  pathEl.value = data.path;
  setStatus(`Folder created: ${data.path}`);
  await loadTree();
}

async function deleteFolder() {
  const path = normalizePath(pathEl.value);
  if (!path) {
    setStatus("Enter folder path to delete.", "error");
    return;
  }

  const ok = window.confirm(`Delete folder "${path}" and all contents?`);
  if (!ok) {
    return;
  }

  const response = await fetch("/api/folder", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Could not delete folder.", "error");
    return;
  }

  activePath = "";
  pathEl.value = "";
  contentEl.value = "";
  setStatus(`Folder deleted: ${data.path}`);
  await renderPreview("");
  await loadTree();
}

refreshTreeBtn.addEventListener("click", loadTree);
createBtn.addEventListener("click", createArticle);
saveBtn.addEventListener("click", saveArticle);
deleteBtn.addEventListener("click", deleteArticle);
createFolderBtn.addEventListener("click", createFolder);
deleteFolderBtn.addEventListener("click", deleteFolder);
contentEl.addEventListener("input", schedulePreview);

loadTree().catch(() => setStatus("Could not load tree.", "error"));
renderPreview("").catch(() => {
  previewEl.innerHTML = '<p class="preview-placeholder">Preview error.</p>';
});

