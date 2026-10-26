import { LOVE_PHRASES } from "./love-phrases.js";

// O prelúdio: "eu te amo" em dezenas de línguas enche a tela, as palavras se desfazem em
// poeira de luz que forma o nome de quem abre o app (na mesma fonte), as frases escritas
// pela pessoa amada aparecem palavra por palavra e a assinatura é escrita à mão.
const COLORS = ["244,196,207", "227,154,171", "220,191,145", "247,238,240"];
const NAME_FROM = [244, 196, 207];
const NAME_TO = [220, 191, 145];
const SCRIPT_FONT = '"Pinyon Script", "Cormorant Garamond", serif';
const PHRASES_MS = 5000;
const PHRASE_FADE_MS = 900;
const MERGE_HOLD_MS = 500;
const MERGE_SPREAD_MS = 900;
const MERGE_MS = 2300;
const NAME_REVEAL_MS = 1300;
const WORD_MS = 200;
const LINE_PAUSE_MS = 560;
const SIGNATURE_MS = 1900;

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value) {
  return value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

const clamp01 = value => Math.min(1, Math.max(0, value));
const mix = (from, to, amount) => from.map((value, index) => Math.round(value + (to[index] - value) * amount));

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

// Espalha os "eu te amo" pela tela: cada frase procura o lugar mais longe das que já estão lá.
// O ritmo começa lento e acelera, até a tela ficar cheia.
function layoutPhrases(context, width, height) {
  const count = Math.round(Math.min(70, Math.max(34, (width * height) / 11000)));
  const base = Math.min(36, Math.max(22, width * .045));
  const [first, ...others] = LOVE_PHRASES;
  const texts = [first];
  while (texts.length < count) texts.push(...shuffle([...others]));
  texts.length = count;
  const placed = [];
  return texts.map((text, index) => {
    const weight = index === 0 ? 1 : Math.pow(Math.random(), 1.6);
    const size = index === 0 ? base * 1.9 : base * (.65 + weight * .8);
    const font = `${size.toFixed(1)}px ${SCRIPT_FONT}`;
    context.font = font;
    const boxWidth = Math.min(context.measureText(text).width, width - 24);
    const boxHeight = size * 1.1;
    let spot = { x: width / 2, y: height * .42, w: boxWidth, h: boxHeight };
    if (index > 0) {
      spot = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidate = {
          x: 12 + boxWidth / 2 + Math.random() * Math.max(1, width - boxWidth - 24),
          y: 12 + boxHeight / 2 + Math.random() * Math.max(1, height - boxHeight - 24),
          w: boxWidth,
          h: boxHeight
        };
        // Folga até a frase mais próxima; negativa quando as caixas se sobrepõem.
        candidate.score = Math.min(...placed.map(other => Math.max(
          Math.abs(candidate.x - other.x) - (candidate.w + other.w) / 2,
          (Math.abs(candidate.y - other.y) - (candidate.h + other.h) / 2) * 1.6
        )));
        if (!spot || candidate.score > spot.score) spot = candidate;
      }
    }
    placed.push(spot);
    return {
      text,
      font,
      x: spot.x,
      y: spot.y,
      appearAt: 300 + PHRASES_MS * Math.pow(index / (count - 1), .6),
      color: index === 0 ? "247,238,240" : COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: index === 0 ? .95 : .45 + .45 * weight,
      phase: Math.random() * Math.PI * 2
    };
  });
}

function drawPhrase(context, phrase, elapsed, fade) {
  const age = elapsed - phrase.appearAt;
  if (age < 0 || fade <= 0) return;
  const shown = easeOutCubic(clamp01(age / PHRASE_FADE_MS));
  context.font = phrase.font;
  context.fillStyle = `rgba(${phrase.color},${phrase.alpha * shown * fade})`;
  context.fillText(phrase.text, phrase.x, phrase.y + (1 - shown) * 10 + Math.sin(elapsed / 1700 + phrase.phase) * 2.5);
}

function offscreen(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.textAlign = "center";
  context.textBaseline = "middle";
  return context;
}

