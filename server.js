require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const adams = require('./services/adamspay');
 if (!adams.API_KEY) {
   console.error('\nERROR: Falta ADAMSPAY_API_KEY en .env\n');
   process.exit(1);
 }

const { connectDB }               = require('./db/connection');
const { seedCatalog, countSynced, countTotal } = require('./db/Pokemon');
const { syncPokemons }            = require('./services/sync');
const pokemonsRoutes              = require('./routes/pokemons');
const { router: paymentsRoutes, webhookHandler } = require('./routes/payments');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

app.post('/webhook/adamspay',
  express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), webhookHandler
);

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API ──
app.get('/api/status', async (req, res) => {
  res.json({
    ok:            true,
    env:           adams.ENV,
    apiBase:       adams.BASE_URL,
    totalProducts: await countSynced(),
    apiKeyPrefix:  adams.API_KEY.slice(0, 8) + '...',
    timestamp:     new Date().toISOString(),
  });
});
app.use('/api/pokemons', pokemonsRoutes);
app.use('/api', paymentsRoutes);
 
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Arranque: conecta a MongoDB, siembra el catálogo y lo completa (1 request a PokéAPI la primera vez) ──
(async () => {
  await connectDB();
  await seedCatalog();
  await syncPokemons({ force: true });
  const synced = await countSynced(), total = await countTotal();
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   PokeCards Store — Backend v3');
    console.log('========================================');
    console.log('   URL:         http://localhost:' + PORT);
    console.log('   Ambiente:    ' + adams.ENV.toUpperCase());
    console.log('   Pokémon:     ' + synced + '/' + total + ' cartas en la base');
    console.log('   Diagnostico: http://localhost:' + PORT + '/api/test-adamspay');
    console.log('========================================\n');
  });
})();
