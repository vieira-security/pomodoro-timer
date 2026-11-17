// Áudio: alarmes sintetizados e som ambiente (Web Audio API).

// ---------------------------------------------------------------- ruídos gerados
// Ruído branco e marrom são gerados na hora (10 s, com o fim encaixando no
// começo para o loop não ter clique).
export const Noise = {
  brown(len) {
    const d = new Float32Array(len);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last; }
    return d;
  },
  white(len) {
    const d = new Float32Array(len);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return d;
  },
  // remove a "rampa" entre o fim e o começo (loop sem degrau) e normaliza o volume
  seamless(d, peak = 0.9) {
    const len = d.length, step = (d[len - 1] - d[0]) / (len - 1);
    let mean = 0;
    for (let i = 0; i < len; i++) { d[i] -= step * i; mean += d[i]; }
    mean /= len;
    let max = 0;
    for (let i = 0; i < len; i++) { d[i] -= mean; max = Math.max(max, Math.abs(d[i])); }
    if (max > 0) for (let i = 0; i < len; i++) d[i] *= peak / max;
    return d;
  },
  generate(kind, rate) {
    const len = Math.round(10 * rate);
    return kind === "white" ? this.seamless(this.white(len), 0.6) : this.seamless(this.brown(len));
  },
};

const AMBIENT = {
  white: { gain: 0.5 },
  brown: { gain: 1 },
  // gravação real (2:30 com crossfade na emenda), baixada só quando usada
  rain: { gain: 1.2, url: "sounds/rain.mp3" },
};

export function createAudio({ getSettings, emit }) {
  const Sound = {
    ctx: null,
    unlock() {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) {}
      return this.ctx;
    },
  };

  const Alarm = {
    // nota com envelope (ataque rápido, decaimento exponencial)
    note(ctx, out, { freq, at, dur, type = "sine", vol = 0.35 }) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.05);
    },
    patterns: {
      // Dó-Mi-Sol-Dó: sobe no fim do foco, desce no fim da pausa
      bell(ctx, out, now, ended) {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        if (ended !== "focus") notes.reverse();
        const reps = ended === "focus" ? 3 : 2;
        for (let r = 0; r < reps; r++) notes.forEach((f, i) => {
          const at = now + r * 1.6 + i * 0.18;
          Alarm.note(ctx, out, { freq: f, at, dur: 1.2, type: "triangle" });
          Alarm.note(ctx, out, { freq: f * 2.01, at, dur: 0.8, vol: 0.08 });
        });
      },
      // bip-bip-bip de relógio digital
      digital(ctx, out, now, ended) {
        const freq = ended === "focus" ? 1760 : 1320;
        for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) {
          Alarm.note(ctx, out, { freq, at: now + r * 1.0 + i * 0.12, dur: 0.08, type: "square", vol: 0.12 });
        }
      },
      // acorde grave e macio, tipo marimba
      soft(ctx, out, now, ended) {
        const chord = ended === "focus" ? [261.63, 329.63, 392.0] : [392.0, 329.63, 261.63];
        for (let r = 0; r < 2; r++) chord.forEach((f, i) => {
          Alarm.note(ctx, out, { freq: f, at: now + r * 1.8 + i * 0.25, dur: 1.6, vol: 0.3 });
        });
      },
    },
    play(ended, force) {
      const settings = getSettings();
      const kind = settings.sound;
      if (kind === "off" && !force) return;
      emit("alarm", { kind, mode: ended });
      const ctx = Sound.unlock();
      if (!ctx) return;
      const out = ctx.createGain();
      out.gain.value = Math.pow(settings.volume / 100, 2) * 1.5;
      out.connect(ctx.destination);
      (this.patterns[kind] || this.patterns.bell)(ctx, out, ctx.currentTime + 0.05, ended);
    },
  };

  const Ambient = {
    nodes: null,
    cache: {},
    session: 0,
    // devolve o AudioBuffer do som (gera ou baixa uma vez e guarda)
    load(ctx, kind) {
      if (!this.cache[kind]) {
        const cfg = AMBIENT[kind];
        this.cache[kind] = cfg.url
          ? fetch(cfg.url)
              .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
              .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
          : Promise.resolve().then(() => {
              const data = Noise.generate(kind, ctx.sampleRate);
              const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
              buf.copyToChannel(data, 0);
              return buf;
            });
        this.cache[kind].catch(() => { delete this.cache[kind]; }); // tenta de novo na próxima
      }
      return this.cache[kind];
    },
    // ignora silêncio que o decodificador de MP3 pode colocar nas pontas
    edges(buf) {
      const d = buf.getChannelData(0), max = Math.min(d.length >> 1, buf.sampleRate);
      let a = 0, b = d.length - 1;
      while (a < max && Math.abs(d[a]) < 1e-4) a++;
      while (b > d.length - max && Math.abs(d[b]) < 1e-4) b--;
      return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
    },
    start() {
      const kind = getSettings().ambient;
      if (kind === "off" || this.nodes) return;
      const ctx = Sound.unlock();
      if (!ctx) return;
      const id = ++this.session;
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      this.nodes = { master, ctx, src: null };
      emit("ambient", { playing: true, kind });

      this.load(ctx, kind).then((buf) => {
        if (id !== this.session || !this.nodes) return; // parou antes de terminar de carregar
        const [loopStart, loopEnd] = this.edges(buf);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = loopStart;
        src.loopEnd = loopEnd;
        const g = ctx.createGain();
        g.gain.value = AMBIENT[kind].gain;
        src.connect(g).connect(master);
        // começa num ponto aleatório para cada sessão soar diferente
        src.start(ctx.currentTime, loopStart + Math.random() * (loopEnd - loopStart));
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(this.level(), ctx.currentTime + 1.5);
        this.nodes.src = src;
      }).catch(() => {});
    },
    level() { return Math.max(0.0001, Math.pow(getSettings().ambientVolume / 100, 2) * 0.8); },
    setVolume() {
      if (this.nodes && this.nodes.src) this.nodes.master.gain.setTargetAtTime(this.level(), this.nodes.ctx.currentTime, 0.1);
    },
    stop() {
      if (!this.nodes) return;
      const { src, master, ctx } = this.nodes;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      if (src) src.stop(now + 0.65);
      this.nodes = null;
      this.session++;
      emit("ambient", { playing: false });
    },
  };

  return { Sound, Alarm, Ambient };
}
