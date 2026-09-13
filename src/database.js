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
    trailer_video_id TEXT NOT NULL DEFAULT '',
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
const addedTrailerVideoColumn = !productColumns.some((column) => column.name === 'trailer_video_id');
if (addedTrailerVideoColumn) {
  db.exec("ALTER TABLE products ADD COLUMN trailer_video_id TEXT NOT NULL DEFAULT ''");
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

const legacySeedProducts = [
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
    price: 23990, compare: 28990, stock: 46, image: '/theme-assets/game-covers/crimson-siege.webp', legacyImage: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Lidere uma unidade de elite em cercos urbanos com combates taticos e cenarios destrutiveis.'
  },
  {
    id: 'phantom-circuit', slug: 'phantom-circuit', sku: 'GH-PHANTOM-012',
    name: 'Phantom Circuit', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 24990, stock: 34, image: '/theme-assets/game-covers/phantom-circuit.webp', legacyImage: '/theme-assets/game-covers/neon-drift.webp', featured: 1,
    description: 'Dispute corridas clandestinas em metropoles futuristas e construa a maquina mais veloz da cidade.'
  },
  {
    id: 'arcane-eclipse', slug: 'arcane-eclipse', sku: 'GH-ARCANE-013',
    name: 'Arcane Eclipse', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 26990, compare: null, stock: 72, image: '/theme-assets/game-covers/arcane-eclipse.webp', legacyImage: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Domine escolas de magia, explore reinos esquecidos e decida o destino de uma dinastia.'
  },
  {
    id: 'street-kings-turbo', slug: 'street-kings-turbo', sku: 'GH-STREET-014',
    name: 'Street Kings Turbo', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 8990, compare: 13990, stock: 58, image: '/theme-assets/game-covers/street-kings-turbo.webp', legacyImage: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Personalize seu carro e conquiste cada bairro em campeonatos de rua cheios de adrenalina.'
  },
  {
    id: 'silent-asylum', slug: 'silent-asylum', sku: 'GH-SILENT-015',
    name: 'Silent Asylum', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 21990, compare: null, stock: 64, image: '/theme-assets/game-covers/silent-asylum.webp', legacyImage: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Investigue um hospital abandonado onde cada corredor revela uma memoria mais sombria.'
  },
  {
    id: 'stellar-odyssey', slug: 'stellar-odyssey', sku: 'GH-STELLAR-016',
    name: 'Stellar Odyssey', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 27990, stock: 41, image: '/theme-assets/game-covers/stellar-odyssey.webp', legacyImage: '/theme-assets/game-covers/last-horizon.webp', featured: 1,
    description: 'Atravesse sistemas desconhecidos, encontre novas civilizacoes e revele um misterio cosmico.'
  },
  {
    id: 'strike-zone-alpha', slug: 'strike-zone-alpha', sku: 'GH-STRIKE-017',
    name: 'Strike Zone Alpha', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 10990, compare: 15990, stock: 53, image: '/theme-assets/game-covers/strike-zone-alpha.webp', legacyImage: '/theme-assets/game-covers/shadow-protocol.webp', featured: 0,
    description: 'Execute operacoes especiais com furtividade, tecnologia e escolhas que alteram cada missao.'
  },
  {
    id: 'pro-league-27', slug: 'pro-league-27', sku: 'GH-LEAGUE-018',
    name: 'Pro League 27', category: 'pre-vendas', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 24990, compare: null, stock: 90, image: '/theme-assets/game-covers/pro-league-27.webp', legacyImage: '/theme-assets/game-covers/arena-legends-26.webp', featured: 1,
    description: 'Viva a nova temporada com clubes, torneios online e uma carreira totalmente renovada.'
  },
  {
    id: 'dragon-crownfall', slug: 'dragon-crownfall', sku: 'GH-DRAGON-019',
    name: 'Dragon Crownfall', category: 'lancamentos', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 25990, compare: 29990, stock: 37, image: '/theme-assets/game-covers/dragon-crownfall.webp', legacyImage: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Reuna aliados, enfrente dragoes ancestrais e retome a coroa de um reino dividido.'
  },
  {
    id: 'zero-hour-command', slug: 'zero-hour-command', sku: 'GH-ZERO-020',
    name: 'Zero Hour Command', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 11990, compare: 16990, stock: 49, image: '/theme-assets/game-covers/zero-hour-command.webp', legacyImage: '/theme-assets/game-covers/iron-front.webp', featured: 0,
    description: 'Coordene esquadroes, blindados e apoio aereo em batalhas modernas de grande escala.'
  },
  {
    id: 'dark-signal', slug: 'dark-signal', sku: 'GH-DARK-021',
    name: 'Dark Signal', category: 'lancamentos', genre: 'terror', platforms: ['PS5', 'Xbox', 'PC'],
    price: 18990, compare: 22990, stock: 28, image: '/theme-assets/game-covers/dark-signal.webp', legacyImage: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Siga uma transmissao impossivel por uma floresta onde o tempo parece ter parado.'
  },
  {
    id: 'titan-arena', slug: 'titan-arena', sku: 'GH-TITAN-022',
    name: 'Titan Arena', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 9990, compare: 14990, stock: 61, image: '/theme-assets/game-covers/titan-arena.webp', legacyImage: '/theme-assets/game-covers/arena-legends-26.webp', featured: 0,
    description: 'Monte sua equipe e dispute ligas competitivas em arenas lotadas ao redor do mundo.'
  },
  {
    id: 'rogue-city', slug: 'rogue-city', sku: 'GH-ROGUE-023',
    name: 'Rogue City', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 20990, compare: 25990, stock: 43, image: '/theme-assets/game-covers/rogue-city.webp', legacyImage: '/theme-assets/game-covers/shadow-protocol.webp', featured: 1,
    description: 'Infiltre-se em uma cidade controlada por corporacoes e descubra quem esta por tras da conspiracao.'
  },
  {
    id: 'rally-storm', slug: 'rally-storm', sku: 'GH-RALLY-024',
    name: 'Rally Storm', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 45, image: '/theme-assets/game-covers/rally-storm.webp', legacyImage: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Enfrente lama, neve e desertos em provas de rally com fisica e clima dinamicos.'
  },
  {
    id: 'mystic-realms', slug: 'mystic-realms', sku: 'GH-MYSTIC-025',
    name: 'Mystic Realms', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 23990, compare: null, stock: 76, image: '/theme-assets/game-covers/mystic-realms.webp', legacyImage: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Crie seu heroi e atravesse portais para mundos repletos de magia, criaturas e segredos.'
  },
  {
    id: 'deep-space-echoes', slug: 'deep-space-echoes', sku: 'GH-ECHOES-026',
    name: 'Deep Space Echoes', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: null, stock: 68, image: '/theme-assets/game-covers/deep-space-echoes.webp', legacyImage: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Explore uma estacao espacial silenciosa e sobreviva ao que despertou no vazio.'
  },
  {
    id: 'frontline-republic', slug: 'frontline-republic', sku: 'GH-FRONTLINE-027',
    name: 'Frontline Republic', category: 'lancamentos', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 21990, compare: 26990, stock: 39, image: '/theme-assets/game-covers/frontline-republic.webp', legacyImage: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Defenda a ultima cidade livre em uma campanha militar cinematografica e cooperativa.'
  },
  {
    id: 'urban-football-stars', slug: 'urban-football-stars', sku: 'GH-URBAN-028',
    name: 'Urban Football Stars', category: 'pronta-entrega', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 7990, compare: 11990, stock: 66, image: '/theme-assets/game-covers/urban-football-stars.webp', legacyImage: '/theme-assets/game-covers/arena-legends-26.webp', featured: 0,
    description: 'Leve seu futebol das quadras de bairro aos maiores estadios em partidas rapidas e criativas.'
  },
  {
    id: 'lost-temple', slug: 'lost-temple', sku: 'GH-TEMPLE-029',
    name: 'Lost Temple', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 10990, compare: 15990, stock: 51, image: '/theme-assets/game-covers/lost-temple.webp', legacyImage: '/theme-assets/game-covers/last-horizon.webp', featured: 0,
    description: 'Desvende ruinas, armadilhas e lendas em uma expedicao por uma ilha esquecida.'
  },
  {
    id: 'cyber-hunt', slug: 'cyber-hunt', sku: 'GH-CYBER-030',
    name: 'Cyber Hunt', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: null, stock: 84, image: '/theme-assets/game-covers/cyber-hunt.webp', legacyImage: '/theme-assets/game-covers/shadow-protocol.webp', featured: 1,
    description: 'Rastreie criminosos digitais por uma metropole conectada e transforme cada invasao em vantagem.'
  },
  {
    id: 'apex-motorsport', slug: 'apex-motorsport', sku: 'GH-APEX-031',
    name: 'Apex Motorsport', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 23990, stock: 36, image: '/theme-assets/game-covers/apex-motorsport.webp', legacyImage: '/theme-assets/game-covers/neon-drift.webp', featured: 1,
    description: 'Corra em circuitos internacionais com equipes, estrategia de boxes e competicao online.'
  },
  {
    id: 'medieval-legacy', slug: 'medieval-legacy', sku: 'GH-MEDIEVAL-032',
    name: 'Medieval Legacy', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 13990, compare: 18990, stock: 47, image: '/theme-assets/game-covers/medieval-legacy.webp', legacyImage: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 0,
    description: 'Construa sua reputacao entre nobres e guerreiros em uma jornada medieval cheia de escolhas.'
  },
  {
    id: 'blackout-division', slug: 'blackout-division', sku: 'GH-BLACKOUT-033',
    name: 'Blackout Division', category: 'pronta-entrega', genre: 'guerra', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 11990, compare: 16990, stock: 54, image: '/theme-assets/game-covers/blackout-division.webp', legacyImage: '/theme-assets/game-covers/iron-front.webp', featured: 0,
    description: 'Combata sem comunicacao em uma operacao noturna onde estrategia e trabalho em equipe sao vitais.'
  },
  {
    id: 'court-champions-26', slug: 'court-champions-26', sku: 'GH-COURT-034',
    name: 'Court Champions 26', category: 'lancamentos', genre: 'esportes', platforms: ['PS5', 'Xbox', 'PC'],
    price: 17990, compare: 21990, stock: 42, image: '/theme-assets/game-covers/court-champions-26.webp', legacyImage: '/theme-assets/game-covers/arena-legends-26.webp', featured: 1,
    description: 'Crie seu atleta e dispute temporadas profissionais em partidas intensas dentro e fora das quadras.'
  },
  {
    id: 'forgotten-island', slug: 'forgotten-island', sku: 'GH-ISLAND-035',
    name: 'Forgotten Island', category: 'pre-vendas', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 21990, compare: null, stock: 73, image: '/theme-assets/game-covers/forgotten-island.webp', legacyImage: '/theme-assets/game-covers/last-horizon.webp', featured: 1,
    description: 'Sobreviva a uma ilha misteriosa, construa abrigo e descubra as ruinas de uma civilizacao perdida.'
  },
  {
    id: 'the-hollow', slug: 'the-hollow', sku: 'GH-HOLLOW-036',
    name: 'The Hollow', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 19990, compare: null, stock: 67, image: '/theme-assets/game-covers/the-hollow.webp', legacyImage: '/theme-assets/game-covers/nightfall.webp', featured: 1,
    description: 'Encontre a saida de uma pequena cidade onde os moradores desapareceram durante a noite.'
  },
  {
    id: 'nova-squadron', slug: 'nova-squadron', sku: 'GH-NOVA-037',
    name: 'Nova Squadron', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 27990, stock: 44, image: '/theme-assets/game-covers/nova-squadron.webp', legacyImage: '/theme-assets/game-covers/galaxy-raiders.webp', featured: 1,
    description: 'Pilote naves de combate, lidere seu esquadrao e decida o futuro de uma guerra interplanetaria.'
  },
  {
    id: 'desert-assault', slug: 'desert-assault', sku: 'GH-DESERT-038',
    name: 'Desert Assault', category: 'pre-vendas', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 23990, compare: null, stock: 79, image: '/theme-assets/game-covers/desert-assault.webp', legacyImage: '/theme-assets/game-covers/aeon-vanguard.webp', featured: 1,
    description: 'Atravesse tempestades de areia e controle pontos estrategicos em um conflito de alta tecnologia.'
  },
  {
    id: 'grand-prix-legends', slug: 'grand-prix-legends', sku: 'GH-GRANDPRIX-039',
    name: 'Grand Prix Legends', category: 'pronta-entrega', genre: 'corrida', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 12990, compare: 17990, stock: 57, image: '/theme-assets/game-covers/grand-prix-legends.webp', legacyImage: '/theme-assets/game-covers/velocity-x.webp', featured: 0,
    description: 'Colecione carros de competicao e reviva grandes desafios em pistas classicas e modernas.'
  },
  {
    id: 'eternal-quest', slug: 'eternal-quest', sku: 'GH-ETERNAL-040',
    name: 'Eternal Quest', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 25990, compare: null, stock: 88, image: '/theme-assets/game-covers/eternal-quest.webp', legacyImage: '/theme-assets/game-covers/kingdoms-reborn.webp', featured: 1,
    description: 'Reuna um grupo de herois e enfrente uma jornada que atravessa seculos e mundos.'
  }
];

