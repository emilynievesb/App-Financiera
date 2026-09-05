const DIAS_ALERTA_VENCIMIENTO = 7;

document.addEventListener('DOMContentLoaded', ()=>{
  const formProducto = document.getElementById('formProducto');
  const modalProducto = document.getElementById('modalProducto');
  const grupoStockInicial = document.getElementById('grupoStockInicial');
  const grupoCostoInicial = document.getElementById('grupoCostoInicial');
  const notaEdicion = document.getElementById('notaEdicion');
  const notaStockCero = document.getElementById('notaStockCero');
  activarInputMoneda(formProducto.costoUnitario);

  // El costo unitario solo tiene sentido si ya vas a arrancar con existencias (inventario inicial):
  // con stock en 0 no hay nada que costear todavía, ese costo lo va a fijar la primera compra.
  function actualizarVisibilidadCosto(){
    const enEdicion = !!formProducto.id.value;
    const necesitaCosto = !enEdicion && Number(formProducto.stock.value) > 0;
    grupoCostoInicial.classList.toggle('d-none', enEdicion || !necesitaCosto);
    notaStockCero.classList.toggle('d-none', enEdicion);
    formProducto.costoUnitario.required = necesitaCosto;
    if(!necesitaCosto) formProducto.costoUnitario.value = '';
  }
  formProducto.stock.addEventListener('input', actualizarVisibilidadCosto);

  // Sin producto -> modo creación (todos los campos vacíos y editables).
  // Con producto -> modo edición (solo datos maestros; stock/costo se ocultan, son automáticos).
  function abrirModalProducto(producto){
    formProducto.reset();
    formProducto.id.value = producto ? producto.id : '';
    document.getElementById('tituloModalProducto').textContent = producto ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('btnGuardarProducto').textContent = producto ? 'Guardar cambios' : 'Guardar producto';
    grupoStockInicial.classList.toggle('d-none', !!producto);
    notaEdicion.classList.toggle('d-none', !producto);
    formProducto.stock.required = !producto;
    actualizarVisibilidadCosto();
    if(producto){
      formProducto.nombre.value = producto.nombre;
      formProducto.unidad.value = producto.unidad;
      formProducto.stockMinimo.value = producto.stockMinimo;
      formProducto.fechaVencimiento.value = producto.fechaVencimiento || '';
    } else {
      formProducto.unidad.value = 'unidad';
    }
    bootstrap.Modal.getOrCreateInstance(modalProducto).show();
  }

  document.getElementById('btnNuevoProducto').addEventListener('click', ()=> abrirModalProducto(null));
  document.getElementById('tablaProductos').addEventListener('click', e=>{
    const btn = e.target.closest('.btn-editar-producto');
    if(!btn) return;
    abrirModalProducto(buscarPorId(DB.PRODUCTOS, btn.dataset.id));
  });

  validarYGuardar(formProducto, ()=>{
    if(formProducto.costoUnitario.required && valorMoneda(formProducto.costoUnitario)<=0) return false;
    return true;
  }, ()=>{
    if(formProducto.id.value){
      actualizarProducto(formProducto.id.value, {
        nombre: formProducto.nombre.value,
        unidad: formProducto.unidad.value,
        stockMinimo: formProducto.stockMinimo.value,
        fechaVencimiento: formProducto.fechaVencimiento.value || null
      });
    } else {
      crearProducto({
        nombre: formProducto.nombre.value,
        unidad: formProducto.unidad.value,
        stock: formProducto.stock.value,
        stockMinimo: formProducto.stockMinimo.value,
        fechaVencimiento: formProducto.fechaVencimiento.value || null,
        costoUnitario: valorMoneda(formProducto.costoUnitario)
      });
    }
    bootstrap.Modal.getInstance(modalProducto).hide();
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
        <td data-label="Código" class="text-end amount">${p.codigo}</td>
        <td class="td-titulo">${esc(p.nombre)} <span class="text-secondary-app">(${esc(p.unidad)})</span></td>
        <td data-label="Stock" class="text-end amount">${p.stock}</td>
        <td data-label="Costo" class="text-end amount">${formatoMoneda(p.costoUnitario)}</td>
        <td data-label="Vence">${p.fechaVencimiento?formatoFecha(p.fechaVencimiento):'-'}</td>
        <td data-label="Alertas">${alertas.join(' ')||'-'}</td>
        <td><button type="button" class="btn btn-sm btn-outline-secondary btn-editar-producto" data-id="${p.id}" title="Editar"><i class="bi bi-pencil"></i></button></td></tr>`;
    }).join('') : '<tr class="fila-vacia"><td colspan="7" class="estado-vacio"><i class="bi bi-box-seam"></i>Aún no hay productos - crea el primero con "+ Nuevo producto".</td></tr>';
  }

  refrescarTabla();
});
