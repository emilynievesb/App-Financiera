// Única capa de datos: localStorage + reglas de negocio (stock, saldos de cartera).

const DB = {
  PRODUCTOS: 'afin_productos',
  CLIENTES: 'afin_clientes',
  PROVEEDORES: 'afin_proveedores',
  VENTAS: 'afin_ventas',
  ABONOS_CLIENTES: 'afin_abonosClientes',
  COMPRAS: 'afin_compras',
  PAGOS_PROVEEDORES: 'afin_pagosProveedores',
  GASTOS: 'afin_gastos',
  PAGOS_GASTOS: 'afin_pagosGastos',
  FORMAS_PAGO: 'afin_formasPago'
};

function generarId(prefijo){ return prefijo+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function getAll(key){ return JSON.parse(localStorage.getItem(key)||'[]'); }
function saveAll(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }
function insertar(key, obj){ const a=getAll(key); a.push(obj); saveAll(key,a); return obj; }
function actualizar(key, id, patch){
  const a=getAll(key); const i=a.findIndex(x=>x.id===id);
  if(i>-1){ a[i]=Object.assign(a[i],patch); saveAll(key,a); }
  return a[i];
}
function buscarPorId(key, id){ return getAll(key).find(x=>x.id===id); }

// ---- Productos / inventario ----
function siguienteCodigoProducto(){
  return getAll(DB.PRODUCTOS).reduce((max,p)=>Math.max(max, Number(p.codigo)||0), 0) + 1;
}
function crearProducto(p){
  p.id = generarId('p');
  p.codigo = siguienteCodigoProducto();
  p.stock = Number(p.stock)||0;
  p.stockMinimo = Number(p.stockMinimo)||0;
  p.costoUnitario = Number(p.costoUnitario)||0;
  // Punto de partida manual (inventario inicial o sin factura): recalcularProducto() arranca
  // desde aquí al repasar compras/ventas, así una compra eliminada nunca borra este saldo inicial.
  p.stockInicial = p.stock;
  p.costoInicial = p.costoUnitario;
  p.activo = true;
  p.creadoEn = new Date().toISOString();
  return insertar(DB.PRODUCTOS, p);
}
function listarProductos(){ return getAll(DB.PRODUCTOS).filter(p=>p.activo!==false); }
// Solo permite corregir datos maestros (nombre, unidad, stock mínimo, vencimiento).
// Stock, costo y código son derivados/automáticos - se corrigen eliminando y reingresando
// la compra o venta que esté mal, no editando el producto directamente. El precio de venta no
// es un dato del producto: se decide en cada venta (ver ultimoPrecioVenta).
function actualizarProducto(id, cambios){
  const permitido = (({nombre, unidad, stockMinimo, fechaVencimiento})=>
    ({nombre, unidad, stockMinimo: Number(stockMinimo)||0, fechaVencimiento: fechaVencimiento||null}))(cambios);
  return actualizar(DB.PRODUCTOS, id, permitido);
}
// Precio unitario de la última venta de este producto - se usa solo para sugerir un valor de
// partida en el formulario de venta, nunca se guarda en el producto (el precio real de cada
// venta puede cambiar y solo queda registrado en esa venta).
function ultimoPrecioVenta(productoId){
  const ventas = getAll(DB.VENTAS).filter(v=>v.productoId===productoId)
    .sort((a,b)=> a.fecha===b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha));
  return ventas.length ? Number(ventas[ventas.length-1].precioUnitario)||0 : 0;
}
function ajustarStock(productoId, delta){
  const p = buscarPorId(DB.PRODUCTOS, productoId);
  if(!p) return;
  actualizar(DB.PRODUCTOS, productoId, { stock: Number((p.stock + delta).toFixed(3)) });
}
// Stock del producto tal como estaba al cierre de `fecha` (reconstruido desde el stock actual
// deshaciendo los movimientos posteriores) - lo usa el Kardex para saldos a una fecha de corte.
function stockAFecha(productoId, fecha){
  const p = buscarPorId(DB.PRODUCTOS, productoId);
  if(!p) return 0;
  const entradasDespues = sum(getAll(DB.COMPRAS).filter(c=>c.productoId===productoId && c.fecha>fecha), 'cantidad');
  const salidasDespues = sum(getAll(DB.VENTAS).filter(v=>v.productoId===productoId && v.fecha>fecha), 'cantidad');
  return Number((p.stock - entradasDespues + salidasDespues).toFixed(3));
}
// Kardex por producto en un rango: entradas (compras), salidas (ventas), saldo a `hasta` y su valor.
function calcularKardex(desde, hasta){
  return listarProductos().map(p=>{
    const entradas = sum(getAll(DB.COMPRAS).filter(c=>c.productoId===p.id && enRango(c.fecha,desde,hasta)), 'cantidad');
    const salidas = sum(getAll(DB.VENTAS).filter(v=>v.productoId===p.id && enRango(v.fecha,desde,hasta)), 'cantidad');
    const saldo = stockAFecha(p.id, hasta);
    // ponytail: el saldo se valora al costo promedio ponderado VIGENTE del producto, no al costo
    // histórico exacto de la fecha `hasta`. Si se necesita valorización históricamente exacta habría
    // que guardar un snapshot de costoUnitario por fecha en vez de solo el valor actual.
    const valor = Number((saldo * p.costoUnitario).toFixed(2));
    return { producto:p, entradas, salidas, saldo, valor };
  });
}
// Recalcula stock y costoUnitario de un producto repasando TODO su historial de compras/ventas
// en orden cronológico, arrancando del punto de partida manual (stockInicial/costoInicial). Se
// usa después de eliminar una compra o venta para no dejar el stock o el promedio ponderado
// desincronizados de lo que realmente quedó registrado.
function recalcularProducto(productoId){
  const p = buscarPorId(DB.PRODUCTOS, productoId);
  if(!p) return;
  const movimientos = [
    ...getAll(DB.COMPRAS).filter(c=>c.productoId===productoId).map(c=>({tipo:'compra', fecha:c.fecha, creadoEn:c.creadoEn, cantidad:Number(c.cantidad), costo:Number(c.costoUnitario)})),
    ...getAll(DB.VENTAS).filter(v=>v.productoId===productoId).map(v=>({tipo:'venta', fecha:v.fecha, creadoEn:v.creadoEn, cantidad:Number(v.cantidad)}))
  ].sort((a,b)=> a.fecha===b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha));

  let stock = Number(p.stockInicial)||0, costoUnitario = Number(p.costoInicial)||0;
  movimientos.forEach(m=>{
    if(m.tipo==='compra'){
      const stockNuevo = stock + m.cantidad;
      costoUnitario = stockNuevo>0 ? (stock*costoUnitario + m.cantidad*m.costo)/stockNuevo : m.costo;
      stock = stockNuevo;
    } else {
      stock -= m.cantidad;
    }
  });
  actualizar(DB.PRODUCTOS, productoId, { stock: Number(stock.toFixed(3)), costoUnitario: Number(costoUnitario.toFixed(4)) });
}

