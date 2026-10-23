// Completa en la base los datos que vienen de PokéAPI (nombre, tipos, medidas).
// Solo pide lo que falta, así que después de la primera vez no hace ningún request.
const { missingPokeIds, saveDetails, countSynced, countTotal } = require('../db/Pokemon');
const { fetchPokemonDetails } = require('./pokeapi');

const RETRY_COOLDOWN_MS = 30 * 1000;
let inFlight    = null;
let lastAttempt = 0;

async function runSync() {
  const missing = await missingPokeIds();
  if (!missing.length) return;
  const details = await fetchPokemonDetails(missing);
  if (details.length) await saveDetails(details);
  console.log(`[Sync] Catálogo: ${await countSynced()}/${await countTotal()} pokémon con datos completos`);
}

// Seguro de llamar muchas veces: reutiliza el sync en curso y respeta un cooldown tras fallar.
function syncPokemons({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastAttempt < RETRY_COOLDOWN_MS) return Promise.resolve();
  lastAttempt = Date.now();
  inFlight = runSync()
    .catch((err) => console.error('[Sync] Error:', err.message))
    .finally(() => { inFlight = null; });
  return inFlight;
}

module.exports = { syncPokemons };
