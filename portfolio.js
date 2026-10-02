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
  // Each category card has its own independent slideshow.
  // Every change picks a RANDOM photo (never the one that is
  // already showing). The next photo is downloaded BEFORE the
  // fade starts, so the card never fades back in on the old
  // picture.
  // --------------------------------------------------

 function startCategorySlideshow(imageElement, imageIds, startDelay = 0) {
  if (!imageElement || imageIds.length <= 1) return;

  // Respect visitors who turned off animations
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SLIDE_MS = 6000; // time each photo stays on screen
  const FADE_MS = 800;   // crossfade duration

  let currentIndex = 0;
  let busy = false;

  // Second image layered on top of the first, used for the crossfade
  const layer = imageElement.cloneNode(false);
  layer.removeAttribute("src");
  layer.loading = "eager";
  layer.alt = "";
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;` +
    `opacity:0;pointer-events:none;transition:opacity ${FADE_MS}ms ease;`;
  imageElement.after(layer);

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

  const advance = async () => {
    if (document.hidden || busy) return;
    busy = true;

    const nextIndex = pickNext();
    const url = imageUrl(imageIds[nextIndex]);

    if (!(await preload(imageIds[nextIndex]))) {
      busy = false; // broken image: try another one next tick
      return;
    }

    layer.src = url;
    await layer.decode().catch(() => {});
    layer.style.opacity = "1"; // crossfade in over the old photo

    setTimeout(async () => {
      imageElement.src = url; // make the bottom photo match
      await imageElement.decode().catch(() => {});

      // hide the top layer instantly, then restore its transition
      layer.style.transition = "none";
      layer.style.opacity = "0";
      void layer.offsetWidth;
      layer.style.transition = `opacity ${FADE_MS}ms ease`;

      currentIndex = nextIndex;
      busy = false;
    }, FADE_MS + 50);
  };

  // Stagger start times so the cards don't all change at once
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

        // Smooth slideshow transition
        image.style.transition = "opacity 0.4s ease";
        image.style.opacity = "1";

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
          startCategorySlideshow(image, images, (index % 5) * 800);
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