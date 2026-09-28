/* ==========================================================
   Registro de productos
   - Sin frameworks ni dependencias: abrí index.html y listo.
   - Los productos (y sus fotos) se guardan en el navegador
     con localStorage.
   ========================================================== */

(function () {
  "use strict";

  /* ---------- Configuración ---------- */

  // Para cambiar la moneda, editá estas dos líneas.
  // Ejemplos: "ARS" con "es-AR" (pesos argentinos), "USD" con "es" (dólares).
  var MONEDA = "ARS";
  var IDIOMA = "es";

  var STORAGE_KEY = "registro-productos:v1";
  var FOTO_MAX_LADO = 800; // px: las fotos se reducen para no llenar el navegador
  var FOTO_CALIDAD = 0.8;

  var formatoMoneda = new Intl.NumberFormat(IDIOMA, {
    style: "currency",
    currency: MONEDA,
  });

  /* ---------- Iconos (Lucide, en SVG) ---------- */

  var ICONOS = {
    package:
      '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
    pencil:
      '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    trash:
      '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    imagePlus:
      '<path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  };

  function icono(nombre, tamano) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + tamano + '" height="' + tamano +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONOS[nombre] + "</svg>"
    );
  }

  /* ---------- Referencias al DOM ---------- */

  var $ = function (id) { return document.getElementById(id); };

  var form = $("product-form");
  var formTitle = $("form-title");
  var cancelBtn = $("cancel-btn");
  var submitBtn = $("submit-btn");
  var formError = $("form-error");
  var photoInput = $("photo");
  var photoPreview = $("photo-preview");
  var photoPlaceholder = $("photo-placeholder");
  var inputTitle = $("title");
  var inputCost = $("cost");
  var inputPrice = $("price");
  var inputQuantity = $("quantity");
  var inputCategory = $("category");
  var categoryOptions = $("category-options");
  var subtitle = $("subtitle");
  var filters = $("filters");
  var list = $("list");
  var exportBtn = $("export-btn");
  var importBtn = $("import-btn");
  var importFile = $("import-file");

  /* ---------- Estado ---------- */

  var productos = cargar();
  var editando = null;          // producto que se está editando (o null)
  var fotoNueva = null;         // foto elegida en el formulario (data URL)
  var categoriaActiva = "Todas";

  /* ---------- Almacenamiento ---------- */

  function cargar() {
    try {
      var datos = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(datos) ? datos : [];
    } catch (e) {
      return [];
    }
  }

  function guardar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(productos));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Utilidades ---------- */

  function escapar(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mostrarError(mensaje) {
    if (mensaje) {
      formError.textContent = mensaje;
      formError.hidden = false;
    } else {
      formError.textContent = "";
      formError.hidden = true;
    }
  }

  // Reduce la foto y la devuelve como data URL (JPEG) para guardarla en el navegador.
  function reducirFoto(archivo) {
    return new Promise(function (resolve, reject) {
      var lector = new FileReader();
      lector.onerror = function () { reject(new Error("No se pudo leer la foto")); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("La foto no es una imagen válida")); };
        img.onload = function () {
          var escala = Math.min(1, FOTO_MAX_LADO / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * escala);
          canvas.height = Math.round(img.height * escala);
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", FOTO_CALIDAD));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  /* ---------- Formulario ---------- */

  function actualizarVistaPrevia(src) {
    if (src) {
      photoPreview.src = src;
      photoPreview.hidden = false;
      photoPlaceholder.hidden = true;
    } else {
      photoPreview.removeAttribute("src");
      photoPreview.hidden = true;
      photoPlaceholder.hidden = false;
    }
  }

  function actualizarTextosFormulario() {
    if (editando) {
      formTitle.textContent = "Editando: " + editando.title;
      submitBtn.innerHTML = icono("plus", 16) + "Guardar cambios";
      cancelBtn.hidden = false;
    } else {
      formTitle.textContent = "Agregar producto";
      submitBtn.innerHTML = icono("plus", 16) + "Agregar producto";
      cancelBtn.hidden = true;
    }
  }

  function empezarEdicion(id) {
    var producto = productos.find(function (p) { return p.id === id; });
    if (!producto) return;

    editando = producto;
    fotoNueva = null;
    photoInput.value = "";
    inputTitle.value = producto.title;
    inputCost.value = producto.cost;
    inputPrice.value = producto.price;
    inputQuantity.value = producto.quantity;
    inputCategory.value = producto.category;
    actualizarVistaPrevia(producto.photo);
    actualizarTextosFormulario();
    mostrarError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicion() {
    editando = null;
    fotoNueva = null;
    form.reset();
    photoInput.value = "";
    actualizarVistaPrevia(null);
    actualizarTextosFormulario();
    mostrarError(null);
  }

  photoInput.addEventListener("change", function () {
    var archivo = photoInput.files && photoInput.files[0];
    if (!archivo) return;
    mostrarError(null);
    reducirFoto(archivo)
      .then(function (dataUrl) {
        fotoNueva = dataUrl;
        actualizarVistaPrevia(dataUrl);
      })
      .catch(function (err) {
        photoInput.value = "";
        mostrarError(err.message);
      });
  });

  cancelBtn.addEventListener("click", cancelarEdicion);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    mostrarError(null);

    var titulo = inputTitle.value.trim();
    var costo = parseFloat(inputCost.value);
    var precio = parseFloat(inputPrice.value);
    var cantidad = parseInt(inputQuantity.value, 10);
    var categoria = inputCategory.value.trim();

    // Validaciones
    if (!titulo) return mostrarError("El título es obligatorio");
    if (isNaN(costo) || costo < 0) return mostrarError("El costo debe ser 0 o más");
    if (isNaN(precio) || precio < 0) return mostrarError("El valor debe ser 0 o más");
    if (isNaN(cantidad) || cantidad < 0) return mostrarError("La cantidad debe ser 0 o más");
    if (!categoria) return mostrarError("La categoría es obligatoria");

    var copiaAnterior = JSON.stringify(productos);

    if (editando) {
      var existente = productos.find(function (p) { return p.id === editando.id; });
      if (existente) {
        existente.title = titulo;
        existente.cost = costo;
        existente.price = precio;
        existente.quantity = cantidad;
        existente.category = categoria;
        if (fotoNueva) existente.photo = fotoNueva;
      }
    } else {
      productos.push({
        id: Date.now(),
        title: titulo,
        cost: costo,
        price: precio,
        quantity: cantidad,
        category: categoria,
        photo: fotoNueva || null,
        createdAt: Date.now(),
      });
    }

    if (!guardar()) {
      productos = JSON.parse(copiaAnterior); // deshacer el cambio
      return mostrarError(
        "No se pudo guardar: el almacenamiento del navegador está lleno. " +
        "Probá con una foto más chica o descargá una copia y borrá productos que ya no uses."
      );
    }

    cancelarEdicion();
    render();
  });

  /* ---------- Lista ---------- */

  function eliminar(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    productos = productos.filter(function (p) { return p.id !== id; });
    guardar();
    if (editando && editando.id === id) cancelarEdicion();
    render();
  }

  function categorias() {
    var unicas = [];
    productos.forEach(function (p) {
      if (p.category && unicas.indexOf(p.category) === -1) unicas.push(p.category);
    });
    return unicas.sort(function (a, b) { return a.localeCompare(b, IDIOMA); });
  }

  function tarjeta(p) {
    var foto = p.photo
      ? '<img src="' + p.photo + '" alt="' + escapar(p.title) + '">'
      : icono("package", 32);

    return (
      '<div class="card product">' +
        '<div class="product-photo">' + foto + "</div>" +
        '<div class="product-body">' +
          '<span class="tag">' + escapar(p.category) + "</span>" +
          '<h3 class="product-title">' + escapar(p.title) + "</h3>" +
          '<div class="stats">' +
            '<div><p class="label">Costo</p><p class="value">' + formatoMoneda.format(p.cost) + "</p></div>" +
            '<div><p class="label">Valor</p><p class="value">' + formatoMoneda.format(p.price) + "</p></div>" +
            '<div><p class="label">Cantidad</p><p class="value">' + p.quantity + "</p></div>" +
          "</div>" +
          '<div class="actions">' +
            '<button type="button" class="btn-edit" data-editar="' + p.id + '">' +
              icono("pencil", 14) + "Editar</button>" +
            '<button type="button" class="btn-delete" data-eliminar="' + p.id + '" aria-label="Eliminar">' +
              icono("trash", 14) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function estadoVacio(mensaje) {
    return '<div class="empty">' + icono("package", 40) + "<p>" + mensaje + "</p></div>";
  }

  function render() {
    var cats = categorias();

    // Si la categoría activa ya no existe (se borró el último producto), volver a "Todas"
    if (categoriaActiva !== "Todas" && cats.indexOf(categoriaActiva) === -1) {
      categoriaActiva = "Todas";
    }

    // Productos visibles, del más nuevo al más viejo
    var visibles = productos
      .filter(function (p) { return categoriaActiva === "Todas" || p.category === categoriaActiva; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });

    // Encabezado: cantidad y valor total del inventario
    var total = visibles.reduce(function (suma, p) { return suma + p.price * p.quantity; }, 0);
    subtitle.textContent =
      visibles.length + " " + (visibles.length === 1 ? "producto" : "productos") +
      " · valor total en inventario " + formatoMoneda.format(total);

    // Sugerencias de categoría en el formulario
    categoryOptions.innerHTML = cats
      .map(function (c) { return '<option value="' + escapar(c) + '"></option>'; })
      .join("");

    // Botones de filtro
    if (cats.length > 0) {
      filters.innerHTML = ["Todas"].concat(cats)
        .map(function (c) {
          return (
            '<button type="button" class="chip' + (c === categoriaActiva ? " active" : "") +
            '" data-categoria="' + escapar(c) + '">' + escapar(c) + "</button>"
          );
        })
        .join("");
      filters.hidden = false;
    } else {
      filters.innerHTML = "";
      filters.hidden = true;
    }

    // Lista
    if (productos.length === 0) {
      list.innerHTML = estadoVacio("Todavía no hay productos registrados.");
    } else if (visibles.length === 0) {
      list.innerHTML = estadoVacio("No hay productos en esta categoría.");
    } else {
      list.innerHTML = '<div class="grid">' + visibles.map(tarjeta).join("") + "</div>";
    }
  }

  // Clicks en filtros y en los botones de cada tarjeta
  filters.addEventListener("click", function (e) {
    var boton = e.target.closest("[data-categoria]");
    if (!boton) return;
    categoriaActiva = boton.getAttribute("data-categoria");
    render();
  });

  list.addEventListener("click", function (e) {
    var editar = e.target.closest("[data-editar]");
    if (editar) return empezarEdicion(Number(editar.getAttribute("data-editar")));

    var borrar = e.target.closest("[data-eliminar]");
    if (borrar) return eliminar(Number(borrar.getAttribute("data-eliminar")));
  });

  /* ---------- Copia de seguridad ---------- */

  exportBtn.addEventListener("click", function () {
    var contenido = JSON.stringify(productos, null, 2);
    var blob = new Blob([contenido], { type: "application/json" });
    var enlace = document.createElement("a");
    var fecha = new Date().toISOString().slice(0, 10);
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "productos-" + fecha + ".json";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(function () { URL.revokeObjectURL(enlace.href); }, 1000);
  });

  importBtn.addEventListener("click", function () { importFile.click(); });

  importFile.addEventListener("change", function () {
    var archivo = importFile.files && importFile.files[0];
    if (!archivo) return;

    var lector = new FileReader();
    lector.onload = function () {
      try {
        var datos = JSON.parse(lector.result);
        if (!Array.isArray(datos)) throw new Error("formato");

        var validos = datos.filter(function (p) {
          return p && typeof p.title === "string" && p.id != null;
        });

        if (!confirm("Esto reemplaza los " + productos.length +
          " productos actuales por los " + validos.length + " de la copia. ¿Continuar?")) return;

        var anteriores = productos;
        productos = validos.map(function (p) {
          return {
            id: Number(p.id),
            title: String(p.title),
            cost: Number(p.cost) || 0,
            price: Number(p.price) || 0,
            quantity: parseInt(p.quantity, 10) || 0,
            category: String(p.category || "General"),
            photo: typeof p.photo === "string" ? p.photo : null,
            createdAt: Number(p.createdAt) || Date.now(),
          };
        });

        if (!guardar()) {
          productos = anteriores;
          alert("No se pudo restaurar: la copia es demasiado grande para el navegador.");
          return;
        }
        cancelarEdicion();
        render();
      } catch (err) {
        alert("El archivo no es una copia válida.");
      } finally {
        importFile.value = "";
      }
    };
    lector.readAsText(archivo);
  });

  /* ---------- Inicio ---------- */

  $("header-icon").innerHTML = icono("package", 24);
  photoPlaceholder.innerHTML = icono("imagePlus", 24);
  cancelBtn.innerHTML = icono("x", 16) + "Cancelar";
  actualizarTextosFormulario();
  render();
})();
