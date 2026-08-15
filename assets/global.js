(function () {
  'use strict';

  /* ---------- Reveal ao rolar a página ---------- */
  var revealEls = document.querySelectorAll('[data-reveal], [data-reveal-flip]');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

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
  var soundMuted = false;
  try {
    var savedSound = localStorage.getItem('gamehub_sound_muted');
    if (savedSound === 'true') soundMuted = true;
  } catch (e) {}

  function applyCurrentSound(player) {
    if (soundMuted) { player.mute(); } else { player.unMute(); }
  }

  /* ---------- Hero: banners múltiplos com setas/pontos ---------- */
  function activateHeroSlide(heroEl, newIndex) {
    var slides = heroEl.querySelectorAll('[data-hero-slide]');
    var dots = heroEl.querySelectorAll('[data-hero-dot]');
    var total = slides.length;
    if (!total) return;
    newIndex = ((newIndex % total) + total) % total;
    slides.forEach(function (slide, i) {
      var isActive = i === newIndex;
      slide.classList.toggle('is-active', isActive);
      var wrap = slide.querySelector('[data-youtube-hero]');
      var player = wrap && wrap._ytPlayer;
      if (!player || typeof player.playVideo !== 'function') return;
      try {
        if (isActive) {
          player.seekTo(parseInt(wrap.getAttribute('data-start'), 10) || 0, true);
          player.playVideo();
          applyCurrentSound(player);
        } else {
          player.pauseVideo();
        }
      } catch (e) {}
    });
    dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === newIndex); });
  }

  document.querySelectorAll('[data-hero-slider]').forEach(function (heroEl) {
    function activeIndex() {
      var slides = heroEl.querySelectorAll('[data-hero-slide]');
      var idx = 0;
      slides.forEach(function (s, i) { if (s.classList.contains('is-active')) idx = i; });
      return idx;
    }
    var prevBtn = heroEl.querySelector('[data-hero-prev]');
    var nextBtn = heroEl.querySelector('[data-hero-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { activateHeroSlide(heroEl, activeIndex() - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { activateHeroSlide(heroEl, activeIndex() + 1); });
    heroEl.querySelectorAll('[data-hero-dot]').forEach(function (dot, i) {
      dot.addEventListener('click', function () { activateHeroSlide(heroEl, i); });
    });
  });

  if (ytHeroEls.length) {
    var ytApiTag = document.createElement('script');
    ytApiTag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(ytApiTag);

    window.onYouTubeIframeAPIReady = function () {
      ytHeroEls.forEach(function (el, index) {
        var videoId = el.getAttribute('data-video-id');
        var start = parseInt(el.getAttribute('data-start'), 10) || 0;
        var end = parseInt(el.getAttribute('data-end'), 10) || 0;
        var slideEl = el.closest('[data-hero-slide]');
        var isActiveSlide = slideEl ? slideEl.classList.contains('is-active') : true;

        var mount = document.createElement('div');
        mount.id = 'youtube-hero-' + index;
        el.appendChild(mount);

        var playerVars = {
          autoplay: isActiveSlide ? 1 : 0,
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
              if (isActiveSlide) e.target.playVideo();
            },
            onStateChange: function (e) {
              if (e.data === window.YT.PlayerState.PLAYING) {
                applyCurrentSound(e.target);
              }
              if (e.data === window.YT.PlayerState.ENDED) {
                var heroEl = el.closest('[data-hero-slider]');
                var currentSlideEl = el.closest('[data-hero-slide]');
                if (heroEl && currentSlideEl && currentSlideEl.classList.contains('is-active')) {
                  var slides = heroEl.querySelectorAll('[data-hero-slide]');
                  var idx = Array.prototype.indexOf.call(slides, currentSlideEl);
                  activateHeroSlide(heroEl, idx + 1);
                } else {
                  e.target.seekTo(start, true);
                  e.target.playVideo();
                }
              }
            }
          }
        });
        el._ytPlayer = player;
        ytPlayers.push(player);
      });

      var soundToggle = document.getElementById('SoundToggle');
      if (soundToggle) soundToggle.hidden = false;
    };

    var startHeroVideosOnInteraction = function () {
      ytHeroEls.forEach(function (el) {
        var player = el._ytPlayer;
        if (!player || typeof player.playVideo !== 'function') return;
        var slideEl = el.closest('[data-hero-slide]');
        if (slideEl && !slideEl.classList.contains('is-active')) return;
        try {
          if (!soundMuted && typeof player.unMute === 'function') player.unMute();
          if (typeof player.getPlayerState === 'function' && player.getPlayerState() === 1) return;
          player.playVideo();
        } catch (e) {}
      });
    };
    ['touchstart', 'click', 'scroll'].forEach(function (evt) {
      document.addEventListener(evt, startHeroVideosOnInteraction, { once: true, passive: true });
    });
  }

  /* ---------- Botão de som (global, estilo WhatsApp) ---------- */
  var soundToggleBtn = document.getElementById('SoundToggle');
  if (soundToggleBtn) {
    soundToggleBtn.setAttribute('data-muted', String(soundMuted));
    soundToggleBtn.setAttribute('aria-label', soundMuted ? 'Ativar som do vídeo' : 'Silenciar vídeo');
    soundToggleBtn.addEventListener('click', function () {
      soundMuted = !soundMuted;
      try { localStorage.setItem('gamehub_sound_muted', String(soundMuted)); } catch (e) {}
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

  /* ---------- Cabeçalho fixo ao rolar + transparente sobre o vídeo do hero ---------- */
  var siteHeaderEl = document.querySelector('.site-header');
  var heroMediaEls = document.querySelectorAll('.hero, .collection-hero');
  if (siteHeaderEl) {
    var headerSpacerEl = document.createElement('div');
    headerSpacerEl.className = 'site-header__spacer';
    headerSpacerEl.style.display = 'none';
    siteHeaderEl.parentNode.insertBefore(headerSpacerEl, siteHeaderEl.nextSibling);

    var isHomeFloatingHeader = heroMediaEls.length > 0;
    var announcementEl = document.querySelector('.announcement-bar');

    var pinThreshold = 0;
    var headerH = siteHeaderEl.offsetHeight || 72;
    var tickingHeaderCheck = false;
    var isFirstCheck = true;

    function applyHomeFloatPosition() {
      if (!isHomeFloatingHeader) return;
      if (siteHeaderEl.classList.contains('site-header--pinned')) {
        siteHeaderEl.style.position = '';
        siteHeaderEl.style.top = '';
        siteHeaderEl.style.left = '';
        siteHeaderEl.style.right = '';
      } else {
        siteHeaderEl.style.position = 'absolute';
        siteHeaderEl.style.top = (announcementEl ? announcementEl.offsetHeight : 0) + 'px';
        siteHeaderEl.style.left = '0';
        siteHeaderEl.style.right = '0';
      }
    }

    function updateHeaderOnScroll() {
      tickingHeaderCheck = false;

      if (!siteHeaderEl.classList.contains('site-header--pinned')) {
        pinThreshold = isHomeFloatingHeader
          ? (announcementEl ? announcementEl.offsetHeight : 0)
          : siteHeaderEl.offsetTop;
      }
      var shouldPin = !isFirstCheck && window.scrollY >= pinThreshold &&
        (isHomeFloatingHeader ? pinThreshold >= 0 : pinThreshold > 0);
      isFirstCheck = false;
      if (shouldPin !== siteHeaderEl.classList.contains('site-header--pinned')) {
        if (shouldPin) {
          headerSpacerEl.style.height = siteHeaderEl.offsetHeight + 'px';
          headerSpacerEl.style.display = 'block';
          siteHeaderEl.classList.add('site-header--pinned');
        } else {
          siteHeaderEl.classList.remove('site-header--pinned');
          headerSpacerEl.style.display = 'none';
        }
        applyHomeFloatPosition();
      }

      var overVideo = false;
      heroMediaEls.forEach(function (el) {
        if (overVideo) return;
        var rect = el.getBoundingClientRect();
        if (rect.bottom > headerH && rect.top < window.innerHeight) overVideo = true;
      });
      siteHeaderEl.classList.toggle('site-header--over-video', overVideo);
    }

    applyHomeFloatPosition();

    function requestHeaderCheck() {
      if (tickingHeaderCheck) return;
      tickingHeaderCheck = true;
      requestAnimationFrame(updateHeaderOnScroll);
    }

    window.addEventListener('scroll', requestHeaderCheck, { passive: true });
    window.addEventListener('resize', requestHeaderCheck);
    updateHeaderOnScroll();
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
  var thumbnailButtons = document.querySelectorAll('[data-thumbnail]');
  thumbnailButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var featured = document.getElementById('ProductFeaturedImage');
      var url = button.getAttribute('data-image-url');
      if (featured && url) featured.src = url;
      thumbnailButtons.forEach(function (b) { b.classList.remove('is-active'); });
      button.classList.add('is-active');
    });
  });

  /* ---------- Product page: quantidade ---------- */
  document.querySelectorAll('.product-page__qty').forEach(function (qty) {
    var input = qty.querySelector('[data-qty-input]');
    var minus = qty.querySelector('[data-qty-minus]');
    var plus = qty.querySelector('[data-qty-plus]');
    if (!input) return;
    if (minus) minus.addEventListener('click', function () {
      var value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      input.value = value;
    });
    if (plus) plus.addEventListener('click', function () {
      var value = (parseInt(input.value, 10) || 1) + 1;
      input.value = value;
    });
  });

  /* ---------- Product page: adicionar ao carrinho / comprar agora ---------- */
  var productForm = document.getElementById('ProductForm');
  if (productForm) {
    productForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var platformGroup = productForm.querySelector('[data-platform-group]');
      if (platformGroup) {
        var chosenPlatform = platformGroup.querySelector('[data-option-value][aria-pressed="true"]');
        if (!chosenPlatform) {
          var warning = platformGroup.querySelector('[data-platform-warning]');
          if (warning) warning.hidden = false;
          platformGroup.classList.remove('has-error');
          void platformGroup.offsetWidth;
          platformGroup.classList.add('has-error');
          platformGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      var submitter = event.submitter;
      var isBuyNow = submitter && submitter.hasAttribute('data-buy-now');
      var variantId = productForm.querySelector('[data-variant-select]').value;
      var quantityInput = productForm.querySelector('[data-qty-input], #Quantity');
      var quantity = quantityInput ? parseInt(quantityInput.value, 10) || 1 : 1;

      if (submitter) submitter.disabled = true;

      var payload = { id: variantId, quantity: quantity };
      if (platformGroup) {
        var selected = platformGroup.querySelector('[data-option-value][aria-pressed="true"]');
        if (selected) payload.properties = { 'Plataforma': selected.getAttribute('data-option-value') };
      }

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json(); })
        .then(function () {
          if (isBuyNow) {
            window.location.href = '/checkout';
            return;
          }
          return fetch('/cart.js')
            .then(function (res) { return res.json(); })
            .then(function (cart) {
              updateCartCount(cart.item_count);
              openCartDrawer();
            });
        })
        .catch(function (err) { console.error('Erro ao adicionar ao carrinho', err); })
        .finally(function () { if (submitter) submitter.disabled = false; });
    });
  }

  /* ---------- Product page: option selection (visual only) ---------- */
  document.querySelectorAll('.product-page__option').forEach(function (optionGroup) {
    var isPlatformGroup = optionGroup.hasAttribute('data-platform-group');
    var buttons = optionGroup.querySelectorAll('[data-option-value]');
    buttons.forEach(function (button, index) {
      if (index === 0 && !isPlatformGroup) button.setAttribute('aria-pressed', 'true');
      button.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        button.setAttribute('aria-pressed', 'true');
        if (isPlatformGroup) {
          optionGroup.classList.remove('has-error');
          var warning = optionGroup.querySelector('[data-platform-warning]');
          if (warning) warning.hidden = true;
        }
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

  /* ---------- Product card: seletor rapido de plataforma ---------- */
  var pendingPlatformButton = null;

  function openPlatformPicker(button) {
    var actions = button.closest('.product-card__actions');
    var picker = actions && actions.querySelector('[data-platform-picker]');
    if (!picker) return false;
    pendingPlatformButton = button;
    picker.hidden = false;
    return true;
  }

  function closePlatformPicker(picker) {
    if (picker) picker.hidden = true;
    pendingPlatformButton = null;
  }

  document.addEventListener('click', function (event) {
    var option = event.target.closest('[data-platform-option]');
    if (option) {
      var picker = option.closest('[data-platform-picker]');
      var actions = picker.closest('.product-card__actions');
      var platform = option.getAttribute('data-platform-option');
      var toResume = pendingPlatformButton;
      actions.querySelectorAll('[data-needs-platform]').forEach(function (btn) {
        btn.dataset.chosenPlatform = platform;
      });
      closePlatformPicker(picker);
      if (toResume) toResume.click();
      return;
    }
    var closeBtn = event.target.closest('[data-platform-picker-close]');
    if (closeBtn) {
      closePlatformPicker(closeBtn.closest('[data-platform-picker]'));
    }
  });

  /* ---------- Add to cart (product card + product page) ---------- */
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-add-to-cart]');
    if (!button || button.disabled) return;

    if (button.hasAttribute('data-needs-platform') && !button.dataset.chosenPlatform) {
      openPlatformPicker(button);
      return;
    }

    var variantId = button.getAttribute('data-variant-id');
    if (!variantId) return;

    button.disabled = true;

    var payload = { id: variantId, quantity: 1 };
    if (button.dataset.chosenPlatform) {
      payload.properties = { 'Plataforma': button.dataset.chosenPlatform };
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

  /* ---------- Comprar agora (cards de produto: direto pro checkout) ---------- */
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-buy-now]');
    if (!button || button.disabled || button.closest('#ProductForm')) return;

    if (button.hasAttribute('data-needs-platform') && !button.dataset.chosenPlatform) {
      openPlatformPicker(button);
      return;
    }

    var variantId = button.getAttribute('data-variant-id');
    if (!variantId) return;

    button.disabled = true;

    var payload = { id: variantId, quantity: 1 };
    if (button.dataset.chosenPlatform) {
      payload.properties = { 'Plataforma': button.dataset.chosenPlatform };
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function () { window.location.href = '/checkout'; })
      .catch(function (err) {
        console.error('Erro ao comprar', err);
        button.disabled = false;
      });
  });

  /* ---------- Combo builder ---------- */
  var comboBuilder = document.getElementById('ComboBuilder');
  var comboGrid = document.getElementById('ComboBuilderGrid');
  var comboCountEl = document.getElementById('ComboBuilderCount');
  var comboAddBtn = document.getElementById('ComboBuilderAdd');
  var COMBO_TARGET = 6;
  var comboSelected = [];

  function openComboBuilder() {
    if (!comboBuilder) return;
    comboBuilder.hidden = false;
  }

  function closeComboBuilder() {
    if (!comboBuilder) return;
    comboBuilder.hidden = true;
  }

  function updateComboFooter() {
    if (comboCountEl) comboCountEl.textContent = String(comboSelected.length);
    if (comboAddBtn) comboAddBtn.disabled = comboSelected.length !== COMBO_TARGET;
    if (comboGrid) {
      var atLimit = comboSelected.length >= COMBO_TARGET;
      comboGrid.querySelectorAll('[data-combo-card]').forEach(function (card) {
        if (card.hasAttribute('data-unavailable')) return;
        var id = card.getAttribute('data-variant-id');
        var isSelected = comboSelected.indexOf(id) !== -1;
        card.disabled = !isSelected && atLimit;
      });
    }
  }

  function resetComboSelection() {
    comboSelected = [];
    if (comboGrid) {
      comboGrid.querySelectorAll('[data-combo-card]').forEach(function (card) {
        card.classList.remove('is-selected');
        card.setAttribute('aria-pressed', 'false');
        if (!card.hasAttribute('data-unavailable')) card.disabled = false;
      });
    }
    updateComboFooter();
  }

  document.querySelectorAll('[data-combo-builder-open]').forEach(function (el) {
    el.addEventListener('click', openComboBuilder);
  });
  document.querySelectorAll('[data-combo-builder-close]').forEach(function (el) {
    el.addEventListener('click', closeComboBuilder);
  });

  if (comboGrid) {
    comboGrid.addEventListener('click', function (event) {
      var card = event.target.closest('[data-combo-card]');
      if (!card || card.disabled) return;
      var id = card.getAttribute('data-variant-id');
      if (!id) return;
      var idx = comboSelected.indexOf(id);
      if (idx === -1) {
        comboSelected.push(id);
        card.classList.add('is-selected');
        card.setAttribute('aria-pressed', 'true');
      } else {
        comboSelected.splice(idx, 1);
        card.classList.remove('is-selected');
        card.setAttribute('aria-pressed', 'false');
      }
      updateComboFooter();
    });
  }

  if (comboAddBtn) {
    comboAddBtn.addEventListener('click', function () {
      if (comboSelected.length !== COMBO_TARGET) return;
      comboAddBtn.disabled = true;

      var items = comboSelected.map(function (id) {
        return { id: id, quantity: 1 };
      });

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
      })
        .then(function (res) { return res.json(); })
        .then(function () { return fetch('/cart.js'); })
        .then(function (res) { return res.json(); })
        .then(function (cart) {
          updateCartCount(cart.item_count);
          closeComboBuilder();
          resetComboSelection();
          openCartDrawer();
        })
        .catch(function (err) { console.error('Erro ao adicionar combo ao carrinho', err); })
        .finally(function () { comboAddBtn.disabled = comboSelected.length !== COMBO_TARGET; });
    });
  }

  /* ---------- Cart page: quantity update ---------- */
  document.querySelectorAll('[data-cart-quantity]').forEach(function (input) {
    input.addEventListener('change', function () {
      var form = input.closest('form');
      if (form) form.submit();
    });
  });

  document.querySelectorAll('.cart-page__qty').forEach(function (qty) {
    var input = qty.querySelector('[data-cart-quantity]');
    var minus = qty.querySelector('[data-cart-page-qty-minus]');
    var plus = qty.querySelector('[data-cart-page-qty-plus]');
    if (!input) return;
    if (minus) minus.addEventListener('click', function () {
      input.value = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
      input.dispatchEvent(new Event('change'));
    });
    if (plus) plus.addEventListener('click', function () {
      input.value = (parseInt(input.value, 10) || 0) + 1;
      input.dispatchEvent(new Event('change'));
    });
  });
})();
