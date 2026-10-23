// ═══════════════════════════════════════════════════════
//  POKEMONS — catálogo, filtros y render de cartas
//  Se carga PRIMERO (define la config y el estado compartido).
// ═══════════════════════════════════════════════════════
const BACKEND_URL = '';

const STAGE_LABELS = ['Básico', 'Fase 1', 'Fase 2', 'Legendario'];
const TYPE_ES = {
  fire:'Fuego', water:'Agua', grass:'Planta', electric:'Eléctrico',
  psychic:'Psíquico', dark:'Siniestro', dragon:'Dragón', steel:'Acero',
  fairy:'Hada', normal:'Normal', fighting:'Lucha', poison:'Veneno',
  ground:'Tierra', flying:'Volador', bug:'Bicho', rock:'Roca',
  ghost:'Fantasma', ice:'Hielo',
};

// ── Estado ──
let allPokemon = [];
let loaded     = false;
let filters    = { type:'all', gen:0, stage:-1, sort:'number' };

// ── Helpers ──
function getRarity(price, stage) {
  if (stage === 3)     return { key:'legendary', label:'Legendario' };
  if (price >= 120000) return { key:'epic',      label:'Épico'      };
  if (price >= 80000)  return { key:'rare',      label:'Raro'       };
  return                      { key:'common',    label:'Común'      };
}

function fallbackImg(pokeId) {
  return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + pokeId + '.png';
}

// ── Carga: UN solo request a nuestro servidor ──
async function loadAllPokemon() {
  renderSkeletons(20);
  try {
    const res  = await fetch(BACKEND_URL + '/api/pokemons');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor.');
    allPokemon = data.pokemons;
    loaded = true;
    applyFilters();
  } catch (err) {
    renderLoadError(err.message);
  }
}

function renderSkeletons(n) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = Array.from({ length: Math.min(n, 20) }).map(() => `
    <div class="skeleton">
      <div class="sk-img"></div>
      <div class="sk-body">
        <div class="sk-line short"></div>
        <div class="sk-line xshort"></div>
        <div class="sk-line"></div>
      </div>
    </div>`).join('');
}

function renderLoadError(msg) {
  document.getElementById('results-label').textContent = 'No se pudo cargar el catálogo';
  document.getElementById('products-grid').innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚠️</div>
      <p>${msg}</p>
      <button class="clear-filters-btn" style="margin-top:12px" onclick="loadAllPokemon()">↻ Reintentar</button>
    </div>`;
}

// ── Filtros ──
function setTypeFilter(type, btn) {
  filters.type = type;
  document.querySelectorAll('#type-pills .pill').forEach(b => {
    b.classList.remove('active');
    b.className = b.className.replace(/\b(fire|water|grass|electric|psychic|dark|dragon|steel|fairy|normal|fighting|poison|ground|flying|bug|rock|ghost|ice|all)\b/g, '').trim();
  });
  btn.classList.add('active', type);
  applyFilters();
}

function setGenFilter(gen, btn) {
  filters.gen = gen;
  document.querySelectorAll('#gen-pills .pill').forEach(b => {
    b.classList.remove('active');
    b.className = b.className.replace(/\bgen\d\b/g, '').trim();
  });
  btn.classList.add('active', gen > 0 ? 'gen' + gen : 'all');
  applyFilters();
}

function setStageFilter(stage, btn) {
  filters.stage = stage;
  document.querySelectorAll('#stage-pills .pill').forEach(b => {
    b.classList.remove('active');
    b.className = b.className.replace(/\b(basic|stage1|stage2|legendary|all)\b/g, '').trim();
  });
  const cls = ['basic', 'stage1', 'stage2', 'legendary'][stage] || 'all';
  btn.classList.add('active', cls);
  applyFilters();
}

function clearAllFilters() {
  filters = { type:'all', gen:0, stage:-1, sort: document.getElementById('sort-select').value };
  document.getElementById('search-input').value = '';
  ['type-pills', 'gen-pills', 'stage-pills'].forEach(id => {
    document.querySelectorAll('#' + id + ' .pill').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
      if (i === 0) b.classList.add('all');
    });
  });
  applyFilters();
}

function applyFilters() {
  if (!loaded) return; // mientras cargan los datos se muestran los skeletons

  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const sort   = document.getElementById('sort-select').value;
  filters.sort = sort;

  const list = allPokemon.filter(p => {
    if (filters.type  !== 'all' && !p.types.includes(filters.type)) return false;
    if (filters.gen   !== 0     && p.gen   !== filters.gen)         return false;
    if (filters.stage !== -1    && p.stage !== filters.stage)       return false;
    if (search && !p.name.toLowerCase().includes(search))           return false;
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'price-asc')  return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'name')       return a.name.localeCompare(b.name);
    return a.pokeId - b.pokeId;
  });

  renderGrid(list);
  document.getElementById('results-label').innerHTML =
    `<strong>${list.length}</strong> carta${list.length !== 1 ? 's' : ''} encontrada${list.length !== 1 ? 's' : ''}`;
}

// ── Render de cartas ──
function renderGrid(list) {
  const grid = document.getElementById('products-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🔍</div>
      <p>No se encontraron cartas con esos filtros.</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const rarity   = getRarity(p.price, p.stage);
    const inCart   = !!cart[p.prodId];
    const typeHtml = p.types.map(t =>
      `<span class="type-tag tt-${t}">${TYPE_ES[t] || t}</span>`
    ).join('');
    return `
    <div class="product-card">
      <div class="card-img-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='${fallbackImg(p.pokeId)}'">
        <span class="gen-badge">Gen ${p.gen}</span>
        <span class="rarity-badge rarity-${rarity.key}">${rarity.label}</span>
        <span class="pokedex-num">#${String(p.pokeId).padStart(3, '0')}</span>
      </div>
      <div class="card-info">
        <div class="type-tags">${typeHtml}</div>
        <div class="card-name">${p.name}</div>
        <div class="card-stage">${STAGE_LABELS[p.stage]}</div>
        <div class="card-footer">
          <div class="price">Gs. ${p.price.toLocaleString()} <sub>PYG</sub></div>
          <button class="add-btn ${inCart ? 'in-cart' : ''}" onclick="toggleCart('${p.prodId}')">
            ${inCart ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}
