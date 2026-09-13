const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const multer = require('multer');
const { db, databasePath, getSettings, updateSettings, mapProduct } = require('./src/database');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const adminCookie = 'gamehub_admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = process.env.SESSION_SECRET || adminPassword || crypto.randomBytes(32).toString('hex');
const uploadDirectory = path.join(process.env.DATA_DIR || path.join(process.cwd(), '.data'), 'uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ['https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use('/theme-assets', express.static(path.join(process.cwd(), 'assets'), { maxAge: isProduction ? '7d' : 0 }));
app.use('/uploads', express.static(uploadDirectory, { maxAge: isProduction ? '7d' : 0 }));
app.use(express.static(path.join(process.cwd(), 'public'), { maxAge: isProduction ? '1h' : 0 }));

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de acesso. Tente novamente mais tarde.' }
});

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function formatMoney(cents) {
  return moneyFormatter.format(Number(cents || 0) / 100);
}

function discountPercent(product) {
  if (!product.compare_at_price_cents || product.compare_at_price_cents <= product.price_cents) return 0;
  return Math.round((1 - product.price_cents / product.compare_at_price_cents) * 100);
}

function cleanText(value, maximum = 500) {
  return String(value ?? '').trim().slice(0, maximum);
}

function slugify(value) {
  return cleanText(value, 120)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `produto-${Date.now()}`;
}

function serializeProduct(product) {
  const mapped = mapProduct(product);
  if (!mapped) return null;
  delete mapped.platforms_json;
  return mapped;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminToken() {
  const expires = Date.now() + (12 * 60 * 60 * 1000);
  const payload = String(expires);
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  const [expires, signature] = String(token || '').split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(expires).digest('hex');
  return safeEqual(signature, expected);
}

function requireAdmin(req, res, next) {
  if (!verifyAdminToken(req.cookies[adminCookie])) {
    return res.status(401).json({ error: 'Acesso administrativo necessario.' });
  }
  next();
}

function pageData(req, extra = {}) {
  return {
    currentPath: req.path,
    settings: getSettings(),
    formatMoney,
    discountPercent,
    ...extra
  };
}

function getActiveProducts(limit) {
  const sql = `SELECT * FROM products WHERE active = 1 ORDER BY featured DESC, created_at DESC${limit ? ' LIMIT ?' : ''}`;
  const rows = limit ? db.prepare(sql).all(limit) : db.prepare(sql).all();
  return rows.map(mapProduct);
}

function getOrder(publicNumber, token) {
  const order = db.prepare('SELECT * FROM orders WHERE public_number = ? AND access_token = ?').get(publicNumber, token);
  if (!order) return null;
  return {
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid').all(order.id)
  };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: path.basename(databasePath) });
});

app.get('/', (req, res) => {
  const products = getActiveProducts();
  const launches = products.filter((product) => product.category === 'lancamentos').slice(0, 8);
  const preorders = products.filter((product) => product.category === 'pre-vendas').slice(0, 8);
  const ready = products.filter((product) => product.category === 'pronta-entrega').slice(0, 10);
  const platformCounts = {};
  for (const product of products) {
    for (const platform of product.platforms) platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  }

  res.render('home', pageData(req, { title: 'GameHub — sua próxima aventura começa aqui', launches, preorders, ready, platformCounts }));
});

app.get('/catalogo', (req, res) => {
  const query = cleanText(req.query.q, 80);
  const category = cleanText(req.query.category, 40);
  const platform = cleanText(req.query.platform, 20).toUpperCase();
  const conditions = ['active = 1'];
  const parameters = [];

  if (query) {
    conditions.push('(name LIKE ? OR description LIKE ? OR sku LIKE ?)');
    const pattern = `%${query}%`;
    parameters.push(pattern, pattern, pattern);
  }
  if (category) {
    conditions.push('category = ?');
    parameters.push(category);
  }

  let products = db.prepare(`SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY featured DESC, created_at DESC`).all(...parameters).map(mapProduct);
  if (platform) products = products.filter((product) => product.platforms.map((item) => item.toUpperCase()).includes(platform));

  res.render('catalog', pageData(req, {
    title: query ? `Busca por ${query}` : 'Catálogo completo',
    products,
    filters: { query, category, platform }
  }));
});

