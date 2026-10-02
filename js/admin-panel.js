// =========================================================
// ADMIN PANEL JAVASCRIPT
// Price and Description removed
// =========================================================


// =========================================================
// Inject CSS for 5-column image layout
// =========================================================

const style = document.createElement("style");

style.textContent = `
  .image-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-top: 8px;
  }

  .image-grid > div {
    position: relative;
  }

  .image-grid img.preview {
    width: 100%;
    height: auto;
    object-fit: cover;
    border-radius: 5px;
  }

  .image-grid button {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(255, 0, 0, 0.7);
    border: none;
    color: white;
    border-radius: 50%;
    cursor: pointer;
    padding: 3px 6px;
  }

  @media (max-width: 768px) {
    .image-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 480px) {
    .image-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;

document.head.appendChild(style);


// =========================================================
// Resize Image Helper
// =========================================================

function resizeImage(file, maxWidth, maxHeight, callback) {
  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.onload = function () {
      const canvas = document.createElement("canvas");

      let width = img.width;
      let height = img.height;

      // Resize while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        img,
        0,
        0,
        width,
        height
      );

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

      callback(dataUrl);
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}


// =========================================================
// Image Preview - Add Category
// =========================================================

const imageUploadInput = document.getElementById("imageUpload");

if (imageUploadInput) {

  imageUploadInput.addEventListener("change", function () {

    const preview = document.getElementById("previewImages");

    if (!preview) return;

    preview.innerHTML = "";

    [...this.files].forEach(file => {

      resizeImage(file, 200, 200, resized => {

        const img = document.createElement("img");

        img.src = resized;
        img.className = "preview";

        preview.appendChild(img);
      });

    });

  });

}


// =========================================================
// Add Category
// =========================================================

// Uploads photos one at a time (each request stays under Vercel's 4.5 MB limit).
// Returns the names of any files that failed.
async function uploadImages(categoryId, files, onProgress) {

  const failed = [];

  for (let i = 0; i < files.length; i++) {

    const file = files[i];

    try {

      const blob = await prepareImage(file);

      const res = await adminFetch(
        `/api/images?categoryId=${encodeURIComponent(categoryId)}&name=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob
        }
      );

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

    } catch (err) {

      console.error("Upload failed:", file.name, err);
      failed.push(file.name);

    }

    if (onProgress) onProgress(i + 1, files.length);

  }

  return failed;

}


const addForm = document.getElementById("addCategoryForm");

if (addForm) {

  addForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    // Category name only
    const categoryName = document
      .getElementById("categoryName")
      .value
      .trim();


    // Add images
    const files = document
      .getElementById("imageUpload")
      .files;

    const submitBtn = addForm.querySelector('button[type="submit"]');
    const submitLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) submitBtn.disabled = true;


    try {

      // 1) create the category, 2) upload its photos one at a time
      const response = await adminFetch(
        "/api/categories",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: categoryName })
        }
      );

      const result = await response.json();


      if (result.success) {

        const failed = await uploadImages(
          result.id,
          files,
          (done, total) => {
            if (submitBtn) submitBtn.textContent = `Uploading ${done}/${total}...`;
          }
        );

        alert(
          failed.length
            ? "Category added, but these photos failed:\n" + failed.join("\n")
            : "Category added successfully!"
        );

        addForm.reset();

        const preview = document.getElementById("previewImages");

        if (preview) {
          preview.innerHTML = "";
        }

        loadCategories();

      } else {

        alert(
          "Error: " +
          (result.error || "Unable to add category.")
        );

      }

    } catch (error) {

      console.error(
        "Add category failed:",
        error
      );

      alert(
        "An error occurred while adding the category."
      );
    } finally {

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }

    }

  });

}


// =========================================================
// Load Categories
// =========================================================

