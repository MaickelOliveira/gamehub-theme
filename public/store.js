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

  function addProductToCart(product, platform, quantity) {
    const cart = loadCart();
    const key = `${product.id}:${platform}`;
    const existing = cart.find((item) => itemKey(item) === key);
    if (existing) existing.quantity = Math.min(10, Number(existing.quantity) + quantity);
    else cart.push({
      id: product.id,
      slug: product.slug,
      name: product.name,
      platform,
      quantity,
      price_cents: product.price_cents,
      image_url: product.image_url,
      stock: product.stock
    });
    saveCart(cart);
  }

  async function addProduct(id, goToCheckout, platformOverride) {
    try {
      const product = await fetchProduct(id);
      if (product.stock <= 0) throw new Error('Este produto está esgotado.');
      const platform = platformOverride || selectedPlatform() || product.platforms[0];
      if (!product.platforms.includes(platform)) throw new Error('Escolha uma plataforma válida.');
      const quantity = document.querySelector('[data-product-quantity]') ? productQuantity() : 1;
      addProductToCart(product, platform, quantity);
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
    if (document.getElementById('ComboBuilder')?.hidden !== false) document.body.style.overflow = '';
  }

  function renderDrawer() {
    const target = document.getElementById('CartDrawerContent');
    if (!target) return;
    const cart = loadCart();
    if (!cart.length) {
      target.innerHTML = '<div class="cart-drawer__empty"><strong>Seu carrinho está vazio</strong><p>Escolha um jogo para começar.</p><a class="button button--primary" href="/collections/all">Ver catálogo</a></div>';
      return;
    }
    target.innerHTML = `<ul class="cart-drawer__items">${cart.map((item) => `
      <li class="cart-drawer__item">
        <a class="cart-drawer__item-media" href="/products/${encodeURIComponent(item.slug)}"><img src="${escapeHtml(item.image_url)}" alt=""></a>
        <div class="cart-drawer__item-info"><a class="cart-drawer__item-title" href="/products/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}</a><p class="cart-drawer__item-price">${escapeHtml(item.platform)} · <strong>${formatMoney(item.price_cents)}</strong></p><div class="cart-drawer__qty"><button data-cart-minus="${escapeHtml(itemKey(item))}" aria-label="Diminuir">−</button><span>${item.quantity}</span><button data-cart-plus="${escapeHtml(itemKey(item))}" aria-label="Aumentar">+</button></div></div>
        <button class="cart-drawer__item-remove" data-cart-remove="${escapeHtml(itemKey(item))}" aria-label="Remover">×</button>
      </li>`).join('')}</ul><div class="cart-drawer__footer"><div class="cart-drawer__subtotal"><span>Subtotal</span><span>${formatMoney(cartTotal(cart))}</span></div><a class="button button--primary" href="/checkout">Finalizar compra</a><a class="button button--secondary" href="/cart">Ver carrinho</a></div>`;
  }

  function renderCartPage() {
    const target = document.querySelector('[data-cart-page]');
    if (!target) return;
    const cart = loadCart();
    if (!cart.length) {
      target.innerHTML = '<div class="cart-page__empty-state"><p class="cart-page__empty">Seu carrinho está vazio.</p><a class="button button--primary" href="/collections/all">Continuar comprando</a></div>';
      return;
    }
    target.innerHTML = `<ul class="cart-page__items">${cart.map((item) => `
      <li class="cart-page__item"><a class="cart-page__item-media" href="/products/${encodeURIComponent(item.slug)}"><img src="${escapeHtml(item.image_url)}" alt=""></a><div class="cart-page__item-info"><a class="cart-page__item-title" href="/products/${encodeURIComponent(item.slug)}">${escapeHtml(item.name)}</a><p class="cart-page__variant">${escapeHtml(item.platform)}</p><p class="cart-page__item-price">${formatMoney(item.price_cents)}</p></div><div class="cart-page__qty"><button data-cart-minus="${escapeHtml(itemKey(item))}" aria-label="Diminuir quantidade">−</button><input readonly value="${item.quantity}" aria-label="Quantidade"><button data-cart-plus="${escapeHtml(itemKey(item))}" aria-label="Aumentar quantidade">+</button></div><div class="cart-page__item-total">${formatMoney(item.price_cents * item.quantity)}</div><button class="cart-page__item-remove" data-cart-remove="${escapeHtml(itemKey(item))}" aria-label="Remover">×</button></li>`).join('')}</ul><div class="cart-page__footer"><p class="cart-page__subtotal">Subtotal <strong>${formatMoney(cartTotal(cart))}</strong></p><div class="cart-page__actions"><a class="button button--secondary" href="/collections/all">Continuar comprando</a><a class="button button--primary" href="/checkout">Finalizar compra</a></div></div>`;
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
      target.innerHTML = '<div class="store-empty"><p>Seu carrinho está vazio.</p><a class="button button--primary" href="/collections/all">Escolher jogos</a></div>';
      if (submit) submit.disabled = true;
      return;
    }
    if (submit) submit.disabled = false;
    const subtotal = cartTotal(cart);
    const discount = checkoutDiscount(subtotal);
    target.innerHTML = `<div class="checkout-summary__items">${cart.map((item) => `<div class="checkout-summary__item"><img src="${escapeHtml(item.image_url)}" alt=""><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.platform)} · ${item.quantity}x</span></div><strong>${formatMoney(item.price_cents * item.quantity)}</strong></div>`).join('')}</div><div class="checkout-summary__totals"><span>Subtotal <strong>${formatMoney(subtotal)}</strong></span><span>Desconto estimado <strong>− ${formatMoney(discount)}</strong></span><span>Total <strong>${formatMoney(subtotal - discount)}</strong></span></div>`;
  }

  function openPlatformPicker(button, goToCheckout) {
    const picker = button.closest('.product-card')?.querySelector('[data-platform-picker]');
    if (!picker) return void addProduct(button.dataset.cardBuy || button.dataset.cardAdd, goToCheckout);
    document.querySelectorAll('[data-platform-picker]').forEach((item) => { if (item !== picker) item.hidden = true; });
    picker._pendingAction = { id: button.dataset.cardBuy || button.dataset.cardAdd, goToCheckout };
    picker.hidden = false;
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-product]');
    const buyButton = event.target.closest('[data-buy-product]');
    const cardAdd = event.target.closest('[data-card-add]');
    const cardBuy = event.target.closest('[data-card-buy]');
    const cardPlatform = event.target.closest('[data-card-platform]');
    const plusButton = event.target.closest('[data-cart-plus]');
    const minusButton = event.target.closest('[data-cart-minus]');
    const removeButton = event.target.closest('[data-cart-remove]');
    if (addButton) void addProduct(addButton.dataset.addProduct, false);
    if (buyButton) void addProduct(buyButton.dataset.buyProduct, true);
    if (cardAdd) cardAdd.hasAttribute('data-needs-platform') ? openPlatformPicker(cardAdd, false) : void addProduct(cardAdd.dataset.cardAdd, false);
    if (cardBuy) cardBuy.hasAttribute('data-needs-platform') ? openPlatformPicker(cardBuy, true) : void addProduct(cardBuy.dataset.cardBuy, true);
    if (cardPlatform) {
      const picker = cardPlatform.closest('[data-platform-picker]');
      const pending = picker?._pendingAction;
      if (pending) void addProduct(pending.id, pending.goToCheckout, cardPlatform.dataset.cardPlatform);
      if (picker) picker.hidden = true;
    }
    if (event.target.closest('[data-platform-picker-close]')) event.target.closest('[data-platform-picker]').hidden = true;
    if (plusButton) changeItem(plusButton.dataset.cartPlus, 1);
    if (minusButton) changeItem(minusButton.dataset.cartMinus, -1);
    if (removeButton) removeItem(removeButton.dataset.cartRemove);
    if (event.target.closest('[data-cart-open]')) openDrawer();
    if (event.target.closest('[data-cart-close]')) closeDrawer();
  });

  document.querySelectorAll('[data-platform-selector] [data-platform]').forEach((button) => {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: values.get('name'), email: values.get('email'), phone: values.get('phone'), document: values.get('document'), notes: values.get('notes') },
          payment_method: values.get('payment_method'),
          coupon_code: values.get('coupon_code'),
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

  document.querySelector('[data-newsletter-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('[data-newsletter-message]');
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: new FormData(form).get('email') }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível fazer o cadastro.');
      form.reset();
      message.classList.remove('is-error');
      message.textContent = payload.message;
    } catch (error) {
      message.classList.add('is-error');
      message.textContent = error.message;
    } finally {
      message.hidden = false;
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-auto-submit]').forEach((select) => select.addEventListener('change', () => select.form?.submit()));

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

  const revealElements = document.querySelectorAll('[data-reveal], [data-reveal-flip]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { threshold: 0.15 });
    revealElements.forEach((element) => observer.observe(element));
  } else revealElements.forEach((element) => element.classList.add('is-visible'));

  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-carousel-track]');
    const move = (direction) => {
      const slide = track?.querySelector('.carousel__slide');
      track?.scrollBy({ left: direction * ((slide?.getBoundingClientRect().width || 260) + 20), behavior: 'smooth' });
    };
    carousel.querySelector('[data-carousel-prev]')?.addEventListener('click', () => move(-1));
    carousel.querySelector('[data-carousel-next]')?.addEventListener('click', () => move(1));
  });

  const siteHeader = document.querySelector('.site-header');
  const mediaHeroes = document.querySelectorAll('.hero, .collection-hero');
  if (siteHeader) {
    const spacer = document.createElement('div');
    spacer.className = 'site-header__spacer';
    spacer.hidden = true;
    siteHeader.after(spacer);
    const floatsOverHero = mediaHeroes.length > 0;
    const announcement = document.querySelector('.announcement-bar');
    const applyPosition = () => {
      if (!floatsOverHero) return;
      if (siteHeader.classList.contains('site-header--pinned')) siteHeader.removeAttribute('style');
      else Object.assign(siteHeader.style, { position: 'absolute', top: `${announcement?.offsetHeight || 0}px`, left: '0', right: '0' });
    };
    let firstCheck = true;
    const updateHeader = () => {
      const threshold = floatsOverHero ? (announcement?.offsetHeight || 0) : siteHeader.offsetTop;
      const shouldPin = !firstCheck && window.scrollY >= threshold && (floatsOverHero || threshold > 0);
      firstCheck = false;
      siteHeader.classList.toggle('site-header--pinned', shouldPin);
      spacer.hidden = !shouldPin;
      spacer.style.height = shouldPin ? `${siteHeader.offsetHeight}px` : '';
      applyPosition();
      const headerHeight = siteHeader.offsetHeight || 72;
      const overVideo = [...mediaHeroes].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > headerHeight && rect.top < window.innerHeight;
      });
      siteHeader.classList.toggle('site-header--over-video', overVideo);
    };
    let scheduled = false;
    const scheduleHeader = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; updateHeader(); });
    };
    applyPosition();
    updateHeader();
    window.addEventListener('scroll', scheduleHeader, { passive: true });
    window.addEventListener('resize', scheduleHeader);
  }

  const heroSliders = document.querySelectorAll('[data-hero-slider]');
  function activateHeroSlide(hero, nextIndex) {
    const slides = [...hero.querySelectorAll('[data-hero-slide]')];
    const dots = [...hero.querySelectorAll('[data-hero-dot]')];
    if (!slides.length) return;
    const index = ((nextIndex % slides.length) + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === index;
      slide.classList.toggle('is-active', active);
      const player = slide.querySelector('[data-youtube-hero]')?._ytPlayer;
      if (!player || typeof player.playVideo !== 'function') return;
      try { active ? player.playVideo() : player.pauseVideo(); } catch (_error) {}
    });
    dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
    hero._activeIndex = index;
    window.clearTimeout(hero._slideTimer);
    hero._slideTimer = window.setTimeout(() => activateHeroSlide(hero, index + 1), 14000);
  }
  heroSliders.forEach((hero) => {
    hero.querySelector('[data-hero-prev]')?.addEventListener('click', () => activateHeroSlide(hero, (hero._activeIndex || 0) - 1));
    hero.querySelector('[data-hero-next]')?.addEventListener('click', () => activateHeroSlide(hero, (hero._activeIndex || 0) + 1));
    hero.querySelectorAll('[data-hero-dot]').forEach((dot) => dot.addEventListener('click', () => activateHeroSlide(hero, Number(dot.dataset.heroDot))));
    activateHeroSlide(hero, 0);
  });

  const youtubeMounts = [...document.querySelectorAll('[data-youtube-hero]')];
  const youtubePlayers = [];
  let soundMuted = true;
  try { soundMuted = localStorage.getItem('gamehub_sound_muted') !== 'false'; } catch (_error) {}
  const soundToggle = document.getElementById('SoundToggle');
  function updateSoundButton() {
    if (!soundToggle) return;
    soundToggle.hidden = youtubePlayers.length === 0;
    soundToggle.dataset.muted = String(soundMuted);
    soundToggle.setAttribute('aria-label', soundMuted ? 'Ativar som do vídeo' : 'Silenciar vídeo');
  }
  function applySound(player) {
    try { soundMuted ? player.mute() : player.unMute(); } catch (_error) {}
  }
  soundToggle?.addEventListener('click', () => {
    soundMuted = !soundMuted;
    try { localStorage.setItem('gamehub_sound_muted', String(soundMuted)); } catch (_error) {}
    youtubePlayers.forEach(({ player }) => applySound(player));
    updateSoundButton();
  });
  if (youtubeMounts.length) {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previousReady === 'function') previousReady();
      youtubeMounts.forEach((wrap, index) => {
        if (wrap._ytPlayer) return;
        let mount = wrap.querySelector('iframe');
        if (!mount) {
          mount = document.createElement('div');
          mount.id = `youtube-hero-${index}`;
          wrap.appendChild(mount);
        }
        const start = Number.parseInt(wrap.dataset.start, 10) || 0;
        const end = Number.parseInt(wrap.dataset.end, 10) || 0;
        const player = new window.YT.Player(mount, {
          videoId: wrap.dataset.videoId,
          playerVars: { autoplay: wrap.closest('[data-hero-slide]')?.classList.contains('is-active') === false ? 0 : 1, mute: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1, start },
          events: {
            onReady(event) {
              wrap._ytPlayer = event.target;
              youtubePlayers.push({ player: event.target, wrap, start, end });
              applySound(event.target);
              updateSoundButton();
              if (wrap.closest('[data-hero-slide]')?.classList.contains('is-active') === false) event.target.pauseVideo();
            },
            onStateChange(event) {
              if (event.data !== window.YT.PlayerState.ENDED) return;
              const slider = wrap.closest('[data-hero-slider]');
              if (slider) activateHeroSlide(slider, (slider._activeIndex || 0) + 1);
              else { event.target.seekTo(start, true); event.target.playVideo(); }
            }
          }
        });
        wrap._ytPlayer = player;
      });
      window.setInterval(() => youtubePlayers.forEach(({ player, wrap, start, end }) => {
        if (!end) return;
        try {
          if (player.getPlayerState() !== window.YT.PlayerState.PLAYING || player.getCurrentTime() < end) return;
          const slider = wrap.closest('[data-hero-slider]');
          if (slider) activateHeroSlide(slider, (slider._activeIndex || 0) + 1);
          else player.seekTo(start, true);
        } catch (_error) {}
      }), 700);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  }

  const comboBuilder = document.getElementById('ComboBuilder');
  const comboGrid = document.getElementById('ComboBuilderGrid');
  const comboCount = document.getElementById('ComboBuilderCount');
  const comboAdd = document.getElementById('ComboBuilderAdd');
  const comboSelected = new Set();
  function updateCombo() {
    if (comboCount) comboCount.textContent = String(comboSelected.size);
    if (comboAdd) comboAdd.disabled = comboSelected.size !== 6;
    comboGrid?.querySelectorAll('[data-combo-card]').forEach((card) => {
      const selected = comboSelected.has(card.dataset.productId);
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      if (!card.hasAttribute('data-unavailable')) card.disabled = !selected && comboSelected.size >= 6;
    });
  }
  function openCombo() {
    if (!comboBuilder) return;
    comboBuilder.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeCombo() {
    if (!comboBuilder) return;
    comboBuilder.hidden = true;
    if (document.getElementById('CartDrawer')?.hidden !== false) document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-combo-builder-open]').forEach((button) => button.addEventListener('click', openCombo));
  document.querySelectorAll('[data-combo-builder-close]').forEach((button) => button.addEventListener('click', closeCombo));
  comboGrid?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-combo-card]');
    if (!card || card.disabled || card.hasAttribute('data-unavailable')) return;
    comboSelected.has(card.dataset.productId) ? comboSelected.delete(card.dataset.productId) : comboSelected.add(card.dataset.productId);
    updateCombo();
  });
  comboAdd?.addEventListener('click', async () => {
    if (comboSelected.size !== 6) return;
    comboAdd.disabled = true;
    try {
      const cards = [...comboGrid.querySelectorAll('[data-combo-card]')].filter((card) => comboSelected.has(card.dataset.productId));
      const products = await Promise.all(cards.map((card) => fetchProduct(card.dataset.productId)));
      products.forEach((product, index) => addProductToCart(product, cards[index].dataset.platform || product.platforms[0], 1));
      comboSelected.clear();
      updateCombo();
      closeCombo();
      showToast('Seu combo foi adicionado ao carrinho.');
      openDrawer();
    } catch (error) {
      showToast(error.message || 'Não foi possível adicionar o combo.', true);
      updateCombo();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeDrawer();
    closeCombo();
    document.querySelectorAll('[data-platform-picker]').forEach((picker) => { picker.hidden = true; });
  });

  renderCartCount();
  renderDrawer();
  renderCartPage();
  renderCheckoutSummary();
  updateCombo();
})();
