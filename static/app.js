const treeEl = document.getElementById("tree");
const pathEl = document.getElementById("articlePath");
const contentEl = document.getElementById("articleContent");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const contextMenuEl = document.getElementById("contextMenu");

const createRootFolderBtn = document.getElementById("createRootFolderBtn");
const refreshTreeBtn = document.getElementById("refreshTreeBtn");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");

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

function joinPath(basePath, itemName) {
  return [normalizePath(basePath), normalizePath(itemName)].filter(Boolean).join("/");
}

function basename(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function validateNodeName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required." };
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false, error: "Use a single name without slashes." };
  }
  if (trimmed === "." || trimmed === "..") {
    return { ok: false, error: "Invalid name." };
  }
  return { ok: true, value: trimmed };
}

function hideContextMenu() {
  contextMenuEl.classList.add("hidden");
  contextMenuEl.innerHTML = "";
}

function showContextMenu(clientX, clientY, items) {
  contextMenuEl.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `context-menu-item${item.danger ? " danger" : ""}`;
    button.textContent = item.label;
    button.addEventListener("click", async () => {
      hideContextMenu();
      await item.onClick();
    });
    contextMenuEl.appendChild(button);
  }

  contextMenuEl.classList.remove("hidden");

  const menuRect = contextMenuEl.getBoundingClientRect();
  const maxX = window.innerWidth - menuRect.width - 8;
  const maxY = window.innerHeight - menuRect.height - 8;

  const left = Math.min(clientX, Math.max(8, maxX));
  const top = Math.min(clientY, Math.max(8, maxY));
  contextMenuEl.style.left = `${left}px`;
  contextMenuEl.style.top = `${top}px`;
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
    treeEl.textContent = "No articles yet. Create a root folder to begin.";
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-item";
    button.textContent = `[DIR] ${node.name}`;
    button.dataset.path = node.path;

    button.addEventListener("click", () => {
      activePath = "";
      pathEl.value = node.path;
      setStatus(`Folder selected: ${node.path}`);
      loadTree();
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      pathEl.value = node.path;
      showContextMenu(event.clientX, event.clientY, [
        {
          label: "Create folder",
          onClick: () => createFolderPrompt(node.path),
        },
        {
          label: "Create article",
          onClick: () => createArticlePrompt(node.path),
        },
        {
          label: "Delete folder",
          danger: true,
          onClick: () => deleteFolderByPath(node.path),
        },
      ]);
    });

    li.appendChild(button);

    if (node.children?.length) {
      const childUl = document.createElement("ul");
      for (const child of node.children) {
        childUl.appendChild(renderNode(child));
      }
      li.appendChild(childUl);
    }
    return li;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-item";
  button.textContent = node.name;
  button.dataset.path = node.path;

  if (node.path === activePath) {
    button.classList.add("active");
  }

  button.addEventListener("click", async () => {
    await loadArticle(node.path);
  });

  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, [
      {
        label: "Open article",
        onClick: () => loadArticle(node.path),
      },
      {
        label: "Delete article",
        danger: true,
        onClick: () => deleteArticleByPath(node.path),
      },
    ]);
  });

  li.appendChild(button);
  return li;
}

async function apiCreateArticle(path, content) {
  const response = await fetch("/api/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not create article.");
  }
  return data;
}

async function apiUpdateArticle(path, content) {
  const response = await fetch("/api/article", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not save article.");
  }
  return data;
}

async function apiDeleteArticle(path) {
  const response = await fetch("/api/article", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not delete article.");
  }
  return data;
}

async function apiCreateFolder(path) {
  const response = await fetch("/api/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not create folder.");
  }
  return data;
}

