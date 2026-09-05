// Mismos tokens de color que el resto de la app (ver :root en css/styles.css) - Chart.js no puede
// leer var(--...) directo en un config JS, así que se repiten los hex aquí a mano.
const COLOR_INGRESOS = '#1C9A6C', COLOR_COSTO = '#8A5E00', COLOR_GASTOS = '#C5432B';

// Flujo de Caja: mide movimiento real de dinero. No usa costo de venta: aquí el criterio es caja,
// no rentabilidad. `filtroFn` decide qué transacciones cuentan (por tipo de forma de pago, o por
// "cualquiera que no sea crédito") - la comparten la vista Completa (un solo total) y la Detallada
// (Caja efectivo físico vs. Cuentas dinero digital).
function totalesCaja(desde, hasta, filtroFn){
  const enRangoFecha = arr => arr.filter(x=>enRango(x.fecha, desde, hasta)).filter(filtroFn);
  const ingresos = sum(enRangoFecha(getAll(DB.VENTAS)),'total') + sum(enRangoFecha(getAll(DB.ABONOS_CLIENTES)),'monto');
  const salidasCompras = sum(enRangoFecha(getAll(DB.COMPRAS)),'total') + sum(enRangoFecha(getAll(DB.PAGOS_PROVEEDORES)),'monto');
  const salidasGastos = sum(enRangoFecha(getAll(DB.GASTOS)),'monto') + sum(enRangoFecha(getAll(DB.PAGOS_GASTOS)),'monto');
  return { ingresos, salidasCompras, salidasGastos, total: ingresos - salidasCompras - salidasGastos };
}
// Vista Completa: dinero recibido y pagado en general, sin importar la forma de pago (efectivo,
// transferencia, tarjeta, Nequi...). Crédito queda fuera - todavía no es plata que entró o salió.
function calcularFlujoCajaGeneral(desde, hasta){
  return totalesCaja(desde, hasta, x=>tipoFormaPago(x.metodoPago)!=='credito');
}
// Vista Detallada: separado en Caja (efectivo físico) y Cuentas (cualquier forma de pago digital
// ya recibida/pagada) - para poder hacer arqueo de caja sin mezclar lo físico con lo digital.
function calcularFlujoCaja(desde, hasta){
  const caja = totalesCaja(desde, hasta, x=>tipoFormaPago(x.metodoPago)==='efectivo');
  const cuentas = totalesCaja(desde, hasta, x=>tipoFormaPago(x.metodoPago)==='digital');
  return { caja, cuentas, total: caja.total + cuentas.total };
}

// Estado de Resultados: Ventas − Costo de lo efectivamente vendido − Gastos = Utilidad. Usa el
// costo de venta (congelado por venta al costo promedio ponderado, ver registrarVenta en
// storage.js), no el total de Compras - Compras incluye mercancía que aún no se vendió.
function calcularEstadoResultados(desde, hasta){
  const enR = arr => arr.filter(x=>enRango(x.fecha, desde, hasta));
  const ventas = enR(getAll(DB.VENTAS));
  const totalIngresos = sum(ventas,'total');
  const totalCosto = sum(ventas,'costoTotal');
  const totalGastos = sum(enR(getAll(DB.GASTOS)),'monto');
  return { totalIngresos, totalCosto, totalGastos, utilidad: totalIngresos - totalCosto - totalGastos };
}

