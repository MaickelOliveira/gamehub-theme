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

  /* ---------- Hero: YouTube background loop ---------- */
  var ytHeroEls = document.querySelectorAll('[data-youtube-hero]');
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

        new window.YT.Player(mount.id, {
          videoId: videoId,
          playerVars: playerVars,
          events: {
            onReady: function (e) {
              e.target.mute();
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
      });
    };
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
          cartDrawerContent.innerHTML = '<p>Seu carrinho está vazio.</p>';
          return;
        }
        var html = '<ul class="cart-drawer__items">';
        cart.items.forEach(function (item) {
          html += '' +
            '<li class="cart-drawer__item">' +
              '<img src="' + item.image + '&width=150" alt="" width="60" height="60">' +
              '<div><p>' + item.product_title + '</p>' +
              '<p>' + item.quantity + ' &times; ' + formatMoney(item.price) + '</p></div>' +
            '</li>';
        });
        html += '</ul>';
        html += '<p><strong>Total: ' + formatMoney(cart.total_price) + '</strong></p>';
        html += '<a href="/cart" class="button button--secondary">Ver carrinho</a> ';
        html += '<a href="/checkout" class="button button--primary">Finalizar compra</a>';
        cartDrawerContent.innerHTML = html;
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
