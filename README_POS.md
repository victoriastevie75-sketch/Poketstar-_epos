Poketstar POS — Starter scaffold

Features included:
- Products & inventory (add/edit/remove)
- Sales: cart, discounts, tax (example: 16% VAT), receipts
- Kenyan Shilling (KES) currency formatting across UI
- Local persistence via localStorage (client) + optional server endpoints
- Simple Node/Express server endpoints for products and sales (file-backed)
- Exportable sales JSON for reporting
- Barcode/SKU entry (typed or scanned)
- Print-friendly receipt

Next steps to production:
- Replace file JSON persistence with a database (Postgres / MongoDB / Firebase)
- Add user authentication and roles (cashier, manager)
- Integrate payments (M-Pesa APIs for Kenya, or card via Stripe/PayPal)
- Add offline sync strategy (service worker + background sync)
- Add tests, CI, and Docker deployment notes