document.addEventListener('DOMContentLoaded', ()=>{
  const fechaRef = document.getElementById('fechaRef');
  fechaRef.value = hoy();
  let periodo = 'semana';

  function rangoActual(){
    return periodo==='dia' ? rangoDia(fechaRef.value) : periodo==='mes' ? rangoMes(fechaRef.value) : rangoSemana(fechaRef.value);
  }

  function pintarBloqueCaja(prefijo, bloque){
    document.getElementById(prefijo+'Ingresos').textContent = formatoMoneda(bloque.ingresos);
    document.getElementById(prefijo+'Compras').textContent = '-'+formatoMoneda(bloque.salidasCompras);
    document.getElementById(prefijo+'Gastos').textContent = '-'+formatoMoneda(bloque.salidasGastos);
    document.getElementById(prefijo+'Total').className = 'text-end amount fs-5 ' + (bloque.total>=0 ? 'amount-positive' : 'amount-negative');
    animarNumero(document.getElementById(prefijo+'Total'), bloque.total);
  }
  function refrescarFlujoCaja(rango){
    pintarBloqueCaja('fcGeneral', calcularFlujoCajaGeneral(rango.desde, rango.hasta));

    const fc = calcularFlujoCaja(rango.desde, rango.hasta);
    pintarBloqueCaja('fcCaja', fc.caja);
    pintarBloqueCaja('fcCuentas', fc.cuentas);
    document.getElementById('fcTotalGeneral').className = 'text-end amount fs-5 ' + (fc.total>=0 ? 'amount-positive' : 'amount-negative');
    animarNumero(document.getElementById('fcTotalGeneral'), fc.total);
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
    document.getElementById('erCosto').textContent = '-'+formatoMoneda(er.totalCosto);
    document.getElementById('erGastos').textContent = '-'+formatoMoneda(er.totalGastos);
    document.getElementById('erUtilidad').className = 'text-end amount fs-5 ' + (er.utilidad>=0 ? 'amount-positive' : 'amount-negative');
    animarNumero(document.getElementById('erUtilidad'), er.utilidad);
  }

  function refrescarKardex(rango){
    const filas = calcularKardex(rango.desde, rango.hasta);
    document.getElementById('tablaKardex').innerHTML = filas.length
      ? filas.map(f=>`<tr>
          <td data-label="Código" class="text-end amount">${f.producto.codigo}</td>
          <td class="td-titulo">${esc(f.producto.nombre)}</td>
          <td data-label="Entradas" class="text-end amount amount-positive">${f.entradas}</td>
          <td data-label="Salidas" class="text-end amount amount-negative">${f.salidas}</td>
          <td data-label="Saldo" class="text-end amount">${f.saldo}</td>
          <td data-label="Valor saldo" class="text-end amount">${formatoMoneda(f.valor)}</td></tr>`).join('')
      : '<tr class="fila-vacia"><td colspan="6" class="estado-vacio"><i class="bi bi-box-seam"></i>Aún no hay productos.</td></tr>';
    document.getElementById('kardexSaldoTotal').textContent = filas.reduce((s,f)=>s+f.saldo,0);
    document.getElementById('kardexValorTotal').textContent = formatoMoneda(filas.reduce((s,f)=>s+f.valor,0));
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
      data:{ labels:['Ingresos','Costo de venta','Gastos'], datasets:[{ data:[er.totalIngresos, er.totalCosto, er.totalGastos], backgroundColor:[COLOR_INGRESOS, COLOR_COSTO, COLOR_GASTOS] }] },
      options:{ animation:{ duration:700, easing:'easeOutQuart' }, plugins:{legend:{display:false}} }
    });

    const ventasRango = getAll(DB.VENTAS).filter(v=>enRango(v.fecha, rango.desde, rango.hasta));
    const rm = resumenPorMetodo(ventasRango, 'total');
    // Misma paleta que el resto de la app - antes tenía un morado y un ámbar que no existen en :root.
    const PALETA_METODOS = ['#0B6E4F','#8A5E00','#2A7F8C','#C5432B','#55645F','#1C9A6C'];
    const ctxM = document.getElementById('chartMetodos');
    if(chartMetodos) chartMetodos.destroy();
    chartMetodos = new Chart(ctxM, {
      type:'pie',
      data:{ labels:Object.keys(rm), datasets:[{ data:Object.values(rm), backgroundColor: Object.keys(rm).map((_,i)=>PALETA_METODOS[i%PALETA_METODOS.length]) }] },
      options:{ animation:{ duration:700, easing:'easeOutQuart' } }
    });
  }

  function refrescarTodo(){
    const rango = rangoActual();
    document.getElementById('rangoTexto').textContent = `Del ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}`;
    refrescarFlujoCaja(rango);
    refrescarCartera(fechaRef.value);
    refrescarResultados(rango);
    refrescarKardex(rango);
    refrescarGraficos(rango);
  }

  document.querySelectorAll('[data-vista-caja]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-vista-caja]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const detallada = b.dataset.vistaCaja==='detallada';
    document.getElementById('vistaCajaCompleta').classList.toggle('d-none', detallada);
    document.getElementById('vistaCajaDetallada').classList.toggle('d-none', !detallada);
  }));

  document.querySelectorAll('[data-periodo]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-periodo]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    periodo = b.dataset.periodo;
    refrescarTodo();
  }));
  fechaRef.addEventListener('change', refrescarTodo);

  refrescarTodo();
});
