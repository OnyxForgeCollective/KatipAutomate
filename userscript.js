// ==UserScript==
// @name         <<KatipAutomate>>
// @namespace    http://tampermonkey.net/
// @version      v2.7
// @description  Katiponline sitesi için oluşturulan robotize yazım scripti.
// @author       OnyxForgeCollective
// @match        *://*.katiponline.xyz/*
// @match        *://*.katiponline.com/*
// @grant        GM_addStyle
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/OnyxForgeCollective/KatipAutomate/main/userscript.js
// @downloadURL  https://raw.githubusercontent.com/OnyxForgeCollective/KatipAutomate/main/userscript.js
// ==/UserScript==

(function() {
    'use strict';

    // --- AYARLAR ---
    // Migrate old mistake mode values from previous versions
    (function migrateOldMistakeMode() {
        const old = localStorage.getItem('katip-mistake-mode');
        if (old === 'basic' || old === 'advanced') localStorage.setItem('katip-mistake-mode', 'rate');
        else if (old === 'custom') localStorage.setItem('katip-mistake-mode', 'chance');
    })();

    const config = {
        active: false,
        delay: parseInt(localStorage.getItem('katip-speed')) || 120,
        debug: true,
        panelMinimized: localStorage.getItem('katip-panel-minimized') === 'true',
        wordLimitEnabled: localStorage.getItem('katip-word-limit-enabled') === 'true',
        wordLimit: parseInt(localStorage.getItem('katip-word-limit')) || 50,
        infoExpanded: false,
        humanLikeTyping: localStorage.getItem('katip-human-like') === 'true',
        autoCorrectEnabled: localStorage.getItem('katip-auto-correct') === 'true',
        autoNextLesson: localStorage.getItem('katip-auto-next') === 'true',
        // --- Hata Sistemi ---
        mistakeModeEnabled: localStorage.getItem('katip-mistake-mode-enabled') === 'true',
        mistakeEveryWords: parseInt(localStorage.getItem('katip-mistake-every-words')) || 5,
        mistakeChance: parseInt(localStorage.getItem('katip-mistake-chance')) || 30,
        mistakeClearChance: parseInt(localStorage.getItem('katip-mistake-clear-chance')) || 70,

        // --- UI Settings ---
        panelTop: localStorage.getItem('katip-panel-top') || '50px',
        panelLeft: localStorage.getItem('katip-panel-left') || '0px'
    };

    // --- İSTATİSTİKLER ---
    const stats = {
        startTime: null,
        totalChars: 0,
        totalWords: 0,
        currentWPM: 0,
        estimatedWPM: 0,
        updateInterval: null,
        lastWord: '',
        lastWordCorrect: true,
        // Mistake analytics
        mistakeHistory: [],    // {word, mistakeType, corrected, timestamp} - last 50
        wordHistory: [],       // {word, hadMistake, mistakeType, corrected} - last 30
        totalMistakes: 0,
        correctedMistakes: 0,
        mistakeWordCount: 0,   // completed-word count used by shouldMakeMistake
    };

    const logger = (msg, type = 'info') => {
        if (!config.debug) return;
        const prefix = '[KATIP-BOT] ';
        if (type === 'error') console.error(prefix + msg);
        else if (type === 'warn') console.warn(prefix + msg);
        else console.log(prefix + msg);
    };

    // Use MessageChannel instead of setTimeout so timing works in background tabs
    // (Chrome throttles setTimeout to >=1000ms in background; MessageChannel is not throttled)
    const sleep = (ms) => {
        if (ms <= 0) return Promise.resolve();
        return new Promise(resolve => {
            const channel = new MessageChannel();
            const deadline = performance.now() + ms;
            function tick() {
                if (performance.now() >= deadline) {
                    resolve();
                } else {
                    channel.port2.postMessage(null);
                }
            }
            channel.port1.onmessage = tick;
            channel.port2.postMessage(null);
        });
    };

    // --- DYNAMIC DELAY CALIBRATION ---
    let dynamicDelayOffset = 0; // The adjustment (in ms) to apply to keep WPM on track

    function calibrateDelay() {
        if (!stats.startTime || stats.totalWords < 2) return;

        // Saniyede kelime hedefi
        const targetWPM = stats.estimatedWPM;
        const actualWPM = stats.currentWPM;

        if (targetWPM <= 0 || actualWPM <= 0) return;

        // Eger gercek hizimiz hedeften %5 den fazla sapmissa, delay i ayarlayalim
        const ratio = actualWPM / targetWPM;

        if (ratio < 0.95) {
            // Cok yavas yaziyoruz, hizlanalim (offseti azalt)
            dynamicDelayOffset -= 2;
        } else if (ratio > 1.05) {
            // Cok hizli yaziyoruz, yavaslayalim (offseti artir)
            dynamicDelayOffset += 2;
        }

        // Limit the offset to avoid going too extreme
        const maxOffset = config.delay * 0.8;
        dynamicDelayOffset = Math.max(-maxOffset, Math.min(maxOffset, dynamicDelayOffset));
    }

    // --- HUMAN-LIKE TYPING FUNCTIONS ---
    function getHumanLikeDelay() {
        // Base delay adjusted by dynamic calibration
        const calibratedBaseDelay = Math.max(1, config.delay + dynamicDelayOffset);

        if (!config.humanLikeTyping) return calibratedBaseDelay;
        
        // Add random variation to delay (±20%)
        const variation = calibratedBaseDelay * 0.2;
        const randomDelay = calibratedBaseDelay + (Math.random() * variation * 2 - variation);
        return Math.max(1, Math.round(randomDelay));
    }

    function shouldAddRandomPause() {
        // 5% chance to add a longer pause (simulating thinking)
        return config.humanLikeTyping && Math.random() < 0.05;
    }

    function getRandomPauseDelay() {
        // Random pause between 200-800ms
        return 200 + Math.random() * 600;
    }

    // --- MISTAKE GENERATION FUNCTIONS ---
    const typoMap = {
        'a': ['s', 'q', 'z'],
        'b': ['v', 'n', 'g'],
        'c': ['x', 'v', 'd'],
        'd': ['s', 'f', 'e'],
        'e': ['w', 'r', 'd'],
        'f': ['d', 'g', 'r'],
        'g': ['f', 'h', 't'],
        'h': ['g', 'j', 'y'],
        'i': ['u', 'o', 'k'],
        'j': ['h', 'k', 'u'],
        'k': ['j', 'l', 'i'],
        'l': ['k', 'o'],
        'm': ['n', 'j'],
        'n': ['b', 'm', 'h'],
        'o': ['i', 'p', 'l'],
        'p': ['o', 'l'],
        'q': ['w', 'a'],
        'r': ['e', 't', 'f'],
        's': ['a', 'd', 'w'],
        't': ['r', 'y', 'g'],
        'u': ['y', 'i', 'j'],
        'v': ['c', 'b', 'f'],
        'w': ['q', 'e', 's'],
        'x': ['z', 'c', 's'],
        'y': ['t', 'u', 'h'],
        'z': ['a', 'x'],
        // Turkish keyboard characters
        'ş': ['s', 'z', 'a'],
        'ğ': ['g', 'f', 'h'],
        'ü': ['u', 'i', 'y'],
        'ö': ['o', 'p', 'l'],
        'ç': ['c', 'x', 'v'],
        'ı': ['i', 'u', 'o'],
    };

    function generateTypo(char) {
        const lowerChar = char.toLowerCase();
        const typos = typoMap[lowerChar];
        if (!typos || typos.length === 0) return char;
        
        const typo = typos[Math.floor(Math.random() * typos.length)];
        return char === char.toUpperCase() ? typo.toUpperCase() : typo;
    }

    function getMistakeType() {
        // Weights: typo most frequent, then double, transposition, skip
        const types = ['typo', 'typo', 'typo', 'double', 'transposition', 'skip'];
        return types[Math.floor(Math.random() * types.length)];
    }

    // Minimum word length needed to attempt a meaningful mistake
    const MIN_WORD_LEN_FOR_MISTAKE = 3;

    /**
     * Central mistake-trigger decision based on the new single-logic configuration.
     * @param {number} wordCount  – number of fully-completed words so far
     * @returns {boolean}
     */
    function shouldMakeMistake(wordCount) {
        if (!config.mistakeModeEnabled) return false;

        // "Her X kelimede bir" kontrolü
        if ((wordCount + 1) % config.mistakeEveryWords === 0) {
            // "%Y ihtimalle" kontrolü
            return Math.random() * 100 < config.mistakeChance;
        }
        return false;
    }

    async function doTypoMistake(element, word, pos) {
        for (let i = 0; i < pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        if (!config.active) return true;
        const typo = generateTypo(word[pos]);
        simulateKey(element, typo);
        await sleep(getHumanLikeDelay());
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        if (shouldCorrect) {
            // Notice the mistake, then backspace and retype
            await sleep(200 + Math.random() * 300);
            const deleteCount = Math.min(config.mistakeDeleteCount, pos + 1);
            for (let i = 0; i < deleteCount; i++) {
                if (!config.active) return shouldCorrect;
                simulateBackspace(element);
                await sleep(getHumanLikeDelay());
            }
            // Retype the characters we deleted
            const startPos = Math.max(0, pos - deleteCount + 1);
            for (let i = startPos; i <= pos; i++) {
                if (!config.active) return shouldCorrect;
                simulateKey(element, word[i]);
                await sleep(getHumanLikeDelay());
            }
        }
        for (let i = pos + 1; i < word.length; i++) {
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        return shouldCorrect;
    }

    async function doTranspositionMistake(element, word, pos) {
        // Type chars before pos
        for (let i = 0; i < pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        // Swap: type word[pos+1] before word[pos]
        if (!config.active) return true;
        simulateKey(element, word[pos + 1]);
        await sleep(getHumanLikeDelay());
        if (!config.active) return true;
        simulateKey(element, word[pos]);
        await sleep(getHumanLikeDelay());
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        if (shouldCorrect) {
            await sleep(150 + Math.random() * 200);
            if (!config.active) return shouldCorrect;
            simulateBackspace(element);
            await sleep(getHumanLikeDelay());
            if (!config.active) return shouldCorrect;
            simulateBackspace(element);
            await sleep(getHumanLikeDelay());
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[pos]);
            await sleep(getHumanLikeDelay());
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[pos + 1]);
            await sleep(getHumanLikeDelay());
        }
        for (let i = pos + 2; i < word.length; i++) {
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        return shouldCorrect;
    }

    async function doDoubleMistake(element, word, pos) {
        // Type word[0..pos] normally
        for (let i = 0; i <= pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        // Type word[pos] a second time (double-key)
        if (!config.active) return true;
        simulateKey(element, word[pos]);
        await sleep(getHumanLikeDelay());
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        if (shouldCorrect) {
            await sleep(150 + Math.random() * 200);
            if (!config.active) return shouldCorrect;
            simulateBackspace(element);
            await sleep(getHumanLikeDelay());
        }
        for (let i = pos + 1; i < word.length; i++) {
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        return shouldCorrect;
    }

    async function doSkipMistake(element, word, pos) {
        // Type chars before pos
        for (let i = 0; i < pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        if (pos + 1 < word.length) {
            // Accidentally type word[pos+1] first (skip pos)
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[pos + 1]);
            await sleep(getHumanLikeDelay());
            if (shouldCorrect) {
                await sleep(150 + Math.random() * 200);
                if (!config.active) return shouldCorrect;
                simulateBackspace(element);
                await sleep(getHumanLikeDelay());
                // Insert the skipped char, then re-type the one we just backspaced
                if (!config.active) return shouldCorrect;
                simulateKey(element, word[pos]);
                await sleep(getHumanLikeDelay());
                if (!config.active) return shouldCorrect;
                simulateKey(element, word[pos + 1]);
                await sleep(getHumanLikeDelay());
                for (let i = pos + 2; i < word.length; i++) {
                    if (!config.active) return shouldCorrect;
                    simulateKey(element, word[i]);
                    await sleep(getHumanLikeDelay());
                }
            } else {
                for (let i = pos + 2; i < word.length; i++) {
                    if (!config.active) return shouldCorrect;
                    simulateKey(element, word[i]);
                    await sleep(getHumanLikeDelay());
                }
            }
        } else {
            // pos is last char; just skip it (uncorrectable edge case)
        }
        return shouldCorrect;
    }

    async function typeWithMistake(element, word) {
        // Don't attempt mistakes on very short words
        if (word.length < MIN_WORD_LEN_FOR_MISTAKE) {
            for (let i = 0; i < word.length; i++) {
                simulateKey(element, word[i]);
                await sleep(getHumanLikeDelay());
            }
            return true;
        }

        const rawType = getMistakeType();
        const pos = Math.floor(Math.random() * (word.length - 2)) + 1;
        // transposition needs pos+1 to be in-bounds; fall back to typo if not
        const mistakeType = (rawType === 'transposition' && pos + 1 >= word.length) ? 'typo' : rawType;

        let corrected;
        switch (mistakeType) {
            case 'transposition': corrected = await doTranspositionMistake(element, word, pos); break;
            case 'double':        corrected = await doDoubleMistake(element, word, pos);        break;
            case 'skip':          corrected = await doSkipMistake(element, word, pos);          break;
            default:              corrected = await doTypoMistake(element, word, pos);          break;
        }

        // Record the mistake
        stats.totalMistakes++;
        if (corrected) stats.correctedMistakes++;
        stats.mistakeHistory.push({ word, mistakeType, corrected, timestamp: Date.now() });
        if (stats.mistakeHistory.length > 50) stats.mistakeHistory.shift();

        return corrected;
    }

    function simulateBackspace(element) {
        if (!element) return;

        const eventObj = {
            key: 'Backspace',
            code: 'Backspace',
            keyCode: 8,
            which: 8,
            bubbles: true,
            cancelable: true
        };

        element.dispatchEvent(new KeyboardEvent('keydown', eventObj));
        element.dispatchEvent(new KeyboardEvent('keypress', eventObj));

        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(element), "value"
            );
            if (nativeSetter && nativeSetter.set) {
                nativeSetter.set.call(element, element.value.slice(0, -1));
            } else {
                element.value = element.value.slice(0, -1);
            }
        } else {
            element.textContent = element.textContent.slice(0, -1);
        }

        element.dispatchEvent(new InputEvent('input', { data: null, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', eventObj));
    }

    // --- İSTATİSTİK FONKSİYONLARI ---
    let lastCharWasSpace = true; // Start as true so first word counts properly

    // --- HATA ANALİZİ YARDIMCILARI ---
    function getMistakeTypeName(type) {
        const names = {
            'typo':          'yanlış tuş',
            'transposition': 'harf yer değiştirme',
            'double':        'çift harf',
            'skip':          'harf atlama',
        };
        return names[type] || type;
    }

    function generateMistakeInsight() {
        const history = stats.wordHistory;
        if (history.length === 0) {
            return '<em>Bot başlatıldığında hata analizi burada görünecek.</em>';
        }
        const recent = history.slice(-10);
        const recentMistakes = recent.filter(w => w.hadMistake);
        const mistakeRate = recent.length > 0 ? recentMistakes.length / recent.length : 0;

        if (recentMistakes.length === 0) {
            return `✅ Son ${recent.length} kelimede hiç hata yok. Harika performans!`;
        }

        // Most common mistake type in recent history
        const typeCounts = {};
        stats.mistakeHistory.slice(-20).forEach(m => {
            typeCounts[m.mistakeType] = (typeCounts[m.mistakeType] || 0) + 1;
        });
        const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
        const correctionRate = stats.totalMistakes > 0
            ? Math.round(stats.correctedMistakes / stats.totalMistakes * 100)
            : 0;

        const sev = mistakeRate < 0.15 ? '💛' : mistakeRate < 0.35 ? '🟠' : '🔴';
        let text = `${sev} Son ${recent.length} kelimede <strong>${recentMistakes.length} hata</strong> (%${Math.round(mistakeRate * 100)}). `;
        if (topType) {
            text += `En sık: <strong>${getMistakeTypeName(topType[0])}</strong>. `;
        }
        if (stats.totalMistakes > 0) {
            text += `Düzeltme oranı: <strong>%${correctionRate}</strong>.`;
        }
        if (config.mistakeModeEnabled) {
            text += ` Hata konfigürasyonu devrede (Her ${config.mistakeEveryWords} kelimede %${config.mistakeChance}).`;
        }
        return text;
    }

    function updateMistakeChart() {
        // Obsolete function since UI was completely redesigned, leaving it empty
        // to avoid reference errors if it's called anywhere else.
    }

    function updateStats(char) {
        stats.totalChars++;
        
        // Count words properly: increment when transitioning from space to non-space
        const isSpace = (char === ' ' || char === '\n' || char === '\t');
        if (!isSpace && lastCharWasSpace) {
            stats.totalWords++;
            
            // Check if word limit is reached
            if (config.wordLimitEnabled && stats.totalWords >= config.wordLimit) {
                logger(`Kelime limiti ulaşıldı: ${stats.totalWords}/${config.wordLimit}`);
                setTimeout(() => stopBot(), 100); // Stop after current character is processed
            }
        }
        lastCharWasSpace = isSpace;

        if (stats.startTime) {
            const elapsedMinutes = (Date.now() - stats.startTime) / 60000;
            if (elapsedMinutes > 0) {
                stats.currentWPM = Math.round(stats.totalWords / elapsedMinutes);
            }
        }
    }

    function startStatsTracking() {
        stats.startTime = Date.now();
        stats.totalChars = 0;
        stats.totalWords = 0;
        stats.currentWPM = 0;
        stats.estimatedWPM = calculateEstimatedWPM();
        lastCharWasSpace = true; // Reset word boundary tracking
        // Reset mistake analytics
        stats.mistakeHistory = [];
        stats.wordHistory = [];
        stats.totalMistakes = 0;
        stats.correctedMistakes = 0;
        stats.mistakeWordCount = 0;

        // Her saniye istatistikleri güncelle
        if (stats.updateInterval) clearInterval(stats.updateInterval);
        stats.updateInterval = setInterval(() => {
            updateStatsDisplay();
            calibrateDelay();
        }, 1000);
    }

    // --- YENİ FONKSİYON: ANLIK TAHMİN ---
    function calculateEstimatedWPM() {
        // Validate delay to prevent division by zero
        if (!config.delay || config.delay < 1) {
            return 0;
        }
        // Ortalama kelime uzunluğu (İngilizce için ~5, Türkçe için ~6)
        const avgWordLength = 6;
        // Kelime arası boşluk
        const spaceChar = 1;
        // Ortalama kelime karakter sayısı (harf + boşluk)
        const avgCharsPerWord = avgWordLength + spaceChar;
        // Dakikadaki milisaniye
        const msPerMinute = 60000;
        // config.delay ms'de bir karakter yazılıyor
        const charsPerMinute = msPerMinute / config.delay;
        // Dakikadaki kelime sayısı
        const wordsPerMinute = Math.round(charsPerMinute / avgCharsPerWord);
        return wordsPerMinute;
    }

    function stopStatsTracking() {
        if (stats.updateInterval) {
            clearInterval(stats.updateInterval);
            stats.updateInterval = null;
        }
    }

    function updateStatsDisplay() {
        const FORECAST_THRESHOLD = 0.9; // 90% threshold for flashing
        const wpmCalculated = document.getElementById('wpm-calculated');
        const wpmEstimated = document.getElementById('wpm-estimated');
        const wordsWritten = document.getElementById('words-written');
        const wordsRemaining = document.getElementById('words-remaining');
        const wordsLimit = document.getElementById('words-limit');
        const wordSeparator = document.getElementById('word-separator');
        const lastWordDisplay = document.getElementById('last-word-display');
        const lastWordStatus = document.getElementById('last-word-status');
        const wordsWritten3min = document.getElementById('words-written-3min');
        const wordsWritten5min = document.getElementById('words-written-5min');
        const wordsWritten10min = document.getElementById('words-written-10min');
        const forecast3Est = document.getElementById('forecast-3min-est');
        const forecast5Est = document.getElementById('forecast-5min-est');
        const forecast10Est = document.getElementById('forecast-10min-est');
        const forecast3Box = document.getElementById('forecast-3min-box');
        const forecast5Box = document.getElementById('forecast-5min-box');
        const forecast10Box = document.getElementById('forecast-10min-box');
        
        // Taskbar compact stats elements
        const taskbarWpmCalculated = document.getElementById('taskbar-wpm-calculated');
        const taskbarWpmEstimated = document.getElementById('taskbar-wpm-estimated');
        const taskbarWordLimit = document.getElementById('taskbar-word-limit');
        const taskbarWordsWritten = document.getElementById('taskbar-words-written');
        const taskbarWordsLimit = document.getElementById('taskbar-words-limit');

        // Güncelleme sırasında tahmini yeniden hesapla
        stats.estimatedWPM = calculateEstimatedWPM();

        // Color coding based on WPM
        const calcWPM = stats.currentWPM || 0;
        const estWPM = stats.estimatedWPM || 0;
        
        // Function to get color and animation based on WPM
        function getWPMStyle(wpm) {
            if (wpm > 150) {
                return { color: '#ff3b30', animation: 'flash-red 0.5s infinite' };
            } else if (wpm > 120) {
                return { color: '#ff3b30', animation: 'none' };
            } else if (wpm > 80) {
                return { color: '#ffcc00', animation: 'flash-yellow 1s infinite' };
            } else {
                return { color: '#007aff', animation: 'none' };
            }
        }

        const calcStyle = getWPMStyle(calcWPM);
        const estStyle = getWPMStyle(estWPM);

        // Update main stats
        if (wpmCalculated) {
            wpmCalculated.innerText = calcWPM;
            wpmCalculated.style.color = calcStyle.color;
            wpmCalculated.style.animation = calcStyle.animation;
        }
        
        if (wpmEstimated) {
            wpmEstimated.innerText = estWPM;
            wpmEstimated.style.color = estStyle.color;
            wpmEstimated.style.animation = estStyle.animation;
        }
        
        // Update taskbar compact stats
        if (taskbarWpmCalculated) {
            taskbarWpmCalculated.innerText = calcWPM;
            taskbarWpmCalculated.style.color = calcStyle.color;
            taskbarWpmCalculated.style.animation = calcStyle.animation;
        }
        
        if (taskbarWpmEstimated) {
            taskbarWpmEstimated.innerText = estWPM;
            taskbarWpmEstimated.style.color = estStyle.color;
            taskbarWpmEstimated.style.animation = estStyle.animation;
        }
        
        // Update taskbar word limit display
        if (taskbarWordLimit) {
            if (config.wordLimitEnabled) {
                taskbarWordLimit.style.display = 'flex';
                if (taskbarWordsWritten) taskbarWordsWritten.innerText = stats.totalWords;
                if (taskbarWordsLimit) taskbarWordsLimit.innerText = config.wordLimit;
            } else {
                taskbarWordLimit.style.display = 'none';
            }
        }
        
        // Update word counter display
        if (wordsWritten) {
            wordsWritten.innerText = stats.totalWords;
        }
        
        if (wordSeparator && wordsRemaining && wordsLimit) {
            if (config.wordLimitEnabled) {
                const remaining = Math.max(0, config.wordLimit - stats.totalWords);
                wordsRemaining.innerText = remaining;
                wordsLimit.innerText = config.wordLimit;
                wordSeparator.style.display = 'inline';
            } else {
                wordSeparator.style.display = 'none';
            }
        }

        // Update forecast boxes
        const elapsedMinutes = stats.startTime ? (Date.now() - stats.startTime) / 60000 : 0;
        
        // Helper function to update forecast box with threshold check
        function updateForecastBox(displayElement, estElement, boxElement, minutes) {
            if (displayElement) {
                displayElement.innerText = stats.totalWords;
            }
            if (estElement) {
                const forecast = Math.round(stats.estimatedWPM * minutes);
                estElement.innerText = forecast;
                
                // Flash if above threshold
                if (boxElement && stats.totalWords > forecast * FORECAST_THRESHOLD) {
                    boxElement.style.animation = 'flash-orange 1s infinite';
                } else if (boxElement) {
                    boxElement.style.animation = 'none';
                }
            }
        }
        
        updateForecastBox(wordsWritten3min, forecast3Est, forecast3Box, 3);
        updateForecastBox(wordsWritten5min, forecast5Est, forecast5Box, 5);
        updateForecastBox(wordsWritten10min, forecast10Est, forecast10Box, 10);

        // Update last word display
        if (lastWordDisplay) {
            lastWordDisplay.innerText = stats.lastWord || '—';
        }
        if (lastWordStatus) {
            lastWordStatus.innerText = stats.lastWord ? (stats.lastWordCorrect ? '✓' : '✗') : '';
            lastWordStatus.style.color = stats.lastWordCorrect ? '#34c759' : '#ff3b30';
        }

        // Refresh mistake chart while stats panel is open
        updateMistakeChart();
    }

    // --- ELEMENT BULUCU (HTML Analizi) ---
    function findActiveElements() {
        // 1. DÜELLO ve SINAV MODU
        const allSources = Array.from(document.querySelectorAll('textarea[id^="yazialani-sinavmodu"]'));
        const allInputs = Array.from(document.querySelectorAll('textarea[id^="yazilan-metin-sinavmodu"]'));

        let sourceEl = allSources.find(el => el.offsetParent !== null);
        let inputEl = allInputs.find(el => el.offsetParent !== null);

        if (sourceEl && inputEl) {
            logger(`Düello/Sınav elemanları bulundu! Source ID: ${sourceEl.id}, Input ID: ${inputEl.id}`);
            return { source: sourceEl, input: inputEl, type: 'textarea' };
        }

        // 2. F/Q KELİME ÇALIŞMASI (F veya Q klavye ders modu)
        const lessonSource = document.querySelector('#fklavyemetni, #qklavyemetni');
        const lessonInput = document.querySelector('#yazialani');

        if (lessonSource && lessonInput) {
             logger(`Kelime Çalışması elemanları bulundu!`);
            return { source: lessonSource, input: lessonInput, type: 'lesson' };
        }

        // 3. HIZ TESTİ
        const testSource = document.querySelector('#yazialani-varsayilan');
        const testInput = document.querySelector('#yazilan-metin-varsayilan');

        if (testSource && testInput && testSource.offsetParent !== null) {
            logger(`Hız Testi elemanları bulundu!`);
            return { source: testSource, input: testInput, type: 'speedtest' };
        }

        logger('HİÇBİR YAZI ALANI BULUNAMADI! Lütfen sayfayı yenileyin veya pencerenin açılmasını bekleyin.', 'error');
        return null;
    }

    // --- TUŞ SİMÜLASYONU ---
    function simulateKey(element, char) {
        if (!element) return;

        const isSpace = (char === " " || char.charCodeAt(0) === 160);
        const key = isSpace ? ' ' : char;
        const keyCode = isSpace ? 32 : char.charCodeAt(0);

        const eventObj = {
            key: key,
            code: isSpace ? 'Space' : 'Key' + (char.toUpperCase()),
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        };

        // Tuş basma eventleri
        element.dispatchEvent(new KeyboardEvent('keydown', eventObj));
        element.dispatchEvent(new KeyboardEvent('keypress', eventObj));

        // Elementin türüne göre değer atama
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(element), "value"
            );
            if (nativeSetter && nativeSetter.set) {
                nativeSetter.set.call(element, element.value + key);
            } else {
                element.value += key;
            }
        } else {
            // Eğer element bir div veya span ise (contenteditable)
            element.textContent += key;
        }

        // Input ve tuş bırakma eventleri
        element.dispatchEvent(new InputEvent('input', { data: key, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', eventObj));

        // İstatistikleri güncelle
        updateStats(key);
    }

    // --- DÖNGÜ (DÜELLO & TEXTAREA) ---
    async function loopTextarea(elements) {
        const { source, input } = elements;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.focus();

        // ── Resume: derive position state from already-typed content ──────────────
        // wordCount = number of fully-completed words already in input.value.
        // A word is "complete" when it is followed by whitespace.
        let wordCount = 0;
        {
            const v = input.value;
            if (v) {
                const words = v.trim().split(/\s+/).filter(Boolean);
                wordCount = /\s$/.test(v) ? words.length : Math.max(0, words.length - 1);
                stats.totalWords = wordCount;
                stats.mistakeWordCount = wordCount;
            }
            // Fix lastCharWasSpace (startStatsTracking always resets it to true)
            if (v.length > 0) lastCharWasSpace = /\s/.test(v[v.length - 1]);
        }

        logger(`Döngü başlıyor – pos=${input.value.length}, tamamlanan kelime=${wordCount}`);

        while (config.active) {
            const sourceText = source.value;

            if (!sourceText) {
                await sleep(300);
                continue;
            }

            // ── Otomatik Hata Düzeltme Kontrolü ─────────────────────────────────────
            if (config.autoCorrectEnabled) {
                const currentVal = input.value;
                let errorFoundIndex = -1;

                // Metni baştan sona (veya mevcut input uzunluğuna kadar) kontrol et
                for (let i = 0; i < currentVal.length; i++) {
                    let expectedChar = sourceText[i];
                    if (expectedChar && expectedChar.charCodeAt(0) === 160) expectedChar = ' ';

                    if (currentVal[i] !== expectedChar) {
                        errorFoundIndex = i;
                        break;
                    }
                }

                if (errorFoundIndex !== -1) {
                    logger(`Hata tespit edildi, pozisyon: ${errorFoundIndex}. Siliniyor...`);
                    // Hataya kadar olan kısmı sil
                    const backspaceCount = currentVal.length - errorFoundIndex;
                    for (let j = 0; j < backspaceCount; j++) {
                        simulateBackspace(input);
                        await sleep(getHumanLikeDelay() * 0.5); // Silme işlemini biraz daha hızlı yap
                        if (!config.active) break;
                    }
                    continue; // Döngünün başına dönüp tekrar pozisyon kontrolü yap
                }
            }

            // ── Single source-of-truth cursor: always re-read length ──────────────
            const pos = input.value.length;

            // Guard: position must not exceed source length
            if (pos > sourceText.length) {
                logger(`UYARI: pozisyon (${pos}) kaynak uzunluğunu (${sourceText.length}) aşıyor – durduruluyor.`, 'warn');
                stopBot();
                break;
            }

            if (pos >= sourceText.length) {
                logger('Metin tamamlandı.');
                stopBot();
                break;
            }

            // Next character to type (convert non-breaking space to normal space)
            let ch = sourceText[pos];
            if (ch.charCodeAt(0) === 160) ch = ' ';
            const isSpace = /\s/.test(ch);

            // ── Word-boundary mistake trigger ─────────────────────────────────────
            // atWordStart: pos is the first character of a new word
            const atWordStart = pos === 0 || /\s/.test(sourceText[pos - 1]);

            if (!isSpace && atWordStart && shouldMakeMistake(wordCount)) {
                // Extract the full word starting at pos
                const word = sourceText.slice(pos).split(/[\s\n\t]/)[0];
                if (word.length >= MIN_WORD_LEN_FOR_MISTAKE) {
                    logger(`Hata yapılıyor: "${word}" (kelime #${wordCount + 1})`);
                    await typeWithMistake(input, word);

                    // ── Position snap ─────────────────────────────────────────────
                    // typeWithMistake may leave input.value.length off by ±1 for
                    // uncorrected double (+1) or skip (-1) mistakes.  Fix it here.
                    const targetLen = pos + word.length;
                    if (input.value.length !== targetLen) {
                        logger(`Pozisyon snap: ${input.value.length} → ${targetLen}`);
                        while (input.value.length > targetLen) {
                            simulateBackspace(input);
                        }
                        // For a short-fall, fill from sourceText (same position arithmetic)
                        while (input.value.length < targetLen && input.value.length < sourceText.length) {
                            // Type the character that SHOULD be at this position in the word
                            const fillIdx = input.value.length - pos; // index within `word`
                            simulateKey(input, fillIdx < word.length ? word[fillIdx] : sourceText[input.value.length]);
                        }
                    }

                    // Track word in history
                    const lastM = stats.mistakeHistory[stats.mistakeHistory.length - 1];
                    stats.wordHistory.push({
                        word,
                        hadMistake: true,
                        mistakeType: lastM && lastM.word === word ? lastM.mistakeType : 'typo',
                        corrected:   lastM && lastM.word === word ? lastM.corrected   : false,
                    });
                    if (stats.wordHistory.length > 30) stats.wordHistory.shift();

                    wordCount++;
                    stats.mistakeWordCount = wordCount;
                    stats.lastWord = word;
                    stats.lastWordCorrect = false;
                    continue; // next iteration reads fresh pos from input.value.length
                }
            }

            // ── Normal character type ─────────────────────────────────────────────
            simulateKey(input, ch);

            // Track word completion: a space typed after a non-space character
            // means the preceding word just finished.
            if (isSpace && pos > 0 && !/\s/.test(sourceText[pos - 1])) {
                // Walk back to find the start of the just-completed word
                let wordStart = pos - 1;
                while (wordStart > 0 && !/\s/.test(sourceText[wordStart - 1])) wordStart--;
                const completedWord = sourceText.slice(wordStart, pos);

                stats.wordHistory.push({
                    word: completedWord,
                    hadMistake: false,
                    mistakeType: null,
                    corrected: false,
                });
                if (stats.wordHistory.length > 30) stats.wordHistory.shift();

                wordCount++;
                stats.mistakeWordCount = wordCount;
                stats.lastWord = completedWord;
                stats.lastWordCorrect = true;
            }

            await sleep(getHumanLikeDelay());
            if (shouldAddRandomPause()) await sleep(getRandomPauseDelay());
        }
    }

    // --- DÖNGÜ (ÇALIŞMA MODU) ---
    async function loopLesson(elements) {
        const { source, input } = elements;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.focus();

        // On the very first section, skip spans that were already typed (resume support)
        let firstIteration = true;

        // Outer loop: re-runs each time the lesson content refreshes (new section loaded)
        while (config.active) {
            const spans = Array.from(source.querySelectorAll('span'));

            if (spans.length === 0) {
                logger('Ders içeriği bekleniyor...', 'warn');
                await sleep(200);
                continue;
            }

            // Resume: on first run, skip spans already covered by existing input.
            // Accumulate span text lengths (each span is usually 1 char, but we handle
            // multi-char or empty spans safely) until we match input.value.length.
            let startIndex = 0;
            if (firstIteration && input.value.length > 0) {
                let accumulated = 0;
                for (let j = 0; j < spans.length; j++) {
                    const t = spans[j].textContent;
                    accumulated += (t === '' || t.charCodeAt(0) === 160) ? 1 : t.length;
                    if (accumulated >= input.value.length) {
                        startIndex = j + 1;
                        break;
                    }
                }
            }
            firstIteration = false;

            if (startIndex > 0) {
                logger(`Ders modu: ${startIndex} span atlandı (kaldığı yerden devam).`);
            }
            logger(`Ders modu: ${spans.length} karakter bulundu.`);

            let contentChanged = false;

            for (let i = startIndex; i < spans.length; i++) {
                if (!config.active) break;

                // Detect if the source content changed mid-typing (span removed from DOM)
                if (!source.contains(spans[i])) {
                    contentChanged = true;
                    logger('Ders içeriği değişti, yeniden okunuyor...');
                    break;
                }

                let charToType = spans[i].textContent;
                if (charToType === "" || charToType.charCodeAt(0) === 160) charToType = " ";

                simulateKey(input, charToType);
                if (i % 5 === 0) spans[i].scrollIntoView({ block: 'center' });

                const delay = getHumanLikeDelay();
                await sleep(delay);

                if (shouldAddRandomPause()) {
                    await sleep(getRandomPauseDelay());
                }
            }

            if (!config.active) break;

            if (!contentChanged) {
                // All spans typed — check for auto-next or wait for the next section to load
                logger('Bölüm tamamlandı, yeni içerik bekleniyor...');

                if (config.autoNextLesson) {
                    const nextLessonBtn = document.querySelector('a[onclick*="dersdegistir"]');
                    const lessonEndedMsg = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes('Ders Sona Erdi!'));

                    if (lessonEndedMsg && nextLessonBtn) {
                        logger('Ders Sona Erdi mesajı bulundu, sonraki derse geçiliyor...');
                        nextLessonBtn.click();

                        // Wait for the new content to appear
                        let waited = 0;
                        let foundNew = false;
                        while(waited < 10000) {
                             await sleep(200);
                             waited += 200;

                             // Try to find the new lesson text spans
                             const newLessonSource = document.querySelector('#fklavyemetni, #qklavyemetni');
                             if(newLessonSource && newLessonSource.querySelectorAll('span').length > 0) {
                                  // Content loaded
                                  foundNew = true;
                                  break;
                             }
                        }

                        if(foundNew) {
                             logger('Yeni ders içeriği başarıyla yüklendi, yazmaya devam ediliyor.');
                             // Reset variables to start typing from the beginning of the new lesson
                             firstIteration = true;
                             input.value = "";
                             stats.totalWords = 0;
                             stats.mistakeWordCount = 0;
                             continue;
                        } else {
                             logger('Yeni ders içeriği yüklenemedi. Bot durduruluyor.', 'error');
                             stopBot();
                             break;
                        }
                    }
                }

                const firstSpanText = spans[0].textContent;
                const spanCount = spans.length;

                let waited = 0;
                const maxWait = 10000;
                while (config.active && waited < maxWait) {
                    await sleep(150);
                    waited += 150;
                    const newSpans = source.querySelectorAll('span');
                    if (newSpans.length !== spanCount ||
                        (newSpans.length > 0 && newSpans[0].textContent !== firstSpanText)) {
                        logger('Yeni ders içeriği algılandı!');
                        break;
                    }
                }

                if (waited >= maxWait) {
                    logger('Yeni içerik bulunamadı, bot durduruluyor.');
                    stopBot();
                    break;
                }
            }
        }
    }

    // --- DÖNGÜ (HIZ TESTİ) ---
    async function loopSpeedTest(elements) {
        const { source, input } = elements;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.focus();

        logger('Hız Testi Döngüsü başlıyor...');

        // ── Resume: compute wordCount from already-typed content ──────────────────
        // This ensures the mistake trigger fires at the correct cadence even if the
        // bot was stopped and restarted mid-session.
        let wordCount = 0;
        {
            const v = input.value;
            if (v) {
                const words = v.trim().split(/\s+/).filter(Boolean);
                // A trailing space means the last word is fully complete
                wordCount = /\s$/.test(v) ? words.length : Math.max(0, words.length - 1);
                stats.mistakeWordCount = wordCount;
            }
        }

        while (config.active) {
            const activeWordSpan = source.querySelector('.golge');

            if (!activeWordSpan) {
                logger('Aktif kelime bulunamadı, bekleniyor...', 'warn');
                await sleep(200);
                continue;
            }

            const wordToType = activeWordSpan.textContent.trim();
            if (!wordToType) {
                await sleep(200);
                continue;
            }

            logger(`Kelime yazılıyor: "${wordToType}" (kelime #${wordCount + 1})`);

            // ── Resume partial-word fix ───────────────────────────────────────────
            // If the bot was stopped mid-word, input.value may already end with a
            // prefix of wordToType (e.g. "bro" when word is "brown").  Skip those
            // characters so we don't duplicate them and create "brobrown".
            let startCharIdx = 0;
            {
                const inputVal = input.value;
                if (inputVal && !/\s$/.test(inputVal)) {
                    // Last token (content after the last space) is the partial word
                    const lastSpaceIdx = inputVal.lastIndexOf(' ');
                    const lastPart = lastSpaceIdx >= 0 ? inputVal.slice(lastSpaceIdx + 1) : inputVal;
                    if (lastPart.length > 0 &&
                        lastPart.length < wordToType.length &&
                        wordToType.startsWith(lastPart)) {
                        startCharIdx = lastPart.length;
                        logger(`Kelime devam ettiriliyor: "${wordToType}" (${startCharIdx} karakter atlandı)`);
                    }
                }
            }

            // Only attempt a mistake at the very start of the word (not on resume continuation)
            const makeMistake = startCharIdx === 0 &&
                shouldMakeMistake(wordCount) &&
                wordToType.length >= MIN_WORD_LEN_FOR_MISTAKE;

            let wordWasCorrect = true;
            if (makeMistake) {
                wordWasCorrect = await typeWithMistake(input, wordToType);
            } else {
                for (let i = startCharIdx; i < wordToType.length; i++) {
                    if (!config.active) break;
                    simulateKey(input, wordToType[i]);
                    await sleep(getHumanLikeDelay());
                }
            }

            if (!config.active) break;

            // Track word in history for mistake chart
            const lastM = makeMistake ? stats.mistakeHistory[stats.mistakeHistory.length - 1] : null;
            stats.wordHistory.push({
                word: wordToType,
                hadMistake: makeMistake,
                mistakeType: lastM ? lastM.mistakeType : null,
                corrected: makeMistake ? wordWasCorrect : false,
            });
            if (stats.wordHistory.length > 30) stats.wordHistory.shift();

            stats.lastWord = wordToType;
            stats.lastWordCorrect = !makeMistake || wordWasCorrect;

            const lastWordDisplay = document.getElementById('last-word-display');
            const lastWordStatus  = document.getElementById('last-word-status');
            if (lastWordDisplay) lastWordDisplay.innerText = stats.lastWord || '—';
            if (lastWordStatus) {
                lastWordStatus.innerText = stats.lastWord ? (stats.lastWordCorrect ? '✓' : '✗') : '';
                lastWordStatus.style.color = stats.lastWordCorrect ? '#34c759' : '#ff3b30';
            }

            // Type the space to advance the game to the next word
            simulateKey(input, ' ');
            await sleep(getHumanLikeDelay() + 30);
            if (shouldAddRandomPause()) await sleep(getRandomPauseDelay());

            wordCount++;
            stats.mistakeWordCount = wordCount;
        }
    }

    // --- KONTROL ---
    async function startBot() {
        if (config.active) return;

        logger('Bot başlatılıyor...');
        const elements = findActiveElements();

        if (!elements) {
            alert("Yazı alanı bulunamadı! Konsolu (F12) kontrol edin.");
            return;
        }

        config.active = true;
        startStatsTracking();
        updatePanelUI(true);

        if (elements.type === 'textarea') {
            await loopTextarea(elements);
        } else if (elements.type === 'speedtest') {
            await loopSpeedTest(elements);
        } else {
            await loopLesson(elements);
        }
    }

    function stopBot() {
        config.active = false;
        stopStatsTracking();
        updatePanelUI(false);
        logger('Bot durduruldu.');
    }

    // --- ARAYÜZ ---
    function updatePanelUI(isRunning) {
        const btn = document.getElementById('btn-main');
        const status = document.getElementById('bot-status');
        if (btn && status) {
            if (isRunning) {
                btn.innerText = "⏹ Durdur";
                btn.style.background = "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)";
                status.innerText = "Aktif";
                status.style.color = "#34c759";
            } else {
                btn.innerText = "▶ Başlat";
                btn.style.background = "linear-gradient(135deg, #007aff 0%, #0051d5 100%)";
                status.innerText = "Bekliyor";
                status.style.color = "#ff9500";
            }
        }
    }

    function createPanel() {
        if (document.getElementById('katip-v12-panel')) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        const colors = {
            bg: 'var(--katip-bg, #ffffff)',
            bgSecondary: 'var(--katip-bg-sec, #f4f4f4)',
            text: 'var(--katip-text, #111111)',
            textMuted: 'var(--katip-text-muted, #666666)',
            border: 'var(--katip-border, #e0e0e0)',
            primary: '#0051c3', // Cloudflare blue
            primaryHover: '#003682',
            danger: '#d92d20',
            dangerHover: '#b42318',
            success: '#078440',
        };

        const cssVars = `
            :root {
                --katip-bg: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
                --katip-bg-sec: ${isDarkMode ? '#2d2d2d' : '#f4f4f4'};
                --katip-text: ${isDarkMode ? '#ffffff' : '#111111'};
                --katip-text-muted: ${isDarkMode ? '#a0a0a0' : '#666666'};
                --katip-border: ${isDarkMode ? '#404040' : '#e0e0e0'};
                --katip-input-bg: ${isDarkMode ? '#333333' : '#ffffff'};
            }
            @media (prefers-color-scheme: dark) {
                :root {
                    --katip-bg: #1a1a1a;
                    --katip-bg-sec: #2d2d2d;
                    --katip-text: #ffffff;
                    --katip-text-muted: #a0a0a0;
                    --katip-border: #404040;
                    --katip-input-bg: #333333;
                }
            }
        `;

        const panel = document.createElement('div');
        panel.id = 'katip-v12-panel';
        panel.innerHTML = `
            <style>
                ${cssVars}
                #katip-v12-panel * {
                    box-sizing: border-box;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                #katip-v12-panel {
                    position: fixed;
                    z-index: 999999;
                    background: var(--katip-bg);
                    color: var(--katip-text);
                    width: 320px;
                    border: 1px solid var(--katip-border);
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    display: ${config.panelMinimized ? 'none' : 'flex'};
                    flex-direction: column;
                    top: ${config.panelTop};
                    left: ${config.panelLeft};
                    overflow: hidden;
                    transition: opacity 0.2s;
                }

                .katip-header {
                    background: var(--katip-bg-sec);
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--katip-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                }

                .katip-title {
                    font-weight: 600;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .katip-badge {
                    background: ${colors.primary};
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                }

                .katip-controls {
                    display: flex;
                    gap: 8px;
                }
                
                .katip-btn-icon {
                    background: none;
                    border: none;
                    color: var(--katip-text-muted);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                .katip-btn-icon:hover {
                    background: var(--katip-border);
                    color: var(--katip-text);
                }

                .katip-body {
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .katip-main-btn {
                    width: 100%;
                    padding: 10px;
                    background: ${colors.primary};
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .katip-main-btn:hover { background: ${colors.primaryHover}; }
                .katip-main-btn.active { background: ${colors.danger}; }
                .katip-main-btn.active:hover { background: ${colors.dangerHover}; }

                .katip-stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }

                .katip-stat-box {
                    background: var(--katip-bg-sec);
                    border: 1px solid var(--katip-border);
                    border-radius: 4px;
                    padding: 8px;
                    text-align: center;
                }
                .katip-stat-label { font-size: 10px; color: var(--katip-text-muted); text-transform: uppercase; margin-bottom: 4px; font-weight: 600; }
                .katip-stat-value { font-size: 16px; font-weight: bold; }

                .katip-section {
                    border-top: 1px solid var(--katip-border);
                    padding-top: 14px;
                }
                .katip-section-title { font-size: 12px; font-weight: 600; margin-bottom: 10px; color: var(--katip-text-muted); text-transform: uppercase; }

                .katip-setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }

                .katip-setting-label { font-size: 13px; font-weight: 500; }
                .katip-setting-desc { font-size: 11px; color: var(--katip-text-muted); margin-top: 2px; }

                .katip-input {
                    background: var(--katip-input-bg);
                    border: 1px solid var(--katip-border);
                    color: var(--katip-text);
                    padding: 4px 8px;
                    border-radius: 4px;
                    width: 60px;
                    text-align: right;
                    font-size: 12px;
                }

                .katip-toggle {
                    position: relative;
                    display: inline-block;
                    width: 36px;
                    height: 20px;
                }
                .katip-toggle input { opacity: 0; width: 0; height: 0; }
                .katip-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: var(--katip-border);
                    transition: .2s;
                    border-radius: 20px;
                }
                .katip-slider:before {
                    position: absolute;
                    content: "";
                    height: 14px;
                    width: 14px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .2s;
                    border-radius: 50%;
                }
                input:checked + .katip-slider { background-color: ${colors.success}; }
                input:checked + .katip-slider:before { transform: translateX(16px); }

                /* Logo icon when minimized */
                #katip-icon {
                    position: fixed;
                    z-index: 999999;
                    top: 50%;
                    left: 0;
                    transform: translateY(-50%);
                    width: 40px;
                    height: 40px;
                    background: ${colors.primary};
                    color: white;
                    border-radius: 0 6px 6px 0;
                    display: ${config.panelMinimized ? 'flex' : 'none'};
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    box-shadow: 2px 0 8px rgba(0,0,0,0.2);
                    transition: background 0.2s;
                }
                #katip-icon:hover { background: ${colors.primaryHover}; }

                /* Range slider */
                input[type=range] {
                    -webkit-appearance: none;
                    width: 100%;
                    background: transparent;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 14px; width: 14px;
                    border-radius: 50%;
                    background: ${colors.primary};
                    cursor: pointer;
                    margin-top: -5px;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%; height: 4px;
                    cursor: pointer;
                    background: var(--katip-border);
                    border-radius: 2px;
                }
            </style>

            <div class="katip-header" id="katip-header">
                <div class="katip-title">
                    <span>KatipAutomate</span>
                    <span class="katip-badge" id="bot-status-badge">Bekliyor</span>
                </div>
                <div class="katip-controls">
                    <button class="katip-btn-icon" id="btn-minimize" title="Küçült">−</button>
                </div>
            </div>

            <div class="katip-body">
                <button id="btn-main" class="katip-main-btn">▶ Başlat</button>

                <div class="katip-stats-grid">
                    <div class="katip-stat-box">
                        <div class="katip-stat-label">Gerçekleşen WPM</div>
                        <div class="katip-stat-value" id="wpm-calculated" style="color:${colors.primary}">0</div>
                    </div>
                    <div class="katip-stat-box">
                        <div class="katip-stat-label">Hedeflenen WPM</div>
                        <div class="katip-stat-value" id="wpm-estimated" style="color:${colors.success}">0</div>
                    </div>
                    <div class="katip-stat-box">
                        <div class="katip-stat-label">Yazılan</div>
                        <div class="katip-stat-value" id="words-written">0</div>
                    </div>
                    <div class="katip-stat-box">
                        <div class="katip-stat-label">Son Kelime</div>
                        <div class="katip-stat-value" id="last-word-display" style="font-size:12px; overflow:hidden; text-overflow:ellipsis;">—</div>
                    </div>
                </div>

                <div class="katip-section">
                    <div class="katip-section-title">Genel Ayarlar</div>

                    <div class="katip-setting-row">
                        <div>
                            <div class="katip-setting-label">Hedef Hız (Gecikme)</div>
                            <div class="katip-setting-desc">Düşük değer = daha hızlı</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="number" id="speed-input" class="katip-input" min="1" max="300" value="${config.delay}">
                            <span style="font-size:11px; color:var(--katip-text-muted)">ms</span>
                        </div>
                    </div>
                    <input type="range" id="bot-slider" min="1" max="300" value="${config.delay}" style="margin-bottom: 12px;">

                    <div class="katip-setting-row">
                        <div>
                            <div class="katip-setting-label">Tam Otomasyon</div>
                            <div class="katip-setting-desc">Ders bitince sıradakine geçer</div>
                        </div>
                        <label class="katip-toggle">
                            <input type="checkbox" id="auto-next-toggle" ${config.autoNextLesson ? 'checked' : ''}>
                            <span class="katip-slider"></span>
                        </label>
                    </div>

                    <div class="katip-setting-row">
                        <div>
                            <div class="katip-setting-label">Otomatik Düzeltme</div>
                            <div class="katip-setting-desc">Hataları fark edip siler</div>
                        </div>
                        <label class="katip-toggle">
                            <input type="checkbox" id="auto-correct-toggle" ${config.autoCorrectEnabled ? 'checked' : ''}>
                            <span class="katip-slider"></span>
                        </label>
                    </div>

                    <div class="katip-setting-row">
                        <div>
                            <div class="katip-setting-label">İnsan Gibi Yaz</div>
                            <div class="katip-setting-desc">Değişken hız ve beklemeler</div>
                        </div>
                        <label class="katip-toggle">
                            <input type="checkbox" id="human-like-toggle" ${config.humanLikeTyping ? 'checked' : ''}>
                            <span class="katip-slider"></span>
                        </label>
                    </div>
                </div>

                <div class="katip-section">
                    <div class="katip-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                        Kasıtlı Hata Sistemi
                        <label class="katip-toggle" style="transform: scale(0.8); transform-origin: right;">
                            <input type="checkbox" id="mistake-toggle" ${config.mistakeModeEnabled ? 'checked' : ''}>
                            <span class="katip-slider"></span>
                        </label>
                    </div>

                    <div id="mistake-config-area" style="display: ${config.mistakeModeEnabled ? 'block' : 'none'};">
                        <div style="font-size: 12px; background: var(--katip-bg-sec); padding: 10px; border-radius: 4px; border: 1px solid var(--katip-border); margin-bottom: 10px; line-height: 1.5;">
                            Her
                            <input type="number" id="m-words" class="katip-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeEveryWords}" min="1">
                            kelimeden birisi,<br> %
                            <input type="number" id="m-chance" class="katip-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeChance}" min="1" max="100">
                            ihtimalle hatalı olsun.<br>
                            Yapılan hata %
                            <input type="number" id="m-clear" class="katip-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeClearChance}" min="0" max="100">
                            ihtimalle düzeltilsin.
                        </div>
                        <div id="mistake-summary" style="font-size:11px; color:var(--katip-text-muted); text-align:center;">
                            Ortalama her ${Math.round(config.mistakeEveryWords * (100/config.mistakeChance))} kelimede 1 hata yapılacak.
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const icon = document.createElement('div');
        icon.id = 'katip-icon';
        icon.innerText = 'KF';
        icon.title = 'KatipAutomate Paneli Aç';
        document.body.appendChild(icon);

        // --- Dragging Logic ---
        const header = panel.querySelector('#katip-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return; // ignore buttons
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = panel.offsetLeft;
            initialTop = panel.offsetTop;
            
            // disable text selection during drag
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            // boundaries
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));

            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                config.panelLeft = panel.style.left;
                config.panelTop = panel.style.top;
                localStorage.setItem('katip-panel-left', config.panelLeft);
                localStorage.setItem('katip-panel-top', config.panelTop);
            }
        });

        // --- UI Interactions ---
        document.getElementById('btn-minimize').onclick = () => {
            panel.style.display = 'none';
            icon.style.display = 'flex';
            config.panelMinimized = true;
            localStorage.setItem('katip-panel-minimized', 'true');
        };

        icon.onclick = () => {
            icon.style.display = 'none';
            panel.style.display = 'flex';
            config.panelMinimized = false;
            localStorage.setItem('katip-panel-minimized', 'false');
        };

        const mainBtn = document.getElementById('btn-main');
        mainBtn.onclick = () => {
            if (config.active) stopBot();
            else startBot();
        };

        // Speed/Delay sync
        const speedInput = document.getElementById('speed-input');
        const botSlider = document.getElementById('bot-slider');
        
        botSlider.oninput = function() {
            config.delay = parseInt(this.value);
            speedInput.value = this.value;
            localStorage.setItem('katip-speed', this.value);
            stats.estimatedWPM = calculateEstimatedWPM();
            updateStatsDisplay();
        };
        
        speedInput.oninput = function() {
            let val = parseInt(this.value);
            if (val < 1) val = 1;
            if (val > 300) val = 300;
            config.delay = val;
            botSlider.value = val;
            localStorage.setItem('katip-speed', val);
            stats.estimatedWPM = calculateEstimatedWPM();
            updateStatsDisplay();
        };

        // Toggles
        document.getElementById('auto-next-toggle').onchange = function() {
            config.autoNextLesson = this.checked;
            localStorage.setItem('katip-auto-next', this.checked);
        };

        document.getElementById('auto-correct-toggle').onchange = function() {
            config.autoCorrectEnabled = this.checked;
            localStorage.setItem('katip-auto-correct', this.checked);
        };

        document.getElementById('human-like-toggle').onchange = function() {
            config.humanLikeTyping = this.checked;
            localStorage.setItem('katip-human-like', this.checked);
        };

        // Mistake System
        const mistakeToggle = document.getElementById('mistake-toggle');
        const mistakeConfigArea = document.getElementById('mistake-config-area');
        const mWords = document.getElementById('m-words');
        const mChance = document.getElementById('m-chance');
        const mClear = document.getElementById('m-clear');
        const mSummary = document.getElementById('mistake-summary');

        function updateMistakeSummary() {
            if(config.mistakeChance === 0) {
                 mSummary.innerText = "Hata yapılmayacak.";
                 return;
            }
            const avg = Math.round(config.mistakeEveryWords * (100 / config.mistakeChance));
            mSummary.innerText = `Ortalama her ${avg} kelimede 1 hata yapılacak.`;
        }

        mistakeToggle.onchange = function() {
            config.mistakeModeEnabled = this.checked;
            localStorage.setItem('katip-mistake-mode-enabled', this.checked);
            mistakeConfigArea.style.display = this.checked ? 'block' : 'none';
        };

        mWords.oninput = function() {
            config.mistakeEveryWords = Math.max(1, parseInt(this.value) || 1);
            localStorage.setItem('katip-mistake-every-words', config.mistakeEveryWords);
            updateMistakeSummary();
        };

        mChance.oninput = function() {
            config.mistakeChance = Math.min(100, Math.max(0, parseInt(this.value) || 0));
            localStorage.setItem('katip-mistake-chance', config.mistakeChance);
            updateMistakeSummary();
        };

        mClear.oninput = function() {
            config.mistakeClearChance = Math.min(100, Math.max(0, parseInt(this.value) || 0));
            localStorage.setItem('katip-mistake-clear-chance', config.mistakeClearChance);
        };

        // Initial setup
        updateMistakeSummary();
    }

    setTimeout(createPanel, 1000);
})();
