(function () {
  'use strict';

  const root = document.querySelector('[data-admin-root]');
  if (!root) return;
  const loginPanel = root.querySelector('[data-admin-login]');
  const dashboardPanel = root.querySelector('[data-admin-dashboard]');
  const productModal = root.querySelector('[data-product-modal]');
  const productForm = root.querySelector('[data-product-form]');
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  let dashboard = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function formatMoney(cents) {
    return money.format(Number(cents || 0) / 100);
  }

  function formatDate(value) {
    if (!value) return '—';
    const normalized = String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(normalized));
  }

  function showToast(message, error = false) {
    const region = root.querySelector('[data-toast-region]');
    const toast = document.createElement('div');
    toast.className = `store-toast${error ? ' is-error' : ''}`;
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    let payload = {};
    try { payload = await response.json(); } catch (_error) {}
    if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
    return payload;
  }

  function showLogin() {
    loginPanel.hidden = false;
    dashboardPanel.hidden = true;
  }

  async function showDashboard() {
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    await loadDashboard();
  }

  async function loadDashboard() {
    try {
      dashboard = await api('/api/admin/dashboard');
      renderDashboard();
    } catch (error) {
      if (error.message.includes('Acesso')) showLogin();
      else showToast(error.message, true);
    }
  }

  function renderDashboard() {
    renderMetrics();
    renderOverviewLists();
    renderOrders();
    renderProducts();
    renderCoupons();
    fillSettings();
  }

  function renderMetrics() {
    const target = root.querySelector('[data-admin-metrics]');
    target.innerHTML = `
      <article class="admin-metric"><span>Pedidos</span><strong>${dashboard.totals.order_count}</strong></article>
      <article class="admin-metric"><span>Faturamento pago</span><strong>${formatMoney(dashboard.totals.paid_total_cents)}</strong></article>
      <article class="admin-metric"><span>Aguardando pagamento</span><strong>${dashboard.totals.pending_count}</strong></article>
      <article class="admin-metric"><span>Newsletter</span><strong>${dashboard.totals.subscriber_count}</strong></article>`;
  }

  function renderOverviewLists() {
    const ordersTarget = root.querySelector('[data-admin-recent-orders]');
    const stockTarget = root.querySelector('[data-admin-low-stock]');
    const recent = dashboard.orders.slice(0, 6);
    const lowStock = dashboard.products.filter((product) => product.active && product.stock <= 10).sort((a, b) => a.stock - b.stock).slice(0, 8);
    ordersTarget.innerHTML = recent.length ? `<div class="admin-list">${recent.map((order) => `<div class="admin-list__item"><div><strong>${escapeHtml(order.public_number)}</strong><span>${escapeHtml(order.customer_name)} · ${formatDate(order.created_at)}</span></div><strong>${formatMoney(order.total_cents)}</strong></div>`).join('')}</div>` : '<p>Nenhum pedido recebido ainda.</p>';
    stockTarget.innerHTML = lowStock.length ? `<div class="admin-list">${lowStock.map((product) => `<div class="admin-list__item"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.sku)}</span></div><strong>${product.stock} un.</strong></div>`).join('')}</div>` : '<p>Todos os produtos possuem estoque confortável.</p>';
  }

  const statusLabels = { awaiting_payment: 'Aguardando pagamento', processing: 'Em processamento', completed: 'Concluído', cancelled: 'Cancelado' };
  const paymentLabels = { pending: 'Pendente', paid: 'Pago', refunded: 'Reembolsado', cancelled: 'Cancelado' };

  function selectOptions(labels, selected) {
    return Object.entries(labels).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }

  function renderOrders() {
    const target = root.querySelector('[data-admin-orders]');
    target.innerHTML = dashboard.orders.length ? dashboard.orders.map((order) => `
      <tr data-order-row="${escapeHtml(order.id)}">
        <td><strong>${escapeHtml(order.public_number)}</strong><br><small>${escapeHtml(order.payment_method.toUpperCase())}</small></td>
        <td>${escapeHtml(order.customer_name)}<br><small>${escapeHtml(order.customer_phone)} · ${escapeHtml(order.customer_email)}</small></td>
        <td>${order.items.map((item) => `${item.quantity}× ${escapeHtml(item.name)} (${escapeHtml(item.platform)})`).join('<br>')}</td>
        <td><strong>${formatMoney(order.total_cents)}</strong></td>
        <td><select data-order-payment>${selectOptions(paymentLabels, order.payment_status)}</select></td>
        <td><select data-order-status>${selectOptions(statusLabels, order.status)}</select></td>
        <td>${formatDate(order.created_at)}</td>
      </tr>`).join('') : '<tr><td colspan="7">Nenhum pedido recebido.</td></tr>';
  }

  function renderProducts() {
    const target = root.querySelector('[data-admin-products]');
    target.innerHTML = dashboard.products.map((product) => `
      <tr><td><div class="admin-product-cell"><img src="${escapeHtml(product.image_url || '/theme-assets/vibe-1.jpg')}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.category)} · ${escapeHtml(product.genre)}</small></div></div></td><td>${escapeHtml(product.sku)}</td><td>${product.platforms.map(escapeHtml).join(', ')}</td><td>${formatMoney(product.price_cents)}</td><td><strong>${product.stock}</strong></td><td>${product.active ? 'Sim' : 'Não'}</td><td><button class="admin-edit" data-edit-product="${escapeHtml(product.id)}">Editar</button></td></tr>`).join('');
  }

  function renderCoupons() {
    const target = root.querySelector('[data-admin-coupons]');
    target.innerHTML = dashboard.coupons.length ? dashboard.coupons.map((coupon) => `
      <div class="coupon-row"><div><strong>${escapeHtml(coupon.code)}</strong><span>${coupon.kind === 'percentage' ? `${coupon.value}%` : formatMoney(coupon.value)} · mínimo ${formatMoney(coupon.minimum_cents)}</span></div><button data-toggle-coupon="${escapeHtml(coupon.code)}" data-active="${coupon.active ? '1' : '0'}">${coupon.active ? 'Desativar' : 'Ativar'}</button></div>`).join('') : '<p>Nenhum cupom cadastrado.</p>';
  }

  function fillSettings() {
    const form = root.querySelector('[data-settings-form]');
    for (const [key, value] of Object.entries(dashboard.settings)) {
      if (form.elements[key]) form.elements[key].value = value;
    }
  }

  root.querySelector('[data-admin-login-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('[data-admin-login-error]');
    errorBox.hidden = true;
    try {
      await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: new FormData(form).get('password') }) });
      form.reset();
      await showDashboard();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });

  root.querySelector('[data-admin-logout]')?.addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  root.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
      root.querySelectorAll('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== button.dataset.adminTab; });
    });
  });

  root.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-order-status], [data-order-payment]');
    if (!select) return;
    const row = select.closest('[data-order-row]');
    try {
      await api(`/api/admin/orders/${encodeURIComponent(row.dataset.orderRow)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: row.querySelector('[data-order-status]').value, payment_status: row.querySelector('[data-order-payment]').value })
      });
      showToast('Pedido atualizado.');
      await loadDashboard();
    } catch (error) {
      showToast(error.message, true);
      await loadDashboard();
    }
  });

  function openProductModal(product) {
    productForm.reset();
    productForm.elements.id.value = product?.id || '';
    productForm.elements.name.value = product?.name || '';
    productForm.elements.sku.value = product?.sku || '';
    productForm.elements.slug.value = product?.slug || '';
    productForm.elements.category.value = product?.category || 'pronta-entrega';
    productForm.elements.genre.value = product?.genre || 'acao';
    productForm.elements.platforms.value = product?.platforms.join(', ') || '';
    productForm.elements.price_cents.value = product?.price_cents ?? '';
    productForm.elements.compare_at_price_cents.value = product?.compare_at_price_cents ?? '';
    productForm.elements.stock.value = product?.stock ?? 0;
    productForm.elements.image_url.value = product?.image_url || '';
    productForm.elements.description.value = product?.description || '';
    productForm.elements.featured.checked = Boolean(product?.featured);
    productForm.elements.active.checked = product ? Boolean(product.active) : true;
    root.querySelector('[data-product-modal-title]').textContent = product ? 'Editar produto' : 'Novo produto';
    productModal.showModal();
  }

  root.querySelector('[data-new-product]')?.addEventListener('click', () => openProductModal(null));
  root.querySelector('[data-product-close]')?.addEventListener('click', () => productModal.close());
  root.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-product]');
    const coupon = event.target.closest('[data-toggle-coupon]');
    if (edit) openProductModal(dashboard.products.find((product) => product.id === edit.dataset.editProduct));
    if (coupon) {
      try {
        await api(`/api/admin/coupons/${encodeURIComponent(coupon.dataset.toggleCoupon)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: coupon.dataset.active !== '1' }) });
        showToast('Cupom atualizado.');
        await loadDashboard();
      } catch (error) { showToast(error.message, true); }
    }
  });

  productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('[data-product-error]');
    const values = new FormData(form);
    errorBox.hidden = true;
    try {
      const imageFile = values.get('image_file');
      let imageUrl = values.get('image_url');
      if (imageFile && imageFile.size) {
        const uploadData = new FormData();
        uploadData.append('image', imageFile);
        const uploaded = await api('/api/admin/upload', { method: 'POST', body: uploadData });
        imageUrl = uploaded.url;
      }
      const id = values.get('id');
      const payload = {
        name: values.get('name'), sku: values.get('sku'), slug: values.get('slug'), category: values.get('category'), genre: values.get('genre'),
        platforms: String(values.get('platforms')).split(','), price_cents: values.get('price_cents'),
        compare_at_price_cents: values.get('compare_at_price_cents'), stock: values.get('stock'), image_url: imageUrl,
        description: values.get('description'), featured: values.get('featured') === 'on', active: values.get('active') === 'on'
      };
      await api(id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      productModal.close();
      showToast('Produto salvo.');
      await loadDashboard();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });

  root.querySelector('[data-coupon-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('[data-coupon-error]');
    const values = Object.fromEntries(new FormData(form));
    errorBox.hidden = true;
    try {
      await api('/api/admin/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      form.reset();
      showToast('Cupom salvo.');
      await loadDashboard();
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  });

  root.querySelector('[data-settings-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('[data-settings-error]');
    errorBox.hidden = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      await api('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      showToast('Configurações salvas.');
      await loadDashboard();
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  });

  api('/api/admin/session')
    .then((session) => session.authenticated ? showDashboard() : showLogin())
    .catch(() => showLogin());
})();
