const API_BASE = "http://localhost:5000/todos";

const STATUS_META = {
  todo: { key: "todo", label: "To do", progress: 0 },
  doing: { key: "doing", label: "In Progress", progress: 50 },
  done: { key: "done", label: "Done", progress: 100 },
};

const CATEGORY_META = {
  work: { key: "work", label: "업무" },
  study: { key: "study", label: "공부" },
  exercise: { key: "exercise", label: "운동" },
  personal: { key: "personal", label: "개인" },
  hobby: { key: "hobby", label: "취미" },
};

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const dueDateInput = document.getElementById("todo-due-date");
const memoInput = document.getElementById("todo-memo");
const categorySelect = document.getElementById("todo-category");
const submitBtn = document.getElementById("submit-btn");
const openAddBtn = document.getElementById("open-add-btn");
const addModal = document.getElementById("add-modal");
const detailModal = document.getElementById("detail-modal");
const detailForm = document.getElementById("detail-form");
const detailTitleInput = document.getElementById("detail-title");
const detailMemoInput = document.getElementById("detail-memo");
const detailDueDateInput = document.getElementById("detail-due-date");
const detailCategorySelect = document.getElementById("detail-category");
const detailDdayEl = document.getElementById("detail-dday");
const detailSaveBtn = document.getElementById("detail-save-btn");
const detailDeleteBtn = document.getElementById("detail-delete-btn");
const board = document.querySelector(".board");
const viewTabs = [...document.querySelectorAll(".view-tab")];
const categoryChips = [...document.querySelectorAll("[data-category]")];
const columns = {
  todo: document.querySelector('.column[data-status="todo"]'),
  doing: document.querySelector('.column[data-status="doing"]'),
  done: document.querySelector('.column[data-status="done"]'),
};

const lists = {
  todo: document.getElementById("list-todo"),
  doing: document.getElementById("list-doing"),
  done: document.getElementById("list-done"),
};

const empties = {
  todo: document.getElementById("empty-todo"),
  doing: document.getElementById("empty-doing"),
  done: document.getElementById("empty-done"),
};

const calendarTitle = document.getElementById("calendar-title");
const calendarGrid = document.getElementById("calendar-grid");
const todayList = document.getElementById("today-list");
const todayEmpty = document.getElementById("today-empty");
const calPrevBtn = document.getElementById("cal-prev");
const calNextBtn = document.getElementById("cal-next");

/** @type {{ id: string, title: string, completed: boolean, status: "todo" | "doing" | "done", category: string, memo: string, createdAt: string | null, dueDate: string | null }[]} */
let todos = [];
/** @type {"all" | "todo" | "doing" | "done"} */
let currentView = "all";
/** @type {"all" | "work" | "study" | "exercise" | "personal" | "hobby"} */
let currentCategory = "all";
/** @type {string | null} */
let detailTodoId = null;
/** @type {boolean} */
let isSavingDetail = false;

