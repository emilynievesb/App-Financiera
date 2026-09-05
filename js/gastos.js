document.addEventListener('DOMContentLoaded', ()=>{
  const formGasto = document.getElementById('formGasto');
  const selMetodo = formGasto.querySelector('[name=metodoPago]');
  const inpMonto = formGasto.querySelector('[name=monto]');
  const inpFecha = formGasto.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();
  inpFecha.defaultValue = hoy();
  activarInputMoneda(inpMonto);

  poblarSelectFormaPago(selMetodo);
  document.getElementById('modalGasto').addEventListener('show.bs.modal', ()=> poblarSelectFormaPago(selMetodo));
  document.addEventListener('formasPagoActualizadas', ()=>{ poblarSelectFormaPago(selMetodo); poblarSelectFormaPago(formPago.metodoPago, 'credito'); });

  validarYGuardar(formGasto, ()=> valorMoneda(inpMonto)>0, ()=>{
    registrarGasto({
      fecha: inpFecha.value, concepto: formGasto.concepto.value, monto: valorMoneda(inpMonto),
      metodoPago: selMetodo.value, notas: formGasto.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalGasto')).hide();
    mostrarToast('Gasto registrado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.monto) fijarValorMoneda(inpMonto, r.monto);
    if(r.metodoPago) selMetodo.value = r.metodoPago;
  });

  // ---- Pagos de gastos pendientes ----
  const formPago = document.getElementById('formPago');
  const selGasto = formPago.querySelector('[name=gastoId]');
  formPago.fecha.value = hoy();
  formPago.fecha.max = hoy();
  formPago.fecha.defaultValue = hoy();
  activarInputMoneda(formPago.monto);
  poblarSelectFormaPago(formPago.metodoPago, 'credito');

  function refrescarPendientes(){
    const filas = listarGastosPendientes(hoy());
    document.getElementById('tablaPendientes').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.gasto.concepto)}</td><td data-label="Fecha">${formatoFecha(f.gasto.fecha)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="3" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No hay gastos a crédito pendientes.</td></tr>';
    selGasto.innerHTML = filas.length
      ? filas.map(f=>`<option value="${f.gasto.id}" data-saldo="${f.saldo}">${esc(f.gasto.concepto)} (${formatoMoneda(f.saldo)})</option>`).join('')
      : '<option value="">No hay gastos pendientes</option>';
  }

  validarYGuardar(formPago, ()=> !!selGasto.value && valorMoneda(formPago.monto)>0, ()=>{
    const gasto = buscarPorId(DB.GASTOS, selGasto.value);
    registrarPagoGasto({
      fecha: formPago.fecha.value, gastoId: gasto.id, concepto: gasto.concepto,
      monto: valorMoneda(formPago.monto), metodoPago: formPago.metodoPago.value, notas:''
    });
    mostrarToast('Pago de gasto registrado');
    refrescarTodo();
  });

  function refrescarHistorialPagos(){
    const pagos = getAll(DB.PAGOS_GASTOS).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,20);
    document.getElementById('tablaHistorialPagos').innerHTML = pagos.length
      ? pagos.map(p=>`<tr>
          <td class="td-titulo">${formatoFecha(p.fecha)}</td>
          <td data-label="Concepto">${esc(p.concepto)}</td>
          <td data-label="Monto" class="text-end amount amount-negative">${formatoMoneda(p.monto)}</td>
          <td data-label="Método">${badgeMetodo(p.metodoPago)}</td>
          <td data-label="">${botonEliminar(p.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="5" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay pagos registrados.</td></tr>';
  }
  conectarEliminarFila(document.getElementById('tablaHistorialPagos'), eliminarPagoGasto, refrescarTodo, '¿Eliminar este pago? La deuda del gasto volverá a subir.');

  // ---- Historial ----
  const histDesde = document.getElementById('histDesde'), histHasta = document.getElementById('histHasta');
  histHasta.value = hoy();
  histDesde.value = rangoMes(hoy()).desde;
  function refrescarHistorial(){
    const gastos = getAll(DB.GASTOS).filter(g=>enRango(g.fecha, histDesde.value, histHasta.value)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    document.getElementById('tablaHistorial').innerHTML = gastos.length
      ? gastos.map(g=>`<tr>
          <td class="td-titulo">${esc(g.concepto)}</td>
          <td data-label="Fecha">${formatoFecha(g.fecha)}</td>
          <td data-label="Monto" class="text-end amount amount-negative">${formatoMoneda(g.monto)}</td>
          <td data-label="Método">${badgeMetodo(g.metodoPago)}</td>
          <td data-label="">${botonEliminar(g.id)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="5" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay gastos registrados hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);
  conectarEliminarFila(document.getElementById('tablaHistorial'), eliminarGasto, refrescarTodo, '¿Eliminar este gasto? Si tenía pagos registrados, también se eliminarán.');

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const gastos = getAll(DB.GASTOS).filter(g=>enRango(g.fecha, rango.desde, rango.hasta));
    document.getElementById('tablaResumen').innerHTML = renderResumenPorMetodo(resumenPorMetodo(gastos, 'monto'), 'amount-negative');
  }
  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-periodo]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    refrescarResumen(b.dataset.periodo);
  }));
  resumenFecha.addEventListener('change', ()=>refrescarResumen('dia'));

  function refrescarTodo(){ refrescarPendientes(); refrescarHistorialPagos(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
