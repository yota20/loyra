
"use strict";

/* =====================================
   LOYRA — Main Application
===================================== */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

const storage = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
};

/* =====================================
   Toast
===================================== */

let toastTimer;

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.hidden = true;
  }, 2600);
}

/* =====================================
   Theme
===================================== */

const themeToggle = $("#themeToggle");
const themeIcon = $("#themeIcon");

function applyTheme(theme) {
  const validTheme = theme === "light" ? "light" : "dark";

  document.documentElement.dataset.theme = validTheme;

  if (themeIcon) {
    themeIcon.textContent = validTheme === "dark" ? "☀" : "☾";
  }

  storage.set("loyra-theme", validTheme);
}

applyTheme(storage.get("loyra-theme", "dark"));

themeToggle?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === "dark" ? "light" : "dark");
});

/* =====================================
   Navigation
===================================== */

const pages = $$(".page");
const navigationItems = $$("[data-page]");

function showPage(pageName) {
  const target = $(`#page-${pageName}`);

  if (!target || !target.classList.contains("page")) {
    showToast("این بخش هنوز آماده نشده است.");
    return;
  }

  pages.forEach(page => {
    page.classList.toggle("active", page === target);
  });

  navigationItems.forEach(item => {
    const active = item.dataset.page === pageName;

    item.classList.toggle("active", active);

    if (active) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

navigationItems.forEach(item => {
  item.addEventListener("click", () => {
    showPage(item.dataset.page);
  });
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

/* =====================================
   Game Search and Filters
===================================== */

const gameSearch = $("#gameSearch");
const gameCards = $$(".game-card");
const gameEmpty = $("#gameEmpty");
const gameCount = $("#gameCount");
const clearSearch = $("#clearSearch");
const filterButtons = $$("[data-filter]");

let activeFilter = "all";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function updateGames() {
  const query = normalizeText(gameSearch?.value || "");
  let visibleCount = 0;

  gameCards.forEach(card => {
    const categories = (card.dataset.category || "")
      .split(/\s+/)
      .filter(Boolean);

    const searchableText = normalizeText(
      `${card.dataset.name || ""} ${card.textContent}`
    );

    const matchesSearch =
      !query || searchableText.includes(query);

    const matchesFilter =
      activeFilter === "all" ||
      categories.includes(activeFilter);

    const visible = matchesSearch && matchesFilter;

    card.hidden = !visible;

    if (visible) visibleCount++;
  });

  if (gameCount) {
    gameCount.textContent = `${visibleCount} بازی`;
  }

  if (gameEmpty) {
    gameEmpty.hidden = visibleCount !== 0;
  }
}

gameSearch?.addEventListener("input", updateGames);

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";

    filterButtons.forEach(item => {
      item.classList.toggle("active", item === button);
    });

    updateGames();
  });
});

clearSearch?.addEventListener("click", () => {
  if (gameSearch) gameSearch.value = "";

  activeFilter = "all";

  filterButtons.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === "all"
    );
  });

  updateGames();
});

updateGames();

/* =====================================
   Game Modal
===================================== */

const gameModal = $("#gameModal");
const modalTitle = $("#modalTitle");
const modalContent = $("#modalContent");
const closeModalButton = $("#closeModal");

let previousFocus = null;

function openGameModal(title, content) {
  if (!gameModal || !modalTitle || !modalContent) return;

  stopReactionGame();

  previousFocus = document.activeElement;

  modalTitle.textContent = title;
  modalContent.innerHTML = content;

  gameModal.hidden = false;
  document.body.style.overflow = "hidden";

  closeModalButton?.focus();
}

function closeGameModal() {
  if (!gameModal || gameModal.hidden) return;

  stopReactionGame();

  gameModal.hidden = true;
  document.body.style.overflow = "";

  if (modalContent) {
    modalContent.innerHTML = "";
  }

  previousFocus?.focus?.();
}

closeModalButton?.addEventListener("click", closeGameModal);

gameModal?.addEventListener("click", event => {
  if (event.target === gameModal) {
    closeGameModal();
  }
});

document.addEventListener("keydown", event => {
  const target = event.target;

  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable;

  if (event.key === "/" && !typing) {
    event.preventDefault();
    showPage("games");
    gameSearch?.focus();
  }

  if (event.key === "Escape") {
    closeGameModal();
  }
});

/* =====================================
   Tic Tac Toe
   Local two-player game
===================================== */

let ticBoard = Array(9).fill("");
let ticTurn = "X";
let ticFinished = false;

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function renderTicTacToe() {
  const cells = $$(".game-cell", modalContent);

  cells.forEach((cell, index) => {
    cell.textContent = ticBoard[index];
    cell.disabled = Boolean(ticBoard[index]) || ticFinished;
  });
}

