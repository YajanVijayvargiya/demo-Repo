const buyerBtn = document.getElementById('buyerBtn');
const sellerBtn = document.getElementById('sellerBtn');
const buyerSection = document.getElementById('buyerSection');
const sellerSection = document.getElementById('sellerSection');

const productsList = document.getElementById('productsList');
const ordersList = document.getElementById('ordersList');

const productSelect = document.getElementById('productSelect');
const stockProductSelect = document.getElementById('stockProductSelect');

const orderForm = document.getElementById('orderForm');
const stockForm = document.getElementById('stockForm');

const buyerNameEl = document.getElementById('buyerName');
const qtyEl = document.getElementById('quantity');
const orderFeedback = document.getElementById('orderFeedback');
const stockFeedback = document.getElementById('stockFeedback');

const VALID_STATUSES = ['order placed', 'packed', 'dispatched', 'completed'];

function showBuyer() {
	buyerSection.classList.remove('hidden');
	sellerSection.classList.add('hidden');
	loadProducts();
}

function showSeller() {
	sellerSection.classList.remove('hidden');
	buyerSection.classList.add('hidden');
	loadOrders();
	loadProducts(true);
}

buyerBtn.addEventListener('click', showBuyer);
sellerBtn.addEventListener('click', showSeller);

async function api(path, options = {}) {
	const res = await fetch(path, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	});
	let body = null;
	try { body = await res.json(); } catch {}
	if (!res.ok) {
		const errors = (body && body.errors) ? body.errors.join(' ') : 'Request failed.';
		throw new Error(errors);
	}
	return body;
}

function formatMoney(cents) {
	return `$${(cents / 100).toFixed(2)}`;
}

async function loadProducts(updateSeller = false) {
	const { products } = await api('/api/products');
	productsList.innerHTML = '';
	productSelect.innerHTML = '';
	stockProductSelect.innerHTML = '';

	products.forEach(p => {
		// Product cards
		const card = document.createElement('div');
		card.className = 'card';
		card.innerHTML = `
			<h4>${p.name}</h4>
			<p>${p.description}</p>
			<div class="meta">
				<span>${formatMoney(p.price_cents)}</span>
				<span>Stock: ${p.stock}</span>
			</div>
		`;
		productsList.appendChild(card);

		// Buyer select
		const opt = document.createElement('option');
		opt.value = p.id;
		opt.textContent = `${p.name} — ${formatMoney(p.price_cents)} (stock: ${p.stock})`;
		productSelect.appendChild(opt);

		// Seller stock select
		const opt2 = document.createElement('option');
		opt2.value = p.id;
		opt2.textContent = `${p.name} — current stock: ${p.stock}`;
		stockProductSelect.appendChild(opt2);
	});

	if (updateSeller) {
		// No-op placeholder for any seller-specific refresh needs
	}
}

async function loadOrders() {
	const { orders } = await api('/api/orders');
	const table = document.createElement('table');
	table.innerHTML = `
		<thead>
			<tr>
				<th>ID</th>
				<th>Buyer</th>
				<th>Product</th>
				<th>Qty</th>
				<th>Status</th>
				<th>Updated</th>
			</tr>
		</thead>
		<tbody></tbody>
	`;
	const tbody = table.querySelector('tbody');
	orders.forEach(o => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>${o.id}</td>
			<td>${o.buyer_name}</td>
			<td>${o.product_name}</td>
			<td>${o.quantity}</td>
			<td></td>
			<td>${new Date(o.created_at).toLocaleString()}</td>
		`;
		const statusTd = tr.children[4];
		const select = document.createElement('select');
		select.className = 'status-select';
		VALID_STATUSES.forEach(s => {
			const opt = document.createElement('option');
			opt.value = s;
			opt.textContent = s;
			if (s === o.status) opt.selected = true;
			select.appendChild(opt);
		});
		select.addEventListener('change', async () => {
			try {
				await api(`/api/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
				await loadOrders();
			} catch (e) {
				alert(e.message);
			}
		});
		statusTd.appendChild(select);
		tbody.appendChild(tr);
	});
	ordersList.innerHTML = '';
	ordersList.appendChild(table);
}

orderForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	orderFeedback.className = 'feedback';
	orderFeedback.textContent = '';

	const buyer_name = buyerNameEl.value.trim();
	const product_id = parseInt(productSelect.value, 10);
	const quantity = parseInt(qtyEl.value, 10);

	// Client-side validations
	const errors = [];
	if (!buyer_name) errors.push('Name required.');
	if (!Number.isInteger(product_id)) errors.push('Select a product.');
	if (!Number.isInteger(quantity) || quantity <= 0) errors.push('Quantity must be a positive integer.');
	if (errors.length) {
		orderFeedback.textContent = errors.join(' ');
		orderFeedback.classList.add('error');
		return;
	}
	try {
		const res = await api('/api/orders', { method: 'POST', body: JSON.stringify({ buyer_name, product_id, quantity }) });
		orderFeedback.textContent = `Order #${res.order_id} placed successfully.`;
		orderFeedback.classList.add('success');
		buyerNameEl.value = '';
		qtyEl.value = '';
		await loadProducts();
	} catch (e) {
		orderFeedback.textContent = e.message;
		orderFeedback.classList.add('error');
	}
});

stockForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	stockFeedback.className = 'feedback';
	stockFeedback.textContent = '';

	const product_id = parseInt(stockProductSelect.value, 10);
	const stock = parseInt(document.getElementById('newStock').value, 10);
	if (!Number.isInteger(product_id)) {
		stockFeedback.textContent = 'Select a product.';
		stockFeedback.classList.add('error');
		return;
	}
	if (!Number.isInteger(stock) || stock < 0) {
		stockFeedback.textContent = 'Stock must be a non-negative integer.';
		stockFeedback.classList.add('error');
		return;
	}
	try {
		await api(`/api/products/${product_id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) });
		stockFeedback.textContent = 'Stock updated.';
		stockFeedback.classList.add('success');
		await Promise.all([loadProducts(true), loadOrders()]);
	} catch (e) {
		stockFeedback.textContent = e.message;
		stockFeedback.classList.add('error');
	}
});

// Default view
showBuyer();