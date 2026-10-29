// Cliente de AdamsPay: configuración + request genérico.
const fetch = require('node-fetch');

const ENV   = process.env.ADAMSPAY_ENV || 'staging';
const BASES = {
  staging:    'https://staging.adamspay.com/api/v1',
  production: 'https://staging.adamspay.com/api/v1',
};
const BASE_URL   = BASES[ENV];
const API_KEY    = process.env.ADAMSPAY_API_KEY;
console.log('[Debug] env:', ENV, '| apikey length:', API_KEY ? API_KEY.length : 0);
const RETURN_URL = process.env.RETURN_URL || 'http://localhost:3000/gracias.html';
const CANCEL_URL = process.env.CANCEL_URL || 'http://localhost:3000/cancelado.html';

// AdamsPay: fecha UTC sin milisegundos
function toAdamsDate(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

async function adamspayRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY, 'x-if-exists': 'update' },
  };
  if (body) options.body = JSON.stringify(body);
  console.log('\n[AdamsPay]', method, BASE_URL + endpoint);
  if (body) console.log('[Body]', JSON.stringify(body, null, 2));
  const res  = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json();
  console.log('[Respuesta]', res.status, JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

module.exports = { ENV, BASE_URL, API_KEY, RETURN_URL, CANCEL_URL, toAdamsDate, adamspayRequest };