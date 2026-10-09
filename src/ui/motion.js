export function setupAtmosphere() {
  const canvas = document.querySelector("#atmosphere-canvas");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let particles = [];
  let running = true;
  const colors = ["215,71,95", "217,138,154", "213,183,138", "246,236,238"];

  const reset = particle => {
    particle.x = Math.random() * width;
    particle.y = height + Math.random() * height * .22;
    particle.radius = Math.random() * 1.2 + .35;
    particle.speed = Math.random() * .18 + .045;
    particle.drift = (Math.random() - .5) * .08;
    particle.alpha = Math.random() * .3 + .08;
    particle.color = colors[Math.floor(Math.random() * colors.length)];
    particle.petal = Math.random() > .93;
    particle.phase = Math.random() * Math.PI * 2;
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: width < 700 ? 34 : 66 }, () => {
      const item = {};
      reset(item);
      item.y = Math.random() * height;
      return item;
    });
  };
  const draw = time => {
    if (!running) return;
    context.clearRect(0, 0, width, height);
    particles.forEach(particle => {
      particle.y -= particle.speed;
      particle.x += particle.drift + Math.sin(time * .00025 + particle.phase) * .025;
      if (particle.y < -18 || particle.x < -18 || particle.x > width + 18) reset(particle);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(Math.sin(time * .00018 + particle.phase) * .7);
      context.fillStyle = `rgba(${particle.color},${particle.alpha})`;
      context.shadowColor = `rgba(${particle.color},.18)`;
      context.shadowBlur = particle.petal ? 8 : 4;
      context.beginPath();
      if (particle.petal) context.ellipse(0, 0, 1.4, 3.6, .5, 0, Math.PI * 2);
      else context.arc(0, 0, particle.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
    requestAnimationFrame(draw);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    const shouldRun = !document.hidden;
    if (shouldRun && !running) {
      running = true;
      requestAnimationFrame(draw);
    } else if (!shouldRun) running = false;
  });
  requestAnimationFrame(draw);
}

export function setupDynamicMotion() {
  const topbar = document.querySelector(".topbar");
  const progress = document.querySelector("#scroll-progress");
  const heroImage = document.querySelector(".hero > img");
  const cursor = document.querySelector("#cursor-light");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    topbar.classList.toggle("scrolled", window.scrollY > 24);
    if (!reduceMotion && heroImage && window.scrollY < window.innerHeight) {
      heroImage.style.translate = `0 ${window.scrollY * .065}px`;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
  document.body.classList.add("pointer-active");
  window.addEventListener("pointermove", event => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    const surface = event.target.closest(".interactive-surface, .memory-card");
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    surface.style.setProperty("--pointer-x", `${x}%`);
    surface.style.setProperty("--pointer-y", `${y}%`);
    if (surface.matches("[data-tilt]")) {
      surface.style.setProperty("--tilt-x", `${((x - 50) / 50) * 1.8}deg`);
      surface.style.setProperty("--tilt-y", `${((50 - y) / 50) * 1.5}deg`);
    }
  }, { passive: true });
}

export function setupRevealAndNavigation() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((item, index) => item.style.setProperty("--reveal-delay", `${(index % 3) * 70}ms`));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    reveals.forEach(item => item.classList.add("visible"));
  } else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: .12 });
    reveals.forEach(item => observer.observe(item));
  }
  const links = document.querySelectorAll(".mobile-nav a");
  const sections = [...document.querySelectorAll("main section[id]")];
  const navigationObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
  }), { rootMargin: "-35% 0px -55%", threshold: 0 });
  sections.forEach(section => navigationObserver.observe(section));
}
