(() => {
  'use strict';
  // Motion is optional; the poster remains the fallback on slow connections.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.getElementById('hero-video');
  const motionButton = document.getElementById('motion-toggle');
  let motionPaused = reduced.matches || Boolean(navigator.connection?.saveData);
  let heroVisible = true;
  const syncPlayback = () => {
    const active = !motionPaused && heroVisible && !document.hidden;
    document.body.classList.toggle('motion-paused', motionPaused);
    motionButton.textContent = motionPaused ? '▶ Activar movimiento' : 'Ⅱ Pausar movimiento';
    motionButton.setAttribute('aria-pressed', String(motionPaused));
    if (!active) { video.pause(); return; }
    if (!video.getAttribute('src')) {
      video.src = matchMedia('(max-width: 600px)').matches
        ? 'assets/hero-play-loop-mobile.mp4' : 'assets/hero-play-loop.mp4';
      video.load();
    }
    video.play().catch(() => { video.classList.remove('is-playing'); });
  };
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.addEventListener('error', () => video.classList.remove('is-playing'));
  motionButton.addEventListener('click', () => { motionPaused = !motionPaused; syncPlayback(); });
  reduced.addEventListener('change', event => { motionPaused = event.matches; syncPlayback(); });
  document.addEventListener('visibilitychange', syncPlayback);
  new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; syncPlayback(); }, {threshold:0}).observe(document.getElementById('inicio'));
  syncPlayback();

  const dialog = document.getElementById('experience-dialog');
  const form = document.getElementById('experience-form');
  const stages = [...form.querySelectorAll('.quiz-stage')];
  const next = document.getElementById('quiz-next');
  const back = document.getElementById('quiz-back');
  const error = document.getElementById('quiz-error');
  const progress = document.getElementById('quiz-progress');
  const status = document.getElementById('quiz-status');
  const review = document.getElementById('quiz-review');
  let step = 0;
  let opener;
  const groupNames = ['mascota','rubro','juego','recompensa'];
  const show = () => {
    stages.forEach((stage, index) => { stage.hidden = index !== step; });
    progress.value = Math.min(step + 1, 5);
    status.textContent = step < 5 ? `PASO ${step + 1} DE 5` : 'TU IDEA ESTÁ LISTA';
    next.hidden = step === 5;
    next.textContent = step === 4 ? 'Ver mi resumen →' : 'Siguiente →';
    back.hidden = step === 0;
    error.textContent = '';
    dialog.querySelector('.quiz-body').scrollTop = 0;
    stages[step].querySelector('h3').focus();
  };
  const validate = () => {
    if (step < 4) {
      if (!form.querySelector(`input[name="${groupNames[step]}"]:checked`)) {
        error.textContent = 'Elige una opción para continuar.';
        stages[step].querySelector('input').focus();
        return false;
      }
    } else if (step === 4) {
      const email = form.elements.correo;
      email.value = email.value.trim();
      if (!email.checkValidity()) {
        error.textContent = 'Escribe un correo válido, por ejemplo: hola@tumarca.com.';
        email.setAttribute('aria-invalid', 'true'); email.focus(); return false;
      }
      email.removeAttribute('aria-invalid');
      if (!form.elements.consentimiento.checked) {
        error.textContent = 'Necesitamos tu autorización para contactarte sobre la asesoría.';
        form.elements.consentimiento.focus(); return false;
      }
    }
    return true;
  };
  const makeSummary = () => {
    const data = new FormData(form);
    const pairs = [['Mascota',data.get('mascota')],['Rubro',data.get('rubro')],['Videojuego',data.get('juego')],['Recompensa',data.get('recompensa')],['Correo',data.get('correo')],['Contacto preferido',data.get('contacto')]];
    review.replaceChildren();
    pairs.forEach(([label,value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt,dd); review.append(row);
    });
    const message = ['¡Hola, IMAGINA PLAY! Quiero mi asesoría gratuita para crear una experiencia interactiva.','',...pairs.map(([label,value])=>`${label}: ${value}`),'','Autorizo que me contacten sobre esta asesoría.'].join('\n');
    const number = String(window.IMAGINA_CONFIG?.whatsapp || '523310970969').replace(/\D/g,'');
    document.getElementById('quiz-whatsapp').href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  };
  document.querySelectorAll('[data-open-experience]').forEach(button => button.addEventListener('click', () => {
    opener = button; dialog.showModal(); document.body.style.overflow = 'hidden'; show();
  }));
  document.getElementById('quiz-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; opener?.focus(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step >= 5 || !validate()) return;
    if (step === 4) makeSummary();
    step++; show();
  });
  back.addEventListener('click', () => { if (step > 0) { step--; show(); } });
  form.addEventListener('change', () => { error.textContent = ''; });
})();