async function loadCategories() {

  const list = document.getElementById("categoryList");

  if (!list) return;

  list.innerHTML = "";


  try {

    const res = await fetch(
      "/api/categories",
      { cache: "no-store" }
    );

    const categories = await res.json();


    categories.forEach(cat => {

      const div = document.createElement("div");

      div.className = "category-entry";


      // -----------------------------------------------------
      // Images
      // -----------------------------------------------------

      const imagesHtml = (cat.images || [])
        .map(img => {

          const safeImage = String(img)
            .replace(/'/g, "\\'")
            .replace(/"/g, "&quot;");

          return `
            <div>
              <img
                src="/api/image?id=${safeImage}"
                class="preview"
                alt="${cat.name || "Portfolio image"}"
              >

              <button
                type="button"
                onclick="deleteImage('${cat.id}', '${safeImage}')"
                title="Delete image"
              >
                ✖
              </button>
            </div>
          `;

        })
        .join("");


      // -----------------------------------------------------
      // Category Display
      // -----------------------------------------------------

      div.innerHTML = `

        <strong>
          ${escapeHtml(cat.name || "")}
        </strong>

        <div class="image-grid">
          ${imagesHtml}
        </div>

        <br>

        <button
          type="button"
          onclick="openEditModal(
            '${cat.id}',
            '${escapeJs(cat.name || "")}'
          )"
        >
          ✏ Edit
        </button>

        <button
          type="button"
          onclick="openAddImageModal('${cat.id}')"
        >
          🖼 Add Image
        </button>

        <button
          type="button"
          onclick="deleteCategory('${cat.id}')"
        >
          ❌ Delete
        </button>

      `;


      list.appendChild(div);

    });


  } catch (err) {

    console.error(
      "Failed to load categories:",
      err
    );

    list.innerHTML = `
      <p style="color:red;">
        Unable to load categories.
      </p>
    `;

  }

}


// =========================================================
// HTML Escape Helper
// =========================================================

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// =========================================================
// JavaScript String Escape Helper
// =========================================================

function escapeJs(value) {

  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");

}


// =========================================================
// Delete Category
// =========================================================

async function deleteCategory(id) {

  if (
    !confirm(
      "Are you sure you want to delete this category?"
    )
  ) {
    return;
  }


  try {

    const res = await adminFetch(
      `/api/categories?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    const result = await res.json();


    if (result.success) {

      alert("Deleted successfully");

      loadCategories();

    } else {

      alert(
        result.error ||
        "Failed to delete category."
      );

    }


  } catch (err) {

    console.error(
      "Delete failed:",
      err
    );

    alert(
      "An error occurred while deleting the category."
    );

  }

}


// =========================================================
// Edit Modal Controls
// =========================================================

function openEditModal(id, name) {

  document.getElementById("editId").value = id;

  document.getElementById("editName").value = name;

  document.getElementById(
    "editModal"
  ).style.display = "block";

}


function closeEditModal() {

  document.getElementById(
    "editModal"
  ).style.display = "none";

}


// =========================================================
// Submit Edit Category
// =========================================================

const editForm = document.getElementById(
  "editCategoryForm"
);

if (editForm) {

  editForm.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      const categoryId = document.getElementById("editId").value;

      const categoryName = document.getElementById("editName").value.trim();


      try {

        const res = await adminFetch(
          `/api/categories?id=${encodeURIComponent(categoryId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: categoryName })
          }
        );


        const result = await res.json();


        if (result.success) {

          alert("Category updated");

          closeEditModal();

          loadCategories();

        } else {

          alert(
            result.error ||
            "Failed to update category."
          );

        }


      } catch (err) {

        console.error(
          "Edit failed:",
          err
        );

        alert(
          "An error occurred while updating the category."
        );

      }

    }
  );

}


// =========================================================
// Add Image Modal Controls
// =========================================================

function openAddImageModal(id) {

  document.getElementById(
    "addImageId"
  ).value = id;

  document.getElementById(
    "addImageModal"
  ).style.display = "block";

}


function closeAddImageModal() {

  document.getElementById(
    "addImageModal"
  ).style.display = "none";

}


// =========================================================
// Image Preview - Add Images
// =========================================================

const addImageInput = document.getElementById(
  "addImages"
);

if (addImageInput) {

  addImageInput.addEventListener(
    "change",
    function () {

      const preview =
        document.getElementById(
          "newImagePreview"
        );

      if (!preview) return;

      preview.innerHTML = "";


      [...this.files].forEach(file => {

        resizeImage(
          file,
          200,
          200,
          resized => {

            const img =
              document.createElement("img");

            img.src = resized;

            img.className = "preview";

            preview.appendChild(img);

          }
        );

      });

    }
  );

}


// =========================================================
// Add Images to Existing Category
// =========================================================

const addImageForm =
  document.getElementById(
    "addImageForm"
  );

if (addImageForm) {

  addImageForm.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      const categoryId =
        document.getElementById(
          "addImageId"
        ).value;


      const files =
        document.getElementById(
          "addImages"
        ).files;

      if (!files.length) {
        alert("Please choose at least one photo.");
        return;
      }

      const submitBtn = addImageForm.querySelector('button[type="submit"]');
      const submitLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) submitBtn.disabled = true;


      try {

        const failed = await uploadImages(
          categoryId,
          files,
          (done, total) => {
            if (submitBtn) submitBtn.textContent = `Uploading ${done}/${total}...`;
          }
        );

       const result = {
  success: failed.length === 0,
  error: failed.length
    ? "Failed to upload: " + failed.join(", ")
    : ""
};

        if (result.success && failed.length) {
          alert("Some photos failed to upload:\n" + failed.join("\n"));
        }


        if (result.success) {

          alert("Images added!");

          closeAddImageModal();

          addImageForm.reset();

          const preview =
            document.getElementById(
              "newImagePreview"
            );

          if (preview) {
            preview.innerHTML = "";
          }

          loadCategories();

        } else {

          alert(
            result.error ||
            "Failed to add images."
          );

        }


      } catch (err) {

        console.error(
          "Image upload failed:",
          err
        );

        alert(
          "An error occurred while uploading images."
        );

      } finally {

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitLabel;
        }

      }

    }
  );

}


// =========================================================
// Delete Single Image
// =========================================================

async function deleteImage(
  categoryId,
  imageName
) {

  if (
    !confirm(
      "Delete this image?"
    )
  ) {
    return;
  }


  try {

    // imageName is now the Google Drive file ID
    const res = await adminFetch(
      `/api/images?categoryId=${encodeURIComponent(categoryId)}&fileId=${encodeURIComponent(imageName)}`,
      { method: "DELETE" }
    );


    const result =
      await res.json();


    if (result.success) {

      loadCategories();

    } else {

      alert(
        result.error ||
        "Could not delete image."
      );

    }


  } catch (err) {

    console.error(
      "Delete image error:",
      err
    );

    alert(
      "An error occurred while deleting the image."
    );

  }

}


// =========================================================
// Close Modals When Clicking Outside
// =========================================================

window.addEventListener(
  "click",
  function (event) {

    const editModal =
      document.getElementById(
        "editModal"
      );

    const addImageModal =
      document.getElementById(
        "addImageModal"
      );


    if (
      event.target === editModal
    ) {
      closeEditModal();
    }


    if (
      event.target === addImageModal
    ) {
      closeAddImageModal();
    }

  }
);


// =========================================================
// Load Categories on Page Load
// =========================================================

loadCategories();