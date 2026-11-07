BUSYKART ADMIN DASHBOARD

Files:
- admin.html
- admin.js

What it does:
- Uses the existing config.js and its Supabase project URL + publishable key.
- Admin sign-in with Supabase Auth.
- Add and edit public product information.
- Save supplier name, supplier URL, supplier cost and internal notes in product_sourcing.
- Show/hide products on the public storefront.
- Calculate estimated gross profit (selling price minus supplier cost).

Install:
1. Download and extract this ZIP.
2. In your GitHub repository, use Add file > Upload files.
3. Upload admin.html and admin.js to the repository root, at the same level as index.html and config.js.
4. Commit the files.
5. Open https://busykart.store/admin.html after GitHub Pages deploys.

Important:
- Do not upload a Supabase secret key. The existing config.js should contain only the project URL and publishable key.
- The publishable key is intended for browser use only when Row Level Security policies are correctly configured.
- Keep supplier links/costs in product_sourcing. Do not add those fields to the public products table.
- This first version uses an image URL. Image upload/storage can be added later.
- Do not accept customer payments through this dashboard. Secure checkout requires server-side payment order creation and verification.

Database assumptions:
- products has: id, sku, name, category, description, image_url, selling_price, compare_at_price, variants, is_active, created_at.
- product_sourcing has: product_id (unique/primary key), supplier_name, supplier_url, supplier_cost, internal_notes.
- Existing RLS policies allow authenticated BUSYKART admins to select/insert/update products and product_sourcing.
If a save or list operation reports a permission or missing-column error, stop and share the exact error. Do not disable RLS to make it work.
