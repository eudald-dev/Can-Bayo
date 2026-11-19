/* Can Bayó · comportamiento de la página.
   Funciona sin GSAP (estado, portada, menú, carta…); si GSAP carga y no se pide movimiento reducido,
   añade las escenas de scroll. Móvil y escritorio tienen escenas distintas (gsap.matchMedia). */
(() => {
"use strict";
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const R = document.documentElement;
const { HORARIO, DIAS, DESDE, MOMENTOS, MENUS = [] } = JSON.parse($("#datos").textContent);
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const esc = matchMedia("(min-width: 1024px)");
const fino = matchMedia("(hover: hover) and (pointer: fine)");
const fmtH = h => { h = ((h % 24) + 24) % 24; let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) { H = (H + 1) % 24; M = 0 } return String(H).padStart(2, "0") + ":" + String(M).padStart(2, "0") };
const tramos = f => f.length ? f.map(([a, b]) => fmtH(a) + "–" + fmtH(b)).join(" · ") : "Cerrado";
const G = window.gsap, ST = window.ScrollTrigger, SPL = window.SplitText;
const anim = !!(G && ST) && !reduce.matches;
if (anim) { G.registerPlugin(ST); if (SPL) G.registerPlugin(SPL); R.classList.add("anim"); ST.config({ ignoreMobileResize: true }) }

/* ---------- fotos diferidas: el srcset espera en data-srcset hasta que hace falta ---------- */
function cargaFoto(art) {
  if (!art) return;
  $$("[data-srcset]", art).forEach(e => { e.srcset = e.dataset.srcset; e.removeAttribute("data-srcset") });
  const im = $("img[data-src]", art); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src") }
}

/* ---------- abierto o cerrado, con la hora real del navegador ---------- */
const ahoraH = d => d.getHours() + d.getMinutes() / 60;
function estadoReal(d = new Date()) {
  const h = ahoraH(d), hoy = HORARIO[d.getDay()] || [];
  for (const [a, b] of hoy) if (h >= a && h < b) return { abierto: true, txt: `Abierto · cierra a las ${fmtH(b)}`, sub: `hasta las ${fmtH(b)}` };
  for (const [a] of hoy) if (a > h) return { abierto: false, txt: `Cerrado · abre a las ${fmtH(a)}`, sub: `abre a las ${fmtH(a)}` };
  for (let i = 1; i < 8; i++) {
    const dd = (d.getDay() + i) % 7, f = HORARIO[dd];
    if (f && f.length) { const c = i === 1 ? "mañana" : "el " + DIAS[dd].toLowerCase(); return { abierto: false, txt: `Cerrado · abre ${c} a las ${fmtH(f[0][0])}`, sub: `abre ${c} a las ${fmtH(f[0][0])}` } }
  }
  return { abierto: false, txt: "Cerrado", sub: "" };
}
/* lo que aún queda hoy: el día lo sirve y su franja no ha terminado */
function quedaHoy(s, d) {
  const dia = d.getDay(), h = ahoraH(d);
  if (!s.dias.includes(dia)) return false;
  return (HORARIO[dia] || []).some(([a, b]) => { const fin = Math.min(b, s.b); return fin > Math.max(a, s.a) && h < fin });
}
let primera = true;
function pintaEstado() {
  const d = new Date(), e = estadoReal(d), dia = d.getDay();
  $$("[data-estado]").forEach(el => { el.textContent = e.txt; el.classList.toggle("on", e.abierto) });
  $$("[data-neon]").forEach(n => {
    n.classList.toggle("on", e.abierto);
    if (primera && e.abierto) n.classList.add("parpadea");
    $(".tubo", n).textContent = e.abierto ? "Abierto" : "Cerrado";
    const s = $(".sub", n); if (s) s.textContent = e.sub;
  });
  const hoyP = $("#hoyP"); if (hoyP) hoyP.textContent = tramos(HORARIO[dia] || []);
  const quedan = MENUS.filter(s => quedaHoy(s, d));
  const hay = $("[data-hoyhay]");
  if (hay) { $("dd", hay).textContent = quedan.map(s => s.t.replace(/ /g, "\u00a0")).join(" · "); hay.hidden = !quedan.length }
  MENUS.forEach(s => {
    const li = $(`.menus-l [data-serv="${s.id}"]`); if (!li) return;
    const si = quedan.includes(s); li.classList.toggle("hoy", si); $(".ml-hoy", li).hidden = !si;
  });
  const f = $("[data-fecha]"); if (f) f.textContent = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $$("[data-anos]").forEach(el => el.textContent = d.getFullYear() - DESDE);
  const h = ahoraH(d);
  $$(".horas li").forEach(li => {
    const es = +li.dataset.dia === dia; li.classList.toggle("hoy", es);
    const b = $(".barra-h b", li); if (b) b.style.left = es && h >= 6 ? `calc(${((h - 6) / 18 * 100).toFixed(2)}% - 1px)` : "-10px";
  });
  primera = false;
}
pintaEstado(); setInterval(pintaEstado, 30000);

/* ---------- portada: «stories» en móvil, paneles en escritorio ---------- */
const moms = $$(".mom"), barras = $$(".st-barras span"), ids = moms.map(m => m.dataset.m);
const caja = $("#momentos"), pausaBtn = $(".st-pausa"), vivo = $("#momVivo");
const DUR = 6500;
let idx = Math.max(0, ids.indexOf(R.dataset.momento));
let pausado = reduce.matches, enPantalla = true, sujeto = false, t0 = 0, restante = DUR, timer = 0, listo = document.readyState === "complete";
const relleno = i => barras[i] && barras[i].firstElementChild;
function pintaBarras() {
  barras.forEach((b, j) => { const f = b.firstElementChild; f.style.transition = "none"; f.style.transform = `scaleX(${j < idx ? 1 : 0})` });
}
function congela() {
  clearTimeout(timer);
  if (t0) { restante = Math.max(0, restante - (performance.now() - t0)); t0 = 0 }
  const f = relleno(idx); if (f) { f.style.transition = "none"; f.style.transform = `scaleX(${(1 - restante / DUR).toFixed(4)})` }
}
function arranca() {
  clearTimeout(timer); t0 = 0;
  if (esc.matches || pausado || sujeto || !enPantalla || document.hidden) { congela(); return }
  const f = relleno(idx); if (!f) return;
  f.style.transition = "none"; f.style.transform = `scaleX(${(1 - restante / DUR).toFixed(4)})`;
  f.getBoundingClientRect();
  f.style.transition = `transform ${restante}ms linear`; f.style.transform = "scaleX(1)";
  t0 = performance.now(); timer = setTimeout(() => ponMomento(idx + 1), restante);
}
function ponMomento(i, { anuncia = false } = {}) {
  idx = (i + moms.length) % moms.length;
  R.dataset.momento = ids[idx];
  moms.forEach((m, j) => { const on = j === idx; m.classList.toggle("on", on); $(".mom-sel", m).setAttribute("aria-pressed", String(on)); if (on) cargaFoto(m) });
  if (anuncia && vivo) vivo.textContent = `${idx + 1} de ${moms.length}: ${MOMENTOS[idx].n}`;
  if (listo) cargaFoto(moms[(idx + 1) % moms.length]);
  restante = DUR; t0 = 0; pintaBarras(); arranca();
}
let ignoraClic = false;
$(".st-tap.ant").addEventListener("click", () => { if (ignoraClic) return; ponMomento(idx - 1, { anuncia: true }) });
$(".st-tap.sig").addEventListener("click", () => { if (ignoraClic) return; ponMomento(idx + 1, { anuncia: true }) });
function ponPausa(p) {
  pausado = p; pausaBtn.setAttribute("aria-pressed", String(p));
  pausaBtn.setAttribute("aria-label", p ? "Reanudar el pase de fotos" : "Pausar el pase de fotos");
  p ? congela() : arranca();
}
pausaBtn.addEventListener("click", () => ponPausa(!pausado));
if (pausado) ponPausa(true);
/* mantener pulsado para parar; deslizar para cambiar */
let x0 = 0, y0 = 0, tPulsa = 0, rastreo = false;
caja.addEventListener("pointerdown", e => {
  rastreo = false;
  if (esc.matches || e.target.closest(".st-pausa")) return;
  rastreo = true; x0 = e.clientX; y0 = e.clientY; ignoraClic = false;
  tPulsa = setTimeout(() => { sujeto = true; congela() }, 260);
});
const suelta = e => {
  clearTimeout(tPulsa); if (esc.matches || !rastreo) return; rastreo = false;
  const dx = e.clientX - x0, dy = e.clientY - y0;
  if (sujeto) { sujeto = false; ignoraClic = true; arranca(); setTimeout(() => ignoraClic = false, 50); return }
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { ignoraClic = true; ponMomento(idx + (dx < 0 ? 1 : -1), { anuncia: true }); setTimeout(() => ignoraClic = false, 50) }
};
caja.addEventListener("pointerup", suelta);
caja.addEventListener("pointercancel", () => { clearTimeout(tPulsa); rastreo = false; if (sujeto) { sujeto = false; arranca() } });
caja.addEventListener("contextmenu", e => { if (!esc.matches) e.preventDefault() });
caja.addEventListener("keydown", e => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault(); ponMomento(idx + (e.key === "ArrowRight" ? 1 : -1), { anuncia: true });
  if (esc.matches) $(".mom-sel", moms[idx]).focus();
});
/* escritorio: los paneles se abren al pasar el ratón o al pulsar */
moms.forEach((m, j) => {
  $(".mom-sel", m).addEventListener("click", () => ponMomento(j, { anuncia: true }));
  let tm = 0;
  m.addEventListener("mouseenter", () => { if (esc.matches && fino.matches) tm = setTimeout(() => ponMomento(j), 110) });
  m.addEventListener("mouseleave", () => clearTimeout(tm));
});
new IntersectionObserver(es => { enPantalla = es[0].isIntersecting; enPantalla ? arranca() : congela() }, { threshold: .35 }).observe($(".hero"));
document.addEventListener("visibilitychange", () => document.hidden ? congela() : arranca());
esc.addEventListener("change", () => { if (esc.matches) { congela(); moms.forEach(cargaFoto) } else arranca() });
ponMomento(idx);
if (esc.matches) moms.forEach(cargaFoto);
const trasCarga = () => { listo = true; setTimeout(() => moms.forEach(cargaFoto), 1200) };
listo ? trasCarga() : addEventListener("load", trasCarga, { once: true });