export function createPrelude() {
  const overlay = document.querySelector("#prelude");
  const canvas = document.querySelector("#prelude-sky");
  const context = canvas.getContext("2d");
  const linesBox = document.querySelector("#prelude-lines");
  const signature = document.querySelector("#prelude-signature");
  const continueButton = document.querySelector("#prelude-continue");
  const skipButton = document.querySelector("#prelude-skip");
  const nameLabel = document.querySelector("#prelude-name");
  let timers = [];
  let frame = 0;
  let finish = null;

  const later = (delay, callback) => timers.push(setTimeout(callback, delay));

  function sky(name, reduceMotion) {
    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.textAlign = "center";
    context.textBaseline = "middle";

    const phrases = layoutPhrases(context, width, height);
    const mergeAt = phrases.at(-1).appearAt + PHRASE_FADE_MS + MERGE_HOLD_MS;
    const nameAt = mergeAt + MERGE_SPREAD_MS + MERGE_MS;

    // O nome, na mesma fonte das frases: os pixels preenchidos são o destino da poeira de luz.
    const nameContext = offscreen(width, height);
    let fontSize = Math.min(150, width * .24, height * .2);
    nameContext.font = `${fontSize}px ${SCRIPT_FONT}`;
    const measured = nameContext.measureText(name).width;
    if (measured > width * .86) fontSize *= (width * .86) / measured;
    const nameFont = `${fontSize}px ${SCRIPT_FONT}`;
    nameContext.font = nameFont;
    nameContext.fillStyle = "#fff";
    const centerY = height * .3;
    const nameWidth = Math.max(1, nameContext.measureText(name).width);
    const nameLeft = width / 2 - nameWidth / 2;
    nameContext.fillText(name, width / 2, centerY);
    const namePixels = nameContext.getImageData(0, 0, width, height).data;
    const step = Math.max(2, Math.round(fontSize / 45));
    const targets = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (namePixels[(y * width + x) * 4 + 3] > 140) targets.push({ x, y });
      }
    }
    if (!targets.length) targets.push({ x: width / 2, y: centerY });

    // As frases do jeito que estarão no instante da junção: cada pixel aceso vira um grão de luz.
    const phraseContext = offscreen(width, height);
    phrases.forEach(phrase => drawPhrase(phraseContext, phrase, mergeAt, 1));
    const phrasePixels = phraseContext.getImageData(0, 0, width, height).data;
    const sources = [];
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const index = (y * width + x) * 4;
        if (phrasePixels[index + 3] > 70) sources.push({ x, y, rgb: [phrasePixels[index], phrasePixels[index + 1], phrasePixels[index + 2]], alpha: phrasePixels[index + 3] / 255 });
      }
    }
    if (!sources.length) sources.push(...Array.from({ length: 400 }, () => ({ x: Math.random() * width, y: Math.random() * height, rgb: [247, 238, 240], alpha: .5 })));
    shuffle(sources);

    const total = Math.max(targets.length, Math.min(sources.length, width < 560 ? 2200 : 4200));
    const farthest = Math.hypot(width, height);
    const particles = Array.from({ length: total }, (_, index) => {
      const source = sources[index % sources.length];
      const target = targets[index % targets.length];
      const tx = target.x + (Math.random() - .5) * step * .8;
      const ty = target.y + (Math.random() - .5) * step * .8;
      const dx = tx - source.x;
      const dy = ty - source.y;
      const distance = Math.hypot(dx, dy) || 1;
      const color = mix(NAME_FROM, NAME_TO, clamp01((tx - nameLeft) / nameWidth));
      return {
        sx: source.x,
        sy: source.y,
        tx,
        ty,
        nx: -dy / distance,
        ny: dx / distance,
        curve: (Math.random() - .5) * Math.min(180, distance * .5),
        delay: (distance / farthest) * MERGE_SPREAD_MS * .6 + Math.random() * MERGE_SPREAD_MS * .4,
        from: source.alpha,
        size: Math.random() * .9 + 1.1,
        colors: Array.from({ length: 9 }, (_, shade) => `rgb(${mix(source.rgb, color, shade / 8).join(",")})`),
        phase: Math.random() * Math.PI * 2
      };
    });

    const nameGradient = context.createLinearGradient(nameLeft, 0, nameLeft + nameWidth, 0);
    nameGradient.addColorStop(0, "#f4c4cf");
    nameGradient.addColorStop(.5, "#f7eef0");
    nameGradient.addColorStop(1, "#dcbf91");
    const ambient = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * .9 + .3,
      phase: Math.random() * Math.PI * 2
    }));

    const start = performance.now();
    const draw = now => {
      const elapsed = reduceMotion ? nameAt + NAME_REVEAL_MS : now - start;
      const merging = elapsed - mergeAt;
      context.clearRect(0, 0, width, height);
      for (const star of ambient) {
        context.fillStyle = `rgba(247,238,240,${.12 + .1 * Math.sin(now / 900 + star.phase)})`;
        context.fillRect(star.x, star.y, star.size, star.size);
      }

      if (reduceMotion) phrases.forEach(phrase => drawPhrase(context, phrase, mergeAt, .2));
      else if (merging < 700) phrases.forEach(phrase => drawPhrase(context, phrase, elapsed, 1 - clamp01(merging / 700)));

      const reveal = easeOutCubic(clamp01((elapsed - nameAt) / NAME_REVEAL_MS));
      if (!reduceMotion && merging > 0) {
        const appear = clamp01(merging / 450);
        for (const particle of particles) {
          const local = clamp01((merging - particle.delay) / MERGE_MS);
          const eased = easeInOutCubic(local);
          const bend = Math.sin(local * Math.PI) * particle.curve;
          const x = particle.sx + (particle.tx - particle.sx) * eased + particle.nx * bend;
          const y = particle.sy + (particle.ty - particle.sy) * eased + particle.ny * bend;
          const settle = clamp01((merging - particle.delay - MERGE_MS) / 600);
          const flicker = .5 + .5 * Math.sin(now / 480 + particle.phase);
          const size = 1.4 + (particle.size - 1.4) * eased;
          context.globalAlpha = appear * (particle.from + (.85 - particle.from) * eased) * (1 - settle * .45 * flicker) * (1 - reveal * .5);
          context.fillStyle = particle.colors[Math.round(eased * 8)];
          context.fillRect(x - size / 2, y - size / 2, size, size);
        }
        context.globalAlpha = 1;
      }

      if (reveal > 0) {
        context.save();
        context.globalAlpha = reveal;
        context.font = nameFont;
        context.fillStyle = nameGradient;
        context.shadowColor = "rgba(227,154,171,.55)";
        context.shadowBlur = 24;
        context.fillText(name, width / 2, centerY);
        context.restore();
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };
    if (reduceMotion) draw(start);
    else frame = requestAnimationFrame(draw);
    return reduceMotion ? 0 : nameAt;
  }

  function writeLines(lines, startAt, reduceMotion) {
    linesBox.innerHTML = "";
    let cursor = startAt;
    for (const line of lines) {
      const paragraph = document.createElement("p");
      for (const word of line.split(" ")) {
        const span = document.createElement("span");
        span.className = "prelude-word";
        span.textContent = word;
        paragraph.append(span, " ");
        if (reduceMotion) span.classList.add("visible");
        else later(cursor, () => span.classList.add("visible"));
        cursor += WORD_MS;
      }
      linesBox.append(paragraph);
      cursor += LINE_PAUSE_MS;
    }
    return cursor;
  }

  function close() {
    if (!finish) return;
    const done = finish;
    finish = null;
    timers.forEach(clearTimeout);
    timers = [];
    overlay.classList.add("leaving");
    setTimeout(() => {
      cancelAnimationFrame(frame);
      overlay.hidden = true;
      overlay.classList.remove("visible", "leaving");
      document.body.classList.remove("prelude-locked");
      done();
    }, 900);
  }

  continueButton.addEventListener("click", close);
  skipButton.addEventListener("click", close);
  overlay.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  async function play({ name, lines, signature: signatureText }, { continueLabel = "Abrir o livro →" } = {}) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      await Promise.all([
        document.fonts.load('80px "Pinyon Script"', `${name} ęěħ`),
        document.fonts.load('40px "Cormorant Garamond"', "Я")
      ]);
    } catch (_) {}
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(frame);

    nameLabel.textContent = name;
    signature.textContent = `— ${signatureText}`;
    signature.classList.toggle("written", reduceMotion);
    continueButton.textContent = continueLabel;
    continueButton.hidden = !reduceMotion;
    overlay.hidden = false;
    document.body.classList.add("prelude-locked");
    void overlay.offsetWidth;
    overlay.classList.add("visible");
    skipButton.focus({ preventScroll: true });

    const nameAt = sky(name, reduceMotion);
    const linesEnd = writeLines(lines, nameAt + 600, reduceMotion);
    if (!reduceMotion) {
      later(linesEnd + 200, () => signature.classList.add("written"));
      later(linesEnd + SIGNATURE_MS + 600, () => {
        continueButton.hidden = false;
        continueButton.focus({ preventScroll: true });
      });
    }
    return new Promise(resolve => { finish = resolve; });
  }

  return { play };
}
