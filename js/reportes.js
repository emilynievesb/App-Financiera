const COLOR_INGRESOS = '#1C9A6C', COLOR_COMPRAS = '#C7920B', COLOR_GASTOS = '#C5432B';

function calcularFlujoCaja(desde, hasta){
  const enEf = arr => arr.filter(x=>enRango(x.fecha, desde, hasta) && x.metodoPago==='efectivo');
  const ingresos = sum(enEf(getAll(DB.VENTAS)),'total') + sum(enEf(getAll(DB.ABONOS_CLIENTES)),'monto');
  const salidasCompras = sum(enEf(getAll(DB.COMPRAS)),'total') + sum(enEf(getAll(DB.PAGOS_PROVEEDORES)),'monto');
  const salidasGastos = sum(enEf(getAll(DB.GASTOS)),'monto') + sum(enEf(getAll(DB.PAGOS_GASTOS)),'monto');
  return { ingresos, salidasCompras, salidasGastos, total: ingresos - salidasCompras - salidasGastos };
}

function calcularEstadoResultados(desde, hasta){
  const enR = arr => arr.filter(x=>enRango(x.fecha, desde, hasta));
  const totalIngresos = sum(enR(getAll(DB.VENTAS)),'total');
  const totalCompras = sum(enR(getAll(DB.COMPRAS)),'total');
  const totalGastos = sum(enR(getAll(DB.GASTOS)),'monto');
  return { totalIngresos, totalCompras, totalGastos, utilidad: totalIngresos - totalCompras - totalGastos };
}

document.addEventListener('DOMContentLoaded', ()=>{
  const fechaRef = document.getElementById('fechaRef');
  fechaRef.value = hoy();
  let periodo = 'semana';

  function rangoActual(){
    return periodo==='dia' ? rangoDia(fechaRef.value) : periodo==='mes' ? rangoMes(fechaRef.value) : rangoSemana(fechaRef.value);
  }

  function refrescarFlujoCaja(rango){
    const fc = calcularFlujoCaja(rango.desde, rango.hasta);
    document.getElementById('fcIngresos').textContent = formatoMoneda(fc.ingresos);
    document.getElementById('fcCompras').textContent = '-'+formatoMoneda(fc.salidasCompras);
    document.getElementById('fcGastos').textContent = '-'+formatoMoneda(fc.salidasGastos);
    document.getElementById('fcTotal').className = 'text-end amount fs-5 ' + (fc.total>=0 ? 'amount-positive' : 'amount-negative');
    animarNumero(document.getElementById('fcTotal'), fc.total);
  }

  function refrescarCartera(hasta){
    const cxc = listarCuentasPorCobrar(hasta);
    document.getElementById('tablaCxC').innerHTML = cxc.length
      ? cxc.map(f=>`<tr><td class="td-titulo">${esc(f.cliente.nombre)}</td><td data-label="Debe" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="2" class="estado-vacio"><i class="bi bi-emoji-smile"></i>Nadie te debe a esta fecha.</td></tr>';

    const cxpProv = listarCuentasPorPagarProveedores(hasta);
    document.getElementById('tablaCxPProv').innerHTML = cxpProv.length
      ? cxpProv.map(f=>`<tr><td class="td-titulo">${esc(f.proveedor.nombre)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="2" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No debes a proveedores a esta fecha.</td></tr>';

    const cxpGastos = listarGastosPendientes(hasta);
    document.getElementById('tablaCxPGastos').innerHTML = cxpGastos.length
      ? cxpGastos.map(f=>`<tr><td class="td-titulo">${esc(f.gasto.concepto)}</td><td data-label="Debemos" class="text-end amount amount-pending">${formatoMoneda(f.saldo)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="2" class="estado-vacio"><i class="bi bi-emoji-smile"></i>No hay gastos pendientes a esta fecha.</td></tr>';
  }

  function refrescarResultados(rango){
    const er = calcularEstadoResultados(rango.desde, rango.hasta);
    document.getElementById('erIngresos').textContent = formatoMoneda(er.totalIngresos);
    document.getElementById('erCompras').textContent = '-'+formatoMoneda(er.totalCompras);
    document.getElementById('erGastos').textContent = '-'+formatoMoneda(er.totalGastos);
    document.getElementById('erUtilidad').className = 'text-end amount fs-5 ' + (er.utilidad>=0 ? 'amount-positive' : 'amount-negative');
    animarNumero(document.getElementById('erUtilidad'), er.utilidad);
  }

  let chartVentas, chartComparativo, chartMetodos;
  function refrescarGraficos(rango){
    const hasta30 = hoy();
    const desde30 = fechaMenosDias(29);
    const serieVentas = agruparPorDia(getAll(DB.VENTAS).filter(v=>enRango(v.fecha, desde30, hasta30)), 'fecha', 'total');

    const ctxV = document.getElementById('chartVentas');
    if(chartVentas) chartVentas.destroy();
    chartVentas = new Chart(ctxV, {
      type:'line',
      data:{ labels: serieVentas.map(s=>formatoFecha(s.fecha)), datasets:[{ label:'Ventas', data: serieVentas.map(s=>s.total), borderColor: COLOR_INGRESOS, backgroundColor: COLOR_INGRESOS+'33', tension:.3, fill:true }] },
      options:{ animation:{ duration:700, easing:'easeOutQuart' }, plugins:{legend:{display:false}} }
    });

    const er = calcularEstadoResultados(rango.desde, rango.hasta);
    const ctxC = document.getElementById('chartComparativo');
    if(chartComparativo) chartComparativo.destroy();
    chartComparativo = new Chart(ctxC, {
      type:'bar',
      data:{ labels:['Ingresos','Compras','Gastos'], datasets:[{ data:[er.totalIngresos, er.totalCompras, er.totalGastos], backgroundColor:[COLOR_INGRESOS, COLOR_COMPRAS, COLOR_GASTOS] }] },
      options:{ animation:{ duration:700, easing:'easeOutQuart' }, plugins:{legend:{display:false}} }
    });

    const ventasRango = getAll(DB.VENTAS).filter(v=>enRango(v.fecha, rango.desde, rango.hasta));
    const rm = resumenPorMetodo(ventasRango, 'total');
    const ctxM = document.getElementById('chartMetodos');
    if(chartMetodos) chartMetodos.destroy();
    chartMetodos = new Chart(ctxM, {
      type:'pie',
      data:{ labels:['Efectivo','Crédito','Transferencia','Tarjeta'], datasets:[{ data:[rm.efectivo, rm.credito, rm.transferencia, rm.tarjeta], backgroundColor:['#55645F','#C7920B','#2A7F8C','#0B6E4F'] }] },
      options:{ animation:{ duration:700, easing:'easeOutQuart' } }
    });
  }

  function refrescarTodo(){
    const rango = rangoActual();
    document.getElementById('rangoTexto').textContent = `Del ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}`;
    refrescarFlujoCaja(rango);
    refrescarCartera(fechaRef.value);
    refrescarResultados(rango);
    refrescarGraficos(rango);
  }

  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-periodo]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    periodo = b.dataset.periodo;
    refrescarTodo();
  }));
  fechaRef.addEventListener('change', refrescarTodo);

  refrescarTodo();
});
