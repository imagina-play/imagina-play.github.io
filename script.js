(() => {
  'use strict';
  const config = window.IMAGINA_CONFIG || {};
  const whatsapp = String(config.whatsapp || '').replace(/\D/g, '');
  if (whatsapp) document.querySelectorAll('.whatsapp-link').forEach(link => {
    link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(config.whatsappMessage || 'Hola, quiero conocer IMAGINA PLAY.')}`;
  });
  document.getElementById('year').textContent = new Date().getFullYear();
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const closeMenu = () => { mobileNav.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menú'); };
  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    mobileNav.hidden = !opening; menuButton.setAttribute('aria-expanded', String(opening)); menuButton.setAttribute('aria-label', opening ? 'Cerrar menú' : 'Abrir menú');
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  const playButton = document.getElementById('play-chumel');
  const dialog = document.getElementById('game-dialog');
  const frameWrap = document.getElementById('game-frame-wrap');
  let closeTimer;
  let launchVersion = 0;
  const demo = config.demo || {};
  let gameURL = null;
  try { if (demo.src) { const candidate = new URL(demo.src, location.href); if (candidate.origin === location.origin && /^https?:$/.test(candidate.protocol)) gameURL = candidate; } } catch (_) {}
  if (gameURL) {
    playButton.disabled = false;
    document.getElementById('demo-status-label').textContent = 'LISTA PARA JUGAR';
    document.querySelector('.demo-status').classList.add('is-ready');
    document.getElementById('demo-availability').textContent = 'Juega aquí, sin descargar nada.';
    document.getElementById('game-title').textContent = demo.title || 'Demo';
    document.querySelector('.game-dialog-note').textContent = demo.instructions || '';
    playButton.addEventListener('click', async () => {
      const version = ++launchVersion;
      clearTimeout(closeTimer);
      frameWrap.replaceChildren();
      const loading = document.createElement('p'); loading.className = 'game-loading'; loading.textContent = 'Preparando tu partida…'; frameWrap.append(loading);
      dialog.showModal(); document.body.style.overflow = 'hidden';
      try {
        const response = await fetch(gameURL, { method: 'HEAD' });
        if (!response.ok) throw new Error('Unavailable');
        if (!dialog.open || version !== launchVersion) return;
        const iframe = document.createElement('iframe'); iframe.title = demo.title || 'Demo jugable'; iframe.src = gameURL.href; iframe.allow = 'fullscreen; autoplay; gamepad'; iframe.allowFullscreen = true;
        iframe.addEventListener('load', () => { if (version !== launchVersion || !dialog.open) return; clearTimeout(closeTimer); loading.remove(); iframe.focus(); }, { once: true }); frameWrap.append(iframe);
        closeTimer = setTimeout(() => { if (loading.isConnected) loading.textContent = 'La carga está tardando. Si la partida no aparece, cierra e inténtalo otra vez.'; }, 12000);
      } catch (_) { if (version !== launchVersion || !dialog.open) return; loading.className = 'game-error'; loading.textContent = 'No pudimos cargar la demo. Cierra esta ventana e inténtalo de nuevo más tarde.'; }
    });
  }
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { launchVersion++; clearTimeout(closeTimer); frameWrap.replaceChildren(); document.body.style.overflow = ''; playButton.focus(); });
})();