async function apiDeleteFolder(path) {
  const response = await fetch("/api/folder", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not delete folder.");
  }
  return data;
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

async function saveArticle() {
  const path = normalizePath(pathEl.value);
  const content = contentEl.value;

  if (!path) {
    setStatus("Enter article path.", "error");
    return;
  }

  try {
    const data = await apiUpdateArticle(path, content);
    activePath = data.path;
    pathEl.value = data.path;
    setStatus(`Article saved: ${data.path}`);
    await renderPreview(content);
    await loadTree();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deleteArticle() {
  const path = normalizePath(pathEl.value);
  if (!path) {
    setStatus("Enter article path to delete.", "error");
    return;
  }
  await deleteArticleByPath(path);
}

async function deleteArticleByPath(path) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    setStatus("Enter article path to delete.", "error");
    return;
  }

  const ok = window.confirm(`Delete article "${normalizedPath}"?`);
  if (!ok) {
    return;
  }

  try {
    const data = await apiDeleteArticle(normalizedPath);
    if (activePath === normalizedPath) {
      activePath = "";
      pathEl.value = "";
      contentEl.value = "";
      await renderPreview("");
    }
    setStatus(`Article deleted: ${data.path}`);
    await loadTree();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function createRootFolder() {
  await createFolderPrompt("");
}

async function createFolderPrompt(parentPath) {
  const rawName = window.prompt("Folder name:");
  const validation = validateNodeName(rawName);
  if (!rawName) {
    return;
  }
  if (!validation.ok) {
    setStatus(validation.error, "error");
    return;
  }

  const fullPath = joinPath(parentPath, validation.value);
  try {
    const data = await apiCreateFolder(fullPath);
    activePath = "";
    pathEl.value = data.path;
    setStatus(`Folder created: ${data.path}`);
    await loadTree();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function createArticlePrompt(parentPath) {
  const rawName = window.prompt("Article name (without .md is allowed):");
  const validation = validateNodeName(rawName);
  if (!rawName) {
    return;
  }
  if (!validation.ok) {
    setStatus(validation.error, "error");
    return;
  }

  let articleName = validation.value;
  if (!articleName.toLowerCase().endsWith(".md")) {
    articleName = `${articleName}.md`;
  }
  const fullPath = joinPath(parentPath, articleName);

  const title = basename(articleName).replace(/\.md$/i, "");
  const initialContent = `# ${title}\n\n`;
  try {
    const data = await apiCreateArticle(fullPath, initialContent);
    activePath = data.path;
    pathEl.value = data.path;
    contentEl.value = initialContent;
    setStatus(`Article created: ${data.path}`);
    await renderPreview(initialContent);
    await loadTree();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deleteFolderByPath(path) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    setStatus("Enter folder path to delete.", "error");
    return;
  }

  const ok = window.confirm(`Delete folder "${normalizedPath}" and all contents?`);
  if (!ok) {
    return;
  }

  try {
    const data = await apiDeleteFolder(normalizedPath);
    const openedPath = normalizePath(pathEl.value);
    if (openedPath && (openedPath === normalizedPath || openedPath.startsWith(`${normalizedPath}/`))) {
      activePath = "";
      pathEl.value = "";
      contentEl.value = "";
      await renderPreview("");
    }
    setStatus(`Folder deleted: ${data.path}`);
    await loadTree();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

refreshTreeBtn.addEventListener("click", loadTree);
createRootFolderBtn.addEventListener("click", createRootFolder);
saveBtn.addEventListener("click", saveArticle);
deleteBtn.addEventListener("click", deleteArticle);
contentEl.addEventListener("input", schedulePreview);

treeEl.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".tree-item")) {
    return;
  }
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY, [
    {
      label: "Create root folder",
      onClick: createRootFolder,
    },
  ]);
});

document.addEventListener("click", hideContextMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideContextMenu();
  }
});
window.addEventListener("resize", hideContextMenu);
window.addEventListener("scroll", hideContextMenu, true);

loadTree().catch(() => setStatus("Could not load tree.", "error"));
renderPreview("").catch(() => {
  previewEl.innerHTML = '<p class="preview-placeholder">Preview error.</p>';
});
