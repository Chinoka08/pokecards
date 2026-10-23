// Cliente de PokéAPI (solo se usa desde el servidor).
//
// Camino principal: UN solo request GraphQL con todos los IDs juntos.
// Respaldo: si GraphQL no responde, REST pokémon por pokémon (una única vez,
// porque el resultado se guarda en la base y no se vuelve a pedir).
const fetch = require('node-fetch');

const GRAPHQL_URL = process.env.POKEAPI_GRAPHQL_URL || 'https://beta.pokeapi.co/graphql/v1beta';
const REST_URL    = process.env.POKEAPI_REST_URL    || 'https://pokeapi.co/api/v2/pokemon/';
const TIMEOUT_MS  = 20000;

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const QUERY = `
  query ($ids: [Int!]) {
    pokemon_v2_pokemon(where: { id: { _in: $ids } }) {
      id
      name
      height
      weight
      pokemon_v2_pokemontypes(order_by: { slot: asc }) {
        pokemon_v2_type { name }
      }
    }
  }
`;

async function fetchViaGraphQL(ids) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { ids } }),
    timeout: TIMEOUT_MS,
  });
  if (!res.ok) throw new Error('GraphQL HTTP ' + res.status);
  const json = await res.json();
  if (json.errors) throw new Error('GraphQL: ' + JSON.stringify(json.errors).slice(0, 200));

  return json.data.pokemon_v2_pokemon.map((p) => ({
    id:     p.id,
    name:   capitalize(p.name),
    height: p.height,
    weight: p.weight,
    types:  p.pokemon_v2_pokemontypes.map((t) => t.pokemon_v2_type.name),
  }));
}

async function fetchViaRest(ids) {
  const out = [];
  const batchSize = 10; // de a poco para no saturar la API
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = await Promise.all(ids.slice(i, i + batchSize).map(async (id) => {
      try {
        const res = await fetch(REST_URL + id, { timeout: TIMEOUT_MS });
        if (!res.ok) return null;
        const d = await res.json();
        return {
          id: d.id, name: capitalize(d.name), height: d.height, weight: d.weight,
          types: d.types.map((t) => t.type.name),
        };
      } catch { return null; }
    }));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

async function fetchPokemonDetails(ids) {
  try {
    const rows = await fetchViaGraphQL(ids);
    console.log(`[PokéAPI] GraphQL: 1 request → ${rows.length}/${ids.length} pokémon`);
    return rows;
  } catch (err) {
    console.warn('[PokéAPI] GraphQL falló (' + err.message + '). Usando REST de respaldo...');
    const rows = await fetchViaRest(ids);
    console.log(`[PokéAPI] REST: ${rows.length}/${ids.length} pokémon`);
    return rows;
  }
}

module.exports = { fetchPokemonDetails };
