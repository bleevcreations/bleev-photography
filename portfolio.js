document.addEventListener("DOMContentLoaded", async () => {
  const portfolioGrid = document.getElementById("portfolioGrid");
  const filterTabs = document.getElementById("filterTabs");

  let categories = [];

  const normalize = (value) =>
    String(value || "").trim().toLowerCase();

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

    visibleCategories.forEach((cat) => {
      const images =
        Array.isArray(cat.images) && cat.images.length > 0
          ? cat.images
          : [];

      const card = document.createElement("article");
      card.className = "portfolio-card";

      // ------------------------------------------------
      // CARD IMAGE (pulled from the database)
      // ------------------------------------------------

      if (images.length > 0) {
        const image = document.createElement("img");

        image.src = `/api/image?id=${images[0]}`;
        image.alt = cat.name || "Bleeve Creations portfolio";
        image.loading = "lazy";

        image.onerror = () => {
          image.style.display = "none";
          card.classList.add("no-image");
        };

        card.appendChild(image);
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