app.get('/produto/:slug', (req, res) => {
  const product = mapProduct(db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(req.params.slug));
  if (!product) return res.status(404).render('message', pageData(req, { title: 'Produto não encontrado', message: 'Este produto não está disponível.' }));
  const related = getActiveProducts().filter((item) => item.id !== product.id && (item.category === product.category || item.platforms.some((platform) => product.platforms.includes(platform)))).slice(0, 5);
  res.render('product', pageData(req, { title: product.name, product, related }));
});

app.get('/carrinho', (req, res) => {
  res.render('cart', pageData(req, { title: 'Seu carrinho' }));
});

app.get('/checkout', (req, res) => {
  res.render('checkout', pageData(req, { title: 'Finalizar compra' }));
});

app.get('/pedido/:publicNumber', (req, res) => {
  const order = getOrder(req.params.publicNumber, cleanText(req.query.token, 100));
  if (!order) return res.status(404).render('message', pageData(req, { title: 'Pedido não encontrado', message: 'Confira o link recebido ao finalizar a compra.' }));
  res.render('order', pageData(req, { title: `Pedido ${order.public_number}`, order }));
});

app.get('/admin', (req, res) => {
  res.render('admin', pageData(req, { title: 'Painel administrativo', adminConfigured: Boolean(adminPassword) }));
});

app.get('/api/products', (req, res) => {
  const includeInactive = req.query.all === '1' && verifyAdminToken(req.cookies[adminCookie]);
  const rows = db.prepare(`SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY featured DESC, created_at DESC`).all();
  res.json({ products: rows.map(serializeProduct) });
});