function diasParaVencer(fechaVencimiento){
  if(!fechaVencimiento) return null;
  const ms = new Date(fechaVencimiento+'T00:00:00') - new Date(hoy()+'T00:00:00');
  return Math.round(ms / 86400000);
}

// ---- Clientes / proveedores: se crean al vuelo por nombre ----
function obtenerOCrearCliente(nombre){
  nombre = (nombre||'').trim();
  if(!nombre) return null;
  const existente = getAll(DB.CLIENTES).find(c=> c.nombre.toLowerCase()===nombre.toLowerCase());
  if(existente) return existente;
  return insertar(DB.CLIENTES, { id: generarId('c'), nombre, telefono:'', creadoEn: new Date().toISOString() });
}
function obtenerOCrearProveedor(nombre){
  nombre = (nombre||'').trim();
  if(!nombre) return null;
  const existente = getAll(DB.PROVEEDORES).find(p=> p.nombre.toLowerCase()===nombre.toLowerCase());
  if(existente) return existente;
  return insertar(DB.PROVEEDORES, { id: generarId('pr'), nombre, telefono:'', creadoEn: new Date().toISOString() });
}

// ---- Registro de movimientos ----
// Venta: el costo de lo vendido se congela al costo promedio ponderado VIGENTE del producto en
// el momento de la venta (no se recalcula después, aunque el promedio del producto siga cambiando).
function registrarVenta(v){
  v.id = generarId('v'); v.creadoEn = new Date().toISOString();
  const p = buscarPorId(DB.PRODUCTOS, v.productoId);
  v.costoUnitario = p ? Number(p.costoUnitario)||0 : 0;
  v.costoTotal = Number((Number(v.cantidad)*v.costoUnitario).toFixed(2));
  insertar(DB.VENTAS, v);
  ajustarStock(v.productoId, -Number(v.cantidad));
  return v;
}
// Compra: cada entrada recalcula el costo unitario del producto como promedio ponderado entre
// el stock que ya había (a su costo anterior) y lo que entra ahora (a su costo de compra).
function registrarCompra(c){
  c.id = generarId('co'); c.creadoEn = new Date().toISOString();
  const p = buscarPorId(DB.PRODUCTOS, c.productoId);
  const stockAnterior = p ? Number(p.stock)||0 : 0;
  const costoAnterior = p ? Number(p.costoUnitario)||0 : 0;
  const cantidad = Number(c.cantidad);
  const costoCompra = Number(c.costoUnitario);
  const stockNuevo = stockAnterior + cantidad;
  const costoPromedio = stockNuevo>0 ? (stockAnterior*costoAnterior + cantidad*costoCompra)/stockNuevo : costoCompra;
  insertar(DB.COMPRAS, c);
  actualizar(DB.PRODUCTOS, c.productoId, { stock: Number(stockNuevo.toFixed(3)), costoUnitario: Number(costoPromedio.toFixed(4)) });
  return c;
}
function registrarAbonoCliente(a){ a.id=generarId('ac'); a.creadoEn=new Date().toISOString(); return insertar(DB.ABONOS_CLIENTES, a); }
function registrarPagoProveedor(p){ p.id=generarId('pp'); p.creadoEn=new Date().toISOString(); return insertar(DB.PAGOS_PROVEEDORES, p); }
function registrarGasto(g){ g.id=generarId('g'); g.creadoEn=new Date().toISOString(); return insertar(DB.GASTOS, g); }
function registrarPagoGasto(p){ p.id=generarId('pg'); p.creadoEn=new Date().toISOString(); return insertar(DB.PAGOS_GASTOS, p); }