/* ---------- cabecera, color de la barra del navegador y dock ---------- */
const top = $("#top"), hero = $(".hero"), dock = $(".dock"), meta = $('meta[name="theme-color"]');
function cabecera() {
  const lim = esc.matches ? 10 : Math.max(10, hero.offsetHeight - top.offsetHeight - 10);
  const s = scrollY > lim; top.classList.toggle("solida", s);
  const c = s ? "#FCFBF8" : "#0D1840"; if (meta.content !== c) meta.content = c;
}
addEventListener("scroll", cabecera, { passive: true }); addEventListener("resize", cabecera); cabecera();
if (dock) {
  const tapan = new Set();
  const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? tapan.add(e.target) : tapan.delete(e.target)); dock.classList.toggle("fuera", tapan.size > 0) }, { rootMargin: "0px 0px -20% 0px" });
  $$(".reservar, .pie").forEach(el => io.observe(el));
}

/* ---------- menú a pantalla completa ---------- */
const menu = $("#menu");
/* Safari anterior a 15.4 no tiene <dialog>: se abre y se cierra con el atributo open */
const nativo = typeof menu.showModal === "function";
const cierraMenu = () => { if (nativo) menu.close(); else if (menu.hasAttribute("open")) { menu.removeAttribute("open"); R.style.overflow = ""; $("#menuBtn").focus() } };
$("#menuBtn").addEventListener("click", () => { if (nativo) menu.showModal(); else { menu.setAttribute("open", ""); $("#menuCerrar").focus() } R.style.overflow = "hidden" });
$("#menuCerrar").addEventListener("click", cierraMenu);
menu.addEventListener("close", () => { R.style.overflow = "" });
menu.addEventListener("click", e => { if (e.target.closest("a")) cierraMenu() });
if (!nativo) document.addEventListener("keydown", e => { if (e.key === "Escape") cierraMenu() });

