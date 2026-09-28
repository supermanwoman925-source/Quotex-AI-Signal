// ======================================================
// Quotex AI Signal
// Demo Analysis Engine
// ======================================================

const assetSelect = document.getElementById("asset");
const scanButton = document.getElementById("scan-button");

const signalElement = document.getElementById("signal");
const signalIcon = document.getElementById("signal-icon");
const signalMessage = document.getElementById("signal-message");

const confidenceValue = document.getElementById("confidence-value");
const confidenceFill = document.getElementById("confidence-fill");

const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");


// ======================================================
// APPLICATION STATE
// ======================================================

let signalHistory = [];


// ======================================================
// DEMO CANDLE GENERATOR
// ======================================================

function generateDemoCandles(count = 30) {

    const candles = [];

    let price = 100;

    for (let i = 0; i < count; i++) {

        const open = price;

        const movement =
            (Math.random() - 0.5) * 2;

        const close =
            open + movement;

        const high =
            Math.max(open, close) +
            Math.random() * 0.5;

        const low =
            Math.min(open, close) -
            Math.random() * 0.5;

        candles.push({
            open: open,
            high: high,
            low: low,
            close: close
        });

        price = close;
    }

    return candles;
}


// ======================================================
// BASIC TECHNICAL ANALYSIS
// ======================================================

function calculateEMA(values, period) {

    if (values.length < period) {
        return null;
    }

    const multiplier =
        2 / (period + 1);

    let ema = values
        .slice(0, period)
        .reduce((sum, value) => sum + value, 0) / period;

    for (let i = period; i < values.length; i++) {

        ema =
            (values[i] - ema) * multiplier + ema;
    }

    return ema;
}


