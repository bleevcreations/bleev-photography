document.addEventListener("DOMContentLoaded", async () => {
  const portfolioGrid = document.getElementById("portfolioGrid");
  const filterTabs = document.getElementById("filterTabs");

  let categories = [];

  const normalize = (value) =>
    String(value || "").trim().toLowerCase();

  // --------------------------------------------------
  // IMAGE URL
  // --------------------------------------------------
  // Cards use a resized version for faster loading.
  // Full-size images can still be used on category pages.
  // --------------------------------------------------

  const CARD_WIDTH = 800;

  const imageUrl = (id) =>
    `/api/image?id=${encodeURIComponent(id)}&w=${CARD_WIDTH}`;

  // --------------------------------------------------
  // GO TO CATEGORY PAGE
  // --------------------------------------------------

  function goToCategory(cat) {
    if (!cat || !cat.id) {
      console.error("❌ Category ID missing:", cat);
      return;
    }

    window.location.href =
      `category.html?id=${encodeURIComponent(cat.id)}`;
  }

  // --------------------------------------------------
  // CLEAR ALL ACTIVE SLIDESHOWS
  // --------------------------------------------------
  // Each slideshow registers its own cleanup function.
  // This prevents old timers, listeners and image layers
  // from surviving when the portfolio is filtered/re-rendered.
  // --------------------------------------------------

  function clearSlideshowTimers() {
    document
      .querySelectorAll(".portfolio-card")
      .forEach((card) => {
        if (typeof card._destroySlideshow === "function") {
          card._destroySlideshow();
          delete card._destroySlideshow;
        }
      });
  }

  // --------------------------------------------------
  // PROFESSIONAL CATEGORY SLIDESHOW

  // --------------------------------------------------

 function startCategorySlideshow(imageElement, imageIds) {
  if (!imageElement || imageIds.length <= 1) {
    return;
  }

  // Respect accessibility preferences
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  // --------------------------------------------------
  // SETTINGS
  // --------------------------------------------------

  const DISPLAY_MS = 10000;
  const TRANSITION_MS = 1400;
  const PRELOAD_TIMEOUT = 8000;

  const card = imageElement.parentElement;

  if (!card) {
    return;
  }

  // --------------------------------------------------
  // CARD SETUP
  // --------------------------------------------------

  if (getComputedStyle(card).position === "static") {
    card.style.position = "relative";
  }

  card.style.overflow = "hidden";

  // --------------------------------------------------
  // CREATE SECOND IMAGE LAYER
  // --------------------------------------------------

  const nextImage = imageElement.cloneNode(false);

  nextImage.removeAttribute("src");

  nextImage.loading = "eager";
  nextImage.decoding = "async";
  nextImage.alt = "";
  nextImage.setAttribute("aria-hidden", "true");

  nextImage.style.position = "absolute";
  nextImage.style.inset = "0";
  nextImage.style.width = "100%";
  nextImage.style.height = "100%";
  nextImage.style.objectFit = "cover";
  nextImage.style.objectPosition = "center";
  nextImage.style.pointerEvents = "none";

  // Start completely outside the card on the LEFT
  nextImage.style.visibility = "hidden";
  nextImage.style.transform =
    "translate3d(-100%, 0, 0)";

  nextImage.style.zIndex = "2";
  nextImage.style.willChange = "transform";

  // Current image
  imageElement.style.position = "relative";
  imageElement.style.zIndex = "1";
  imageElement.style.willChange = "transform";

  imageElement.after(nextImage);

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  let currentIndex = 0;
  let nextIndex = null;

  let timer = null;
  let transitionTimer = null;

  let busy = false;
  let paused = false;
  let destroyed = false;

  // --------------------------------------------------
  // IMAGE URL
  // --------------------------------------------------

  const getUrl = (id) =>
    imageUrl(id);

  // --------------------------------------------------
  // PRELOAD IMAGE
  // --------------------------------------------------

  function preloadImage(id) {
    return new Promise((resolve) => {
      const img = new Image();

      let finished = false;

      const timeout = setTimeout(() => {
        finish(false);
      }, PRELOAD_TIMEOUT);

      function finish(success) {
        if (finished) {
          return;
        }

        finished = true;

        clearTimeout(timeout);

        resolve(success);
      }

      img.onload = () => {
        finish(true);
      };

      img.onerror = () => {
        finish(false);
      };

      img.src = getUrl(id);
    });
  }

  // --------------------------------------------------
  // PICK RANDOM NEXT PHOTO
  // --------------------------------------------------

  function pickNextIndex() {
    if (imageIds.length <= 1) {
      return currentIndex;
    }

    let index;

    do {
      index = Math.floor(
        Math.random() * imageIds.length
      );
    } while (index === currentIndex);

    return index;
  }

  // --------------------------------------------------
  // PREPARE NEXT PHOTO
  // --------------------------------------------------

  async function prepareNext() {
    if (destroyed) {
      return false;
    }

    const candidate = pickNextIndex();

    const loaded = await preloadImage(
      imageIds[candidate]
    );

    if (!loaded || destroyed) {
      return false;
    }

    nextIndex = candidate;

    return true;
  }

  // --------------------------------------------------
  // RESET SECOND IMAGE
  // --------------------------------------------------

  function resetNextImage() {
    nextImage.style.transition = "none";

    nextImage.style.visibility = "hidden";

    nextImage.style.transform =
      "translate3d(-100%, 0, 0)";
  }

  // --------------------------------------------------
  // TRANSITION TO NEXT PHOTO
  // --------------------------------------------------

  async function transitionToNext() {
    if (
      destroyed ||
      busy ||
      paused ||
      document.hidden
    ) {
      return;
    }

    busy = true;

    // Make sure a photo is ready
    if (nextIndex === null) {
      const prepared = await prepareNext();

      if (!prepared) {
        busy = false;
        scheduleNext();
        return;
      }
    }

    const targetIndex = nextIndex;

    const targetId =
      imageIds[targetIndex];

    const targetUrl =
      getUrl(targetId);

    // ------------------------------------------------
    // LOAD NEXT IMAGE
    // ------------------------------------------------

    nextImage.src = targetUrl;

    try {
      await nextImage.decode();
    } catch {
      // Browser may already have decoded the image.
    }

    if (
      destroyed ||
      paused ||
      document.hidden
    ) {
      busy = false;
      return;
    }

    // ------------------------------------------------
    // POSITION NEXT IMAGE
    // ------------------------------------------------

    nextImage.style.visibility = "visible";

    nextImage.style.transition = "none";

    nextImage.style.transform =
      "translate3d(-100%, 0, 0)";

    // Force browser to register starting position
    void nextImage.offsetWidth;

    // ------------------------------------------------
    // START SLIDE
    // ------------------------------------------------

    const transition =
      `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;

    nextImage.style.transition = transition;

    imageElement.style.transition = transition;

    // New photo comes in from LEFT
    nextImage.style.transform =
      "translate3d(0, 0, 0)";

    // Current photo exits to RIGHT
    imageElement.style.transform =
      "translate3d(100%, 0, 0)";

    // ------------------------------------------------
    // COMPLETE TRANSITION
    // ------------------------------------------------

    transitionTimer = setTimeout(() => {
      if (destroyed) {
        return;
      }

      // Make the new image the permanent base image
      imageElement.src = targetUrl;

      imageElement.style.transition = "none";

      imageElement.style.transform =
        "translate3d(0, 0, 0)";

      // Reset overlay image
      resetNextImage();

      // Update current image
      currentIndex = targetIndex;

      nextIndex = null;

      busy = false;

      // Preload another random image
      prepareNext().then(() => {
        if (!destroyed) {
          scheduleNext();
        }
      });

    }, TRANSITION_MS + 40);
  }

  // --------------------------------------------------
  // SCHEDULE NEXT TRANSITION
  // --------------------------------------------------

  function scheduleNext() {
    clearTimeout(timer);

    if (
      destroyed ||
      paused ||
      document.hidden
    ) {
      return;
    }

    timer = setTimeout(
      transitionToNext,
      DISPLAY_MS
    );
  }

  // --------------------------------------------------
  // PAUSE
  // --------------------------------------------------

  function pauseSlideshow() {
    paused = true;

    clearTimeout(timer);
  }

  // --------------------------------------------------
  // RESUME
  // --------------------------------------------------

  function resumeSlideshow() {
    if (destroyed) {
      return;
    }

    paused = false;

    if (!document.hidden) {
      scheduleNext();
    }
  }

  // --------------------------------------------------
  // PAUSE ON HOVER
  // --------------------------------------------------

  card.addEventListener(
    "mouseenter",
    pauseSlideshow
  );

  card.addEventListener(
    "mouseleave",
    resumeSlideshow
  );

  // --------------------------------------------------
  // HANDLE BROWSER TAB VISIBILITY
  // --------------------------------------------------

  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearTimeout(timer);
      return;
    }

    if (!paused && !busy) {
      scheduleNext();
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  card._destroySlideshow = () => {
    destroyed = true;

    clearTimeout(timer);
    clearTimeout(transitionTimer);

    card.removeEventListener(
      "mouseenter",
      pauseSlideshow
    );

    card.removeEventListener(
      "mouseleave",
      resumeSlideshow
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    nextImage.remove();
  };

  // --------------------------------------------------
  // START
  // --------------------------------------------------

  prepareNext().then(() => {
    if (!destroyed) {
      scheduleNext();
    }
  });
}

  // --------------------------------------------------
  // LOAD CATEGORIES
  // --------------------------------------------------

  try {
    const res = await fetch(
      "/api/categories",
      {
        cache: "no-store"
      }
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}`
      );
    }

    categories = await res.json();

    if (!Array.isArray(categories)) {
      throw new Error(
        "Invalid categories data"
      );
    }

    // ------------------------------------------------
    // NO CATEGORIES
    // ------------------------------------------------

    if (categories.length === 0) {
      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items available yet.
        </p>
      `;

      return;
    }

    // ------------------------------------------------
    // BUILD FILTER TABS
    // ------------------------------------------------

    categories.forEach((cat) => {
      const button =
        document.createElement("button");

      button.type = "button";

      button.dataset.filter =
        normalize(cat.name);

      button.textContent =
        cat.name;

      filterTabs.appendChild(button);
    });

    // ------------------------------------------------
    // ACTIVATE "ALL"
    // ------------------------------------------------

    filterTabs
      .querySelectorAll("button")
      .forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.dataset.filter === "all"
        );
      });

    // ------------------------------------------------
    // INITIAL RENDER
    // ------------------------------------------------

    renderCards("all");

  } catch (error) {
    console.error(
      "❌ Failed to load categories:",
      error
    );

    portfolioGrid.innerHTML = `
      <p class="grid-message">
        Could not load portfolio items.
        Please try again later.
      </p>
    `;
  }

  // --------------------------------------------------
  // RENDER PORTFOLIO CARDS
  // --------------------------------------------------

  function renderCards(filter) {
    // Stop existing slideshows before rebuilding
    clearSlideshowTimers();

    portfolioGrid.innerHTML = "";

    // ------------------------------------------------
    // FILTER CATEGORIES
    // ------------------------------------------------

    const visibleCategories =
      categories.filter((cat) => {
        return (
          filter === "all" ||
          normalize(cat.name) ===
            normalize(filter)
        );
      });

    // ------------------------------------------------
    // NO RESULTS
    // ------------------------------------------------

    if (visibleCategories.length === 0) {
      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items in this category.
        </p>
      `;

      return;
    }

    // ------------------------------------------------
    // CREATE CATEGORY CARDS
    // ------------------------------------------------

    visibleCategories.forEach((cat) => {
      const images =
        Array.isArray(cat.images) &&
        cat.images.length > 0
          ? cat.images.filter(Boolean)
          : [];

      // ------------------------------------------------
      // CARD
      // ------------------------------------------------

      const card =
        document.createElement("article");

      card.className =
        "portfolio-card";

      // ------------------------------------------------
      // CARD IMAGE
      // ------------------------------------------------

      if (images.length > 0) {
        const image =
          document.createElement("img");

        image.src =
          imageUrl(images[0]);

        image.alt =
          cat.name ||
          "Bleeve Creations portfolio";

        image.loading = "lazy";

        image.decoding = "async";

        image.onerror = () => {
          image.style.display = "none";

          card.classList.add(
            "no-image"
          );
        };

        card.appendChild(image);

        // ------------------------------------------------
        // START SLIDESHOW
        // ------------------------------------------------

        if (images.length > 1) {
          startCategorySlideshow(
            image,
            images
          );
        }

      } else {
        card.classList.add(
          "no-image"
        );
      }

      // ------------------------------------------------
      // DARK IMAGE OVERLAY
      // ------------------------------------------------

      const overlay =
        document.createElement("div");

      overlay.className =
        "portfolio-card-overlay";

      // ------------------------------------------------
      // CATEGORY NAME
      // ------------------------------------------------

      const categoryName =
        document.createElement("h3");

      categoryName.className =
        "portfolio-category-name";

      categoryName.textContent =
        cat.name || "Untitled";

      overlay.appendChild(
        categoryName
      );

      // ------------------------------------------------
      // PHOTO COUNT
      // ------------------------------------------------

      if (images.length > 0) {
        const photoCount =
          document.createElement("span");

        photoCount.className =
          "portfolio-photo-count";

        photoCount.textContent =
          `${images.length} ${
            images.length === 1
              ? "photo"
              : "photos"
          }`;

        overlay.appendChild(
          photoCount
        );
      }

      // Add overlay to card
      card.appendChild(
        overlay
      );

      // ------------------------------------------------
      // ACCESSIBILITY
      // ------------------------------------------------

      card.setAttribute(
        "role",
        "link"
      );

      card.setAttribute(
        "tabindex",
        "0"
      );

      // ------------------------------------------------
      // CLICK → CATEGORY PAGE
      // ------------------------------------------------

      card.addEventListener(
        "click",
        () => {
          goToCategory(cat);
        }
      );

      // ------------------------------------------------
      // KEYBOARD → CATEGORY PAGE
      // ------------------------------------------------

      card.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            goToCategory(cat);
          }
        }
      );

      // ------------------------------------------------
      // ADD CARD TO GRID
      // ------------------------------------------------

      portfolioGrid.appendChild(
        card
      );
    });
  }

  // --------------------------------------------------
  // FILTER TABS
  // --------------------------------------------------

  filterTabs.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "button"
        );

      if (!button) {
        return;
      }

      // ------------------------------------------------
      // UPDATE ACTIVE TAB
      // ------------------------------------------------

      filterTabs
        .querySelectorAll("button")
        .forEach((btn) => {
          btn.classList.remove(
            "active"
          );
        });

      button.classList.add(
        "active"
      );

      // ------------------------------------------------
      // RENDER SELECTED CATEGORY
      // ------------------------------------------------

      renderCards(
        button.dataset.filter
      );
    }
  );
});