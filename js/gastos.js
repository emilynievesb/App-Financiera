document.addEventListener('DOMContentLoaded', ()=>{
  const formGasto = document.getElementById('formGasto');
  const selMetodo = formGasto.querySelector('[name=metodoPago]');
  const inpMonto = formGasto.querySelector('[name=monto]');
  const inpFecha = formGasto.querySelector('[name=fecha]');
  inpFecha.value = hoy();
  inpFecha.max = hoy();

  validarYGuardar(formGasto, null, ()=>{
    registrarGasto({
      fecha: inpFecha.value, concepto: formGasto.concepto.value, monto: Number(inpMonto.value),
      metodoPago: selMetodo.value, notas: formGasto.notas.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalGasto')).hide();
    mostrarToast('Gasto registrado');
    refrescarTodo();
  });

  activarBotonVoz(document.getElementById('btnVoz'), document.getElementById('estadoVoz'), r=>{
    if(r.monto) inpMonto.value = r.monto;
    if(r.metodoPago) selMetodo.value = r.metodoPago;
  });

  // ---- Pagos de gastos pendientes ----
  const formPago = document.getElementById('formPago');
  const selGasto = formPago.querySelector('[name=gastoId]');
  formPago.fecha.value = hoy();
  formPago.fecha.max = hoy();

  function refrescarPendientes(){
    const filas = listarGastosPendientes(hoy());
    document.getElementById('tablaPendientes').innerHTML = filas.length
      ? filas.map(f=>`<tr><td class="td-titulo">${esc(f.gasto.concepto)}</td><td data-label="Fecha">${formatoFecha(f.gasto.fecha)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="3" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No hay gastos a crédito pendientes.</td></tr>';
    selGasto.innerHTML = filas.length
      ? filas.map(f=>`<option value="${f.gasto.id}" data-saldo="${f.saldo}">${esc(f.gasto.concepto)} (${formatoMoneda(f.saldo)})</option>`).join('')
      : '<option value="">No hay gastos pendientes</option>';
  }

  validarYGuardar(formPago, ()=> !!selGasto.value, ()=>{
    const gasto = buscarPorId(DB.GASTOS, selGasto.value);
    registrarPagoGasto({
      fecha: formPago.fecha.value, gastoId: gasto.id, concepto: gasto.concepto,
      monto: Number(formPago.monto.value), metodoPago: formPago.metodoPago.value, notas:''
    });
    mostrarToast('Pago de gasto registrado');
    formPago.fecha.value = hoy();
    refrescarTodo();
  });

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
          <td data-label="Monto" class="amount amount-negative">${formatoMoneda(g.monto)}</td>
          <td data-label="Método">${badgeMetodo(g.metodoPago)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="4" class="estado-vacio"><i class="bi bi-receipt"></i>Aún no hay gastos registrados hoy.</td></tr>';
  }
  document.getElementById('btnFiltrarHist').addEventListener('click', refrescarHistorial);

  // ---- Resumen por periodo ----
  const resumenFecha = document.getElementById('resumenFecha');
  resumenFecha.value = hoy();
  function refrescarResumen(periodo){
    periodo = periodo || 'dia';
    const rango = periodo==='dia' ? rangoDia(resumenFecha.value) : periodo==='semana' ? rangoSemana(resumenFecha.value) : rangoMes(resumenFecha.value);
    const gastos = getAll(DB.GASTOS).filter(g=>enRango(g.fecha, rango.desde, rango.hasta));
    const r = resumenPorMetodo(gastos, 'monto');
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

  function refrescarTodo(){ refrescarPendientes(); refrescarHistorial(); refrescarResumen('dia'); }
  refrescarTodo();
});
