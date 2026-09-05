const DIAS_ALERTA_VENCIMIENTO = 7;

document.addEventListener('DOMContentLoaded', ()=>{
  const formProducto = document.getElementById('formProducto');

  validarYGuardar(formProducto, null, ()=>{
    crearProducto({
      nombre: formProducto.nombre.value,
      unidad: formProducto.unidad.value,
      stock: formProducto.stock.value,
      stockMinimo: formProducto.stockMinimo.value,
      fechaVencimiento: formProducto.fechaVencimiento.value || null,
      costoUnitario: formProducto.costoUnitario.value,
      precioVenta: formProducto.precioVenta.value
    });
    bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
    mostrarToast('Producto guardado');
    refrescarTabla();
  });

  function refrescarTabla(){
    const productos = listarProductos();
    document.getElementById('tablaProductos').innerHTML = productos.length ? productos.map(p=>{
      const dias = diasParaVencer(p.fechaVencimiento);
      const alertas = [];
      if(p.stock <= p.stockMinimo) alertas.push('<span class="badge text-bg-danger badge-alerta">Stock bajo</span>');
      if(dias!==null && dias<=DIAS_ALERTA_VENCIMIENTO) alertas.push(`<span class="badge text-bg-warning badge-alerta">${dias<0?'Vencido':'Vence pronto'}</span>`);
      return `<tr>
        <td class="td-titulo">${esc(p.nombre)} <span class="text-secondary-app">(${esc(p.unidad)})</span></td>
        <td data-label="Stock" class="amount">${p.stock}</td>
        <td data-label="Costo" class="amount">${formatoMoneda(p.costoUnitario)}</td>
        <td data-label="Precio venta" class="amount">${formatoMoneda(p.precioVenta)}</td>
        <td data-label="Vence">${p.fechaVencimiento?formatoFecha(p.fechaVencimiento):'-'}</td>
        <td data-label="Alertas">${alertas.join(' ')||'-'}</td></tr>`;
    }).join('') : '<tr class="fila-vacia"><td colspan="6" class="estado-vacio"><i class="bi bi-box-seam"></i>Aún no hay productos — crea el primero con "+ Nuevo producto".</td></tr>';
  }

  refrescarTabla();
});