function calculateRSI(candles, period = 14) {

    if (candles.length <= period) {
        return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = candles.length - period; i < candles.length; i++) {

        const previous =
            candles[i - 1].close;

        const current =
            candles[i].close;

        const change =
            current - previous;

        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    if (losses === 0) {
        return 100;
    }

    const averageGain =
        gains / period;

    const averageLoss =
        losses / period;

    const relativeStrength =
        averageGain / averageLoss;

    return 100 -
        (100 / (1 + relativeStrength));
}


// ======================================================
// CANDLE MOMENTUM
// ======================================================

function calculateMomentum(candles) {

    if (candles.length < 5) {
        return 0;
    }

    const latest =
        candles[candles.length - 1].close;

    const previous =
        candles[candles.length - 5].close;

    return latest - previous;
}


// ======================================================
// SIGNAL ANALYSIS
// ======================================================

function analyzeCandles(candles) {

    if (!candles || candles.length < 15) {

        return {
            signal: "NO SIGNAL",
            confidence: 0,
            message: "Not enough candle data."
        };
    }

    const closes =
        candles.map(candle => candle.close);

    const ema =
        calculateEMA(closes, 9);

    const rsi =
        calculateRSI(candles, 14);

    const momentum =
        calculateMomentum(candles);

    const latestClose =
        closes[closes.length - 1];

    let upScore = 0;
    let downScore = 0;

    // EMA direction
    if (ema !== null) {

        if (latestClose > ema) {
            upScore++;
        }

        if (latestClose < ema) {
            downScore++;
        }
    }

    // RSI
    if (rsi !== null) {

        if (rsi > 50 && rsi < 70) {
            upScore++;
        }

        if (rsi < 50 && rsi > 30) {
            downScore++;
        }
    }

    // Momentum
    if (momentum > 0) {
        upScore++;
    }

    if (momentum < 0) {
        downScore++;
    }

    const totalScore =
        upScore + downScore;

    if (totalScore === 0) {

        return {
            signal: "NO SIGNAL",
            confidence: 0,
            message: "Market conditions are unclear."
        };
    }

    if (upScore > downScore) {

        const confidence =
            Math.round(
                55 + (upScore * 8)
            );

        return {
            signal: "UP",
            confidence: Math.min(confidence, 85),
            message:
                "Demo analysis shows bullish momentum."
        };
    }

    if (downScore > upScore) {

        const confidence =
            Math.round(
                55 + (downScore * 8)
            );

        return {
            signal: "DOWN",
            confidence: Math.min(confidence, 85),
            message:
                "Demo analysis shows bearish momentum."
        };
    }

    return {
        signal: "NO SIGNAL",
        confidence: 0,
        message:
            "Signals are mixed. WAIT."
    };
}


// ======================================================
// DISPLAY SIGNAL
// ======================================================

function displaySignal(result) {

    signalElement.className =
        "signal neutral";

    signalIcon.textContent = "—";

    confidenceValue.textContent = "—";

    confidenceFill.style.width = "0%";

    if (result.signal === "UP") {

        signalElement.className =
            "signal up";

        signalElement.textContent =
            "UP";

        signalIcon.textContent =
            "↑";

        confidenceValue.textContent =
            result.confidence + "%";

        confidenceFill.style.width =
            result.confidence + "%";

        signalMessage.textContent =
            result.message;

        return;
    }

    if (result.signal === "DOWN") {

        signalElement.className =
            "signal down";

        signalElement.textContent =
            "DOWN";

        signalIcon.textContent =
            "↓";

        confidenceValue.textContent =
            result.confidence + "%";

        confidenceFill.style.width =
            result.confidence + "%";

        signalMessage.textContent =
            result.message;

        return;
    }

    signalElement.textContent =
        "NO SIGNAL";

    signalMessage.textContent =
        result.message;
}


// ======================================================
// HISTORY
// ======================================================

function addHistory(result, asset) {

    if (result.signal === "NO SIGNAL") {
        return;
    }

    const item = {
        asset: asset,
        signal: result.signal,
        time: new Date().toLocaleTimeString()
    };

    signalHistory.unshift(item);

    if (signalHistory.length > 10) {
        signalHistory.pop();
    }

    renderHistory();
}


function renderHistory() {

    historyCount.textContent =
        signalHistory.length;

    if (signalHistory.length === 0) {

        historyList.innerHTML =
            '<p class="empty-history">No signals recorded yet.</p>';

        return;
    }

    historyList.innerHTML =
        signalHistory.map(item => {

            const signalClass =
                item.signal === "UP"
                    ? "up"
                    : "down";

            return `
                <div class="history-item">

                    <span class="history-asset">
                        ${item.asset}
                    </span>

                    <span class="history-signal ${signalClass}">
                        ${item.signal}
                    </span>

                    <span class="history-time">
                        ${item.time}
                    </span>

                </div>
            `;

        }).join("");
}


// ======================================================
// SCAN MARKET
// ======================================================

function scanMarket() {

    const selectedAsset =
        assetSelect.value;

    scanButton.disabled = true;

    scanButton.textContent =
        "ANALYZING...";

    signalElement.className =
        "signal neutral";

    signalElement.textContent =
        "ANALYZING";

    signalIcon.textContent =
        "⟳";

    signalMessage.textContent =
        "Analyzing demo candle data...";

    confidenceValue.textContent =
        "—";

    confidenceFill.style.width =
        "0%";


    setTimeout(() => {

        const candles =
            generateDemoCandles(30);

        const result =
            analyzeCandles(candles);

        displaySignal(result);

        addHistory(
            result,
            selectedAsset
        );

        scanButton.disabled = false;

        scanButton.textContent =
            "SCAN MARKET";

    }, 1200);
}


// ======================================================
// SCAN BUTTON EVENT
// ======================================================

scanButton.addEventListener(
    "click",
    scanMarket
);


// ======================================================
// ASSET CHANGE
// ======================================================

assetSelect.addEventListener(
    "change",
    () => {

        signalElement.className =
            "signal neutral";

        signalElement.textContent =
            "NO SIGNAL";

        signalIcon.textContent =
            "—";

        signalMessage.textContent =
            "Press SCAN to analyze the selected asset.";

        confidenceValue.textContent =
            "—";

        confidenceFill.style.width =
            "0%";
    }
);


// ======================================================
// INITIAL STATE
// ======================================================

renderHistory();

console.log(
    "Quotex AI Signal loaded successfully."
);