app.get('/api/products/:id', (req, res) => {
  const product = serializeProduct(db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json({ product });
});

app.post('/api/orders', checkoutLimiter, (req, res) => {
  try {
    const customer = req.body.customer || {};
    const customerName = cleanText(customer.name, 120);
    const customerEmail = cleanText(customer.email, 180).toLowerCase();
    const customerPhone = cleanText(customer.phone, 30);
    const customerDocument = cleanText(customer.document, 30);
    const customerNotes = cleanText(customer.notes, 500);
    const paymentMethod = req.body.payment_method === 'contact' ? 'contact' : 'pix';
    const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 30) : [];

    if (customerName.length < 3) throw new Error('Informe seu nome completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error('Informe um e-mail válido.');
    if (customerPhone.replace(/\D/g, '').length < 10) throw new Error('Informe um telefone válido.');
    if (rawItems.length === 0) throw new Error('Seu carrinho está vazio.');

    const settings = getSettings();
    const grouped = new Map();
    for (const item of rawItems) {
      const productId = cleanText(item.product_id, 100);
      const platform = cleanText(item.platform, 30).toUpperCase();
      const quantity = Math.max(1, Math.min(10, Number.parseInt(item.quantity, 10) || 1));
      const key = `${productId}:${platform}`;
      grouped.set(key, { productId, platform, quantity: (grouped.get(key)?.quantity || 0) + quantity });
    }

    const createOrder = db.transaction(() => {
      const normalizedItems = [];
      let subtotal = 0;

      for (const item of grouped.values()) {
        const product = mapProduct(db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.productId));
        if (!product) throw new Error('Um produto do carrinho não está mais disponível.');
        if (!product.platforms.map((value) => value.toUpperCase()).includes(item.platform)) throw new Error(`Escolha uma plataforma válida para ${product.name}.`);
        if (item.quantity > product.stock) throw new Error(`Estoque insuficiente para ${product.name}.`);
        const itemSubtotal = product.price_cents * item.quantity;
        subtotal += itemSubtotal;
        normalizedItems.push({ product, platform: item.platform, quantity: item.quantity, subtotal: itemSubtotal });
      }

      let couponDiscount = 0;
      let couponCode = cleanText(req.body.coupon_code, 40).toUpperCase();
      if (couponCode) {
        const coupon = db.prepare(`
          SELECT * FROM coupons
          WHERE code = ? AND active = 1 AND minimum_cents <= ?
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `).get(couponCode, subtotal);
        if (!coupon) throw new Error('Cupom inválido, expirado ou abaixo do valor mínimo.');
        couponDiscount = coupon.kind === 'percentage'
          ? Math.round(subtotal * Math.min(coupon.value, 100) / 100)
          : Math.min(coupon.value, subtotal);
      } else {
        couponCode = null;
      }

      const afterCoupon = subtotal - couponDiscount;
      const pixPercent = paymentMethod === 'pix' ? Math.max(0, Math.min(30, Number(settings.pix_discount_percent || 0))) : 0;
      const pixDiscount = Math.round(afterCoupon * pixPercent / 100);
      const discount = couponDiscount + pixDiscount;
      const total = Math.max(0, subtotal - discount);
      const id = crypto.randomUUID();
      const accessToken = crypto.randomBytes(24).toString('hex');
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const publicNumber = `GH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${suffix}`;

      db.prepare(`
        INSERT INTO orders (
          id, public_number, access_token, payment_method,
          customer_name, customer_email, customer_phone, customer_document, customer_notes,
          subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code, pix_key_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
        id, publicNumber, accessToken, paymentMethod,
        customerName, customerEmail, customerPhone, customerDocument, customerNotes,
        subtotal, discount, total, couponCode, settings.pix_key || ''
      );

      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, sku, name, platform, quantity, unit_price_cents, subtotal_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const decrementStock = db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?');

      for (const item of normalizedItems) {
        const changed = decrementStock.run(item.quantity, item.product.id, item.quantity);
        if (changed.changes !== 1) throw new Error(`O estoque de ${item.product.name} acabou durante a compra.`);
        insertItem.run(
          crypto.randomUUID(), id, item.product.id, item.product.sku, item.product.name,
          item.platform, item.quantity, item.product.price_cents, item.subtotal
        );
      }

      return { publicNumber, accessToken, total, pixKey: settings.pix_key || '', whatsapp: settings.whatsapp || '' };
    });

    const order = createOrder();
    res.status(201).json({
      order: {
        public_number: order.publicNumber,
        total_cents: order.total,
        pix_key: order.pixKey,
        whatsapp: order.whatsapp,
        url: `/pedido/${encodeURIComponent(order.publicNumber)}?token=${encodeURIComponent(order.accessToken)}`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar o pedido.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  if (!adminPassword) return res.status(503).json({ error: 'Defina ADMIN_PASSWORD no EasyPanel para ativar o painel.' });
  if (!safeEqual(cleanText(req.body.password, 300), adminPassword)) return res.status(401).json({ error: 'Senha incorreta.' });

  res.cookie(adminCookie, createAdminToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/'
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie(adminCookie, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ configured: Boolean(adminPassword), authenticated: verifyAdminToken(req.cookies[adminCookie]) });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY active DESC, created_at DESC').all().map(serializeProduct);
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300').all().map((order) => ({
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid').all(order.id)
  }));
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_cents ELSE 0 END), 0) AS paid_total_cents,
      COALESCE(SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM orders
  `).get();
  res.json({ settings: getSettings(), products, orders, coupons, totals });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extensions[file.mimetype] || ''}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype))
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie uma imagem JPG, PNG, WebP ou AVIF de até 5 MB.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const product = normalizeProductInput(req.body);
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO products (
        id, slug, sku, name, description, category, platforms_json,
        price_cents, compare_at_price_cents, stock, image_url, featured, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, product.slug, product.sku, product.name, product.description, product.category, JSON.stringify(product.platforms), product.price, product.compare, product.stock, product.image, product.featured, product.active);
    res.status(201).json({ product: serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
  } catch (error) {
    res.status(400).json({ error: databaseErrorMessage(error) });
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const product = normalizeProductInput(req.body);
    const result = db.prepare(`
      UPDATE products SET
        slug = ?, sku = ?, name = ?, description = ?, category = ?, platforms_json = ?,
        price_cents = ?, compare_at_price_cents = ?, stock = ?, image_url = ?, featured = ?, active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(product.slug, product.sku, product.name, product.description, product.category, JSON.stringify(product.platforms), product.price, product.compare, product.stock, product.image, product.featured, product.active, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json({ product: serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
  } catch (error) {
    res.status(400).json({ error: databaseErrorMessage(error) });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const status = cleanText(req.body.status, 40);
  const paymentStatus = cleanText(req.body.payment_status, 40);
  const validStatuses = ['awaiting_payment', 'processing', 'completed', 'cancelled'];
  const validPayments = ['pending', 'paid', 'refunded', 'cancelled'];
  if (!validStatuses.includes(status) || !validPayments.includes(paymentStatus)) return res.status(400).json({ error: 'Status inválido.' });

  const updateOrder = db.transaction(() => {
    const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!current) return null;
    if (status === 'cancelled' && current.status !== 'cancelled') {
      const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(current.id);
      const restock = db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      for (const item of items) if (item.product_id) restock.run(item.quantity, item.product_id);
    }
    db.prepare('UPDATE orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, paymentStatus, current.id);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(current.id);
  });

  const order = updateOrder();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json({ order });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const values = {};
  for (const key of ['store_name', 'announcement', 'support_email', 'whatsapp', 'pix_key', 'pix_discount_percent', 'currency']) {
    if (Object.hasOwn(req.body, key)) values[key] = cleanText(req.body[key], 300);
  }
  res.json({ settings: updateSettings(values) });
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  try {
    const code = cleanText(req.body.code, 40).toUpperCase();
    const kind = req.body.kind === 'fixed' ? 'fixed' : 'percentage';
    const value = Number.parseInt(req.body.value, 10);
    const minimum = Math.max(0, Number.parseInt(req.body.minimum_cents, 10) || 0);
    const expires = cleanText(req.body.expires_at, 40) || null;
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('Use um código com pelo menos 3 letras ou números.');
    if (!Number.isFinite(value) || value <= 0 || (kind === 'percentage' && value > 100)) throw new Error('Valor de cupom inválido.');
    db.prepare(`
      INSERT INTO coupons (code, kind, value, minimum_cents, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET kind = excluded.kind, value = excluded.value,
        minimum_cents = excluded.minimum_cents, expires_at = excluded.expires_at, active = 1
    `).run(code, kind, value, minimum, expires);
    res.status(201).json({ coupon: db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Cupom inválido.' });
  }
});

app.patch('/api/admin/coupons/:code', requireAdmin, (req, res) => {
  const active = req.body.active ? 1 : 0;
  const result = db.prepare('UPDATE coupons SET active = ? WHERE code = ?').run(active, req.params.code.toUpperCase());
  if (!result.changes) return res.status(404).json({ error: 'Cupom não encontrado.' });
  res.json({ ok: true });
});

function normalizeProductInput(input) {
  const name = cleanText(input.name, 160);
  const sku = cleanText(input.sku, 80).toUpperCase();
  const platforms = [...new Set((Array.isArray(input.platforms) ? input.platforms : String(input.platforms || '').split(','))
    .map((value) => cleanText(value, 20).toUpperCase()).filter(Boolean))];
  const price = Number.parseInt(input.price_cents, 10);
  const compareValue = Number.parseInt(input.compare_at_price_cents, 10);
  const compare = Number.isFinite(compareValue) && compareValue > price ? compareValue : null;
  const stock = Math.max(0, Number.parseInt(input.stock, 10) || 0);
  if (name.length < 2) throw new Error('Informe o nome do produto.');
  if (!sku) throw new Error('Informe o SKU.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Informe um preço válido.');
  if (!platforms.length) throw new Error('Informe pelo menos uma plataforma.');
  return {
    name,
    slug: slugify(input.slug || name),
    sku,
    description: cleanText(input.description, 5000),
    category: ['lancamentos', 'pre-vendas', 'pronta-entrega'].includes(input.category) ? input.category : 'pronta-entrega',
    platforms,
    price,
    compare,
    stock,
    image: cleanText(input.image_url, 500),
    featured: input.featured ? 1 : 0,
    active: input.active === false || input.active === 0 ? 0 : 1
  };
}

function databaseErrorMessage(error) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('products.slug')) return 'Já existe um produto com esse endereço.';
  if (message.includes('products.sku')) return 'Já existe um produto com esse SKU.';
  return message || 'Não foi possível salvar o produto.';
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Rota não encontrada.' });
  res.status(404).render('message', pageData(req, { title: 'Página não encontrada', message: 'A página que você tentou acessar não existe.' }));
});

app.use((error, req, res, _next) => {
  console.error(error);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  res.status(500).render('message', pageData(req, { title: 'Algo deu errado', message: 'Não foi possível carregar esta página agora.' }));
});

const server = app.listen(port, '0.0.0.0', (error) => {
  if (error) {
    console.error(`Falha ao iniciar a GameHub na porta ${port}:`, error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`GameHub disponível em http://0.0.0.0:${port}`);
  console.log(`Banco de dados: ${databasePath}`);
  if (!adminPassword) console.warn('Painel administrativo bloqueado: defina ADMIN_PASSWORD no EasyPanel.');
});

function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando a GameHub com segurança.`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
