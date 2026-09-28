(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const assetSelect = $('asset');
  const scanButton = $('scan-button');
  const signalEl = $('signal');
  const signalIconEl = $('signal-icon');
  const messageEl = $('signal-message');
  const confidenceValueEl = $('confidence-value');
  const confidenceFillEl = $('confidence-fill');
  const historyListEl = $('history-list');
  const historyCountEl = $('history-count');
  const modeEl = $('mode');

  const DURATIONS = [5, 10, 15, 20, 45, 60];
  const MAX_HISTORY = 20;

  let selectedDuration = 5;

  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;

  let scanning = false;
  let scanTimer = null;
  let countdownTimer = null;

  let observations = [];
  let previousFrame = null;
  let history = [];

  function text(element, value) {
    if (element) element.textContent = value;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setMode(value) {
    text(modeEl, value);
  }

  function setSignal(signal, confidence = null, message = '') {
    if (!signalEl) return;

    signalEl.textContent = signal;

    signalEl.className =
      'signal ' +
      signal.toLowerCase().replace(/[^a-z]/g, '-');

    if (signalIconEl) {
      signalIconEl.textContent =
        signal === 'UP'
          ? '↑'
          : signal === 'DOWN'
          ? '↓'
          : '—';
    }

    text(messageEl, message);

    if (
      confidence === null ||
      !Number.isFinite(confidence)
    ) {
      text(confidenceValueEl, '—');

      if (confidenceFillEl) {
        confidenceFillEl.style.width = '0%';
      }

      return;
    }

    const value = clamp(
      Math.round(confidence),
      0,
      100
    );

    text(confidenceValueEl, `${value}%`);

    if (confidenceFillEl) {
      confidenceFillEl.style.width = `${value}%`;
    }
  }

  /* -----------------------------
     DURATION BUTTONS
  ----------------------------- */

  function initDurations() {
    const buttons =
      document.querySelectorAll(
        '[data-duration]'
      );

    buttons.forEach((button) => {
      const duration = Number(
        button.dataset.duration
      );

      if (!DURATIONS.includes(duration)) {
        return;
      }

      button.classList.toggle(
        'active',
        duration === selectedDuration
      );

      button.addEventListener(
        'click',
        () => {
          if (scanning) return;

          selectedDuration = duration;

          buttons.forEach((item) => {
            item.classList.remove('active');
          });

          button.classList.add('active');

          setSignal(
            'WAIT',
            null,
            `Scan duration: ${duration} seconds.`
          );
        }
      );
    });
  }

  /* -----------------------------
     SCREEN CAPTURE
  ----------------------------- */

  async function startScreenCapture() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {
      throw new Error(
        'This browser does not support screen capture.'
      );
    }

    stream =
      await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: {
            ideal: 5,
            max: 10
          }
        },
        audio: false
      });

    const track =
      stream.getVideoTracks()[0];

    if (!track) {
      throw new Error(
        'Screen capture track was not created.'
      );
    }

    track.addEventListener(
      'ended',
      () => {
        if (scanning) {
          finishScan(
            'Screen capture stopped.'
          );
        }
      }
    );

    video =
      document.createElement('video');

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;

    video.style.position = 'fixed';
    video.style.left = '-10000px';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';

    document.body.appendChild(video);

    await video.play();

    const width =
      Math.min(
        video.videoWidth || 1280,
        1280
      );

    const height =
      Math.min(
        video.videoHeight || 720,
        720
      );

    canvas =
      document.createElement('canvas');

    canvas.width =
      Math.max(320, width);

    canvas.height =
      Math.max(240, height);

    ctx =
      canvas.getContext(
        '2d',
        {
          willReadFrequently: true
        }
      );

    if (!ctx) {
      throw new Error(
        'Canvas analysis is unavailable.'
      );
    }
  }

  function stopScreenCapture() {
    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    stream = null;

    if (video) {
      video.pause();
      video.srcObject = null;
      video.remove();
    }

    video = null;

    if (canvas) {
      canvas.remove();
    }

    canvas = null;
    ctx = null;

    previousFrame = null;
  }

  /* -----------------------------
     FRAME CAPTURE
  ----------------------------- */

  function captureFrame() {
    if (
      !video ||
      !canvas ||
      !ctx ||
      video.readyState < 2
    ) {
      return null;
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  /* -----------------------------
     VISUAL CHART ANALYSIS
  ----------------------------- */

  function analyzeFrame(frame) {
    if (!frame) return null;

    const {
      data,
      width,
      height
    } = frame;

    /*
      Broad chart area.

      This is deliberately NOT based
      on fixed Quotex coordinates.
    */

    const x0 =
      Math.floor(width * 0.02);

    const x1 =
      Math.floor(width * 0.82);

    const y0 =
      Math.floor(height * 0.15);

    const y1 =
      Math.floor(height * 0.78);

    let green = 0;
    let red = 0;
    let total = 0;

    let brightness = 0;

    const step =
      Math.max(
        3,
        Math.floor(
          Math.min(
            width,
            height
          ) / 180
        )
      );

    for (
      let y = y0;
      y < y1;
      y += step
    ) {
      for (
        let x = x0;
        x < x1;
        x += step
      ) {
        const i =
          (y * width + x) * 4;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max =
          Math.max(r, g, b);

        const min =
          Math.min(r, g, b);

        const saturation =
          max - min;

        brightness +=
          (r + g + b) / 3;

        total++;

        /*
          Green candle pixels
        */

        if (
          g > r * 1.20 &&
          g > b * 1.08 &&
          saturation > 30
        ) {
          green++;
          continue;
        }

        /*
          Red candle pixels
        */

        if (
          r > g * 1.20 &&
          r > b * 1.10 &&
          saturation > 30
        ) {
          red++;
        }
      }
    }

    if (!total) {
      return null;
    }

    const colored =
      green + red;

    const activity =
      colored / total;

    const balance =
      colored > 0
        ? (green - red) / colored
        : 0;

    const avgBrightness =
      brightness / total;

    /*
      Frame-to-frame motion
    */

    let motion = 0;

    if (
      previousFrame &&
      previousFrame.data.length ===
        frame.data.length
    ) {
      let difference = 0;
      let samples = 0;

      const p =
        previousFrame.data;

      const pixelStep =
        Math.max(
          6,
          step * 3
        );

      for (
        let y = y0;
        y < y1;
        y += pixelStep
      ) {
        for (
          let x = x0;
          x < x1;
          x += pixelStep
        ) {
          const i =
            (y * width + x) * 4;

          difference +=
            Math.abs(
              frame.data[i] -
              p[i]
            );

          difference +=
            Math.abs(
              frame.data[i + 1] -
              p[i + 1]
            );

          difference +=
            Math.abs(
              frame.data[i + 2] -
              p[i + 2]
            );

          samples += 3;
        }
      }

      if (samples) {
        motion =
          clamp(
            difference /
              samples /
              255,
            0,
            1
          );
      }
    }

    previousFrame = frame;

    return {
      balance,
      activity,
      brightness: avgBrightness,
      motion
    };
  }

  /* -----------------------------
     MULTI-FRAME DECISION
  ----------------------------- */

  function makeDecision() {
    if (
      observations.length < 3
    ) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'Not enough chart frames.'
      };
    }

    const average = (key) =>
      observations.reduce(
        (sum, item) =>
          sum + item[key],
        0
      ) /
      observations.length;

    const balance =
      average('balance');

    const activity =
      average('activity');

    const brightness =
      average('brightness');

    /*
      Reject unusable images.
    */

    if (
      brightness < 15 ||
      activity < 0.002
    ) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'Chart candles are not clear enough.'
      };
    }

    /*
      Direction strength.
    */

    const strength =
      Math.abs(balance);

    /*
      Direction consistency.
    */

    const sign =
      Math.sign(balance);

    const sameDirection =
      observations.filter(
        (item) =>
          Math.sign(
            item.balance
          ) === sign
      ).length;

    const consistency =
      sameDirection /
      observations.length;

    /*
      IMPORTANT:

      No signal when the visual
      evidence is weak.
    */

    if (
      strength < 0.15 ||
      consistency < 0.60
    ) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'No sufficiently clear direction detected.'
      };
    }

    /*
      Visual-analysis confidence only.

      This is NOT probability of profit.
    */

    const confidence =
      clamp(
        Math.round(
          45 +
          strength * 35 +
          consistency * 20
        ),
        0,
        85
      );

    const signal =
      balance > 0
        ? 'UP'
        : 'DOWN';

    return {
      signal,
      confidence,
      message:
        `Visual chart analysis completed for ${selectedDuration}s.`
    };
  }

  /* -----------------------------
     COUNTDOWN
  ----------------------------- */

  function startCountdown(seconds) {
    let remaining = seconds;

    text(
      messageEl,
      `Analyzing visible chart: ${remaining}s`
    );

    countdownTimer =
      setInterval(() => {
        remaining--;

        if (remaining <= 0) {
          clearInterval(
            countdownTimer
          );

          countdownTimer = null;

          return;
        }

        text(
          messageEl,
          `Analyzing visible chart: ${remaining}s`
        );
      }, 1000);
  }

  /* -----------------------------
     HISTORY
  ----------------------------- */

  function addHistory(
    signal,
    confidence
  ) {
    if (
      signal !== 'UP' &&
      signal !== 'DOWN'
    ) {
      return;
    }

    history.unshift({
      asset:
        assetSelect
          ? assetSelect.value
          : 'AUTO',

      signal,

      confidence,

      time:
        new Date()
          .toLocaleTimeString()
    });

    history =
      history.slice(
        0,
        MAX_HISTORY
      );

    renderHistory();
  }

  function renderHistory() {
    text(
      historyCountEl,
      String(history.length)
    );

    if (!historyListEl) return;

    if (!history.length) {
      historyListEl.innerHTML =
        '<p class="empty-history">No signals recorded yet.</p>';

      return;
    }

    historyListEl.innerHTML =
      history
        .map(
          (item) => `
            <div class="history-item">
              <span class="history-asset">
                ${escapeHtml(item.asset)}
              </span>

              <strong class="history-signal ${item.signal.toLowerCase()}">
                ${item.signal}
              </strong>

              <span class="history-time">
                ${escapeHtml(item.time)}
              </span>
            </div>
          `
        )
        .join('');
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* -----------------------------
     CLEANUP
  ----------------------------- */

  function clearTimers() {
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }

    if (countdownTimer) {
      clearInterval(
        countdownTimer
      );

      countdownTimer = null;
    }
  }

  function finishScan(message) {
    scanning = false;

    clearTimers();

    stopScreenCapture();

    if (scanButton) {
      scanButton.disabled = false;
      scanButton.textContent =
        'SCAN MARKET';
    }

    setMode('READY');

    if (message) {
      text(
        messageEl,
        message
      );
    }
  }

  /* -----------------------------
     MAIN SCAN
  ----------------------------- */

  async function scanMarket() {
    if (scanning) return;

    scanning = true;

    observations = [];
    previousFrame = null;

    if (scanButton) {
      scanButton.disabled = true;
      scanButton.textContent =
        'STARTING SCREEN SCAN...';
    }

    setMode('CAPTURE');

    setSignal(
      'WAIT',
      null,
      'Allow screen capture and select the chart screen.'
    );

    try {
      await startScreenCapture();

      setMode('SCANNING');

      if (scanButton) {
        scanButton.textContent =
          `SCANNING ${selectedDuration}s...`;
      }

      startCountdown(
        selectedDuration
      );

      const start =
        performance.now();

      /*
        Capture several frames
        throughout the selected
        duration.
      */

      const sample = () => {
        if (!scanning) return;

        const frame =
          captureFrame();

        const result =
          analyzeFrame(frame);

        if (result) {
          observations.push(
            result
          );
        }

        const elapsed =
          (performance.now() -
            start) /
          1000;

        if (
          elapsed >=
          selectedDuration
        ) {
          finishAnalysis();
          return;
        }

        scanTimer =
          setTimeout(
            sample,
            250
          );
      };

      sample();

    } catch (error) {
      console.error(
        'Screen scan error:',
        error
      );

      finishScan(
        error.message ||
        'Screen capture failed.'
      );

      setSignal(
        'WAIT',
        null,
        error.message ||
          'Screen capture failed.'
      );
    }
  }

  function finishAnalysis() {
    clearTimers();

    const result =
      makeDecision();

    setSignal(
      result.signal,
      result.confidence,
      result.message
    );

    if (
      result.signal === 'UP' ||
      result.signal === 'DOWN'
    ) {
      addHistory(
        result.signal,
        result.confidence
      );
    }

    if (scanButton) {
      scanButton.textContent =
        'SCAN MARKET';
    }

    stopScreenCapture();

    scanning = false;

    setMode('READY');
  }

  /* -----------------------------
     BUTTON
  ----------------------------- */

  if (scanButton) {
    scanButton.addEventListener(
      'click',
      scanMarket
    );
  }

  /* -----------------------------
     START
  ----------------------------- */

  initDurations();

  setSignal(
    'WAIT',
    null,
    'Select duration and press SCAN MARKET.'
  );

  setMode('READY');

})();
