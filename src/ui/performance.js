const SAMPLE_SIZE = 120;
const SLOW_FRAME_MS = 28;
const PAUSE_MS = 250;

// Animação de uma seção fora da tela ninguém vê: ela para até a seção voltar.
function pauseOffscreenSections() {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    entry.target.classList.toggle("offscreen", !entry.isIntersecting);
  }));
  document.querySelectorAll("main > section").forEach(section => observer.observe(section));
}

// Sem aceleração de vídeo (ou num aparelho fraco), desfoques ao vivo e animações contínuas travam a
// página. Se a tela não acompanhar, o espaço passa para o modo leve até a próxima vez que abrir.
function watchFrameRate() {
  const frames = [];
  let last = performance.now();
  const measure = time => {
    const frame = time - last;
    last = time;
    if (!document.hidden && frame < PAUSE_MS) frames.push(frame);
    if (frames.length < SAMPLE_SIZE) {
      requestAnimationFrame(measure);
      return;
    }
    const median = frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)];
    if (median >= SLOW_FRAME_MS) document.documentElement.classList.add("lite");
  };
  requestAnimationFrame(measure);
}

export function setupPerformance() {
  pauseOffscreenSections();
  watchFrameRate();
}
