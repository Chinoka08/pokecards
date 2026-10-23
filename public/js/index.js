// ═══════════════════════════════════════════════════════
//  INDEX — arranque de la página (se carga ÚLTIMO)
// ═══════════════════════════════════════════════════════
async function checkBackendStatus() {
  const b = document.getElementById('env-badge');
  try {
    const res  = await fetch(BACKEND_URL + '/api/status');
    const data = await res.json();
    if (data.env === 'production') {
      b.textContent = '🟢 PRODUCCIÓN — Pagos Reales';
      b.style.background = 'rgba(30,200,100,0.15)';
      b.style.color = '#3ddc84';
    } else {
      b.textContent = '🟡 PRUEBAS — AdamsPay Staging';
    }
  } catch {
    b.textContent = '⚠️ Backend no conectado';
  }
}

checkBackendStatus();
loadAllPokemon();
