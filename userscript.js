// ==UserScript==
// @name         <<KatipOnlineFucker>>
// @namespace    http://tampermonkey.net/
// @version      v1
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
        delay: 120, // İki harf arası bekleme süresi (ms)
        debug: true // Konsolda detaylı hata ayıklama görmek için true
    };

    const logger = (msg, type = 'info') => {
        if (!config.debug) return;
        const prefix = '[KATIP-BOT] ';
        if (type === 'error') console.error(prefix + msg);
        else if (type === 'warn') console.warn(prefix + msg);
        else console.log(prefix + msg);
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
        updatePanelUI(false);
        logger('Bot durduruldu.');
    }

    // --- ARAYÜZ ---
    function updatePanelUI(isRunning) {
        const btn = document.getElementById('btn-main');
        const status = document.getElementById('bot-status');
        if (btn && status) {
            if (isRunning) {
                btn.innerText = "DURDUR";
                btn.style.background = "#500";
                status.innerText = "ÇALIŞIYOR";
                status.style.color = "#0f0";
            } else {
                btn.innerText = "BAŞLAT";
                btn.style.background = "#333";
                status.innerText = "BEKLİYOR";
                status.style.color = "orange";
            }
        }
    }

    function createPanel() {
        if (document.getElementById('katip-v12-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'katip-v12-panel';
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:5px;">
                <span style="font-weight:bold; color:#00ffea;">KatiponlineFucker</span>
                <span id="btn-minimize" style="cursor:pointer; color:#aaa;">_</span>
            </div>
            <div style="font-size:10px; margin-bottom:8px; color:#aaa;">Durum: <span id="bot-status" style="color:orange;">BEKLİYOR</span></div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px; display:block; color:#aaa;">Hız: <span id="speed-val" style="color:#fff;">${config.delay}ms</span></label>
                <input type="range" id="bot-slider" min="10" max="300" step="10" value="${config.delay}" style="width:100%; cursor:pointer;">
            </div>
            <button id="btn-main" style="width:100%; padding:5px; background:#333; color:#fff; border:1px solid #555; cursor:pointer; font-weight:bold; font-size:12px; border-radius:3px;">
                BAŞLAT
            </button>
        `;

        Object.assign(panel.style, {
            position: 'fixed', bottom: '20px', right: '20px', width: '200px',
            background: 'rgba(10, 10, 10, 0.95)', color: 'white', padding: '15px',
            borderRadius: '8px', zIndex: '999999', border: `1px solid #00ffea`,
            fontFamily: 'Segoe UI, sans-serif', boxShadow: '0 0 15px rgba(0,0,0,0.6)'
        });

        const icon = document.createElement('div');
        icon.innerText = 'K';
        Object.assign(icon.style, {
            position: 'fixed', bottom: '20px', right: '20px', width: '40px', height: '40px',
            background: '#222', color: '#00ffea', border: '2px solid #00ffea',
            borderRadius: '50%', display: 'none', justifyContent: 'center', alignItems: 'center',
            cursor: 'pointer', zIndex: '999999', fontWeight: 'bold', fontSize: '20px'
        });

        document.body.appendChild(panel);
        document.body.appendChild(icon);

        document.getElementById('btn-minimize').onclick = () => { panel.style.display = 'none'; icon.style.display = 'flex'; };
        icon.onclick = () => { icon.style.display = 'none'; panel.style.display = 'block'; };

        document.getElementById('bot-slider').oninput = function() {
            config.delay = parseInt(this.value);
            document.getElementById('speed-val').innerText = this.value + "ms";
        };

        document.getElementById('btn-main').onclick = () => {
            if (config.active) stopBot();
            else startBot();
        };
    }

    setTimeout(createPanel, 1000);

})();
