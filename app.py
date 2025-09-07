import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, render_template

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_ROOT, 'app.db')
SQL_SETUP_PATH = os.path.join(APP_ROOT, 'sql_setup.sql')


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_database():
    """Create the database by executing sql_setup.sql if DB file is missing."""
    if not os.path.exists(DB_PATH):
        with sqlite3.connect(DB_PATH) as conn:
            with open(SQL_SETUP_PATH, 'r', encoding='utf-8') as f:
                sql_script = f.read()
            conn.executescript(sql_script)


app = Flask(__name__, static_folder='static', template_folder='templates')


@app.route('/')
def index():
    return render_template('index.html')


@app.get('/api/products')
def list_products():
    conn = get_db_connection()
    rows = conn.execute('SELECT id, name, description, price_cents, stock FROM products ORDER BY id ASC').fetchall()
    conn.close()
    products = [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "price_cents": row["price_cents"],
            "stock": row["stock"],
        }
        for row in rows
    ]
    return jsonify({"products": products})


@app.post('/api/orders')
def place_order():
    payload = request.get_json(silent=True) or {}
    buyer_name = (payload.get('buyer_name') or '').strip()
    product_id = payload.get('product_id')
    quantity = payload.get('quantity')

    # Basic validation
    errors = []
    if not buyer_name:
        errors.append('Buyer name is required.')
    if not isinstance(product_id, int):
        errors.append('Valid product_id is required.')
    if not isinstance(quantity, int) or quantity <= 0:
        errors.append('Quantity must be a positive integer.')
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    conn = get_db_connection()
    try:
        product = conn.execute('SELECT id, stock, price_cents FROM products WHERE id = ?', (product_id,)).fetchone()
        if product is None:
            return jsonify({"ok": False, "errors": ["Product not found."]}), 404
        if quantity > product["stock"]:
            return jsonify({"ok": False, "errors": ["Quantity exceeds available stock."]}), 400

        # Insert order
        created_at = datetime.utcnow().isoformat()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO orders (buyer_name, product_id, quantity, status, created_at) VALUES (?, ?, ?, ?, ?)',
            (buyer_name, product_id, quantity, 'order placed', created_at),
        )
        order_id = cur.lastrowid

        # Decrement stock
        conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', (quantity, product_id))
        conn.commit()
        return jsonify({"ok": True, "order_id": order_id})
    finally:
        conn.close()


@app.get('/api/orders')
def list_orders():
    conn = get_db_connection()
    rows = conn.execute(
        '''SELECT o.id, o.buyer_name, o.product_id, p.name as product_name, o.quantity, o.status, o.created_at
        FROM orders o JOIN products p ON p.id = o.product_id
        ORDER BY o.id DESC'''
    ).fetchall()
    conn.close()
    orders = [
        {
            "id": row["id"],
            "buyer_name": row["buyer_name"],
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "quantity": row["quantity"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return jsonify({"orders": orders})


VALID_STATUSES = ['order placed', 'packed', 'dispatched', 'completed']


@app.patch('/api/orders/<int:order_id>/status')
def update_order_status(order_id: int):
    payload = request.get_json(silent=True) or {}
    status = (payload.get('status') or '').strip().lower()
    if status not in VALID_STATUSES:
        return jsonify({"ok": False, "errors": ["Invalid status value."]}), 400

    conn = get_db_connection()
    try:
        order = conn.execute('SELECT id FROM orders WHERE id = ?', (order_id,)).fetchone()
        if order is None:
            return jsonify({"ok": False, "errors": ["Order not found."]}), 404
        conn.execute('UPDATE orders SET status = ? WHERE id = ?', (status, order_id))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()


@app.patch('/api/products/<int:product_id>/stock')
def update_product_stock(product_id: int):
    payload = request.get_json(silent=True) or {}
    stock = payload.get('stock')
    if not isinstance(stock, int) or stock < 0:
        return jsonify({"ok": False, "errors": ["Stock must be a non-negative integer."]}), 400

    conn = get_db_connection()
    try:
        product = conn.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
        if product is None:
            return jsonify({"ok": False, "errors": ["Product not found."]}), 404
        conn.execute('UPDATE products SET stock = ? WHERE id = ?', (stock, product_id))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()


@app.route('/static/<path:filename>')
def static_files(filename: str):
    return send_from_directory(app.static_folder, filename)


if __name__ == '__main__':
    ensure_database()
    app.run(host='0.0.0.0', port=5000, debug=True)