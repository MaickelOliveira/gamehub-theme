(function () {
  'use strict';

  const cartKey = 'gamehub_cart_v2';
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function formatMoney(cents) {
    return money.format(Number(cents || 0) / 100);
  }

  function loadCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
      if (!Array.isArray(cart)) return [];
      return cart.filter((item) => item && item.id && item.platform && Number(item.quantity) > 0).slice(0, 50);
    } catch (_error) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCartCount();
    renderDrawer();
    renderCartPage();
    renderCheckoutSummary();
  }

  function cartTotal(cart = loadCart()) {
    return cart.reduce((total, item) => total + Number(item.price_cents || 0) * Number(item.quantity || 0), 0);
  }

  function cartCount(cart = loadCart()) {
    return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
  }

  function showToast(message, error = false) {
    const region = document.querySelector('[data-toast-region]');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = `store-toast${error ? ' is-error' : ''}`;
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function renderCartCount() {
    document.querySelectorAll('[data-cart-count]').forEach((element) => { element.textContent = String(cartCount()); });
  }

  function itemKey(item) {
    return `${item.id}:${item.platform}`;
  }

  function selectedPlatform() {
    return document.querySelector('[data-platform-selector] [aria-pressed="true"]')?.dataset.platform || '';
  }

  function productQuantity() {
    return Math.max(1, Math.min(10, Number.parseInt(document.querySelector('[data-product-quantity]')?.value, 10) || 1));
  }

  async function fetchProduct(id) {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Produto indisponível.');
    return payload.product;
  }

  async function addProduct(id, goToCheckout) {
    try {
      const product = await fetchProduct(id);
      if (product.stock <= 0) throw new Error('Este produto está esgotado.');
      const platform = selectedPlatform() || product.platforms[0];
      const quantity = document.body.dataset.page.startsWith('/produto/') ? productQuantity() : 1;
      const cart = loadCart();
      const key = `${product.id}:${platform}`;
      const existing = cart.find((item) => itemKey(item) === key);
      if (existing) existing.quantity = Math.min(10, Number(existing.quantity) + quantity);
      else cart.push({ id: product.id, slug: product.slug, name: product.name, platform, quantity, price_cents: product.price_cents, image_url: product.image_url, stock: product.stock });
      saveCart(cart);
      if (goToCheckout) window.location.assign('/checkout');
      else {
        showToast(`${product.name} foi adicionado ao carrinho.`);
        openDrawer();
      }
    } catch (error) {
      showToast(error.message || 'Não foi possível adicionar o produto.', true);
    }
  }

  function changeItem(key, change) {
    const cart = loadCart();
    const item = cart.find((entry) => itemKey(entry) === key);
    if (!item) return;
    item.quantity = Math.max(0, Math.min(10, Number(item.quantity) + change));
    saveCart(cart.filter((entry) => entry.quantity > 0));
  }

  function removeItem(key) {
    saveCart(loadCart().filter((item) => itemKey(item) !== key));
  }

  function openDrawer() {
    const drawer = document.getElementById('CartDrawer');
    if (!drawer) return;
    renderDrawer();
    drawer.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    const drawer = document.getElementById('CartDrawer');
    if (!drawer) return;
    drawer.hidden = true;
    document.body.style.overflow = '';
  }

  function renderDrawer() {
    const target = document.getElementById('CartDrawerContent');
    if (!target) return;
    const cart = loadCart();
    if (!cart.length) {
      target.innerHTML = '<div class="cart-drawer__empty"><strong>Seu carrinho está vazio</strong><p>Escolha um jogo para começar.</p><a class="button button--primary" href="/catalogo">Ver catálogo</a></div>';
      return;
    }
    target.innerHTML = `<ul class="cart-drawer__items">${cart.map((item) => `
      <li class="cart-drawer__item">
        <a class="cart-drawer__item-media" href="/produto/${encodeURIComponent(item.slug)}"><img src="${escapeHtml(item.image_url)}" alt=""></a>
        <div class="cart-drawer__item-info"><a class="cart-drawer__item-title" href="/produto/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}</a><p class="cart-drawer__item-price">${escapeHtml(item.platform)} · <strong>${formatMoney(item.price_cents)}</strong></p><div class="cart-drawer__qty"><button data-cart-minus="${escapeHtml(itemKey(item))}" aria-label="Diminuir">−</button><span>${item.quantity}</span><button data-cart-plus="${escapeHtml(itemKey(item))}" aria-label="Aumentar">+</button></div></div>
        <button class="cart-drawer__item-remove" data-cart-remove="${escapeHtml(itemKey(item))}" aria-label="Remover">×</button>
      </li>`).join('')}</ul><div class="cart-drawer__footer"><div class="cart-drawer__subtotal"><span>Subtotal</span><span>${formatMoney(cartTotal(cart))}</span></div><a class="button button--primary" href="/checkout">Finalizar compra</a><a class="button button--secondary" href="/carrinho">Ver carrinho</a></div>`;
  }

  function renderCartPage() {
    const target = document.querySelector('[data-cart-page]');
    if (!target) return;
    const cart = loadCart();
    if (!cart.length) {
      target.innerHTML = '<div class="cart-page__empty-state"><h2>Seu carrinho está vazio</h2><p class="cart-page__empty">Explore o catálogo e encontre sua próxima aventura.</p><a class="button button--primary" href="/catalogo">Continuar comprando</a></div>';
      return;
    }
    target.innerHTML = `<ul class="cart-page__items">${cart.map((item) => `
      <li class="cart-page__item"><a class="cart-page__item-media" href="/produto/${encodeURIComponent(item.slug)}"><img src="${escapeHtml(item.image_url)}" alt=""></a><div class="cart-page__item-info"><a class="cart-page__item-title" href="/produto/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}</a><p class="cart-page__variant">${escapeHtml(item.platform)}</p><p class="cart-page__item-price">${formatMoney(item.price_cents)} por unidade</p></div><div class="cart-page__qty"><button data-cart-minus="${escapeHtml(itemKey(item))}">−</button><input readonly value="${item.quantity}" aria-label="Quantidade"><button data-cart-plus="${escapeHtml(itemKey(item))}">+</button></div><div class="cart-page__item-total">${formatMoney(item.price_cents * item.quantity)}</div><button class="cart-page__item-remove" data-cart-remove="${escapeHtml(itemKey(item))}" aria-label="Remover">×</button></li>`).join('')}</ul><div class="cart-page__footer"><p class="cart-page__subtotal">Subtotal <strong>${formatMoney(cartTotal(cart))}</strong></p><div class="cart-page__actions"><a class="button button--secondary" href="/catalogo">Continuar comprando</a><a class="button button--primary" href="/checkout">Ir para o checkout</a></div></div>`;
  }

  function activePaymentMethod() {
    return document.querySelector('[name="payment_method"]:checked')?.value || 'pix';
  }

  function checkoutDiscount(subtotal) {
    const checkout = document.querySelector('.checkout');
    const percent = activePaymentMethod() === 'pix' ? Number(checkout?.dataset.pixDiscount || 0) : 0;
    return Math.round(subtotal * percent / 100);
  }

  function renderCheckoutSummary() {
    const target = document.querySelector('[data-checkout-summary]');
    if (!target) return;
    const cart = loadCart();
    const submit = document.querySelector('[data-checkout-form] button[type="submit"]');
    if (!cart.length) {
      target.innerHTML = '<div class="store-empty"><p>Seu carrinho está vazio.</p><a class="button button--primary" href="/catalogo">Escolher jogos</a></div>';
      if (submit) submit.disabled = true;
      return;
    }
    if (submit) submit.disabled = false;
    const subtotal = cartTotal(cart);
    const discount = checkoutDiscount(subtotal);
    target.innerHTML = `<div class="checkout-summary__items">${cart.map((item) => `<div class="checkout-summary__item"><img src="${escapeHtml(item.image_url)}" alt=""><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.platform)} · ${item.quantity}x</span></div><strong>${formatMoney(item.price_cents * item.quantity)}</strong></div>`).join('')}</div><div class="checkout-summary__totals"><span>Subtotal <strong>${formatMoney(subtotal)}</strong></span><span>Desconto estimado <strong>− ${formatMoney(discount)}</strong></span><span>Total <strong>${formatMoney(subtotal - discount)}</strong></span></div>`;
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-product]');
    const buyButton = event.target.closest('[data-buy-product]');
    const plusButton = event.target.closest('[data-cart-plus]');
    const minusButton = event.target.closest('[data-cart-minus]');
    const removeButton = event.target.closest('[data-cart-remove]');
    if (addButton) addProduct(addButton.dataset.addProduct, false);
    if (buyButton) addProduct(buyButton.dataset.buyProduct, true);
    if (plusButton) changeItem(plusButton.dataset.cartPlus, 1);
    if (minusButton) changeItem(minusButton.dataset.cartMinus, -1);
    if (removeButton) removeItem(removeButton.dataset.cartRemove);
    if (event.target.closest('[data-cart-open]')) openDrawer();
    if (event.target.closest('[data-cart-close]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });

  document.querySelectorAll('[data-platform]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('[data-platform-selector]').querySelectorAll('[data-platform]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
  });

  const quantityInput = document.querySelector('[data-product-quantity]');
  document.querySelector('[data-product-minus]')?.addEventListener('click', () => { if (quantityInput) quantityInput.value = String(Math.max(1, productQuantity() - 1)); });
  document.querySelector('[data-product-plus]')?.addEventListener('click', () => { if (quantityInput) quantityInput.value = String(Math.min(10, productQuantity() + 1)); });

  document.querySelectorAll('.payment-choice input').forEach((input) => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.payment-choice').forEach((choice) => choice.classList.toggle('is-selected', choice.contains(input)));
      renderCheckoutSummary();
    });
  });

  document.querySelector('[data-checkout-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('[data-checkout-error]');
    const submit = form.querySelector('button[type="submit"]');
    const cart = loadCart();
    const values = new FormData(form);
    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Criando pedido...';
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: values.get('name'), email: values.get('email'), phone: values.get('phone'), document: values.get('document'), notes: values.get('notes') },
          payment_method: values.get('payment_method'), coupon_code: values.get('coupon_code'),
          items: cart.map((item) => ({ product_id: item.id, platform: item.platform, quantity: item.quantity }))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível criar o pedido.');
      localStorage.removeItem(cartKey);
      window.location.assign(payload.order.url);
    } catch (error) {
      errorBox.textContent = error.message || 'Não foi possível criar o pedido.';
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Criar pedido seguro';
    }
  });

  document.querySelector('[data-copy-pix]')?.addEventListener('click', async () => {
    const key = document.querySelector('[data-pix-key]')?.textContent.trim();
    if (!key) return;
    try { await navigator.clipboard.writeText(key); showToast('Chave Pix copiada.'); } catch (_error) { showToast('Selecione e copie a chave Pix.', true); }
  });

  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileNav = document.querySelector('[data-mobile-nav]');
  menuToggle?.addEventListener('click', () => {
    const opening = mobileNav.hidden;
    mobileNav.hidden = !opening;
    menuToggle.setAttribute('aria-expanded', String(opening));
  });

  const themeToggle = document.getElementById('ThemeToggle');
  try {
    const savedTheme = localStorage.getItem('gamehub_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
  } catch (_error) {}
  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('gamehub_theme', next); } catch (_error) {}
  });

  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-carousel-track]');
    carousel.querySelector('[data-carousel-prev]')?.addEventListener('click', () => track.scrollBy({ left: -520, behavior: 'smooth' }));
    carousel.querySelector('[data-carousel-next]')?.addEventListener('click', () => track.scrollBy({ left: 520, behavior: 'smooth' }));
  });

  const hero = document.querySelector('[data-hero-slider]');
  if (hero) {
    const slides = [...hero.querySelectorAll('[data-hero-slide]')];
    const dots = [...hero.querySelectorAll('[data-hero-dot]')];
    let index = 0;
    let timer;
    const activate = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, itemIndex) => slide.classList.toggle('is-active', itemIndex === index));
      dots.forEach((dot, itemIndex) => dot.classList.toggle('is-active', itemIndex === index));
      window.clearInterval(timer);
      timer = window.setInterval(() => activate(index + 1), 14000);
    };
    hero.querySelector('[data-hero-prev]')?.addEventListener('click', () => activate(index - 1));
    hero.querySelector('[data-hero-next]')?.addEventListener('click', () => activate(index + 1));
    dots.forEach((dot) => dot.addEventListener('click', () => activate(Number(dot.dataset.heroDot))));
    activate(0);
  }

  renderCartCount();
  renderDrawer();
  renderCartPage();
  renderCheckoutSummary();
})();
