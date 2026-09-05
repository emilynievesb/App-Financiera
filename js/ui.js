// Bottom nav compartida - se inyecta sola leyendo data-pagina del <body>.
const MODULOS_NAV = [
  { id:'index', href:'index.html', icono:'bi-house-door-fill', label:'Inicio' },
  { id:'ingresos', href:'ingresos.html', icono:'bi-cash-coin', label:'Ingresos' },
  { id:'compras', href:'compras.html', icono:'bi-cart3', label:'Compras' },
  { id:'gastos', href:'gastos.html', icono:'bi-receipt', label:'Gastos' },
  { id:'inventario', href:'inventario.html', icono:'bi-box-seam', label:'Inventario' },
  { id:'reportes', href:'reportes.html', icono:'bi-bar-chart-line', label:'Reportes' }
];

document.addEventListener('DOMContentLoaded', ()=>{
  const activa = document.body.dataset.pagina;
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = MODULOS_NAV.map(m=>
    `<a class="bottom-nav-item${m.id===activa?' is-active':''}" href="${m.href}">
      <i class="bi ${m.icono}"></i><span>${m.label}</span>
    </a>`
  ).join('');
  document.body.appendChild(nav);

  inyectarModalFormaPago();
});

// Modal compartido "Nuevo método de pago" - se inyecta una vez por página y cualquier botón con
// clase .btn-nueva-forma-pago lo abre. Bootstrap no soporta bien modales apilados (cerrar el de
// arriba cierra los dos), así que en vez de apilarlo: se oculta el modal desde el que se abrió y,
// al terminar, se vuelve a mostrar (los datos que el usuario ya había escrito siguen ahí, el modal
// solo se ocultó, no se destruyó). Al guardar, dispara "formasPagoActualizadas" para que cada
// página refresque sus <select> de forma de pago.
let _modalOrigenFormaPago = null;
document.addEventListener('click', e=>{
  const btn = e.target.closest('.btn-nueva-forma-pago');
  if(!btn) return;
  const modalFormaPago = document.getElementById('modalFormaPago');
  const modalActual = btn.closest('.modal');
  if(modalActual && modalActual!==modalFormaPago){
    _modalOrigenFormaPago = modalActual;
    modalActual.addEventListener('hidden.bs.modal', function abrir(){
      modalActual.removeEventListener('hidden.bs.modal', abrir);
      bootstrap.Modal.getOrCreateInstance(modalFormaPago).show();
    }, { once:true });
    bootstrap.Modal.getInstance(modalActual)?.hide();
  } else {
    bootstrap.Modal.getOrCreateInstance(modalFormaPago).show();
  }
});

function inyectarModalFormaPago(){
  if(document.getElementById('modalFormaPago')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="modal fade" id="modalFormaPago" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form id="formNuevaFormaPago" class="needs-validation" novalidate>
          <div class="modal-header">
            <h5 class="modal-title fw-brand">Nuevo método de pago</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2">
              <label class="form-label">Nombre</label>
              <input class="form-control" name="nombre" required placeholder="Ej: Nequi, Daviplata...">
              <div class="invalid-feedback">Escribe un nombre.</div>
            </div>
            <div class="mb-2">
              <label class="form-label">Tipo</label>
              <select class="form-select" name="tipo" required>
                <option value="efectivo">Efectivo (billete o moneda física)</option>
                <option value="digital" selected>Digital (cuenta, billetera, tarjeta)</option>
                <option value="credito">Crédito (queda a deber)</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);

  const form = document.getElementById('formNuevaFormaPago');
  validarYGuardar(form, null, ()=>{
    crearFormaPago(form.nombre.value, form.tipo.value);
    bootstrap.Modal.getInstance(document.getElementById('modalFormaPago')).hide();
    mostrarToast('Método de pago guardado');
    document.dispatchEvent(new CustomEvent('formasPagoActualizadas'));
  });

  document.getElementById('modalFormaPago').addEventListener('hidden.bs.modal', ()=>{
    form.reset();
    form.classList.remove('was-validated');
    if(_modalOrigenFormaPago){
      const m = _modalOrigenFormaPago; _modalOrigenFormaPago = null;
      bootstrap.Modal.getOrCreateInstance(m).show();
    }
  });
}
