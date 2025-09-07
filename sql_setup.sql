PRAGMA foreign_keys = ON;

-- Products available for sale
CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	description TEXT,
	price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
	stock INTEGER NOT NULL CHECK(stock >= 0),
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders placed by buyers
CREATE TABLE IF NOT EXISTS orders (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	customer_name TEXT NOT NULL,
	address TEXT NOT NULL,
	status TEXT NOT NULL CHECK(status IN ('order_placed', 'packed', 'dispatched', 'completed')) DEFAULT 'order_placed',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual items in an order
CREATE TABLE IF NOT EXISTS order_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL,
	product_id INTEGER NOT NULL,
	quantity INTEGER NOT NULL CHECK(quantity > 0),
	price_cents_at_order INTEGER NOT NULL CHECK(price_cents_at_order >= 0),
	FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
	FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Seed a few sample products if table is empty
INSERT INTO products (name, description, price_cents, stock)
SELECT 'Widget A', 'Basic widget', 1299, 50
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO products (name, description, price_cents, stock)
SELECT 'Widget B', 'Advanced widget', 2599, 25
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Widget B');

INSERT INTO products (name, description, price_cents, stock)
SELECT 'Gadget C', 'Premium gadget', 4599, 10
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Gadget C');