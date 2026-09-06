// Entrada de datos por voz (Web Speech API) - complemento opcional a los formularios, nunca los reemplaza.

function vozSoportada(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

function mostrarErrorVoz(estadoEl, mensaje){
  estadoEl.className = 'voice-status text-danger';
  estadoEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${mensaje}`;
}

// boton: <button> con icono de micrófono y data-ejemplo="frase modelo" (se muestra como plantilla).
// estadoEl: elemento donde mostrar mensajes de estado.
// onResultado(objeto) recibe {monto, metodoPago, productoId, productoNombre, cantidad, persona, concepto, textoOriginal}.
// opciones.producto=false desactiva el reconocimiento de producto/cantidad (Gastos no tiene catálogo)
// y en su lugar extrae `concepto` (ej. "arriendo") de lo que se dijo antes del monto.
function activarBotonVoz(boton, estadoEl, onResultado, opciones){
  const ejemplo = boton.dataset.ejemplo || '50 mil en efectivo';
  if(!vozSoportada()){
    boton.disabled = true;
    mostrarErrorVoz(estadoEl, 'Tu navegador no soporta dictado por voz. Prueba con Chrome.');
    return;
  }
  estadoEl.className = 'voice-status';
  estadoEl.innerHTML = `<i class="bi bi-info-circle"></i> Di algo como: "${esc(ejemplo)}"`;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = 'es-CO';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let escuchando = false;
  let timeoutSinRespuesta = null;

  function detenerEscucha(){
    clearTimeout(timeoutSinRespuesta);
    escuchando = false;
    boton.classList.remove('escuchando');
  }

  boton.addEventListener('click', async ()=>{
    // Sin esta guarda, un segundo clic mientras ya está escuchando dispara un
    // InvalidStateError síncrono en rec.start() que antes quedaba silenciado.
    if(escuchando) return;
    if(navigator.permissions?.query){
      try{
        const permiso = await navigator.permissions.query({name:'microphone'});
        if(permiso.state==='denied'){
          mostrarErrorVoz(estadoEl, 'El micrófono está bloqueado para este sitio. Habilítalo desde el candado junto a la URL e intenta de nuevo.');
          return;
        }
      }catch(_e){ /* el navegador no soporta consultar este permiso; se intenta igual */ }
    }
    escuchando = true;
    boton.classList.add('escuchando');
    estadoEl.className = 'voice-status is-listening';
    estadoEl.innerHTML = `<i class="bi bi-mic-fill"></i> Escuchando... di algo como "${esc(ejemplo)}"`;
    try{
      rec.start();
      // Algunos navegadores basados en Chromium (Opera, Vivaldi...) exponen esta API pero no
      // tienen acceso al servicio de voz de Google: rec.start() no lanza error y nunca llega
      // ni onresult ni onerror, se queda "escuchando" para siempre. Este timeout es la única
      // forma de detectar ese silencio y avisarle al usuario en vez de dejarlo colgado.
      timeoutSinRespuesta = setTimeout(()=>{
        console.error('El reconocimiento de voz no respondió (posible falta de soporte real en este navegador).');
        try{ rec.abort(); }catch(_e){}
        detenerEscucha();
        mostrarErrorVoz(estadoEl, 'El micrófono no respondió. Este navegador podría no tener soporte real de dictado - usa Google Chrome.');
      }, 8000);
    }catch(e){
      console.error('No se pudo iniciar el reconocimiento de voz:', e);
      detenerEscucha();
      mostrarErrorVoz(estadoEl, 'No se pudo iniciar el micrófono. Intenta de nuevo.');
    }
  });
  rec.onresult = e=>{
    clearTimeout(timeoutSinRespuesta);
    const texto = e.results[0][0].transcript;
    estadoEl.className = 'voice-status is-processed';
    estadoEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> Escuché: "${esc(texto)}"`;
    onResultado(parseVoz(texto, opciones));
  };
  // 'network' y 'service-not-allowed': la API existe (Blink la expone) pero el servicio de
  // reconocimiento de Google solo responde a builds oficiales de Chrome - Opera, Brave, Vivaldi
  // y similares fallan aquí aunque el micrófono y los permisos estén bien.
  const MENSAJES_ERROR_VOZ = {
    'not-allowed': 'Permiso de micrófono denegado. Habilítalo desde el candado junto a la URL e intenta de nuevo.',
    'no-speech': 'No se detectó voz. Intenta de nuevo.',
    'audio-capture': 'No se pudo acceder al micrófono. Revisa que esté conectado y que ninguna otra app lo esté usando.',
    'network': 'Este navegador no tiene acceso al servicio de reconocimiento de voz. Usa Google Chrome para dictar.',
    'service-not-allowed': 'Este navegador no tiene acceso al servicio de reconocimiento de voz. Usa Google Chrome para dictar.',
    'language-not-supported': 'Este navegador no soporta dictado en español. Usa Google Chrome.'
  };
  rec.onerror = e=>{
    clearTimeout(timeoutSinRespuesta);
    console.error('Error de reconocimiento de voz:', e.error);
    mostrarErrorVoz(estadoEl, MENSAJES_ERROR_VOZ[e.error] || 'No se entendió, intenta de nuevo.');
  };
  rec.onend = detenerEscucha;
}

