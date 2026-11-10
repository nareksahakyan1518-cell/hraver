// Register GSAP ScrollToPlugin for smooth automatic scrolling
if (window.ScrollToPlugin) {
  gsap.registerPlugin(ScrollToPlugin);
}

const TOTAL_FRAMES = 48;
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

const frames = new Array(TOTAL_FRAMES);

const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

// Lock canvas internal resolution to native 1080p (9:16)
canvas.width = FRAME_WIDTH;
canvas.height = FRAME_HEIGHT;

const preloader = document.getElementById('preloader');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const innerVideo = document.getElementById('inner-video');

let isVideoPlaying = false;
let audioUnlocked = false;
let appStarted = false;
let currentAnimProgress = 0;
let autoScrolled = false;
let autoScrollTween = null;

// Helper to format 1080p WebP frame file name: assets/frames/frame_0001.webp -> frame_0048.webp
function getFramePath(index) {
  const paddedIndex = String(index).padStart(4, '0');
  return `assets/frames/frame_${paddedIndex}.webp`;
}

// Get requested frame or nearest already-loaded frame
function getBestFrame(targetIdx) {
  const exact = frames[targetIdx];
  if (exact && exact.complete && exact.naturalWidth > 0) return exact;

  for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
    const prev = targetIdx - offset;
    if (prev >= 0 && frames[prev] && frames[prev].complete && frames[prev].naturalWidth > 0) {
      return frames[prev];
    }
    const next = targetIdx + offset;
    if (next < TOTAL_FRAMES && frames[next] && frames[next].complete && frames[next].naturalWidth > 0) {
      return frames[next];
    }
  }
  return null;
}

// Draw frame or parting doors over the full-screen video
function renderScene(progress) {
  currentAnimProgress = progress;
  const sealPhaseEnd = 0.45;

  if (progress <= sealPhaseEnd) {
    // Phase 1: Seal cracking open (frames 0 .. 47)
    const normalized = Math.max(0, Math.min(1, progress / sealPhaseEnd));
    const index = Math.min(TOTAL_FRAMES - 1, Math.round(normalized * (TOTAL_FRAMES - 1)));
    const img = getBestFrame(index);
    if (!img) return;

    ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.drawImage(img, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  } else {
    // Phase 2: Green envelope doors slide open outward revealing full-screen video underneath
    const img = getBestFrame(TOTAL_FRAMES - 1);
    if (!img) return;

    const rawOpen = Math.max(0, Math.min(1, (progress - sealPhaseEnd) / (1 - sealPhaseEnd)));
    const openProgress = rawOpen < 0.5
      ? 2 * rawOpen * rawOpen
      : 1 - Math.pow(-2 * rawOpen + 2, 2) / 2;

    const halfW = FRAME_WIDTH / 2;
    const shift = openProgress * (halfW + 30);

    ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

    if (openProgress < 1) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 35;

      // Left envelope door sliding left
      ctx.drawImage(
        img,
        0, 0, halfW, FRAME_HEIGHT,
        -shift, 0, halfW, FRAME_HEIGHT
      );

      // Right envelope door sliding right
      ctx.drawImage(
        img,
        halfW, 0, halfW, FRAME_HEIGHT,
        halfW + shift, 0, halfW, FRAME_HEIGHT
      );

      ctx.restore();
    }
  }
}

// Unlock audio on any touch/click/gesture without interrupting mobile video playback
function unlockAudio() {
  if (!innerVideo) return;
  audioUnlocked = true;
  innerVideo.muted = false;
  innerVideo.volume = 1;
  if (innerVideo.paused) {
    innerVideo.play().catch(() => {
      innerVideo.muted = true;
      innerVideo.play().catch(() => {});
    });
  }
}

['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, unlockAudio, { passive: true });
});

function playFullscreenVideo() {
  if (!innerVideo || isVideoPlaying) return;
  isVideoPlaying = true;

  try {
    innerVideo.currentTime = 0;
  } catch (e) {}

  // Only unmute if user already touched the screen; otherwise keep muted so mobile Safari/Chrome never pauses the video
  innerVideo.muted = !audioUnlocked;
  innerVideo.volume = 1;

  const playPromise = innerVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      innerVideo.muted = true;
      innerVideo.play().catch(() => {});
    });
  }
}

