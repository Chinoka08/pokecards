// GET /api/pokemons            → todo el catálogo en un solo request
// GET /api/pokemons?ids=6,25   → solo esos pokémon (lo usa gracias.html)
const express = require('express');
const { listPokemons, countSynced, countTotal } = require('../db/Pokemon');
const { syncPokemons } = require('../services/sync');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Si faltan datos (p. ej. PokéAPI estaba caída al arrancar), reintenta el sync.
    if (await countSynced() < await countTotal()) await syncPokemons();

    let pokemons = await listPokemons();
    if (req.query.ids) {
      const wanted = new Set(String(req.query.ids).split(',').map(Number).filter(Number.isInteger));
      pokemons = pokemons.filter((p) => wanted.has(p.pokeId));
    }

    if (!pokemons.length && !req.query.ids) {
      return res.status(503).json({ error: 'El catálogo todavía no está disponible. Probá de nuevo en unos segundos.' });
    }
    res.json({ total: pokemons.length, pokemons });
  } catch (err) {
    console.error('[GET /api/pokemons]', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
