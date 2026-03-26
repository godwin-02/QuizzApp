let state = {
    questions: [], currentIndex: 0, score: 0, bonusPoints: 0, 
    lifelineUsed: false, timer: null, timeLeft: 150, user: "Master",
    selectedCat: 9, selectedDiff: 'easy'
};

// Haptics & Audio
const vibrate = (p) => { if ("vibrate" in navigator) navigator.vibrate(p); };
const playSfx = (f, t, d, v=0.05) => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(v, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
};

// Data Management
function getScores() { return JSON.parse(localStorage.getItem('sphere_scores') || '[]'); }
function saveScore(name, score) {
    let s = getScores();
    s.push({ n: name, s: score });
    s.sort((a, b) => b.s - a.s);
    localStorage.setItem('sphere_scores', JSON.stringify(s.slice(0, 5)));
}

function decode(s) { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; }

// UI Views
function init() {
    clearInterval(state.timer);
    const scores = getScores();
    const app = document.getElementById('app');
    
    app.innerHTML = `
        <h2>QUIZ SPHERE</h2>
        <div class="setup-item"><label>Codename</label><input type="text" id="uname" value="${state.user}"></div>
        
        <div class="setup-item" style="position:relative">
            <label>Sector</label>
            <div class="custom-select-trigger" onclick="toggleDD(event, 'cat-opts')">
                <span id="cat-lab">General Knowledge</span> <small>▼</small>
            </div>
            <div class="custom-options" id="cat-opts">
                <div class="custom-option" onclick="setV('cat', 9, 'General Knowledge')">General Knowledge</div>
                <div class="custom-option" onclick="setV('cat', 18, 'Science & Tech')">Science & Tech</div>
                <div class="custom-option" onclick="setV('cat', 21, 'Sports')">Sports</div>
                <div class="custom-option" onclick="setV('cat', 23, 'History')">History</div>
            </div>
        </div>

        <button class="master-btn" onclick="start()">INITIATE SYNC</button>

        <div class="scoreboard">
            <div class="scoreboard-title">Leaderboard</div>
            ${scores.map(s => `
                <div class="score-row"><span>${s.n}</span><span class="score-val">${s.s} XP</span></div>
            `).join('') || '<div style="text-align:center; opacity:0.5; font-size:0.8rem;">No entries yet</div>'}
        </div>
    `;
}

function toggleDD(e, id) { e.stopPropagation(); document.getElementById(id).classList.toggle('open'); }
window.onclick = () => document.querySelectorAll('.custom-options').forEach(o => o.classList.remove('open'));
function setV(t, v, l) { state.selectedCat = v; document.getElementById('cat-lab').innerText = l; }

async function start() {
    state.user = document.getElementById('uname').value || "Guest";
    document.getElementById('app').innerHTML = `<h2 style="opacity:0.3">SYNCING...</h2>`;
    try {
        const res = await fetch(`https://opentdb.com/api.php?amount=5&category=${state.selectedCat}&difficulty=easy&type=multiple`);
        const data = await res.json();
        state.questions = data.results.map(q => {
            const opts = [...q.incorrect_answers, q.correct_answer].sort(() => 0.5 - Math.random());
            return { q: decode(q.question), o: opts.map(decode), a: opts.indexOf(q.correct_answer) };
        });
        state.currentIndex = 0; state.score = 0; state.lifelineUsed = false; state.bonusPoints = 0;
        renderQuestion();
    } catch(e) { init(); }
}

function renderQuestion() {
    clearInterval(state.timer);
    state.timeLeft = 150;
    const q = state.questions[state.currentIndex];
    document.getElementById('app').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:0.7rem; font-weight:900; color:var(--primary)">NODE ${state.currentIndex+1}/5</span>
            <button onclick="use50()" id="ll" style="border:1px solid var(--accent); color:var(--accent); background:none; border-radius:8px; padding:4px 8px; font-size:0.6rem; ${state.lifelineUsed?'display:none':''}">50/50</button>
        </div>
        <div class="timer-container"><div id="t-bar"></div></div>
        <h3 style="margin:0 0 20px 0; font-size:1.1rem;">${q.q}</h3>
        <div id="options">${q.o.map((opt, i) => `<div class="option-card" onclick="check(${i}, this)">${opt}</div>`).join('')}</div>
        <div class="footer-actions">
            <button id="next" style="display:none" class="master-btn" onclick="next()">CONTINUE</button>
            <a href="#" class="exit-link" onclick="init()">ABORT MISSION</a>
        </div>
    `;
    state.timer = setInterval(() => {
        state.timeLeft--;
        const b = document.getElementById('t-bar');
        if(b) b.style.width = (state.timeLeft/150)*100 + "%";
        if(state.timeLeft <= 0) check(-1, null);
    }, 100);
}

function use50() {
    state.lifelineUsed = true;
    const q = state.questions[state.currentIndex];
    const cards = document.querySelectorAll('.option-card');
    [0,1,2,3].filter(i => i !== q.a).sort(() => 0.5 - Math.random()).slice(0,2).forEach(idx => cards[idx].classList.add('faded'));
    document.getElementById('ll').style.display = 'none';
    vibrate(50);
}

function check(idx, el) {
    clearInterval(state.timer);
    const q = state.questions[state.currentIndex];
    document.getElementById('options').style.pointerEvents = 'none';
    if(idx === q.a) {
        el.classList.add('correct'); state.score++;
        if(state.timeLeft > 100) { state.bonusPoints += 50; toast(); }
        playSfx(600, 'sine', 0.1);
    } else {
        if(el) el.classList.add('wrong');
        document.querySelectorAll('.option-card')[q.a].classList.add('correct');
        playSfx(150, 'sawtooth', 0.2); vibrate([100, 50, 100]);
    }
    document.getElementById('next').style.display = 'block';
}

function toast() { const t = document.getElementById('bonus-toast'); t.style.opacity = 1; setTimeout(()=>t.style.opacity=0, 800); }
function next() { state.currentIndex++; if(state.currentIndex < 5) renderQuestion(); else finish(); }

function finish() {
    const total = (state.score * 100) + state.bonusPoints;
    saveScore(state.user, total);
    document.getElementById('app').innerHTML = `
        <h2 style="margin-bottom:10px;">COMPLETE</h2>
        <div style="text-align:center; padding:30px 0;">
            <div style="font-size:4.5rem; font-weight:900; color:var(--primary);">${total}</div>
            <div style="color:#94a3b8; font-weight:800; letter-spacing:2px;">TOTAL XP</div>
        </div>
        <button class="master-btn" onclick="init()">RETURN TO HUB</button>
        <button class="share-btn" onclick="shareResult(${total})">SHARE SCORE</button>
    `;
    vibrate([50, 50, 200]);
}

async function shareResult(total) {
    const text = `🚀 I just scored ${total} XP in Quiz Sphere!`;
    if (navigator.share) { try { await navigator.share({ text: text, url: window.location.href }); } catch(e) {} }
    else { navigator.clipboard.writeText(text); alert("Copied!"); }
}

init();