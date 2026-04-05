// ==UserScript==
// @name         TurkEgitimAutomate
// @namespace    http://tampermonkey.net/
// @version      v1.0
// @description  turkegitim.net sitesi için oluşturulan robotize yazım scripti.
// @author       OnyxForgeCollective
// @match        *://*.turkegitim.net/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- AYARLAR ---
    const config = {
        active: localStorage.getItem('turkegitim-auto-resume') === 'true', // Auto-resume check
        delay: parseInt(localStorage.getItem('turkegitim-speed')) || 120,
        debug: true,
        panelMinimized: localStorage.getItem('turkegitim-panel-minimized') === 'true',
        wordLimitEnabled: localStorage.getItem('turkegitim-word-limit-enabled') === 'true',
        wordLimit: parseInt(localStorage.getItem('turkegitim-word-limit')) || 50,
        infoExpanded: false,
        humanLikeTyping: localStorage.getItem('turkegitim-human-like') === 'true',
        autoCorrectEnabled: localStorage.getItem('turkegitim-auto-correct') === 'true',
        autoNextLesson: localStorage.getItem('turkegitim-auto-next') === 'true',
        // --- Hata Sistemi ---
        mistakeModeEnabled: localStorage.getItem('turkegitim-mistake-mode-enabled') === 'true',
        mistakeEveryWords: parseInt(localStorage.getItem('turkegitim-mistake-every-words')) || 5,
        mistakeChance: parseInt(localStorage.getItem('turkegitim-mistake-chance')) || 30,
        mistakeClearChance: parseInt(localStorage.getItem('turkegitim-mistake-clear-chance')) || 70,

        // --- Kullanıcı Hata Yakalama Modu ---
        userErrorDetector: localStorage.getItem('turkegitim-user-error-detector') || 'off', // 'off', 'prevent', 'delete'

        // --- UI Settings ---
        panelTop: localStorage.getItem('turkegitim-panel-top') || '50px',
        panelLeft: localStorage.getItem('turkegitim-panel-left') || '0px'
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
        const prefix = '[TURKEGITIM-BOT] ';
        if (type === 'error') console.error(prefix + msg);
        else if (type === 'warn') console.warn(prefix + msg);
        else console.log(prefix + msg);
    };

    // Use MessageChannel instead of setTimeout so timing works in background tabs
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
    let dynamicDelayOffset = 0;

    function calibrateDelay() {
        if (!stats.startTime || stats.totalWords < 2) return;

        const targetWPM = stats.estimatedWPM;
        const actualWPM = stats.currentWPM;

        if (targetWPM <= 0 || actualWPM <= 0) return;

        const ratio = actualWPM / targetWPM;

        if (ratio < 0.95) {
            dynamicDelayOffset -= 2;
        } else if (ratio > 1.05) {
            dynamicDelayOffset += 2;
        }

        const maxOffset = config.delay * 0.8;
        dynamicDelayOffset = Math.max(-maxOffset, Math.min(maxOffset, dynamicDelayOffset));
    }

    // --- HUMAN-LIKE TYPING FUNCTIONS ---
    function getHumanLikeDelay() {
        const calibratedBaseDelay = Math.max(1, config.delay + dynamicDelayOffset);

        if (!config.humanLikeTyping) return calibratedBaseDelay;

        const variation = calibratedBaseDelay * 0.2;
        const randomDelay = calibratedBaseDelay + (Math.random() * variation * 2 - variation);
        return Math.max(1, Math.round(randomDelay));
    }

    function shouldAddRandomPause() {
        return config.humanLikeTyping && Math.random() < 0.05;
    }

    function getRandomPauseDelay() {
        return 200 + Math.random() * 600;
    }

    // --- MISTAKE GENERATION FUNCTIONS ---
    function generateTypo(char) {
        const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let randomChar = char;
        let attempts = 0;
        while (randomChar.toLowerCase() === char.toLowerCase() && attempts < 10) {
             randomChar = letters.charAt(Math.floor(Math.random() * letters.length));
             attempts++;
        }
        return randomChar;
    }

    function getMistakeType() {
        const types = ['typo', 'typo', 'typo', 'double', 'transposition', 'skip'];
        return types[Math.floor(Math.random() * types.length)];
    }

    const MIN_WORD_LEN_FOR_MISTAKE = 3;

    function shouldMakeMistake(wordCount) {
        if (!config.mistakeModeEnabled) return false;
        if (wordCount === 0) return false;

        if (wordCount % config.mistakeEveryWords === 0) {
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
            await sleep(200 + Math.random() * 300);
            for (let i = 0; i < 1; i++) {
                if (!config.active) return shouldCorrect;
                simulateBackspace(element);
                await sleep(getHumanLikeDelay());
            }
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[pos]);
            await sleep(getHumanLikeDelay());
        }
        for (let i = pos + 1; i < word.length; i++) {
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        return shouldCorrect;
    }

    async function doTranspositionMistake(element, word, pos) {
        for (let i = 0; i < pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
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
        for (let i = 0; i <= pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
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
        for (let i = 0; i < pos; i++) {
            if (!config.active) return true;
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        if (pos + 1 < word.length) {
            if (!config.active) return shouldCorrect;
            simulateKey(element, word[pos + 1]);
            await sleep(getHumanLikeDelay());
            if (shouldCorrect) {
                await sleep(150 + Math.random() * 200);
                if (!config.active) return shouldCorrect;
                simulateBackspace(element);
                await sleep(getHumanLikeDelay());
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
        }
        return shouldCorrect;
    }

    function simulateBackspace(element) {
        if (!element) return;
        const eventObj = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true };
        element.dispatchEvent(new KeyboardEvent('keydown', eventObj));
        element.dispatchEvent(new KeyboardEvent('keypress', eventObj));
        element.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', eventObj));
    }

    // --- İSTATİSTİK FONKSİYONLARI ---
    let lastCharWasSpace = true;

    function updateStats(char) {
        stats.totalChars++;
        const isSpace = (char === ' ' || char === '\n' || char === '\t');
        if (!isSpace && lastCharWasSpace) {
            stats.totalWords++;
            if (config.wordLimitEnabled && stats.totalWords >= config.wordLimit) {
                logger(`Kelime limiti ulaşıldı: ${stats.totalWords}/${config.wordLimit}`);
                setTimeout(() => stopBot(), 100);
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
        lastCharWasSpace = true;
        stats.mistakeHistory = [];
        stats.wordHistory = [];
        stats.totalMistakes = 0;
        stats.correctedMistakes = 0;
        stats.mistakeWordCount = 0;

        if (stats.updateInterval) clearInterval(stats.updateInterval);
        stats.updateInterval = setInterval(() => {
            updateStatsDisplay();
            calibrateDelay();
        }, 1000);
    }

    function calculateEstimatedWPM() {
        if (!config.delay || config.delay < 1) return 0;
        const avgWordLength = 6;
        const spaceChar = 1;
        const avgCharsPerWord = avgWordLength + spaceChar;
        const msPerMinute = 60000;
        const charsPerMinute = msPerMinute / config.delay;
        return Math.round(charsPerMinute / avgCharsPerWord);
    }

    function stopStatsTracking() {
        if (stats.updateInterval) {
            clearInterval(stats.updateInterval);
            stats.updateInterval = null;
        }
    }

    function updateStatsDisplay() {
        const FORECAST_THRESHOLD = 0.9;
        const wpmCalculated = document.getElementById('wpm-calculated');
        const wpmEstimated = document.getElementById('wpm-estimated');
        const wordsWritten = document.getElementById('words-written');

        stats.estimatedWPM = calculateEstimatedWPM();

        const calcWPM = stats.currentWPM || 0;
        const estWPM = stats.estimatedWPM || 0;

        function getWPMStyle(wpm) {
            if (wpm > 150) return { color: '#ff3b30' };
            else if (wpm > 120) return { color: '#ff3b30' };
            else if (wpm > 80) return { color: '#ffcc00' };
            else return { color: '#007aff' };
        }

        const calcStyle = getWPMStyle(calcWPM);
        const estStyle = getWPMStyle(estWPM);

        if (wpmCalculated) {
            wpmCalculated.innerText = calcWPM;
            wpmCalculated.style.color = calcStyle.color;
        }

        if (wpmEstimated) {
            wpmEstimated.innerText = estWPM;
            wpmEstimated.style.color = estStyle.color;
        }

        if (wordsWritten) {
            wordsWritten.innerText = stats.totalWords;
        }

        const lastWordText = document.getElementById('last-word-text');
        const lastWordStatus = document.getElementById('last-word-status');
        if (lastWordText) lastWordText.innerText = stats.lastWord || '—';
        if (lastWordStatus) {
            lastWordStatus.innerText = stats.lastWord ? (stats.lastWordCorrect ? '✓' : '✗') : '';
            lastWordStatus.style.color = stats.lastWordCorrect ? '#34c759' : '#ff3b30';
        }
    }

    // --- KULLANICI HATA DEDEKTÖRÜ ---
    let userErrorListenerAdded = false;

    function attachUserErrorDetector(inputElement) {
        if (!inputElement || userErrorListenerAdded) return;

        inputElement.addEventListener('keydown', (e) => {
            if (!config.active || config.userErrorDetector === 'off') return;
            if (!e.isTrusted) return;

            if (e.key.length === 1 || e.code === 'Space') {
                if (config.userErrorDetector === 'prevent') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                } else if (config.userErrorDetector === 'delete') {
                    setTimeout(() => {
                         simulateBackspace(inputElement);
                    }, 0);
                }
            }
        }, true);

        userErrorListenerAdded = true;
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

        element.dispatchEvent(new KeyboardEvent('keydown', eventObj));
        element.dispatchEvent(new KeyboardEvent('keypress', eventObj));
        element.dispatchEvent(new InputEvent('input', { data: key, inputType: 'insertText', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', eventObj));

        updateStats(key);
    }

    // --- ELEMENT BULUCU ---
    function findActiveElements() {
        const sourceEl = document.getElementById('dvYazim');
        const inputEl = document.getElementById('ittYazilan');

        if (sourceEl && inputEl) {
            logger('TurkEgitim elemanları bulundu!');
            return { source: sourceEl, input: inputEl };
        }

        logger('Yazı alanı bulunamadı!', 'error');
        return null;
    }

    // --- DÖNGÜ (TURKEGITIM) ---
    async function loopLesson(elements) {
        const { source, input } = elements;
        input.focus();

        let firstIteration = true;

        while (config.active) {
            const spans = Array.from(source.querySelectorAll('span'));

            if (spans.length === 0) {
                await sleep(200);
                continue;
            }

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

            let i = startIndex;

            while (i < spans.length && config.active) {
                if (!source.contains(spans[i])) {
                    break;
                }

                if (config.autoCorrectEnabled) {
                     const currentSpans = Array.from(source.querySelectorAll('span'));
                     // Site uses sHataliHarf class for errors (guessing based on common conventions, adjust if needed)
                     const firstErrorIndex = currentSpans.findIndex(s => s.className.includes('sHataliHarf'));

                     if (firstErrorIndex !== -1 && firstErrorIndex <= i) {
                         const backspacesNeeded = (i - firstErrorIndex);
                         for(let j = 0; j <= backspacesNeeded; j++){
                             if (!config.active) break;
                             simulateBackspace(input);
                             await sleep(getHumanLikeDelay() * 0.4);
                         }
                         i = firstErrorIndex;
                         continue;
                     }
                }

                let charToType = spans[i].textContent;
                if (charToType === "" || charToType.charCodeAt(0) === 160) charToType = " ";

                let madeMistakeThisIteration = false;

                if (config.mistakeModeEnabled && charToType !== " ") {
                     const charactersPassed = i + 1;
                     const avgWordLength = 6;

                     if (charactersPassed % (config.mistakeEveryWords * avgWordLength) === 0) {
                         if (Math.random() * 100 < config.mistakeChance) {
                             const typoChar = generateTypo(charToType);
                             simulateKey(input, typoChar);
                             madeMistakeThisIteration = true;
                             stats.totalMistakes++;

                             const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
                             if (shouldCorrect) {
                                 stats.correctedMistakes++;
                                 await sleep(getHumanLikeDelay() + 200);
                                 if (!config.active) break;
                                 simulateBackspace(input);
                                 await sleep(getHumanLikeDelay());
                                 if (!config.active) break;
                                 simulateKey(input, charToType);
                             }
                         }
                     }
                }

                if (!madeMistakeThisIteration) {
                    simulateKey(input, charToType);
                }

                if (i % 5 === 0) spans[i].scrollIntoView({ block: 'center' });

                await sleep(getHumanLikeDelay());
                if (shouldAddRandomPause()) await sleep(getRandomPauseDelay());

                i++;
            }

            if (!config.active) break;

            if (i >= spans.length) {
                await sleep(500);

                const modal = document.getElementById('dvBitisPenceresi');
                if (modal && modal.style.display !== 'none') {
                    if (config.autoNextLesson) {
                        const nextBtn = document.getElementById('itbBitisSonraki');
                        if (nextBtn) {
                            logger('Sonraki derse geçiliyor...');
                            // Enable auto-resume in case it triggers a page reload
                            localStorage.setItem('turkegitim-auto-resume', 'true');
                            nextBtn.click();

                            // wait for content update
                            await sleep(2000);
                            firstIteration = true;
                            dynamicDelayOffset = 0;
                            continue;
                        }
                    }
                } else {
                     await sleep(1000);
                }
            }
        }
    }

    // --- KONTROL ---
    async function startBot() {
        if (config.active) return;
        const elements = findActiveElements();
        if (!elements) return;

        config.active = true;
        localStorage.setItem('turkegitim-auto-resume', 'true');
        startStatsTracking();
        updatePanelUI(true);
        attachUserErrorDetector(elements.input);
        await loopLesson(elements);
    }

    function stopBot() {
        config.active = false;
        localStorage.setItem('turkegitim-auto-resume', 'false');
        stopStatsTracking();
        updatePanelUI(false);
    }

    // --- ARAYÜZ ---
    function updatePanelUI(isRunning) {
        const btn = document.getElementById('btn-main');
        const statusBadge = document.getElementById('bot-status-badge');
        if (btn && statusBadge) {
            if (isRunning) {
                btn.innerText = "⏹️ Durdur";
                btn.classList.add('active');
                statusBadge.innerText = "Aktif";
                statusBadge.style.background = "#078440";
            } else {
                btn.innerText = "▶️ Başlat";
                btn.classList.remove('active');
                statusBadge.innerText = "Bekliyor";
                statusBadge.style.background = "#0051c3";
            }
        }
    }

    function createPanel() {
        if (document.getElementById('turkegitim-panel')) return;

        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        const colors = {
            bg: 'var(--te-bg, #ffffff)',
            bgSecondary: 'var(--te-bg-sec, #f4f6f8)',
            text: 'var(--te-text, #111111)',
            textMuted: 'var(--te-text-muted, #666666)',
            border: 'var(--te-border, #e0e0e0)',
            primary: '#0051c3',
            primaryHover: '#003682',
            danger: '#d92d20',
            dangerHover: '#b42318',
            success: '#078440',
        };

        const cssVars = `
            :root {
                --te-bg: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
                --te-bg-sec: ${isDarkMode ? '#252525' : '#f4f6f8'};
                --te-text: ${isDarkMode ? '#ffffff' : '#212529'};
                --te-text-muted: ${isDarkMode ? '#a0a0a0' : '#6c757d'};
                --te-border: ${isDarkMode ? '#333333' : '#e1e5eb'};
                --te-input-bg: ${isDarkMode ? '#2d2d2d' : '#ffffff'};
                --te-shadow: ${isDarkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)'};
            }
        `;

        const panel = document.createElement('div');
        panel.id = 'turkegitim-panel';
        panel.innerHTML = `
            <style>
                ${cssVars}
                #turkegitim-panel * { box-sizing: border-box; font-family: sans-serif; }
                #turkegitim-panel {
                    position: fixed; z-index: 999999; background: var(--te-bg); color: var(--te-text);
                    width: 320px; border: 1px solid var(--te-border); border-radius: 12px;
                    box-shadow: var(--te-shadow); display: ${config.panelMinimized ? 'none' : 'flex'};
                    flex-direction: column; top: ${config.panelTop}; left: ${config.panelLeft};
                }
                .te-header { background: var(--te-bg-sec); padding: 12px 16px; border-bottom: 1px solid var(--te-border); display: flex; justify-content: space-between; cursor: move; user-select: none; }
                .te-badge { background: ${colors.primary}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
                .te-btn-icon { background: none; border: none; color: var(--te-text-muted); cursor: pointer; font-size: 16px; }
                .te-body { padding: 14px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto; }
                .te-main-btn { width: 100%; padding: 12px; background: ${colors.primary}; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
                .te-main-btn.active { background: ${colors.danger}; }
                .te-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .te-stat-box { background: var(--te-bg-sec); border-radius: 8px; padding: 10px; text-align: center; }
                .te-stat-label { font-size: 10px; color: var(--te-text-muted); text-transform: uppercase; margin-bottom: 4px; font-weight: 600; }
                .te-stat-value { font-size: 18px; font-weight: 700; }
                .te-section { border-top: 1px solid var(--te-border); padding-top: 16px; }
                .te-setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .te-setting-label { font-size: 13px; font-weight: 500; }
                .te-setting-desc { font-size: 11px; color: var(--te-text-muted); }
                .te-input { background: var(--te-input-bg); border: 1px solid var(--te-border); color: var(--te-text); padding: 4px 8px; border-radius: 6px; width: 60px; text-align: right; font-size: 12px; }
                .te-toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
                .te-toggle input { opacity: 0; width: 0; height: 0; }
                .te-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--te-border); border-radius: 20px; transition: .2s; }
                .te-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: .2s; }
                input:checked + .te-slider { background-color: ${colors.success}; }
                input:checked + .te-slider:before { transform: translateX(16px); }
                #te-icon { position: fixed; z-index: 999999; top: 50%; left: 0; transform: translateY(-50%); width: 40px; height: 40px; background: ${colors.primary}; color: white; border-radius: 0 6px 6px 0; display: ${config.panelMinimized ? 'flex' : 'none'}; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; }
                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: ${colors.primary}; cursor: pointer; margin-top: -5px; }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: var(--te-border); border-radius: 2px; cursor: pointer; }
            </style>

            <div class="te-header" id="te-header">
                <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <span>🤖 TEAutomate</span>
                    <span class="te-badge" id="bot-status-badge">Bekliyor</span>
                </div>
                <button class="te-btn-icon" id="btn-minimize">−</button>
            </div>

            <div class="te-body">
                <button id="btn-main" class="te-main-btn">▶️ Başlat</button>

                <div class="te-stats-grid">
                    <div class="te-stat-box">
                        <div class="te-stat-label">🚀 Gerçekleşen WPM</div>
                        <div class="te-stat-value" id="wpm-calculated" style="color:${colors.primary}">0</div>
                    </div>
                    <div class="te-stat-box">
                        <div class="te-stat-label">🎯 Hedeflenen WPM</div>
                        <div class="te-stat-value" id="wpm-estimated" style="color:${colors.success}">0</div>
                    </div>
                </div>

                <div class="te-section">
                    <div class="te-setting-row">
                        <div>
                            <div class="te-setting-label">Hedef Hız (Gecikme)</div>
                            <div class="te-setting-desc">Düşük değer = daha hızlı</div>
                        </div>
                        <input type="number" id="speed-input" class="te-input" min="1" max="300" value="${config.delay}">
                    </div>
                    <input type="range" id="bot-slider" min="1" max="300" value="${config.delay}" style="margin-bottom: 12px;">

                    <div class="te-setting-row">
                        <div>
                            <div class="te-setting-label">Tam Otomasyon</div>
                            <div class="te-setting-desc">Ders bitince sıradakine geçer</div>
                        </div>
                        <label class="te-toggle"><input type="checkbox" id="auto-next-toggle" ${config.autoNextLesson ? 'checked' : ''}><span class="te-slider"></span></label>
                    </div>

                    <div class="te-setting-row">
                        <div>
                            <div class="te-setting-label">Otomatik Düzeltme</div>
                            <div class="te-setting-desc">Hataları fark edip siler</div>
                        </div>
                        <label class="te-toggle"><input type="checkbox" id="auto-correct-toggle" ${config.autoCorrectEnabled ? 'checked' : ''}><span class="te-slider"></span></label>
                    </div>

                    <div class="te-setting-row">
                        <div>
                            <div class="te-setting-label">İnsan Gibi Yaz</div>
                        </div>
                        <label class="te-toggle"><input type="checkbox" id="human-like-toggle" ${config.humanLikeTyping ? 'checked' : ''}><span class="te-slider"></span></label>
                    </div>
                </div>

                <div class="te-section">
                    <div class="te-setting-row">
                        <div class="te-setting-label">🎭 Kasıtlı Hata Sistemi</div>
                        <label class="te-toggle"><input type="checkbox" id="mistake-toggle" ${config.mistakeModeEnabled ? 'checked' : ''}><span class="te-slider"></span></label>
                    </div>

                    <div id="mistake-config-area" style="display: ${config.mistakeModeEnabled ? 'block' : 'none'};">
                        <div style="font-size: 12px; background: var(--te-bg-sec); padding: 12px; border-radius: 8px;">
                            Her <input type="number" id="m-words" class="te-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeEveryWords}"> kelimede,<br>
                            % <input type="number" id="m-chance" class="te-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeChance}"> ihtimalle hata yap.<br>
                            % <input type="number" id="m-clear" class="te-input" style="width:40px; padding:2px; display:inline;" value="${config.mistakeClearChance}"> ihtimalle düzelt.
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const icon = document.createElement('div');
        icon.id = 'te-icon';
        icon.innerText = 'TE';
        document.body.appendChild(icon);

        // --- Dragging ---
        const header = panel.querySelector('#te-header');
        let isDragging = false, startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initialLeft = panel.offsetLeft; initialTop = panel.offsetTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = initialLeft + (e.clientX - startX);
            let newTop = initialTop + (e.clientY - startY);
            panel.style.left = Math.max(0, newLeft) + 'px';
            panel.style.top = Math.max(0, newTop) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem('turkegitim-panel-left', panel.style.left);
                localStorage.setItem('turkegitim-panel-top', panel.style.top);
            }
        });

        // --- Events ---
        document.getElementById('btn-minimize').onclick = () => {
            panel.style.display = 'none'; icon.style.display = 'flex';
            localStorage.setItem('turkegitim-panel-minimized', 'true');
        };
        icon.onclick = () => {
            icon.style.display = 'none'; panel.style.display = 'flex';
            localStorage.setItem('turkegitim-panel-minimized', 'false');
        };

        const mainBtn = document.getElementById('btn-main');
        mainBtn.onclick = () => {
            if (config.active) stopBot();
            else startBot();
        };

        const speedInput = document.getElementById('speed-input');
        const botSlider = document.getElementById('bot-slider');
        const syncSpeed = (val) => {
            config.delay = val; speedInput.value = val; botSlider.value = val;
            localStorage.setItem('turkegitim-speed', val);
            stats.estimatedWPM = calculateEstimatedWPM(); dynamicDelayOffset = 0; updateStatsDisplay();
        };
        botSlider.oninput = function() { syncSpeed(parseInt(this.value)); };
        speedInput.oninput = function() { syncSpeed(Math.max(1, Math.min(300, parseInt(this.value)))); };

        document.getElementById('auto-next-toggle').onchange = function() { config.autoNextLesson = this.checked; localStorage.setItem('turkegitim-auto-next', this.checked); };
        document.getElementById('auto-correct-toggle').onchange = function() { config.autoCorrectEnabled = this.checked; localStorage.setItem('turkegitim-auto-correct', this.checked); };
        document.getElementById('human-like-toggle').onchange = function() { config.humanLikeTyping = this.checked; localStorage.setItem('turkegitim-human-like', this.checked); };

        const mistakeToggle = document.getElementById('mistake-toggle');
        const mistakeConfigArea = document.getElementById('mistake-config-area');
        mistakeToggle.onchange = function() {
            config.mistakeModeEnabled = this.checked; localStorage.setItem('turkegitim-mistake-mode-enabled', this.checked);
            mistakeConfigArea.style.display = this.checked ? 'block' : 'none';
        };

        document.getElementById('m-words').oninput = function() { config.mistakeEveryWords = Math.max(1, parseInt(this.value)||1); localStorage.setItem('turkegitim-mistake-every-words', config.mistakeEveryWords); };
        document.getElementById('m-chance').oninput = function() { config.mistakeChance = Math.min(100, Math.max(0, parseInt(this.value)||0)); localStorage.setItem('turkegitim-mistake-chance', config.mistakeChance); };
        document.getElementById('m-clear').oninput = function() { config.mistakeClearChance = Math.min(100, Math.max(0, parseInt(this.value)||0)); localStorage.setItem('turkegitim-mistake-clear-chance', config.mistakeClearChance); };

        if (config.active) {
            // Auto-resume triggered
            setTimeout(startBot, 500);
        }
    }

    setTimeout(createPanel, 1000);
})();