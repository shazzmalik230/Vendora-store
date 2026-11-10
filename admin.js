
  // AUTHENTICATION AND DASHBOARD

  let dashboardLoading = false;

  async function showDashboard(session) {
    if (!session) {
      loginPanel.style.display = "block";
      dashboard.style.display = "none";
      return;
    }

    loginPanel.style.display = "none";
    dashboard.style.display = "block";

    if (dashboardLoading) return;

    dashboardLoading = true;

    try {
      await loadProducts();
      await loadOrders();
    } catch (err) {
      console.error("Dashboard loading error:", err);
      notice(
        "listNotice",
        "Could not load admin data: " + (err.message || err),
        true
      );
    } finally {
      dashboardLoading = false;
    }
  }

  async function init() {
    try {
      if (
        !cfg.supabaseUrl ||
        !cfg.supabasePublishableKey ||
        !window.supabase?.createClient
      ) {
        $("setupWarning").classList.remove("hidden");
        loginPanel.classList.add("hidden");
        return;
      }

      supabase = window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabasePublishableKey
      );

      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      await showDashboard(data.session);

    } catch (err) {
      console.error("Initialization error:", err);
      notice("loginNotice", err.message || "Admin initialization failed.", true);
    }
  }

  // EVENT LISTENERS

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    clearNotice("loginNotice");

    const button = $("loginButton");
    button.disabled = true;

    try {
      const email = $("email").value.trim();
      const password = $("password").value;

      if (!email || !password) {
        throw new Error("Enter your email and password.");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (!data.session) throw new Error("No active login session received.");

      await showDashboard(data.session);

    } catch (err) {
      console.error("Login error:", err);
      notice("loginNotice", err.message || "Login failed.", true);

    } finally {
      button.disabled = false;
    }
  });

  $("logoutButton").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      notice("listNotice", error.message, true);
      return;
    }

    products = [];
    orders = [];
    loginPanel.style.display = "block";
    dashboard.style.display = "none";
    $("password").value = "";
  });

  $("productForm").addEventListener("submit", saveProduct);
  $("resetButton").addEventListener("click", resetForm);

  $("sellingPrice").addEventListener("input", updateProfit);
  $("supplierCost").addEventListener("input", updateProfit);

  $("refreshButton").addEventListener("click", async () => {
    try {
      await loadProducts();
      notice("listNotice", "Product list refreshed.");
    } catch (err) {
      notice("listNotice", err.message, true);
    }
  });

  $("refreshOrdersButton").addEventListener("click", async () => {
    try {
      await loadOrders();
      notice("ordersNotice", "Orders refreshed.");
    } catch (err) {
      notice("ordersNotice", err.message, true);
    }
  });

  $("orderSearch").addEventListener("input", renderOrders);
  $("orderStatusFilter").addEventListener("change", renderOrders);
  $("payoutStatusFilter").addEventListener("change", renderOrders);

  $("clearOrderFilters").addEventListener("click", () => {
    $("orderSearch").value = "";
    $("orderStatusFilter").value = "";
    $("payoutStatusFilter").value = "";
    renderOrders();
    clearNotice("ordersNotice");
  });

  $("exportOrdersButton").addEventListener("click", exportOrdersCsv);

  init();
})();