function getTicWinner() {
  for (const [a, b, c] of winningLines) {
    if (
      ticBoard[a] &&
      ticBoard[a] === ticBoard[b] &&
      ticBoard[a] === ticBoard[c]
    ) {
      return ticBoard[a];
    }
  }

  return null;
}

function updateTicMessage(message) {
  const element = $("#ticMessage", modalContent);

  if (element) element.textContent = message;
}

function playTicCell(index) {
  if (
    ticFinished ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8 ||
    ticBoard[index]
  ) return;

  ticBoard[index] = ticTurn;

  const winner = getTicWinner();

  if (winner) {
    ticFinished = true;
    renderTicTacToe();
    updateTicMessage(`بازیکن ${winner} برنده شد!`);
    return;
  }

  if (ticBoard.every(Boolean)) {
    ticFinished = true;
    renderTicTacToe();
    updateTicMessage("بازی مساوی شد!");
    return;
  }

  ticTurn = ticTurn === "X" ? "O" : "X";

  renderTicTacToe();
  updateTicMessage(`نوبت بازیکن ${ticTurn}`);
}

function resetTicTacToe() {
  ticBoard = Array(9).fill("");
  ticTurn = "X";
  ticFinished = false;

  renderTicTacToe();
  updateTicMessage("نوبت بازیکن X");
}

function startTicTacToe() {
  resetTicTacToe();

  const cells = Array.from(
    { length: 9 },
    (_, index) =>
      `<button class="game-cell" type="button" data-cell="${index}" aria-label="خانه ${index + 1}"></button>`
  ).join("");

  openGameModal(
    "دوز دونفره",
    `
      <p class="game-message">
        دو نفر روی یک دستگاه بازی کنید.
      </p>

      <div class="game-board">
        ${cells}
      </div>

      <p class="game-message" id="ticMessage">
        نوبت بازیکن X
      </p>

      <div class="game-controls">
        <button class="primary-btn" id="ticRestart" type="button">
          شروع دوباره
        </button>
      </div>
    `
  );

  $$("[data-cell]", modalContent).forEach(cell => {
    cell.addEventListener("click", () => {
      playTicCell(Number(cell.dataset.cell));
    });
  });

  $("#ticRestart", modalContent)?.addEventListener(
    "click",
    resetTicTacToe
  );
}

/* =====================================
   Reaction Test
===================================== */

let reactionTimer = null;
let reactionStart = 0;
let reactionState = "idle";

function stopReactionGame() {
  if (reactionTimer !== null) {
    clearTimeout(reactionTimer);
  }

  reactionTimer = null;
  reactionState = "idle";
}

function startReactionRound() {
  stopReactionGame();

  reactionState = "waiting";

  const area = $("#reactionArea", modalContent);
  const result = $("#reactionResult", modalContent);

  if (!area) return;

  area.className = "reaction-area waiting";
  area.textContent = "صبر کن... هنوز کلیک نکن!";

  if (result) result.textContent = "منتظر سبز شدن صفحه باش...";

  const delay = 1500 + Math.random() * 3000;

  reactionTimer = setTimeout(() => {
    if (reactionState !== "waiting") return;

    reactionState = "ready";
    reactionStart = performance.now();

    area.className = "reaction-area ready";
    area.textContent = "حالا کلیک کن!";
  }, delay);
}

function handleReactionClick() {
  const area = $("#reactionArea", modalContent);
  const result = $("#reactionResult", modalContent);

  if (reactionState === "waiting") {
    stopReactionGame();

    if (area) {
      area.className = "reaction-area waiting";
      area.textContent = "زود کلیک کردی! دوباره امتحان کن.";
    }

    if (result) result.textContent = "هنوز صفحه سبز نشده بود.";

    return;
  }

  if (reactionState === "ready") {
    const elapsed = Math.round(
      performance.now() - reactionStart
    );

    reactionState = "finished";

    if (area) {
      area.className = "reaction-area";
      area.textContent = `${elapsed} میلی‌ثانیه`;
    }

    if (result) {
      result.textContent = `زمان واکنش تو: ${elapsed} میلی‌ثانیه`;
    }
  }
}