/* ---------- carta: la categoría que se lee queda marcada (móvil) ---------- */
const nav = $(".carta-nav");
if (nav) {
  const chips = $$("a", nav), marca = id => {
    chips.forEach(a => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + id)));
    const a = chips.find(c => c.getAttribute("href") === "#" + id);
    if (a && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 20, behavior: reduce.matches ? "auto" : "smooth" });
  };
  const vistas = new Map();
  const io = new IntersectionObserver(es => {
    es.forEach(e => vistas.set(e.target.id, e.isIntersecting));
    if (!nav.offsetParent) return;
    const v = $$(".cat").find(c => vistas.get(c.id)); if (v) marca(v.id);
  }, { rootMargin: "-38% 0px -58% 0px" });
  $$(".cat").forEach(c => io.observe(c));
}

/* ---------- galería del local: posición ---------- */
const locG = $("#locG"), puntos = $$(".loc-pos i");
if (locG && puntos.length) locG.addEventListener("scroll", () => {
  const f = locG.firstElementChild, paso = f.offsetWidth + parseFloat(getComputedStyle(locG).columnGap || 0);
  const i = Math.min(puntos.length - 1, Math.round(locG.scrollLeft / paso));
  puntos.forEach((p, j) => p.classList.toggle("on", j === i));
}, { passive: true });

