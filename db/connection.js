// Conexión a MongoDB (local, Docker o Atlas: solo cambia MONGODB_URI en .env)
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pokecards';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('[MongoDB] Conectado a', mongoose.connection.host + ':' + mongoose.connection.port + '/' + mongoose.connection.name);
  } catch (err) {
    console.error('\nERROR: No se pudo conectar a MongoDB (' + err.message + ')');
    console.error('Revisá MONGODB_URI en .env o levantá uno local con: docker compose up -d\n');
    process.exit(1);
  }
}

module.exports = { connectDB };

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
