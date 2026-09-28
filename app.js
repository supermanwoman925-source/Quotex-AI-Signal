// ==========================================
// Quotex AI Signal - Prototype
// STEP 3: Scan + Demo Analysis + History
// ==========================================

const assetSelect = document.getElementById("asset");
const scanButton = document.getElementById("scan-button");

const signalElement = document.getElementById("signal");
const signalIcon = document.getElementById("signal-icon");
const signalMessage = document.getElementById("signal-message");

const confidenceValue = document.getElementById("confidence-value");
const confidenceFill = document.getElementById("confidence-fill");

const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");


// ------------------------------------------
// Application State
// ------------------------------------------

let signalHistory = [];


// ------------------------------------------
// Demo Candle Generator
// ------------------------------------------

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


// ------------------------------------------
// Basic Technical Analysis
// ------------------------------------------

function analyzeCandles(candles) {

    if (!candles || candles.length < 5) {

        return {
            signal: "NO SIGNAL",
            confidence: 0,
            reason: "Insufficient candle data."
        };
    }


    const recent = candles.slice(-5);


    let bullish = 0;
    let bearish = 0;


    recent.forEach(candle => {

        if (candle.close > candle.open) {
            bullish++;
        }

        if (candle.close < candle.open) {
            bearish++;
        }

    });


    const lastCandle =
        candles[candles.length - 1];


    let signal = "NO SIGNAL";
    let confidence = 0;
    let reason =
        "Market conditions are unclear.";


    // --------------------------------------
    // Simple demo decision logic
    // --------------------------------------

    if (bullish >= 4) {

        signal = "UP";
        confidence = 70 + Math.floor(Math.random() * 16);

        reason =
            "Recent demo candles show bullish momentum.";

    }
    else if (bearish >= 4) {

        signal = "DOWN";
        confidence = 70 + Math.floor(Math.random() * 16);

        reason =
            "Recent demo candles show bearish momentum.";

    }
    else {

        signal = "NO SIGNAL";
        confidence = 0;

        reason =
            "No sufficiently clear direction detected.";

    }


    return {
        signal: signal,
        confidence: confidence,
        reason: reason,
        lastCandle: lastCandle
    };
}


// ------------------------------------------
// Update Signal Display
// ------------------------------------------

function displaySignal(result) {

    signalElement.className = "signal";

    if (result.signal === "UP") {

        signalElement.classList.add("up");

        signalElement.textContent = "UP";

        signalIcon.textContent = "⬆";

    }
    else if (result.signal === "DOWN") {

        signalElement.classList.add("down");

        signalElement.textContent = "DOWN";

        signalIcon.textContent = "⬇";

    }
    else {

        signalElement.classList.add("neutral");

        signalElement.textContent =
            "NO SIGNAL";

        signalIcon.textContent = "—";
    }


    confidenceValue.textContent =
        result.confidence > 0
            ? result.confidence + "%"
            : "—";


    confidenceFill.style.width =
        result.confidence + "%";


    signalMessage.textContent =
        result.reason;
}


// ------------------------------------------
// Add Signal To History
// ------------------------------------------

function addToHistory(result, asset) {

    if (result.signal === "NO SIGNAL") {
        return;
    }


    const record = {

        asset: asset,

        signal: result.signal,

        confidence: result.confidence,

        time: new Date().toLocaleTimeString()

    };


    signalHistory.unshift(record);


    // Keep last 20 signals only

    if (signalHistory.length > 20) {

        signalHistory =
            signalHistory.slice(0, 20);
    }


    renderHistory();
}


// ------------------------------------------
// Render History
// ------------------------------------------

function renderHistory() {

    historyCount.textContent =
        signalHistory.length;


    if (signalHistory.length === 0) {

        historyList.innerHTML = `
            <p class="empty-history">
                No signals recorded yet.
            </p>
        `;

        return;
    }


    historyList.innerHTML =
        signalHistory.map(record => {

            const signalClass =
                record.signal.toLowerCase();

            return `
                <div class="history-item">

                    <div>
                        <div class="history-asset">
                            ${record.asset}
                        </div>

                        <div class="history-time">
                            ${record.time}
                        </div>
                    </div>

                    <div
                        class="history-signal ${signalClass}"
                    >
                        ${record.signal}
                        ${record.confidence}%
                    </div>

                </div>
            `;

        }).join("");
}


// ------------------------------------------
// Scan Market
// ------------------------------------------

function scanMarket() {

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


    // Simulate analysis time

    setTimeout(() => {

        const selectedAsset =
            assetSelect.value;


        const candles =
            generateDemoCandles(30);


        const result =
            analyzeCandles(candles);


        displaySignal(result);


        addToHistory(
            result,
            selectedAsset
        );


        scanButton.disabled = false;

        scanButton.textContent =
            "SCAN MARKET";

    }, 1200);
}


// ------------------------------------------
// Scan Button Event
// ------------------------------------------

scanButton.addEventListener(
    "click",
    scanMarket
);


// ------------------------------------------
// Asset Change
// ------------------------------------------

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


// ------------------------------------------
// Initial State
// ------------------------------------------

renderHistory();

console.log(
    "Quotex AI Signal prototype loaded."
);
