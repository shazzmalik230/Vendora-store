# VENDORA starter storefront

A static, mobile-responsive storefront starter for a hybrid affiliate + direct-supplier social-commerce model.

## Included features
- Responsive home page and category navigation
- Product cards and product detail modal
- Search by product name or unique product ID
- Category and price sorting
- Local-storage cart for direct-supplier products
- WhatsApp order-enquiry handoff for direct products
- Separate outbound partner link for affiliate products
- Sample policy page and editable product catalogue

## Important limitations
This is a **front-end MVP**, not a complete production checkout:
- The WhatsApp order flow is an enquiry/handoff, not a confirmed order or payment.
- No customer database, inventory sync, payment gateway, order tracking, email receipts, seller portal or secure digital downloads are included.
- The sample products, prices, product descriptions and supplier costs are fictional placeholders.
- The sample affiliate links point to a generic marketplace homepage, not tracked affiliate links. Replace each with your own approved affiliate URL and follow that programme's rules.
- Direct supplier fulfilment must be agreed with the supplier. Confirm stock, final price, packaging, dispatch, tracking, returns, refunds and customer-data handling.
- Do not add payment gateway secret keys to front-end files.

## Configure before publishing
1. Open `config.js`.
2. Replace `whatsappNumber` with your business WhatsApp number in international digits only (example format: `919876543210`).
3. Replace `instagramUrl` with your real social profile.
4. Open `products.js` and replace all demo products, prices, copy, emojis, product IDs and links with verified listings.
5. For affiliate products, set `type: "affiliate"` and add your approved, tagged `partnerUrl`.
6. For direct products, set `type: "direct"` and confirm that the supplier authorises your resale/fulfilment model.
7. Replace the contact details and complete the legal policies in `policies.html`.

## Publish free with GitHub Pages
1. Create or sign in to a GitHub account.
2. Create a public repository, for example `vendora-store`.
3. Upload the contents of this folder (not the ZIP file itself) to the repository root.
4. In repository Settings → Pages, select deployment from the `main` branch and `/ (root)`.
5. Save. GitHub will provide a public `github.io` address after deployment.

You can also use Cloudflare Pages by connecting the repository and deploying the static files.

## Editing products
Each item in `products.js` has:
- `id`: unique SKU shown on the card and used by product ID search
- `name`, `category`, `price`, `compareAt`
- `type`: `affiliate` or `direct`
- `partnerUrl`: approved affiliate URL for affiliate items
- `description`, `emoji`, `tone`, `badge`

Categories currently supported: `Men`, `Women`, `Trending`, `Lifestyle`.

## Next production milestone
For genuine on-site checkout, build a backend that creates orders, validates prices and stock server-side, integrates an eligible payment gateway, securely stores customer information, and connects to a supplier fulfilment workflow. A static website alone cannot safely do those jobs.
