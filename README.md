# CartNest (Firebase REST + Axios + jQuery)
The application name lives in one place: `APP_NAME` in js/config.js.

## 1. Firebase setup
1. console.firebase.google.com > Add project (Analytics not needed).
2. Build > Authentication > Get started > enable Email/Password.
3. Build > Realtime Database > Create database > start in locked mode.
4. Realtime Database > Rules: paste firebase.rules.json, replace admin@shop.com with your admin email, Publish.
5. Project settings > General > Your apps > add a Web app (</>). Copy `apiKey`.
6. Copy the database URL from the Realtime Database page (https://<project>-default-rtdb.firebaseio.com).
7. Edit js/config.js: API_KEY, DB_URL, ADMIN_EMAIL (same as in the rules).
8. Authentication > Settings > Authorized domains: add <username>.github.io.

## 2. Run locally
Serve the folder (e.g. `npx serve .` or VS Code Live Server) and open index.html.
Sign up with ADMIN_EMAIL first: that account lands on admin.html. Everyone else is a customer.

## 2b. Sample data and images
In the Firebase console open Realtime Database, hover the `categories` node (create it if empty), choose Import JSON and pick data/categories.json. Do the same for `products` with data/products.json. Import each file on its own node, never at the root, or you would overwrite customers and orders.
Images are Unsplash links stored in each record's `image` field. `placeholder` points to a local SVG in img/ that is shown if the link fails or is empty.
Admins can change an image any time: Admin > Categories/Inventory > Edit > paste a new image link.

## 3. Optional emails (EmailJS, public key only)
Create an EmailJS service and a template using {{to_email}}, {{to_name}}, {{subject}}, {{message}}.
Put serviceId, templateId and publicKey in config.js. Restrict the key to your Pages domain in EmailJS.
Password-reset emails come from Firebase itself.

## 4. Deploy
Push to GitHub (branch main), Settings > Pages > Source: GitHub Actions. The workflow checks JS syntax and deploys.

## Known limits (mention in your report)
- Stock is reduced from the browser (rules only require qty >= 0), a Cloud Function would be stricter.
- Order totals are computed in the browser; rules stop edits to existing orders but cannot recompute prices.
- Credit used = sum of that customer's credit orders (no repayment feature in the spec).
- Credit allowed = min(admin credit limit, 1000).