const seedProducts = [
  {
    id: 'marvels-wolverine', slug: 'marvels-wolverine', sku: 'GH-REAL-001',
    name: 'Marvel’s Wolverine', category: 'pre-vendas', genre: 'acao', platforms: ['PS5'],
    price: 34990, compare: null, stock: 80, image: '/theme-assets/game-covers/official/marvels-wolverine.webp', featured: 1,
    description: 'Assuma as garras de Logan em uma aventura brutal e cinematografica criada pela Insomniac Games.'
  },
  {
    id: 'grand-theft-auto-vi', slug: 'grand-theft-auto-vi', sku: 'GH-REAL-002',
    name: 'Grand Theft Auto VI', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'Xbox'],
    price: 39990, compare: null, stock: 100, image: '/theme-assets/game-covers/official/grand-theft-auto-vi.webp', featured: 1,
    description: 'Explore Leonida e Vice City na nova aventura de mundo aberto da Rockstar Games.'
  },
  {
    id: 'silent-hill-townfall', slug: 'silent-hill-townfall', sku: 'GH-REAL-003',
    name: 'SILENT HILL: Townfall', category: 'pre-vendas', genre: 'terror', platforms: ['PS5', 'PC'],
    price: 24990, compare: null, stock: 70, image: '/theme-assets/game-covers/official/silent-hill-townfall.webp', featured: 1,
    description: 'Volte a uma cidade insular tomada por segredos, confrontos e terror psicologico.'
  },
  {
    id: 'control-resonant', slug: 'control-resonant', sku: 'GH-REAL-004',
    name: 'CONTROL Resonant', category: 'pre-vendas', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 29990, compare: null, stock: 75, image: '/theme-assets/game-covers/official/control-resonant.webp', featured: 1,
    description: 'Domine poderes paranaturais e atravesse uma Manhattan distorcida nesta nova historia de Control.'
  },
  {
    id: 'rayman-legends-retold', slug: 'rayman-legends-retold', sku: 'GH-REAL-005',
    name: 'Rayman Legends Retold', category: 'pre-vendas', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: null, stock: 65, image: '/theme-assets/game-covers/official/rayman-legends-retold.webp', featured: 1,
    description: 'Redescubra o classico de plataforma com visual renovado, novas fases e cooperativo local.'
  },
  {
    id: 'ace-combat-8', slug: 'ace-combat-8', sku: 'GH-REAL-006',
    name: 'ACE COMBAT 8: WINGS OF THEVE', category: 'pre-vendas', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 34990, compare: null, stock: 60, image: '/theme-assets/game-covers/official/ace-combat-8.webp', featured: 1,
    description: 'Entre no cockpit e dispute combates aereos intensos em uma campanha cinematografica.'
  },
  {
    id: 'star-wars-galactic-racer', slug: 'star-wars-galactic-racer', sku: 'GH-REAL-007',
    name: 'STAR WARS: Galactic Racer', category: 'pre-vendas', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 29990, compare: null, stock: 80, image: '/theme-assets/game-covers/official/star-wars-galactic-racer.webp', featured: 1,
    description: 'Acelere em circuitos clandestinos da Orla Exterior com veiculos de Star Wars.'
  },
  {
    id: 'castlevania-belmonts-curse', slug: 'castlevania-belmonts-curse', sku: 'GH-REAL-008',
    name: 'Castlevania: Belmont’s Curse', category: 'pre-vendas', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 14990, compare: null, stock: 90, image: '/theme-assets/game-covers/official/castlevania-belmonts-curse.webp', featured: 1,
    description: 'Explore um mundo medieval sombrio nesta nova aventura de acao da familia Belmont.'
  },
  {
    id: 'call-of-duty-modern-warfare-4', slug: 'call-of-duty-modern-warfare-4', sku: 'GH-REAL-009',
    name: 'Call of Duty: Modern Warfare 4', category: 'pre-vendas', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 34990, compare: null, stock: 100, image: '/theme-assets/game-covers/official/call-of-duty-modern-warfare-4.webp', featured: 1,
    description: 'Enfrente uma guerra moderna com campanha, multiplayer competitivo e cooperacao online.'
  },
  {
    id: 'phantom-blade-zero', slug: 'phantom-blade-zero', sku: 'GH-REAL-010',
    name: 'Phantom Blade Zero', category: 'pre-vendas', genre: 'rpg', platforms: ['PS5', 'PC'],
    price: 29990, compare: null, stock: 75, image: '/theme-assets/game-covers/official/phantom-blade-zero.webp', featured: 1,
    description: 'Combine artes marciais e fantasia sombria em um RPG de acao veloz inspirado no wuxia.'
  },
  {
    id: 'battlefield-6', slug: 'battlefield-6', sku: 'GH-REAL-011',
    name: 'Battlefield 6', category: 'lancamentos', genre: 'guerra', platforms: ['PS5', 'Xbox', 'PC'],
    price: 29990, compare: 34990, stock: 48, image: '/theme-assets/game-covers/official/battlefield-6.webp', featured: 1,
    description: 'Participe de batalhas em grande escala com veiculos, destruicao e combate entre esquadroes.'
  },
  {
    id: 'ea-sports-fc-26', slug: 'ea-sports-fc-26', sku: 'GH-REAL-012',
    name: 'EA SPORTS FC 26', category: 'lancamentos', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 24990, compare: 34990, stock: 55, image: '/theme-assets/game-covers/official/ea-sports-fc-26.webp', featured: 1,
    description: 'Monte seu elenco e entre em campo nos principais clubes, ligas e modos do futebol mundial.'
  },
  {
    id: 'nba-2k26', slug: 'nba-2k26', sku: 'GH-REAL-013',
    name: 'NBA 2K26', category: 'lancamentos', genre: 'esportes', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 24990, compare: 32990, stock: 44, image: '/theme-assets/game-covers/official/nba-2k26.webp', featured: 1,
    description: 'Construa sua carreira, monte um time e viva a experiencia completa do basquete profissional.'
  },
  {
    id: 'assassins-creed-shadows', slug: 'assassins-creed-shadows', sku: 'GH-REAL-014',
    name: 'Assassin’s Creed Shadows', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 27990, compare: 34990, stock: 42, image: '/theme-assets/game-covers/official/assassins-creed-shadows.webp', featured: 1,
    description: 'Explore o Japao feudal alternando entre furtividade shinobi e combate samurai.'
  },
  {
    id: 'monster-hunter-wilds', slug: 'monster-hunter-wilds', sku: 'GH-REAL-015',
    name: 'Monster Hunter Wilds', category: 'lancamentos', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 27990, compare: 34990, stock: 46, image: '/theme-assets/game-covers/official/monster-hunter-wilds.webp', featured: 1,
    description: 'Cace criaturas gigantes em ecossistemas vivos e evolua seu equipamento em grupo.'
  },
  {
    id: 'split-fiction', slug: 'split-fiction', sku: 'GH-REAL-016',
    name: 'Split Fiction', category: 'lancamentos', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: 29990, stock: 39, image: '/theme-assets/game-covers/official/split-fiction.webp', featured: 1,
    description: 'Atravesse mundos de fantasia e ficcao cientifica em uma aventura cooperativa para dois.'
  },
  {
    id: 'doom-the-dark-ages', slug: 'doom-the-dark-ages', sku: 'GH-REAL-017',
    name: 'DOOM: The Dark Ages', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 27990, compare: 34990, stock: 51, image: '/theme-assets/game-covers/official/doom-the-dark-ages.webp', featured: 1,
    description: 'Assuma o papel do DOOM Slayer em uma guerra medieval contra as forcas do inferno.'
  },
  {
    id: 'clair-obscur-expedition-33', slug: 'clair-obscur-expedition-33', sku: 'GH-REAL-018',
    name: 'Clair Obscur: Expedition 33', category: 'lancamentos', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 27990, stock: 45, image: '/theme-assets/game-covers/official/clair-obscur-expedition-33.webp', featured: 1,
    description: 'Lidere uma expedicao em um RPG por turnos com combates reativos e direcao artistica marcante.'
  },
  {
    id: 'forza-horizon-5', slug: 'forza-horizon-5', sku: 'GH-REAL-019',
    name: 'Forza Horizon 5', category: 'lancamentos', genre: 'corrida', platforms: ['PS5', 'Xbox', 'PC'],
    price: 22990, compare: 29990, stock: 58, image: '/theme-assets/game-covers/official/forza-horizon-5.webp', featured: 1,
    description: 'Explore o Mexico em centenas de carros, eventos online e corridas de mundo aberto.'
  },
  {
    id: 'marvels-spider-man-2', slug: 'marvels-spider-man-2', sku: 'GH-REAL-020',
    name: 'Marvel’s Spider-Man 2', category: 'lancamentos', genre: 'acao', platforms: ['PS5', 'PC'],
    price: 24990, compare: 34990, stock: 50, image: '/theme-assets/game-covers/official/marvels-spider-man-2.webp', featured: 1,
    description: 'Balance por Nova York com Peter Parker e Miles Morales em uma aventura contra Venom.'
  },
  {
    id: 'god-of-war-ragnarok', slug: 'god-of-war-ragnarok', sku: 'GH-REAL-021',
    name: 'God of War Ragnarök', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PS4', 'PC'],
    price: 22990, compare: 34990, stock: 35, image: '/theme-assets/game-covers/official/god-of-war-ragnarok.webp', featured: 1,
    description: 'Viaje pelos Nove Reinos com Kratos e Atreus em busca de respostas antes do Ragnarok.'
  },
  {
    id: 'horizon-forbidden-west', slug: 'horizon-forbidden-west', sku: 'GH-REAL-022',
    name: 'Horizon Forbidden West', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PS4', 'PC'],
    price: 19990, compare: 29990, stock: 36, image: '/theme-assets/game-covers/official/horizon-forbidden-west.webp', featured: 1,
    description: 'Acompanhe Aloy pelo Oeste Proibido em um mundo de maquinas colossais e novas tribos.'
  },
  {
    id: 'the-last-of-us-part-1', slug: 'the-last-of-us-part-1', sku: 'GH-REAL-023',
    name: 'The Last of Us Part I', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PC'],
    price: 19990, compare: 29990, stock: 33, image: '/theme-assets/game-covers/official/the-last-of-us-part-1.webp', featured: 1,
    description: 'Reviva a jornada de Joel e Ellie em uma recriacao completa da premiada aventura.'
  },
  {
    id: 'ghost-of-tsushima', slug: 'ghost-of-tsushima', sku: 'GH-REAL-024',
    name: 'Ghost of Tsushima Director’s Cut', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PS4', 'PC'],
    price: 19990, compare: 29990, stock: 41, image: '/theme-assets/game-covers/official/ghost-of-tsushima.webp', featured: 1,
    description: 'Domine a katana e a furtividade como Jin Sakai na luta pela ilha de Tsushima.'
  },
  {
    id: 'ratchet-clank-rift-apart', slug: 'ratchet-clank-rift-apart', sku: 'GH-REAL-025',
    name: 'Ratchet & Clank: Rift Apart', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'PC'],
    price: 17990, compare: 29990, stock: 37, image: '/theme-assets/game-covers/official/ratchet-clank-rift-apart.webp', featured: 0,
    description: 'Salte entre dimensoes com armas criativas e uma aventura intergalactica cheia de humor.'
  },
  {
    id: 'helldivers-2', slug: 'helldivers-2', sku: 'GH-REAL-026',
    name: 'HELLDIVERS 2', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 19990, compare: 24990, stock: 62, image: '/theme-assets/game-covers/official/helldivers-2.webp', featured: 1,
    description: 'Defenda a Super Terra em missoes cooperativas caoticas para ate quatro jogadores.'
  },
  {
    id: 'returnal', slug: 'returnal', sku: 'GH-REAL-027',
    name: 'Returnal', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'PC'],
    price: 17990, compare: 29990, stock: 29, image: '/theme-assets/game-covers/official/returnal.webp', featured: 0,
    description: 'Quebre um ciclo temporal hostil em um roguelike de acao e ficcao cientifica.'
  },
  {
    id: 'black-myth-wukong', slug: 'black-myth-wukong', sku: 'GH-REAL-028',
    name: 'Black Myth: Wukong', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: 29990, stock: 47, image: '/theme-assets/game-covers/official/black-myth-wukong.webp', featured: 1,
    description: 'Enfrente criaturas lendarias em um RPG de acao inspirado na mitologia chinesa.'
  },
  {
    id: 'forza-motorsport', slug: 'forza-motorsport', sku: 'GH-REAL-029',
    name: 'Forza Motorsport', category: 'pronta-entrega', genre: 'corrida', platforms: ['Xbox', 'PC'],
    price: 19990, compare: 29990, stock: 44, image: '/theme-assets/game-covers/official/forza-motorsport.webp', featured: 0,
    description: 'Construa e pilote carros em circuitos detalhados com clima e iluminacao dinamicos.'
  },
  {
    id: 'halo-infinite', slug: 'halo-infinite', sku: 'GH-REAL-030',
    name: 'Halo Infinite', category: 'pronta-entrega', genre: 'guerra', platforms: ['Xbox', 'PC'],
    price: 14990, compare: 24990, stock: 53, image: '/theme-assets/game-covers/official/halo-infinite.webp', featured: 0,
    description: 'Vista a armadura do Master Chief e enfrente os Banidos em uma campanha expansiva.'
  },
  {
    id: 'starfield', slug: 'starfield', sku: 'GH-REAL-031',
    name: 'Starfield', category: 'pronta-entrega', genre: 'rpg', platforms: ['Xbox', 'PC'],
    price: 19990, compare: 29990, stock: 40, image: '/theme-assets/game-covers/official/starfield.webp', featured: 0,
    description: 'Crie seu explorador e viaje entre sistemas estelares em busca do maior misterio da humanidade.'
  },
  {
    id: 'indiana-jones-great-circle', slug: 'indiana-jones-great-circle', sku: 'GH-REAL-032',
    name: 'Indiana Jones and the Great Circle', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 24990, compare: 34990, stock: 38, image: '/theme-assets/game-covers/official/indiana-jones-great-circle.webp', featured: 1,
    description: 'Resolva enigmas e enfrente inimigos em uma aventura original de Indiana Jones.'
  },
  {
    id: 'sea-of-thieves', slug: 'sea-of-thieves', sku: 'GH-REAL-033',
    name: 'Sea of Thieves', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS5', 'Xbox', 'PC'],
    price: 14990, compare: 22990, stock: 61, image: '/theme-assets/game-covers/official/sea-of-thieves.webp', featured: 0,
    description: 'Forme sua tripulacao, navegue por mares abertos e construa sua propria lenda pirata.'
  },
  {
    id: 'elden-ring', slug: 'elden-ring', sku: 'GH-REAL-034',
    name: 'ELDEN RING', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 19990, compare: 29990, stock: 49, image: '/theme-assets/game-covers/official/elden-ring.webp', featured: 1,
    description: 'Explore as Terras Intermedias e enfrente chefes monumentais em um vasto RPG de acao.'
  },
  {
    id: 'cyberpunk-2077', slug: 'cyberpunk-2077', sku: 'GH-REAL-035',
    name: 'Cyberpunk 2077', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 14990, compare: 24990, stock: 57, image: '/theme-assets/game-covers/official/cyberpunk-2077.webp', featured: 1,
    description: 'Construa sua lenda em Night City em um RPG de mundo aberto cheio de escolhas.'
  },
  {
    id: 'hogwarts-legacy', slug: 'hogwarts-legacy', sku: 'GH-REAL-036',
    name: 'Hogwarts Legacy', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 14990, compare: 24990, stock: 63, image: '/theme-assets/game-covers/official/hogwarts-legacy.webp', featured: 1,
    description: 'Viva uma jornada pelo mundo bruxo, aprenda feiticos e explore Hogwarts no seculo XIX.'
  },
  {
    id: 'red-dead-redemption-2', slug: 'red-dead-redemption-2', sku: 'GH-REAL-037',
    name: 'Red Dead Redemption 2', category: 'pronta-entrega', genre: 'aventura', platforms: ['PS4', 'Xbox', 'PC'],
    price: 12990, compare: 24990, stock: 52, image: '/theme-assets/game-covers/official/red-dead-redemption-2.webp', featured: 1,
    description: 'Acompanhe Arthur Morgan e a gangue Van der Linde em uma epopeia do Velho Oeste.'
  },
  {
    id: 'grand-theft-auto-v', slug: 'grand-theft-auto-v', sku: 'GH-REAL-038',
    name: 'Grand Theft Auto V', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 9990, compare: 19990, stock: 74, image: '/theme-assets/game-covers/official/grand-theft-auto-v.webp', featured: 0,
    description: 'Explore Los Santos em tres historias conectadas e entre no universo de GTA Online.'
  },
  {
    id: 'tekken-8', slug: 'tekken-8', sku: 'GH-REAL-039',
    name: 'TEKKEN 8', category: 'pronta-entrega', genre: 'acao', platforms: ['PS5', 'Xbox', 'PC'],
    price: 17990, compare: 29990, stock: 43, image: '/theme-assets/game-covers/official/tekken-8.webp', featured: 0,
    description: 'Escolha seu lutador e domine arenas destrutiveis no novo capitulo do torneio Iron Fist.'
  },
  {
    id: 'the-witcher-3', slug: 'the-witcher-3', sku: 'GH-REAL-040',
    name: 'The Witcher 3: Wild Hunt', category: 'pronta-entrega', genre: 'rpg', platforms: ['PS5', 'PS4', 'Xbox', 'PC'],
    price: 7990, compare: 19990, stock: 68, image: '/theme-assets/game-covers/official/the-witcher-3.webp', featured: 0,
    description: 'Cace monstros como Geralt de Rivia em uma aventura de mundo aberto repleta de escolhas.'
  }
];

