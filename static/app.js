const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatPrice(cents) {
	return `$${(cents / 100).toFixed(2)}`;
}

async function fetchJSON(url, options = {}) {
	const res = await fetch(url, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Request failed');
	return data;
}

function renderProducts(products) {
	const container = $('#product-list');
	container.innerHTML = '';
	products.forEach((p) => {
		const div = document.createElement('div');
		div.className = 'card';
		div.innerHTML = `
			<h4>${p.name}</h4>
			<p>${p.description || ''}</p>
			<p><strong>${formatPrice(p.price_cents)}</strong></p>
			<p>Stock: <span data-stock-id="${p.id}">${p.stock}</span></p>
		`;
		container.appendChild(div);
	});
}

function addOrderItemRow(products) {
	const container = $('#order-items');
	const row = document.createElement('div');
	row.className = 'order-item-row';
	row.innerHTML = `
		<label>Product
			<select class="item-product">
				${products
					.map((p) => `<option value="${p.id}">${p.name} (${formatPrice(p.price_cents)})</option>`)
					.join('')}
			</select>
		</label>
		<label>Quantity
			<input class="item-qty" type="number" min="1" max="999" value="1" />
		</label>
		<button type="button" class="remove-item">Remove</button>
	`;
	row.querySelector('.remove-item').addEventListener('click', () => row.remove());
	container.appendChild(row);
}

function renderOrders(orders) {
	const container = $('#orders-list');
	container.innerHTML = '';
	orders.forEach((o) => {
		const div = document.createElement('div');
		div.className = 'card';
		div.innerHTML = `
			<h4>Order #${o.id} - ${o.customer_name}</h4>
			<p>${o.address}</p>
			<ul>
				${o.items
					.map(
						(i) => `<li>${i.product_name} x ${i.quantity} @ ${formatPrice(
							i.price_cents_at_order
						)}</li>`
					)
					.join('')}
			</ul>
			<p><strong>Total: ${formatPrice(o.total_cents)}</strong></p>
			<label>Status
				<select data-order-id="${o.id}" class="status-select">
					${['order_placed', 'packed', 'dispatched', 'completed']
						.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`)
						.join('')}
				</select>
			</label>
		`;
		container.appendChild(div);
	});
	$$('.status-select').forEach((sel) => {
		sel.addEventListener('change', async (e) => {
			const orderId = e.target.getAttribute('data-order-id');
			const status = e.target.value;
			try {
				await fetchJSON(`/api/orders/${orderId}/status`, {
					method: 'PATCH',
					body: JSON.stringify({ status }),
				});
			} catch (err) {
				alert(err.message);
			}
		});
	});
}

function renderInventory(products) {
	const container = $('#inventory-list');
	container.innerHTML = '';
	products.forEach((p) => {
		const div = document.createElement('div');
		div.className = 'card';
		div.innerHTML = `
			<h4>${p.name}</h4>
			<p>Current Stock: <span data-stock-id="${p.id}">${p.stock}</span></p>
			<label>Update Stock
				<input type="number" min="0" max="100000" value="${p.stock}" class="stock-input" data-product-id="${p.id}" />
			</label>
			<button type="button" class="save-stock" data-product-id="${p.id}">Save</button>
		`;
		container.appendChild(div);
	});
	$$('.save-stock').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const productId = e.target.getAttribute('data-product-id');
			const input = $(`input.stock-input[data-product-id="${productId}"]`);
			const stock = parseInt(input.value, 10);
			if (Number.isNaN(stock) || stock < 0) {
				alert('Stock must be a non-negative number');
				return;
			}
			try {
				await fetchJSON(`/api/inventory/${productId}/stock`, {
					method: 'PATCH',
					body: JSON.stringify({ stock }),
				});
				$(`span[data-stock-id="${productId}"]`).textContent = String(stock);
			} catch (err) {
				alert(err.message);
			}
		});
	});
}

async function loadBuyerView() {
	const { products } = await fetchJSON('/api/inventory');
	renderProducts(products);
	const itemsContainer = $('#order-items');
	itemsContainer.innerHTML = '';
	addOrderItemRow(products);
	$('#add-item').onclick = () => addOrderItemRow(products);
}

async function loadSellerView() {
	const [{ products }, { orders }] = await Promise.all([
		fetchJSON('/api/inventory'),
		fetchJSON('/api/orders'),
	]);
	renderOrders(orders);
	renderInventory(products);
}

function setupRoleToggle() {
	$$('input[name="role"]').forEach((r) => {
		r.addEventListener('change', async () => {
			const role = $$('input[name="role"]').find((x) => x.checked).value;
			if (role === 'buyer') {
				$('#seller-section').classList.add('hidden');
				$('#buyer-section').classList.remove('hidden');
				await loadBuyerView();
			} else {
				$('#buyer-section').classList.add('hidden');
				$('#seller-section').classList.remove('hidden');
				await loadSellerView();
			}
		});
	});
}

function setupOrderForm() {
	$('#order-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const name = $('#customer_name').value.trim();
		const address = $('#address').value.trim();
		const items = $$('.order-item-row').map((row) => {
			const productId = parseInt(row.querySelector('.item-product').value, 10);
			const qty = parseInt(row.querySelector('.item-qty').value, 10);
			return { product_id: productId, quantity: qty };
		});

		// Basic client-side validation
		if (!name || !address) {
			$('#order-feedback').textContent = 'Name and address are required.';
			$('#order-feedback').classList.add('error');
			return;
		}
		if (items.length === 0) {
			$('#order-feedback').textContent = 'Add at least one item.';
			$('#order-feedback').classList.add('error');
			return;
		}
		if (items.length > 50) {
			$('#order-feedback').textContent = 'Too many item types (max 50).';
			$('#order-feedback').classList.add('error');
			return;
		}
		for (const it of items) {
			if (!Number.isInteger(it.product_id) || !Number.isInteger(it.quantity) || it.quantity <= 0) {
				$('#order-feedback').textContent = 'Invalid product or quantity in items.';
				$('#order-feedback').classList.add('error');
				return;
			}
		}

		try {
			const res = await fetchJSON('/api/order', {
				method: 'POST',
				body: JSON.stringify({ customer_name: name, address, items }),
			});
			$('#order-feedback').textContent = `Order placed! ID: ${res.order_id}`;
			$('#order-feedback').classList.remove('error');
			$('#order-form').reset();
			await loadBuyerView();
		} catch (err) {
			$('#order-feedback').textContent = err.message;
			$('#order-feedback').classList.add('error');
		}
	});
}

async function init() {
	setupRoleToggle();
	setupOrderForm();
	await loadBuyerView();
}

document.addEventListener('DOMContentLoaded', init);