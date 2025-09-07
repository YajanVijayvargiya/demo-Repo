import os
from flask import Flask, jsonify, request, render_template
from db import (
	initialize_db_if_needed,
	get_connection,
	list_products,
	update_product_stock,
	create_order,
	list_orders,
	update_order_status,
)

app = Flask(
	__name__,
	static_folder="static",
	template_folder="templates",
)


@app.before_first_request
def ensure_db():
	initialize_db_if_needed()


@app.route("/")
def index():
	return render_template("index.html")


@app.route("/api/inventory", methods=["GET"]) 
def api_inventory():
	with get_connection() as conn:
		products = [dict(row) for row in list_products(conn)]
		return jsonify({"products": products})


@app.route("/api/inventory/<int:product_id>/stock", methods=["PATCH"]) 
def api_update_stock(product_id: int):
	payload = request.get_json(silent=True) or {}
	try:
		new_stock = int(payload.get("stock", -1))
		if new_stock < 0:
			return jsonify({"error": "stock must be non-negative"}), 400
		with get_connection() as conn:
			cur = conn.execute("SELECT id FROM products WHERE id = ?", (product_id,))
			if cur.fetchone() is None:
				return jsonify({"error": "product not found"}), 404
			update_product_stock(conn, product_id, new_stock)
			conn.commit()
		return jsonify({"ok": True})
	except Exception as e:
		return jsonify({"error": str(e)}), 400


@app.route("/api/order", methods=["POST"]) 
def api_place_order():
	payload = request.get_json(silent=True) or {}
	customer_name = str(payload.get("customer_name", "")).strip()
	address = str(payload.get("address", "")).strip()
	items = payload.get("items", [])

	if not customer_name or not address:
		return jsonify({"error": "customer_name and address are required"}), 400

	try:
		with get_connection() as conn:
			order_id = create_order(conn, customer_name, address, items)
			conn.commit()
		return jsonify({"ok": True, "order_id": order_id}), 201
	except ValueError as ve:
		return jsonify({"error": str(ve)}), 400
	except Exception as e:
		return jsonify({"error": "unexpected error: " + str(e)}), 500


@app.route("/api/orders", methods=["GET"]) 
def api_list_orders():
	with get_connection() as conn:
		orders = list_orders(conn)
		return jsonify({"orders": orders})


@app.route("/api/orders/<int:order_id>/status", methods=["PATCH"]) 
def api_update_order_status(order_id: int):
	payload = request.get_json(silent=True) or {}
	status = str(payload.get("status", "")).strip()
	try:
		with get_connection() as conn:
			update_order_status(conn, order_id, status)
			conn.commit()
		return jsonify({"ok": True})
	except ValueError as ve:
		return jsonify({"error": str(ve)}), 400
	except Exception as e:
		return jsonify({"error": "unexpected error: " + str(e)}), 500


if __name__ == "__main__":
	port = int(os.environ.get("PORT", "8000"))
	app.run(host="0.0.0.0", port=port, debug=True)