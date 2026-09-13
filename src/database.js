const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDirectory = process.env.DATA_DIR || path.join(process.cwd(), '.data');
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, 'gamehub.db');
const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'pronta-entrega',
    genre TEXT NOT NULL DEFAULT 'acao',
    platforms_json TEXT NOT NULL DEFAULT '[]',
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    compare_at_price_cents INTEGER CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= price_cents),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS products_active_category_idx
    ON products (active, category, created_at DESC);

  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('percentage', 'fixed')),
    value INTEGER NOT NULL CHECK (value > 0),
    minimum_cents INTEGER NOT NULL DEFAULT 0 CHECK (minimum_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    public_number TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'pix',
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_document TEXT NOT NULL DEFAULT '',
    customer_notes TEXT NOT NULL DEFAULT '',
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
    shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    coupon_code TEXT,
    pix_key_snapshot TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
  CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0)
  );

  CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const productColumns = db.prepare('PRAGMA table_info(products)').all();
const addedGenreColumn = !productColumns.some((column) => column.name === 'genre');
if (addedGenreColumn) {
  db.exec("ALTER TABLE products ADD COLUMN genre TEXT NOT NULL DEFAULT 'acao'");
}
db.exec('CREATE INDEX IF NOT EXISTS products_active_genre_idx ON products (active, genre, created_at DESC)');

const defaultSettings = {
  store_name: 'GameHub',
  announcement: 'Entrega digital imediata em todo o Brasil',
  support_email: 'contato@gamehub.com.br',
  whatsapp: '',
  pix_key: '',
  pix_discount_percent: '5',
  currency: 'BRL'
};

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);

const seedSettings = db.transaction(() => {
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
});

seedSettings();

const seedProducts = [
  {
    id: 'aeon-vanguard', slug: 'aeon-vanguard', sku: 'GH-AEON-001',
    name: 'Aeon Vanguard', category: 'lancamentos', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: 29990, stock: 40, image: '/theme-assets/vibe-1.jpg', featured: 1,
    description: 'Entre em batalhas cinematograficas, forme seu esquadrao e domine uma campanha futurista com multiplayer competitivo.'
  },
  {
    id: 'neon-drift', slug: 'neon-drift', sku: 'GH-NEON-002',
    name: 'Neon Drift', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 18990, compare: 22990, stock: 32, image: '/theme-assets/vibe-7.jpg', featured: 1,
    description: 'Corridas noturnas em alta velocidade, carros personalizaveis e uma cidade neon inteira para explorar.'
  },
  {
    id: 'shadow-protocol', slug: 'shadow-protocol', sku: 'GH-SHADOW-003',
    name: 'Shadow Protocol', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'PC'],
    price: 27990, compare: null, stock: 60, image: '/theme-assets/vibe-2.jpg', featured: 1,
    description: 'Uma operacao secreta pode mudar o destino do mundo. Planeje, infiltre e escolha em quem confiar.'
  },
  {
    id: 'arena-legends-26', slug: 'arena-legends-26', sku: 'GH-ARENA-004',
    name: 'Arena Legends 26', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 15990, compare: 21990, stock: 25, image: '/theme-assets/vibe-3.jpg', featured: 1,
    description: 'Monte seu time, dispute temporadas online e alcance a elite do maior campeonato virtual.'
  },
  {
    id: 'iron-front', slug: 'iron-front', sku: 'GH-IRON-005',
    name: 'Iron Front', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 50, image: '/theme-assets/vibe-4.jpg', featured: 0,
    description: 'Combate tatico intenso com mapas amplos, veiculos e cooperacao entre esquadroes.'
  },
  {
    id: 'kingdoms-reborn', slug: 'kingdoms-reborn', sku: 'GH-KING-006',
    name: 'Kingdoms Reborn', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: null, stock: 80, image: '/theme-assets/vibe-5.jpg', featured: 1,
    description: 'Reconstrua um reino perdido, enfrente criaturas lendarias e escreva uma nova historia.'
  },
  {
    id: 'velocity-x', slug: 'velocity-x', sku: 'GH-VELO-007',
    name: 'Velocity X', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 9990, compare: 14990, stock: 45, image: '/theme-assets/vibe-6.jpg', featured: 0,
    description: 'Acelere em circuitos urbanos e desafie pilotos do mundo todo em corridas eletrizantes.'
  },
  {
    id: 'last-horizon', slug: 'last-horizon', sku: 'GH-HORIZON-008',
    name: 'Last Horizon', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 24990, stock: 38, image: '/theme-assets/vibe-8.jpg', featured: 1,
    description: 'Explore planetas desconhecidos, sobreviva ao impossivel e encontre o ultimo refugio da humanidade.'
  },
  {
    id: 'nightfall', slug: 'nightfall', sku: 'GH-NIGHT-009',
    name: 'Nightfall', category: 'pronta-entrega', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 11990, compare: 15990, stock: 22, image: '/theme-assets/vibe-9.jpg', featured: 0,
    description: 'Terror e sobrevivencia em uma cidade onde cada sombra esconde uma nova ameaca.'
  },
  {
    id: 'galaxy-raiders', slug: 'galaxy-raiders', sku: 'GH-GALAXY-010',
    name: 'Galaxy Raiders', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 17990, compare: 20990, stock: 55, image: '/theme-assets/vibe-10.jpg', featured: 1,
    description: 'Reuna sua tripulacao e conquiste sistemas inteiros em uma aventura espacial cooperativa.'
  }
];

if (db.prepare('SELECT COUNT(*) AS total FROM products').get().total === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (
        id, slug, sku, name, description, category, genre, platforms_json,
        price_cents, compare_at_price_cents, stock, image_url, featured, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const seed = db.transaction(() => {
    for (const product of seedProducts) {
      insertProduct.run(
        product.id,
        product.slug,
        product.sku,
        product.name,
        product.description,
        product.category,
        product.genre,
        JSON.stringify(product.platforms),
        product.price,
        product.compare,
        product.stock,
        product.image,
        product.featured
      );
    }
  });

  seed();
}

if (addedGenreColumn) {
  const updateGenre = db.prepare('UPDATE products SET genre = ? WHERE id = ?');
  db.transaction(() => {
    for (const product of seedProducts) updateGenre.run(product.genre, product.id);
  })();
}

function mapProduct(row) {
  if (!row) return null;
  return {
    ...row,
    platforms: JSON.parse(row.platforms_json || '[]'),
    featured: Boolean(row.featured),
    active: Boolean(row.active)
  };
}

function getSettings() {
  return Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value])
  );
}

function updateSettings(values) {
  const statement = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      if (Object.hasOwn(defaultSettings, key)) statement.run(key, String(value ?? ''));
    }
  })();

  return getSettings();
}

module.exports = {
  db,
  databasePath,
  getSettings,
  updateSettings,
  mapProduct
};
