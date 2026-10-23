// Modelo `Pokemon` (colección `pokemons`) + todas las consultas del catálogo.
const mongoose = require('mongoose');
const CATALOG  = require('./catalog');

const IMG_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

// name/types/height/weight arrancan vacíos: los completa services/sync.js con PokéAPI.
const pokemonSchema = new mongoose.Schema({
  pokeId: { type: Number, required: true, unique: true },
  prodId: { type: String, required: true, unique: true },
  name:   { type: String, default: null },
  types:  { type: [String], default: [] },
  height: Number,
  weight: Number,
  price:  { type: Number, required: true, min: 1 },
  stage:  { type: Number, required: true, min: 0, max: 3 },
  gen:    { type: Number, required: true },
  img:    { type: String, required: true },
}, { collection: 'pokemons', versionKey: false });

const Pokemon = mongoose.model('Pokemon', pokemonSchema);

function getGen(id) {
  if (id <= 151) return 1; if (id <= 251) return 2; if (id <= 386) return 3;
  if (id <= 493) return 4; if (id <= 649) return 5; if (id <= 721) return 6;
  if (id <= 809) return 7; return 8;
}

// Documento → objeto que consume el front
function toApi(d) {
  return {
    prodId: d.prodId, pokeId: d.pokeId, name: d.name, types: d.types,
    height: d.height, weight: d.weight,
    price: d.price, stage: d.stage, gen: d.gen, img: d.img,
  };
}

// ── Seed: inserta lo que falte con $setOnInsert (no pisa precios editados a mano) ──
async function seedCatalog() {
  await Pokemon.init(); // asegura los índices únicos antes de insertar
  await Pokemon.bulkWrite(CATALOG.map(([id, price, stage]) => ({
    updateOne: {
      filter: { pokeId: id },
      update: { $setOnInsert: {
        pokeId: id,
        prodId: 'pk' + String(id).padStart(3, '0'),
        price, stage,
        gen: getGen(id),
        img: IMG_BASE + id + '.png',
      } },
      upsert: true,
    },
  })));
}

// ── Consultas (todas async) ──
const listPokemons   = async () => (await Pokemon.find({ name: { $ne: null } }).sort({ pokeId: 1 }).lean()).map(toApi);
const findByProdIds  = (prodIds) => Pokemon.find({ prodId: { $in: prodIds } }).lean();
const missingPokeIds = async () => (await Pokemon.find({ name: null }, 'pokeId').sort({ pokeId: 1 }).lean()).map(d => d.pokeId);
const countSynced    = () => Pokemon.countDocuments({ name: { $ne: null } });
const countTotal     = () => Pokemon.countDocuments();

// Guarda los datos de PokéAPI en un solo bulkWrite
const saveDetails = (details) => Pokemon.bulkWrite(details.map(d => ({
  updateOne: {
    filter: { pokeId: d.id },
    update: { $set: { name: d.name, types: d.types, height: d.height, weight: d.weight } },
  },
})));

module.exports = {
  Pokemon, seedCatalog,
  listPokemons, findByProdIds, missingPokeIds, countSynced, countTotal, saveDetails,
};
