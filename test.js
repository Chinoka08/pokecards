require('dotenv').config();
const crypto = require('crypto');

const debtId = process.argv[2];
const url    = process.argv[3] || 'http://localhost:3000/webhook/adamspay';

const body = JSON.stringify({
  notify: { id: 'test-' + Date.now(), type: 'debtStatus', version: 1 },
  debt:   { docId: debtId, objStatus: { status: 'success' }, payStatus: { status: 'paid' } },
});
const hash = crypto.createHash('md5').update('adams' + body + process.env.WEBHOOK_SECRET).digest('hex');

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-adams-notify-hash': hash },
  body,
}).then(async r => console.log(r.status, await r.text()));