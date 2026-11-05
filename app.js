(() => {
 const products = window.VENDORA_PRODUCTS || [];
 const cfg = window.VENDORA_CONFIG || {};
 const $ = s => document.querySelector(s);
 const money = n => new Intl.NumberFormat(cfg.currencyLocale || "en-IN",{style:"currency",currency:cfg.currency||"INR",maximumFractionDigits:0}).format(n);
 let cart = JSON.parse(localStorage.getItem("vendora-cart") || "[]");
 let activeQuery = "";
 let activeCategory = "All";
 const grid=$("#product-grid"), toast=$("#toast");
 const escapeHtml = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function notify(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove("show"),2300)}
 function saveCart(){localStorage.setItem("vendora-cart",JSON.stringify(cart));renderCart()}
 function productById(id){return products.find(p=>p.id.toLowerCase()===id.toLowerCase())}
 function productCard(p){return `<article class="product-card" data-open="${p.id}"><div class="product-visual" style="--tone:${p.tone}"><span class="product-badge">${escapeHtml(p.badge||p.category)}</span><span class="product-emoji">${p.emoji}</span><button class="quick-add" data-action="${p.type==="affiliate"?"partner":"add"}" data-id="${p.id}">${p.type==="affiliate"?"View on partner site ↗":"Quick add +"}</button></div><div class="product-info"><div class="product-info-top"><div><h3>${escapeHtml(p.name)}</h3><span class="product-id">${p.id}</span></div><span class="product-price">${money(p.price)}</span></div><div class="product-kind">${p.type==="affiliate"?"Affiliate pick · Partner checkout":"Direct order · Supplier fulfilment"}</div></div></article>`}
 function renderProducts(){
   let list=products.filter(p=>(activeCategory==="All"||p.category===activeCategory)&&(p.name+" "+p.id+" "+p.category).toLowerCase().includes(activeQuery));
   const sort=$("#sort-filter")?.value;
   if(sort==="low")list.sort((a,b)=>a.price-b.price);if(sort==="high")list.sort((a,b)=>b.price-a.price);
   grid.innerHTML=list.map(productCard).join("");$("#empty-state").hidden=list.length>0;
 }
 function showProduct(p){
   const modal=$("#product-modal");
   $("#modal-content").innerHTML=`<div class="modal-layout"><div class="modal-art" style="--tone:${p.tone}">${p.emoji}</div><div class="modal-details"><span class="eyebrow">${escapeHtml(p.category)} / ${p.id}</span><h2>${escapeHtml(p.name)}</h2><span class="modal-id">${p.type==="affiliate"?"AFFILIATE PARTNER PRODUCT":"DIRECT SUPPLIER PRODUCT"}</span><div class="modal-price">${money(p.price)} ${p.compareAt?`<del style="font-size:12px;color:#9aa2a0;font-weight:400;margin-left:7px">${money(p.compareAt)}</del>`:""}</div><p>${escapeHtml(p.description)}</p><p><b>Product ID:</b> ${p.id}</p><div class="modal-actions">${p.type==="affiliate"?`<a class="btn btn-dark" href="${escapeHtml(p.partnerUrl||"#")}" target="_blank" rel="noopener sponsored" id="partner-link">Continue to partner ↗</a>`:`<button class="btn btn-dark" id="modal-add">Add to bag +</button><button class="btn" style="background:#e9eee8" id="modal-order">Order via WhatsApp ↗</button>`}</div><p class="tiny-note">${p.type==="affiliate"?"Affiliate purchase and fulfilment happen on the partner website. Availability and final price may change there.":"Supplier availability, delivery fee, payment method and return terms must be confirmed before order acceptance."}</p></div></div>`;
   if(p.type==="direct"){$("#modal-add").onclick=()=>{addToCart(p.id);modal.close()};$("#modal-order").onclick=()=>{modal.close();sendWhatsApp([{id:p.id,qty:1}])}}
   modal.showModal();
 }
 function addToCart(id){const p=productById(id);if(!p||p.type!=="direct"){notify("Affiliate items are purchased on the partner site.");return}let row=cart.find(x=>x.id===id);if(row)row.qty++;else cart.push({id,qty:1});saveCart();notify("Added to your bag.")}
 function renderCart(){
   const count=cart.reduce((s,x)=>s+x.qty,0);$("#cart-count").textContent=count;$("#drawer-count").textContent=`(${count})`;
   const valid=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);
   $("#cart-items").innerHTML=valid.length?valid.map(({id,qty,p})=>`<div class="cart-row"><div class="cart-thumb" style="background:${p.tone}">${p.emoji}</div><div><h4>${escapeHtml(p.name)}</h4><small>${p.id} · ${money(p.price)}</small><div class="qty-controls"><button data-qty="-1" data-id="${id}">−</button><span>${qty}</span><button data-qty="1" data-id="${id}">+</button></div></div><button class="remove" data-remove="${id}">Remove</button></div>`).join(""):`<p style="color:#7c8988;font-size:12px;padding:25px 0">Your bag is waiting for a good find.</p>`;
   $("#cart-subtotal").textContent=money(valid.reduce((s,x)=>s+x.p.price*x.qty,0));
 }
 function openCart(){$("#cart-drawer").classList.add("open");$("#overlay").classList.add("show");$("#cart-drawer").setAttribute("aria-hidden","false")}
 function closeCart(){$("#cart-drawer").classList.remove("open");$("#overlay").classList.remove("show");$("#cart-drawer").setAttribute("aria-hidden","true")}
 function sendWhatsApp(items){
   const number=(cfg.whatsappNumber||"").replace(/\D/g,"");
   if(!number||number.includes("XXXXXXXX")){notify("Set your WhatsApp number in config.js before accepting orders.");return}
   const lines=items.map(x=>{const p=productById(x.id);return `${p.name} (${p.id}) x ${x.qty} — ${money(p.price*x.qty)}`});
   const total=items.reduce((s,x)=>s+productById(x.id).price*x.qty,0);
   const msg=`Hello ${cfg.brand||"BUSYKART"}, I want to enquire/place an order:\n${lines.join("\n")}\nEstimated product total: ${money(total)}\nPlease confirm stock, shipping, payment and return terms.`;
   window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
 }
 grid.addEventListener("click",e=>{
   const action=e.target.closest("[data-action]");
   if(action){e.stopPropagation();const p=productById(action.dataset.id);if(action.dataset.action==="add")addToCart(p.id);else if(p?.partnerUrl)window.open(p.partnerUrl,"_blank","noopener");else notify("Add an approved affiliate URL in products.js.");return}
   const card=e.target.closest("[data-open]");if(card){const p=productById(card.dataset.open);if(p)showProduct(p)}
 });
 document.addEventListener("click",e=>{
   const q=e.target.closest("[data-qty]");if(q){const row=cart.find(x=>x.id===q.dataset.id);if(row){row.qty+=Number(q.dataset.qty);if(row.qty<=0)cart=cart.filter(x=>x.id!==row.id);saveCart()}}
   const r=e.target.closest("[data-remove]");if(r){cart=cart.filter(x=>x.id!==r.dataset.remove);saveCart()}
   const cat=e.target.closest("[data-category],[data-nav-category]");if(cat){activeCategory=cat.dataset.category||cat.dataset.navCategory;$("#category-filter").value=activeCategory;renderProducts();$("#shop").scrollIntoView({behavior:"smooth"});$("#mobile-nav").classList.remove("open")}
 });
 $("#category-filter").onchange=e=>{activeCategory=e.target.value;renderProducts()};
 $("#sort-filter").onchange=renderProducts;
 function doSearch(value){const v=value.trim();if(!v)return;const p=productById(v);if(p){showProduct(p);return}activeQuery=v.toLowerCase();activeCategory="All";$("#category-filter").value="All";renderProducts();$("#shop").scrollIntoView({behavior:"smooth"})}
 $("#search-toggle").onclick=()=>{$("#search-bar").classList.toggle("open");$("#search-input").focus()};
 $("#search-submit").onclick=()=>doSearch($("#search-input").value);
 $("#search-input").addEventListener("keydown",e=>{if(e.key==="Enter")doSearch(e.target.value)});
 $("#id-search-form").onsubmit=e=>{e.preventDefault();const id=$("#id-search").value.trim();const p=productById(id);if(p)showProduct(p);else notify("We couldn't find that product ID.")};
 $("#cart-open").onclick=openCart;$("#cart-close").onclick=closeCart;$("#overlay").onclick=closeCart;
 $("#menu-toggle").onclick=()=>$("#mobile-nav").classList.toggle("open");
 $("#modal-close").onclick=()=>$("#product-modal").close();
 $("#checkout-btn").onclick=()=>{if(!cart.length){notify("Your bag is empty.");return}sendWhatsApp(cart);};
 $("#instagram-link").href=cfg.instagramUrl||"#";
 $("#year").textContent=new Date().getFullYear();
 renderProducts();renderCart();
})();