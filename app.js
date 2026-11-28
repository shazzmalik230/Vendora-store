(() => {
 let products = [];
 const cfg = window.VENDORA_CONFIG || {};
 const $ = s => document.querySelector(s);
 const money = n => new Intl.NumberFormat(cfg.currencyLocale || "en-IN",{style:"currency",currency:cfg.currency||"INR",maximumFractionDigits:0}).format(n);
 let cart = JSON.parse(localStorage.getItem("vendora-cart") || "[]");
 let supabaseClient = (window.supabase?.createClient && cfg.supabaseUrl && cfg.supabasePublishableKey) ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey) : null;
 let currentSession = null;
 let currentProfile = null;
 let checkoutItems = [];
 let activeQuery = "";
 let activeCategory = "All";
 let recentlyViewed = JSON.parse(localStorage.getItem("busykart-recent") || "[]");
 let soundEnabled = localStorage.getItem("busykart-sound") !== "off";
 let vibrationEnabled = localStorage.getItem("busykart-vibration") !== "off";
 const grid=$("#product-grid"), toast=$("#toast");
 const escapeHtml = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function feedback(kind="click"){
   if(soundEnabled){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){const ctx=new Ctx();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=kind==="success"?660:kind==="open"?520:420;gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(kind==="success"?0.045:0.025,ctx.currentTime+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.09);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.1);osc.onended=()=>ctx.close();}}catch(e){}}
   if(vibrationEnabled&&navigator.vibrate){try{navigator.vibrate(kind==="success"?[18,35,18]:kind==="open"?12:8)}catch(e){}}
 }
 function notify(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove("show"),2300)}
 function saveCart(){localStorage.setItem("vendora-cart",JSON.stringify(cart));renderCart()}
 function productById(id){return products.find(p=>p.id.toLowerCase()===id.toLowerCase())}
 function productCard(p){return `<article class="product-card" data-open="${p.id}"><div class="product-visual" style="--tone:${p.tone}">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:`<span class="product-emoji">${p.emoji}</span>`}<span class="product-badge">${escapeHtml(p.badge||p.category)}</span><button class="quick-add" data-action="add" data-id="${p.id}">Add to bag +</button></div><div class="product-info"><div class="product-info-top"><div><h3>${escapeHtml(p.name)}</h3><span class="product-id">${p.id}</span></div><span class="product-price">${money(p.price)}</span></div><div class="product-kind">${"BUSYKART selection · Order enquiry"}</div></div></article>`}
 function renderProducts(){
   let list=products.filter(p=>(activeCategory==="All"||p.category===activeCategory)&&(p.name+" "+p.id+" "+p.category).toLowerCase().includes(activeQuery));
   const sort=$("#sort-filter")?.value;
   if(sort==="low")list.sort((a,b)=>a.price-b.price);if(sort==="high")list.sort((a,b)=>b.price-a.price);
   grid.innerHTML=list.map(productCard).join("");$("#empty-state").hidden=list.length>0;
 }
 function showProduct(p){
   recentlyViewed=[p.id,...recentlyViewed.filter(id=>id!==p.id)].slice(0,12);
   localStorage.setItem("busykart-recent",JSON.stringify(recentlyViewed));
   feedback("open");
   const modal=$("#product-modal");
   $("#modal-content").innerHTML=`<div class="modal-layout"><div class="modal-art" style="--tone:${p.tone}">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover">`:p.emoji}</div><div class="modal-details"><span class="eyebrow">${escapeHtml(p.category)} / ${p.id}</span><h2>${escapeHtml(p.name)}</h2><span class="modal-id">BUSYKART PRODUCT</span><div class="modal-price">${money(p.price)} ${p.compareAt?`<del style="font-size:12px;color:#9aa2a0;font-weight:400;margin-left:7px">${money(p.compareAt)}</del>`:""}</div><p>${escapeHtml(p.description)}</p><p><b>Product ID:</b> ${p.id}</p><div class="modal-actions"><button class="btn btn-dark" id="modal-add">Add to bag +</button><button class="btn" style="background:#e9eee8" id="modal-order">Buy now ↗</button></div><p class="tiny-note">Supplier availability, delivery fee, payment method and return terms must be confirmed before order acceptance.</p></div></div>`;
   $("#modal-add").onclick=()=>{addToCart(p.id);modal.close()};$("#modal-order").onclick=()=>{modal.close();openCheckout([{id:p.id,qty:1}])}
   modal.showModal();
 }
 function addToCart(id){const p=productById(id);if(!p){notify("This product is no longer available.");return}let row=cart.find(x=>x.id===id);if(row)row.qty++;else cart.push({id,qty:1});saveCart();feedback("success");notify("Added to your bag.")}
 function renderCart(){
   const count=cart.reduce((s,x)=>s+x.qty,0);$("#cart-count").textContent=count;$("#drawer-count").textContent=`(${count})`;
   const valid=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);
   $("#cart-items").innerHTML=valid.length?valid.map(({id,qty,p})=>`<div class="cart-row"><div class="cart-thumb" style="background:${p.tone}">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`:p.emoji}</div><div><h4>${escapeHtml(p.name)}</h4><small>${p.id} · ${money(p.price)}</small><div class="qty-controls"><button data-qty="-1" data-id="${id}">−</button><span>${qty}</span><button data-qty="1" data-id="${id}">+</button></div></div><button class="remove" data-remove="${id}">Remove</button></div>`).join(""):`<p style="color:#7c8988;font-size:12px;padding:25px 0">Your bag is waiting for a good find.</p>`;
   $("#cart-subtotal").textContent=money(valid.reduce((s,x)=>s+x.p.price*x.qty,0));
 }
 function openProfile(){closeCart();$("#profile-drawer").classList.add("open");$("#overlay").classList.add("show");$("#profile-drawer").setAttribute("aria-hidden","false")}
 function closeProfile(){$("#profile-drawer").classList.remove("open");$("#profile-drawer").setAttribute("aria-hidden","true");if(!$("#cart-drawer").classList.contains("open"))$("#overlay").classList.remove("show")}
 function openCart(){closeProfile();$("#cart-drawer").classList.add("open");$("#overlay").classList.add("show");$("#cart-drawer").setAttribute("aria-hidden","false")}
 function closeCart(){$("#cart-drawer").classList.remove("open");$("#cart-drawer").setAttribute("aria-hidden","true");if(!$("#profile-drawer").classList.contains("open"))$("#overlay").classList.remove("show")}

 function setAccountMessage(id,text,isError=false){
   const el=$(id);if(!el)return;el.textContent=text;el.classList.toggle("error",!!isError);
 }
 function renderAccount(session){
   currentSession=session||null;
   const signedIn=!!currentSession?.user;
   $("#account-signed-out").hidden=signedIn;
   $("#account-signed-in").hidden=!signedIn;
   $("#account-greeting").textContent=signedIn?(currentProfile?.full_name||"Welcome back!"):"Hello, Shopper!";
   $("#account-subtitle").textContent=signedIn?"Your BUSYKART account":"Your everyday shopping space";
   if(signedIn){
     $("#account-email-label").textContent=currentSession.user.email||"Signed-in customer";
     $("#account-name").value=currentProfile?.full_name||"";
     $("#account-phone").value=currentProfile?.phone||"";
   }
 }
 async function loadCustomerAccount(session){
   currentSession=session||null;currentProfile=null;
   if(!session?.user){renderAccount(null);return}
   const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
   if(error)console.warn("Could not load customer profile:",error.message);
   currentProfile=data||null;
   renderAccount(session);
 }
 async function loadCustomerOrders(){
   const area=$("#account-orders");
   if(!currentSession?.user){area.innerHTML='<p class="account-muted">Sign in to view your orders.</p>';return}
   area.innerHTML='<p class="account-muted">Loading your orders...</p>';
   const {data,error}=await supabaseClient.from("orders").select("*").eq("user_id",currentSession.user.id).order("created_at",{ascending:false}).limit(30);
   if(error){console.error(error);area.innerHTML='<p class="account-muted">Orders could not be loaded. Please try again.</p>';return}
   if(!data?.length){area.innerHTML='<p class="account-muted">No orders are linked to this account yet. Orders placed while signed out will not appear here.</p>';return}
   area.innerHTML=data.map(order=>{
     const title=escapeHtml(order.product_name||order.product_sku||"BUSYKART order");
     const date=order.created_at?new Date(order.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Date unavailable";
     const amount=Number(order.total_amount||order.unit_price||0);
     const status=escapeHtml(order.status||"Received");
     const tracking=typeof order.meesho_tracking_url==="string"&&/^https?:\/\//i.test(order.meesho_tracking_url)?`<a href="${escapeHtml(order.meesho_tracking_url)}" target="_blank" rel="noopener">Track order ↗</a>`:"";
     return `<article class="account-order"><strong>${title}</strong><small>${date} · Qty ${Number(order.quantity||1)} · ${money(amount)}<br>Status: ${status}</small>${tracking}</article>`;
   }).join("");
 }
 async function initCustomerAuth(){
   if(!supabaseClient){$("#account-email-form").querySelector("button").disabled=true;setAccountMessage("#account-auth-message","Account service is not configured.",true);return}
   const {data,error}=await supabaseClient.auth.getSession();
   if(error)console.warn("Could not read login session:",error.message);
   await loadCustomerAccount(data?.session||null);
   supabaseClient.auth.onAuthStateChange((event,session)=>{
     currentSession=session||null;
     if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="INITIAL_SESSION"){
       loadCustomerAccount(session).catch(err=>console.error(err));
     }else if(event==="SIGNED_OUT"){currentProfile=null;renderAccount(null);$("#account-orders").hidden=true;}
   });
 }
 async function requestCustomerOtp(event){
   event.preventDefault();
   const email=$("#account-email").value.trim().toLowerCase(),button=$("#account-send-code");
   if(!email)return;
   button.disabled=true;button.textContent="Sending...";
   setAccountMessage("#account-auth-message","");
   try{
     const {error}=await supabaseClient.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:window.location.origin+"/"}});
     if(error)throw error;
     $("#account-email").value=email;
     $("#account-otp-form").hidden=false;
     $("#account-otp").focus();
     setAccountMessage("#account-auth-message","A verification code has been sent to your email. Check your inbox and spam folder.");
   }catch(err){console.error(err);setAccountMessage("#account-auth-message",err.message||"Could not send the code. Please try again.",true)}
   finally{button.disabled=false;button.textContent="Send OTP"}
 }
 async function verifyCustomerOtp(event){
   event.preventDefault();
   const email=$("#account-email").value.trim().toLowerCase(),token=$("#account-otp").value.trim(),button=$("#account-verify-code");
   if(!/^[0-9]{6}$/.test(token)){setAccountMessage("#account-auth-message","Enter the 6-digit code from your email.",true);return}
   button.disabled=true;button.textContent="Verifying...";
   try{
     const {data,error}=await supabaseClient.auth.verifyOtp({email,token,type:"email"});
     if(error)throw error;
     await loadCustomerAccount(data.session);
     $("#account-otp-form").hidden=true;$("#account-otp").value="";
     setAccountMessage("#account-auth-message","");
     notify("You are signed in to BUSYKART.");
   }catch(err){console.error(err);setAccountMessage("#account-auth-message",err.message||"The code could not be verified. Request a new code.",true)}
   finally{button.disabled=false;button.textContent="Verify and sign in"}
 }
 async function saveCustomerProfile(event){
   event.preventDefault();
   if(!currentSession?.user)return;
   const button=event.submitter||event.currentTarget.querySelector("button[type=submit]");
   if(button){button.disabled=true;button.textContent="Saving..."}
   const record={id:currentSession.user.id,email:currentSession.user.email,full_name:$("#account-name").value.trim(),phone:$("#account-phone").value.trim(),updated_at:new Date().toISOString()};
   try{
     const {data,error}=await supabaseClient.from("profiles").upsert(record,{onConflict:"id"}).select().single();
     if(error)throw error;
     currentProfile=data;renderAccount(currentSession);
     setAccountMessage("#account-profile-message","Profile saved.");
   }catch(err){console.error(err);setAccountMessage("#account-profile-message",err.message||"Could not save your profile.",true)}
   finally{if(button){button.disabled=false;button.textContent="Save profile"}}
 }
 async function signOutCustomer(){
   const {error}=await supabaseClient.auth.signOut();
   if(error){setAccountMessage("#account-profile-message",error.message,true);return}
   currentSession=null;currentProfile=null;renderAccount(null);$("#account-orders").hidden=true;
   notify("You have signed out.");
 }
 function sendWhatsApp(items){
   const number=(cfg.whatsappNumber||"").replace(/\D/g,"");
   if(!number||number.includes("XXXXXXXX")){notify("Set your WhatsApp number in config.js before accepting orders.");return}
   const lines=items.map(x=>{const p=productById(x.id);return `${p.name} (${p.id}) x ${x.qty} — ${money(p.price*x.qty)}`});
   const total=items.reduce((s,x)=>s+productById(x.id).price*x.qty,0);
   const msg=`Hello ${cfg.brand||"BUSYKART"}, I want to enquire/place an order:\n${lines.join("\n")}\nEstimated product total: ${money(total)}\nPlease confirm stock, shipping, payment and return terms.`;
   window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
 }
 function openCheckout(items){
   checkoutItems=items.map(x=>({id:x.id,qty:x.qty}));
   const rows=checkoutItems.map(x=>{const p=productById(x.id);return p?`${escapeHtml(p.name)} × ${x.qty} · ${money(p.price*x.qty)}`:""}).filter(Boolean);
   const total=checkoutItems.reduce((sum,x)=>{const p=productById(x.id);return sum+(p?p.price*x.qty:0)},0);
   $("#checkout-summary").innerHTML=rows.join("<br>")+`<hr><strong>Estimated product total: ${money(total)}</strong>`;
   $("#checkout-message").textContent="";$("#checkout-message").className="checkout-message";
   $("#checkout-modal").showModal();
 }
 async function submitOrders(event){
   event.preventDefault();
  const formElement = event.currentTarget;
   const message=$("#checkout-message"), button=$("#place-order-btn");
   message.textContent="";message.className="checkout-message";
   if(!supabaseClient){message.textContent="Order service is not configured. Please contact BUSYKART.";message.classList.add("error");return;}
   const form=new FormData(event.currentTarget), customer={};
   ["customer_name","phone","email","address_line","city","state","postal_code","customer_note"].forEach(k=>customer[k]=(form.get(k)||"").trim());
   if(!/^[+]?[0-9 ()-]{10,18}$/.test(customer.phone)){message.textContent="Enter a valid mobile number.";message.classList.add("error");return;}
   if(!/^[0-9]{6}$/.test(customer.postal_code)){message.textContent="Enter a valid 6-digit PIN code.";message.classList.add("error");return;}
   button.disabled=true;button.textContent="Submitting...";
   try{
     const {data:sessionData}=await supabaseClient.auth.getSession();
     const signedInUser=sessionData?.session?.user||null;
     const orderCustomer={...customer};
     if(signedInUser&&!orderCustomer.email)orderCustomer.email=signedInUser.email||"";
     const payload=checkoutItems.map(item=>{const p=productById(item.id);return {product_id:p.databaseId,quantity:item.qty,selected_variant:{},...orderCustomer,user_id:signedInUser?.id||null};});
     if(payload.some(x=>!x.product_id))throw new Error("A product could not be verified. Refresh the page and try again.");
     const {error}=await supabaseClient.from("orders").insert(payload);
     if(error)throw error;
     message.textContent="Order request received. BUSYKART will contact you to confirm availability and delivery.";
     message.classList.add("success");
     feedback("success");
     cart=[];saveCart();localStorage.removeItem("vendora-cart");
     formElement.reset();
     checkoutItems=[];
   }catch(err){console.error(err);message.textContent=err.message||"We could not submit your order. Please try again.";message.classList.add("error");}
   finally{button.disabled=false;button.textContent="Submit order request ↗";}
 }
 grid.addEventListener("click",e=>{
   const action=e.target.closest("[data-action]");
   if(action){e.stopPropagation();const p=productById(action.dataset.id);if(action.dataset.action==="add"&&p)addToCart(p.id);return}
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
 $("#cart-open").onclick=openCart;$("#cart-close").onclick=closeCart;$("#overlay").onclick=()=>{closeCart();closeProfile()};
 $("#profile-open").onclick=openProfile;$("#profile-close").onclick=closeProfile;
 $("#account-email-form").addEventListener("submit",requestCustomerOtp);
 $("#account-otp-form").addEventListener("submit",verifyCustomerOtp);
 $("#account-change-email").onclick=()=>{$("#account-otp-form").hidden=true;$("#account-otp").value="";setAccountMessage("#account-auth-message","Enter the email address you want to use.");$("#account-email").focus()};
 $("#account-profile-form").addEventListener("submit",saveCustomerProfile);
 $("#account-signout").onclick=signOutCustomer;
 $("#account-orders-toggle").onclick=()=>{const panel=$("#account-orders");panel.hidden=!panel.hidden;if(!panel.hidden)loadCustomerOrders()};
 $("#sound-toggle").checked=soundEnabled;$("#vibration-toggle").checked=vibrationEnabled;
 $("#sound-toggle").onchange=e=>{soundEnabled=e.target.checked;localStorage.setItem("busykart-sound",soundEnabled?"on":"off");if(soundEnabled)feedback("success")};
 $("#vibration-toggle").onchange=e=>{vibrationEnabled=e.target.checked;localStorage.setItem("busykart-vibration",vibrationEnabled?"on":"off");if(vibrationEnabled)feedback("success")};
 $("#profile-drawer").addEventListener("click",e=>{
   const action=e.target.closest("[data-profile-action]");
   const category=e.target.closest("[data-profile-category]");
   if(category){activeCategory=category.dataset.profileCategory;$("#category-filter").value=activeCategory;activeQuery="";renderProducts();closeProfile();$("#shop").scrollIntoView({behavior:"smooth"});return}
   if(!action)return;
   const key=action.dataset.profileAction;
   closeProfile();
   if(key==="bag")openCart();
   if(key==="find"){$("#search-bar").classList.add("open");$("#search-input").focus()}
   if(key==="issue"){window.open(`https://wa.me/${(cfg.whatsappNumber||"").replace(/\D/g,"")}?text=${encodeURIComponent("Hello BUSYKART, I need help with an issue.")}`,"_blank","noopener")}
   if(key==="recent"){
     const recent=recentlyViewed.map(productById).filter(Boolean);
     if(!recent.length){notify("Your recently viewed list is empty.");return}
     activeQuery="";activeCategory="All";$("#category-filter").value="All";renderProducts();
     grid.innerHTML=recent.map(productCard).join("");$("#shop").scrollIntoView({behavior:"smooth"});
   }
 });
 document.addEventListener("click",e=>{if(e.target.closest(".btn,.icon-btn,.category-tile,.profile-links button")&&!e.target.closest(".quick-add"))feedback("click")});
 $("#menu-toggle").onclick=()=>$("#mobile-nav").classList.toggle("open");
 $("#modal-close").onclick=()=>$("#product-modal").close();
 $("#checkout-btn").onclick=()=>{if(!cart.length){notify("Your bag is empty.");return}closeCart();openCheckout(cart)};
 $("#checkout-close").onclick=()=>$("#checkout-modal").close();
 $("#checkout-form").addEventListener("submit",submitOrders);
 $("#instagram-link").href=cfg.instagramUrl||"#";
 $("#year").textContent=new Date().getFullYear();
 renderCart();
 initCustomerAuth().catch(err=>console.error("Customer account initialization failed:",err));
 async function loadProducts(){
   const key=cfg.supabasePublishableKey, url=cfg.supabaseUrl;
   if(!key||!url){grid.innerHTML="<p>Store catalogue is not configured yet.</p>";return}
   try{
     const response=await fetch(`${url}/rest/v1/products?select=*&is_active=eq.true&order=created_at.desc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
     if(!response.ok)throw new Error(`Catalogue request failed (${response.status})`);
     const rows=await response.json();
     products=rows.map(r=>({databaseId:r.id,id:r.sku||r.id,name:r.name,category:r.category||"Lifestyle",price:Number(r.selling_price||0),compareAt:r.compare_at_price?Number(r.compare_at_price):null,type:"direct",emoji:"✳",tone:"#e4e9e4",badge:"BUSYKART PICK",description:r.description||"",imageUrl:r.image_url||""})).filter(p=>p.id&&p.name&&p.price>=0);
     const stored=JSON.parse(localStorage.getItem("vendora-cart")||"[]");
     cart=stored.filter(item=>products.some(p=>p.id===item.id));
     renderProducts();renderCart();
     if(!products.length){grid.innerHTML="<p class=\"empty-state\">New finds are being added. Please check back soon.</p>";}
   }catch(err){console.error(err);grid.innerHTML="<p>We couldn't load the catalogue. Please try again later.</p>";notify("Unable to load products from the store catalogue.")}
 }
 loadProducts();
})();
