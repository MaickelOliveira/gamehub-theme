(function () {
  'use strict';

  /* ---------- Mobile menu ---------- */
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var mobileNav = document.getElementById('MobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', function () {
      var isOpen = !mobileNav.hidden;
      mobileNav.hidden = isOpen;
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  /* ---------- Hero: YouTube background loop + som + players ---------- */
  var ytHeroEls = document.querySelectorAll('[data-youtube-hero]');
  var ytPlayers = [];
  var soundMuted = true;

  function applyCurrentSound(player) {
    if (soundMuted) { player.mute(); } else { player.unMute(); }
  }

  if (ytHeroEls.length) {
    var ytApiTag = document.createElement('script');
    ytApiTag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(ytApiTag);

    window.onYouTubeIframeAPIReady = function () {
      ytHeroEls.forEach(function (el, index) {
        var videoId = el.getAttribute('data-video-id');
        var start = parseInt(el.getAttribute('data-start'), 10) || 0;
        var end = parseInt(el.getAttribute('data-end'), 10) || 0;

        var mount = document.createElement('div');
        mount.id = 'youtube-hero-' + index;
        el.appendChild(mount);

        var playerVars = {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          start: start
        };
        if (end > start) playerVars.end = end;

        var player = new window.YT.Player(mount.id, {
          videoId: videoId,
          playerVars: playerVars,
          events: {
            onReady: function (e) {
              applyCurrentSound(e.target);
              e.target.playVideo();
            },
            onStateChange: function (e) {
              if (e.data === window.YT.PlayerState.ENDED) {
                e.target.seekTo(start, true);
                e.target.playVideo();
              }
            }
          }
        });
        ytPlayers.push(player);
      });

      var soundToggle = document.getElementById('SoundToggle');
      if (soundToggle) soundToggle.hidden = false;
    };
  }

  /* ---------- Botão de som (global, estilo WhatsApp) ---------- */
  var soundToggleBtn = document.getElementById('SoundToggle');
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', function () {
      soundMuted = soundToggleBtn.getAttribute('data-muted') !== 'false';
      soundMuted = !soundMuted;
      soundToggleBtn.setAttribute('data-muted', String(soundMuted));
      soundToggleBtn.setAttribute('aria-label', soundMuted ? 'Ativar som do vídeo' : 'Silenciar vídeo');
      ytPlayers.forEach(function (player) {
        if (!player || typeof player.mute !== 'function') return;
        if (soundMuted) { player.mute(); } else { player.unMute(); }
      });
    });
  }

  /* ---------- Modo claro/escuro ---------- */
  var themeToggle = document.getElementById('ThemeToggle');
  if (themeToggle) {
    function currentTheme() {
      var stamped = document.documentElement.getAttribute('data-theme');
      if (stamped) return stamped;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    themeToggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('gamehub_theme', next); } catch (e) {}
    });
  }

  /* ---------- Cabeçalho transparente sobre o vídeo do hero ---------- */
  var siteHeaderEl = document.querySelector('.site-header');
  var heroMediaEls = document.querySelectorAll('.hero, .collection-hero');
  if (siteHeaderEl && heroMediaEls.length) {
    var headerH = siteHeaderEl.offsetHeight || 72;
    var tickingHeaderCheck = false;

    function updateHeaderOverVideo() {
      tickingHeaderCheck = false;
      var overVideo = false;
      heroMediaEls.forEach(function (el) {
        if (overVideo) return;
        var rect = el.getBoundingClientRect();
        if (rect.bottom > headerH && rect.top < window.innerHeight) overVideo = true;
      });
      siteHeaderEl.classList.toggle('site-header--over-video', overVideo);
    }

    function requestHeaderCheck() {
      if (tickingHeaderCheck) return;
      tickingHeaderCheck = true;
      requestAnimationFrame(updateHeaderOverVideo);
    }

    window.addEventListener('scroll', requestHeaderCheck, { passive: true });
    window.addEventListener('resize', requestHeaderCheck);
    updateHeaderOverVideo();
  }

  /* ---------- Carousels ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-carousel-track]');
    var prev = carousel.querySelector('[data-carousel-prev]');
    var next = carousel.querySelector('[data-carousel-next]');
    if (!track) return;

    function scrollByAmount(direction) {
      var slide = track.querySelector('.carousel__slide');
      var amount = slide ? slide.getBoundingClientRect().width + 20 : 260;
      track.scrollBy({ left: direction * amount, behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
    if (next) next.addEventListener('click', function () { scrollByAmount(1); });
  });

  /* ---------- Product page: thumbnails ---------- */
  document.querySelectorAll('[data-thumbnail]').forEach(function (button) {
    button.addEventListener('click', function () {
      var featured = document.getElementById('ProductFeaturedImage');
      var url = button.getAttribute('data-image-url');
      if (featured && url) featured.src = url;
    });
  });

  /* ---------- Product page: option selection (visual only) ---------- */
  document.querySelectorAll('.product-page__option').forEach(function (optionGroup) {
    var buttons = optionGroup.querySelectorAll('[data-option-value]');
    buttons.forEach(function (button, index) {
      if (index === 0) button.setAttribute('aria-pressed', 'true');
      button.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        button.setAttribute('aria-pressed', 'true');
      });
    });
  });

  /* ---------- Cart drawer ---------- */
  var cartDrawer = document.getElementById('CartDrawer');
  var cartDrawerContent = document.getElementById('CartDrawerContent');
  var cartCountEls = document.querySelectorAll('[data-cart-count]');

  function openCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.hidden = false;
    renderCartDrawer();
  }

  function closeCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.hidden = true;
  }

  document.querySelectorAll('[data-cart-drawer-open]').forEach(function (el) {
    el.addEventListener('click', openCartDrawer);
  });
  document.querySelectorAll('[data-cart-drawer-close]').forEach(function (el) {
    el.addEventListener('click', closeCartDrawer);
  });

  function renderCartDrawer() {
    if (!cartDrawerContent) return;
    fetch('/cart.js')
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        if (cart.items.length === 0) {
          cartDrawerContent.innerHTML =
            '<div class="cart-drawer__empty">' +
              '<p>Seu carrinho está vazio.</p>' +
              '<a href="/collections/all" class="button button--primary">Ver jogos</a>' +
            '</div>';
          return;
        }
        var html = '<ul class="cart-drawer__items">';
        cart.items.forEach(function (item) {
          html += '' +
            '<li class="cart-drawer__item" data-cart-line-key="' + item.key + '">' +
              '<div class="cart-drawer__item-media"><img src="' + item.image + '&width=150" alt="" width="64" height="64"></div>' +
              '<div class="cart-drawer__item-info">' +
                '<p class="cart-drawer__item-title">' + item.product_title + '</p>' +
                '<p class="cart-drawer__item-price">' + item.quantity + ' &times; <strong>' + formatMoney(item.price) + '</strong></p>' +
                '<div class="cart-drawer__qty">' +
                  '<button type="button" data-cart-qty-decrease aria-label="Diminuir quantidade">&minus;</button>' +
                  '<span>' + item.quantity + '</span>' +
                  '<button type="button" data-cart-qty-increase aria-label="Aumentar quantidade">+</button>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="cart-drawer__item-remove" data-cart-remove aria-label="Remover item">&times;</button>' +
            '</li>';
        });
        html += '</ul>';
        html += '' +
          '<div class="cart-drawer__footer">' +
            '<div class="cart-drawer__subtotal"><span>Subtotal</span><span>' + formatMoney(cart.total_price) + '</span></div>' +
            '<a href="/cart" class="button button--secondary">Ver carrinho</a>' +
            '<a href="/checkout" class="button button--primary">Finalizar compra</a>' +
          '</div>';
        cartDrawerContent.innerHTML = html;
      });
  }

  function changeCartLineQuantity(key, quantity) {
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        updateCartCount(cart.item_count);
        renderCartDrawer();
      })
      .catch(function (err) { console.error('Erro ao atualizar carrinho', err); });
  }

  if (cartDrawerContent) {
    cartDrawerContent.addEventListener('click', function (event) {
      var line = event.target.closest('[data-cart-line-key]');
      if (!line) return;
      var key = line.getAttribute('data-cart-line-key');
      var qtyEl = line.querySelector('.cart-drawer__qty span');
      var currentQty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;

      if (event.target.closest('[data-cart-qty-increase]')) {
        changeCartLineQuantity(key, currentQty + 1);
      } else if (event.target.closest('[data-cart-qty-decrease]')) {
        changeCartLineQuantity(key, Math.max(0, currentQty - 1));
      } else if (event.target.closest('[data-cart-remove]')) {
        changeCartLineQuantity(key, 0);
      }
    });
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function updateCartCount(count) {
    cartCountEls.forEach(function (el) { el.textContent = count; });
  }

  /* ---------- Add to cart (product card + product page) ---------- */
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-add-to-cart]');
    if (!button || button.disabled) return;

    var variantId = button.getAttribute('data-variant-id');
    if (!variantId) return;

    button.disabled = true;

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    })
      .then(function (res) { return res.json(); })
      .then(function () { return fetch('/cart.js'); })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        updateCartCount(cart.item_count);
        openCartDrawer();
      })
      .catch(function (err) { console.error('Erro ao adicionar ao carrinho', err); })
      .finally(function () { button.disabled = false; });
  });

  /* ---------- Cart page: quantity update ---------- */
  document.querySelectorAll('[data-cart-quantity]').forEach(function (input) {
    input.addEventListener('change', function () {
      var form = input.closest('form');
      if (form) form.submit();
    });
  });
})();
