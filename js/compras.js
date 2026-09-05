document.addEventListener('DOMContentLoaded', ()=>{
  const formCompra = document.getElementById('formCompra');
  const selProducto = formCompra.querySelector('[name=productoId]');
  const inpCosto = formCompra.querySelector('[name=costoUnitario]');
  const selMetodo = formCompra.querySelector('[name=metodoPago]');
  const inpProveedor = formCompra.querySelector('[name=proveedorNombre]');
  const inpFecha = formCompra.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();

  function cargarProductos(){
    const productos = listarProductos();
    selProducto.innerHTML = productos.length
      ? productos.map(p=>`<option value="${p.id}" data-costo="${p.costoUnitario}">${esc(p.nombre)} (stock: ${p.stock})</option>`).join('')
      : '<option value="">No hay productos — créalos en Inventario</option>';
    if(productos[0]) inpCosto.value = productos[0].costoUnitario;
  }
  selProducto.addEventListener('change', ()=>{
    const opt = selProducto.selectedOptions[0];
    if(opt && opt.dataset.costo) inpCosto.value = opt.dataset.costo;
  });

  document.getElementById('modalCompra').addEventListener('show.bs.modal', ()=>{
    cargarProductos();
    llenarDatalist(document.getElementById('listaProveedoresCompra'), getAll(DB.PROVEEDORES).map(p=>p.nombre));
  });

  validarYGuardar(formCompra, ()=>{
    if(!selProducto.value) return false;
    if(selMetodo.value==='credito' && !inpProveedor.value.trim()) return false;
    return true;
  }, ()=>{
    const opt = selProducto.selectedOptions[0];
    const proveedor = inpProveedor.value.trim() ? obtenerOCrearProveedor(inpProveedor.value) : null;
    const cantidad = Number(formCompra.cantidad.value);
    const costoUnitario = Number(inpCosto.value);
    registrarCompra({
      fecha: inpFecha.value, productoId: selProducto.value, productoNombre: opt.textContent,
      cantidad, costoUnitario, total: Number((cantidad*costoUnitario).toFixed(2)),
      metodoPago: selMetodo.value, proveedorId: proveedor?proveedor.id:null, proveedorNombre: proveedor?proveedor.nombre:null,
      notas: formCompra.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalCompra')).hide();
    mostrarToast('Compra registrada y stock actualizado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.monto) inpCosto.value = r.monto;
    if(r.metodoPago) selMetodo.value = r.metodoPago;
  });

  // ---- Pagos a proveedores ----
  const formPago = document.getElementById('formPago');
  formPago.fecha.value = hoy();
  formPago.fecha.max = hoy();
  validarYGuardar(formPago, null, ()=>{
    const proveedor = obtenerOCrearProveedor(formPago.proveedorNombre.value);
    registrarPagoProveedor({
      fecha: formPago.fecha.value, proveedorId: proveedor.id, proveedorNombre: proveedor.nombre,
      monto: Number(formPago.monto.value), metodoPago: formPago.metodoPago.value, notas:''
    });
    mostrarToast('Pago registrado');
    formPago.fecha.value = hoy();
    refrescarTodo();
  });

  function refrescarCxP(){
    const filas = listarCuentasPorPagarProveedores(hoy());
    document.getElementById('tablaCxP').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.proveedor.nombre)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="2" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No debes a proveedores por ahora.</td></tr>';
    llenarDatalist(document.getElementById('listaProveedores'), getAll(DB.PROVEEDORES).map(p=>p.nombre));
  }

  // ---- Historial ----
  const histDesde = document.getElementById('histDesde'), histHasta = document.getElementById('histHasta');
  histHasta.value = hoy();
  histDesde.value = rangoMes(hoy()).desde;
  function refrescarHistorial(){
    const compras = getAll(DB.COMPRAS).filter(c=>enRango(c.fecha, histDesde.value, histHasta.value)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    document.getElementById('tablaHistorial').innerHTML = compras.length
      ? compras.map(c=>`<tr>
          <td class="td-titulo">${esc(c.productoNombre)}</td>
          <td data-label="Fecha">${formatoFecha(c.fecha)}</td>
          <td data-label="Cantidad">${c.cantidad}</td>
          <td data-label="Total" class="amount amount-negative">${formatoMoneda(c.total)}</td>
          <td data-label="Método">${badgeMetodo(c.metodoPago)}</td>
          <td data-label="Proveedor">${esc(c.proveedorNombre||'-')}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="6" class="estado-vacio"><i class="bi bi-cart3"></i>Aún no hay compras registradas hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const compras = getAll(DB.COMPRAS).filter(c=>enRango(c.fecha, rango.desde, rango.hasta));
    const r = resumenPorMetodo(compras, 'total');
    const total = r.efectivo+r.credito+r.transferencia+r.tarjeta;
    document.getElementById('tablaResumen').innerHTML = `
      <tr><th>Efectivo</th><td class="text-end amount">${formatoMoneda(r.efectivo)}</td></tr>
      <tr><th>Crédito</th><td class="text-end amount">${formatoMoneda(r.credito)}</td></tr>
      <tr><th>Transferencia</th><td class="text-end amount">${formatoMoneda(r.transferencia)}</td></tr>
      <tr><th>Tarjeta</th><td class="text-end amount">${formatoMoneda(r.tarjeta)}</td></tr>
      <tr class="border-top"><th>Total</th><td class="text-end amount amount-negative fs-5">${formatoMoneda(total)}</td></tr>`;
  }
  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>refrescarResumen(b.dataset.periodo)));
  resumenFecha.addEventListener('change', ()=>refrescarResumen('dia'));

  function refrescarTodo(){ refrescarCxP(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