function startReactionGame() {
  openGameModal(
    "آزمایش سرعت واکنش",
    `
      <p class="game-message">
        وقتی صفحه سبز شد، سریع کلیک کن.
      </p>

      <button class="reaction-area" id="reactionArea" type="button">
        برای شروع کلیک کن
      </button>

      <p class="game-message" id="reactionResult">
        آماده‌ای؟
      </p>

      <div class="game-controls">
        <button class="primary-btn" id="reactionRestart" type="button">
          تلاش دوباره
        </button>
      </div>
    `
  );

  $("#reactionArea", modalContent)?.addEventListener(
    "click",
    () => {
      if (
        reactionState === "idle" ||
        reactionState === "finished"
      ) {
        startReactionRound();
      } else {
        handleReactionClick();
      }
    }
  );

  $("#reactionRestart", modalContent)?.addEventListener(
    "click",
    () => {
      startReactionRound();
    }
  );
}

/* =====================================
   Game Event Delegation
===================================== */

document.addEventListener("click", event => {
  const gameButton = event.target.closest("[data-game]");

  if (!gameButton) return;

  const game = gameButton.dataset.game;

  if (game === "tic") {
    startTicTacToe();
  } else if (game === "reaction") {
    startReactionGame();
  }
});

/* =====================================
   Favorites
===================================== */

const FAVORITES_KEY = "loyra-favorites";

