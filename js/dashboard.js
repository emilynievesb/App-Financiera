const DIAS_ALERTA_VENCIMIENTO_DASH = 7;

document.addEventListener('DOMContentLoaded', ()=>{
  const f = hoy();
  // "Saldo del día" es plata que realmente entró/salió hoy - igual que Flujo de Caja, se excluye
  // crédito (todavía no es dinero real) para no mezclar ventas por cobrar con caja disponible.
  const noEsCredito = x => tipoFormaPago(x.metodoPago)!=='credito';
  const ventasHoy = sum(getAll(DB.VENTAS).filter(v=>v.fecha===f).filter(noEsCredito), 'total');
  const comprasHoy = sum(getAll(DB.COMPRAS).filter(c=>c.fecha===f).filter(noEsCredito), 'total');
  const gastosHoy = sum(getAll(DB.GASTOS).filter(g=>g.fecha===f).filter(noEsCredito), 'monto');
  const egresosHoy = comprasHoy + gastosHoy;
  const saldoHoy = ventasHoy - egresosHoy;

  document.getElementById('sumIngresos').textContent = formatoMoneda(ventasHoy);
  document.getElementById('sumEgresos').textContent = formatoMoneda(egresosHoy);
  document.getElementById('sumSaldo').textContent = formatoMoneda(saldoHoy);
  // Texto siempre blanco (buen contraste en los dos casos); lo que cambia es el fondo del tile,
  // no el color del texto - un color de texto "warning" sobre este fondo verde oscuro casi no
  // se distinguía (ambos tonos con luminancia similar).
  document.getElementById('sumSaldo').closest('.summary-tile').classList.toggle('is-negative', saldoHoy<0);

  const teDeben = sum(listarCuentasPorCobrar(f).map(x=>({v:x.saldo})), 'v');
  const debes = sum(listarCuentasPorPagarProveedores(f).map(x=>({v:x.saldo})), 'v') + sum(listarGastosPendientes(f).map(x=>({v:x.saldo})), 'v');
  document.getElementById('sumTeDeben').textContent = formatoMoneda(teDeben);
  document.getElementById('sumDebes').textContent = formatoMoneda(debes);

  const productos = listarProductos();
  const stockBajo = productos.filter(p=>p.stock <= p.stockMinimo);
  const porVencer = productos.filter(p=>{
    const d = diasParaVencer(p.fechaVencimiento);
    return d!==null && d<=DIAS_ALERTA_VENCIMIENTO_DASH;
  });

  const alertas = [];
  if(stockBajo.length) alertas.push({ tipo:'danger', icono:'bi-exclamation-triangle-fill',
    texto: `${stockBajo.length} producto${stockBajo.length>1?'s':''} con stock bajo` });
  if(porVencer.length) alertas.push({ tipo:'warning', icono:'bi-hourglass-split',
    texto: `${porVencer.length} producto${porVencer.length>1?'s':''} por vencer o vencido${porVencer.length>1?'s':''}` });

  const cont = document.getElementById('listaAlertas');
  if(!alertas.length){ cont.closest('.alert-section').classList.add('d-none'); }
  else{
    cont.innerHTML = alertas.map(a=>
      `<a href="inventario.html" class="alert-row${a.tipo==='warning'?' is-warning':''}"><i class="bi ${a.icono}"></i> ${a.texto}</a>`
    ).join('');
  }
});
