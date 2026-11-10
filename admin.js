
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

  function notice(id, message, error = false) {
    const el = $(id);
    el.textContent = message;
    el.classList.toggle("error", error);
    el.style.display = "block";
  }

  function clearNotice(id) {
    const el = $(id);
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
    const sell = Number($("sellingPrice").value);
    const cost = Number($("supplierCost").value);

    $("profitPreview").value =
      $("sellingPrice").value !== "" &&
      $("supplierCost").value !== ""
        ? money(sell - cost)
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

    body.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => editProduct(b.dataset.edit))
    );

    body.querySelectorAll("[data-toggle]").forEach(b =>
      b.addEventListener("click", () => toggleProduct(b.dataset.toggle))
    );
  }

  function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const s = sourcingByProduct.get(id) || {};

    $("productId").value = p.id;
    $("sku").value = p.sku || "";
    $("name").value = p.name || "";
    $("category").value = p.category || "Other";
    $("imageUrl").value = p.image_url || "";
    $("description").value = p.description || "";
    $("sellingPrice").value = p.selling_price ?? "";
    $("comparePrice").value = p.compare_at_price ?? "";
    $("supplierName").value = s.supplier_name || "";
    $("supplierCost").value = s.supplier_cost ?? "";
    $("supplierUrl").value = s.supplier_url || "";
    $("internalNotes").value = s.internal_notes || "";

    $("variants").value = p.variants
      ? JSON.stringify(p.variants, null, 2)
      : "";

    $("isActive").checked = !!p.is_active;
    $("formTitle").textContent = "Edit product";
    $("saveButton").textContent = "Update product";

    updateProfit();
    clearNotice("formNotice");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    clearNotice("formNotice");

    const button = $("saveButton");
    button.disabled = true;

    try {
      let variants = null;

      if ($("variants").value.trim()) {
        variants = JSON.parse($("variants").value);
      }

      const payload = {
        sku: $("sku").value.trim(),
        name: $("name").value.trim(),
        category: $("category").value,
        description: $("description").value.trim() || null,
        image_url: $("imageUrl").value.trim() || null,
        selling_price: Number($("sellingPrice").value),
        compare_at_price: $("comparePrice").value === ""
          ? null
          : Number($("comparePrice").value),
        variants,
        is_active: $("isActive").checked
      };

      let saved;

      if ($("productId").value) {
        const result = await supabase
          .from("products")
          .update(payload)
          .eq("id", $("productId").value)
          .select("id")
          .single();

        if (result.error) throw result.error;
        saved = { id: result.data.id };

      } else {
        const result = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();

        if (result.error) throw result.error;
        saved = { id: result.data.id };
      }

      const sourcing = {
        product_id: saved.id,
        supplier_name: $("supplierName").value.trim() || null,
        supplier_url: $("supplierUrl").value.trim() || null,
        supplier_cost: $("supplierCost").value === ""
          ? null
          : Number($("supplierCost").value),
        internal_notes: $("internalNotes").value.trim() || null
      };

      const sourceResult = await supabase
        .from("product_sourcing")
        .upsert(sourcing, { onConflict: "product_id" });

      if (sourceResult.error) {
        throw new Error(
          "Product saved, but private sourcing details were not saved: " +
          sourceResult.error.message
        );
      }

      notice(
        "formNotice",
        "Product and private sourcing details saved successfully."
      );

      resetForm();
      await loadProducts();

    } catch (err) {
      notice("formNotice", err.message || "Could not save product.", true);

    } finally {
      button.disabled = false;
    }
  }

  async function toggleProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active })
      .eq("id", id);

    if (error) {
      notice("listNotice", error.message, true);
      return;
    }

    notice(
      "listNotice",
      `Product ${!p.is_active ? "published" : "hidden"} successfully.`
    );

    await loadProducts();
  }

  // CUSTOMER ORDERS

  async function loadOrders() {
    $("orderRows").innerHTML =
      '<tr><td colspan="17">Loading orders...</td></tr>';

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        product_sku,
        product_name,
        quantity,
        customer_name,
        phone,
        email,
        address_line,
        city,
        state,
        postal_code,
        customer_note,
        unit_price,
        total_amount,
        status,
        admin_note,
        created_at,
        meesho_order_id,
        meesho_order_status,
        meesho_tracking_url,
        expected_margin,
        received_margin,
        margin_payout_status,
        delivered_at,
        margin_received_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    orders = data || [];
    renderOrders();
  }

  function updateOrderOverview() {
    const total = orders.length;
    const pending = orders.filter(o =>
      ["Pending", "Confirmed"].includes(o.status)
    ).length;
    const delivered = orders.filter(o => o.status === "Delivered").length;
    const expected = orders.reduce(
      (sum, o) => sum + Number(o.expected_margin || 0), 0
    );
    const received = orders.reduce(
      (sum, o) => sum + Number(o.received_margin || 0), 0
    );

    $("statTotalOrders").textContent = String(total);
    $("statPendingOrders").textContent = String(pending);
    $("statDeliveredOrders").textContent = String(delivered);
    $("statExpectedMargin").textContent = money(expected);
    $("statReceivedMargin").textContent = money(received);
    $("overviewCaption").textContent =
      `Based on ${total} order${total === 1 ? "" : "s"} currently loaded (maximum 100).`;
  }

  function getFilteredOrders() {
    const query = $("orderSearch").value.trim().toLowerCase();
    const status = $("orderStatusFilter").value;
    const payout = $("payoutStatusFilter").value;

    return orders.filter(o => {
      const searchable = [
        o.id,
        o.id?.slice(0, 8),
        o.customer_name,
        o.phone,
        o.email,
        o.product_name,
        o.product_sku,
        o.meesho_order_id,
        o.city,
        o.state,
        o.postal_code
      ].join(" ").toLowerCase();

      return (!query || searchable.includes(query)) &&
        (!status || o.status === status) &&
        (!payout ||
          (o.margin_payout_status || "not_received") === payout);
    });
  }

  function renderOrders() {
    const body = $("orderRows");
    const filteredOrders = getFilteredOrders();

    updateOrderOverview();

    $("orderResultsCount").textContent =
      `Showing ${filteredOrders.length} of ${orders.length} loaded orders.`;

    if (!filteredOrders.length) {
      body.innerHTML =
        `<tr><td colspan="17">${orders.length
          ? "No orders match these filters."
          : "No customer orders yet."}</td></tr>`;
      return;
    }

    const statuses = [
      "Pending",
      "Confirmed",
      "Ordered from Meesho",
      "Shipped",
      "Delivered",
      "Cancelled"
    ];

    const meeshoStatuses = [
      "not_placed",
      "placed",
      "shipped",
      "delivered",
      "returned",
      "cancelled"
    ];

    const payoutStatuses = [
      "not_received",
      "pending",
      "received",
      "failed"
    ];

    body.innerHTML = filteredOrders.map(o => `
      <tr>
        <td>
          <strong>${escapeHtml(o.id.slice(0, 8).toUpperCase())}</strong>
          <div class="small">${escapeHtml(o.product_sku || "")}</div>
        </td>
        <td>
          <strong>${escapeHtml(o.customer_name)}</strong>
          <div class="small">${escapeHtml(o.phone)}</div>
          <div class="small">${escapeHtml(o.email || "")}</div>
        </td>
        <td>
          ${escapeHtml(o.address_line)}, ${escapeHtml(o.city)},
          ${escapeHtml(o.state)} - ${escapeHtml(o.postal_code)}
          <div class="small">${escapeHtml(o.customer_note || "")}</div>
        </td>
        <td>
          ${escapeHtml(o.product_name || "Product")} × ${Number(o.quantity)}
        </td>
        <td class="price">${money(o.total_amount)}</td>
        <td>
          ${o.created_at
            ? new Date(o.created_at).toLocaleString("en-IN")
            : "—"}
        </td>
        <td>
          <select data-order-status="${o.id}">
            ${statuses.map(v =>
              `<option value="${escapeHtml(v)}" ${o.status === v ? "selected" : ""}>${escapeHtml(v)}</option>`
            ).join("")}
          </select>
        </td>
        <td>
          <input data-order-note="${o.id}"
            value="${escapeHtml(o.admin_note || "")}"
            maxlength="500" placeholder="Internal note">
        </td>
        <td>
          <input data-order-field="meesho_order_id"
            data-order-id="${o.id}"
            value="${escapeHtml(o.meesho_order_id || "")}"
            placeholder="Meesho order ID">
        </td>
        <td>
          <select data-order-field="meesho_order_status"
            data-order-id="${o.id}">
            ${meeshoStatuses.map(v =>
              `<option value="${v}" ${(o.meesho_order_status || "not_placed") === v ? "selected" : ""}>${v.replace("_", " ").toUpperCase()}</option>`
            ).join("")}
          </select>
        </td>
        <td>
          <input type="url" data-order-field="meesho_tracking_url"
            data-order-id="${o.id}"
            value="${escapeHtml(o.meesho_tracking_url || "")}"
            placeholder="Tracking URL">
        </td>
        <td>
          <input type="number" min="0" step="0.01"
            data-order-field="expected_margin" data-order-id="${o.id}"
            value="${o.expected_margin ?? ""}" placeholder="Expected ₹">
        </td>
        <td>
          <input type="number" min="0" step="0.01"
            data-order-field="received_margin" data-order-id="${o.id}"
            value="${o.received_margin ?? ""}" placeholder="Received ₹">
        </td>
        <td>
          <select data-order-field="margin_payout_status"
            data-order-id="${o.id}">
            ${payoutStatuses.map(v =>
              `<option value="${v}" ${(o.margin_payout_status || "not_received") === v ? "selected" : ""}>${v.replace("_", " ").toUpperCase()}</option>`
            ).join("")}
          </select>
        </td>
        <td>
          <input type="datetime-local" data-order-field="delivered_at"
            data-order-id="${o.id}" value="${toDateTimeLocal(o.delivered_at)}">
        </td>
        <td>
          <input type="datetime-local" data-order-field="margin_received_at"
            data-order-id="${o.id}"
            value="${toDateTimeLocal(o.margin_received_at)}">
        </td>
        <td>
          <button type="button" data-save-order="${o.id}">Save</button>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll("[data-save-order]").forEach(btn => {
      btn.addEventListener("click", () =>
        saveOrder(btn.dataset.saveOrder)
      );
    });
  }

  function csvCell(value) {
    let text = String(value ?? "");

    // Prevent spreadsheet formula execution when a cell begins with a formula marker.
    if (/^[=+@\-]/.test(text)) text = "'" + text;

    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportOrdersCsv() {
    const rows = getFilteredOrders();

    if (!rows.length) {
      notice("ordersNotice", "There are no matching orders to export.", true);
      return;
    }

    const columns = [
      ["BUSYKART Order ID", o => o.id],
      ["Customer", o => o.customer_name],
      ["Phone", o => o.phone],
      ["Email", o => o.email],
      ["Address", o => o.address_line],
      ["City", o => o.city],
      ["State", o => o.state],
      ["PIN Code", o => o.postal_code],
      ["Product SKU", o => o.product_sku],
      ["Product", o => o.product_name],
      ["Quantity", o => o.quantity],
      ["Unit Price", o => o.unit_price],
      ["Total Amount", o => o.total_amount],
      ["BUSYKART Status", o => o.status],
      ["Admin Note", o => o.admin_note],
      ["Meesho Order ID", o => o.meesho_order_id],
      ["Meesho Status", o => o.meesho_order_status],
      ["Tracking URL", o => o.meesho_tracking_url],
      ["Expected Margin", o => o.expected_margin],
      ["Received Margin", o => o.received_margin],
      ["Payout Status", o => o.margin_payout_status],
      ["Placed At", o => o.created_at],
      ["Delivered At", o => o.delivered_at],
      ["Margin Received At", o => o.margin_received_at]
    ];

    const csv = [
      columns.map(c => csvCell(c[0])).join(","),
      ...rows.map(o =>
        columns.map(c => csvCell(c[1](o))).join(",")
      )
    ].join("\r\n");

    const blob = new Blob(
      ["\uFEFF", csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `busykart-orders-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    notice(
      "ordersNotice",
      `Exported ${rows.length} order${rows.length === 1 ? "" : "s"} to CSV.`
    );
  }

  async function saveOrder(id) {
    const button = document.querySelector(
      `[data-save-order="${id}"]`
    );

    button.disabled = true;

    try {
      const getField = field => {
        const element = document.querySelector(
          `[data-order-field="${field}"][data-order-id="${id}"]`
        );

        if (!element) {
          throw new Error("Missing order field: " + field);
        }

        return element.value;
      };

      const expected = getField("expected_margin");
      const received = getField("received_margin");

      if (
        (expected !== "" &&
          (!Number.isFinite(Number(expected)) || Number(expected) < 0)) ||
        (received !== "" &&
          (!Number.isFinite(Number(received)) || Number(received) < 0))
      ) {
        throw new Error(
          "Please enter valid, non-negative margin amounts."
        );
      }

      const updates = {
        status: document.querySelector(
          `[data-order-status="${id}"]`
        ).value,

        admin_note: document.querySelector(
          `[data-order-note="${id}"]`
        ).value.trim() || null,

        meesho_order_id:
          getField("meesho_order_id").trim() || null,

        meesho_order_status:
          getField("meesho_order_status"),

        meesho_tracking_url:
          getField("meesho_tracking_url").trim() || null,

        expected_margin:
          expected === "" ? null : Number(expected),

        received_margin:
          received === "" ? null : Number(received),

        margin_payout_status:
          getField("margin_payout_status"),

        delivered_at:
          fromDateTimeLocal(getField("delivered_at")),

        margin_received_at:
          fromDateTimeLocal(getField("margin_received_at"))
      };

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      const order = orders.find(o => o.id === id);

      if (order) {
        Object.assign(order, updates);
      }

      notice(
        "ordersNotice",
        "Order and Meesho details saved successfully."
      );

    } catch (err) {
      notice(
        "ordersNotice",
        err.message || "Could not update order.",
        true
      );

    } finally {
      button.disabled = false;
  }