async function api(path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    const message = data?.error || `요청 실패 (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const now = new Date();
/** @type {{ year: number, month: number }} */
let calendarCursor = {
  year: now.getFullYear(),
  month: now.getMonth(),
};
/** @type {string} */
let selectedDateKey = toDateInputValue(now);

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isOverdue(todo) {
  if (!todo.dueDate || todo.status === "done") return false;
  const due = new Date(todo.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  return due < startOfToday();
}

function formatDday(value) {
  if (!value) return "";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - startOfToday().getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "d-day";
  if (diffDays > 0) return `d-${diffDays}`;
  return `d+${Math.abs(diffDays)}`;
}

function resolveStatus(todo) {
  if (todo.status === "todo" || todo.status === "doing" || todo.status === "done") {
    return todo.status;
  }
  if (todo.completed) return "done";
  if (todo.dueDate) return "doing";
  return "todo";
}

function resolveCategory(todo) {
  if (CATEGORY_META[todo.category]) return todo.category;
  return "personal";
}

function normalizeTodo(todo, overrides = {}) {
  const status = resolveStatus({ ...todo, ...overrides });
  const merged = { ...todo, ...overrides };
  return {
    id: String(merged._id || merged.id || todo._id || todo.id),
    title: merged.title ?? "",
    completed: status === "done",
    status,
    category: resolveCategory(merged),
    memo: typeof merged.memo === "string" ? merged.memo : "",
    createdAt: merged.createdAt || null,
    dueDate: merged.dueDate || null,
  };
}

function getVisibleTodos() {
  return todos.filter((todo) => {
    if (currentCategory !== "all" && todo.category !== currentCategory) {
      return false;
    }
    return true;
  });
}

function getCardStatus(todo) {
  return STATUS_META[todo.status] || STATUS_META.todo;
}


function setCategory(category) {
  currentCategory = category;
  categoryChips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.category === category);
  });
  render();
}

function setView(view) {
  currentView = view;

  viewTabs.forEach((tab) => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(columns).forEach(([status, column]) => {
    const visible = view === "all" || view === status;
    column.classList.toggle("is-hidden", !visible);
  });

  board.classList.toggle("is-single", view !== "all");
  render();
}

function syncBodyScroll() {
  const anyOpen = !addModal.hidden || !detailModal.hidden;
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

function openAddModal() {
  closeDetailModal();
  addModal.hidden = false;
  syncBodyScroll();
  requestAnimationFrame(() => {
    input.focus();
  });
}

function closeAddModal() {
  addModal.hidden = true;
  form.reset();
  memoInput.value = "";
  categorySelect.value = "personal";
  submitBtn.disabled = false;
  syncBodyScroll();
}

function updateDetailDdayPreview(dueValue) {
  if (!dueValue) {
    detailDdayEl.textContent = "마감일을 선택해 주세요";
    detailDdayEl.classList.remove("is-overdue");
    return;
  }

  const dday = formatDday(dueValue);
  const overdue = isOverdue({ dueDate: dueValue, status: "todo" });
  detailDdayEl.classList.toggle("is-overdue", overdue);
  detailDdayEl.textContent = overdue
    ? `${dday} · 마감 지남 · ${formatDate(dueValue)}`
    : `${dday} · 마감 ${formatDate(dueValue)}`;
}

function openDetailModal(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo || isSavingDetail) return;

  closeAddModal();
  detailTodoId = id;
  detailTitleInput.value = todo.title;
  detailMemoInput.value = todo.memo || "";
  detailDueDateInput.value = toDateInputValue(todo.dueDate);
  detailCategorySelect.value = todo.category || "personal";
  updateDetailDdayPreview(detailDueDateInput.value);
  detailSaveBtn.disabled = false;
  detailDeleteBtn.disabled = false;
  detailModal.hidden = false;
  syncBodyScroll();
  requestAnimationFrame(() => {
    detailTitleInput.focus();
    detailTitleInput.select();
  });
}

function closeDetailModal() {
  if (isSavingDetail) return;
  detailModal.hidden = true;
  detailTodoId = null;
  detailForm.reset();
  detailDdayEl.textContent = "";
  detailDdayEl.classList.remove("is-overdue");
  detailSaveBtn.disabled = false;
  detailDeleteBtn.disabled = false;
  syncBodyScroll();
}

async function loadTodos() {
  const data = await api();
  todos = Array.isArray(data) ? data.map(normalizeTodo) : [];
  render();
}

async function addTodo(title, dueDate, category = "personal", memo = "") {
  const payload = {
    title,
    status: "todo",
    category,
    memo: memo.trim(),
  };
  if (dueDate) payload.dueDate = dueDate;

  const created = await api("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  todos.unshift(normalizeTodo(created));
  render();
}

async function updateTodo(id, updates) {
  const updated = await api(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  const normalized = normalizeTodo(updated, updates);
  todos = todos.map((todo) => (todo.id === id ? normalized : todo));
  render();
  return normalized;
}

async function moveTodo(id, status) {
  const todo = todos.find((t) => t.id === id);
  if (!todo || todo.status === status) return;

  const previous = { ...todo };
  todo.status = status;
  todo.completed = status === "done";
  render();

  try {
    await updateTodo(id, { status });
  } catch (error) {
    console.error(error);
    Object.assign(todo, previous);
    render();
    alert(`상태를 변경하지 못했습니다.\n${error.message}`);
  }
}

async function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  const nextStatus = todo.status === "done" ? "todo" : "done";
  await moveTodo(id, nextStatus);
}

async function deleteTodo(id) {
  const row = document.querySelector(`[data-id="${id}"]`);

  const removeItem = async () => {
    try {
      await api(`/${id}`, { method: "DELETE" });
      todos = todos.filter((todo) => todo.id !== id);
      if (detailTodoId === id) {
        isSavingDetail = false;
        closeDetailModal();
      }
      render();
    } catch (error) {
      console.error(error);
      alert(`할일을 삭제하지 못했습니다.\n${error.message}`);
      render();
    }
  };

  if (row) {
    row.classList.add("is-leaving");
    window.setTimeout(() => {
      removeItem();
    }, 200);
    return;
  }

  await removeItem();
}

async function saveDetailTodo() {
  if (isSavingDetail || !detailTodoId) return;

  const todo = todos.find((item) => item.id === detailTodoId);
  if (!todo) return;

  const title = detailTitleInput.value.trim();
  const dueDate = detailDueDateInput.value;
  const memo = detailMemoInput.value.trim();
  const category = detailCategorySelect.value;

  if (!title) {
    alert("할일 내용을 입력해 주세요.");
    detailTitleInput.focus();
    return;
  }

  if (!dueDate) {
    alert("마감일을 선택해 주세요.");
    detailDueDateInput.focus();
    return;
  }

  isSavingDetail = true;
  detailSaveBtn.disabled = true;
  detailDeleteBtn.disabled = true;

  const previous = { ...todo };
  todo.title = title;
  todo.dueDate = dueDate;
  todo.memo = memo;
  todo.category = category || "personal";
  render();

  try {
    await updateTodo(detailTodoId, {
      title,
      dueDate,
      memo,
      category: category || "personal",
    });
    isSavingDetail = false;
    closeDetailModal();
  } catch (error) {
    console.error(error);
    Object.assign(todo, previous);
    render();
    alert(`할일을 수정하지 못했습니다.\n${error.message}`);
  } finally {
    isSavingDetail = false;
    detailSaveBtn.disabled = false;
    detailDeleteBtn.disabled = false;
  }
}

function createTodoElement(todo) {
  const overdue = isOverdue(todo);
  const status = getCardStatus(todo);
  const li = document.createElement("li");
  li.className = [
    "todo-item",
    "is-clickable",
    `status-${status.key}`,
    todo.status === "done" ? "is-done" : "",
    overdue ? "is-overdue" : "",
  ]
    .filter(Boolean)
    .join(" ");
  li.dataset.id = todo.id;
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.setAttribute("aria-label", `${todo.title} 상세 보기`);

  li.addEventListener("click", () => {
    openDetailModal(todo.id);
  });
  li.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetailModal(todo.id);
    }
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-check";
  checkbox.checked = todo.status === "done";
  checkbox.setAttribute("aria-label", "완료 표시");
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  checkbox.addEventListener("change", () => {
    toggleTodo(todo.id);
  });

  const top = document.createElement("div");
  top.className = "todo-card-top";

  const heading = document.createElement("div");
  heading.className = "todo-card-heading";

  const text = document.createElement("h3");
  text.className = "todo-text";
  text.textContent = todo.title;

  const category = document.createElement("span");
  const categoryMeta = CATEGORY_META[todo.category] || CATEGORY_META.personal;
  category.className = `todo-category cat-${categoryMeta.key}`;
  category.textContent = categoryMeta.label;

  const subtitle = document.createElement("p");
  subtitle.className = "todo-subtitle";
  if (todo.dueDate) {
    const dday = formatDday(todo.dueDate);
    if (overdue) {
      subtitle.classList.add("is-overdue-label");
      subtitle.textContent = `${dday} · 마감 지남`;
    } else {
      subtitle.textContent = dday;
    }
  } else {
    subtitle.textContent = `등록 ${formatDate(todo.createdAt) || "-"}`;
  }

  heading.append(text, category, subtitle);
  top.append(checkbox, heading);

  const move = document.createElement("div");
  move.className = "todo-move";
  move.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  Object.values(STATUS_META).forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-move${item.key === todo.status ? " is-current" : ""}`;
    btn.textContent = item.label;
    btn.disabled = item.key === todo.status;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTodo(todo.id, item.key);
    });
    move.append(btn);
  });

  li.append(top, move);
  return li;
}

