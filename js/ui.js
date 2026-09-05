// Bottom nav compartida — se inyecta sola leyendo data-pagina del <body>.
const MODULOS_NAV = [
  { id:'index', href:'index.html', icono:'bi-house-door-fill', label:'Inicio' },
  { id:'ingresos', href:'ingresos.html', icono:'bi-cash-coin', label:'Ingresos' },
  { id:'compras', href:'compras.html', icono:'bi-cart3', label:'Compras' },
  { id:'gastos', href:'gastos.html', icono:'bi-receipt', label:'Gastos' },
  { id:'inventario', href:'inventario.html', icono:'bi-box-seam', label:'Inventario' },
  { id:'reportes', href:'reportes.html', icono:'bi-bar-chart-line', label:'Reportes' }
];

document.addEventListener('DOMContentLoaded', ()=>{
  const activa = document.body.dataset.pagina;
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = MODULOS_NAV.map(m=>
    `<a class="bottom-nav-item${m.id===activa?' is-active':''}" href="${m.href}">
      <i class="bi ${m.icono}"></i><span>${m.label}</span>
    </a>`
  ).join('');
  document.body.appendChild(nav);
});