function getFavorites() {
  try {
    const data = JSON.parse(
      storage.get(FAVORITES_KEY, "[]")
    );

    return Array.isArray(data)
      ? [...new Set(data.filter(id => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  storage.set(
    FAVORITES_KEY,
    JSON.stringify(favorites)
  );

  renderFavorites();
  updateFavoriteButtons();
}

function getGameName(card) {
  return (
    card?.querySelector("h3")?.textContent?.trim() ||
    card?.dataset.name ||
    "بازی"
  );
}

function renderFavorites() {
  const favorites = getFavorites();

  const count = $("#favoriteCount");
  const list = $("#favoritesList");

  if (count) {
    count.textContent = String(favorites.length);
  }

  if (!list) return;

  list.replaceChildren();

  const validFavorites = favorites
    .map(id => gameCards.find(card => card.dataset.id === id))
    .filter(Boolean);

  if (validFavorites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-favorites compact-empty";

    const heading = document.createElement("h3");
    heading.textContent = "هنوز بازی‌ای ذخیره نکردی";

    const description = document.createElement("p");
    description.textContent =
      "از صفحه بازی‌ها، بازی‌های موردعلاقه‌ات رو انتخاب کن.";

    empty.append(heading, description);
    list.append(empty);
    return;
  }

  validFavorites.forEach(card => {
    const id = card.dataset.id;
    const item = document.createElement("div");
    item.className = "mission-card";

    const heading = document.createElement("h3");
    heading.textContent = getGameName(card);

    const description = document.createElement("p");
    description.textContent = "بازی موردعلاقه تو";

    const remove = document.createElement("button");
    remove.className = "secondary-btn";
    remove.type = "button";
    remove.textContent = "حذف از علاقه‌مندی‌ها";

    remove.addEventListener("click", () => {
      saveFavorites(
        getFavorites().filter(value => value !== id)
      );

      showToast("از علاقه‌مندی‌ها حذف شد.");
    });

    item.append(heading, description, remove);
    list.append(item);
  });
}

function updateFavoriteButtons() {
  const favorites = getFavorites();

  gameCards.forEach(card => {
    const button = $(".favorite-button", card);
    if (!button) return;

    const active = favorites.includes(card.dataset.id);

    button.classList.toggle("active", active);
    button.textContent = active ? "♥" : "♡";
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      active
        ? "حذف از علاقه‌مندی‌ها"
        : "افزودن به علاقه‌مندی‌ها"
    );
  });
}

gameCards.forEach(card => {
  const id = card.dataset.id;
  const meta = $(".game-meta", card);

  if (!id || !meta || $(".favorite-button", card)) return;

  const button = document.createElement("button");

  button.className = "favorite-button";
  button.type = "button";
  button.textContent = "♡";
  button.setAttribute("aria-label", "افزودن به علاقه‌مندی‌ها");
  button.setAttribute("aria-pressed", "false");

  button.addEventListener("click", () => {
    const favorites = getFavorites();

    const updated = favorites.includes(id)
      ? favorites.filter(value => value !== id)
      : [...favorites, id];

    saveFavorites(updated);

    showToast(
      updated.includes(id)
        ? "به علاقه‌مندی‌ها اضافه شد."
        : "از علاقه‌مندی‌ها حذف شد."
    );
  });

  meta.append(button);
});

renderFavorites();
updateFavoriteButtons();

/* =====================================
   Profile
===================================== */

const profileName = $("#profileName");
const editName = $("#editName");

function loadProfile() {
  const savedName = storage.get("loyra-profile-name", "");

  if (profileName && savedName) {
    profileName.textContent = savedName;
  }
}

editName?.addEventListener("click", () => {
  const currentName = profileName?.textContent || "";

  const newName = prompt(
    "نام نمایشی جدیدت رو وارد کن:",
    currentName
  );

  if (newName === null) return;

  const cleanName = newName.trim();

  if (!cleanName) {
    showToast("نام نمی‌تونه خالی باشه.");
    return;
  }

  if (cleanName.length > 24) {
    showToast("نام باید حداکثر ۲۴ حرف باشه.");
    return;
  }

  if (profileName) {
    profileName.textContent = cleanName;
  }

  storage.set("loyra-profile-name", cleanName);
  showToast("نام نمایشی ذخیره شد.");
});

loadProfile();

/* =====================================
   Upcoming Features
===================================== */

$$("[data-soon]").forEach(button => {
  button.addEventListener("click", () => {
    showToast("این قابلیت در نسخه‌های آینده فعال می‌شه.");
  });
});

/* =====================================
   Initial Setup
===================================== */

document.addEventListener("DOMContentLoaded", () => {
  updateGames();
  renderFavorites();
  updateFavoriteButtons();
  loadProfile();
});

console.log("LOYRA initialized successfully.");

/* ==========================================
   LOYRA — PREMIUM INTERACTIONS
   ========================================== */

(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;

  if (!body) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  /* نور دنبال‌کننده موس */
  if (finePointer && !reducedMotion) {
    const glow = document.createElement("div");

    glow.id = "loyra-cursor-glow";
    glow.setAttribute("aria-hidden", "true");

    body.appendChild(glow);
    root.classList.add("loyra-pointer");

    let pointerFrame = null;
    let pointerX = 0;
    let pointerY = 0;

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;

      pointerX = event.clientX;
      pointerY = event.clientY;

      if (pointerFrame !== null) return;

      pointerFrame = requestAnimationFrame(() => {
        glow.style.left = `${pointerX}px`;
        glow.style.top = `${pointerY}px`;
        pointerFrame = null;
      });
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      glow.style.opacity = "0";
    });

    document.addEventListener("pointerenter", () => {
      glow.style.opacity = "";
    });
  }

  /* افکت سه‌بعدی کارت‌ها */
  const cardSelector = [
    ".quick-card",
    ".featured-card",
    ".game-card",
    ".mission-card"
  ].join(",");

  if (finePointer && !reducedMotion) {
    document.querySelectorAll(cardSelector).forEach((card) => {
      card.classList.add("loyra-tilt");

      card.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;

        const rect = card.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        const rotateY = (x - 0.5) * 9;
        const rotateX = (0.5 - y) * 9;

        card.style.setProperty(
          "--loyra-tilt-x",
          `${rotateX.toFixed(2)}deg`
        );

        card.style.setProperty(
          "--loyra-tilt-y",
          `${rotateY.toFixed(2)}deg`
        );

        card.style.setProperty(
          "--loyra-light-x",
          `${(x * 100).toFixed(1)}%`
        );

        card.style.setProperty(
          "--loyra-light-y",
          `${(y * 100).toFixed(1)}%`
        );
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--loyra-tilt-x", "0deg");
        card.style.setProperty("--loyra-tilt-y", "0deg");
      });
    });
  }

  /* انیمیشن ورود بخش‌ها */
  const revealSelector = [
    ".welcome-row",
    ".hero-panel",
    ".section-heading",
    ".quick-card",
    ".featured-card",
    ".notice-strip",
    ".page-header",
    ".game-toolbar",
    ".game-card",
    ".feature-empty-panel",
    ".mission-card",
    ".profile-panel"
  ].join(",");

  const revealElements = document.querySelectorAll(revealSelector);

  if (!reducedMotion && "IntersectionObserver" in window) {
    root.classList.add("loyra-motion-ready");

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("loyra-visible");
        currentObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: "0px 0px -35px 0px"
    });

    revealElements.forEach((element, index) => {
      element.classList.add("loyra-reveal");

      const delay = Math.min((index % 4) * 75, 225);

      element.style.setProperty(
        "--loyra-delay",
        `${delay}ms`
      );

      observer.observe(element);
    });
  } else {
    revealElements.forEach((element) => {
      element.classList.add("loyra-visible");
    });
  }

  /* ورود عناصر صفحات هنگام تغییر صفحه */
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      requestAnimationFrame(() => {
        const activePage = document.querySelector(".page.active");

        if (!activePage) return;

        activePage.querySelectorAll(".loyra-reveal").forEach((element) => {
          if (element.getBoundingClientRect().width > 0) {
            element.classList.add("loyra-visible");
          }
        });
      });
    });
  });

})();
