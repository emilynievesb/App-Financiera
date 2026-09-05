// Utilidades de fecha, formato, validación y feedback visual - compartidas por todas las páginas.

function hoy(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function esc(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatoMoneda(n){
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0);
}

function formatoFecha(f){
  if(!f) return '';
  const [y,m,d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function fechaMenosDias(n){
  const d = new Date();
  d.setDate(d.getDate()-n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function rangoDia(fecha){ return { desde:fecha, hasta:fecha }; }

function rangoSemana(fecha){
  const d = new Date(fecha+'T00:00:00');
  const dow = (d.getDay()+6)%7; // lunes=0
  const lunes = new Date(d); lunes.setDate(d.getDate()-dow);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate()+6);
  return { desde: lunes.toISOString().slice(0,10), hasta: domingo.toISOString().slice(0,10) };
}

function rangoMes(fecha){
  const [y,m] = fecha.split('-');
  const ultimoDia = new Date(Number(y), Number(m), 0).getDate();
  return { desde:`${y}-${m}-01`, hasta:`${y}-${m}-${String(ultimoDia).padStart(2,'0')}` };
}

function enRango(fecha, desde, hasta){ return fecha >= desde && fecha <= hasta; }

function sum(arr, campo){ return arr.reduce((s,x)=> s + (Number(x[campo])||0), 0); }

// Devuelve {nombreFormaPago: total}, con una llave por cada forma de pago del catálogo (aunque
// esté en 0) más cualquier valor suelto que no esté en el catálogo (datos viejos, por ejemplo).
function resumenPorMetodo(arr, campoMonto){
  const r = {};
  listarFormasPago().forEach(f=> r[f.nombre] = 0);
  arr.forEach(x=>{ r[x.metodoPago] = (r[x.metodoPago]||0) + (Number(x[campoMonto])||0); });
  return r;
}

// Pinta las filas de un resumen por forma de pago + fila de total, para las pestañas "Resumen".
function renderResumenPorMetodo(r, claseTotal){
  const filas = Object.entries(r).map(([nombre,val])=>
    `<tr><th>${esc(nombre)}</th><td class="text-end amount">${formatoMoneda(val)}</td></tr>`).join('');
  const total = Object.values(r).reduce((s,v)=>s+v, 0);
  return filas + `<tr class="border-top"><th>Total</th><td class="text-end amount ${claseTotal} fs-5">${formatoMoneda(total)}</td></tr>`;
}

function agruparPorDia(arr, campoFecha, campoMonto){
  const mapa = {};
  arr.forEach(x=>{ mapa[x[campoFecha]] = (mapa[x[campoFecha]]||0) + (Number(x[campoMonto])||0); });
  return Object.keys(mapa).sort().map(fecha=>({ fecha, total: mapa[fecha] }));
}

// Envuelve un <form> Bootstrap con el patrón needs-validation/was-validated + reglas de negocio propias.
function validarYGuardar(form, reglasExtra, guardarFn){
  form.addEventListener('submit', e=>{
    e.preventDefault();
    e.stopPropagation();
    const extraOk = reglasExtra ? reglasExtra() : true;
    if(!form.checkValidity() || !extraOk){
      form.classList.add('was-validated');
      return;
    }
    guardarFn();
    form.reset();
    form.classList.remove('was-validated');
  });
}

let _toastContainer = null;
function mostrarToast(mensaje, tipo){
  tipo = tipo || 'success';
  if(!_toastContainer){
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    _toastContainer.style.zIndex = 1080;
    document.body.appendChild(_toastContainer);
  }
  const icono = tipo==='success' ? 'bi-check-circle-fill' : tipo==='danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0`;
  el.setAttribute('role','alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${icono} me-1"></i> ${esc(mensaje)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  _toastContainer.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 2500 });
  toast.show();
  el.addEventListener('hidden.bs.toast', ()=> el.remove());
}

// Cuenta de 0 al valor final en ~600ms. Recibe el elemento y una función de formato opcional.
function animarNumero(el, valorFinal, formatoFn){
  formatoFn = formatoFn || formatoMoneda;
  const duracion = 600;
  const inicio = performance.now();
  function paso(ahora){
    const t = Math.min(1, (ahora-inicio)/duracion);
    const facilitado = 1 - Math.pow(1-t, 3);
    el.textContent = formatoFn(valorFinal * facilitado);
    if(t < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

// Rellena un <datalist> con nombres (para autocompletar cliente/proveedor).
function llenarDatalist(datalistEl, nombres){
  datalistEl.innerHTML = nombres.map(n=>`<option value="${esc(n)}">`).join('');
}

const CLASE_TIPO_FORMA_PAGO = { efectivo:'text-bg-secondary', digital:'text-bg-info', credito:'text-bg-warning' };
function badgeMetodo(metodo){
  const clase = CLASE_TIPO_FORMA_PAGO[tipoFormaPago(metodo)] || 'text-bg-secondary';
  return `<span class="badge ${clase}">${esc(metodo)}</span>`;
}

// Botón de eliminar reutilizable para filas de historial (ver conectarEliminarFila).
function botonEliminar(id){
  return `<button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-fila" data-id="${esc(id)}" title="Eliminar"><i class="bi bi-trash3"></i></button>`;
}

// Delega clicks de .btn-eliminar-fila dentro de `contenedor`: confirma, llama eliminarFn(id) y refresca.
// La confirmación es nativa (confirm()) a propósito: eliminar no se puede deshacer y no vale la pena
// un modal propio para esto.
function conectarEliminarFila(contenedor, eliminarFn, refrescarFn, mensaje){
  contenedor.addEventListener('click', e=>{
    const btn = e.target.closest('.btn-eliminar-fila');
    if(!btn) return;
    if(!confirm(mensaje || '¿Eliminar este registro? No se puede deshacer.')) return;
    eliminarFn(btn.dataset.id);
    mostrarToast('Registro eliminado');
    refrescarFn();
  });
}

// Da formato de miles a un campo de dinero mientras el usuario escribe (ej. "20.000"). Se usa en
// <input type="text" inputmode="decimal"> en vez de type="number" porque los inputs numéricos
// nativos no aceptan separadores de miles. El valor real (sin puntos) se lee con valorMoneda(el).
function activarInputMoneda(el){
  el.setAttribute('inputmode', 'decimal');
  el.addEventListener('input', ()=>{
    const digitos = el.value.replace(/\D/g,'');
    el.value = digitos ? Number(digitos).toLocaleString('es-CO') : '';
  });
}
function valorMoneda(el){
  return Number((el.value||'').replace(/\D/g,'')) || 0;
}
// Pone un número en un campo de dinero ya formateado (ej. 25000 -> "25.000"), para prellenados
// hechos desde JS (voz, precio sugerido) que no pasan por el listener de activarInputMoneda.
function fijarValorMoneda(el, numero){
  el.value = numero ? Number(numero).toLocaleString('es-CO') : '';
}

// Llena un <select> de forma de pago desde el catálogo. `excluirTipo` (ej. 'credito') omite esas
// opciones - para formularios de abono/pago, donde no tiene sentido "pagar a crédito".
function poblarSelectFormaPago(selectEl, excluirTipo){
  const valorPrevio = selectEl.value;
  const formas = listarFormasPago().filter(f=> !excluirTipo || f.tipo!==excluirTipo);
  selectEl.innerHTML = formas.map(f=>`<option value="${esc(f.nombre)}">${esc(f.nombre)}</option>`).join('');
  if(formas.some(f=>f.nombre===valorPrevio)) selectEl.value = valorPrevio;
}
