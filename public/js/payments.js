// ═══════════════════════════════════════════════════════
//  PAYMENTS — checkout y pago con AdamsPay
//  Usa cart / getCartTotal de cart.js y BACKEND_URL de pokemons.js
// ═══════════════════════════════════════════════════════
function goToCheckout() {
  document.getElementById('cart-view').style.display     = 'none';
  document.getElementById('checkout-view').style.display = 'block';
  document.getElementById('modal-title').textContent     = '💳 Datos de Pago';
  document.getElementById('checkout-total').textContent  = 'Gs. ' + getCartTotal().toLocaleString();
  const sm = document.getElementById('status-msg'); sm.className = 'status-msg'; sm.textContent = '';
}

function backToCart() {
  document.getElementById('checkout-view').style.display = 'none';
  document.getElementById('cart-view').style.display     = 'block';
  document.getElementById('modal-title').textContent     = '🛒 Mi Carrito';
}

async function processPayment() {
  const name  = document.getElementById('buyer-name').value.trim();
  const doc   = document.getElementById('buyer-doc').value.trim();
  const email = document.getElementById('buyer-email').value.trim();
  const sm    = document.getElementById('status-msg');
  const btn   = document.getElementById('pay-btn');

  if (!name)                { sm.className = 'status-msg error'; sm.textContent = '⚠️ Ingresá tu nombre.'; return; }
  if (!doc)                 { sm.className = 'status-msg error'; sm.textContent = '⚠️ Ingresá tu cédula.'; return; }
  if (!email.includes('@')) { sm.className = 'status-msg error'; sm.textContent = '⚠️ Email inválido.'; return; }

  btn.disabled = true;
  sm.className = 'status-msg loading';
  sm.innerHTML = '<span class="spinner"></span> Generando enlace de pago...';

  // Solo mandamos id + cantidad: el precio lo calcula el servidor desde la base
  const items = Object.values(cart).map(i => ({ id: i.prodId, qty: i.qty }));

  try {
    const res  = await fetch(BACKEND_URL + '/api/create-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerName: name, buyerDoc: doc, buyerEmail: email, items }),
    });
    const data = await res.json();
    sm.className = 'status-msg success';

    if (!res.ok || !data.success) throw new Error(data.error || 'Error del servidor.');

    sm.innerHTML = `✅ Redirigiendo... Total: Gs. ${data.total.toLocaleString()}`;

    // ── Guardar el pedido para mostrarlo al volver de AdamsPay ──
    const order = {
      debtId: data.debtId,
      total:  data.total,
      label:  data.label,
      buyer:  { name, email },
      items:  Object.values(cart).map(i => ({
        prodId: i.prodId, pokeId: i.pokeId, name: i.name,
        img: i.img, price: i.price, qty: i.qty,
      })),
      savedAt: Date.now(),
    };
    try { localStorage.setItem('pokecards:order:' + data.debtId, JSON.stringify(order)); } catch {}

    sm.className = 'status-msg success';
    setTimeout(() => { window.location.href = data.payUrl; }, 1100);
  } catch (err) {
    sm.className = 'status-msg error'; sm.innerHTML = '⚠️ ' + err.message; btn.disabled = false;
  }
}
