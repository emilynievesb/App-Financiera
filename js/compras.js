document.addEventListener('DOMContentLoaded', ()=>{
  const formCompra = document.getElementById('formCompra');
  const selProducto = formCompra.querySelector('[name=productoId]');
  const inpCosto = formCompra.querySelector('[name=costoUnitario]');
  const selMetodo = formCompra.querySelector('[name=metodoPago]');
  const inpProveedor = formCompra.querySelector('[name=proveedorNombre]');
  const inpFecha = formCompra.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();
  inpFecha.defaultValue = hoy();
  activarInputMoneda(inpCosto);

  function cargarProductos(){
    const valorPrevio = selProducto.value;
    const productos = listarProductos();
    selProducto.innerHTML = productos.length
      ? productos.map(p=>`<option value="${p.id}" data-costo="${p.costoUnitario}" data-nombre="${esc(p.nombre)}">${p.codigo} - ${esc(p.nombre)} (stock: ${p.stock})</option>`).join('')
      : '<option value="">No hay productos - créalos en Inventario</option>';
    // Si ya había un producto elegido (ej. al reabrir el modal tras crear un método de pago nuevo),
    // se conserva la selección y NO se pisa el costo que el usuario ya haya escrito.
    if(productos.some(p=>p.id===valorPrevio)){
      selProducto.value = valorPrevio;
    } else if(productos[0]){
      fijarValorMoneda(inpCosto, productos[0].costoUnitario);
    }
  }
  selProducto.addEventListener('change', ()=>{
    const opt = selProducto.selectedOptions[0];
    if(opt && opt.dataset.costo) fijarValorMoneda(inpCosto, opt.dataset.costo);
  });

  document.getElementById('modalCompra').addEventListener('show.bs.modal', ()=>{
    cargarProductos();
    poblarSelectFormaPago(selMetodo);
    llenarDatalist(document.getElementById('listaProveedoresCompra'), getAll(DB.PROVEEDORES).map(p=>p.nombre));
  });
  document.addEventListener('formasPagoActualizadas', ()=>{ poblarSelectFormaPago(selMetodo); poblarSelectFormaPago(formPago.metodoPago, 'credito'); });

  validarYGuardar(formCompra, ()=>{
    if(!selProducto.value) return false;
    if(valorMoneda(inpCosto)<=0) return false;
    if(tipoFormaPago(selMetodo.value)==='credito' && !inpProveedor.value.trim()) return false;
    return true;
  }, ()=>{
    const opt = selProducto.selectedOptions[0];
    const proveedor = inpProveedor.value.trim() ? obtenerOCrearProveedor(inpProveedor.value) : null;
    const cantidad = Number(formCompra.cantidad.value);
    const costoUnitario = valorMoneda(inpCosto);
    registrarCompra({
      fecha: inpFecha.value, productoId: selProducto.value, productoNombre: opt.dataset.nombre,
      cantidad, costoUnitario, total: Number((cantidad*costoUnitario).toFixed(2)),
      metodoPago: selMetodo.value, proveedorId: proveedor?proveedor.id:null, proveedorNombre: proveedor?proveedor.nombre:null,
      notas: formCompra.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalCompra')).hide();
    mostrarToast('Compra registrada y stock actualizado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.productoId){
      selProducto.value = r.productoId;
      const opt = selProducto.selectedOptions[0];
      if(opt && opt.dataset.costo) fijarValorMoneda(inpCosto, opt.dataset.costo);
    }
    if(r.cantidad) formCompra.cantidad.value = r.cantidad;
    if(r.monto) fijarValorMoneda(inpCosto, r.monto);
    if(r.metodoPago) selMetodo.value = r.metodoPago;
    if(r.persona) inpProveedor.value = r.persona;
  });

  // ---- Pagos a proveedores ----
  const formPago = document.getElementById('formPago');
  formPago.fecha.value = hoy();
  formPago.fecha.max = hoy();
  formPago.fecha.defaultValue = hoy();
  activarInputMoneda(formPago.monto);
  poblarSelectFormaPago(formPago.metodoPago, 'credito');
  validarYGuardar(formPago, ()=> valorMoneda(formPago.monto)>0, ()=>{
    const proveedor = obtenerOCrearProveedor(formPago.proveedorNombre.value);
    registrarPagoProveedor({
      fecha: formPago.fecha.value, proveedorId: proveedor.id, proveedorNombre: proveedor.nombre,
      monto: valorMoneda(formPago.monto), metodoPago: formPago.metodoPago.value, notas:''
    });
    mostrarToast('Pago registrado');
    refrescarTodo();
  });

  function refrescarCxP(){
    const filas = listarCuentasPorPagarProveedores(hoy());
    document.getElementById('tablaCxP').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.proveedor.nombre)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="2" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No debes a proveedores por ahora.</td></tr>';
    llenarDatalist(document.getElementById('listaProveedores'), getAll(DB.PROVEEDORES).map(p=>p.nombre));
  }

  function refrescarHistorialPagos(){
    const pagos = getAll(DB.PAGOS_PROVEEDORES).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,20);
    document.getElementById('tablaHistorialPagos').innerHTML = pagos.length
      ? pagos.map(p=>`<tr>
          <td class="td-titulo">${formatoFecha(p.fecha)}</td>
          <td data-label="Proveedor">${esc(p.proveedorNombre)}</td>
          <td data-label="Monto" class="text-end amount amount-negative">${formatoMoneda(p.monto)}</td>
          <td data-label="Método">${badgeMetodo(p.metodoPago)}</td>
          <td>${botonEliminar(p.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="5" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay pagos registrados.</td></tr>';
  }
  conectarEliminarFila(document.getElementById('tablaHistorialPagos'), eliminarPagoProveedor, refrescarTodo, '¿Eliminar este pago? La deuda con el proveedor volverá a subir.');

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
          <td data-label="Cantidad" class="text-end amount">${c.cantidad}</td>
          <td data-label="Total" class="text-end amount amount-negative">${formatoMoneda(c.total)}</td>
          <td data-label="Método">${badgeMetodo(c.metodoPago)}</td>
          <td data-label="Proveedor">${esc(c.proveedorNombre||'-')}</td>
          <td>${botonEliminar(c.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="7" class="estado-vacio"><i class="bi bi-cart3"></i>Aún no hay compras registradas hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);
  conectarEliminarFila(document.getElementById('tablaHistorial'), eliminarCompra, refrescarTodo, '¿Eliminar esta compra? El stock y el costo promedio del producto se recalcularán.');

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const compras = getAll(DB.COMPRAS).filter(c=>enRango(c.fecha, rango.desde, rango.hasta));
    document.getElementById('tablaResumen').innerHTML = renderResumenPorMetodo(resumenPorMetodo(compras, 'total'), 'amount-negative');
  }
  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-periodo]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    refrescarResumen(b.dataset.periodo);
  }));
  resumenFecha.addEventListener('change', ()=>refrescarResumen('dia'));

  function refrescarTodo(){ refrescarCxP(); refrescarHistorialPagos(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
