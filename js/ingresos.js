document.addEventListener('DOMContentLoaded', ()=>{
  const formVenta = document.getElementById('formVenta');
  const selProducto = formVenta.querySelector('[name=productoId]');
  const inpPrecio = formVenta.querySelector('[name=precioUnitario]');
  const selMetodo = formVenta.querySelector('[name=metodoPago]');
  const inpCliente = formVenta.querySelector('[name=clienteNombre]');
  const inpFecha = formVenta.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();

  function cargarProductos(){
    const productos = listarProductos();
    selProducto.innerHTML = productos.length
      ? productos.map(p=>`<option value="${p.id}" data-precio="${p.precioVenta}">${esc(p.nombre)} (stock: ${p.stock})</option>`).join('')
      : '<option value="">No hay productos — créalos en Inventario</option>';
    if(productos[0]) inpPrecio.value = productos[0].precioVenta;
  }
  selProducto.addEventListener('change', ()=>{
    const opt = selProducto.selectedOptions[0];
    if(opt && opt.dataset.precio) inpPrecio.value = opt.dataset.precio;
  });

  document.getElementById('modalVenta').addEventListener('show.bs.modal', ()=>{
    cargarProductos();
    llenarDatalist(document.getElementById('listaClientesVenta'), getAll(DB.CLIENTES).map(c=>c.nombre));
  });

  validarYGuardar(formVenta, ()=>{
    if(!selProducto.value) return false;
    if(selMetodo.value==='credito' && !inpCliente.value.trim()) return false;
    return true;
  }, ()=>{
    const opt = selProducto.selectedOptions[0];
    const cliente = inpCliente.value.trim() ? obtenerOCrearCliente(inpCliente.value) : null;
    const cantidad = Number(formVenta.cantidad.value);
    const precioUnitario = Number(inpPrecio.value);
    registrarVenta({
      fecha: inpFecha.value, productoId: selProducto.value, productoNombre: opt.textContent,
      cantidad, precioUnitario, total: Number((cantidad*precioUnitario).toFixed(2)),
      metodoPago: selMetodo.value, clienteId: cliente?cliente.id:null, clienteNombre: cliente?cliente.nombre:null,
      notas: formVenta.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalVenta')).hide();
    mostrarToast('Venta registrada y stock actualizado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.monto) inpPrecio.value = r.monto;
    if(r.metodoPago) selMetodo.value = r.metodoPago;
  });

  // ---- Abonos ----
  const formAbono = document.getElementById('formAbono');
  formAbono.fecha.value = hoy();
  formAbono.fecha.max = hoy();
  validarYGuardar(formAbono, null, ()=>{
    const cliente = obtenerOCrearCliente(formAbono.clienteNombre.value);
    registrarAbonoCliente({
      fecha: formAbono.fecha.value, clienteId: cliente.id, clienteNombre: cliente.nombre,
      monto: Number(formAbono.monto.value), metodoPago: formAbono.metodoPago.value, notas:''
    });
    mostrarToast('Abono registrado');
    formAbono.fecha.value = hoy();
    refrescarTodo();
  });

  function refrescarCxC(){
    const filas = listarCuentasPorCobrar(hoy());
    document.getElementById('tablaCxC').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.cliente.nombre)}</td><td data-label="Debe" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td><td data-label=""></td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="3" class="estado-vacio"><i class="bi bi-emoji-smile"></i>Nadie te debe por ahora.</td></tr>';
    llenarDatalist(document.getElementById('listaClientes'), getAll(DB.CLIENTES).map(c=>c.nombre));
  }

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
          <td data-label="Cantidad">${v.cantidad}</td>
          <td data-label="Total" class="amount amount-positive">${formatoMoneda(v.total)}</td>
          <td data-label="Método">${badgeMetodo(v.metodoPago)}</td>
          <td data-label="Cliente">${esc(v.clienteNombre||'-')}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="6" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay ventas registradas hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const ventas = getAll(DB.VENTAS).filter(v=>enRango(v.fecha, rango.desde, rango.hasta));
    const r = resumenPorMetodo(ventas, 'total');
    const total = r.efectivo+r.credito+r.transferencia+r.tarjeta;
    document.getElementById('tablaResumen').innerHTML = `
      <tr><th>Efectivo</th><td class="text-end amount">${formatoMoneda(r.efectivo)}</td></tr>
      <tr><th>Crédito</th><td class="text-end amount">${formatoMoneda(r.credito)}</td></tr>
      <tr><th>Transferencia</th><td class="text-end amount">${formatoMoneda(r.transferencia)}</td></tr>
      <tr><th>Tarjeta</th><td class="text-end amount">${formatoMoneda(r.tarjeta)}</td></tr>
      <tr class="border-top"><th>Total</th><td class="text-end amount amount-positive fs-5">${formatoMoneda(total)}</td></tr>`;
  }
  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>refrescarResumen(b.dataset.periodo)));
  resumenFecha.addEventListener('change', ()=>refrescarResumen('dia'));

  function refrescarTodo(){ refrescarCxC(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
