// O prelúdio: estrelas que se juntam e formam o nome de quem abre o app, as frases
// escritas pela pessoa amada aparecendo palavra por palavra e a assinatura escrita à mão.
const COLORS = ["244,196,207", "227,154,171", "220,191,145", "247,238,240"];
const CONVERGE_MS = 3200;
const WORD_MS = 200;
const LINE_PAUSE_MS = 560;
const SIGNATURE_MS = 1900;

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
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

    // Desenha o nome fora da tela e usa os pixels preenchidos como destino das estrelas.
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const sampleContext = sample.getContext("2d");
    let fontSize = Math.min(150, width * .24, height * .2);
    sampleContext.font = `${fontSize}px "Pinyon Script"`;
    const measured = sampleContext.measureText(name).width;
    if (measured > width * .86) fontSize *= (width * .86) / measured;
    sampleContext.font = `${fontSize}px "Pinyon Script"`;
    sampleContext.textAlign = "center";
    sampleContext.textBaseline = "middle";
    sampleContext.fillStyle = "#fff";
    const centerY = height * .3;
    sampleContext.fillText(name, width / 2, centerY);
    const pixels = sampleContext.getImageData(0, 0, width, height).data;
    const step = Math.max(3, Math.round(fontSize / 40));
    const stars = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (pixels[(y * width + x) * 4 + 3] > 140) {
          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            tx: x + (Math.random() - .5) * step * .6,
            ty: y + (Math.random() - .5) * step * .6,
            delay: Math.random() * 650,
            size: Math.random() * 1.2 + 1.05,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }
    const ambient = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * .9 + .3,
      phase: Math.random() * Math.PI * 2
    }));

    const start = performance.now();
    const draw = now => {
      const elapsed = now - start;
      context.clearRect(0, 0, width, height);
      for (const star of ambient) {
        context.fillStyle = `rgba(247,238,240,${.12 + .1 * Math.sin(now / 900 + star.phase)})`;
        context.fillRect(star.x, star.y, star.size, star.size);
      }
      for (const star of stars) {
        const progress = reduceMotion ? 1 : easeOutCubic(Math.min(1, Math.max(0, (elapsed - star.delay) / CONVERGE_MS)));
        const x = star.x + (star.tx - star.x) * progress;
        const y = star.y + (star.ty - star.y) * progress;
        const twinkle = progress === 1 ? .78 + .22 * Math.sin(now / 520 + star.phase) : .35 + .5 * progress;
        context.fillStyle = `rgba(${star.color},${twinkle})`;
        context.fillRect(x, y, star.size, star.size);
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };
    if (reduceMotion) draw(start + CONVERGE_MS * 2);
    else frame = requestAnimationFrame(draw);
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
      await document.fonts.load('80px "Pinyon Script"');
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

    sky(name, reduceMotion);
    const linesEnd = writeLines(lines, CONVERGE_MS + 300, reduceMotion);
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
