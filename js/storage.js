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
  PAGOS_GASTOS: 'afin_pagosGastos'
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
function crearProducto(p){
  p.id = generarId('p');
  p.stock = Number(p.stock)||0;
  p.stockMinimo = Number(p.stockMinimo)||0;
  p.costoUnitario = Number(p.costoUnitario)||0;
  p.precioVenta = Number(p.precioVenta)||0;
  p.activo = true;
  p.creadoEn = new Date().toISOString();
  return insertar(DB.PRODUCTOS, p);
}
function listarProductos(){ return getAll(DB.PRODUCTOS).filter(p=>p.activo!==false); }
function ajustarStock(productoId, delta){
  const p = buscarPorId(DB.PRODUCTOS, productoId);
  if(!p) return;
  actualizar(DB.PRODUCTOS, productoId, { stock: Number((p.stock + delta).toFixed(3)) });
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
function registrarVenta(v){
  v.id = generarId('v'); v.creadoEn = new Date().toISOString();
  insertar(DB.VENTAS, v);
  ajustarStock(v.productoId, -Number(v.cantidad));
  return v;
}
function registrarCompra(c){
  c.id = generarId('co'); c.creadoEn = new Date().toISOString();
  insertar(DB.COMPRAS, c);
  ajustarStock(c.productoId, Number(c.cantidad));
  actualizar(DB.PRODUCTOS, c.productoId, { costoUnitario: Number(c.costoUnitario) });
  return c;
}
function registrarAbonoCliente(a){ a.id=generarId('ac'); a.creadoEn=new Date().toISOString(); return insertar(DB.ABONOS_CLIENTES, a); }
function registrarPagoProveedor(p){ p.id=generarId('pp'); p.creadoEn=new Date().toISOString(); return insertar(DB.PAGOS_PROVEEDORES, p); }
function registrarGasto(g){ g.id=generarId('g'); g.creadoEn=new Date().toISOString(); return insertar(DB.GASTOS, g); }
function registrarPagoGasto(p){ p.id=generarId('pg'); p.creadoEn=new Date().toISOString(); return insertar(DB.PAGOS_GASTOS, p); }

// ---- Saldos (siempre calculados, nunca guardados) ----
function calcularSaldoCliente(clienteId, hasta){
  hasta = hasta || hoy();
  const deuda = getAll(DB.VENTAS).filter(v=>v.clienteId===clienteId && v.metodoPago==='credito' && v.fecha<=hasta).reduce((s,v)=>s+v.total,0);
  const pagado = getAll(DB.ABONOS_CLIENTES).filter(a=>a.clienteId===clienteId && a.fecha<=hasta).reduce((s,a)=>s+a.monto,0);
  return Number((deuda - pagado).toFixed(2));
}
function calcularSaldoProveedor(proveedorId, hasta){
  hasta = hasta || hoy();
  const deuda = getAll(DB.COMPRAS).filter(c=>c.proveedorId===proveedorId && c.metodoPago==='credito' && c.fecha<=hasta).reduce((s,c)=>s+c.total,0);
  const pagado = getAll(DB.PAGOS_PROVEEDORES).filter(p=>p.proveedorId===proveedorId && p.fecha<=hasta).reduce((s,p)=>s+p.monto,0);
  return Number((deuda - pagado).toFixed(2));
}
function calcularSaldoGasto(gastoId, hasta){
  hasta = hasta || hoy();
  const g = buscarPorId(DB.GASTOS, gastoId);
  if(!g || g.metodoPago!=='credito') return 0;
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
  return getAll(DB.GASTOS).filter(g=>g.metodoPago==='credito' && g.fecha<=(hasta||hoy()))
    .map(g=>({ gasto:g, saldo: calcularSaldoGasto(g.id, hasta) })).filter(x=>x.saldo>0.01);
}
