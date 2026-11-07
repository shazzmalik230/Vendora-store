(() => {
  "use strict";
  const cfg = window.VENDORA_CONFIG || {};
  const $ = id => document.getElementById(id);
  const loginPanel = $("loginPanel"), dashboard = $("dashboard");
  let supabase = null, products = [], sourcingByProduct = new Map();

  function notice(id, message, error=false) {
    const el = $(id); el.textContent = message; el.classList.toggle("error", error); el.style.display = "block";
  }
  function clearNotice(id) { const el=$(id); el.textContent=""; el.style.display="none"; el.classList.remove("error"); }
  function money(value) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value||0)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function updateProfit() {
    const sell = Number($("sellingPrice").value), cost = Number($("supplierCost").value);
    $("profitPreview").value = $("sellingPrice").value !== "" && $("supplierCost").value !== "" ? money(sell-cost) : "Enter both prices";
  }
  function resetForm() {
    $("productForm").reset(); $("productId").value=""; $("isActive").checked=true;
    $("formTitle").textContent="Add a product"; $("saveButton").textContent="Save product";
    $("profitPreview").value="Enter both prices"; clearNotice("formNotice");
  }
  async function loadProducts() {
    $("productRows").innerHTML='<tr><td colspan="7">Loading products...</td></tr>';
    const [pResult,sResult] = await Promise.all([
      supabase.from("products").select("id,sku,name,category,description,image_url,selling_price,compare_at_price,variants,is_active").order("created_at",{ascending:false}),
      supabase.from("product_sourcing").select("product_id,supplier_name,supplier_url,supplier_cost,internal_notes")
    ]);
    if (pResult.error) throw pResult.error;
    if (sResult.error) throw sResult.error;
    products=pResult.data||[];
    sourcingByProduct=new Map((sResult.data||[]).map(x=>[x.product_id,x]));
    renderProducts();
  }
  function renderProducts() {
    const body=$("productRows");
    if (!products.length) { body.innerHTML='<tr><td colspan="7">No products yet. Add your first product above.</td></tr>'; return; }
    body.innerHTML=products.map(p=>{
      const s=sourcingByProduct.get(p.id)||{}, sell=Number(p.selling_price||0), cost=Number(s.supplier_cost||0);
      return `<tr>
        <td><strong>${escapeHtml(p.name)}</strong><div class="small">${escapeHtml(p.category||"")}</div></td>
        <td>${escapeHtml(p.sku)}</td><td class="price">${money(sell)}</td>
        <td class="price">${s.supplier_cost==null?"—":money(cost)}</td>
        <td class="price">${s.supplier_cost==null?"—":money(sell-cost)}</td>
        <td><span class="status ${p.is_active?"on":""}">${p.is_active?"Active":"Hidden"}</span></td>
        <td><div class="actions" style="margin:0"><button class="secondary" data-edit="${p.id}" type="button">Edit</button><button class="secondary" data-toggle="${p.id}" type="button">${p.is_active?"Hide":"Publish"}</button></div></td>
      </tr>`;
    }).join("");
    body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
    body.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggleProduct(b.dataset.toggle)));
  }
  function editProduct(id) {
    const p=products.find(x=>x.id===id); if(!p)return;
    const s=sourcingByProduct.get(id)||{};
    $("productId").value=p.id; $("sku").value=p.sku||""; $("name").value=p.name||"";
    $("category").value=p.category||"Other"; $("imageUrl").value=p.image_url||"";
    $("description").value=p.description||""; $("sellingPrice").value=p.selling_price??"";
    $("comparePrice").value=p.compare_at_price??""; $("supplierName").value=s.supplier_name||"";
    $("supplierCost").value=s.supplier_cost??""; $("supplierUrl").value=s.supplier_url||"";
    $("internalNotes").value=s.internal_notes||"";
    $("variants").value=p.variants?JSON.stringify(p.variants,null,2):"";
    $("isActive").checked=!!p.is_active; $("formTitle").textContent="Edit product";
    $("saveButton").textContent="Update product"; updateProfit(); clearNotice("formNotice");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function saveProduct(event) {
    event.preventDefault(); clearNotice("formNotice");
    const button=$("saveButton"); button.disabled=true;
    try {
      let variants=null;
      if ($("variants").value.trim()) { variants=JSON.parse($("variants").value); }
      const payload={
        sku:$("sku").value.trim(), name:$("name").value.trim(), category:$("category").value,
        description:$("description").value.trim()||null, image_url:$("imageUrl").value.trim()||null,
        selling_price:Number($("sellingPrice").value),
        compare_at_price:$("comparePrice").value===""?null:Number($("comparePrice").value),
        variants, is_active:$("isActive").checked
      };
      let saved;
      if ($("productId").value) {
        const result=await supabase.from("products").update(payload).eq("id",$("productId").value).select("id").single();
        if(result.error)throw result.error; saved={id:result.data.id};
      } else {
        const result=await supabase.from("products").insert(payload).select("id").single();
        if(result.error)throw result.error; saved={id:result.data.id};
      }
      const sourcing={
        product_id:saved.id,
        supplier_name:$("supplierName").value.trim()||null,
        supplier_url:$("supplierUrl").value.trim()||null,
        supplier_cost:$("supplierCost").value===""?null:Number($("supplierCost").value),
        internal_notes:$("internalNotes").value.trim()||null
      };
      const sourceResult=await supabase.from("product_sourcing").upsert(sourcing,{onConflict:"product_id"});
      if(sourceResult.error) throw new Error("Product saved, but private sourcing details were not saved: "+sourceResult.error.message);
      notice("formNotice","Product and private sourcing details saved successfully.");
      resetForm(); await loadProducts();
    } catch(err) { notice("formNotice",err.message||"Could not save product.",true); }
    finally { button.disabled=false; }
  }
  async function toggleProduct(id) {
    const p=products.find(x=>x.id===id); if(!p)return;
    const {error}=await supabase.from("products").update({is_active:!p.is_active}).eq("id",id);
    if(error){notice("listNotice",error.message,true);return;}
    notice("listNotice",`Product ${!p.is_active?"published":"hidden"} successfully.`); await loadProducts();
  }
  async function showDashboard(session) {
    if(!session){loginPanel.style.display="block";dashboard.style.display="none";return;}
    loginPanel.style.display="none";dashboard.style.display="block";
    try { await loadProducts(); }
    catch(err) { notice("listNotice","Could not load admin data: "+(err.message||err),true); }
  }
  async function init() {
    if(!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase?.createClient){
      $("setupWarning").classList.remove("hidden"); loginPanel.classList.add("hidden"); return;
    }
    supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
    const {data:{session}}=await supabase.auth.getSession();
    await showDashboard(session);
    supabase.auth.onAuthStateChange((_event,session)=>{ showDashboard(session); });
  }
  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault(); clearNotice("loginNotice"); $("loginButton").disabled=true;
    const {error}=await supabase.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    $("loginButton").disabled=false;
    if(error)notice("loginNotice",error.message,true);
  });
  $("logoutButton").addEventListener("click",async()=>{await supabase.auth.signOut();});
  $("productForm").addEventListener("submit",saveProduct);
  $("resetButton").addEventListener("click",resetForm);
  $("refreshButton").addEventListener("click",async()=>{try{await loadProducts();notice("listNotice","Catalogue refreshed.");}catch(e){notice("listNotice",e.message,true);}});
  $("sellingPrice").addEventListener("input",updateProfit); $("supplierCost").addEventListener("input",updateProfit);
  init();
})();