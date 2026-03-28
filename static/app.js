const treeEl = document.getElementById("tree");
const pathEl = document.getElementById("articlePath");
const contentEl = document.getElementById("articleContent");
const statusEl = document.getElementById("status");

const refreshTreeBtn = document.getElementById("refreshTreeBtn");
const createBtn = document.getElementById("createBtn");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");

let activePath = "";

function setStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function normalizePath(rawPath) {
  return (rawPath || "").trim().replaceAll("\\", "/");
}

async function loadTree() {
  const response = await fetch("/api/tree");
  const data = await response.json();
  renderTree(data.tree || []);
}

function renderTree(nodes) {
  treeEl.innerHTML = "";

  if (!nodes.length) {
    treeEl.textContent = "Пока нет статей. Создай первую справа.";
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
    const label = document.createElement("strong");
    label.textContent = `[DIR] ${node.name}`;
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
    setStatus(data.error || "Не удалось открыть статью.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  contentEl.value = data.content;
  setStatus(`Открыта статья: ${data.path}`);
  await loadTree();
}

async function createArticle() {
  const path = normalizePath(pathEl.value);
  const content = contentEl.value;

  if (!path) {
    setStatus("Укажи путь статьи.", "error");
    return;
  }

  const response = await fetch("/api/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Не удалось создать статью.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  setStatus(`Статья создана: ${data.path}`);
  await loadTree();
}

async function saveArticle() {
  const path = normalizePath(pathEl.value);
  const content = contentEl.value;

  if (!path) {
    setStatus("Укажи путь статьи.", "error");
    return;
  }

  const response = await fetch("/api/article", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Не удалось сохранить статью.", "error");
    return;
  }

  activePath = data.path;
  pathEl.value = data.path;
  setStatus(`Статья сохранена: ${data.path}`);
  await loadTree();
}

async function deleteArticle() {
  const path = normalizePath(pathEl.value);
  if (!path) {
    setStatus("Укажи путь статьи для удаления.", "error");
    return;
  }

  const ok = window.confirm(`Удалить статью "${path}"?`);
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
    setStatus(data.error || "Не удалось удалить статью.", "error");
    return;
  }

  activePath = "";
  pathEl.value = "";
  contentEl.value = "";
  setStatus(`Статья удалена: ${data.path}`);
  await loadTree();
}

refreshTreeBtn.addEventListener("click", loadTree);
createBtn.addEventListener("click", createArticle);
saveBtn.addEventListener("click", saveArticle);
deleteBtn.addEventListener("click", deleteArticle);

loadTree().catch(() => setStatus("Не удалось загрузить структуру.", "error"));
