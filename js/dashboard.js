const DIAS_ALERTA_VENCIMIENTO_DASH = 7;

document.addEventListener('DOMContentLoaded', ()=>{
  const f = hoy();
  const ventasHoy = sum(getAll(DB.VENTAS).filter(v=>v.fecha===f), 'total');
  const comprasHoy = sum(getAll(DB.COMPRAS).filter(c=>c.fecha===f), 'total');
  const gastosHoy = sum(getAll(DB.GASTOS).filter(g=>g.fecha===f), 'monto');
  const egresosHoy = comprasHoy + gastosHoy;
  const saldoHoy = ventasHoy - egresosHoy;

  document.getElementById('sumIngresos').textContent = formatoMoneda(ventasHoy);
  document.getElementById('sumEgresos').textContent = formatoMoneda(egresosHoy);
  document.getElementById('sumSaldo').textContent = formatoMoneda(saldoHoy);
  document.getElementById('sumSaldo').className = 'summary-tile-value ' + (saldoHoy>=0 ? '' : 'text-warning-emphasis');

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