function getDateKey(value) {
  return toDateInputValue(value);
}

function getTodosForDate(dateKey) {
  return getVisibleTodos().filter(
    (todo) => todo.dueDate && getDateKey(todo.dueDate) === dateKey
  );
}

function renderSelectedDayList() {
  const items = getTodosForDate(selectedDateKey);
  todayList.replaceChildren(
    ...items.map((todo) => {
      const li = document.createElement("li");
      li.className = "today-item is-clickable";
      li.tabIndex = 0;
      li.setAttribute("role", "button");

      const title = document.createElement("span");
      title.className = "today-item-title";
      title.textContent = todo.title;

      const meta = document.createElement("span");
      meta.className = "today-item-meta";
      const category =
        CATEGORY_META[todo.category]?.label || CATEGORY_META.personal.label;
      const status = STATUS_META[todo.status]?.label || todo.status;
      meta.textContent = `${category} · ${status}`;

      li.append(title, meta);
      li.addEventListener("click", () => {
        openDetailModal(todo.id);
      });
      li.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetailModal(todo.id);
        }
      });
      return li;
    })
  );
  todayEmpty.classList.toggle("is-hidden", items.length > 0);
}

function renderCalendar() {
  const { year, month } = calendarCursor;
  calendarTitle.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const dueDateSet = new Set(
    getVisibleTodos()
      .filter((todo) => todo.dueDate)
      .map((todo) => getDateKey(todo.dueDate))
  );

  const todayKey = toDateInputValue(new Date());
  const cells = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const date = new Date(year, month - 1, day);
    cells.push({ date, muted: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), muted: false });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), muted: true });
  }

  calendarGrid.replaceChildren(
    ...cells.map(({ date, muted }) => {
      const key = getDateKey(date);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = String(date.getDate());

      if (muted) button.classList.add("is-muted");
      if (key === todayKey) button.classList.add("is-today");
      if (dueDateSet.has(key)) button.classList.add("has-todo");
      if (key === selectedDateKey) button.classList.add("is-selected");

      button.addEventListener("click", () => {
        selectedDateKey = key;
        calendarCursor = {
          year: date.getFullYear(),
          month: date.getMonth(),
        };
        renderCalendar();
        renderSelectedDayList();
      });

      return button;
    })
  );

  renderSelectedDayList();
}

