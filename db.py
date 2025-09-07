import os
import sqlite3
from typing import Any, Dict, List, Tuple

DB_PATH = os.environ.get("APP_DB_PATH", "/workspace/app.db")
SQL_SETUP_PATH = os.environ.get("APP_SQL_SETUP", "/workspace/sql_setup.sql")


def get_connection() -> sqlite3.Connection:
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	conn.execute("PRAGMA foreign_keys = ON;")
	return conn


def initialize_db_if_needed() -> None:
	if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
		with get_connection() as conn:
			with open(SQL_SETUP_PATH, "r", encoding="utf-8") as f:
				conn.executescript(f.read())
			conn.commit()
	else:
		# Ensure schema exists even if file is present but tables are missing
		with get_connection() as conn:
			with open(SQL_SETUP_PATH, "r", encoding="utf-8") as f:
				conn.executescript(
					"PRAGMA foreign_keys = ON;\n" + f.read()
				)
				conn.commit()


# Product helpers

def list_products(conn: sqlite3.Connection) -> List[sqlite3.Row]:
	cur = conn.execute(
		"SELECT id, name, description, price_cents, stock FROM products ORDER BY id ASC"
	)
	return cur.fetchall()


def get_product(conn: sqlite3.Connection, product_id: int):
	cur = conn.execute(
		"SELECT id, name, description, price_cents, stock FROM products WHERE id = ?",
		(product_id,),
	)
	return cur.fetchone()


def update_product_stock(conn: sqlite3.Connection, product_id: int, new_stock: int) -> None:
	conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))


# Order helpers

def create_order(
	conn: sqlite3.Connection,
	customer_name: str,
	address: str,
	items: List[Dict[str, int]],
) -> int:
	# Validate items and stock
	if len(items) == 0:
		raise ValueError("At least one item is required")
	if len(items) > 50:
		raise ValueError("Too many distinct items (max 50)")

	# Normalize and validate quantities
	normalized: List[Tuple[int, int]] = []
	for item in items:
		pid = int(item.get("product_id", 0))
		qty = int(item.get("quantity", 0))
		if pid <= 0 or qty <= 0:
			raise ValueError("Invalid product or quantity")
		normalized.append((pid, qty))

	# Check stock
	for pid, qty in normalized:
		prod = get_product(conn, pid)
		if prod is None:
			raise ValueError(f"Product {pid} not found")
		if qty > prod["stock"]:
			raise ValueError(f"Quantity for product {pid} exceeds stock")

	# Create order
	cur = conn.execute(
		"INSERT INTO orders (customer_name, address, status) VALUES (?, ?, 'order_placed')",
		(customer_name.strip(), address.strip()),
	)
	order_id = cur.lastrowid

	# Insert items and decrement stock
	for pid, qty in normalized:
		prod = get_product(conn, pid)
		conn.execute(
			"INSERT INTO order_items (order_id, product_id, quantity, price_cents_at_order) VALUES (?, ?, ?, ?)",
			(order_id, pid, qty, prod["price_cents"]),
		)
		conn.execute(
			"UPDATE products SET stock = stock - ? WHERE id = ?",
			(qty, pid),
		)

	return order_id


def list_orders(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
	# Fetch orders and aggregate items
	orders_cur = conn.execute(
		"SELECT id, customer_name, address, status, created_at FROM orders ORDER BY id DESC"
	)
	orders = []
	for o in orders_cur.fetchall():
		items_cur = conn.execute(
			"""
			SELECT oi.id, oi.product_id, p.name as product_name, oi.quantity, oi.price_cents_at_order
			FROM order_items oi
			JOIN products p ON p.id = oi.product_id
			WHERE oi.order_id = ?
			ORDER BY oi.id ASC
			""",
			(o["id"],),
		)
		items = [dict(row) for row in items_cur.fetchall()]
		total_cents = sum(i["quantity"] * i["price_cents_at_order"] for i in items)
		orders.append(
			{
				"id": o["id"],
				"customer_name": o["customer_name"],
				"address": o["address"],
				"status": o["status"],
				"created_at": o["created_at"],
				"items": items,
				"total_cents": total_cents,
			}
		)
	return orders


def update_order_status(conn: sqlite3.Connection, order_id: int, status: str) -> None:
	allowed = {"order_placed", "packed", "dispatched", "completed"}
	if status not in allowed:
		raise ValueError("Invalid status")
	cur = conn.execute("SELECT id FROM orders WHERE id = ?", (order_id,))
	if cur.fetchone() is None:
		raise ValueError("Order not found")
	conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))