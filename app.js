(() => {
  'use strict';

  /* =========================================================
     QUOTEX AI SIGNAL
     STEP 1 - VISUAL CHART ANALYZER
     ========================================================= */

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

  /* =========================================================
     BASIC UI
     ========================================================= */

  function text(element, value) {
    if (element) {
      element.textContent = value;
    }
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
      String(signal)
        .toLowerCase()
        .replace(/[^a-z]/g, '-');

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

    text(
      confidenceValueEl,
      `${value}%`
    );

    if (confidenceFillEl) {
      confidenceFillEl.style.width =
        `${value}%`;
    }
  }

  /* =========================================================
     DURATIONS
     ========================================================= */

  function initDurations() {
    const buttons =
      document.querySelectorAll(
        '[data-duration]'
      );

    buttons.forEach((button) => {
      const duration =
        Number(button.dataset.duration);

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
            `Selected analysis duration: ${duration}s`
          );
        }
      );
    });
  }

  /* =========================================================
     SCREEN CAPTURE
     ========================================================= */

  async function startScreenCapture() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {
      throw new Error(
        'Screen capture is not supported by this browser.'
      );
    }

    stream =
      await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: {
            ideal: 8,
            max: 12
          }
        },
        audio: false
      });

    const track =
      stream.getVideoTracks()[0];

    if (!track) {
      throw new Error(
        'No screen capture track was created.'
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

    const sourceWidth =
      video.videoWidth || 1280;

    const sourceHeight =
      video.videoHeight || 720;

    const scale =
      Math.min(
        1,
        1280 / sourceWidth,
        720 / sourceHeight
      );

    canvas =
      document.createElement('canvas');

    canvas.width =
      Math.max(
        320,
        Math.floor(sourceWidth * scale)
      );

    canvas.height =
      Math.max(
        240,
        Math.floor(sourceHeight * scale)
      );

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
      canvas.width = 1;
      canvas.height = 1;
      canvas.remove();
    }

    canvas = null;
    ctx = null;

    previousFrame = null;
  }

  /* =========================================================
     FRAME CAPTURE
     ========================================================= */

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

  /* =========================================================
     COLOR CLASSIFICATION
     ========================================================= */

  function classifyPixel(r, g, b) {
    const max =
      Math.max(r, g, b);

    const min =
      Math.min(r, g, b);

    const saturation =
      max - min;

    if (saturation < 25) {
      return 0;
    }

    /*
      Green candle
    */

    if (
      g > r * 1.16 &&
      g > b * 1.04 &&
      saturation > 28
    ) {
      return 1;
    }

    /*
      Red candle
    */

    if (
      r > g * 1.16 &&
      r > b * 1.05 &&
      saturation > 28
    ) {
      return -1;
    }

    return 0;
  }

  /* =========================================================
     DYNAMIC CHART REGION
     ========================================================= */

  function findChartRegion(frame) {
    if (!frame) return null;

    const {
      data,
      width,
      height
    } = frame;

    /*
      We intentionally avoid a fixed Quotex
      coordinate system.

      Search the middle portion of the screen.
    */

    const top =
      Math.floor(height * 0.10);

    const bottom =
      Math.floor(height * 0.88);

    const left =
      Math.floor(width * 0.02);

    const right =
      Math.floor(width * 0.98);

    const columns =
      Math.max(
        80,
        Math.floor(width / 4)
      );

    const scores =
      new Array(columns).fill(0);

    const xScale =
      (right - left) / columns;

    const yStep =
      Math.max(
        4,
        Math.floor(height / 160)
      );

    for (let c = 0; c < columns; c++) {
      const x =
        Math.floor(
          left +
          c * xScale
        );

      let colored = 0;

      for (
        let y = top;
        y < bottom;
        y += yStep
      ) {
        const i =
          (y * width + x) * 4;

        if (
          classifyPixel(
            data[i],
            data[i + 1],
            data[i + 2]
          ) !== 0
        ) {
          colored++;
        }
      }

      scores[c] = colored;
    }

    /*
      Find the strongest continuous
      chart-like region.
    */

    let bestStart = 0;
    let bestEnd = columns - 1;

    let currentStart = 0;
    let currentScore = 0;

    let bestScore = 0;

    for (let i = 0; i < columns; i++) {
      const score = scores[i];

      if (score >= 2) {
        currentScore += score;
      } else {
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestStart = currentStart;
          bestEnd = i - 1;
        }

        currentStart = i + 1;
        currentScore = 0;
      }
    }

    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestStart = currentStart;
      bestEnd = columns - 1;
    }

    /*
      If the automatic region is weak,
      return a broad safe region.
    */

    if (
      bestScore < columns * 0.15
    ) {
      return {
        x0: left,
        x1: right,
        y0: top,
        y1: bottom
      };
    }

    return {
      x0:
        Math.floor(
          left +
          bestStart * xScale
        ),

      x1:
        Math.floor(
          left +
          (bestEnd + 1) * xScale
        ),

      y0: top,
      y1: bottom
    };
  }

  /* =========================================================
     CANDLE DETECTION
     ========================================================= */

  function detectCandles(frame, region) {
    if (!frame || !region) {
      return [];
    }

    const {
      data,
      width
    } = frame;

    const {
      x0,
      x1,
      y0,
      y1
    } = region;

    const columnData = [];

    const step =
      Math.max(
        2,
        Math.floor(
          (x1 - x0) / 240
        )
      );

    for (
      let x = x0;
      x < x1;
      x += step
    ) {
      let green = 0;
      let red = 0;

      let top = y1;
      let bottom = y0;

      for (
        let y = y0;
        y < y1;
        y += 2
      ) {
        const i =
          (y * width + x) * 4;

        const type =
          classifyPixel(
            data[i],
            data[i + 1],
            data[i + 2]
          );

        if (type === 1) {
          green++;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }

        if (type === -1) {
          red++;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }

      const colored =
        green + red;

      columnData.push({
        x,
        green,
        red,
        colored,
        top,
        bottom
      });
    }

    /*
      Group neighboring active columns.
    */

    const groups = [];

    let current = null;

    columnData.forEach((column) => {
      if (column.colored >= 2) {
        if (!current) {
          current = [];
        }

        current.push(column);
      } else {
        if (current && current.length) {
          groups.push(current);
        }

        current = null;
      }
    });

    if (current && current.length) {
      groups.push(current);
    }

    /*
      Convert groups into candle-like objects.
    */

    const candles = [];

    groups.forEach((group) => {
      if (group.length < 1) {
        return;
      }

      const green =
        group.reduce(
          (sum, item) =>
            sum + item.green,
          0
        );

      const red =
        group.reduce(
          (sum, item) =>
            sum + item.red,
          0
        );

      const total =
        green + red;

      if (total < 3) {
        return;
      }

      const direction =
        green > red
          ? 1
          : red > green
          ? -1
          : 0;

      const top =
        Math.min(
          ...group.map(
            (item) => item.top
          )
        );

      const bottom =
        Math.max(
          ...group.map(
            (item) => item.bottom
          )
        );

      const center =
        group.reduce(
          (sum, item) =>
            sum + item.x,
          0
        ) /
        group.length;

      const bodyStrength =
        Math.abs(
          green - red
        ) / total;

      candles.push({
        x: center,
        direction,
        bodyStrength,
        top,
        bottom
      });
    });

    /*
      Keep the latest candle-like
      structures.
    */

    return candles
      .slice(-30);
  }

  /* =========================================================
     FRAME ANALYSIS
     ========================================================= */

  function analyzeFrame(frame) {
    if (!frame) {
      return null;
    }

    const region =
      findChartRegion(frame);

    if (!region) {
      return null;
    }

    const candles =
      detectCandles(
        frame,
        region
      );

    /*
      Need enough visual structures
      before attempting directional analysis.
    */

    if (candles.length < 3) {
      return {
        valid: false,
        candleCount: candles.length,
        direction: 0,
        strength: 0,
        momentum: 0,
        rejection: 0
      };
    }

    const recent =
      candles.slice(-8);

    let directionSum = 0;
    let strengthSum = 0;

    recent.forEach((candle) => {
      directionSum +=
        candle.direction;

      strengthSum +=
        candle.bodyStrength;
    });

    const direction =
      directionSum /
      recent.length;

    const strength =
      strengthSum /
      recent.length;

    /*
      Momentum:
      compare early recent candles
      with latest candles.
    */

    const half =
      Math.max(
        1,
        Math.floor(
          recent.length / 2
        )
      );

    const firstHalf =
      recent.slice(
        0,
        half
      );

    const secondHalf =
      recent.slice(
        half
      );

    const firstDirection =
      firstHalf.reduce(
        (sum, candle) =>
          sum + candle.direction,
        0
      );

    const secondDirection =
      secondHalf.reduce(
        (sum, candle) =>
          sum + candle.direction,
        0
      );

    const momentum =
      clamp(
        (
          secondDirection -
          firstDirection
        ) /
        recent.length,
        -1,
        1
      );

    /*
      Frame motion.
    */

    let motion = 0;

    if (
      previousFrame &&
      previousFrame.data.length ===
        frame.data.length
    ) {
      const previous =
        previousFrame.data;

      const current =
        frame.data;

      let difference = 0;
      let samples = 0;

      const pixelStep = 12;

      for (
        let y = region.y0;
        y < region.y1;
        y += pixelStep
      ) {
        for (
          let x = region.x0;
          x < region.x1;
          x += pixelStep
        ) {
          const i =
            (y * frame.width + x) * 4;

          difference +=
            Math.abs(
              current[i] -
              previous[i]
            );

          difference +=
            Math.abs(
              current[i + 1] -
              previous[i + 1]
            );

          difference +=
            Math.abs(
              current[i + 2] -
              previous[i + 2]
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
      valid: true,
      candleCount: candles.length,
      direction,
      strength,
      momentum,
      motion
    };
  }

  /* =========================================================
     MULTI-FRAME DECISION
     ========================================================= */

  function makeDecision() {
    const valid =
      observations.filter(
        (item) => item.valid
      );

    if (valid.length < 3) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'Not enough clear candle data.'
      };
    }

    const average = (key) =>
      valid.reduce(
        (sum, item) =>
          sum + item[key],
        0
      ) /
      valid.length;

    const direction =
      average('direction');

    const strength =
      average('strength');

    const momentum =
      average('momentum');

    const motion =
      average('motion');

    /*
      Direction consistency.
    */

    const directionSign =
      Math.sign(direction);

    const sameDirection =
      valid.filter(
        (item) =>
          Math.sign(
            item.direction
          ) === directionSign
      ).length;

    const consistency =
      sameDirection /
      valid.length;

    /*
      Reject weak / unclear chart data.
    */

    if (
      Math.abs(direction) < 0.20 ||
      consistency < 0.60
    ) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'Candle direction is not clear enough.'
      };
    }

    /*
      Momentum must not strongly
      contradict the visual direction.
    */

    if (
      directionSign !== 0 &&
      Math.sign(momentum) !== 0 &&
      Math.sign(momentum) !==
        directionSign
    ) {
      return {
        signal: 'WAIT',
        confidence: 0,
        message:
          'Recent momentum is conflicting.'
      };
    }

    /*
      Visual evidence score.

      This is NOT a probability
      of winning a trade.
    */

    const evidence =
      (
        Math.abs(direction) * 0.45 +
        strength * 0.25 +
        consistency * 0.20 +
        Math.abs(momentum) * 0.10
      );

    const confidence =
      clamp(
        Math.round(
          40 +
          evidence * 45 +
          Math.min(
            motion * 10,
            5
          )
        ),
        40,
        85
      );

    const signal =
      direction > 0
        ? 'UP'
        : 'DOWN';

    return {
      signal,
      confidence,
      message:
        `Visual candle analysis completed for ${selectedDuration}s.`
    };
  }

  /* =========================================================
     COUNTDOWN
     ========================================================= */

  function startCountdown(seconds) {
    let remaining = seconds;

    text(
      messageEl,
      `Scanning visible chart: ${remaining}s`
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
          `Scanning visible chart: ${remaining}s`
        );
      }, 1000);
  }

  /* =========================================================
     HISTORY
     ========================================================= */

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
          : 'SCREEN',

      signal,
      confidence,

      duration:
        selectedDuration,

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

    if (!historyListEl) {
      return;
    }

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
 
