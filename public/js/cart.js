// ═══════════════════════════════════════════════════════
//  CART — carrito y modal (vista carrito)
//  Usa allPokemon / applyFilters / fallbackImg / STAGE_LABELS de pokemons.js
// ═══════════════════════════════════════════════════════
let cart = {};

function toggleCart(prodId) {
  const p = allPokemon.find(x => x.prodId === prodId);
  if (!p) return;
  if (cart[prodId]) delete cart[prodId];
  else cart[prodId] = { ...p, qty: 1 };
  updateCartCount();
  applyFilters();
}

function removeFromCart(prodId) {
  delete cart[prodId];
  updateCartCount();
  applyFilters();
  renderCartItems();
}

function clearCart() {
  if (!confirm('¿Vaciar todo el carrito?')) return;
  cart = {};
  updateCartCount();
  applyFilters();
  renderCartItems();
}

function changeQty(prodId, delta) {
  if (!cart[prodId]) return;
  cart[prodId].qty = Math.max(1, cart[prodId].qty + delta);
  updateCartCount();
  renderCartItems();
}

function updateCartCount() {
  document.getElementById('cart-count').textContent = getCartUnits();
}

function getCartTotal() { return Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0); }
function getCartUnits() { return Object.values(cart).reduce((s, i) => s + i.qty, 0); }

function openCart() {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('cart-view').style.display     = 'block';
  document.getElementById('checkout-view').style.display = 'none';
  document.getElementById('modal-title').textContent     = '🛒 Mi Carrito';
  renderCartItems();
}
function closeCart() { document.getElementById('overlay').classList.remove('open'); }
function handleOverlayClick(e) { if (e.target === document.getElementById('overlay')) closeCart(); }

function renderCartItems() {
  const items   = Object.values(cart);
  const list    = document.getElementById('cart-items-list');
  const empty   = document.getElementById('cart-empty');
  const bottom  = document.getElementById('cart-bottom');
  const summary = document.getElementById('cart-summary');

  if (!items.length) {
    list.innerHTML = ''; empty.style.display = 'block'; bottom.style.display = 'none'; return;
  }
  empty.style.display = 'none'; bottom.style.display = 'block';

  list.innerHTML = items.map(p => `
    <div class="cart-item">
      <img class="ci-img" src="${p.img}" alt="${p.name}" onerror="this.src='${fallbackImg(p.pokeId)}'">
      <div class="ci-body">
        <div class="ci-name">${p.name}</div>
        <div class="ci-meta">#${String(p.pokeId).padStart(3, '0')} · Gen ${p.gen} · ${STAGE_LABELS[p.stage]}</div>
        <div class="ci-price">Gs. ${(p.price * p.qty).toLocaleString()}</div>
      </div>
      <div class="ci-controls">
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty('${p.prodId}',-1)">−</button>
          <span class="qty-num">${p.qty}</span>
          <button class="qty-btn" onclick="changeQty('${p.prodId}',1)">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart('${p.prodId}')">🗑️ Quitar</button>
      </div>
    </div>`).join('');

  const units = getCartUnits(), total = getCartTotal();
  summary.innerHTML = `
    <div class="sum-row"><span>Artículos (${units})</span><span>Gs. ${total.toLocaleString()}</span></div>
    <div class="sum-row"><span>Total a pagar</span><span>Gs. ${total.toLocaleString()}</span></div>`;
}