// ---- Eliminar (la forma de "corregir" un registro: se borra y se vuelve a registrar bien) ----
function eliminarPorId(key, id){ saveAll(key, getAll(key).filter(x=>x.id!==id)); }

function eliminarVenta(id){
  const v = buscarPorId(DB.VENTAS, id);
  if(!v) return;
  eliminarPorId(DB.VENTAS, id);
  recalcularProducto(v.productoId);
}
function eliminarCompra(id){
  const c = buscarPorId(DB.COMPRAS, id);
  if(!c) return;
  eliminarPorId(DB.COMPRAS, id);
  recalcularProducto(c.productoId);
}
function eliminarGasto(id){
  eliminarPorId(DB.GASTOS, id);
  // Sin esto, un pago ligado a este gasto quedaría apuntando a un gastoId que ya no existe.
  saveAll(DB.PAGOS_GASTOS, getAll(DB.PAGOS_GASTOS).filter(p=>p.gastoId!==id));
}
function eliminarAbonoCliente(id){ eliminarPorId(DB.ABONOS_CLIENTES, id); }
function eliminarPagoProveedor(id){ eliminarPorId(DB.PAGOS_PROVEEDORES, id); }
function eliminarPagoGasto(id){ eliminarPorId(DB.PAGOS_GASTOS, id); }

