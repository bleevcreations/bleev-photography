document.addEventListener("DOMContentLoaded", async () => {
  const portfolioGrid = document.getElementById("portfolioGrid");
  const filterTabs = document.getElementById("filterTabs");

  let categories = [];

  // Keep track of slideshow timers so they can be cleared
  // when the portfolio is re-rendered or filtered.
  let slideshowTimers = [];

  const normalize = (value) =>
    String(value || "").trim().toLowerCase();

  // --------------------------------------------------
  // IMAGE URL
  // Cards use a resized copy (w=800) so photos load fast
  // and slideshow changes are smooth. The full-size photo
  // (no w) is what category.html uses.
  // --------------------------------------------------

  const CARD_WIDTH = 800;

  const imageUrl = (id) =>
    `/api/image?id=${encodeURIComponent(id)}&w=${CARD_WIDTH}`;

  // --------------------------------------------------
  // GO TO A CATEGORY'S PAGE (the "See More" action)
  // --------------------------------------------------

  function goToCategory(cat) {
    if (!cat.id) {
      console.error("❌ Category ID missing:", cat);
      return;
    }

    window.location.href = `category.html?id=${encodeURIComponent(cat.id)}`;
  }

  // --------------------------------------------------
  // CLEAR ALL ACTIVE SLIDESHOWS
  // --------------------------------------------------

  function clearSlideshowTimers() {
    slideshowTimers.forEach((timer) => {
      clearInterval(timer); // also cancels the start-delay timeouts
    });

    slideshowTimers = [];
  }

  // --------------------------------------------------
  // START CATEGORY SLIDESHOW
  // Each category card has its own slideshow, and all cards
  // change at the SAME moment. Every change picks a RANDOM photo (never the one that is
  // already showing) and slides it in from the LEFT, pushing
  // the current photo out to the RIGHT. The next photo is
  // downloaded BEFORE the slide starts, so the card never
  // shows an empty gap.
  // --------------------------------------------------

  function startCategorySlideshow(imageElement, imageIds, startDelay = 0) {
    if (!imageElement || imageIds.length <= 1) {
      return;
    }

    // Respect visitors who turned off animations
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const SLIDE_MS = 12000;     // time each photo stays on screen
    const SLIDE_ANIM_MS = 1200; // how long the slide itself takes

    // The card clips the photos while they slide
    const card = imageElement.parentElement;
    card.style.overflow = "hidden";

    if (getComputedStyle(card).position === "static") {
      card.style.position = "relative";
    }

    let currentIndex = 0;
    let busy = false; // don't start a new change while one is still running

    // Second image that waits off-screen to the left
    const layer = imageElement.cloneNode(false);
    layer.removeAttribute("src");
    layer.loading = "eager";
    layer.alt = "";
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
      "transform:translateX(-100%);visibility:hidden;pointer-events:none;";
    imageElement.after(layer);

    // Download a photo in the background (it lands in the browser cache)
    const preload = (id) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = imageUrl(id);
      });

    // A random photo that isn't the one currently showing
    const pickNext = () => {
      let next;

      do {
        next = Math.floor(Math.random() * imageIds.length);
      } while (next === currentIndex);

      return next;
    };

    // Choose and download the NEXT photo in advance, while the current one is
    // on screen, so every card is ready the instant the shared tick arrives.
    let nextIndex = pickNext();
    let ready = preload(imageIds[nextIndex]);

    const advance = async () => {
      if (document.hidden || busy) return; // don't animate in background tabs

      busy = true;

      const target = nextIndex;
      const loaded = await ready;

      if (!loaded) {
        // broken image: choose another one and try again on the next tick
        nextIndex = pickNext();
        ready = preload(imageIds[nextIndex]);
        busy = false;
        return;
      }

      const url = imageUrl(imageIds[target]);

      layer.src = url;
      await layer.decode().catch(() => {});

      layer.style.visibility = "visible";
      void layer.offsetWidth; // apply the starting position before animating

      // New photo slides in from the left, current one slides out to the right
      const slide = `transform ${SLIDE_ANIM_MS}ms ease-in-out`;
      layer.style.transition = slide;
      imageElement.style.transition = slide;
      layer.style.transform = "translateX(0)";
      imageElement.style.transform = "translateX(100%)";

      setTimeout(async () => {
        // Make the bottom photo match, then quietly reset the top layer
        imageElement.src = url;
        await imageElement.decode().catch(() => {});

        imageElement.style.transition = "none";
        imageElement.style.transform = "";
        void imageElement.offsetWidth;
        imageElement.style.transition = ""; // give the hover zoom back to the stylesheet

        layer.style.transition = "none";
        layer.style.visibility = "hidden";
        layer.style.transform = "translateX(-100%)";

        currentIndex = target;

        // line up the next random photo for the following tick
        nextIndex = pickNext();
        ready = preload(imageIds[nextIndex]);

        busy = false;
      }, SLIDE_ANIM_MS + 50);
    };

    // All cards start on the same tick so they slide together
    const starter = setTimeout(() => {
      slideshowTimers.push(setInterval(advance, SLIDE_MS));
    }, startDelay);

    slideshowTimers.push(starter);
  }

  // --------------------------------------------------
  // LOAD CATEGORIES
  // --------------------------------------------------

  try {
    const res = await fetch("/api/categories", {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    categories = await res.json();

    if (!Array.isArray(categories)) {
      throw new Error("Invalid categories data");
    }

    if (categories.length === 0) {
      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items available yet.
        </p>
      `;
      return;
    }

    // --------------------------------------------------
    // BUILD FILTER TABS DYNAMICALLY
    // --------------------------------------------------

    categories.forEach((cat) => {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.filter = normalize(cat.name);
      button.textContent = cat.name;

      filterTabs.appendChild(button);
    });

    // Make sure the "All" tab (already in the HTML) starts active
    filterTabs
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.toggle("active", btn.dataset.filter === "all"));

    // --------------------------------------------------
    // INITIAL RENDER
    // --------------------------------------------------

    renderCards("all");

  } catch (error) {
    console.error("❌ Failed to load categories:", error);

    portfolioGrid.innerHTML = `
      <p class="grid-message">
        Could not load portfolio items. Please try again later.
      </p>
    `;
  }

  // --------------------------------------------------
  // RENDER PORTFOLIO CARDS
  // --------------------------------------------------

  function renderCards(filter) {
    // Stop existing slideshows before rebuilding cards
    clearSlideshowTimers();

    portfolioGrid.innerHTML = "";

    const visibleCategories = categories.filter((cat) => {
      return (
        filter === "all" ||
        normalize(cat.name) === normalize(filter)
      );
    });

    if (visibleCategories.length === 0) {
      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items in this category.
        </p>
      `;
      return;
    }

    visibleCategories.forEach((cat, index) => {
      const images =
        Array.isArray(cat.images) && cat.images.length > 0
          ? cat.images.filter(Boolean)
          : [];

      const card = document.createElement("article");
      card.className = "portfolio-card";

      // ------------------------------------------------
      // CARD IMAGE (pulled from the database)
      // ------------------------------------------------

      if (images.length > 0) {
        const image = document.createElement("img");

        image.src = imageUrl(images[0]);
        image.alt = cat.name || "Bleeve Creations portfolio";
        image.loading = "lazy";
        image.decoding = "async";

        image.onerror = () => {
          image.style.display = "none";
          card.classList.add("no-image");
        };

        card.appendChild(image);

        // ----------------------------------------------
        // START RANDOM SLIDESHOW
        // Only starts if the category has multiple images.
        // ----------------------------------------------

        if (images.length > 1) {
          startCategorySlideshow(image, images); // all cards start together
        }
      } else {
        card.classList.add("no-image");
      }

      // ------------------------------------------------
      // DARK IMAGE OVERLAY
      // ------------------------------------------------

      const overlay = document.createElement("div");
      overlay.className = "portfolio-card-overlay";

      // ------------------------------------------------
      // CATEGORY NAME — floats bottom-left of the card
      // ------------------------------------------------

      const categoryName = document.createElement("h3");
      categoryName.className = "portfolio-category-name";
      categoryName.textContent = cat.name;

      overlay.appendChild(categoryName);

      // ------------------------------------------------
      // PHOTO COUNT
      // ------------------------------------------------

      if (images.length > 0) {
        const photoCount = document.createElement("span");
        photoCount.className = "portfolio-photo-count";

        photoCount.textContent =
          `${images.length} ${images.length === 1 ? "photo" : "photos"}`;

        overlay.appendChild(photoCount);
      }

      card.appendChild(overlay);

      // ------------------------------------------------
      // CLICK / KEYBOARD → "See More" (open category page)
      // ------------------------------------------------

      card.addEventListener("click", () => goToCategory(cat));

      card.setAttribute("role", "link");
      card.setAttribute("tabindex", "0");

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToCategory(cat);
        }
      });

      portfolioGrid.appendChild(card);
    });
  }

  // --------------------------------------------------
  // FILTER TABS
  // --------------------------------------------------

  filterTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    filterTabs
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.remove("active"));

    button.classList.add("active");

    renderCards(button.dataset.filter);
  });
});