const defaultTrailerVideos = Object.freeze({
  'marvels-wolverine': '3Z42tBfBLJY',
  'grand-theft-auto-vi': 'QdBZY2fkU-0',
  'silent-hill-townfall': 'CvN3dP92wxU',
  'control-resonant': 'WhQm-ExRz60',
  'rayman-legends-retold': '2_7BQ9hLGkk',
  'ace-combat-8': 'JQYx_867ua0',
  'star-wars-galactic-racer': '2MtgIoToa7I',
  'castlevania-belmonts-curse': 'wioDhevSSU4',
  'call-of-duty-modern-warfare-4': 'jLbst85USN8',
  'phantom-blade-zero': 'hXyPbvj7A7w',
  'battlefield-6': 'pgNCgJG0vnY',
  'ea-sports-fc-26': 'TSi0iJYSQ24',
  'nba-2k26': 'zY1dEu7nGKc',
  'assassins-creed-shadows': 'vovkzbtYBC8',
  'monster-hunter-wilds': 'a_wNFT4j6qI',
  'split-fiction': 'fcwngWPXQtg',
  'doom-the-dark-ages': '4tk8lkmYGWQ',
  'clair-obscur-expedition-33': '-qgOZDRDynw',
  'forza-horizon-5': 'FYH9n37B7Yw',
  'marvels-spider-man-2': 'nq1M_Wc4FIc',
  'god-of-war-ragnarok': 'hfJ4Km46A-0',
  'horizon-forbidden-west': 'Lq594XmpPBg',
  'the-last-of-us-part-1': 'R2Ebc_OFeug',
  'ghost-of-tsushima': 'A5gVt028Hww',
  'ratchet-clank-rift-apart': '55PRv_e00wc',
  'helldivers-2': 'UC5EpJR0GBQ',
  returnal: 'k4nSLa8a588',
  'black-myth-wukong': 'uT6RZBz9ueM',
  'forza-motorsport': 'em4gv1Ietko',
  'halo-infinite': 'PyMlV5_HRWk',
  starfield: 'pYqyVpCV-3c',
  'indiana-jones-great-circle': 'sq97d1RkdRM',
  'sea-of-thieves': 'r5JIBaasuE8',
  'elden-ring': 'E3Huy2cdih0',
  'cyberpunk-2077': 'qIcTM8WXFjk',
  'hogwarts-legacy': 'BtyBjOW8sGY',
  'red-dead-redemption-2': 'F63h3v9QV7w',
  'grand-theft-auto-v': 'hvoD7ehZPcM',
  'tekken-8': '2hPuRQz6IlM',
  'the-witcher-3': '1-l29HlKkXU'
});

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (
      id, slug, sku, name, description, category, genre, platforms_json,
      price_cents, compare_at_price_cents, stock, image_url, trailer_video_id,
      featured, active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const seed = db.transaction(() => {
  const catalogMigrationKey = 'catalog_real_games_v1';
  const catalogAlreadyMigrated = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(catalogMigrationKey);
  if (!catalogAlreadyMigrated) {
    const removeLegacyProduct = db.prepare('DELETE FROM products WHERE id = ?');
    for (const product of legacySeedProducts) removeLegacyProduct.run(product.id);
    insertSetting.run(catalogMigrationKey, 'done');
  }

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
      defaultTrailerVideos[product.id] || '',
      product.featured
    );
    if (product.legacyImage) upgradeDefaultImage.run(product.image, product.id, product.legacyImage);
  }

  const setDefaultTrailer = db.prepare(`
    UPDATE products
    SET trailer_video_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (trailer_video_id = '' OR trailer_video_id IS NULL)
  `);
  for (const [productId, videoId] of Object.entries(defaultTrailerVideos)) {
    setDefaultTrailer.run(videoId, productId);
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
