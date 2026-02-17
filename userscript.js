// ==UserScript==
// @name         <<KatipOnlineFucker>>
// @namespace    http://tampermonkey.net/
// @version      v2.1
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
        mistakeMode: localStorage.getItem('katip-mistake-mode') || 'none', // none, basic, advanced
        mistakeRate: parseInt(localStorage.getItem('katip-mistake-rate')) || 3, // Her kaç kelimede bir hata
        humanLikeTyping: localStorage.getItem('katip-human-like') === 'true' // İnsan gibi yazma modu
    };

    // --- İSTATİSTİKLER ---
    const stats = {
        startTime: null,
        totalChars: 0,
        totalWords: 0,
        currentWPM: 0,
        estimatedWPM: 0,
        updateInterval: null
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
        
        // Decide: correct it or leave it
        const shouldCorrect = Math.random() < 0.7; // 70% chance to correct
        
        if (shouldCorrect) {
            // Pause briefly (noticing the mistake)
            await sleep(200 + Math.random() * 300);
            
            // Backspace
            simulateBackspace(element);
            await sleep(getHumanLikeDelay());
            
            // Type correct character
            simulateKey(element, word[mistakePos]);
            await sleep(getHumanLikeDelay());
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
        const wpmCalculated = document.getElementById('wpm-calculated');
        const wpmEstimated = document.getElementById('wpm-estimated');
        const forecast1Calc = document.getElementById('forecast-1min-calc');
        const forecast3Calc = document.getElementById('forecast-3min-calc');
        const forecast5Calc = document.getElementById('forecast-5min-calc');
        const forecast1Est = document.getElementById('forecast-1min-est');
        const forecast3Est = document.getElementById('forecast-3min-est');
        const forecast5Est = document.getElementById('forecast-5min-est');
        const wordsWritten = document.getElementById('words-written');
        const wordsRemaining = document.getElementById('words-remaining');

        // Güncelleme sırasında tahmini yeniden hesapla
        stats.estimatedWPM = calculateEstimatedWPM();

        if (wpmCalculated) {
            wpmCalculated.innerText = stats.currentWPM || 0;
        }
        
        if (wpmEstimated) {
            wpmEstimated.innerText = stats.estimatedWPM || 0;
        }

        if (forecast1Calc) {
            forecast1Calc.innerText = stats.currentWPM;
        }
        if (forecast3Calc) {
            forecast3Calc.innerText = Math.round(stats.currentWPM * 3);
        }
        if (forecast5Calc) {
            forecast5Calc.innerText = Math.round(stats.currentWPM * 5);
        }

        if (forecast1Est) {
            forecast1Est.innerText = stats.estimatedWPM;
        }
        if (forecast3Est) {
            forecast3Est.innerText = Math.round(stats.estimatedWPM * 3);
        }
        if (forecast5Est) {
            forecast5Est.innerText = Math.round(stats.estimatedWPM * 5);
        }
        
        if (wordsWritten) {
            wordsWritten.innerText = stats.totalWords;
        }
        
        if (wordsRemaining) {
            if (config.wordLimitEnabled) {
                const remaining = Math.max(0, config.wordLimit - stats.totalWords);
                wordsRemaining.innerText = remaining;
            } else {
                wordsRemaining.innerText = '—';
            }
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
            const shouldMakeMistake = (
                (config.mistakeMode === 'basic' || config.mistakeMode === 'advanced') &&
                wordCount > 0 &&
                wordCount % config.mistakeRate === 0 &&
                wordToType.length > 2
            );
            
            if (shouldMakeMistake && config.mistakeMode === 'advanced') {
                await typeWithMistake(input, wordToType);
            } else {
                for (let i = 0; i < wordToType.length; i++) {
                    if (!config.active) break;
                    simulateKey(input, wordToType[i]);
                    const delay = getHumanLikeDelay();
                    await sleep(delay);
                }
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
            <div id="main-panel" style="transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:#34c759; box-shadow:0 0 8px rgba(52,199,89,0.6);"></div>
                        <span style="font-weight:600; font-size:15px; color:#ffffff; letter-spacing:-0.3px;">KatipOnline</span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span id="btn-info" title="Bilgi" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:16px; font-weight:500; transition:all 0.2s; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;">ℹ️</span>
                        <span id="btn-minimize" title="Küçült" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; font-weight:300; transition:color 0.2s; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;">−</span>
                    </div>
                </div>
                
                <div style="margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">Durum</span>
                        <span id="bot-status" style="font-size:12px; color:#ff9500; font-weight:600;">Bekliyor</span>
                    </div>
                </div>

                <div style="background:linear-gradient(135deg, rgba(0,122,255,0.08) 0%, rgba(52,199,89,0.08) 100%); border-radius:12px; padding:14px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:inset 0 1px 3px rgba(255,255,255,0.1);">
                    <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; text-align:center;">📊 WPM İstatistikleri</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div style="background:linear-gradient(135deg, rgba(0,122,255,0.15) 0%, rgba(0,122,255,0.05) 100%); border-radius:10px; padding:10px; border:1px solid rgba(0,122,255,0.3); box-shadow:0 2px 8px rgba(0,122,255,0.15);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:600; text-transform:uppercase;">📈 Calculated</div>
                            <div style="font-size:20px; color:#007aff; font-weight:700; text-shadow:0 0 10px rgba(0,122,255,0.4);"><span id="wpm-calculated">0</span> <span style="font-size:11px; opacity:0.7;">WPM</span></div>
                        </div>
                        <div style="background:linear-gradient(135deg, rgba(52,199,89,0.15) 0%, rgba(52,199,89,0.05) 100%); border-radius:10px; padding:10px; border:1px solid rgba(52,199,89,0.3); box-shadow:0 2px 8px rgba(52,199,89,0.15);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:4px; font-weight:600; text-transform:uppercase;">⚡ Estimated</div>
                            <div style="font-size:20px; color:#34c759; font-weight:700; text-shadow:0 0 10px rgba(52,199,89,0.4);"><span id="wpm-estimated">0</span> <span style="font-size:11px; opacity:0.7;">WPM</span></div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">📈 Calculated Forecast</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:10px;">
                        <div style="background:rgba(0,122,255,0.1); border-radius:8px; padding:7px; border:1px solid rgba(0,122,255,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">1 dk</div>
                            <div style="font-size:14px; color:#007aff; font-weight:600;"><span id="forecast-1min-calc">0</span></div>
                        </div>
                        <div style="background:rgba(0,122,255,0.1); border-radius:8px; padding:7px; border:1px solid rgba(0,122,255,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">3 dk</div>
                            <div style="font-size:14px; color:#007aff; font-weight:600;"><span id="forecast-3min-calc">0</span></div>
                        </div>
                        <div style="background:rgba(0,122,255,0.1); border-radius:8px; padding:7px; border:1px solid rgba(0,122,255,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">5 dk</div>
                            <div style="font-size:14px; color:#007aff; font-weight:600;"><span id="forecast-5min-calc">0</span></div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">⚡ Estimated Forecast</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                        <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:7px; border:1px solid rgba(52,199,89,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">1 dk</div>
                            <div style="font-size:14px; color:#34c759; font-weight:600;"><span id="forecast-1min-est">0</span></div>
                        </div>
                        <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:7px; border:1px solid rgba(52,199,89,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">3 dk</div>
                            <div style="font-size:14px; color:#34c759; font-weight:600;"><span id="forecast-3min-est">0</span></div>
                        </div>
                        <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:7px; border:1px solid rgba(52,199,89,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">5 dk</div>
                            <div style="font-size:14px; color:#34c759; font-weight:600;"><span id="forecast-5min-est">0</span></div>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">🎯 Kelime Limiti</label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" id="word-limit-toggle" ${config.wordLimitEnabled ? 'checked' : ''} 
                                style="width:16px; height:16px; cursor:pointer;">
                            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Aktif</span>
                        </label>
                    </div>
                    <div id="word-limit-controls" style="display:${config.wordLimitEnabled ? 'block' : 'none'};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                            <span style="font-size:11px; color:rgba(255,255,255,0.5);">Hedef Kelime Sayısı</span>
                            <input type="number" id="word-limit-input" min="10" max="1500" value="${config.wordLimit}"
                                aria-label="Hedef kelime sayısı"
                                style="width:70px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                border-radius:6px; color:#ffffff; font-size:12px; font-weight:600; text-align:center;">
                        </div>
                        <input type="range" id="word-limit-slider" min="10" max="1500" step="10" value="${config.wordLimit}" 
                            style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                            background:rgba(255,255,255,0.1); cursor:pointer; margin-bottom:8px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:6px; border:1px solid rgba(52,199,89,0.2);">
                                <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px;">Yazılan</div>
                                <div style="font-size:14px; color:#34c759; font-weight:600;"><span id="words-written">0</span></div>
                            </div>
                            <div style="background:rgba(255,149,0,0.1); border-radius:8px; padding:6px; border:1px solid rgba(255,149,0,0.2);">
                                <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px;">Kalan</div>
                                <div style="font-size:14px; color:#ff9500; font-weight:600;"><span id="words-remaining">${config.wordLimitEnabled ? config.wordLimit : '—'}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">🤖 İnsan Gibi Yaz</label>
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" id="human-like-toggle" ${config.humanLikeTyping ? 'checked' : ''} 
                                style="width:16px; height:16px; cursor:pointer;">
                            <span style="font-size:11px; color:rgba(255,255,255,0.6);">Aktif</span>
                        </label>
                    </div>
                    <div style="font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4;">Değişken hız ve rastgele duraklamalar ekler</div>
                </div>

                <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="margin-bottom:8px;">
                        <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500; display:block; margin-bottom:8px;">❌ Hata Modu</label>
                        <select id="mistake-mode" style="width:100%; padding:6px 10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#ffffff; font-size:12px; cursor:pointer;">
                            <option value="none" ${config.mistakeMode === 'none' ? 'selected' : ''}>Kapalı</option>
                            <option value="basic" ${config.mistakeMode === 'basic' ? 'selected' : ''}>Basit Mod</option>
                            <option value="advanced" ${config.mistakeMode === 'advanced' ? 'selected' : ''}>Gelişmiş Mod</option>
                        </select>
                    </div>
                    <div id="mistake-controls" style="display:${config.mistakeMode !== 'none' ? 'block' : 'none'};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px;">
                            <span style="font-size:11px; color:rgba(255,255,255,0.5);">Her kaç kelimede bir</span>
                            <input type="number" id="mistake-rate-input" min="2" max="10" value="${config.mistakeRate}"
                                style="width:50px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                                border-radius:6px; color:#ffffff; font-size:12px; font-weight:600; text-align:center;">
                        </div>
                        <div style="font-size:10px; color:rgba(255,255,255,0.4); line-height:1.4; margin-top:6px;">
                            <strong>Gelişmiş:</strong> Hatalı yazar, %70 ihtimalle düzeltir
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                        <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">⚡ Yazma Hızı</label>
                        <input type="number" id="speed-input" min="1" max="300" value="${config.delay}"
                            aria-label="Yazma hızı (milisaniye)"
                            style="width:70px; padding:4px 8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); 
                            border-radius:6px; color:#ffffff; font-size:12px; font-weight:600; text-align:center;">
                    </div>
                    <input type="range" id="bot-slider" min="1" max="300" step="1" value="${config.delay}" 
                        style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                        background:rgba(255,255,255,0.1); cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; margin-top:4px;">
                        <span style="font-size:9px; color:rgba(255,255,255,0.4);">Hızlı (1ms)</span>
                        <span style="font-size:9px; color:rgba(255,255,255,0.4);">Yavaş (300ms)</span>
                    </div>
                </div>

                <button id="btn-main" 
                    style="width:100%; padding:12px; background:linear-gradient(135deg, #007aff 0%, #0051d5 100%); 
                    color:#fff; border:none; cursor:pointer; font-weight:600; font-size:13px; 
                    border-radius:10px; transition:all 0.3s; box-shadow:0 4px 12px rgba(0,122,255,0.3); 
                    letter-spacing:0.3px;">
                    ▶ Başlat
                </button>
            </div>
            
            <div id="info-panel" style="position:absolute; top:0; right:100%; width:280px; height:100%; background:rgba(28, 28, 30, 0.98); border-radius:16px; padding:20px; overflow-y:auto; opacity:0; pointer-events:none; transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 8px 32px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="font-weight:600; font-size:15px; color:#ffffff; letter-spacing:-0.3px;">ℹ️ Bilgi</span>
                    <span id="btn-close-info" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; font-weight:300; transition:color 0.2s; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;">×</span>
                </div>
                <div style="color:rgba(255,255,255,0.8); font-size:12px; line-height:1.6;">
                    <h3 style="color:#007aff; font-size:14px; margin:0 0 12px 0;">KatipOnline Fucker v2.1</h3>
                    <p style="margin:0 0 10px 0;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                    <p style="margin:0 0 10px 0;">Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                    <h4 style="color:#34c759; font-size:13px; margin:16px 0 8px 0;">Özellikler</h4>
                    <ul style="margin:0 0 10px 0; padding-left:20px;">
                        <li>Otomatik yazım asistanı</li>
                        <li>WPM hesaplama ve tahmin</li>
                        <li>İnsan gibi yazma modu</li>
                        <li>Gelişmiş hata yapma sistemi</li>
                        <li>Kelime limiti desteği</li>
                    </ul>
                    <p style="margin:0 0 10px 0;">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
                    <p style="margin:0 0 10px 0;">Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                    <p style="margin:0 0 10px 0;">Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
                    <p style="margin:0 0 10px 0;">Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
                    <p style="margin:0 0 10px 0;">Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
                    <div style="background:rgba(255,149,0,0.1); border-left:3px solid #ff9500; padding:10px; margin-top:16px; border-radius:4px;">
                        <strong style="color:#ff9500;">⚠️ Uyarı:</strong>
                        <p style="margin:4px 0 0 0; font-size:11px;">Bu araç eğitim amaçlıdır. Kullanımınız kendi sorumluluğunuzdadır.</p>
                    </div>
                </div>
            </div>
        `;

        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            right: '24px',
            transform: 'translateY(-50%)',
            width: '280px',
            height: 'auto',
            maxHeight: '90vh',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            color: 'white',
            padding: '0',
            borderRadius: '16px',
            zIndex: '999999',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: config.panelMinimized ? 'none' : 'flex',
            overflow: 'visible'
        });
        
        // Add padding to main panel and make it scrollable
        const mainPanel = panel.querySelector('#main-panel');
        mainPanel.style.padding = '20px';
        mainPanel.style.overflowY = 'auto';
        mainPanel.style.maxHeight = '90vh';

        const icon = document.createElement('div');
        icon.id = 'katip-icon';
        icon.innerHTML = '<span style="font-weight:700; font-size:28px; background:linear-gradient(135deg, #007aff 0%, #34c759 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; text-shadow:0 0 20px rgba(0,122,255,0.6);">KF</span>';
        icon.setAttribute('role', 'button');
        icon.setAttribute('aria-label', 'Paneli Aç');
        icon.setAttribute('tabindex', '0');
        Object.assign(icon.style, {
            position: 'fixed',
            top: '50%',
            right: '24px',
            transform: 'translateY(-50%)',
            width: '64px',
            height: '64px',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '2px solid rgba(0,122,255,0.4)',
            borderRadius: '50%',
            display: config.panelMinimized ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: '999999',
            boxShadow: '0 0 30px rgba(0,122,255,0.5), 0 8px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'kf-glow 2s ease-in-out infinite'
        });

        document.body.appendChild(panel);
        document.body.appendChild(icon);

        // Info panel toggle
        const infoPanel = document.getElementById('info-panel');
        const mainPanelEl = document.getElementById('main-panel');
        
        document.getElementById('btn-info').onclick = () => {
            if (config.infoExpanded) {
                // Close info panel - slide info out to the left, bring main back
                infoPanel.style.transform = '';
                infoPanel.style.opacity = '0';
                infoPanel.style.pointerEvents = 'none';
                mainPanelEl.style.transform = '';
                config.infoExpanded = false;
            } else {
                // Open info panel - slide info in from left (100% to the right), slide main out to right
                infoPanel.style.transform = 'translateX(100%)';
                infoPanel.style.opacity = '1';
                infoPanel.style.pointerEvents = 'auto';
                mainPanelEl.style.transform = 'translateX(100%)';
                config.infoExpanded = true;
            }
        };
        
        document.getElementById('btn-close-info').onclick = () => {
            infoPanel.style.transform = '';
            infoPanel.style.opacity = '0';
            infoPanel.style.pointerEvents = 'none';
            mainPanelEl.style.transform = '';
            config.infoExpanded = false;
        };

        // Minimize/Maximize olayları
        document.getElementById('btn-minimize').onclick = () => {
            panel.style.display = 'none';
            icon.style.display = 'flex';
            config.panelMinimized = true;
            localStorage.setItem('katip-panel-minimized', 'true');
        };

        icon.onclick = () => {
            icon.style.display = 'none';
            panel.style.display = 'block';
            config.panelMinimized = false;
            localStorage.setItem('katip-panel-minimized', 'false');
        };

        // Hover efektleri
        const minimizeBtn = document.getElementById('btn-minimize');
        minimizeBtn.onmouseenter = () => {
            minimizeBtn.style.background = 'rgba(255,255,255,0.1)';
        };
        minimizeBtn.onmouseleave = () => {
            minimizeBtn.style.background = 'transparent';
        };
        
        const infoBtn = document.getElementById('btn-info');
        infoBtn.onmouseenter = () => {
            infoBtn.style.background = 'rgba(255,255,255,0.1)';
            infoBtn.style.transform = 'scale(1.1)';
        };
        infoBtn.onmouseleave = () => {
            infoBtn.style.background = 'transparent';
            infoBtn.style.transform = 'scale(1)';
        };

        icon.onmouseenter = () => {
            icon.style.transform = 'scale(1.15)';
            icon.style.boxShadow = '0 0 40px rgba(0,122,255,0.7), 0 12px 32px rgba(0,0,0,0.4)';
        };
        icon.onmouseleave = () => {
            icon.style.transform = 'scale(1)';
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
            controls.style.display = this.value !== 'none' ? 'block' : 'none';
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
