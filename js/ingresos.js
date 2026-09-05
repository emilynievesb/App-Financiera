document.addEventListener('DOMContentLoaded', ()=>{
  const formVenta = document.getElementById('formVenta');
  const selProducto = formVenta.querySelector('[name=productoId]');
  const inpPrecio = formVenta.querySelector('[name=precioUnitario]');
  const selMetodo = formVenta.querySelector('[name=metodoPago]');
  const inpCliente = formVenta.querySelector('[name=clienteNombre]');
  const inpFecha = formVenta.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();
  // defaultValue (no solo value) para que form.reset() - que valida YGuardar ejecuta después de
  // cada guardado - vuelva a dejar la fecha en hoy en vez de vaciarla.
  inpFecha.defaultValue = hoy();
  activarInputMoneda(inpPrecio);

  function cargarProductos(){
    const valorPrevio = selProducto.value;
    const productos = listarProductos();
    selProducto.innerHTML = productos.length
      ? productos.map(p=>`<option value="${p.id}" data-precio="${ultimoPrecioVenta(p.id)}" data-nombre="${esc(p.nombre)}">${p.codigo} - ${esc(p.nombre)} (stock: ${p.stock})</option>`).join('')
      : '<option value="">No hay productos - créalos en Inventario</option>';
    // Si ya había un producto elegido (ej. al reabrir el modal tras crear un método de pago nuevo),
    // se conserva la selección y NO se pisa el precio que el usuario ya haya escrito.
    if(productos.some(p=>p.id===valorPrevio)){
      selProducto.value = valorPrevio;
    } else if(productos[0]){
      fijarValorMoneda(inpPrecio, ultimoPrecioVenta(productos[0].id));
    }
  }
  selProducto.addEventListener('change', ()=>{
    const opt = selProducto.selectedOptions[0];
    if(opt && opt.dataset.precio) fijarValorMoneda(inpPrecio, opt.dataset.precio);
  });

  document.getElementById('modalVenta').addEventListener('show.bs.modal', ()=>{
    cargarProductos();
    poblarSelectFormaPago(selMetodo);
    llenarDatalist(document.getElementById('listaClientesVenta'), getAll(DB.CLIENTES).map(c=>c.nombre));
  });
  document.addEventListener('formasPagoActualizadas', ()=>{ poblarSelectFormaPago(selMetodo); poblarSelectFormaPago(formAbono.metodoPago, 'credito'); });

  validarYGuardar(formVenta, ()=>{
    if(!selProducto.value) return false;
    if(valorMoneda(inpPrecio)<=0) return false;
    if(tipoFormaPago(selMetodo.value)==='credito' && !inpCliente.value.trim()) return false;
    return true;
  }, ()=>{
    const opt = selProducto.selectedOptions[0];
    const cliente = inpCliente.value.trim() ? obtenerOCrearCliente(inpCliente.value) : null;
    const cantidad = Number(formVenta.cantidad.value);
    const precioUnitario = valorMoneda(inpPrecio);
    registrarVenta({
      fecha: inpFecha.value, productoId: selProducto.value, productoNombre: opt.dataset.nombre,
      cantidad, precioUnitario, total: Number((cantidad*precioUnitario).toFixed(2)),
      metodoPago: selMetodo.value, clienteId: cliente?cliente.id:null, clienteNombre: cliente?cliente.nombre:null,
      notas: formVenta.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalVenta')).hide();
    mostrarToast('Venta registrada y stock actualizado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.monto) fijarValorMoneda(inpPrecio, r.monto);
    if(r.metodoPago) selMetodo.value = r.metodoPago;
  });

  // ---- Abonos ----
  const formAbono = document.getElementById('formAbono');
  formAbono.fecha.value = hoy();
  formAbono.fecha.max = hoy();
  formAbono.fecha.defaultValue = hoy();
  activarInputMoneda(formAbono.monto);
  poblarSelectFormaPago(formAbono.metodoPago, 'credito');
  validarYGuardar(formAbono, ()=> valorMoneda(formAbono.monto)>0, ()=>{
    const cliente = obtenerOCrearCliente(formAbono.clienteNombre.value);
    registrarAbonoCliente({
      fecha: formAbono.fecha.value, clienteId: cliente.id, clienteNombre: cliente.nombre,
      monto: valorMoneda(formAbono.monto), metodoPago: formAbono.metodoPago.value, notas:''
    });
    mostrarToast('Abono registrado');
    refrescarTodo();
  });

  function refrescarCxC(){
    const filas = listarCuentasPorCobrar(hoy());
    document.getElementById('tablaCxC').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.cliente.nombre)}</td><td data-label="Debe" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td><td data-label=""></td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="3" class="estado-vacio"><i class="bi bi-emoji-smile"></i>Nadie te debe por ahora.</td></tr>';
    llenarDatalist(document.getElementById('listaClientes'), getAll(DB.CLIENTES).map(c=>c.nombre));
  }

  function refrescarHistorialAbonos(){
    const abonos = getAll(DB.ABONOS_CLIENTES).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,20);
    document.getElementById('tablaHistorialAbonos').innerHTML = abonos.length
      ? abonos.map(a=>`<tr>
          <td class="td-titulo">${formatoFecha(a.fecha)}</td>
          <td data-label="Cliente">${esc(a.clienteNombre)}</td>
          <td data-label="Monto" class="text-end amount amount-positive">${formatoMoneda(a.monto)}</td>
          <td data-label="Método">${badgeMetodo(a.metodoPago)}</td>
          <td data-label="">${botonEliminar(a.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="5" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay abonos registrados.</td></tr>';
  }
  conectarEliminarFila(document.getElementById('tablaHistorialAbonos'), eliminarAbonoCliente, refrescarTodo, '¿Eliminar este abono? El saldo del cliente volverá a subir.');

  // ---- Historial ----
  const histDesde = document.getElementById('histDesde'), histHasta = document.getElementById('histHasta');
  histHasta.value = hoy();
  histDesde.value = rangoMes(hoy()).desde;
  function refrescarHistorial(){
    const ventas = getAll(DB.VENTAS).filter(v=>enRango(v.fecha, histDesde.value, histHasta.value)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    document.getElementById('tablaHistorial').innerHTML = ventas.length
      ? ventas.map(v=>`<tr>
          <td class="td-titulo">${esc(v.productoNombre)}</td>
          <td data-label="Fecha">${formatoFecha(v.fecha)}</td>
          <td data-label="Cantidad" class="text-end amount">${v.cantidad}</td>
          <td data-label="Total" class="text-end amount amount-positive">${formatoMoneda(v.total)}</td>
          <td data-label="Método">${badgeMetodo(v.metodoPago)}</td>
          <td data-label="Cliente">${esc(v.clienteNombre||'-')}</td>
          <td data-label="">${botonEliminar(v.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="7" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay ventas registradas hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);
  conectarEliminarFila(document.getElementById('tablaHistorial'), eliminarVenta, refrescarTodo, '¿Eliminar esta venta? El stock del producto se devolverá automáticamente.');

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const ventas = getAll(DB.VENTAS).filter(v=>enRango(v.fecha, rango.desde, rango.hasta));
    document.getElementById('tablaResumen').innerHTML = renderResumenPorMetodo(resumenPorMetodo(ventas, 'total'), 'amount-positive');
  }
  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-periodo]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    refrescarResumen(b.dataset.periodo);
  }));
  resumenFecha.addEventListener('change', ()=>refrescarResumen('dia'));

  function refrescarTodo(){ refrescarCxC(); refrescarHistorialAbonos(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
