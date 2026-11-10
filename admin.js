
(() => {
  "use strict";

  const cfg = window.VENDORA_CONFIG || {};
  const $ = id => document.getElementById(id);

  const loginPanel = $("loginPanel");
  const dashboard = $("dashboard");

  let supabase = null;
  let products = [];
  let sourcingByProduct = new Map();
  let orders = [];
  let dashboardLoading = false;

  function notice(id, message, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
    el.style.display = "block";
  }

  function clearNotice(id) {
    const el = $(id);
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
    el.classList.remove("error");
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function toDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);
  }

  function fromDateTimeLocal(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function updateProfit() {
    const sellValue = $("sellingPrice").value;
    const costValue = $("supplierCost").value;

    $("profitPreview").value =
      sellValue !== "" && costValue !== ""
        ? money(Number(sellValue) - Number(costValue))
        : "Enter both prices";
  }

  function resetForm() {
    $("productForm").reset();
    $("productId").value = "";
    $("isActive").checked = true;
    $("formTitle").textContent = "Add a product";
    $("saveButton").textContent = "Save product";
    $("profitPreview").value = "Enter both prices";
    clearNotice("formNotice");
  }

  // PRODUCT MANAGEMENT

  async function loadProducts() {
    $("productRows").innerHTML =
      '<tr><td colspan="7">Loading products...</td></tr>';

    const [pResult, sResult] = await Promise.all([
      supabase.from("products")
        .select("id,sku,name,category,description,image_url,selling_price,compare_at_price,variants,is_active")
        .order("created_at", { ascending: false }),

      supabase.from("product_sourcing")
        .select("product_id,supplier_name,supplier_url,supplier_cost,internal_notes")
    ]);

    if (pResult.error) throw pResult.error;
    if (sResult.error) throw sResult.error;

    products = pResult.data || [];
    sourcingByProduct = new Map(
      (sResult.data || []).map(x => [x.product_id, x])
    );

    renderProducts();
  }

  function renderProducts() {
    const body = $("productRows");

    if (!products.length) {
      body.innerHTML =
        '<tr><td colspan="7">No products yet. Add your first product above.</td></tr>';
      return;
    }

    body.innerHTML = products.map(p => {
      const s = sourcingByProduct.get(p.id) || {};
      const sell = Number(p.selling_price || 0);
      const cost = Number(s.supplier_cost || 0);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            <div class="small">${escapeHtml(p.category || "")}</div>
          </td>
          <td>${escapeHtml(p.sku)}</td>
          <td class="price">${money(sell)}</td>
          <td class="price">${s.supplier_cost == null ? "—" : money(cost)}</td>
          <td class="price">${s.supplier_cost == null ? "—" : money(sell - cost)}</td>
          <td>
            <span class="status ${p.is_active ? "on" : ""}">
              ${p.is_active ? "Active" : "Hidden"}
            </span>
          </td>
          <td>
            <div class="actions" style="margin:0">
              <button class="secondary" data-edit="${p.id}" type="button">Edit</button>
              <button class="secondary" data-toggle="${p.id}" type="button">
                ${p.is_active ? "Hide" : "Publish"}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll("[data-edit]").forEach(button =>
      button.addEventListener("click", () => editProduct(button.dataset.edit))
    );

    body.querySelectorAll("[data-toggle]").forEach(button =>
      button.addEventListener("click", () => toggleProduct(button.dataset.toggle))
    );
  }