// Quita tildes para comparar sin importar si el usuario (o el reconocimiento de voz) las puso o no.
function sinTildes(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,''); }
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// El reconocimiento de voz suele transcribir las cantidades chicas como palabra ("cinco") en vez
// de dígito, aunque transcriba montos grandes en números ("2000"). Cubre 0-99.
// ponytail: no cubre centenas ("cien", "doscientos") - agregar si se necesitan cantidades >99.
const NUMEROS_TEXTO = {
  cero:0, un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10,
  once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
  veinte:20, veintiun:21, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25,
  veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29,
  treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90
};
function palabraANumero(frase){
  const p = frase.trim().split(/\s+/);
  if(p.length===1 && NUMEROS_TEXTO[p[0]]!==undefined) return NUMEROS_TEXTO[p[0]];
  if(p.length===3 && p[1]==='y' && NUMEROS_TEXTO[p[0]]!==undefined && NUMEROS_TEXTO[p[2]]!==undefined){
    return NUMEROS_TEXTO[p[0]] + NUMEROS_TEXTO[p[2]];
  }
  return null;
}

// El reconocimiento de voz suele escribir los montos grandes agrupados de a miles con espacio o
// punto ("30 000", "1.234.567") en vez de un solo número pegado - sin esto, la extracción de
// dígitos solo tomaba el primer grupo ("30") y perdía el resto.
function normalizarMiles(t){
  return t.replace(/\d{1,3}(?:[.\s]\d{3})+/g, m => m.replace(/[.\s]/g, ''));
}

// Muletillas al inicio del dictado que no son parte del concepto de un gasto (Gastos no tiene
// catálogo como Ventas/Compras, así que el concepto se infiere de lo que sobra antes del monto).
const MULETILLAS_CONCEPTO = /^(pague|gaste|compre|registra|anota|anotar|el|la|un|una)\s+/;

// Plantilla Ventas/Compras: "<cantidad> <producto> a <precio> en <método> para/de <persona>".
// Plantilla Gastos (opciones.producto===false): "<concepto> <monto> en <método>".
// Cada pieza es opcional y se reconoce por posición/palabras clave, no es lenguaje libre.
function parseVoz(texto, opciones){
  const usarProducto = !opciones || opciones.producto !== false;
  let t = normalizarMiles(sinTildes(texto.toLowerCase()));

  let metodoPago = null;
  const forma = listarFormasPago().find(f=> t.includes(sinTildes(f.nombre.toLowerCase())));
  if(forma) metodoPago = forma.nombre;
  else if(/contado/.test(t)){
    const efectivo = listarFormasPago().find(f=>f.tipo==='efectivo');
    if(efectivo) metodoPago = efectivo.nombre;
  }
  if(metodoPago) t = t.replace(sinTildes(metodoPago.toLowerCase()), ' ');

  // Producto: el nombre del catálogo más largo que aparezca en el texto (evita que "camiseta"
  // gane sobre "camiseta azul" si ambos existen). Cada palabra admite un plural simple (-s/-es)
  // porque quien dicta suele decir "camisetas" aunque el producto esté guardado en singular.
  // La cantidad es el número (dígito o palabra) justo antes.
  let productoId = null, productoNombre = null, cantidad = null;
  if(usarProducto){
    const productos = typeof listarProductos==='function' ? listarProductos() : [];
    let mejor = null;
    for(const p of productos){
      const nombre = sinTildes(p.nombre.toLowerCase());
      const rePlural = nombre.split(/\s+/).map(w=>escapeRegex(w)+'(?:es|s)?').join('\\s+');
      const m = t.match(new RegExp(rePlural));
      if(m && (!mejor || m[0].length>mejor.match.length)) mejor = {p, match:m[0]};
    }
    if(mejor){
      productoId = mejor.p.id;
      productoNombre = mejor.p.nombre;
      const idx = t.indexOf(mejor.match);
      const antes = t.slice(0, idx);
      let inicioConsumido = idx;
      const mDigito = antes.match(/(\d+)\s*$/);
      if(mDigito){
        cantidad = parseInt(mDigito[1]);
        inicioConsumido = antes.length - mDigito[0].length;
      } else {
        const palabras = antes.trim().split(/\s+/).filter(Boolean);
        for(const n of [3,2,1]){
          if(palabras.length>=n){
            const candidato = palabras.slice(-n).join(' ');
            const val = palabraANumero(candidato);
            if(val!=null){ cantidad = val; inicioConsumido = antes.lastIndexOf(candidato); break; }
          }
        }
      }
      t = t.slice(0, inicioConsumido) + ' ' + t.slice(idx + mejor.match.length);
    }
  }

  const mMil = t.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  const mNum = t.match(/(\d+(?:[.,]\d+)?)/);
  const matchMonto = mMil || mNum;
  const monto = mMil ? parseFloat(mMil[1].replace(',','.'))*1000
              : mNum ? parseFloat(mNum[1].replace(',','.')) : null;

  // Concepto (solo Gastos): todo lo que se dijo antes del monto, sin muletillas ni el conector
  // ("de"/"por") que suele quedar pegado justo antes del número.
  let concepto = null;
  if(!usarProducto && matchMonto){
    let c = t.slice(0, matchMonto.index).trim();
    c = c.replace(MULETILLAS_CONCEPTO, '').replace(/\s*(de|por|en)\s*$/, '').trim();
    concepto = c ? c.charAt(0).toUpperCase()+c.slice(1) : null;
  }

  // Persona (cliente/proveedor): "para/de/a <nombre>" al final de la frase. El grupo capturado
  // solo admite letras, así que un residuo numérico ("a 2000 pesos") nunca lo confunde con nombre.
  const mPersona = t.match(/(?:para|de|a)\s+([a-zñ\s]{2,30})$/);
  const persona = mPersona ? mPersona[1].trim().replace(/\s+/g,' ').replace(/\b\w/g, c=>c.toUpperCase()) : null;

  return { monto, metodoPago, productoId, productoNombre, cantidad, persona, concepto, textoOriginal: texto };
}
