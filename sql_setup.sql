PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
	stock INTEGER NOT NULL CHECK(stock >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	buyer_name TEXT NOT NULL,
	product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
	quantity INTEGER NOT NULL CHECK(quantity > 0),
	status TEXT NOT NULL,
	created_at TEXT NOT NULL
);

-- Seed data
INSERT INTO products (name, description, price_cents, stock) VALUES
('Wireless Mouse', '2.4G ergonomic wireless mouse with USB receiver', 1999, 25),
('Mechanical Keyboard', 'RGB backlit mechanical keyboard with blue switches', 5999, 15),
('USB-C Hub', '7-in-1 USB-C hub with 4K HDMI and PD charging', 3499, 30);