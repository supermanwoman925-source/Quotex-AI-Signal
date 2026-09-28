// ======================================================
// Quotex AI Signal - Prototype
// STEP 4: Signal Duration + Countdown
// DEMO MODE ONLY
// ======================================================


// ======================================================
// DOM ELEMENTS
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

const durationButtons = document.querySelectorAll(
    ".timeframe[data-duration]"
);


// ======================================================
// APPLICATION STATE
// ======================================================

let signalHistory = [];

let selectedDuration = 5;

let countdownTimer = null;


// ======================================================
// DURATION BUTTONS
// ======================================================

durationButtons.forEach((button) => {

    button.addEventListener("click", () => {

        durationButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        selectedDuration = Number(
            button.dataset.duration
        );

        resetSignal();

        signalMessage.textContent =
            `Signal duration selected: ${selectedDuration}s. Press SCAN to analyze.`;

    });

});


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
// BASIC DEMO TECHNICAL ANALYSIS
// ======================================================

function analyzeCandles(candles) {

    if (!candles || candles.length < 5) {

        return {
            signal: "NO SIGNAL",
            confidence: 0,
            icon: "—",
            message: "Not enough demo candle data."
        };

    }


    const last =
        candles[candles.length - 1];

    const previous =
        candles[candles.length - 2];


    const priceChange =
        last.close - previous.close;


    let signal;
    let icon;
    let confidence;


    if (priceChange > 0) {

        signal = "UP";
        icon = "▲";

        confidence =
            Math.floor(
