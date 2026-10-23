const crypto = require('crypto');
const Order = require('../db/Order');

// Traduce los estados de AdamsPay a los que usa tu frontend
function mapDebtStatus(debt) {
  if (debt?.payStatus?.status === 'paid') return 'paid';
  switch (debt?.objStatus?.status) {
    case 'canceled': return 'cancelled';
    case 'expired': return 'expired';
    case 'error': return 'error';
  }
  return debt?.status || 'pending';   // compatibilidad con lo que ya tenías
}

// Arma la respuesta con la misma forma que espera gracias.html
function orderToResponse(o) {
  return {
    debtId: o.debtId, status: o.status, label: o.label,
    amount: { currency: 'PYG', value: String(o.total) },
    metadata: {
      buyerName: o.buyer?.name,
      buyerEmail: o.buyer?.email,
      items: o.items.map(i => i.prodId + ' x' + i.qty).join(', '),
    },
  };
}
// Rutas de pago: crear deuda, consultar estado, webhook y diagnóstico.
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { findByProdIds } = require('../db/Pokemon');
const { RETURN_URL, CANCEL_URL, toAdamsDate, adamspayRequest } = require('../services/adamspay');

const router = express.Router();

// Calcula el total con los precios de la BASE (nunca confía en el precio del navegador)
async function calcTotal(items) {
  const docs = await findByProdIds([...new Set(items.map(i => i.id))]); // 1 sola consulta
  const byProd = new Map(docs.map(d => [d.prodId, d]));

  let total = 0;
  const detail = [];
  for (const item of items) {
    const p = byProd.get(item.id);
    if (!p) throw new Error('Producto desconocido: ' + item.id);
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)
      throw new Error('Cantidad inválida: ' + item.id);
    total += p.price * item.qty;
    detail.push({ prodId: p.prodId, pokeId: p.pokeId, price: p.price, qty: item.qty, subtotal: p.price * item.qty });
  }
  if (total <= 0) throw new Error('Carrito vacío');
  return { total, detail };
}

// GET /api/test-adamspay
router.get('/test-adamspay', async (req, res) => {
  try {
    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 60 * 1000);
    const body = {
      debt: {
        docId: 'test-' + Date.now(),
        label: 'Prueba PokeCards',
        amount: { currency: 'PYG', value: '1000' },
        validPeriod: { start: toAdamsDate(now), end: toAdamsDate(expires) },
      },
    };
    const { status, data } = await adamspayRequest('POST', '/debts', body);
    res.json({ resultado: (status === 200 || status === 201) ? 'CONEXION OK' : 'ERROR', httpStatus: status, respuestaAdams: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/create-payment
router.post('/create-payment', async (req, res) => {
  try {
    const { buyerName, buyerDoc, buyerEmail, items } = req.body;

    if (!buyerName?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });
    if (!buyerDoc?.trim()) return res.status(400).json({ error: 'La cédula es requerida.' });
    if (!buyerEmail?.trim() || !buyerEmail.includes('@'))
      return res.status(400).json({ error: 'Email inválido.' });
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'Carrito vacío.' });

    const { total, detail } = await calcTotal(items);

    const label = detail.length === 1
      ? 'PokeCards: Carta Pokémon #' + detail[0].pokeId
      : 'PokeCards: ' + detail.length + ' cartas Pokémon';
    const debtId = 'pc-' + buyerDoc.replace(/\D/g, '').slice(0, 7) + '-' + uuidv4().slice(0, 6);
    const now = new Date();
    const expires = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const debtPayload = {
      debt: {
        docId: debtId,
        label,
        amount: { currency: 'PYG', value: String(total) },
        validPeriod: { start: toAdamsDate(now), end: toAdamsDate(expires) },
        returnUrl: RETURN_URL + '?debtId=' + encodeURIComponent(debtId),
        cancelUrl: CANCEL_URL + '?debtId=' + encodeURIComponent(debtId) + '&reason=cancelled',
        metadata: {
          buyerName, buyerEmail,
          items: detail.map((i) => i.prodId + ' x' + i.qty).join(', '),
        },
      },
    };

    const { status, data } = await adamspayRequest('POST', '/debts', debtPayload);

    if (status !== 200 && status !== 201) {
      const msg = (data?.meta?.message) || (data?.message) || JSON.stringify(data);
      return res.status(502).json({ error: 'AdamsPay: ' + msg, raw: data });
    }

    const payUrl = data.debt?.payUrl;
    if (!payUrl) return res.status(502).json({ error: 'AdamsPay no devolvió payUrl.', raw: data });
    try {
      await Order.create({
        debtId, status: 'pending', total, label,
        buyer: { name: buyerName, email: buyerEmail },
        items: detail.map(({ prodId, pokeId, price, qty }) => ({ prodId, pokeId, price, qty })),
      });
    } catch (e) { console.error('[Order] No se pudo guardar:', e.message); }
    console.log('✅ Pago creado:', debtId, '| Gs.', total, '|', buyerName);
    return res.json({ success: true, payUrl, debtId, total, label });

  } catch (err) {
    console.error('[create-payment]', err.message);
    return res.status(500).json({ error: err.message });
  }
});


// GET /api/check-payment/:debtId  → lee el estado que dejó el webhook
router.get('/check-payment/:debtId', async (req, res) => {
  try {
    const order = await Order.findOne({ debtId: req.params.debtId });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    return res.json(orderToResponse(order));
  } catch (err) {
    console.error('[check-payment]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /webhook/adamspay  (se monta aparte en server.js, la URL no cambia)
function verifySignature(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || !req.rawBody) return false;

  const expected = crypto.createHash('md5')
    .update(Buffer.concat([Buffer.from('adams'), req.rawBody, Buffer.from(secret)]))
    .digest('hex');
  const received = String(req.headers['x-adams-notify-hash'] || '');

  const a = Buffer.from(expected), b = Buffer.from(received);
  console.log('[Webhook-debug]', {
  recibido:  received,
  esperado:  expected,
  bytes:     req.rawBody.length,
  largoSecreto: secret.length,
  });
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function webhookHandler(req, res) {
  // 1) Validar que viene de AdamsPay
  if (!verifySignature(req)) {
    console.warn('[Webhook] Firma inválida, se ignora.');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  const { notify, debt } = req.body || {};

  // 2) Otros eventos: responder 200 igual para que AdamsPay no reintente
  if (notify?.type !== 'debtStatus' || !debt?.docId) {
    return res.status(200).json({ ignored: true });
  }

  try {
    const newStatus = mapDebtStatus(debt);
    const order = await Order.findOne({ debtId: debt.docId });

    if (!order) {
      console.warn('[Webhook] Deuda desconocida:', debt.docId);
      return res.status(200).json({ ignored: true });
    }

    // 3) La notificación puede ser por otro motivo (cambió la descripción,
    //    pago fallido, repetición...). Solo actuamos si el estado cambió.
    if (order.status === newStatus) return res.status(200).json({ received: true });

    const previous = order.status;
    order.status = newStatus;
    order.lastNotifyId = notify.id;
    order.paidAt = newStatus === 'paid' ? new Date() : undefined;
    await order.save();

    console.log('[Webhook]', debt.docId, previous, '->', newStatus);

    if (newStatus === 'paid' && previous !== 'paid') {
      // Acá va lo que deba ocurrir una sola vez al cobrar:
      // enviar email, descontar stock, etc.
      console.log('✅ PAGADO:', debt.docId);
    }
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[Webhook]', err.message);
    // 500 a propósito: así AdamsPay reintenta si falló la base
    return res.status(500).json({ error: 'Error interno.' });
  }
}

module.exports = { router, webhookHandler };
