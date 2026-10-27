/* =========================================================
   拾字工坊 · 熔炉模式 / WORD FOUNDRY — FORGE 2
   Untimed rounds, storable skill deck, forged BGM.

   - lowercase letter tiles
   - no round timer: player clicks END ROUND
   - 4 skill cards: reveal / reroll 5 / discard 4 / transmute 1
   - skill deck max 5, +1 per round, full-deck choice modal
   - 300-tile bag weighted by corpus letter frequency
   - 15 starting tiles, +5 per round, 30 overheat limit, two rows
   ========================================================= */
(function () {
  'use strict';

  var CONFIG = Object.freeze({
    startHand: 15,
    drawPerTurn: 5,
    handLimit: 30,
    targetScore: 2000,
    minWordLen: 3,
    maxWordLen: 10,
    comboStep: 0.2,
    comboMax: 3.0,
    lengthBonus: 20,
    lengthBonusBase: 3,
    letterScoreMult: 10,
    bagSize: 300,
    skillLimit: 5
  });

  var LETTER_VALUES = Object.freeze({
    a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1,
    j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1,
    s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
  });

  var REPEAT = [1, 0.5, 0.25, 0];

  /* ---------- word data ---------- */
  var RAW = (typeof WORDS !== 'undefined' ? WORDS : []);
  var PLAYABLE = [];
  var WORD_SET = new Set();
  var GLOSS = new Map();
  var DISPLAY = new Map();

  RAW.forEach(function (row) {
    var w = String(row[0] || '').toLowerCase();
    if (!/^[a-z]{3,10}$/.test(w)) return;
    PLAYABLE.push(w);
    WORD_SET.add(w);
    if (!GLOSS.has(w)) GLOSS.set(w, String(row[1] || ''));
    if (!DISPLAY.has(w)) DISPLAY.set(w, String(row[2] || w));
  });

  /* ---------- letter bag weighted by corpus frequency ---------- */
  function computeDistribution() {
    var freq = Object.create(null);
    var total = 0;
    PLAYABLE.forEach(function (w) {
      for (var i = 0; i < w.length; i++) {
        freq[w[i]] = (freq[w[i]] || 0) + 1;
        total += 1;
      }
    });
    var letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    var raw = Object.create(null);
    var counts = Object.create(null);
    var sum = 0;
    letters.forEach(function (ch) {
      var exact = (freq[ch] || 0) / total * CONFIG.bagSize;
      raw[ch] = exact;
      counts[ch] = Math.max(2, Math.floor(exact));
      sum += counts[ch];
    });
    var guard = 0;
    while (sum < CONFIG.bagSize && guard++ < 4000) {
      var pick = null;
      var best = -1e9;
      letters.forEach(function (ch) {
        var rem = raw[ch] - counts[ch];
        if (rem > best && counts[ch] < 42) { best = rem; pick = ch; }
      });
      if (!pick) break;
      counts[pick] += 1;
      sum += 1;
    }
    guard = 0;
    while (sum > CONFIG.bagSize && guard++ < 4000) {
      var drop = null;
      var worst = 1e9;
      letters.forEach(function (ch) {
        var rem = raw[ch] - counts[ch];
        if (rem < worst && counts[ch] > 2) { worst = rem; drop = ch; }
      });
      if (!drop) break;
      counts[drop] -= 1;
      sum -= 1;
    }
    return { counts: counts, total: sum, letters: letters };
  }

  var DIST = computeDistribution();
  var BAG = [];

  function rebuildBag() {
    BAG = [];
    DIST.letters.forEach(function (ch) {
      for (var i = 0; i < DIST.counts[ch]; i++) BAG.push(ch);
    });
    for (var i = BAG.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = BAG[i]; BAG[i] = BAG[j]; BAG[j] = t;
    }
  }

  function drawLetter() {
    if (!BAG.length) rebuildBag();
    return BAG.pop();
  }

  /* ---------- helpers ---------- */
  function letterSum(word) {
    var s = 0;
    for (var i = 0; i < word.length; i++) s += LETTER_VALUES[word[i]] || 0;
    return s;
  }

  function comboMult(combo) {
    return Math.min(CONFIG.comboMax, 1 + CONFIG.comboStep * Math.max(0, combo));
  }

  function repeatMult(word) {
    var n = state.used.get(word) || 0;
    return REPEAT[Math.min(n, REPEAT.length - 1)];
  }

  function countHand() {
    var c = Object.create(null);
    state.hand.forEach(function (card) {
      c[card.ch] = (c[card.ch] || 0) + 1;
    });
    return c;
  }

  function canSpell(word, counts) {
    var need = Object.create(null);
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      need[ch] = (need[ch] || 0) + 1;
      if (need[ch] > (counts[ch] || 0)) return false;
    }
    return true;
  }

  function candidatesFor(hand) {
    var counts = Object.create(null);
    hand.forEach(function (card) { counts[card.ch] = (counts[card.ch] || 0) + 1; });
    var out = [];
    for (var i = 0; i < PLAYABLE.length; i++) {
      var w = PLAYABLE[i];
      if (state.used.has(w)) continue;
      if (canSpell(w, counts)) out.push(w);
    }
    return out;
  }

  function shortGloss(word) {
    var g = String(GLOSS.get(word) || '').split(/[；;]/)[0].trim();
    if (!g) return '';
    return g.length > 10 ? g.slice(0, 10) : g;
  }

  /* ---------- skills ---------- */
  var SKILLS = {
    reveal: {
      id: 'reveal', name: '透视', en: 'REVEAL', icon: 'ic-skill-reveal',
      color: 'cyan', desc: '显示一个可拼的单词'
    },
    reroll: {
      id: 'reroll', name: '重铸', en: 'REROLL', icon: 'ic-skill-reroll',
      color: 'green', desc: '选 5 张牌，从牌堆随机替换'
    },
    discard: {
      id: 'discard', name: '熔毁', en: 'DISCARD', icon: 'ic-skill-discard',
      color: 'coral', desc: '弃掉 4 张牌'
    },
    transmute: {
      id: 'transmute', name: '点石成字', en: 'TRANSMUTE', icon: 'ic-skill-transmute',
      color: 'amber', desc: '把 1 张牌变成任意字母'
    }
  };
  var SKILL_ORDER = ['reveal', 'reroll', 'discard', 'transmute'];

  /* ---------- state ---------- */
  var state = {
    running: false,
    paused: true,
    transitioning: false,
    warned: false,
    score: 0,
    round: 1,
    combo: 0,
    hand: [],
    selected: [],
    skills: [],
    mode: 'spell',
    pendingSkill: null,
    targetSelected: [],
    revealed: null,
    used: new Map(),
    forged: 0,
    recent: [],
    nextId: 1,
    best: 0,
    lastTs: 0,
    skillFullSelected: -1
  };

  try {
    state.best = Number(localStorage.getItem('wordfoundry.forge.best')) || 0;
  } catch (e) { state.best = 0; }

  function saveBest() {
    if (state.score <= state.best) return;
    state.best = state.score;
    try { localStorage.setItem('wordfoundry.forge.best', String(state.best)); } catch (e) { /* ignore */ }
  }

  /* ---------- dom ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var dom = {
    stage: $('stage'),
    score: $('score'),
    scoreBar: $('score-bar'),
    combo: $('combo'),
    comboBox: $('combo-box'),
    round: $('round'),
    roundHint: $('round-hint'),
    hand: $('hand'),
    handCount: $('hand-count'),
    handTip: $('hand-tip'),
    heat: $('heat'),
    slots: $('slots'),
    wordPreview: $('word-preview'),
    panelTip: $('panel-tip'),
    bubble: $('bubble'),
    mascot: $('mascot'),
    skillList: $('skill-list'),
    skillCount: $('skill-count'),
    menu: $('menu'),
    result: $('result'),
    resultKicker: $('result-kicker'),
    resultTitle: $('result-title'),
    resultScore: $('result-score'),
    resultSub: $('result-sub'),
    resultWords: $('result-words'),
    modal: $('modal'),
    modalTitle: $('modal-title'),
    modalBody: $('modal-body'),
    targetBar: $('target-bar'),
    targetText: $('target-text'),
    btnTargetConfirm: $('btn-target-confirm'),
    btnTargetCancel: $('btn-target-cancel'),
    picker: $('picker'),
    pickerGrid: $('picker-grid'),
    btnPickerCancel: $('btn-picker-cancel'),
    skillFull: $('skill-full'),
    skillFullList: $('skill-full-list'),
    btnSkillReplace: $('btn-skill-replace'),
    btnSkillKeep: $('btn-skill-keep'),
    toast: $('toast'),
    flash: $('flash'),
    banner: $('banner'),
    fx: $('fx'),
    bgm: $('bgm'),
    btnBgm: $('btn-bgm'),
    btnSound: $('btn-sound'),
    btnInfo: $('btn-info'),
    btnStart: $('btn-start'),
    btnAgain: $('btn-again'),
    btnEndRound: $('btn-end-round'),
    btnForge: $('btn-forge'),
    btnClear: $('btn-clear'),
    btnUndo: $('btn-undo'),
    btnModalClose: $('btn-modal-close')
  };

  /* ---------- audio ---------- */
  var Sound = (function () {
    var ctx = null;
    var noiseBuf = null;
    var enabled = true;
    var on = true;

    function init() {
      if (!enabled) return;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return; }
        try { ctx = new AC(); } catch (e) { enabled = false; return; }
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var data = noiseBuf.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    }

    function tone(freq, dur, type, vol, slide, delay) {
      if (!on || !ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.03, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    function noise(dur, vol, filterType, filterFreq, delay) {
      if (!on || !ctx || !noiseBuf) return;
      var t0 = ctx.currentTime + (delay || 0);
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      var gain = ctx.createGain();
      var filt = ctx.createBiquadFilter();
      filt.type = filterType || 'highpass';
      filt.frequency.value = filterFreq || 700;
      gain.gain.setValueAtTime(vol || 0.02, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    function clang(base, vol, delay) {
      if (!on || !ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var ratios = [1, 2.76, 5.4, 8.9];
      var gains = [1, 0.55, 0.3, 0.16];
      var dur = 0.5;
      for (var i = 0; i < ratios.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = base * ratios[i];
        gain.gain.setValueAtTime((vol || 0.04) * gains[i], t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (1 - i * 0.12));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
      noise(0.035, (vol || 0.04) * 0.8, 'highpass', 1200, delay || 0);
    }

    function play(name) {
      if (!on) return;
      init();
      if (!ctx) return;
      switch (name) {
        case 'select':
          tone(920, 0.025, 'square', 0.020);
          noise(0.018, 0.010, 'highpass', 2200);
          break;
        case 'undo':
          tone(330, 0.06, 'triangle', 0.020, 220);
          break;
        case 'draw':
          noise(0.075, 0.026, 'bandpass', 900);
          tone(240, 0.05, 'triangle', 0.014, 300);
          break;
        case 'correct':
          clang(520, 0.045);
          tone(880, 0.09, 'square', 0.022, null, 0.06);
          break;
        case 'wrong':
          tone(160, 0.18, 'sawtooth', 0.035, 85);
          break;
        case 'skill':
          clang(680, 0.035);
          tone(620, 0.12, 'sine', 0.030, 1200);
          tone(1240, 0.16, 'sine', 0.020, null, 0.05);
          break;
        case 'combo':
          tone(880, 0.07, 'square', 0.026);
          tone(1320, 0.11, 'square', 0.024, null, 0.055);
          break;
        case 'round':
          clang(390, 0.05);
          tone(98, 0.16, 'triangle', 0.03, 70);
          break;
        case 'bust':
          tone(120, 0.5, 'sawtooth', 0.045, 42);
          noise(0.4, 0.05, 'lowpass', 300);
          break;
        case 'win':
          [523, 659, 784, 1046].forEach(function (f, i) {
            tone(f, 0.18, 'square', 0.030, null, i * 0.11);
          });
          clang(660, 0.04, 0.1);
          break;
        default: break;
      }
    }

    function drawBurst(n) {
      for (var i = 0; i < Math.min(5, n); i++) {
        setTimeout(function () { play('draw'); }, i * 55);
      }
    }

    return {
      init: init,
      play: play,
      drawBurst: drawBurst,
      toggle: function () { on = !on; return on; },
      isOn: function () { return on; }
    };
  })();

  var BGM = (function () {
    var el = dom.bgm;
    var on = true;
    var base = 0.26;
    var timer = 0;

    function setVol(v) {
      if (el) el.volume = Math.max(0, Math.min(1, v));
    }

    function fadeTo(v, ms) {
      if (!el) return;
      clearInterval(timer);
      var from = el.volume;
      var t0 = performance.now();
      timer = setInterval(function () {
        var k = Math.min(1, (performance.now() - t0) / (ms || 400));
        setVol(from + (v - from) * k);
        if (k >= 1) clearInterval(timer);
      }, 30);
    }

    function start() {
      if (!el || !on) return;
      if (!el.paused && el.volume > 0) { fadeTo(base, 500); return; }
      setVol(0);
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked; retry on gesture */ });
      fadeTo(base, 1200);
    }

    function toggle() {
      on = !on;
      if (!el) return on;
      if (!on) {
        fadeTo(0, 300);
      } else {
        start();
      }
      return on;
    }

    return {
      start: start,
      toggle: toggle,
      duck: function () { if (on && el) fadeTo(0.10, 400); },
      unduck: function () { if (on && el) fadeTo(base, 600); },
      isOn: function () { return on; }
    };
  })();

  /* ---------- particles ---------- */
  var FX = (function () {
    var canvas = dom.fx;
    var ctx = canvas.getContext('2d');
    var parts = [];
    var lastEmber = 0;

    function spawn(x, y, n, opt) {
      opt = opt || {};
      var colors = opt.colors || ['#ffb03a', '#ff4d2e', '#ffe6a8'];
      for (var i = 0; i < n; i++) {
        var a = opt.angle != null ? opt.angle + (Math.random() - 0.5) * (opt.spread || 1.2) : Math.random() * Math.PI * 2;
        var sp = (opt.speed || 100) * (0.4 + Math.random() * 1.1);
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (opt.lift || 0),
          life: (opt.life || 0.6) * (0.6 + Math.random() * 0.8),
          size: opt.size || 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: opt.gravity == null ? 260 : opt.gravity
        });
      }
    }

    function step(dt) {
      ctx.clearRect(0, 0, 1280, 720);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.2));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      var now = performance.now();
      if (now - lastEmber > 90) {
        lastEmber = now;
        parts.push({
          x: 150 + Math.random() * 60,
          y: 470 + Math.random() * 20,
          vx: -12 + Math.random() * 24,
          vy: -40 - Math.random() * 40,
          life: 1.4 + Math.random() * 1.4,
          size: Math.random() < 0.2 ? 3 : 2,
          color: Math.random() < 0.5 ? '#ffb03a' : '#ff4d2e',
          gravity: -10
        });
      }
    }

    return { spawn: spawn, step: step };
  })();

  /* ---------- UI helpers ---------- */
  var toastTimer = 0;

  function toast(text, kind) {
    dom.toast.textContent = text;
    dom.toast.className = 'toast show' + (kind ? ' is-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.className = 'toast'; }, 1400);
  }

  function banner(text) {
    dom.banner.textContent = text;
    dom.banner.classList.remove('show');
    void dom.banner.offsetWidth;
    dom.banner.classList.add('show');
  }

  function flash(kind) {
    dom.flash.className = 'flash';
    void dom.flash.offsetWidth;
    dom.flash.classList.add(kind || 'fire');
    setTimeout(function () { dom.flash.className = 'flash'; }, 340);
  }

  function shake() {
    dom.stage.classList.remove('shake');
    void dom.stage.offsetWidth;
    dom.stage.classList.add('shake');
    setTimeout(function () { dom.stage.classList.remove('shake'); }, 260);
  }

  function stagePoint(el) {
    var r = el.getBoundingClientRect();
    var s = dom.stage.getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - s.left) / s.width * 1280,
      y: (r.top + r.height / 2 - s.top) / s.height * 720
    };
  }

  function hitText(text, x, y, cls) {
    var d = document.createElement('div');
    d.className = 'hit ' + (cls || '');
    d.textContent = text;
    d.style.left = Math.round(x) + 'px';
    d.style.top = Math.round(y) + 'px';
    dom.stage.appendChild(d);
    setTimeout(function () { d.remove(); }, 900);
  }

  function comboStamp(text) {
    var d = document.createElement('div');
    d.className = 'combo-slam';
    d.textContent = text;
    dom.stage.appendChild(d);
    setTimeout(function () { d.remove(); }, 760);
  }

  function say(text) {
    if (text && dom.bubble.textContent !== text) dom.bubble.textContent = text;
  }

  var mascotExpr = 'idle';

  function setMascot(expr) {
    if (mascotExpr === expr) return;
    mascotExpr = expr;
    dom.mascot.src = 'assets/cat-' + expr + '.png';
    dom.mascot.className = 'mascot' + (expr === 'hype' ? ' is-hype' : expr === 'panic' ? ' is-panic' : '');
  }

  function cheer() {
    setMascot('hype');
    say(['锻得好！', '这一锤漂亮。', '炉温上来了！', '再来一个长词！'][Math.floor(Math.random() * 4)]);
    setTimeout(function () {
      if (state.running && state.hand.length <= CONFIG.handLimit) setMascot('idle');
    }, 900);
  }

  /* ---------- render ---------- */
  function renderScore() {
    dom.score.textContent = state.score.toLocaleString('en-US');
    dom.scoreBar.style.width = Math.min(100, state.score / CONFIG.targetScore * 100) + '%';
    dom.combo.textContent = '×' + comboMult(state.combo).toFixed(1);
    dom.comboBox.classList.toggle('is-hot', state.combo >= 3);
    dom.round.textContent = String(state.round);
  }

  function renderHand() {
    var n = state.hand.length;
    dom.hand.textContent = '';

    var rows = n <= 1 ? 1 : 2;
    var per = Math.max(1, Math.ceil(n / rows));
    var gap = 6;
    var cw = Math.min(60, Math.max(36, Math.floor((1232 - gap * (per - 1)) / per)));
    var chh = Math.min(79, Math.round(cw * 1.3));

    var cursor = 0;
    for (var r = 0; r < rows; r++) {
      var take = Math.min(per, n - cursor);
      if (take <= 0) break;
      var row = document.createElement('div');
      row.className = 'hand-row';
      for (var i = 0; i < take; i++) {
        var card = state.hand[cursor + i];
        var cls = 'card';
        if (state.mode === 'spell' && state.selected.indexOf(card.id) >= 0) cls += ' is-selected';
        if (state.mode !== 'spell') {
          cls += ' is-targetable';
          if (state.targetSelected.indexOf(card.id) >= 0) cls += ' is-targeted';
        }
        var btn = document.createElement('button');
        btn.className = cls;
        btn.dataset.id = String(card.id);
        btn.style.setProperty('--cw', cw + 'px');
        btn.style.setProperty('--chh', chh + 'px');
        btn.style.width = cw + 'px';
        btn.style.height = chh + 'px';
        btn.setAttribute('aria-label', '字母 ' + card.ch);
        var ch = document.createElement('span');
        ch.className = 'ch';
        ch.textContent = card.ch;
        var val = document.createElement('span');
        val.className = 'val';
        val.textContent = String(LETTER_VALUES[card.ch] || 1);
        btn.appendChild(ch);
        btn.appendChild(val);
        row.appendChild(btn);
      }
      dom.hand.appendChild(row);
      cursor += take;
    }

    dom.handCount.textContent = String(n);
    dom.handCount.style.color = n > CONFIG.handLimit ? 'var(--red)' : '';
  }

  function renderHeat() {
    var pips = dom.heat.children;
    var overheated = state.hand.length > CONFIG.handLimit;
    for (var i = 0; i < pips.length; i++) {
      var on = i < state.hand.length;
      pips[i].className = 'pip' + (on ? ' on' : '') + (on && overheated ? ' warn' : '');
    }
    var over = state.hand.length - CONFIG.handLimit;
    dom.handTip.textContent = over > 0
      ? '过热 +' + over + ' · 结束回合会爆牌'
      : state.hand.length >= 27 ? '快爆牌了 · 30 张就过热' : '两行 · 30 张过热';
    dom.handTip.classList.toggle('is-danger', over > 0);
  }

  function targetInstruction() {
    var p = state.pendingSkill;
    if (!p) return '';
    if (p.type === 'reroll') return '重铸：选择 ' + p.need + ' 张要替换的牌（' + state.targetSelected.length + '/' + p.need + '）';
    if (p.type === 'discard') return '熔毁：选择 ' + p.need + ' 张要弃掉的牌（' + state.targetSelected.length + '/' + p.need + '）';
    return '点石成字：选择 1 张要变形的牌（' + state.targetSelected.length + '/1）';
  }

  function renderSlots() {
    dom.slots.textContent = '';
    var inSkill = state.mode !== 'spell';

    if (inSkill) {
      for (var s = 0; s < CONFIG.maxWordLen; s++) {
        var empty = document.createElement('div');
        empty.className = 'slot';
        dom.slots.appendChild(empty);
      }
      dom.wordPreview.textContent = targetInstruction();
      dom.wordPreview.className = 'word-preview';
      dom.btnForge.disabled = true;
      dom.btnClear.disabled = true;
      dom.btnUndo.disabled = true;
      return;
    }

    dom.btnClear.disabled = false;
    dom.btnUndo.disabled = false;

    for (var i = 0; i < CONFIG.maxWordLen; i++) {
      var slot = document.createElement('div');
      slot.className = 'slot';
      if (i < state.selected.length) {
        var card = state.hand.find(function (c) { return c.id === state.selected[i]; });
        if (card) {
          slot.classList.add('is-filled');
          var ch = document.createElement('span');
          ch.className = 'ch';
          ch.textContent = card.ch;
          slot.appendChild(ch);
          slot.dataset.index = String(i);
        }
      } else if (i === state.selected.length) {
        slot.classList.add('is-next');
      }
      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = String(i + 1);
      slot.appendChild(idx);
      dom.slots.appendChild(slot);
    }

    var word = state.selected.map(function (id) {
      var c = state.hand.find(function (x) { return x.id === id; });
      return c ? c.ch : '';
    }).join('');
    if (!word) {
      dom.wordPreview.textContent = '点击下方字母牌，按顺序拼出单词';
      dom.wordPreview.className = 'word-preview';
    } else {
      dom.wordPreview.textContent = word + '  ·  ' + word.length + ' letters';
      dom.wordPreview.className = 'word-preview';
    }
    dom.btnForge.disabled = word.length < CONFIG.minWordLen;
  }

  function skillInner(id) {
    var s = SKILLS[id];
    return '<img class="skill-icon" src="assets/' + s.icon + '.png" alt="">' +
      '<div class="skill-main">' +
      '<div class="skill-name">' + s.name + ' <span class="skill-en">' + s.en + '</span></div>' +
      '<div class="skill-desc">' + s.desc + '</div>' +
      '</div>' +
      '<span class="skill-use">USE</span>';
  }

  function renderSkills() {
    dom.skillCount.textContent = String(state.skills.length);
    dom.skillList.textContent = '';
    for (var i = 0; i < CONFIG.skillLimit; i++) {
      var id = state.skills[i];
      if (id) {
        var btn = document.createElement('button');
        btn.className = 'skill-card sk-' + SKILLS[id].color +
          (state.pendingSkill && state.pendingSkill.index === i ? ' is-pending' : '');
        btn.dataset.index = String(i);
        btn.innerHTML = skillInner(id);
        dom.skillList.appendChild(btn);
      } else {
        var slot = document.createElement('div');
        slot.className = 'skill-slot empty';
        slot.textContent = 'EMPTY';
        dom.skillList.appendChild(slot);
      }
    }
  }

  function renderReveal() {
    if (state.revealed) {
      var ok = canSpell(state.revealed.word, countHand());
      dom.panelTip.textContent = 'REVEAL · ' + state.revealed.word + ' · ' + state.revealed.gloss +
        (ok ? '' : ' · 已失效');
      dom.panelTip.className = 'panel-tip is-reveal' + (ok ? '' : ' is-spent');
    } else {
      dom.panelTip.textContent = '长词加成 · 连击 ×3.0 封顶 · 重复词衰减';
      dom.panelTip.className = 'panel-tip';
    }
  }

  function renderTargetBar() {
    var active = state.mode !== 'spell';
    dom.targetBar.classList.toggle('hidden', !active);
    if (!active) return;
    dom.targetText.textContent = targetInstruction();
    dom.btnTargetConfirm.disabled = state.targetSelected.length !== state.pendingSkill.need;
  }

  function renderAll() {
    renderScore();
    renderHand();
    renderHeat();
    renderSlots();
    renderSkills();
    renderReveal();
    renderTargetBar();

    var over = state.hand.length > CONFIG.handLimit;
    dom.btnEndRound.classList.toggle('is-danger', over);
    dom.btnEndRound.textContent = over ? '结束回合 · 会爆牌' : '结束回合';
    dom.btnEndRound.disabled = !state.running || state.transitioning || state.mode !== 'spell';
  }

  /* ---------- skills ---------- */
  function randomSkill() {
    var owned = state.skills.slice();
    var pool = SKILL_ORDER.filter(function (id) { return owned.indexOf(id) < 0; });
    if (!pool.length) pool = SKILL_ORDER;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function grantSkill() {
    if (state.skills.length >= CONFIG.skillLimit) {
      openSkillFull();
      return false;
    }
    var id = randomSkill();
    state.skills.push(id);
    Sound.play('skill');
    toast('获得技能牌 · ' + SKILLS[id].name, 'good');
    renderSkills();
    return true;
  }

  function useSkill(index) {
    if (!state.running || state.paused || state.transitioning || state.mode !== 'spell') return;
    var id = state.skills[index];
    if (!id) return;

    if (id === 'reveal') {
      var cands = candidatesFor(state.hand);
      if (!cands.length) {
        toast('当前没有可拼的词', 'bad');
        return;
      }
      var pool = cands.filter(function (w) { return w.length >= 4 && w.length <= 8; });
      if (!pool.length) pool = cands;
      if (pool.length > 140) pool = pool.slice(0, 140);
      var word = pool[Math.floor(Math.random() * pool.length)];
      state.revealed = { word: word, gloss: shortGloss(word) || word };
      state.skills.splice(index, 1);
      Sound.play('skill');
      flash('fire');
      banner('REVEAL');
      renderAll();
      toast('透视：' + word + ' · ' + (shortGloss(word) || ''), 'good');
      return;
    }

    if (id === 'reroll') {
      if (state.hand.length < 5) { toast('手牌不足 5 张', 'bad'); return; }
      startTarget('reroll', 5, index);
    } else if (id === 'discard') {
      if (state.hand.length < 4) { toast('手牌不足 4 张', 'bad'); return; }
      startTarget('discard', 4, index);
    } else if (id === 'transmute') {
      if (!state.hand.length) { toast('手牌为空', 'bad'); return; }
      startTarget('transmute', 1, index);
    }
  }

  function startTarget(type, need, index) {
    state.mode = type;
    state.pendingSkill = { type: type, need: need, index: index };
    state.targetSelected = [];
    state.selected = [];
    state.paused = false;
    Sound.play('skill');
    toast(targetInstruction(), 'good');
    renderAll();
  }

  function clearMode() {
    state.mode = 'spell';
    state.pendingSkill = null;
    state.targetSelected = [];
    state.selected = [];
    dom.targetBar.classList.add('hidden');
    dom.picker.classList.add('hidden');
    state.paused = false;
  }

  function toggleTarget(id) {
    if (!state.running || state.paused || !state.pendingSkill) return;
    var i = state.targetSelected.indexOf(id);
    if (i >= 0) {
      state.targetSelected.splice(i, 1);
      Sound.play('undo');
    } else {
      if (state.targetSelected.length >= state.pendingSkill.need) {
        toast('最多选 ' + state.pendingSkill.need + ' 张', 'bad');
        return;
      }
      state.targetSelected.push(id);
      Sound.play('select');
    }
    renderHand();
    renderSlots();
    renderTargetBar();
    if (state.pendingSkill.type === 'transmute' && state.targetSelected.length === 1 && !isPickerOpen()) {
      openPicker();
    }
  }

  function cancelTarget() {
    if (state.mode === 'spell') return;
    clearMode();
    renderAll();
    toast('已取消，技能牌保留');
  }

  function consumeSkill(index) {
    if (index >= 0 && index < state.skills.length) state.skills.splice(index, 1);
  }

  function confirmTarget() {
    if (!state.pendingSkill || state.paused) return;
    var p = state.pendingSkill;
    if (state.targetSelected.length !== p.need) return;

    var ids = state.targetSelected.slice();
    if (p.type === 'reroll') {
      state.hand = state.hand.filter(function (c) { return ids.indexOf(c.id) < 0; });
      drawCards(p.need);
      toast('重铸完成 · 换了 ' + p.need + ' 张牌', 'good');
      Sound.drawBurst(p.need);
    } else if (p.type === 'discard') {
      state.hand = state.hand.filter(function (c) { return ids.indexOf(c.id) < 0; });
      toast('熔毁完成 · 弃掉 ' + p.need + ' 张牌', 'good');
    } else {
      return;
    }

    consumeSkill(p.index);
    var center = stagePoint(document.querySelector('.spell-panel'));
    FX.spawn(center.x, center.y, 26, { colors: ['#7cffb2', '#37e0ff', '#ffe6a8'], speed: 150, gravity: 220, life: 0.6 });
    flash('fire');
    shake();
    clearMode();
    renderAll();
  }

  /* ---------- letter picker ---------- */
  function isPickerOpen() {
    return !dom.picker.classList.contains('hidden');
  }

  function openPicker() {
    if (!dom.pickerGrid.children.length) {
      'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function (ch) {
        var b = document.createElement('button');
        b.className = 'letter-key';
        b.dataset.letter = ch;
        b.textContent = ch;
        dom.pickerGrid.appendChild(b);
      });
    }
    state.paused = true;
    dom.picker.classList.remove('hidden');
  }

  function closePicker() {
    dom.picker.classList.add('hidden');
    state.paused = false;
  }

  function applyTransmute(letter) {
    if (state.mode !== 'transmute' || !state.pendingSkill) return;
    var id = state.targetSelected[0];
    var card = state.hand.find(function (c) { return c.id === id; });
    if (!card) return;
    card.ch = letter;
    consumeSkill(state.pendingSkill.index);
    closePicker();
    clearMode();
    Sound.play('skill');
    flash('fire');
    toast('点石成字 · ' + letter, 'good');
    renderAll();
  }

  /* ---------- skill-full modal ---------- */
  function openSkillFull() {
    state.paused = true;
    state.skillFullSelected = -1;
    dom.skillFullList.textContent = '';
    state.skills.forEach(function (id, i) {
      var b = document.createElement('button');
      b.className = 'skill-pick sk-' + SKILLS[id].color;
      b.dataset.index = String(i);
      b.innerHTML = skillInner(id);
      dom.skillFullList.appendChild(b);
    });
    dom.btnSkillReplace.disabled = true;
    dom.skillFull.classList.remove('hidden');
  }

  function closeSkillFull() {
    dom.skillFull.classList.add('hidden');
    state.paused = false;
    state.skillFullSelected = -1;
  }

  function selectSkillFull(index) {
    state.skillFullSelected = index;
    var kids = dom.skillFullList.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('is-selected', i === index);
    }
    dom.btnSkillReplace.disabled = index < 0;
  }

  function replaceFullSkill() {
    if (state.skillFullSelected < 0) return;
    var old = state.skills[state.skillFullSelected];
    state.skills.splice(state.skillFullSelected, 1);
    var id = randomSkill();
    state.skills.push(id);
    closeSkillFull();
    Sound.play('skill');
    renderAll();
    toast('丢弃 ' + SKILLS[old].name + ' · 获得 ' + SKILLS[id].name, 'good');
  }

  function keepFullSkills() {
    closeSkillFull();
    renderAll();
    toast('保留全部技能牌 · 本回合不获得新技能');
  }

  /* ---------- hand / round flow ---------- */
  function drawCards(n) {
    for (var i = 0; i < n; i++) {
      state.hand.push({ id: state.nextId++, ch: drawLetter() });
    }
    if (state.hand.length > CONFIG.handLimit && !state.warned) {
      state.warned = true;
      setMascot('panic');
      say('过热了！结束回合前把牌打下去。');
      toast('手牌超过 30 张 · 结束回合会爆牌', 'bad');
    }
    if (state.hand.length <= CONFIG.handLimit) state.warned = false;
  }

  function ensurePlayable() {
    if (candidatesFor(state.hand).length) return;
    var fallback = PLAYABLE.filter(function (w) { return w.length === 3; });
    if (!fallback.length) return;
    var word = fallback[Math.floor(Math.random() * fallback.length)];
    for (var i = 0; i < 3 && i < state.hand.length; i++) {
      state.hand[state.hand.length - 1 - i].ch = word[i];
    }
  }

  function newGame() {
    state.running = true;
    state.paused = false;
    state.transitioning = false;
    state.warned = false;
    state.score = 0;
    state.round = 1;
    state.combo = 0;
    state.hand = [];
    state.selected = [];
    state.skills = [];
    state.mode = 'spell';
    state.pendingSkill = null;
    state.targetSelected = [];
    state.revealed = null;
    state.used = new Map();
    state.forged = 0;
    state.recent = [];
    state.nextId = 1;
    state.skillFullSelected = -1;

    rebuildBag();
    drawCards(CONFIG.startHand);
    ensurePlayable();

    dom.stage.classList.remove('is-menu');
    dom.menu.classList.add('hidden');
    dom.result.classList.add('hidden');
    dom.modal.classList.add('hidden');
    dom.targetBar.classList.add('hidden');
    dom.picker.classList.add('hidden');
    dom.skillFull.classList.add('hidden');

    dom.bubble.textContent = '把字母锻成单词。';
    setMascot('idle');
    renderAll();
    banner('ROUND 1');
    Sound.play('round');
    Sound.drawBurst(CONFIG.startHand);
    BGM.unduck();
    BGM.start();
    grantSkill();
    state.lastTs = performance.now();
  }

  function endRound() {
    if (!state.running || state.paused || state.transitioning) return;
    if (state.mode !== 'spell') {
      toast('先完成技能选择，或点取消', 'bad');
      return;
    }
    if (state.hand.length > CONFIG.handLimit) {
      bust();
      return;
    }

    state.transitioning = true;
    state.combo = 0;
    state.round += 1;
    state.revealed = null;
    state.selected = [];
    state.targetSelected = [];
    drawCards(CONFIG.drawPerTurn);
    ensurePlayable();
    Sound.play('round');
    Sound.drawBurst(CONFIG.drawPerTurn);
    banner('ROUND ' + state.round);
    toast('回合 ' + state.round + ' · 抽 5 张牌');
    renderAll();
    grantSkill();

    setTimeout(function () {
      if (!state.running) return;
      state.transitioning = false;
      renderAll();
    }, 380);
  }

  function bust() {
    state.running = false;
    state.paused = true;
    state.transitioning = false;
    state.mode = 'spell';
    setMascot('panic');
    say('炉子炸了……');
    flash('red');
    shake();
    Sound.play('bust');
    BGM.duck();
    FX.spawn(640, 380, 70, { colors: ['#ff2e4d', '#ff4d2e', '#ffb03a'], speed: 190, gravity: 320, life: 0.7 });
    showResult(false);
  }

  function win() {
    state.running = false;
    state.paused = true;
    state.mode = 'spell';
    setMascot('hype');
    say('锻成了！这炉值了。');
    flash('fire');
    Sound.play('win');
    BGM.duck();
    FX.spawn(640, 220, 110, { colors: ['#ffb03a', '#ffe6a8', '#ff4d2e'], speed: 240, gravity: 220, life: 1.1, lift: 60 });
    showResult(true);
  }

  function showResult(victory) {
    saveBest();
    dom.resultKicker.textContent = victory ? 'FORGE COMPLETE' : 'MELTDOWN';
    dom.resultTitle.textContent = victory ? 'VICTORY' : 'OVERHEAT';
    dom.resultTitle.className = 'result-title' + (victory ? '' : ' is-loss');
    dom.resultScore.textContent = state.score.toLocaleString('en-US');
    dom.resultSub.textContent = '锻造 ' + state.forged + ' 个单词 · 最高分 ' + state.best.toLocaleString('en-US');
    dom.resultWords.textContent = '';
    state.recent.slice(0, 8).forEach(function (r) {
      var b = document.createElement('b');
      b.textContent = r.word;
      dom.resultWords.appendChild(b);
      dom.resultWords.appendChild(document.createTextNode(' ' + (r.gloss || '') + ' +' + r.gained + '   '));
    });
    if (!state.recent.length) dom.resultWords.textContent = '这一炉还没出炉一个词。';
    dom.result.classList.remove('hidden');
  }

  /* ---------- play ---------- */
  function selectCard(id) {
    if (!state.running || state.paused) return;
    if (state.mode !== 'spell') { toggleTarget(id); return; }
    var idx = state.selected.indexOf(id);
    if (idx >= 0) {
      state.selected.splice(idx, 1);
      Sound.play('undo');
    } else {
      if (state.selected.length >= CONFIG.maxWordLen) {
        toast('最多 10 个字母', 'bad');
        return;
      }
      state.selected.push(id);
      Sound.play('select');
    }
    renderSlots();
    renderHand();
  }

  function undo() {
    if (state.mode !== 'spell') return;
    if (!state.selected.length) return;
    state.selected.pop();
    Sound.play('undo');
    renderSlots();
    renderHand();
  }

  function clearSelection() {
    if (state.mode !== 'spell') return;
    if (!state.selected.length) return;
    state.selected = [];
    Sound.play('undo');
    renderSlots();
    renderHand();
  }

  function typeLetter(ch) {
    if (!state.running || state.paused || state.mode !== 'spell') return;
    var card = state.hand.find(function (c) {
      return c.ch === ch && state.selected.indexOf(c.id) < 0;
    });
    if (!card) {
      toast('手牌里没有 ' + ch, 'bad');
      return;
    }
    selectCard(card.id);
  }

  function invalid(msg) {
    Sound.play('wrong');
    flash('red');
    shake();
    toast(msg, 'bad');
    dom.wordPreview.textContent = msg;
    dom.wordPreview.className = 'word-preview is-error';
    var panel = document.querySelector('.spell-panel');
    panel.classList.remove('is-error');
    void panel.offsetWidth;
    panel.classList.add('is-error');
    setTimeout(function () { panel.classList.remove('is-error'); }, 320);
  }

  function forge() {
    if (!state.running || state.paused || state.transitioning || state.mode !== 'spell') return;
    var word = state.selected.map(function (id) {
      var c = state.hand.find(function (x) { return x.id === id; });
      return c ? c.ch : '';
    }).join('');

    if (!word) { toast('先选字母', 'bad'); return; }
    if (word.length < CONFIG.minWordLen) { invalid('至少 3 个字母'); return; }
    if (!WORD_SET.has(word)) { invalid('词库里没有 ' + word); return; }

    var mult = comboMult(state.combo);
    var rep = repeatMult(word);
    var base = letterSum(word) * CONFIG.letterScoreMult +
      Math.max(0, word.length - CONFIG.lengthBonusBase) * CONFIG.lengthBonus;
    var gained = Math.floor(base * mult * rep);

    var center = stagePoint(document.querySelector('.spell-panel'));

    state.hand = state.hand.filter(function (c) { return state.selected.indexOf(c.id) < 0; });
    state.selected = [];
    state.used.set(word, (state.used.get(word) || 0) + 1);
    state.combo += 1;
    state.score += gained;
    state.forged += 1;
    state.recent.unshift({ word: word, gloss: shortGloss(word), gained: gained });
    if (state.recent.length > 12) state.recent.pop();

    if (state.revealed && state.revealed.word === word) {
      state.revealed = null;
      toast('透视命中 · ' + word, 'good');
    }
    if (rep === 0) toast('重复词，本回合不得分', 'bad');

    Sound.play('correct');
    if (state.combo >= 3) Sound.play('combo');
    flash('fire');
    shake();
    FX.spawn(center.x, center.y, 26 + Math.min(30, word.length * 4), {
      colors: ['#ffb03a', '#ff4d2e', '#ffe6a8'],
      speed: 170,
      gravity: 260,
      life: 0.7
    });
    hitText('+' + gained, center.x + 90, center.y - 30, gained >= 200 ? 'big' : '');
    if (state.combo >= 2) comboStamp('COMBO ×' + comboMult(state.combo).toFixed(1));
    if (word.length >= 7) banner('STRIKE!');
    if (word.length === CONFIG.maxWordLen) banner('PERFECT!');
    cheer();

    renderAll();
    dom.wordPreview.textContent = word + '  ' + (GLOSS.get(word) || '') + '  +' + gained;
    dom.wordPreview.className = 'word-preview is-good';

    if (state.score >= CONFIG.targetScore) {
      state.transitioning = true;
      setTimeout(win, 380);
    }
  }

  /* ---------- fit stage ---------- */
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    dom.stage.style.transform = 'scale(' + s + ')';
  }

  /* ---------- info modal ---------- */
  function buildInfo() {
    var max = 0;
    DIST.letters.forEach(function (ch) { max = Math.max(max, DIST.counts[ch]); });
    var grid = document.createElement('div');
    grid.className = 'dist-grid';
    DIST.letters.forEach(function (ch) {
      var c = DIST.counts[ch];
      var cell = document.createElement('div');
      cell.className = 'dist-cell';
      cell.innerHTML =
        '<div class="letter">' + ch + '</div>' +
        '<div class="bar"><i style="height:' + Math.max(4, Math.round(c / max * 32)) + 'px"></i></div>' +
        '<div class="count">' + c + '</div>';
      grid.appendChild(cell);
    });

    var wrap = document.createElement('div');
    wrap.appendChild(grid);

    var h = document.createElement('h3');
    h.textContent = '牌堆 ' + DIST.total + ' 张 · ' + PLAYABLE.length.toLocaleString('en-US') + ' 个可玩词条';
    wrap.appendChild(h);

    var p = document.createElement('p');
    p.innerHTML = '按词库中每个字母的出现频率分配，低频字母保底 2 张。元音约 38%，e 最多。' +
      '每回合结束抽 5 张；手牌超过 30 张，结束回合即爆牌。';
    wrap.appendChild(p);

    var h2 = document.createElement('h3');
    h2.textContent = '技能牌（上限 5 张）';
    wrap.appendChild(h2);
    var ul = document.createElement('ul');
    ul.innerHTML =
      '<li><span class="hint-line">透视</span>：直接显示一个可拼的单词。</li>' +
      '<li><span class="hint-line">重铸</span>：选 5 张牌，从牌堆随机替换。</li>' +
      '<li><span class="hint-line">熔毁</span>：弃掉 4 张牌。</li>' +
      '<li><span class="hint-line">点石成字</span>：把 1 张牌变成任意字母。</li>' +
      '<li>每回合获得 1 张；满 5 张时，回合开始可选择丢弃 1 张换新，或保留全部、本回合不获得。</li>';
    wrap.appendChild(ul);

    var h3 = document.createElement('h3');
    h3.textContent = '回合与计分';
    wrap.appendChild(h3);
    var p2 = document.createElement('p');
    p2.textContent = '回合不限时：拼完点“结束回合”抽 5 张。字母分 ×10 + 长度奖励，再乘连击（最高 ×3.0）和重复词衰减。目标 2,000 分。';
    wrap.appendChild(p2);

    dom.modalBody.textContent = '';
    dom.modalBody.appendChild(wrap);
  }

  function openInfo() {
    buildInfo();
    dom.modal.classList.remove('hidden');
    state.paused = true;
  }

  function closeInfo() {
    dom.modal.classList.add('hidden');
    state.paused = false;
  }

  /* ---------- events ---------- */
  dom.btnStart.addEventListener('click', function () {
    Sound.init();
    newGame();
  });
  dom.btnAgain.addEventListener('click', function () {
    Sound.init();
    newGame();
  });
  dom.btnEndRound.addEventListener('click', endRound);
  dom.btnForge.addEventListener('click', forge);
  dom.btnClear.addEventListener('click', clearSelection);
  dom.btnUndo.addEventListener('click', undo);
  dom.btnInfo.addEventListener('click', openInfo);
  dom.btnModalClose.addEventListener('click', closeInfo);
  dom.btnBgm.addEventListener('click', function () {
    var on = BGM.toggle();
    dom.btnBgm.textContent = on ? '♫' : '×';
    dom.btnBgm.classList.toggle('is-off', !on);
  });
  dom.btnSound.addEventListener('click', function () {
    var on = Sound.toggle();
    dom.btnSound.textContent = on ? '♪' : '×';
    dom.btnSound.classList.toggle('is-off', !on);
  });

  dom.modal.addEventListener('click', function (e) {
    if (e.target === dom.modal) closeInfo();
  });
  dom.picker.addEventListener('click', function (e) {
    if (e.target === dom.picker) closePicker();
  });
  dom.skillFull.addEventListener('click', function (e) {
    if (e.target === dom.skillFull) keepFullSkills();
  });

  dom.skillList.addEventListener('click', function (e) {
    var card = e.target.closest('.skill-card');
    if (!card) return;
    useSkill(Number(card.dataset.index));
  });

  dom.hand.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    selectCard(Number(card.dataset.id));
  });

  dom.slots.addEventListener('click', function (e) {
    if (state.mode !== 'spell') return;
    var slot = e.target.closest('.slot.is-filled');
    if (!slot) return;
    var idx = Number(slot.dataset.index);
    if (!Number.isNaN(idx)) {
      state.selected.splice(idx, 1);
      Sound.play('undo');
      renderSlots();
      renderHand();
    }
  });

  dom.btnTargetConfirm.addEventListener('click', confirmTarget);
  dom.btnTargetCancel.addEventListener('click', cancelTarget);
  dom.btnPickerCancel.addEventListener('click', closePicker);

  dom.pickerGrid.addEventListener('click', function (e) {
    var key = e.target.closest('.letter-key');
    if (!key) return;
    applyTransmute(key.dataset.letter);
  });

  dom.skillFullList.addEventListener('click', function (e) {
    var pick = e.target.closest('.skill-pick');
    if (!pick) return;
    selectSkillFull(Number(pick.dataset.index));
  });

  dom.btnSkillReplace.addEventListener('click', replaceFullSkill);
  dom.btnSkillKeep.addEventListener('click', keepFullSkills);

  document.addEventListener('keydown', function (e) {
    if (!dom.menu.classList.contains('hidden')) {
      if (e.key === 'Enter') { e.preventDefault(); Sound.init(); newGame(); }
      return;
    }    if (!dom.result.classList.contains('hidden')) {
      if (e.key === 'Enter') { e.preventDefault(); Sound.init(); newGame(); }
      return;
    }
    if (!dom.picker.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); closePicker(); }
      return;
    }
    if (!dom.skillFull.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); keepFullSkills(); }
      return;
    }
    if (!dom.modal.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); closeInfo(); }
      return;
    }
    if (state.paused) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.mode !== 'spell') cancelTarget();
      else clearSelection();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      forge();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      typeLetter(e.key.toLowerCase());
    }
  });

  document.addEventListener('pointerdown', function () {
    if (state.running) {
      Sound.init();
      BGM.start();
    }
  }, { passive: true });

  window.addEventListener('resize', fit);
  window.addEventListener('blur', function () {
    if (state.running) state.paused = true;
  });
  window.addEventListener('focus', function () {
    if (state.running && dom.modal.classList.contains('hidden') &&
        dom.picker.classList.contains('hidden') && dom.skillFull.classList.contains('hidden')) {
      state.paused = false;
    }
  });

  /* ---------- main loop ---------- */
  function loop(ts) {
    var dt = Math.min(0.05, (ts - (state.lastTs || ts)) / 1000);
    state.lastTs = ts;
    FX.step(dt);
    requestAnimationFrame(loop);
  }

  /* ---------- boot ---------- */
  (function boot() {
    for (var i = 0; i < CONFIG.handLimit; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip';
      dom.heat.appendChild(pip);
    }
    fit();
    dom.stage.classList.add('is-menu');
    renderAll();
    requestAnimationFrame(loop);
  })();

  /* ---------- debug / QA hook ---------- */
  window.WF = {
    state: state,
    config: CONFIG,
    distribution: DIST,
    skills: SKILLS,
    candidates: function () { return candidatesFor(state.hand); },
    selectWord: function (word) {
      var pool = state.hand.slice();
      var ids = [];
      for (var i = 0; i < word.length; i++) {
        var at = -1;
        for (var j = 0; j < pool.length; j++) {
          if (pool[j].ch === word[i]) { at = j; break; }
        }
        if (at < 0) return false;
        ids.push(pool[at].id);
        pool.splice(at, 1);
      }
      state.selected = ids;
      renderSlots();
      renderHand();
      return true;
    },
    play: function (word) {
      if (!window.WF.selectWord(word)) return false;
      forge();
      return true;
    },
    fillHand: function (n) {
      while (state.hand.length < n) {
        state.hand.push({ id: state.nextId++, ch: drawLetter() });
      }
      renderAll();
    },
    addSkill: function (id) {
      if (!SKILLS[id] || state.skills.length >= CONFIG.skillLimit) return false;
      state.skills.push(id);
      renderAll();
      return true;
    },
    grantSkill: grantSkill,
    useSkill: useSkill,
    endRound: endRound,
    openSkillFull: openSkillFull,
    render: renderAll,
    start: newGame
  };

  if (new URLSearchParams(window.location.search).get('auto') === '1') {
    setTimeout(newGame, 120);
  }
})();