/* ---------- carruseles nativos: solo son paradas del tabulador cuando de verdad se desplazan ---------- */
const deslizables = $$("[data-desliza]");
const tabulables = () => deslizables.forEach(el => { if (el.scrollWidth > el.clientWidth + 2) el.setAttribute("tabindex", "0"); else el.removeAttribute("tabindex") });
tabulables(); addEventListener("resize", tabulables);

/* ---------- servilletas: en escritorio se pueden mover ---------- */
$$(".serv").forEach((s, n) => {
  let sx = 0, sy = 0, ox = 0, oy = 0, activo = false;
  s.addEventListener("pointerdown", e => {
    if (!esc.matches || !fino.matches) return;
    activo = true; s.setPointerCapture(e.pointerId); s.classList.add("coge");
    sx = e.clientX - ox; sy = e.clientY - oy; s.style.zIndex = 10 + (++n);
  });
  s.addEventListener("pointermove", e => { if (!activo) return; ox = e.clientX - sx; oy = e.clientY - sy; s.style.translate = `${ox}px ${oy}px` });
  const fin = () => { activo = false; s.classList.remove("coge") };
  s.addEventListener("pointerup", fin); s.addEventListener("pointercancel", fin);
});

/* ---------- textos legales: un enlace a #cookies abre el desplegable ---------- */
document.addEventListener("click", e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; const el = document.getElementById(a.getAttribute("href").slice(1)); if (el && el.tagName === "DETAILS") el.open = true });

/* ---------- contador de 1963 a hoy: columnas de cuentakilómetros ---------- */
const odo = $(".odo");
let odoPinta = () => {};
if (odo) {
  const hasta = new Date().getFullYear(), cols = [3, 2, 1, 0];
  odo.innerHTML = cols.map(k => {
    const p = 10 ** k, a = Math.floor(DESDE / p), b = Math.floor(hasta / p), s = [];
    for (let v = a; v <= b; v++) s.push(`<b>${v % 10}</b>`);
    return `<span class="odo-c"><span class="odo-s">${s.join("")}</span></span>`;
  }).join("");
  const tiras = $$(".odo-s", odo);
  odoPinta = prog => {
    const Y = DESDE + prog * (hasta - DESDE);
    cols.forEach((k, i) => {
      const p = 10 ** k, base = Math.floor(DESDE / p);
      let pos = Math.floor(Y / p);
      if (k > 0) { const r = (Y % p) - (p - 1); if (r > 0) pos += r }
      else pos = Y;
      tiras[i].style.transform = `translateY(${(-(pos - base) * .8).toFixed(4)}em)`;
    });
  };
  odoPinta(0);
}

if (!anim) return;

/* =====================================================================
   ESCENAS CON GSAP
   ===================================================================== */
const hh = () => top.offsetHeight;

/* desplazamiento suave solo en escritorio con ratón (en móvil, el scroll nativo) */
let lenis = null;
if (esc.matches && fino.matches && window.Lenis) {
  lenis = new Lenis({ lerp: .11, smoothWheel: true, anchors: true });
  lenis.on("scroll", ST.update);
  G.ticker.add(t => lenis.raf(t * 1000)); G.ticker.lagSmoothing(0);
  menu.addEventListener("close", () => lenis.start());
}

