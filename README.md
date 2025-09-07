# Marketplace Demo (Flask + SQLite)

## Quick start

1. Create and activate a virtual environment (optional but recommended)
```bash
python3 -m venv .venv && source .venv/bin/activate
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Run the app
```bash
python app.py
```

- The app listens on http://localhost:5000
- On first run, if `app.db` does not exist, `sql_setup.sql` is executed to create schema and seed products.

## Endpoints
- GET `/api/products` — list products
- POST `/api/orders` — place order: `{ buyer_name, product_id, quantity }`
- GET `/api/orders` — list orders (seller view)
- PATCH `/api/orders/:id/status` — update order status to one of: `order placed | packed | dispatched | completed`
- PATCH `/api/products/:id/stock` — set product stock

## Notes
- Client-side validation complements server-side validation.
- Prices are stored in `price_cents` to avoid floating point issues.
