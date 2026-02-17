// ==UserScript==
// @name         <<KatipOnlineFucker>>
// @namespace    http://tampermonkey.net/
// @version      v2.3
// @description  Katiponline sitesi için oluşturulan robotize yazım scripti.
// @author       PrescionX
// @match        *://*.katiponline.xyz/*
// @match        *://*.katiponline.com/*
// @grant        GM_addStyle
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/prescionx/katiponlinefucker/main/userscript.js
// @downloadURL  https://raw.githubusercontent.com/prescionx/katiponlinefucker/main/userscript.js
// ==/UserScript==

(function() {
    'use strict';

    // --- AYARLAR ---
    const config = {
        active: false,
        delay: parseInt(localStorage.getItem('katip-speed')) || 120, // İki harf arası bekleme süresi (ms)
        debug: true, // Konsolda detaylı hata ayıklama görmek için true
        panelMinimized: localStorage.getItem('katip-panel-minimized') === 'true', // Panel başlangıç durumu
        wordLimitEnabled: localStorage.getItem('katip-word-limit-enabled') === 'true', // Kelime limiti aktif mi
        wordLimit: parseInt(localStorage.getItem('katip-word-limit')) || 50, // Kaç kelime yazılacak
        infoExpanded: false, // Info panel durumu
        mistakeMode: localStorage.getItem('katip-mistake-mode') || 'none', // none, basic, advanced, custom
        mistakeRate: parseInt(localStorage.getItem('katip-mistake-rate')) || 3, // Her kaç kelimede bir hata
        mistakeChance: parseInt(localStorage.getItem('katip-mistake-chance')) || 50, // Hata yapma şansı (%)
        mistakeDeleteCount: parseInt(localStorage.getItem('katip-mistake-delete-count')) || 1, // Hatadan sonra kaç kere silme
        mistakeClearChance: parseInt(localStorage.getItem('katip-mistake-clear-chance')) || 70, // Temizleme ihtimali (%)
        mistakeRewriteCorrect: localStorage.getItem('katip-mistake-rewrite') !== 'false', // Hatadan sonra doğru kelimeyi yazma (default: true)
        humanLikeTyping: localStorage.getItem('katip-human-like') === 'true' // İnsan gibi yazma modu
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
        lastWordCorrect: true
    };

    const logger = (msg, type = 'info') => {
        if (!config.debug) return;
        const prefix = '[KATIP-BOT] ';
        if (type === 'error') console.error(prefix + msg);
        else if (type === 'warn') console.warn(prefix + msg);
        else console.log(prefix + msg);
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // --- HUMAN-LIKE TYPING FUNCTIONS ---
    function getHumanLikeDelay() {
        if (!config.humanLikeTyping) return config.delay;
        
        // Add random variation to delay (±20%)
        const variation = config.delay * 0.2;
        const randomDelay = config.delay + (Math.random() * variation * 2 - variation);
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
        'z': ['a', 'x']
    };

    function generateTypo(char) {
        const lowerChar = char.toLowerCase();
        const typos = typoMap[lowerChar];
        if (!typos || typos.length === 0) return char;
        
        const typo = typos[Math.floor(Math.random() * typos.length)];
        return char === char.toUpperCase() ? typo.toUpperCase() : typo;
    }

    async function typeWithMistake(element, word) {
        // Select random character position (not first or last)
        const mistakePos = Math.floor(Math.random() * (word.length - 2)) + 1;
        
        // Type up to mistake position
        for (let i = 0; i < mistakePos; i++) {
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        
        // Type the typo
        const typo = generateTypo(word[mistakePos]);
        simulateKey(element, typo);
        await sleep(getHumanLikeDelay());
        
        // Decide: correct it or leave it based on mistakeClearChance
        const shouldCorrect = Math.random() * 100 < config.mistakeClearChance;
        
        if (shouldCorrect) {
            // Pause briefly (noticing the mistake)
            await sleep(200 + Math.random() * 300);
            
            // Backspace multiple times based on mistakeDeleteCount
            const deleteCount = config.mistakeDeleteCount || 1;
            for (let i = 0; i < deleteCount; i++) {
                simulateBackspace(element);
                await sleep(getHumanLikeDelay());
            }
            
            // Type correct characters back if mistakeRewriteCorrect is enabled
            if (config.mistakeRewriteCorrect) {
                // If we deleted more than the typo, we need to retype from earlier
                const startPos = Math.max(0, mistakePos - deleteCount + 1);
                for (let i = startPos; i <= mistakePos; i++) {
                    simulateKey(element, word[i]);
                    await sleep(getHumanLikeDelay());
                }
            } else {
                // Just type the correct character
                simulateKey(element, word[mistakePos]);
                await sleep(getHumanLikeDelay());
            }
        }
        
        // Type rest of the word
        for (let i = mistakePos + 1; i < word.length; i++) {
            simulateKey(element, word[i]);
            await sleep(getHumanLikeDelay());
        }
        
        return shouldCorrect;
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

        // Her saniye istatistikleri güncelle
        if (stats.updateInterval) clearInterval(stats.updateInterval);
        stats.updateInterval = setInterval(updateStatsDisplay, 1000);
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
                return { color: '#ffcc00', animation: 'none' };
            } else {
                return { color: '#007aff', animation: 'none' };
            }
        }

        if (wpmCalculated) {
            const calcStyle = getWPMStyle(calcWPM);
            wpmCalculated.innerText = calcWPM;
            wpmCalculated.style.color = calcStyle.color;
            wpmCalculated.style.animation = calcStyle.animation;
        }
        
        if (wpmEstimated) {
            const estStyle = getWPMStyle(estWPM);
            wpmEstimated.innerText = estWPM;
            wpmEstimated.style.color = estStyle.color;
            wpmEstimated.style.animation = estStyle.animation;
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
        
        if (wordsWritten3min) {
            wordsWritten3min.innerText = stats.totalWords;
        }
        if (forecast3Est) {
            const forecast3 = Math.round(stats.estimatedWPM * 3);
            forecast3Est.innerText = forecast3;
            
            // Flash if above threshold
            if (forecast3Box && stats.totalWords > forecast3 * FORECAST_THRESHOLD) {
                forecast3Box.style.animation = 'flash-orange 1s infinite';
            } else if (forecast3Box) {
                forecast3Box.style.animation = 'none';
            }
        }
        
        if (wordsWritten5min) {
            wordsWritten5min.innerText = stats.totalWords;
        }
        if (forecast5Est) {
            const forecast5 = Math.round(stats.estimatedWPM * 5);
            forecast5Est.innerText = forecast5;
            
            if (forecast5Box && stats.totalWords > forecast5 * FORECAST_THRESHOLD) {
                forecast5Box.style.animation = 'flash-orange 1s infinite';
            } else if (forecast5Box) {
                forecast5Box.style.animation = 'none';
            }
        }
        
        if (wordsWritten10min) {
            wordsWritten10min.innerText = stats.totalWords;
        }
        if (forecast10Est) {
            const forecast10 = Math.round(stats.estimatedWPM * 10);
            forecast10Est.innerText = forecast10;
            
            if (forecast10Box && stats.totalWords > forecast10 * FORECAST_THRESHOLD) {
                forecast10Box.style.animation = 'flash-orange 1s infinite';
            } else if (forecast10Box) {
                forecast10Box.style.animation = 'none';
            }
        }

        // Update last word display
        if (lastWordDisplay) {
            lastWordDisplay.innerText = stats.lastWord || '—';
        }
        if (lastWordStatus) {
            lastWordStatus.innerText = stats.lastWord ? (stats.lastWordCorrect ? '✓' : '✗') : '';
            lastWordStatus.style.color = stats.lastWordCorrect ? '#34c759' : '#ff3b30';
        }
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

        // 2. KELİME ÇALIŞMASI
        const lessonSource = document.querySelector('#qklavyemetni');
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

        logger('Düello Döngüsü başlıyor...');
        
        let wordCount = 0;
        let currentWord = '';

        while (config.active) {
            const sourceText = source.value;
            const currentVal = input.value;

            if (!sourceText || sourceText.length === 0) {
                await sleep(500);
                continue;
            }

            if (currentVal.length >= sourceText.length) {
                logger('Metin bitti.');
                stopBot();
                break;
            }

            let charToType = sourceText[currentVal.length];
            if (charToType.charCodeAt(0) === 160) charToType = " ";
            
            const isSpace = (charToType === ' ' || charToType === '\n' || charToType === '\t');
            
            // Handle word-based mistakes
            if (isSpace && currentWord.length > 0) {
                wordCount++;
                currentWord = '';
            } else if (!isSpace) {
                currentWord += charToType;
                
                // Check if we should make a mistake on this word
                const shouldMakeMistake = (
                    (config.mistakeMode === 'basic' || config.mistakeMode === 'advanced') &&
                    wordCount > 0 &&
                    wordCount % config.mistakeRate === 0 &&
                    currentWord.length === 1 // Only at the start of the word
                );
                
                if (shouldMakeMistake && config.mistakeMode === 'advanced') {
                    // Advanced mistake: type the whole word with a mistake
                    const remainingWord = sourceText.slice(currentVal.length).split(/[\s\n\t]/)[0];
                    if (remainingWord.length > 2) {
                        logger(`Making mistake on word: ${remainingWord}`);
                        await typeWithMistake(input, remainingWord);
                        wordCount++;
                        currentWord = '';
                        continue;
                    }
                }
            }

            simulateKey(input, charToType);
            
            // Use human-like delay with random pauses
            const delay = getHumanLikeDelay();
            await sleep(delay);
            
            if (shouldAddRandomPause()) {
                await sleep(getRandomPauseDelay());
            }
        }
    }

    // --- DÖNGÜ (ÇALIŞMA MODU) ---
    async function loopLesson(elements) {
        const { source, input } = elements;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.focus();

        const spans = Array.from(source.querySelectorAll('span'));
        logger(`Ders modu: ${spans.length} karakter bulundu.`);

        for (let i = 0; i < spans.length; i++) {
            if (!config.active) break;

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
        stopBot();
    }

    // --- DÖNGÜ (HIZ TESTİ) ---
    async function loopSpeedTest(elements) {
        const { source, input } = elements;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.focus();

        logger('Hız Testi Döngüsü başlıyor...');
        
        let wordCount = 0;

        while (config.active) {
            const activeWordSpan = source.querySelector('.golge');

            if (!activeWordSpan) {
                logger('Aktif kelime bulunamadı, bekleniyor...', 'warn');
                await sleep(200);
                continue;
            }

            const wordToType = activeWordSpan.textContent.trim();
            logger(`Kelime yazılıyor: ${wordToType}`);
            
            // Check if we should make a mistake on this word
            let shouldMakeMistake = false;
            if (config.mistakeMode === 'basic' || config.mistakeMode === 'advanced') {
                shouldMakeMistake = (
                    wordCount > 0 &&
                    wordCount % config.mistakeRate === 0 &&
                    wordToType.length > 2
                );
            } else if (config.mistakeMode === 'custom') {
                // Custom mode: use percentage chance
                shouldMakeMistake = (
                    Math.random() * 100 < config.mistakeChance &&
                    wordToType.length > 2
                );
            }
            
            let wordWasCorrect = true;
            if (shouldMakeMistake && (config.mistakeMode === 'advanced' || config.mistakeMode === 'custom')) {
                wordWasCorrect = await typeWithMistake(input, wordToType);
            } else {
                for (let i = 0; i < wordToType.length; i++) {
                    if (!config.active) break;
                    simulateKey(input, wordToType[i]);
                    const delay = getHumanLikeDelay();
                    await sleep(delay);
                }
            }

            // Track last word and whether it was correct
            stats.lastWord = wordToType;
            stats.lastWordCorrect = !shouldMakeMistake || wordWasCorrect;
            
            // Immediately update the display for last word
            const lastWordDisplay = document.getElementById('last-word-display');
            const lastWordStatus = document.getElementById('last-word-status');
            if (lastWordDisplay) {
                lastWordDisplay.innerText = stats.lastWord || '—';
            }
            if (lastWordStatus) {
                lastWordStatus.innerText = stats.lastWord ? (stats.lastWordCorrect ? '✓' : '✗') : '';
                lastWordStatus.style.color = stats.lastWordCorrect ? '#34c759' : '#ff3b30';
            }

            if (config.active) {
                simulateKey(input, ' ');
                const delay = getHumanLikeDelay();
                await sleep(delay + 30);
                
                if (shouldAddRandomPause()) {
                    await sleep(getRandomPauseDelay());
                }
            }
            
            wordCount++;
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

        const panel = document.createElement('div');
        panel.id = 'katip-v12-panel';
        panel.innerHTML = `
            <div id="main-panel" style="transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); display: flex; gap: 12px; align-items: center; width: 100%; padding: 0 12px;">
                <!-- Left: Status and Controls -->
                <div style="display:flex; align-items:center; gap:12px; flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:#34c759; box-shadow:0 0 8px rgba(52,199,89,0.6);"></div>
                        <span style="font-weight:600; font-size:14px; color:#ffffff; letter-spacing:-0.3px;">KatipOnline</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px; color:rgba(255,255,255,0.6); font-weight:500;">Durum:</span>
                        <span id="bot-status" style="font-size:11px; color:#ff9500; font-weight:600;">Bekliyor</span>
                    </div>
                    <button id="btn-main" 
                        style="padding:8px 16px; background:linear-gradient(135deg, #007aff 0%, #0051d5 100%); 
                        color:#fff; border:none; cursor:pointer; font-weight:600; font-size:12px; 
                        border-radius:8px; transition:all 0.3s; box-shadow:0 2px 8px rgba(0,122,255,0.3); 
                        letter-spacing:0.3px; white-space: nowrap;">
                        ▶ Başlat
                    </button>
                </div>

                <!-- Center: Stats (Horizontal) -->
                <div style="display: flex; gap: 10px; flex: 1; overflow-x: auto;">
                    <!-- WPM Stats -->
                    <div id="wpm-calc-box" style="background:linear-gradient(135deg, rgba(0,122,255,0.15) 0%, rgba(0,122,255,0.05) 100%); border-radius:8px; padding:8px 12px; border:1px solid rgba(0,122,255,0.3); min-width: 140px;">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px; font-weight:600; text-transform:uppercase;">📈 Ortalama yazım hızı</div>
                        <div style="font-size:16px; font-weight:700;"><span id="wpm-calculated" style="color:#007aff; text-shadow:0 0 10px rgba(0,122,255,0.4);">0</span> <span style="font-size:10px; opacity:0.7; color:#007aff;">WPM</span></div>
                    </div>
                    <div id="wpm-est-box" style="background:linear-gradient(135deg, rgba(52,199,89,0.15) 0%, rgba(52,199,89,0.05) 100%); border-radius:8px; padding:8px 12px; border:1px solid rgba(52,199,89,0.3); min-width: 140px;">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px; font-weight:600; text-transform:uppercase;">⚡ Hedeflenen yazım hızı</div>
                        <div style="font-size:16px; font-weight:700;"><span id="wpm-estimated" style="color:#34c759; text-shadow:0 0 10px rgba(52,199,89,0.4);">0</span> <span style="font-size:10px; opacity:0.7; color:#34c759;">WPM</span></div>
                    </div>
                    
                    <!-- Last Word Display -->
                    <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:8px 12px; border:1px solid rgba(255,255,255,0.1); min-width: 120px;">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px; font-weight:600; text-transform:uppercase;">📝 Son Kelime</div>
                        <div style="font-size:14px; font-weight:600; display:flex; align-items:center; gap:6px;">
                            <span id="last-word-display" style="color:#ffffff;">—</span>
                            <span id="last-word-status" style="font-size:16px;"></span>
                        </div>
                    </div>
                    
                    <!-- Word Counter (if enabled) -->
                    <div id="word-counter-box" style="background:rgba(255,149,0,0.1); border-radius:8px; padding:8px 12px; border:1px solid rgba(255,149,0,0.2); min-width: 100px;">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px; font-weight:600; text-transform:uppercase;">📊 Kelime</div>
                        <div id="word-counter-display" style="font-size:14px; font-weight:600; color:#ff9500;">
                            <span id="words-written">0</span><span id="word-separator" style="display:none;"> / <span id="words-remaining">—</span> / <span id="words-limit">—</span></span>
                        </div>
                    </div>
                </div>

                <!-- Right: Controls -->
                <div style="display:flex; gap:8px; align-items:center; flex-shrink: 0;">
                    <span id="btn-settings" title="Ayarlar" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; transition:all 0.2s; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px;">⚙️</span>
                    <span id="btn-minimize" title="Küçült" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; font-weight:300; transition:color 0.2s; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px;">−</span>
                </div>
            </div>
            
            <!-- Settings Panel (slides up from bottom) -->
            <div id="settings-panel" style="position:absolute; bottom:100%; left:0; right:0; background:rgba(28, 28, 30, 0.98); border-radius:12px 12px 0 0; padding:16px; opacity:0; pointer-events:none; transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 -8px 32px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-bottom:none; max-height: 500px; overflow-y: auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="font-weight:600; font-size:15px; color:#ffffff; letter-spacing:-0.3px;">⚙️ Ayarlar</span>
                    <span id="btn-close-settings" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; font-weight:300; transition:color 0.2s; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;">×</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <!-- Left Column -->
                    <div>
                        <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">⚡ Yazma Hızı</label>
                                <input type="number" id="speed-input" min="1" max="300" value="${config.delay}"
                                    style="width:60px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                    border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                            </div>
                            <input type="range" id="bot-slider" min="1" max="300" step="1" value="${config.delay}" 
                                style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                                background:rgba(255,255,255,0.1); cursor:pointer;">
                            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                                <span style="font-size:9px; color:rgba(255,255,255,0.4);">Hızlı (1ms)</span>
                                <span style="font-size:9px; color:rgba(255,255,255,0.4);">Yavaş (300ms)</span>
                            </div>
                        </div>

                        <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">🎯 Kelime Limiti</label>
                                <label class="ios-switch">
                                    <input type="checkbox" id="word-limit-toggle" ${config.wordLimitEnabled ? 'checked' : ''}>
                                    <span class="ios-slider"></span>
                                </label>
                            </div>
                            <div id="word-limit-controls" style="display:${config.wordLimitEnabled ? 'block' : 'none'};">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                                    <span style="font-size:11px; color:rgba(255,255,255,0.5);">Hedef</span>
                                    <input type="number" id="word-limit-input" min="10" max="1500" value="${config.wordLimit}"
                                        style="width:60px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                        border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                                </div>
                                <input type="range" id="word-limit-slider" min="10" max="1500" step="10" value="${config.wordLimit}" 
                                    style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                                    background:rgba(255,255,255,0.1); cursor:pointer;">
                            </div>
                        </div>

                        <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">🤖 İnsan Gibi Yaz</label>
                                <label class="ios-switch">
                                    <input type="checkbox" id="human-like-toggle" ${config.humanLikeTyping ? 'checked' : ''}>
                                    <span class="ios-slider"></span>
                                </label>
                            </div>
                            <div style="font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4; margin-top:6px;">Değişken hız ve rastgele duraklamalar</div>
                        </div>
                    </div>
                    
                    <!-- Right Column -->
                    <div>
                        <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="margin-bottom:8px;">
                                <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500; display:block; margin-bottom:8px;">❌ Hata Modu</label>
                                <select id="mistake-mode" style="width:100%; padding:6px 10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#ffffff; font-size:12px; cursor:pointer;">
                                    <option value="none" ${config.mistakeMode === 'none' ? 'selected' : ''}>Kapalı</option>
                                    <option value="basic" ${config.mistakeMode === 'basic' ? 'selected' : ''}>Basit Mod</option>
                                    <option value="advanced" ${config.mistakeMode === 'advanced' ? 'selected' : ''}>Gelişmiş Mod</option>
                                    <option value="custom" ${config.mistakeMode === 'custom' ? 'selected' : ''}>Özel Mod</option>
                                </select>
                            </div>
                            <div id="mistake-controls" style="display:${config.mistakeMode !== 'none' ? 'block' : 'none'};">
                                <div id="mistake-rate-control" style="display:${config.mistakeMode === 'basic' || config.mistakeMode === 'advanced' ? 'block' : 'none'}; margin-bottom:8px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
                                        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Her kaç kelimede bir</span>
                                        <input type="number" id="mistake-rate-input" min="2" max="10" value="${config.mistakeRate}"
                                            style="width:50px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                            border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                                    </div>
                                </div>
                                <div id="mistake-chance-control" style="display:${config.mistakeMode === 'custom' ? 'block' : 'none'};">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
                                        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Hata yapma ihtimali</span>
                                        <input type="number" id="mistake-chance-input" min="0" max="100" value="${config.mistakeChance}"
                                            style="width:50px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                            border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                                    </div>
                                    <div style="font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4; margin-bottom:8px;">
                                        <strong>%<span id="mistake-chance-display">${config.mistakeChance}</span></strong> ihtimalle hata yapılır
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
                                        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Silme sayısı</span>
                                        <input type="number" id="mistake-delete-count-input" min="1" max="10" value="${config.mistakeDeleteCount}"
                                            style="width:50px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                            border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
                                        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Temizleme ihtimali</span>
                                        <input type="number" id="mistake-clear-chance-input" min="0" max="100" value="${config.mistakeClearChance}"
                                            style="width:50px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                            border-radius:6px; color:#ffffff; font-size:11px; font-weight:600; text-align:center;">
                                    </div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                                        <label style="font-size:11px; color:rgba(255,255,255,0.5);">Doğrusunu yaz</label>
                                        <label class="ios-switch">
                                            <input type="checkbox" id="mistake-rewrite-toggle" ${config.mistakeRewriteCorrect ? 'checked' : ''}>
                                            <span class="ios-slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <div style="font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4; margin-top:6px;">
                                    <div style="margin-bottom:4px;"><strong>Basit:</strong> Sadece takip edilir</div>
                                    <div style="margin-bottom:4px;"><strong>Gelişmiş:</strong> Hata yazar, %70 düzeltir</div>
                                    <div><strong>Özel:</strong> İhtimal bazlı hata yapma</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Predictions Row -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div id="forecast-3min-box" style="background:rgba(255,149,0,0.1); border-radius:8px; padding:10px; border:1px solid rgba(255,149,0,0.2);">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:600; text-transform:uppercase;">⏱️ 3 Dakika</div>
                        <div style="font-size:13px; font-weight:600; color:#ff9500;">
                            <span id="words-written-3min">0</span> / <span id="forecast-3min-est">0</span>
                        </div>
                    </div>
                    <div id="forecast-5min-box" style="background:rgba(255,149,0,0.1); border-radius:8px; padding:10px; border:1px solid rgba(255,149,0,0.2);">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:600; text-transform:uppercase;">⏱️ 5 Dakika</div>
                        <div style="font-size:13px; font-weight:600; color:#ff9500;">
                            <span id="words-written-5min">0</span> / <span id="forecast-5min-est">0</span>
                        </div>
                    </div>
                    <div id="forecast-10min-box" style="background:rgba(255,149,0,0.1); border-radius:8px; padding:10px; border:1px solid rgba(255,149,0,0.2);">
                        <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:600; text-transform:uppercase;">⏱️ 10 Dakika</div>
                        <div style="font-size:13px; font-weight:600; color:#ff9500;">
                            <span id="words-written-10min">0</span> / <span id="forecast-10min-est">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            width: '100%',
            height: 'auto',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            color: 'white',
            padding: '12px 0',
            borderRadius: '12px 12px 0 0',
            zIndex: '999999',
            border: '1px solid rgba(255,255,255,0.1)',
            borderBottom: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: config.panelMinimized ? 'none' : 'block',
            overflow: 'visible'
        });
        
        // No need to add extra padding to main panel as it's already in the HTML
        const mainPanel = panel.querySelector('#main-panel');

        const icon = document.createElement('div');
        icon.id = 'katip-icon';
        icon.innerHTML = '<span style="font-weight:700; font-size:18px; color:#ffffff; text-shadow: 0 0 10px rgba(255,255,255,0.8);">KF</span>';
        icon.setAttribute('role', 'button');
        icon.setAttribute('aria-label', 'Paneli Aç');
        icon.setAttribute('tabindex', '0');
        Object.assign(icon.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60px',
            height: '60px',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '3px solid transparent',
            borderRadius: '50%',
            display: config.panelMinimized ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: '999999',
            boxShadow: '0 0 30px rgba(0,122,255,0.5), 0 8px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'kf-rainbow-glow 3s linear infinite'
        });

        document.body.appendChild(panel);
        document.body.appendChild(icon);

        // Settings panel toggle
        const settingsPanel = document.getElementById('settings-panel');
        const mainPanelEl = document.getElementById('main-panel');
        
        // Minimize/Maximize events
        const DOM_UPDATE_DELAY = 100; // ms delay for DOM height calculation after display changes
        
        function updateBodyPadding() {
            if (!config.panelMinimized && panel.style.display !== 'none') {
                const panelHeight = panel.offsetHeight;
                document.documentElement.style.setProperty('--katip-panel-height', `${panelHeight}px`);
                document.body.classList.add('katip-panel-open');
            } else {
                document.body.classList.remove('katip-panel-open');
            }
        }
        
        document.getElementById('btn-settings').onclick = () => {
            if (settingsPanel.style.opacity === '1') {
                // Close settings panel
                settingsPanel.style.opacity = '0';
                settingsPanel.style.pointerEvents = 'none';
                panel.style.borderRadius = '12px 12px 0 0';
            } else {
                // Open settings panel - remove rounded corners from main panel
                settingsPanel.style.opacity = '1';
                settingsPanel.style.pointerEvents = 'auto';
                panel.style.borderRadius = '0';
            }
            setTimeout(updateBodyPadding, DOM_UPDATE_DELAY);
        };
        
        document.getElementById('btn-close-settings').onclick = () => {
            settingsPanel.style.opacity = '0';
            settingsPanel.style.pointerEvents = 'none';
            panel.style.borderRadius = '12px 12px 0 0';
            setTimeout(updateBodyPadding, DOM_UPDATE_DELAY);
        };
        
        document.getElementById('btn-minimize').onclick = () => {
            panel.style.display = 'none';
            icon.style.display = 'flex';
            config.panelMinimized = true;
            localStorage.setItem('katip-panel-minimized', 'true');
            document.body.classList.remove('katip-panel-open');
        };

        icon.onclick = () => {
            icon.style.display = 'none';
            panel.style.display = 'block';
            config.panelMinimized = false;
            localStorage.setItem('katip-panel-minimized', 'false');
            setTimeout(updateBodyPadding, DOM_UPDATE_DELAY);
        };
        
        // Update padding when panel is first shown
        if (!config.panelMinimized) {
            setTimeout(updateBodyPadding, DOM_UPDATE_DELAY);
        }

        // Hover effects
        const minimizeBtn = document.getElementById('btn-minimize');
        minimizeBtn.onmouseenter = () => {
            minimizeBtn.style.background = 'rgba(255,255,255,0.1)';
        };
        minimizeBtn.onmouseleave = () => {
            minimizeBtn.style.background = 'transparent';
        };
        
        const settingsBtn = document.getElementById('btn-settings');
        settingsBtn.onmouseenter = () => {
            settingsBtn.style.background = 'rgba(255,255,255,0.1)';
            settingsBtn.style.transform = 'scale(1.1)';
        };
        settingsBtn.onmouseleave = () => {
            settingsBtn.style.background = 'transparent';
            settingsBtn.style.transform = 'scale(1)';
        };

        icon.onmouseenter = () => {
            icon.style.transform = 'translateX(-50%) scale(1.15)';
            icon.style.boxShadow = '0 0 40px rgba(0,122,255,0.7), 0 12px 32px rgba(0,0,0,0.4)';
        };
        icon.onmouseleave = () => {
            icon.style.transform = 'translateX(-50%) scale(1)';
            icon.style.boxShadow = '0 0 30px rgba(0,122,255,0.5), 0 8px 24px rgba(0,0,0,0.3)';
        };

        const mainBtn = document.getElementById('btn-main');
        mainBtn.onmouseenter = () => {
            mainBtn.style.transform = 'translateY(-2px)';
            mainBtn.style.boxShadow = '0 6px 16px rgba(0,122,255,0.4)';
        };
        mainBtn.onmouseleave = () => {
            mainBtn.style.transform = 'translateY(0)';
            mainBtn.style.boxShadow = '0 4px 12px rgba(0,122,255,0.3)';
        };

        // Slider olayı
        const slider = document.getElementById('bot-slider');
        const speedInput = document.getElementById('speed-input');
        
        slider.oninput = function() {
            config.delay = parseInt(this.value);
            speedInput.value = this.value;
            localStorage.setItem('katip-speed', this.value);
            // Anlık tahmini güncelle
            stats.estimatedWPM = calculateEstimatedWPM();
            updateStatsDisplay();
        };
        
        speedInput.oninput = function() {
            let value = parseInt(this.value);
            if (isNaN(value) || value < 1) value = 1;
            if (value > 300) value = 300;
            this.value = value;
            config.delay = value;
            slider.value = value;
            localStorage.setItem('katip-speed', value);
            // Anlık tahmini güncelle
            stats.estimatedWPM = calculateEstimatedWPM();
            updateStatsDisplay();
        };

        // Word limit toggle olayı
        const wordLimitToggle = document.getElementById('word-limit-toggle');
        wordLimitToggle.onchange = function() {
            config.wordLimitEnabled = this.checked;
            localStorage.setItem('katip-word-limit-enabled', this.checked);
            const controls = document.getElementById('word-limit-controls');
            controls.style.display = this.checked ? 'block' : 'none';
            logger(`Kelime limiti ${this.checked ? 'aktif' : 'deaktif'}`);
        };

        // Word limit slider olayı
        const wordLimitSlider = document.getElementById('word-limit-slider');
        const wordLimitInput = document.getElementById('word-limit-input');
        
        wordLimitSlider.oninput = function() {
            config.wordLimit = parseInt(this.value);
            wordLimitInput.value = this.value;
            localStorage.setItem('katip-word-limit', this.value);
            updateStatsDisplay();
        };
        
        wordLimitInput.oninput = function() {
            let value = parseInt(this.value);
            if (isNaN(value) || value < 10) value = 10;
            if (value > 1500) value = 1500;
            this.value = value;
            config.wordLimit = value;
            wordLimitSlider.value = value;
            localStorage.setItem('katip-word-limit', value);
            updateStatsDisplay();
        };
        
        // Human-like typing toggle
        const humanLikeToggle = document.getElementById('human-like-toggle');
        humanLikeToggle.onchange = function() {
            config.humanLikeTyping = this.checked;
            localStorage.setItem('katip-human-like', this.checked);
            logger(`İnsan gibi yazma modu ${this.checked ? 'aktif' : 'deaktif'}`);
        };
        
        // Mistake mode select
        const mistakeMode = document.getElementById('mistake-mode');
        mistakeMode.onchange = function() {
            config.mistakeMode = this.value;
            localStorage.setItem('katip-mistake-mode', this.value);
            const controls = document.getElementById('mistake-controls');
            const rateControl = document.getElementById('mistake-rate-control');
            const chanceControl = document.getElementById('mistake-chance-control');
            
            controls.style.display = this.value !== 'none' ? 'block' : 'none';
            
            if (this.value === 'basic' || this.value === 'advanced') {
                rateControl.style.display = 'block';
                chanceControl.style.display = 'none';
            } else if (this.value === 'custom') {
                rateControl.style.display = 'none';
                chanceControl.style.display = 'block';
            }
            
            logger(`Hata modu: ${this.value}`);
        };
        
        // Mistake rate input
        const mistakeRateInput = document.getElementById('mistake-rate-input');
        mistakeRateInput.oninput = function() {
            let value = parseInt(this.value);
            if (isNaN(value) || value < 2) value = 2;
            if (value > 10) value = 10;
            this.value = value;
            config.mistakeRate = value;
            localStorage.setItem('katip-mistake-rate', value);
        };

        // Mistake chance input
        const mistakeChanceInput = document.getElementById('mistake-chance-input');
        const mistakeChanceDisplay = document.getElementById('mistake-chance-display');
        mistakeChanceInput.oninput = function() {
            let value = parseInt(this.value);
            if (isNaN(value) || value < 0) value = 0;
            if (value > 100) value = 100;
            this.value = value;
            config.mistakeChance = value;
            localStorage.setItem('katip-mistake-chance', value);
            if (mistakeChanceDisplay) {
                mistakeChanceDisplay.innerText = value;
            }
        };
        
        // Mistake delete count input
        const mistakeDeleteCountInput = document.getElementById('mistake-delete-count-input');
        if (mistakeDeleteCountInput) {
            mistakeDeleteCountInput.oninput = function() {
                let value = parseInt(this.value);
                if (isNaN(value) || value < 1) value = 1;
                if (value > 10) value = 10;
                this.value = value;
                config.mistakeDeleteCount = value;
                localStorage.setItem('katip-mistake-delete-count', value);
            };
        }
        
        // Mistake clear chance input
        const mistakeClearChanceInput = document.getElementById('mistake-clear-chance-input');
        if (mistakeClearChanceInput) {
            mistakeClearChanceInput.oninput = function() {
                let value = parseInt(this.value);
                if (isNaN(value) || value < 0) value = 0;
                if (value > 100) value = 100;
                this.value = value;
                config.mistakeClearChance = value;
                localStorage.setItem('katip-mistake-clear-chance', value);
            };
        }
        
        // Mistake rewrite toggle
        const mistakeRewriteToggle = document.getElementById('mistake-rewrite-toggle');
        if (mistakeRewriteToggle) {
            mistakeRewriteToggle.onchange = function() {
                config.mistakeRewriteCorrect = this.checked;
                localStorage.setItem('katip-mistake-rewrite', this.checked);
                logger(`Doğrusunu yazma modu ${this.checked ? 'aktif' : 'deaktif'}`);
            };
        }

        // Slider stili
        const style = document.createElement('style');
        style.textContent = `
            @keyframes kf-glow {
                0%, 100% {
                    box-shadow: 0 0 30px rgba(0,122,255,0.5), 0 8px 24px rgba(0,0,0,0.3);
                    border-color: rgba(0,122,255,0.4);
                }
                50% {
                    box-shadow: 0 0 50px rgba(0,122,255,0.8), 0 0 70px rgba(52,199,89,0.4), 0 8px 24px rgba(0,0,0,0.3);
                    border-color: rgba(52,199,89,0.6);
                }
            }
            
            @keyframes kf-rainbow-glow {
                0% {
                    border-color: #ff0000;
                    box-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff0000, 0 8px 24px rgba(0,0,0,0.3);
                }
                16% {
                    border-color: #ff7f00;
                    box-shadow: 0 0 20px #ff7f00, 0 0 40px #ff7f00, 0 0 60px #ff7f00, 0 8px 24px rgba(0,0,0,0.3);
                }
                33% {
                    border-color: #ffff00;
                    box-shadow: 0 0 20px #ffff00, 0 0 40px #ffff00, 0 0 60px #ffff00, 0 8px 24px rgba(0,0,0,0.3);
                }
                50% {
                    border-color: #00ff00;
                    box-shadow: 0 0 20px #00ff00, 0 0 40px #00ff00, 0 0 60px #00ff00, 0 8px 24px rgba(0,0,0,0.3);
                }
                66% {
                    border-color: #0000ff;
                    box-shadow: 0 0 20px #0000ff, 0 0 40px #0000ff, 0 0 60px #0000ff, 0 8px 24px rgba(0,0,0,0.3);
                }
                83% {
                    border-color: #4b0082;
                    box-shadow: 0 0 20px #4b0082, 0 0 40px #4b0082, 0 0 60px #4b0082, 0 8px 24px rgba(0,0,0,0.3);
                }
                100% {
                    border-color: #ff0000;
                    box-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff0000, 0 8px 24px rgba(0,0,0,0.3);
                }
            }
            
            @keyframes flash-red {
                0%, 100% {
                    color: #ff3b30;
                    text-shadow: 0 0 10px rgba(255,59,48,0.8);
                }
                50% {
                    color: #ff8080;
                    text-shadow: 0 0 20px rgba(255,59,48,1);
                }
            }
            
            @keyframes flash-orange {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
            
            /* iOS Switch Styles */
            .ios-switch {
                position: relative;
                display: inline-block;
                width: 42px;
                height: 24px;
            }
            
            .ios-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .ios-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255,255,255,0.2);
                transition: 0.3s;
                border-radius: 24px;
            }
            
            .ios-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: 0.3s;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            input:checked + .ios-slider {
                background-color: #34c759;
            }
            
            input:checked + .ios-slider:before {
                transform: translateX(18px);
            }
            
            .ios-slider:hover {
                opacity: 0.9;
            }
            
            #bot-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #007aff;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,122,255,0.4);
                transition: all 0.2s;
            }
            #bot-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 12px rgba(0,122,255,0.6);
            }
            #bot-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #007aff;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 8px rgba(0,122,255,0.4);
                transition: all 0.2s;
            }
            #bot-slider::-moz-range-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 12px rgba(0,122,255,0.6);
            }
            #word-limit-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #34c759;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(52,199,89,0.4);
                transition: all 0.2s;
            }
            #word-limit-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 12px rgba(52,199,89,0.6);
            }
            #word-limit-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #34c759;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 8px rgba(52,199,89,0.4);
                transition: all 0.2s;
            }
            #word-limit-slider::-moz-range-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 12px rgba(52,199,89,0.6);
            }
            #speed-input::-webkit-outer-spin-button,
            #speed-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #speed-input[type=number] {
                -moz-appearance: textfield;
            }
            #word-limit-input::-webkit-outer-spin-button,
            #word-limit-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #word-limit-input[type=number] {
                -moz-appearance: textfield;
            }
            #mistake-rate-input::-webkit-outer-spin-button,
            #mistake-rate-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #mistake-rate-input[type=number] {
                -moz-appearance: textfield;
            }
            #mistake-mode {
                -webkit-appearance: none;
                -moz-appearance: none;
                appearance: none;
            }
            #mistake-mode option {
                background: rgba(28, 28, 30, 0.98);
                color: #ffffff;
            }
            
            /* Push content up when panel is visible */
            body.katip-panel-open {
                padding-bottom: var(--katip-panel-height, 0px);
            }
        `;
        document.head.appendChild(style);

        // Ana buton olayı
        document.getElementById('btn-main').onclick = () => {
            if (config.active) stopBot();
            else startBot();
        };
    }

    setTimeout(createPanel, 1000);

})();
