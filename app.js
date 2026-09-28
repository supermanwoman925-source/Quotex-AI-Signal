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

  const DURATION_VALUES = [5, 10, 15, 20, 45, 60];
  const MAX_HISTORY = 20;

  let selectedDuration = 5;
  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let scanTimer = null;
  let countdownTimer = null;
  let scanning = false;
  let history = [];
  let previousFrame = null;

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setSignal(signal, confidence = null, message = '') {
    if (!signalEl) return;

    signalEl.textContent = signal;
    signalEl.className =
      'signal ' + signal.toLowerCase().replace(/[^a-z]/g, '-');

    if (signalIconEl) {
      signalIconEl.textContent =
        signal === 'UP'
          ? '↑'
          : signal === 'DOWN'
          ? '↓'
          : '—';
    }

    setText(messageEl, message);

    if (confidence === null || !Number.isFinite(confidence)) {
      setText(confidenceValueEl, '—');

      if (confidenceFillEl) {
        confidenceFillEl.style.width = '0%';
      }

      return;
    }

    const value = clamp(Math.round(confidence), 0, 100);

    setText(confidenceValueEl, `${value}%`);

    if (confidenceFillEl) {
      confidenceFillEl.style.width = `${value}%`;
    }
  }

  function setMode(text) {
    setText(modeEl, text);
  }

  function getDuration() {
    return selectedDuration;
  }

  function findDurationButtons() {
    return Array.from(document.querySelectorAll('button')).filter(
      (button) => {
        const match = button.textContent.trim().match(/^(5|10|15|20|45|60)s$/);
        return Boolean(match);
      }
    );
  }

  function initDurationButtons() {
    const buttons = findDurationButtons();

    buttons.forEach((button) => {
      const seconds = Number(
        button.textContent.trim().replace('s', '')
      );

      if (!DURATION_VALUES.includes(seconds)) return;

      button.classList.toggle(
        'active',
        seconds === selectedDuration
      );

      button.addEventListener('click', () => {
        if (scanning) return;

        selectedDuration = seconds;

        buttons.forEach((item) =>
          item.classList.remove('active')
        );

        button.classList.add('active');

        setSignal(
          'NO SIGNAL',
          null,
          `Scan duration set to ${seconds}s.`
        );
      });
    });
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
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
  }

  async function requestScreen() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {
      throw new Error(
        'Screen capture is not supported by this browser.'
      );
    }

    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: {
          ideal: 5,
          max: 10
        }
      },
      audio: false
    });

    const track = stream.getVideoTracks()[0];

    if (!track) {
      throw new Error(
        'No screen video track was provided.'
      );
    }

    track.addEventListener('ended', () => {
      if (scanning) {
        finishScan('Screen sharing stopped.');
      }
    });

    video = document.createElement('video');

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;

    video.style.position = 'fixed';
    video.style.left = '-99999px';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';

    document.body.appendChild(video);

    await video.play();

    canvas = document.createElement('canvas');

    canvas.width = Math.max(
      320,
      Math.min(video.videoWidth || 1280, 1280)
    );

    canvas.height = Math.max(
      240,
      Math.min(video.videoHeight || 720, 720)
    );

    canvas.style.display = 'none';

    document.body.appendChild(canvas);

    ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });

    if (!ctx) {
      throw new Error(
        'Canvas analysis is unavailable.'
      );
    }
  }

  function captureFrame() {
    if (
      !video ||
      !ctx ||
      !canvas ||
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

  function analyzeFrame(imageData) {
    if (!imageData) return null;

    const { data, width, height } = imageData;

    /*
     * Initial chart-analysis region.
     *
     * This is intentionally broad and is NOT tied
     * to Quotex coordinates.
     */

    const x0 = Math.floor(width * 0.03);
    const x1 = Math.floor(width * 0.78);

    const y0 = Math.floor(height * 0.18);
    const y1 = Math.floor(height * 0.72);

    let green = 0;
    let red = 0;
    let active = 0;

    let weightedX = 0;
    let weightedY = 0;

    let totalBrightness = 0;
    let samples = 0;

    const step = Math.max(
      2,
      Math.floor(
        Math.min(width, height) / 220
      )
    );

    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * width + x) * 4;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        const saturation = max - min;

        const brightness =
          (r + g + b) / 3;

        totalBrightness += brightness;
        samples += 1;

        if (
          g > r * 1.22 &&
          g > b * 1.08 &&
          saturation > 35
        ) {
          green += 1;

          weightedX += x;
          weightedY += y;

          active += 1;
        } else if (
          r > g * 1.22 &&
          r > b * 1.12 &&
          saturation > 35
        ) {
          red += 1;

          weightedX += x;
          weightedY += y;

          active += 1;
        }
      }
    }

    const totalColored = green + red;

    const greenRatio =
      samples ? green / samples : 0;

    const redRatio =
      samples ? red / samples : 0;

    const directionalBalance =
      totalColored
        ? (green - red) / totalColored
        : 0;

    const activityRatio =
      samples
        ? totalColored / samples
        : 0;

    const averageBrightness =
      samples
        ? totalBrightness / samples
        : 0;

    let motion = 0;

    if (
      previousFrame &&
      previousFrame.data.length === data.length
    ) {
      let diff = 0;
      let compared = 0;

      const pixelStep = Math.max(
        4,
        step * 2
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

          const p = previousFrame.data;

          diff += Math.abs(
            data[i] - p[i]
          );

          diff += Math.abs(
            data[i + 1] - p[i + 1]
          );

          diff += Math.abs(
            data[i + 2] - p[i + 2]
          );

          compared += 3;
        }
      }

      motion =
        compared
          ? clamp(
              diff / compared / 255,
              0,
              1
            )
          : 0;
    }

    previousFrame = imageData;

    return {
      greenRatio,
      redRatio,
      directionalBalance,
      activityRatio,
      averageBrightness,
      motion,

      centerX:
        active
          ? weightedX / active / width
          : 0.5,

      centerY:
        active
          ? weightedY / active / height
          : 0.5
    };
  }

  function combineObservations(observations) {
    if (!observations.length) {
      return {
        signal: 'WAIT',
        confidence: 0,
        reason:
          'No usable chart pixels detected.'
      };
    }

    const avg = (key) =>
      observations.reduce(
        (sum, item) =>
          sum + item[key],
        0
      ) / observations.length;

    const balance =
      avg('directionalBalance');

    const activity =
      avg('activityRatio');

    const motion =
      avg('motion');

    const brightness =
      avg('averageBrightness');

    /*
     * Conservative visual gate.
     *
     * This is only a visual experiment.
     * It is NOT a financial prediction model.
     */

    if (activity < 0.003) {
      return {
        signal: 'WAIT',
        confidence: 0,
        reason:
          'Chart candles were not detected clearly enough.'
      };
    }

    if (brightness < 15) {
      return {
        signal: 'WAIT',
        confidence: 0,
        reason:
          'Captured image is too dark to analyze.'
      };
    }

    const strength =
      Math.abs(balance);

    const consistency =
      observations.filter(
        (item) =>
          Math.sign(
            item.directionalBalance
          ) === Math.sign(balance)
      ).length /
      observations.length;

    const confidence = clamp(
      Math.round(
        50 +
          strength * 35 +
          consistency * 15
      ),
      0,
      85
    );

    if (
      strength < 0.18 ||
      consistency < 0.55
    ) {
      return {
        signal: 'WAIT',
        confidence: Math.min(
          confidence,
          55
        ),
        reason:
          'The visible chart does not provide a sufficiently clear direction.'
      };
    }

    return {
      signal:
        balance > 0
          ? 'UP'
          : 'DOWN',

      confidence,

      reason:
        `Visual scan completed. ` +
        `Candle-color balance=${balance.toFixed(2)}, ` +
        `activity=${activity.toFixed(3)}, ` +
        `motion=${motion.toFixed(3)}.`
    };
  }

  function addHistory(
    signal,
    confidence
  ) {
    if (signal === 'WAIT') return;

    history.unshift({
      asset:
        assetSelect
          ? assetSelect.value
          : 'AUTO',

      signal,

      confidence,

      time:
        new Date().toLocaleTimeString()
    });

    history =
      history.slice(
        0,
        MAX_HISTORY
      );

    renderHistory();
  }

  function renderHistory() {
    setText(
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
              <span>${escapeHtml(item.asset)}</span>
              <strong class="history-${item.signal.toLowerCase()}">
                ${item.signal}
              </strong>
              <small>${escapeHtml(item.time)}</small>
            </div>
          `
        )
        .join('');
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll(
        '&',
        '&amp;'
      )
      .replaceAll(
        '<',
        '&lt;'
      )
      .replaceAll(
        '>',
        '&gt;'
      )
      .replaceAll(
        '"',
        '&quot;'
      )
      .replaceAll(
        "'",
        '&#039;'
      );
  }

  function clearTimers() {
    if (scanTimer) {
      clearTimeout(scanTimer);
    }

    if (countdownTimer) {
      clearInterval(
        countdownTimer
      );
    }

    scanTimer = null;
    countdownTimer = null;
  }

  function finishScan(
    message = 'Scan finished.'
  ) {
    scanning = false;

    clearTimers();

    stopStream();

    previousFrame = null;

    if (scanButton) {
      scanButton.disabled = false;
    }

    setMode('READY');

    if (message) {
      setText(
        messageEl,
        message
      );
    }
  }

  function startCountdown(seconds) {
    let remaining = seconds;

    const update = () => {
      setText(
        messageEl,
        `Signal window: ${remaining}s remaining.`
      );

      remaining -= 1;

      if (remaining < 0) {
        clearInterval(
          countdownTimer
        );
      }
    };

    update();

    countdownTimer =
      setInterval(
        update,
        1000
      );
  }

  async function scanMarket() {
    if (scanning) return;

    scanning = true;

    clearTimers();

    previousFrame = null;

    if (scanButton) {
      scanButton.disabled = true;
    }

    setMode('SCREEN SCAN');

    setSignal(
      'WAIT',
      null,
      'Choose the Quotex/chart screen when the browser asks for screen sharing.'
    );

    try {
      await requestScreen();

      const observations = [];

      const startedAt =
        performance.now();

      const scanLength =
        Math.max(
          2500,
          Math.min(
            8000,
            getDuration() * 1000
          )
        );

      const collect = () => {
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

        if (
          performance.now() -
            startedAt >=
          scanLength
        ) {
          const result =
            combineObservations(
              observations
            );

          setSignal(
            result.signal,
            result.confidence,
            result.reason
          );

          addHistory(
            result.signal,
            result.confidence
          );

          setMode(
            result.signal ===
              'WAIT'
              ? 'WAIT'
              : 'ANALYZED'
          );

          startCountdown(
            getDuration()
          );

          scanTimer =
            setTimeout(
              () =>
                finishScan(
                  'Scan complete. Press SCAN to analyze again.'
                ),
              getDuration() * 1000
            );

          return;
        }

        scanTimer =
          setTimeout(
            collect,
            350
          );
      };

      collect();

    } catch (error) {
      console.error(error);

      setSignal(
        'WAIT',
        null,
        error &&
        error.message
          ? error.message
          : 'Screen scan could not be started.'
      );

      finishScan();
    }
  }

  if (assetSelect) {
    assetSelect.addEventListener(
      'change',
      () => {
        if (!scanning) {
          setSignal(
            'NO SIGNAL',
            null,
            'Press SCAN to analyze the selected chart.'
          );
        }
      }
    );
  }

  if (scanButton) {
    scanButton.addEventListener(
      'click',
      scanMarket
    );
  }

  initDurationButtons();

  renderHistory();

  setMode('READY');

  setSignal(
    'NO SIGNAL',
    null,
    'Press SCAN to analyze the selected chart.'
  );
})();
