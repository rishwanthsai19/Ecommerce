// Fill these in after creating your Firebase project (see README.md)
const CONFIG = {
  APP_NAME: "CartNest",            // shown in every header, the page titles and the About page
  TAGLINE: "Everything you need, delivered to your nest.",
  API_KEY: "AIzaSyDRRQSAVxDyQVsZlaUzH-ghRRctCXjPlyM",
  DB_URL: "https://onlineshopping-410b4-default-rtdb.firebaseio.com", // no trailing slash
  ADMIN_EMAIL: "admin@shop.com",   // must match the email used in firebase.rules.json
  CREDIT_CAP: 1000,                // the "discussed" credit-limit rule
  PAGE_SIZE: 5,                    // admin tables
  SHOP_PAGE_SIZE: 8,               // product cards per page in the shop
  // Optional: EmailJS public settings (safe for browsers). Leave publicKey empty to skip emails.
  EMAILJS: { serviceId: "", templateId: "", publicKey: "" }
};