/* titulares: suben por líneas */
const titulares = $$(".tit, .tit-m, .hist-t, .res-t, .hist-cita p");
if (SPL) titulares.forEach(el => SPL.create(el, {
  type: "lines", mask: "lines", linesClass: "sl", autoSplit: true,
  onSplit: s => G.from(s.lines, { yPercent: 108, duration: 1.15, ease: "expo.out", stagger: .09, scrollTrigger: { trigger: el, start: "top 88%", once: true } })
}));
$$(".rv").forEach(el => G.from(el, { y: 28, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));

/* el tique sale de la impresora */
const tique = $(".tique");
if (tique) G.from(tique, { clipPath: "inset(0% 0% 100% 0%)", y: -40, duration: 1.3, ease: "power2.out", scrollTrigger: { trigger: tique, start: "top 85%", once: true } });

/* tablero: las letras se colocan una a una */
const letrasTb = $$(".tablero i:not(.esp)");
if (letrasTb.length) G.from(letrasTb, { autoAlpha: 0, y: "-=18", rotation: () => "+=" + G.utils.random(-30, 30), duration: .55, ease: "back.out(2.2)", stagger: .014, scrollTrigger: { trigger: ".tablero", start: "top 78%", once: true } });

/* horario: las barras se llenan */
G.from(".barra-h i", { scaleX: 0, duration: 1.1, ease: "power3.out", stagger: .06, scrollTrigger: { trigger: ".horas", start: "top 82%", once: true } });

/* servilletas: caen sobre la mesa */
G.from(".serv", { y: 90, autoAlpha: 0, duration: 1.1, ease: "power3.out", stagger: .14, scrollTrigger: { trigger: ".servilletas", start: "top 82%", once: true } });

/* fotos del local: un poco de profundidad */
$$(".loc-m img").forEach(im => G.fromTo(im, { yPercent: -5 }, { yPercent: 5, ease: "none", scrollTrigger: { trigger: im.parentElement, start: "top bottom", end: "bottom top", scrub: true } }));

/* historia: el contador avanza con el scroll */
const pista = $(".hist-pista");
if (pista) {
  const der = $$(".hist-der > *");
  G.set(der, { autoAlpha: 0, y: 30 });
  ST.create({ trigger: pista, start: "top top", end: "bottom bottom", scrub: .4, onUpdate: s => odoPinta(Math.min(1, s.progress / .7)) });
  G.to(der, { autoAlpha: 1, y: 0, stagger: .12, duration: .8, ease: "power3.out", scrollTrigger: { trigger: pista, start: () => "top+=" + (pista.offsetHeight * .32) + " top", toggleActions: "play none none reverse" } });
}
/* capítulos de la familia: cada año entra al llegar (en escritorio, uno detrás de otro) */
$$(".cap").forEach((c, i) => G.from(c, { y: 44, autoAlpha: 0, duration: 1, ease: "power3.out", delay: esc.matches ? i * .12 : 0, scrollTrigger: { trigger: c, start: "top 88%", once: true } }));
G.from(".hist-cita figcaption", { autoAlpha: 0, y: 16, duration: .8, ease: "power2.out", delay: .5, scrollTrigger: { trigger: ".hist-cita", start: "top 80%", once: true } });

/* teléfono y nombre final: letra a letra */
if (SPL) {
  const num = $(".res-tel .res-num");
  if (num) SPL.create(num, { type: "chars", mask: "chars", charsClass: "sc", onSplit: s => G.from(s.chars, { yPercent: 100, duration: .9, ease: "expo.out", stagger: .03, scrollTrigger: { trigger: num, start: "top 92%", once: true } }) });
  const marca = $(".pie-marca");
  if (marca) SPL.create(marca, { type: "chars", mask: "chars", charsClass: "sc", onSplit: s => G.from(s.chars, { yPercent: 100, duration: 1.1, ease: "expo.out", stagger: .05, scrollTrigger: { trigger: marca, start: "top 95%", once: true } }) });
}

const mm = G.matchMedia();
mm.add("(max-width: 1023px)", () => {
  /* portada: al bajar, el rótulo se aleja */
  G.to(".hero-marca", { yPercent: -14, autoAlpha: .15, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  /* arroces: cada tarjeta se hunde cuando llega la siguiente */
  const cartas = $$(".arr");
  cartas.forEach((c, i) => {
    if (i === cartas.length - 1) return;
    const sig = cartas[i + 1], velo = $(".arr-velo", c);
    const fin = () => "top " + (hh() + 14 + (i + 1) * 10) + "px";
    G.to($(".arr-in", c), { scale: .9, ease: "none", scrollTrigger: { trigger: sig, start: "top bottom", end: fin, scrub: true } });
    if (velo) G.to(velo, { opacity: .5, ease: "none", scrollTrigger: { trigger: sig, start: "top bottom", end: fin, scrub: true } });
  });
});
mm.add("(min-width: 1024px)", () => {
  /* portada: el rótulo gigante se desplaza más lento que los paneles */
  G.to(".hero-tit", { yPercent: 22, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  /* arroces: galería horizontal anclada */
  const lista = $(".arr-l"), track = $(".arr-pista");
  const dist = () => Math.max(0, lista.scrollWidth - innerWidth);
  G.to(lista, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: track, start: "center center", end: () => "+=" + dist(), pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1 } });
});

document.fonts && document.fonts.ready.then(() => ST.refresh());
addEventListener("load", () => ST.refresh(), { once: true });
})();