function render() {
  const visible = getVisibleTodos();
  const grouped = {
    todo: visible.filter((todo) => todo.status === "todo"),
    doing: visible.filter((todo) => todo.status === "doing"),
    done: visible.filter((todo) => todo.status === "done"),
  };

  Object.keys(lists).forEach((status) => {
    lists[status].replaceChildren(
      ...grouped[status].map(createTodoElement)
    );
    empties[status].classList.toggle("is-hidden", grouped[status].length > 0);
  });

  renderCalendar();
}

document.querySelectorAll("[data-add-status]").forEach((button) => {
  button.addEventListener("click", () => {
    openAddModal();
  });
});

openAddBtn.addEventListener("click", () => {
  openAddModal();
});

addModal.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", () => {
    closeAddModal();
  });
});

detailModal.querySelectorAll("[data-close-detail]").forEach((el) => {
  el.addEventListener("click", () => {
    closeDetailModal();
  });
});

detailDueDateInput.addEventListener("change", () => {
  updateDetailDdayPreview(detailDueDateInput.value);
});

detailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveDetailTodo();
});

detailDeleteBtn.addEventListener("click", async () => {
  if (!detailTodoId || isSavingDetail) return;
  const confirmed = window.confirm("이 할일을 삭제할까요?");
  if (!confirmed) return;

  const id = detailTodoId;
  isSavingDetail = false;
  closeDetailModal();
  await deleteTodo(id);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!detailModal.hidden) {
    closeDetailModal();
    return;
  }
  if (!addModal.hidden) {
    closeAddModal();
  }
});

viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setView(tab.dataset.view);
  });
});

categoryChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    setCategory(chip.dataset.category);
  });
});

calPrevBtn.addEventListener("click", () => {
  const date = new Date(calendarCursor.year, calendarCursor.month - 1, 1);
  calendarCursor = { year: date.getFullYear(), month: date.getMonth() };
  renderCalendar();
});

calNextBtn.addEventListener("click", () => {
  const date = new Date(calendarCursor.year, calendarCursor.month + 1, 1);
  calendarCursor = { year: date.getFullYear(), month: date.getMonth() };
  renderCalendar();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (detailTodoId || isSavingDetail) return;

  const title = input.value.trim();
  const dueDate = dueDateInput.value;
  const memo = memoInput.value.trim();
  const category = categorySelect.value;
  if (!title) return;

  if (!dueDate) {
    alert("마감일을 선택해 주세요.");
    dueDateInput.focus();
    return;
  }

  submitBtn.disabled = true;

  try {
    await addTodo(title, dueDate, category, memo);
    closeAddModal();
  } catch (error) {
    console.error(error);
    alert(`할일을 저장하지 못했습니다.\n${error.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

async function init() {
  try {
    await loadTodos();
  } catch (error) {
    console.error(error);
    alert(
      `할일 목록을 불러오지 못했습니다.\n백엔드(http://localhost:5000)가 실행 중인지 확인해 주세요.\n${error.message}`
    );
    render();
  }
}

init();
