document.addEventListener("DOMContentLoaded", async () => {
  const portfolioGrid =
    document.getElementById("portfolioGrid");

  const filterTabs =
    document.getElementById("filterTabs");

  let categories = [];

  // ==================================================
  // IMAGE SETTINGS
  // ==================================================

  const CARD_WIDTH = 800;

  const imageUrl = (id) =>
    `/api/image?id=${encodeURIComponent(id)}&w=${CARD_WIDTH}`;


  // ==================================================
  // GLOBAL SLIDESHOW SETTINGS
  // ==================================================

  const GLOBAL_SLIDE_INTERVAL = 20000;
  const GLOBAL_TRANSITION_MS = 2000;


  // ==================================================
  // GLOBAL SLIDESHOW STATE
  // ==================================================

  let synchronizedSlideshows = [];

  let globalSlideshowTimer = null;


  // ==================================================
  // NORMALIZE VALUES
  // ==================================================

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();


  // ==================================================
  // GO TO CATEGORY PAGE
  // ==================================================

  function goToCategory(cat) {
    if (!cat || !cat.id) {
      console.error(
        "❌ Category ID missing:",
        cat
      );

      return;
    }

    window.location.href =
      `category.html?id=${encodeURIComponent(cat.id)}`;
  }


  // ==================================================
  // STOP GLOBAL SLIDESHOW CLOCK
  // ==================================================

  function stopGlobalSlideshowClock() {
    if (globalSlideshowTimer) {
      clearInterval(
        globalSlideshowTimer
      );

      globalSlideshowTimer = null;
    }
  }


  // ==================================================
  // CLEAR ALL SLIDESHOWS
  // ==================================================

  function clearSlideshowTimers() {
    stopGlobalSlideshowClock();

    synchronizedSlideshows.forEach(
      (slideshow) => {
        if (
          slideshow &&
          typeof slideshow.destroy ===
            "function"
        ) {
          slideshow.destroy();
        }
      }
    );

    synchronizedSlideshows = [];
  }


  // ==================================================
  // START CATEGORY SLIDESHOW
  // ==================================================

  function startSynchronizedSlideshow(
    imageElement,
    imageIds,
    card
  ) {
    if (
      !imageElement ||
      imageIds.length <= 1 ||
      !card
    ) {
      return;
    }

    // ------------------------------------------------
    // RESPECT ACCESSIBILITY SETTINGS
    // ------------------------------------------------

    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      return;
    }


    // ------------------------------------------------
    // CARD SETUP
    // ------------------------------------------------

    if (
      getComputedStyle(card).position ===
      "static"
    ) {
      card.style.position = "relative";
    }

    card.style.overflow = "hidden";


    // ------------------------------------------------
    // CREATE SECOND IMAGE LAYER
    // ------------------------------------------------

    const nextImage =
      imageElement.cloneNode(false);

    nextImage.removeAttribute("src");

    nextImage.loading = "eager";

    nextImage.decoding = "async";

    nextImage.alt = "";

    nextImage.setAttribute(
      "aria-hidden",
      "true"
    );


    // ------------------------------------------------
    // SECOND IMAGE CSS
    // ------------------------------------------------

    nextImage.style.position =
      "absolute";

    nextImage.style.inset = "0";

    nextImage.style.width =
      "100%";

    nextImage.style.height =
      "100%";

    nextImage.style.objectFit =
      "cover";

    nextImage.style.objectPosition =
      "center";

    nextImage.style.pointerEvents =
      "none";

    nextImage.style.visibility =
      "hidden";

    // Start outside the card
    // on the LEFT.

    nextImage.style.transform =
      "translate3d(-100%, 0, 0)";

    nextImage.style.zIndex = "2";

    nextImage.style.willChange =
      "transform";


    // ------------------------------------------------
    // CURRENT IMAGE
    // ------------------------------------------------

    imageElement.style.position =
      "relative";

    imageElement.style.zIndex = "1";

    imageElement.style.willChange =
      "transform";


    // Add second layer
    card.appendChild(
      nextImage
    );


    // ==================================================
    // SLIDESHOW OBJECT
    // ==================================================

    const slideshow = {

      imageElement,

      nextImage,

      imageIds,

      card,

      currentIndex: 0,

      nextIndex: null,

      busy: false,

      paused: false,

      destroyed: false,

      prepareNext: null,

      transition: null,

      reset: null,

      destroy: null

    };


    // ==================================================
    // PRELOAD IMAGE
    // ==================================================

    function preloadImage(id) {
      return new Promise(
        (resolve) => {

          const img =
            new Image();

          let finished = false;

          const timeout =
            setTimeout(() => {
              finish(false);
            }, 8000);


          function finish(success) {
            if (finished) {
              return;
            }

            finished = true;

            clearTimeout(
              timeout
            );

            resolve(success);
          }


          img.onload = () => {
            finish(true);
          };


          img.onerror = () => {
            finish(false);
          };


          img.src =
            imageUrl(id);
        }
      );
    }


    // ==================================================
    // PICK RANDOM NEXT IMAGE
    // ==================================================

    function pickNextIndex() {

      if (imageIds.length <= 1) {
        return slideshow.currentIndex;
      }

      let index;

      do {

        index =
          Math.floor(
            Math.random() *
              imageIds.length
          );

      } while (
        index ===
        slideshow.currentIndex
      );

      return index;
    }


    // ==================================================
    // PREPARE NEXT IMAGE
    // ==================================================

    slideshow.prepareNext =
      async function () {

        if (
          slideshow.destroyed
        ) {
          return false;
        }


        const candidate =
          pickNextIndex();


        const loaded =
          await preloadImage(
            imageIds[candidate]
          );


        if (
          !loaded ||
          slideshow.destroyed
        ) {
          return false;
        }


        slideshow.nextIndex =
          candidate;


        return true;
      };


    // ==================================================
    // RESET NEXT IMAGE
    // ==================================================

    slideshow.reset =
      function () {

        nextImage.style.transition =
          "none";


        nextImage.style.visibility =
          "hidden";


        nextImage.style.transform =
          "translate3d(-100%, 0, 0)";
      };


    // ==================================================
    // TRANSITION TO NEXT IMAGE
    // ==================================================

    slideshow.transition =
      async function () {

        if (
          slideshow.destroyed ||
          slideshow.busy ||
          slideshow.paused ||
          document.hidden
        ) {
          return;
        }


        // ------------------------------------------------
        // MAKE SURE NEXT IMAGE IS READY
        // ------------------------------------------------

        if (
          slideshow.nextIndex ===
          null
        ) {

          const ready =
            await slideshow.prepareNext();


          if (!ready) {
            return;
          }
        }


        slideshow.busy = true;


        const targetIndex =
          slideshow.nextIndex;


        const targetId =
          imageIds[targetIndex];


        const targetUrl =
          imageUrl(targetId);


        // ------------------------------------------------
        // LOAD IMAGE INTO SECOND LAYER
        // ------------------------------------------------

        nextImage.src =
          targetUrl;


        try {

          await nextImage.decode();

        } catch {
          // Browser may already have
          // decoded the image.
        }


        // ------------------------------------------------
        // CHECK STATE AGAIN
        // ------------------------------------------------

        if (
          slideshow.destroyed ||
          slideshow.paused ||
          document.hidden
        ) {

          slideshow.busy =
            false;

          return;
        }


        // ------------------------------------------------
        // SET STARTING POSITION
        // ------------------------------------------------

        nextImage.style.transition =
          "none";


        nextImage.style.visibility =
          "visible";


        nextImage.style.transform =
          "translate3d(-100%, 0, 0)";


        // Force browser to apply
        // the starting position.

        void nextImage.offsetWidth;


        // ------------------------------------------------
        // TRANSITION
        // ------------------------------------------------

        const transition =
          `transform ${GLOBAL_TRANSITION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;


        nextImage.style.transition =
          transition;


        imageElement.style.transition =
          transition;


        // New image enters
        // from the LEFT.

        nextImage.style.transform =
          "translate3d(0, 0, 0)";


        // Current image exits
        // to the RIGHT.

        imageElement.style.transform =
          "translate3d(100%, 0, 0)";


        // ------------------------------------------------
        // COMPLETE TRANSITION
        // ------------------------------------------------

        setTimeout(() => {

          if (
            slideshow.destroyed
          ) {
            return;
          }


          // Make the new image
          // the permanent image.

          imageElement.src =
            targetUrl;


          imageElement.style.transition =
            "none";


          imageElement.style.transform =
            "translate3d(0, 0, 0)";


          // Reset second image.

          slideshow.reset();


          // Update current index.

          slideshow.currentIndex =
            targetIndex;


          slideshow.nextIndex =
            null;


          slideshow.busy =
            false;


          // Prepare another image
          // before the next global tick.

          slideshow.prepareNext();

        }, GLOBAL_TRANSITION_MS + 40);
      };


    // ==================================================
    // HOVER PAUSE
    // ==================================================

    const handleMouseEnter =
      () => {

        slideshow.paused = true;
      };


    const handleMouseLeave =
      () => {

        slideshow.paused = false;
      };


    card.addEventListener(
      "mouseenter",
      handleMouseEnter
    );


    card.addEventListener(
      "mouseleave",
      handleMouseLeave
    );


    // ==================================================
    // CLEANUP
    // ==================================================

    slideshow.destroy =
      function () {

        slideshow.destroyed =
          true;


        card.removeEventListener(
          "mouseenter",
          handleMouseEnter
        );


        card.removeEventListener(
          "mouseleave",
          handleMouseLeave
        );


        nextImage.remove();
      };


    // ==================================================
    // REGISTER SLIDESHOW
    // ==================================================

    synchronizedSlideshows.push(
      slideshow
    );


    // ------------------------------------------------
    // PRELOAD FIRST RANDOM NEXT IMAGE
    // ------------------------------------------------

    slideshow.prepareNext();
  }


  // ==================================================
  // START GLOBAL SLIDESHOW CLOCK
  // ==================================================

  function startGlobalSlideshowClock() {

    // Prevent duplicate timers.

    if (globalSlideshowTimer) {
      return;
    }


    globalSlideshowTimer =
      setInterval(() => {

        // Don't animate hidden tabs.

        if (document.hidden) {
          return;
        }


        // ------------------------------------------------
        // IMPORTANT:
        //
        // Every slideshow receives the SAME timer event.
        // ------------------------------------------------

        synchronizedSlideshows.forEach(
          (slideshow) => {

            slideshow.transition();

          }
        );


      }, GLOBAL_SLIDE_INTERVAL);
  }


  // ==================================================
  // LOAD CATEGORIES
  // ==================================================

  try {

    const res =
      await fetch(
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


    categories =
      await res.json();


    if (
      !Array.isArray(categories)
    ) {

      throw new Error(
        "Invalid categories data"
      );

    }


    // ------------------------------------------------
    // NO CATEGORIES
    // ------------------------------------------------

    if (
      categories.length === 0
    ) {

      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items available yet.
        </p>
      `;

      return;
    }


    // ==================================================
    // BUILD FILTER TABS
    // ==================================================

    categories.forEach(
      (cat) => {

        const button =
          document.createElement(
            "button"
          );


        button.type =
          "button";


        button.dataset.filter =
          normalize(cat.name);


        button.textContent =
          cat.name;


        filterTabs.appendChild(
          button
        );

      }
    );


    // ==================================================
    // ACTIVATE "ALL"
    // ==================================================

    filterTabs
      .querySelectorAll("button")
      .forEach(
        (btn) => {

          btn.classList.toggle(
            "active",
            btn.dataset.filter ===
              "all"
          );

        }
      );


    // ==================================================
    // INITIAL RENDER
    // ==================================================

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


  // ==================================================
  // RENDER PORTFOLIO CARDS
  // ==================================================

  function renderCards(filter) {

    // ------------------------------------------------
    // CLEAN UP PREVIOUS SLIDESHOWS
    // ------------------------------------------------

    clearSlideshowTimers();


    // Clear grid.

    portfolioGrid.innerHTML =
      "";


    // ------------------------------------------------
    // FILTER CATEGORIES
    // ------------------------------------------------

    const visibleCategories =
      categories.filter(
        (cat) => {

          return (
            filter === "all" ||
            normalize(cat.name) ===
              normalize(filter)
          );

        }
      );


    // ------------------------------------------------
    // NO RESULTS
    // ------------------------------------------------

    if (
      visibleCategories.length ===
      0
    ) {

      portfolioGrid.innerHTML = `
        <p class="grid-message">
          No portfolio items in this category.
        </p>
      `;

      return;
    }


    // ==================================================
    // CREATE CARDS
    // ==================================================

    visibleCategories.forEach(
      (cat) => {

        // ------------------------------------------------
        // GET IMAGES
        // ------------------------------------------------

        const images =
          Array.isArray(cat.images) &&
          cat.images.length > 0
            ? cat.images.filter(Boolean)
            : [];


        // ------------------------------------------------
        // CREATE CARD
        // ------------------------------------------------

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "portfolio-card";


        // ==================================================
        // CARD IMAGE
        // ==================================================

        if (
          images.length > 0
        ) {

          const image =
            document.createElement(
              "img"
            );


          image.src =
            imageUrl(images[0]);


          image.alt =
            cat.name ||
            "Bleeve Creations portfolio";


          image.loading =
            "lazy";


          image.decoding =
            "async";


          // ------------------------------------------------
          // IMAGE ERROR
          // ------------------------------------------------

          image.onerror =
            () => {

              image.style.display =
                "none";

              card.classList.add(
                "no-image"
              );

            };


          card.appendChild(
            image
          );


          // ------------------------------------------------
          // START SYNCHRONIZED SLIDESHOW
          // ------------------------------------------------

          if (
            images.length > 1
          ) {

            startSynchronizedSlideshow(
              image,
              images,
              card
            );

          }

        } else {

          card.classList.add(
            "no-image"
          );

        }


        // ==================================================
        // DARK OVERLAY
        // ==================================================

        const overlay =
          document.createElement(
            "div"
          );


        overlay.className =
          "portfolio-card-overlay";


        // ==================================================
        // CATEGORY NAME
        // ==================================================

        const categoryName =
          document.createElement(
            "h3"
          );


        categoryName.className =
          "portfolio-category-name";


        categoryName.textContent =
          cat.name ||
          "Untitled";


        overlay.appendChild(
          categoryName
        );


        // ==================================================
        // PHOTO COUNT
        // ==================================================

        if (
          images.length > 0
        ) {

          const photoCount =
            document.createElement(
              "span"
            );


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


        // Add overlay.

        card.appendChild(
          overlay
        );


        // ==================================================
        // ACCESSIBILITY
        // ==================================================

        card.setAttribute(
          "role",
          "link"
        );


        card.setAttribute(
          "tabindex",
          "0"
        );


        // ==================================================
        // CLICK → CATEGORY
        // ==================================================

        card.addEventListener(
          "click",
          () => {

            goToCategory(cat);

          }
        );


        // ==================================================
        // KEYBOARD → CATEGORY
        // ==================================================

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


        // ==================================================
        // ADD CARD TO GRID
        // ==================================================

        portfolioGrid.appendChild(
          card
        );

      }
    );


    // ------------------------------------------------
    // START ONE GLOBAL CLOCK
    // ------------------------------------------------

    startGlobalSlideshowClock();
  }


  // ==================================================
  // FILTER TABS
  // ==================================================

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
        .forEach(
          (btn) => {

            btn.classList.remove(
              "active"
            );

          }
        );


      button.classList.add(
        "active"
      );


      // ------------------------------------------------
      // RENDER FILTERED CARDS
      // ------------------------------------------------

      renderCards(
        button.dataset.filter
      );

    }
  );
});