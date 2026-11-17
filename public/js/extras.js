// Recursos do navegador: ícone da aba com progresso, Wake Lock e mini timer (PiP).

// ---------------------------------------------------------------- ícone da aba
export function createFavicon(link) {
  const original = link.getAttribute("href");
  const originalType = link.getAttribute("type");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  let lastKey = "";

  return {
    /** fraction: 0..1 restante; null volta ao ícone normal */
    update(fraction, color, track) {
      if (fraction === null) {
        if (lastKey !== "original") {
          link.setAttribute("type", originalType);
          link.setAttribute("href", original);
          lastKey = "original";
        }
        return;
      }
      // redesenha no máximo 1x por "pedaço" de 1% (evita trabalho à toa)
      const step = Math.round(fraction * 100);
      const key = `${step}|${color}|${track}`;
      if (key === lastKey || !ctx) return;
      lastKey = key;
      ctx.clearRect(0, 0, 64, 64);
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.strokeStyle = track;
      ctx.beginPath();
      ctx.arc(32, 32, 25, 0, Math.PI * 2);
      ctx.stroke();
      if (step > 0) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(32, 32, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (step / 100));
        ctx.stroke();
      }
      link.setAttribute("type", "image/png");
      link.setAttribute("href", canvas.toDataURL("image/png"));
    },
  };
}

// ---------------------------------------------------------------- Wake Lock
// Mantém a tela acesa no modo foco total enquanto o timer roda.
export function createWakeLock(emit) {
  let sentinel = null;
  let wanted = false;

  async function acquire() {
    if (!wanted || sentinel || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      emit("wakelock", { active: true });
      sentinel.addEventListener("release", () => {
        sentinel = null;
        emit("wakelock", { active: false });
      });
    } catch (e) { sentinel = null; }
  }

  // o navegador solta o wake lock quando a aba some; pede de novo ao voltar
  document.addEventListener("visibilitychange", acquire);

  return {
    set(on) {
      wanted = on;
      if (on) acquire();
      else if (sentinel) { const s = sentinel; sentinel = null; s.release().catch(() => {}); }
    },
    get active() { return !!sentinel; },
  };
}

// ---------------------------------------------------------------- mini timer flutuante
// Document Picture-in-Picture: uma janelinha que fica por cima de todas as outras.
export function createPip({ onToggle, getView }) {
  const supported = typeof window.documentPictureInPicture?.requestWindow === "function";
  let win = null, els = null, raf = 0;
  const CIRC = 2 * Math.PI * 45;

  function build(doc) {
    const css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL("styles.css", document.baseURI).href;
    doc.head.appendChild(css);
    doc.body.className = "pip";
    doc.body.innerHTML = `
      <div class="ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="track" cx="50" cy="50" r="45"/>
          <circle class="progress" cx="50" cy="50" r="45"/>
        </svg>
        <div class="time"><strong data-testid="pip-clock"></strong><span data-testid="pip-label"></span></div>
      </div>
      <button class="btn main-btn" data-testid="pip-toggle"></button>`;
    const progress = doc.querySelector(".progress");
    progress.style.strokeDasharray = CIRC;
    const btn = doc.querySelector("button");
    btn.addEventListener("click", onToggle);
    doc.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); onToggle(); } });
    return { doc, progress, btn, clock: doc.querySelector("strong"), label: doc.querySelector(".time span") };
  }

  // só troca o texto se mudou: no WebKit, trocar o texto sob o cursor durante o clique cancela o clique
  const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };

  function paint() {
    if (!els) return;
    const v = getView();
    const root = els.doc.documentElement;
    if (v.theme) root.dataset.theme = v.theme; else delete root.dataset.theme;
    els.doc.body.dataset.mode = v.mode;
    els.doc.body.classList.toggle("running", v.running);
    setText(els.clock, v.clock);
    setText(els.label, v.label);
    setText(els.btn, v.button);
    els.progress.style.strokeDashoffset = CIRC * (1 - v.fraction);
  }

  function loop() {
    paint();
    if (win) raf = win.requestAnimationFrame(loop); // rAF da própria janelinha: suave mesmo com a aba escondida
  }

  return {
    supported,
    get open() { return !!win; },
    async toggle() {
      if (win) { win.close(); return; }
      if (!supported) return;
      win = await window.documentPictureInPicture.requestWindow({ width: 240, height: 290 });
      els = build(win.document);
      win.addEventListener("pagehide", () => { win = null; els = null; });
      loop();
    },
    paint,
  };
}