// When video finishes playing once, automatically scroll down through the invitation pages
if (innerVideo) {
  innerVideo.addEventListener('ended', () => {
    // Only trigger auto-scroll after the envelope has opened
    if (!isVideoPlaying) {
      innerVideo.play().catch(() => {});
      return;
    }

    // Keep playing video/music in loop while scrolling down
    innerVideo.loop = true;
    innerVideo.play().catch(() => {});

    if (!autoScrolled) {
      autoScrolled = true;
      startAutoScrollSequence();
    }
  });
}

function startAutoScrollSequence() {
  const slide1 = document.getElementById('slide-1');
  const slide2 = document.getElementById('slide-2');
  if (!slide1 || !slide2) return;

  // Cancel automatic scroll if user manually scrolls with finger/wheel
  const stopAutoScroll = () => {
    if (autoScrollTween) {
      autoScrollTween.kill();
      autoScrollTween = null;
    }
    window.removeEventListener('wheel', stopAutoScroll);
    window.removeEventListener('touchmove', stopAutoScroll);
  };
  window.addEventListener('wheel', stopAutoScroll, { passive: true });
  window.addEventListener('touchmove', stopAutoScroll, { passive: true });

  autoScrollTween = gsap.timeline()
    // 1) Smooth, unhurried scroll down to First Image (IMG_6280.JPEG)
    .to(window, {
      duration: 3.2,
      scrollTo: { y: slide1, offsetY: 0 },
      ease: 'power2.inOut'
    })
    // Pause 4.5 seconds so guest can comfortably read the first card
    .to({}, { duration: 4.5 })
    // 2) Smooth, unhurried scroll down to Second Image (IMG_6312.JPEG)
    .to(window, {
      duration: 3.2,
      scrollTo: { y: slide2, offsetY: 0 },
      ease: 'power2.inOut',
      onComplete: () => {
        window.removeEventListener('wheel', stopAutoScroll);
        window.removeEventListener('touchmove', stopAutoScroll);
      }
    });
}

// Priority progressive preloader
function preloadImagesFast() {
  const priorityIndices = [1, 48, 2, 3, 6, 12, 18, 24, 30, 36, 42];
  const prioritySet = new Set(priorityIndices);
  const remainingIndices = [];

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    if (!prioritySet.has(i)) {
      remainingIndices.push(i);
    }
  }

  let priorityLoaded = 0;
  const priorityCount = priorityIndices.length;

  function loadSingleFrame(oneBasedIndex, onDone) {
    const img = new Image();
    img.decoding = 'async';
    img.src = getFramePath(oneBasedIndex);
    frames[oneBasedIndex - 1] = img;

    const finish = () => {
      if (onDone) onDone();
    };
    img.onload = finish;
    img.onerror = finish;
  }

  priorityIndices.forEach((idx) => {
    loadSingleFrame(idx, () => {
      priorityLoaded++;
      const percent = Math.min(100, Math.round((priorityLoaded / priorityCount) * 100));
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}%`;

      if (idx === 1) {
        renderScene(0);
      }

      if (priorityLoaded === priorityCount && !appStarted) {
        startAppImmediately();
        remainingIndices.forEach((remIdx) => {
          loadSingleFrame(remIdx, () => {
            renderScene(currentAnimProgress);
          });
        });
      }
    });
  });
}

function startAppImmediately() {
  if (appStarted) return;
  appStarted = true;

  // Ensure mobile browser starts decoding/playing muted video immediately (never call pause() here!)
  if (innerVideo) {
    innerVideo.muted = true;
    innerVideo.play().catch(() => {});
  }

  renderScene(0);
  preloader.classList.add('hidden');
  startAutomaticOpening();
}

// Automatically open the envelope and start the video without waiting for manual scroll
function startAutomaticOpening() {
  const animObj = { progress: 0 };

  gsap.to(animObj, {
    progress: 1,
    duration: 5.8,
    delay: 0.6,
    ease: 'power1.inOut',
    onUpdate: () => {
      renderScene(animObj.progress);

      // Start playing the full-screen video right as the doors begin parting
      if (animObj.progress >= 0.45 && !isVideoPlaying) {
        playFullscreenVideo();
      }
    }
  });
}

// Start fast priority preloading
preloadImagesFast();