// ---- Saldos (siempre calculados, nunca guardados) ----
function calcularSaldoCliente(clienteId, hasta){
  hasta = hasta || hoy();
  const deuda = getAll(DB.VENTAS).filter(v=>v.clienteId===clienteId && tipoFormaPago(v.metodoPago)==='credito' && v.fecha<=hasta).reduce((s,v)=>s+v.total,0);
  const pagado = getAll(DB.ABONOS_CLIENTES).filter(a=>a.clienteId===clienteId && a.fecha<=hasta).reduce((s,a)=>s+a.monto,0);
  return Number((deuda - pagado).toFixed(2));
}
function calcularSaldoProveedor(proveedorId, hasta){
  hasta = hasta || hoy();
  const deuda = getAll(DB.COMPRAS).filter(c=>c.proveedorId===proveedorId && tipoFormaPago(c.metodoPago)==='credito' && c.fecha<=hasta).reduce((s,c)=>s+c.total,0);
  const pagado = getAll(DB.PAGOS_PROVEEDORES).filter(p=>p.proveedorId===proveedorId && p.fecha<=hasta).reduce((s,p)=>s+p.monto,0);
  return Number((deuda - pagado).toFixed(2));
}
function calcularSaldoGasto(gastoId, hasta){
  hasta = hasta || hoy();
  const g = buscarPorId(DB.GASTOS, gastoId);
  if(!g || tipoFormaPago(g.metodoPago)!=='credito') return 0;
  const pagado = getAll(DB.PAGOS_GASTOS).filter(p=>p.gastoId===gastoId && p.fecha<=hasta).reduce((s,p)=>s+p.monto,0);
  return Number((g.monto - pagado).toFixed(2));
}
function listarCuentasPorCobrar(hasta){
  return getAll(DB.CLIENTES).map(c=>({ cliente:c, saldo: calcularSaldoCliente(c.id, hasta) })).filter(x=>x.saldo>0.01);
}
function listarCuentasPorPagarProveedores(hasta){
  return getAll(DB.PROVEEDORES).map(p=>({ proveedor:p, saldo: calcularSaldoProveedor(p.id, hasta) })).filter(x=>x.saldo>0.01);
}
function listarGastosPendientes(hasta){
  return getAll(DB.GASTOS).filter(g=>tipoFormaPago(g.metodoPago)==='credito' && g.fecha<=(hasta||hoy()))
    .map(g=>({ gasto:g, saldo: calcularSaldoGasto(g.id, hasta) })).filter(x=>x.saldo>0.01);
}

// ---- Catálogo de formas de pago (configurable) ----
// tipo: 'efectivo' (billete/moneda física) | 'digital' (cuenta, billetera, tarjeta) | 'credito' (queda a deber).
// El nombre elegido por el usuario ES el valor que se guarda en metodoPago de cada transacción.
const FORMAS_PAGO_SEED = [
  { nombre:'Efectivo', tipo:'efectivo' },
  { nombre:'Transferencia', tipo:'digital' },
  { nombre:'Tarjeta', tipo:'digital' },
  { nombre:'Crédito', tipo:'credito' }
];
function inicializarFormasPago(){
  if(getAll(DB.FORMAS_PAGO).length===0){
    saveAll(DB.FORMAS_PAGO, FORMAS_PAGO_SEED.map(f=>({ id: generarId('fp'), ...f })));
  }
}
function listarFormasPago(){ inicializarFormasPago(); return getAll(DB.FORMAS_PAGO); }
function crearFormaPago(nombre, tipo){
  nombre = (nombre||'').trim();
  if(!nombre) return null;
  const existente = listarFormasPago().find(f=>f.nombre.toLowerCase()===nombre.toLowerCase());
  if(existente) return existente;
  return insertar(DB.FORMAS_PAGO, { id: generarId('fp'), nombre, tipo });
}
function tipoFormaPago(nombre){
  const f = listarFormasPago().find(f=>f.nombre===nombre);
  return f ? f.tipo : 'digital';
}
inicializarFormasPago();
