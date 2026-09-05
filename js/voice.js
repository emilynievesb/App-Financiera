// Entrada de datos por voz (Web Speech API) — complemento opcional a los formularios, nunca los reemplaza.

function vozSoportada(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

// boton: <button> con icono de micrófono. estadoEl: elemento donde mostrar mensajes de estado.
// onResultado(objeto) recibe {monto, metodoPago, textoOriginal} para pre-llenar el formulario.
function activarBotonVoz(boton, estadoEl, onResultado){
  if(!vozSoportada()){ boton.classList.add('d-none'); return; }
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = 'es-CO';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  boton.addEventListener('click', ()=>{
    boton.classList.add('escuchando');
    estadoEl.className = 'voice-status is-listening';
    estadoEl.innerHTML = '<i class="bi bi-mic-fill"></i> Escuchando... di por ejemplo "50 mil en efectivo"';
    try{ rec.start(); }catch(_e){ /* ya estaba escuchando */ }
  });
  rec.onresult = e=>{
    const texto = e.results[0][0].transcript;
    estadoEl.className = 'voice-status is-processed';
    estadoEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> Escuché: "${esc(texto)}"`;
    onResultado(parseVoz(texto));
  };
  rec.onerror = e=>{
    estadoEl.className = 'voice-status text-danger';
    estadoEl.textContent = e.error==='not-allowed'
      ? 'Permiso de micrófono denegado.'
      : 'No se entendió, intenta de nuevo.';
  };
  rec.onend = ()=>{ boton.classList.remove('escuchando'); };
}

function parseVoz(texto){
  const t = texto.toLowerCase();
  let metodoPago = null;
  if(/efectivo|contado/.test(t)) metodoPago='efectivo';
  else if(/cr[eé]dito/.test(t)) metodoPago='credito';
  else if(/transferencia/.test(t)) metodoPago='transferencia';
  else if(/tarjeta/.test(t)) metodoPago='tarjeta';

  const mMil = t.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  const mNum = t.match(/(\d+(?:[.,]\d+)?)/);
  const monto = mMil ? parseFloat(mMil[1].replace(',','.'))*1000
              : mNum ? parseFloat(mNum[1].replace(',','.')) : null;

  return { monto, metodoPago, textoOriginal: texto };
}
