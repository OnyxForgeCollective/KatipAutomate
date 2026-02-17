// ==UserScript==
// @name         <<KatipOnlineFucker>>
// @namespace    http://tampermonkey.net/
// @version      v2.0
// @description  Katiponline sitesi için oluşturulan robotize yazım scripti.
// @author       PrescionX
// @match        *://*.katiponline.xyz/*
// @match        *://*.katiponline.com/*
// @grant        GM_addStyle
// @run-at       document-end
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
        wordLimit: parseInt(localStorage.getItem('katip-word-limit')) || 50 // Kaç kelime yazılacak
    };

    // --- İSTATİSTİKLER ---
    const stats = {
        startTime: null,
        totalChars: 0,
        totalWords: 0,
        currentWPM: 0,
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
        lastCharWasSpace = true; // Reset word boundary tracking

        // Her saniye istatistikleri güncelle
        if (stats.updateInterval) clearInterval(stats.updateInterval);
        stats.updateInterval = setInterval(updateStatsDisplay, 1000);
    }

    function stopStatsTracking() {
        if (stats.updateInterval) {
            clearInterval(stats.updateInterval);
            stats.updateInterval = null;
        }
    }

    function updateStatsDisplay() {
        const wpmDisplay = document.getElementById('current-wpm');
        const forecast1 = document.getElementById('forecast-1min');
        const forecast3 = document.getElementById('forecast-3min');
        const forecast5 = document.getElementById('forecast-5min');
        const wordsWritten = document.getElementById('words-written');
        const wordsRemaining = document.getElementById('words-remaining');

        if (wpmDisplay) {
            wpmDisplay.innerText = stats.currentWPM || 0;
        }

        if (forecast1) {
            forecast1.innerText = stats.currentWPM;
        }
        if (forecast3) {
            forecast3.innerText = Math.round(stats.currentWPM * 3);
        }
        if (forecast5) {
            forecast5.innerText = Math.round(stats.currentWPM * 5);
        }
        
        if (wordsWritten) {
            wordsWritten.innerText = stats.totalWords;
        }
        
        if (wordsRemaining) {
            if (config.wordLimitEnabled) {
                const remaining = Math.max(0, config.wordLimit - stats.totalWords);
                wordsRemaining.innerText = remaining;
            } else {
                wordsRemaining.innerText = '0';
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

            simulateKey(input, charToType);
            await sleep(config.delay);
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

            await sleep(config.delay);
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

        while (config.active) {
            const activeWordSpan = source.querySelector('.golge');

            if (!activeWordSpan) {
                logger('Aktif kelime bulunamadı, bekleniyor...', 'warn');
                await sleep(200);
                continue;
            }

            const wordToType = activeWordSpan.textContent.trim();
            logger(`Kelime yazılıyor: ${wordToType}`);

            for (let i = 0; i < wordToType.length; i++) {
                if (!config.active) break;
                simulateKey(input, wordToType[i]);
                await sleep(config.delay);
            }

            if (config.active) {
                simulateKey(input, ' ');
                await sleep(config.delay + 30);
            }
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:8px; height:8px; border-radius:50%; background:#34c759; box-shadow:0 0 8px rgba(52,199,89,0.6);"></div>
                    <span style="font-weight:600; font-size:15px; color:#ffffff; letter-spacing:-0.3px;">KatipOnline</span>
                </div>
                <span id="btn-minimize" style="cursor:pointer; color:rgba(255,255,255,0.6); font-size:18px; font-weight:300; transition:color 0.2s; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;">−</span>
            </div>
            
            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">Durum</span>
                    <span id="bot-status" style="font-size:12px; color:#ff9500; font-weight:600;">Bekliyor</span>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:8px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;">İstatistikler</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <div style="background:rgba(0,122,255,0.1); border-radius:8px; padding:8px; border:1px solid rgba(0,122,255,0.2);">
                        <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:2px;">Anlık Hız</div>
                        <div style="font-size:16px; color:#007aff; font-weight:600;"><span id="current-wpm">0</span> <span style="font-size:10px;">WPM</span></div>
                    </div>
                    <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:8px; border:1px solid rgba(52,199,89,0.2);">
                        <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:2px;">1 Dakika</div>
                        <div style="font-size:16px; color:#34c759; font-weight:600;"><span id="forecast-1min">0</span> <span style="font-size:10px;">kelime</span></div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div style="background:rgba(255,149,0,0.1); border-radius:8px; padding:8px; border:1px solid rgba(255,149,0,0.2);">
                        <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:2px;">3 Dakika</div>
                        <div style="font-size:16px; color:#ff9500; font-weight:600;"><span id="forecast-3min">0</span> <span style="font-size:10px;">kelime</span></div>
                    </div>
                    <div style="background:rgba(255,59,48,0.1); border-radius:8px; padding:8px; border:1px solid rgba(255,59,48,0.2);">
                        <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:2px;">5 Dakika</div>
                        <div style="font-size:16px; color:#ff3b30; font-weight:600;"><span id="forecast-5min">0</span> <span style="font-size:10px;">kelime</span></div>
                    </div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">Kelime Limiti</label>
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="checkbox" id="word-limit-toggle" ${config.wordLimitEnabled ? 'checked' : ''} 
                            style="width:16px; height:16px; cursor:pointer;">
                        <span style="font-size:11px; color:rgba(255,255,255,0.6);">Aktif</span>
                    </label>
                </div>
                <div id="word-limit-controls" style="display:${config.wordLimitEnabled ? 'block' : 'none'};">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Hedef Kelime Sayısı</span>
                        <span id="word-limit-val" style="font-size:12px; color:#ffffff; font-weight:600; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px;">${config.wordLimit} kelime</span>
                    </div>
                    <input type="range" id="word-limit-slider" min="10" max="500" step="10" value="${config.wordLimit}" 
                        style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                        background:rgba(255,255,255,0.1); cursor:pointer; margin-bottom:8px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div style="background:rgba(52,199,89,0.1); border-radius:8px; padding:6px; border:1px solid rgba(52,199,89,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px;">Yazılan</div>
                            <div style="font-size:14px; color:#34c759; font-weight:600;"><span id="words-written">0</span></div>
                        </div>
                        <div style="background:rgba(255,149,0,0.1); border-radius:8px; padding:6px; border:1px solid rgba(255,149,0,0.2);">
                            <div style="font-size:9px; color:rgba(255,255,255,0.5); margin-bottom:2px;">Kalan</div>
                            <div style="font-size:14px; color:#ff9500; font-weight:600;"><span id="words-remaining">${config.wordLimit}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12px; color:rgba(255,255,255,0.6); font-weight:500;">Yazma Hızı</label>
                    <span id="speed-val" style="font-size:12px; color:#ffffff; font-weight:600; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px;">${config.delay}ms</span>
                </div>
                <input type="range" id="bot-slider" min="10" max="300" step="10" value="${config.delay}" 
                    style="width:100%; height:6px; border-radius:3px; outline:none; -webkit-appearance:none; 
                    background:rgba(255,255,255,0.1); cursor:pointer;">
                <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span style="font-size:9px; color:rgba(255,255,255,0.4);">Hızlı</span>
                    <span style="font-size:9px; color:rgba(255,255,255,0.4);">Yavaş</span>
                </div>
            </div>

            <button id="btn-main" 
                style="width:100%; padding:12px; background:linear-gradient(135deg, #007aff 0%, #0051d5 100%); 
                color:#fff; border:none; cursor:pointer; font-weight:600; font-size:13px; 
                border-radius:10px; transition:all 0.3s; box-shadow:0 4px 12px rgba(0,122,255,0.3); 
                letter-spacing:0.3px;">
                ▶ Başlat
            </button>
        `;

        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '280px',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            color: 'white',
            padding: '20px',
            borderRadius: '16px',
            zIndex: '999999',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: config.panelMinimized ? 'none' : 'block'
        });

        const icon = document.createElement('div');
        icon.id = 'katip-icon';
        icon.innerText = '⌨️';
        icon.setAttribute('role', 'button');
        icon.setAttribute('aria-label', 'Paneli Aç');
        icon.setAttribute('tabindex', '0');
        Object.assign(icon.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            background: 'rgba(28, 28, 30, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            color: '#007aff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%',
            display: config.panelMinimized ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: '999999',
            fontWeight: 'bold',
            fontSize: '24px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        document.body.appendChild(panel);
        document.body.appendChild(icon);

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

        icon.onmouseenter = () => {
            icon.style.transform = 'scale(1.1)';
            icon.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)';
        };
        icon.onmouseleave = () => {
            icon.style.transform = 'scale(1)';
            icon.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
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
        slider.oninput = function() {
            config.delay = parseInt(this.value);
            document.getElementById('speed-val').innerText = this.value + "ms";
            localStorage.setItem('katip-speed', this.value);
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
        wordLimitSlider.oninput = function() {
            config.wordLimit = parseInt(this.value);
            document.getElementById('word-limit-val').innerText = this.value + " kelime";
            localStorage.setItem('katip-word-limit', this.value);
            updateStatsDisplay();
        };

        // Slider stili
        const style = document.createElement('style');
        style.textContent = `
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
