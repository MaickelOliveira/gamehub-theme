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
    price: 24990, compare: 29990, stock: 40, image: '/theme-assets/game-covers/aeon-vanguard.webp', legacyImage: '/theme-assets/vibe-1.jpg', featured: 1,
    description: 'Entre em batalhas cinematograficas, forme seu esquadrao e domine uma campanha futurista com multiplayer competitivo.'
  },
  {
    id: 'neon-drift', slug: 'neon-drift', sku: 'GH-NEON-002',
    name: 'Neon Drift', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 18990, compare: 22990, stock: 32, image: '/theme-assets/game-covers/neon-drift.webp', legacyImage: '/theme-assets/vibe-7.jpg', featured: 1,
    description: 'Corridas noturnas em alta velocidade, carros personalizaveis e uma cidade neon inteira para explorar.'
  },
  {
    id: 'shadow-protocol', slug: 'shadow-protocol', sku: 'GH-SHADOW-003',
    name: 'Shadow Protocol', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'PC'],
    price: 27990, compare: null, stock: 60, image: '/theme-assets/game-covers/shadow-protocol.webp', legacyImage: '/theme-assets/vibe-2.jpg', featured: 1,
    description: 'Uma operacao secreta pode mudar o destino do mundo. Planeje, infiltre e escolha em quem confiar.'
  },
  {
    id: 'arena-legends-26', slug: 'arena-legends-26', sku: 'GH-ARENA-004',
    name: 'Arena Legends 26', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 15990, compare: 21990, stock: 25, image: '/theme-assets/game-covers/arena-legends-26.webp', legacyImage: '/theme-assets/vibe-3.jpg', featured: 1,
    description: 'Monte seu time, dispute temporadas online e alcance a elite do maior campeonato virtual.'
  },
  {
    id: 'iron-front', slug: 'iron-front', sku: 'GH-IRON-005',
    name: 'Iron Front', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 50, image: '/theme-assets/game-covers/iron-front.webp', legacyImage: '/theme-assets/vibe-4.jpg', featured: 0,
    description: 'Combate tatico intenso com mapas amplos, veiculos e cooperacao entre esquadroes.'
  },
  {
    id: 'kingdoms-reborn', slug: 'kingdoms-reborn', sku: 'GH-KING-006',
    name: 'Kingdoms Reborn', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: null, stock: 80, image: '/theme-assets/game-covers/kingdoms-reborn.webp', legacyImage: '/theme-assets/vibe-5.jpg', featured: 1,
    description: 'Reconstrua um reino perdido, enfrente criaturas lendarias e escreva uma nova historia.'
  },
  {
    id: 'velocity-x', slug: 'velocity-x', sku: 'GH-VELO-007',
    name: 'Velocity X', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 9990, compare: 14990, stock: 45, image: '/theme-assets/game-covers/velocity-x.webp', legacyImage: '/theme-assets/vibe-6.jpg', featured: 0,
    description: 'Acelere em circuitos urbanos e desafie pilotos do mundo todo em corridas eletrizantes.'
  },
  {
    id: 'last-horizon', slug: 'last-horizon', sku: 'GH-HORIZON-008',
    name: 'Last Horizon', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 24990, stock: 38, image: '/theme-assets/game-covers/last-horizon.webp', legacyImage: '/theme-assets/vibe-8.jpg', featured: 1,
    description: 'Explore planetas desconhecidos, sobreviva ao impossivel e encontre o ultimo refugio da humanidade.'
  },
  {
    id: 'nightfall', slug: 'nightfall', sku: 'GH-NIGHT-009',
    name: 'Nightfall', category: 'pronta-entrega', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 11990, compare: 15990, stock: 22, image: '/theme-assets/game-covers/nightfall.webp', legacyImage: '/theme-assets/vibe-9.jpg', featured: 0,
    description: 'Terror e sobrevivencia em uma cidade onde cada sombra esconde uma nova ameaca.'
  },
  {
    id: 'galaxy-raiders', slug: 'galaxy-raiders', sku: 'GH-GALAXY-010',
    name: 'Galaxy Raiders', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 17990, compare: 20990, stock: 55, image: '/theme-assets/game-covers/galaxy-raiders.webp', legacyImage: '/theme-assets/vibe-10.jpg', featured: 1,
    description: 'Reuna sua tripulacao e conquiste sistemas inteiros em uma aventura espacial cooperativa.'
  },
  {
    id: 'crimson-siege', slug: 'crimson-siege', sku: 'GH-CRIMSON-011',
    name: 'Crimson Siege', category: 'lancamentos', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 23990, compare: 28990, stock: 46, image: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Lidere uma unidade de elite em cercos urbanos com combates taticos e cenarios destrutiveis.'
  },
  {
    id: 'phantom-circuit', slug: 'phantom-circuit', sku: 'GH-PHANTOM-012',
    name: 'Phantom Circuit', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 24990, stock: 34, image: '/theme-assets/game-covers/neon-drift.webp', featured: 1,
    description: 'Dispute corridas clandestinas em metropoles futuristas e construa a maquina mais veloz da cidade.'
  },
  {
    id: 'arcane-eclipse', slug: 'arcane-eclipse', sku: 'GH-ARCANE-013',
    name: 'Arcane Eclipse', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 26990, compare: null, stock: 72, image: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Domine escolas de magia, explore reinos esquecidos e decida o destino de uma dinastia.'
  },
  {
    id: 'street-kings-turbo', slug: 'street-kings-turbo', sku: 'GH-STREET-014',
    name: 'Street Kings Turbo', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 8990, compare: 13990, stock: 58, image: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Personalize seu carro e conquiste cada bairro em campeonatos de rua cheios de adrenalina.'
  },
  {
    id: 'silent-asylum', slug: 'silent-asylum', sku: 'GH-SILENT-015',
    name: 'Silent Asylum', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 21990, compare: null, stock: 64, image: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Investigue um hospital abandonado onde cada corredor revela uma memoria mais sombria.'
  },
  {
    id: 'stellar-odyssey', slug: 'stellar-odyssey', sku: 'GH-STELLAR-016',
    name: 'Stellar Odyssey', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 27990, stock: 41, image: '/theme-assets/game-covers/last-horizon.webp', featured: 1,
    description: 'Atravesse sistemas desconhecidos, encontre novas civilizacoes e revele um misterio cosmico.'
  },
  {
    id: 'strike-zone-alpha', slug: 'strike-zone-alpha', sku: 'GH-STRIKE-017',
    name: 'Strike Zone Alpha', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 10990, compare: 15990, stock: 53, image: '/theme-assets/game-covers/shadow-protocol.webp', featured: 0,
    description: 'Execute operacoes especiais com furtividade, tecnologia e escolhas que alteram cada missao.'
  },
  {
    id: 'pro-league-27', slug: 'pro-league-27', sku: 'GH-LEAGUE-018',
    name: 'Pro League 27', category: 'pre-vendas', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 24990, compare: null, stock: 90, image: '/theme-assets/game-covers/arena-legends-26.webp', featured: 1,
    description: 'Viva a nova temporada com clubes, torneios online e uma carreira totalmente renovada.'
  },
  {
    id: 'dragon-crownfall', slug: 'dragon-crownfall', sku: 'GH-DRAGON-019',
    name: 'Dragon Crownfall', category: 'lancamentos', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 25990, compare: 29990, stock: 37, image: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Reuna aliados, enfrente dragoes ancestrais e retome a coroa de um reino dividido.'
  },
  {
    id: 'zero-hour-command', slug: 'zero-hour-command', sku: 'GH-ZERO-020',
    name: 'Zero Hour Command', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 11990, compare: 16990, stock: 49, image: '/theme-assets/game-covers/iron-front.webp', featured: 0,
    description: 'Coordene esquadroes, blindados e apoio aereo em batalhas modernas de grande escala.'
  },
  {
    id: 'dark-signal', slug: 'dark-signal', sku: 'GH-DARK-021',
    name: 'Dark Signal', category: 'lancamentos', genre: 'terror', platforms: ['PS5', 'Xbox', 'PC'],
    price: 18990, compare: 22990, stock: 28, image: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Siga uma transmissao impossivel por uma floresta onde o tempo parece ter parado.'
  },
  {
    id: 'titan-arena', slug: 'titan-arena', sku: 'GH-TITAN-022',
    name: 'Titan Arena', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 9990, compare: 14990, stock: 61, image: '/theme-assets/game-covers/arena-legends-26.webp', featured: 0,
    description: 'Monte sua equipe e dispute ligas competitivas em arenas lotadas ao redor do mundo.'
  },
  {
    id: 'rogue-city', slug: 'rogue-city', sku: 'GH-ROGUE-023',
    name: 'Rogue City', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 20990, compare: 25990, stock: 43, image: '/theme-assets/game-covers/shadow-protocol.webp', featured: 1,
    description: 'Infiltre-se em uma cidade controlada por corporacoes e descubra quem esta por tras da conspiracao.'
  },
  {
    id: 'rally-storm', slug: 'rally-storm', sku: 'GH-RALLY-024',
    name: 'Rally Storm', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 45, image: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Enfrente lama, neve e desertos em provas de rally com fisica e clima dinamicos.'
  },
  {
    id: 'mystic-realms', slug: 'mystic-realms', sku: 'GH-MYSTIC-025',
    name: 'Mystic Realms', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 23990, compare: null, stock: 76, image: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Crie seu heroi e atravesse portais para mundos repletos de magia, criaturas e segredos.'
  },
  {
    id: 'deep-space-echoes', slug: 'deep-space-echoes', sku: 'GH-ECHOES-026',
    name: 'Deep Space Echoes', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: null, stock: 68, image: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Explore uma estacao espacial silenciosa e sobreviva ao que despertou no vazio.'
  },
  {
    id: 'frontline-republic', slug: 'frontline-republic', sku: 'GH-FRONTLINE-027',
    name: 'Frontline Republic', category: 'lancamentos', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 21990, compare: 26990, stock: 39, image: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Defenda a ultima cidade livre em uma campanha militar cinematografica e cooperativa.'
  },
  {
    id: 'urban-football-stars', slug: 'urban-football-stars', sku: 'GH-URBAN-028',
    name: 'Urban Football Stars', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 7990, compare: 11990, stock: 66, image: '/theme-assets/game-covers/arena-legends-26.webp', featured: 0,
    description: 'Leve seu futebol das quadras de bairro aos maiores estadios em partidas rapidas e criativas.'
  },
  {
    id: 'lost-temple', slug: 'lost-temple', sku: 'GH-TEMPLE-029',
    name: 'Lost Temple', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 10990, compare: 15990, stock: 51, image: '/theme-assets/game-covers/last-horizon.webp', featured: 0,
    description: 'Desvende ruinas, armadilhas e lendas em uma expedicao por uma ilha esquecida.'
  },
  {
    id: 'cyber-hunt', slug: 'cyber-hunt', sku: 'GH-CYBER-030',
    name: 'Cyber Hunt', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: null, stock: 84, image: '/theme-assets/game-covers/shadow-protocol.webp', featured: 1,
    description: 'Rastreie criminosos digitais por uma metropole conectada e transforme cada invasao em vantagem.'
  },
  {
    id: 'apex-motorsport', slug: 'apex-motorsport', sku: 'GH-APEX-031',
    name: 'Apex Motorsport', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 23990, stock: 36, image: '/theme-assets/game-covers/neon-drift.webp', featured: 1,
    description: 'Corra em circuitos internacionais com equipes, estrategia de boxes e competicao online.'
  },
  {
    id: 'medieval-legacy', slug: 'medieval-legacy', sku: 'GH-MEDIEVAL-032',
    name: 'Medieval Legacy', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 13990, compare: 18990, stock: 47, image: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 0,
    description: 'Construa sua reputacao entre nobres e guerreiros em uma jornada medieval cheia de escolhas.'
  },
  {
    id: 'blackout-division', slug: 'blackout-division', sku: 'GH-BLACKOUT-033',
    name: 'Blackout Division', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 11990, compare: 16990, stock: 54, image: '/theme-assets/game-covers/iron-front.webp', featured: 0,
    description: 'Combata sem comunicacao em uma operacao noturna onde estrategia e trabalho em equipe sao vitais.'
  },
  {
    id: 'court-champions-26', slug: 'court-champions-26', sku: 'GH-COURT-034',
    name: 'Court Champions 26', category: 'lancamentos', genre: 'esportes', platforms: ['PS5', 'Xbox', 'PC'],
    price: 17990, compare: 21990, stock: 42, image: '/theme-assets/game-covers/arena-legends-26.webp', featured: 1,
    description: 'Crie seu atleta e dispute temporadas profissionais em partidas intensas dentro e fora das quadras.'
  },
  {
    id: 'forgotten-island', slug: 'forgotten-island', sku: 'GH-ISLAND-035',
    name: 'Forgotten Island', category: 'pre-vendas', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 21990, compare: null, stock: 73, image: '/theme-assets/game-covers/last-horizon.webp', featured: 1,
    description: 'Sobreviva a uma ilha misteriosa, construa abrigo e descubra as ruinas de uma civilizacao perdida.'
  },
  {
    id: 'the-hollow', slug: 'the-hollow', sku: 'GH-HOLLOW-036',
    name: 'The Hollow', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 19990, compare: null, stock: 67, image: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Encontre a saida de uma pequena cidade onde os moradores desapareceram durante a noite.'
  },
  {
    id: 'nova-squadron', slug: 'nova-squadron', sku: 'GH-NOVA-037',
    name: 'Nova Squadron', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 27990, stock: 44, image: '/theme-assets/game-covers/galaxy-raiders.webp', featured: 1,
    description: 'Pilote naves de combate, lidere seu esquadrao e decida o futuro de uma guerra interplanetaria.'
  },
  {
    id: 'desert-assault', slug: 'desert-assault', sku: 'GH-DESERT-038',
    name: 'Desert Assault', category: 'pre-vendas', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 23990, compare: null, stock: 79, image: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Atravesse tempestades de areia e controle pontos estrategicos em um conflito de alta tecnologia.'
  },
  {
    id: 'grand-prix-legends', slug: 'grand-prix-legends', sku: 'GH-GRANDPRIX-039',
    name: 'Grand Prix Legends', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 57, image: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Colecione carros de competicao e reviva grandes desafios em pistas classicas e modernas.'
  },
  {
    id: 'eternal-quest', slug: 'eternal-quest', sku: 'GH-ETERNAL-040',
    name: 'Eternal Quest', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 25990, compare: null, stock: 88, image: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Reuna um grupo de herois e enfrente uma jornada que atravessa seculos e mundos.'
  }
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (
      id, slug, sku, name, description, category, genre, platforms_json,
      price_cents, compare_at_price_cents, stock, image_url, featured, active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const seed = db.transaction(() => {
  const upgradeDefaultImage = db.prepare(`
    UPDATE products
    SET image_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (image_url = ? OR image_url = '')
  `);

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
    if (product.legacyImage) upgradeDefaultImage.run(product.image, product.id, product.legacyImage);
  }
});

seed();

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
