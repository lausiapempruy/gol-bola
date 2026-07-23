(function(){
  'use strict';

  // ================= Fallback config (dipakai kalau fetch config.json gagal, misal dibuka via file://) =================
  var DEFAULT_CONFIG = {
    names: {
      idFirst: ["Andi","Budi","Rizky","Fajar","Dimas","Bagus","Yusuf","Fadli","Reza","Arya"],
      idLast: ["Saputra","Pratama","Wijaya","Kusuma","Nugroho","Santoso","Setiawan","Hidayat"],
      intlFirst: ["Marco","Luca","Carlos","Diego","Pierre","Lucas","Kevin","Erik","Andres"],
      intlLast: ["Silva","Fernandez","Rossi","Novak","Schmidt","Dubois","Andersson","Kowalski"]
    },
    skillScale: { min:50, max:200, userDefault:190 },
    gradeTiers: [
      { max:75, label:'Pemula', color:'#9aa6c8' },
      { max:105, label:'Biasa', color:'#7de1ff' },
      { max:140, label:'Bagus', color:'#c6ff8f' },
      { max:175, label:'Hebat', color:'#ffd479' },
      { max:200, label:'Legendaris', color:'#ff9ad1' }
    ],
    squadDefault: { blue:{GK:1,DF:2,MF:2,FW:1}, red:{GK:1,DF:2,MF:2,FW:2} },
    match: { fieldWidth:960, fieldHeight:600, goalHeight:170, playerRadius:14, ballRadius:8, possessionRadius:24, stealRadius:20, userSpeed:175, aiBaseSpeed:150, shootPower:430, shootRange:300, defaultSeconds:300 },
    modes: {
      latihan:{ label:'LATIHAN', skillMin:50, skillMax:75, offside:false, fouls:false, referee:'pemula', seconds:300, speedMultiplier:1.0 },
      easy:{ label:'EASY', skillMin:75, skillMax:105, offside:true, fouls:true, referee:'pemula', seconds:300, speedMultiplier:1.0 },
      normal:{ label:'NORMAL', skillMin:105, skillMax:140, offside:true, fouls:true, referee:'adil', seconds:300, speedMultiplier:1.0 },
      hard:{ label:'SUSAH', skillMin:140, skillMax:195, offside:true, fouls:true, referee:'pro', seconds:300, speedMultiplier:1.08 }
    },
    refereeProfiles: {
      adil:{ foulMult:1.0, offsideAcc:0.95, cardMult:1.0, biased:false, noisy:false },
      tidak_adil:{ foulMult:1.0, offsideAcc:0.85, cardMult:1.0, biased:true, noisy:false },
      pro:{ foulMult:1.15, offsideAcc:0.99, cardMult:1.15, biased:false, noisy:false },
      pemula:{ foulMult:0.55, offsideAcc:0.55, cardMult:0.7, biased:false, noisy:true }
    }
  };

  var CFG = null;

  // ================= Audio (prosedural, tanpa file eksternal) =================
  var audioCtx = null;
  var ambientGain = null;
  var ambientTarget = 0.07;

  function ensureAudio(){
    if(audioCtx) { if(audioCtx.state==='suspended') audioCtx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    audioCtx = new AC();
    var bufSize = audioCtx.sampleRate * 2;
    var buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for(var i=0;i<bufSize;i++) data[i] = (Math.random()*2-1);
    var noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = buffer; noiseSrc.loop = true;
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 550; filter.Q.value = 0.5;
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0;
    noiseSrc.connect(filter).connect(ambientGain).connect(audioCtx.destination);
    noiseSrc.start();
  }

  function setAmbientTarget(v){
    ambientTarget = v;
    if(ambientGain && audioCtx){
      ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(v, audioCtx.currentTime + 0.4);
    }
  }

  function playTone(freq, duration, type, gainVal, startDelay){
    if(!audioCtx) return;
    var t0 = audioCtx.currentTime + (startDelay||0);
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainVal||0.18, t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0+duration+0.02);
  }

  function playWhistle(long){
    if(!audioCtx) return;
    playTone(2900, long?0.5:0.18, 'square', 0.12, 0);
    if(!long) playTone(2900, 0.18, 'square', 0.12, 0.22);
  }

  function playFoulBeep(){
    if(!audioCtx) return;
    playTone(2600, 0.16, 'square', 0.11, 0);
    playTone(2100, 0.2, 'square', 0.11, 0.2);
  }

  function playGoalRoar(){
    if(!audioCtx) return;
    var t0 = audioCtx.currentTime;
    var bufSize = audioCtx.sampleRate * 1.6;
    var buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for(var i=0;i<bufSize;i++) data[i] = (Math.random()*2-1);
    var src = audioCtx.createBufferSource();
    src.buffer = buffer;
    var filter = audioCtx.createBiquadFilter();
    filter.type='bandpass'; filter.frequency.value=850; filter.Q.value=0.4;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.42, t0+0.15);
    g.gain.linearRampToValueAtTime(0.05, t0+1.4);
    src.connect(filter).connect(g).connect(audioCtx.destination);
    src.start(t0); src.stop(t0+1.6);
  }

  function loadConfig(cb){
    fetch('config.json').then(function(r){
      if(!r.ok) throw new Error('bad status');
      return r.json();
    }).then(function(json){
      CFG = json;
      cb();
    }).catch(function(){
      CFG = DEFAULT_CONFIG;
      cb();
    });
  }

  // ================= DOM refs =================
  var canvas, ctx;
  var scoreBlueEl, scoreRedEl, timePillEl, modePillEl, centerFlash;
  var modeOverlay, sandboxOverlay, lineupOverlay, endOverlay;
  var retryBtn, finalScoreLine, resultTag, statsBox;
  var controlsEl, hintEl, cyB, crB, cyR, crR;
  var lineupBlueEl, lineupRedEl;

  function grabDom(){
    canvas = document.getElementById('field');
    ctx = canvas.getContext('2d');
    scoreBlueEl = document.getElementById('scoreBlue');
    scoreRedEl = document.getElementById('scoreRed');
    timePillEl = document.getElementById('timePill');
    modePillEl = document.getElementById('modePill');
    centerFlash = document.getElementById('centerFlash');
    modeOverlay = document.getElementById('modeOverlay');
    sandboxOverlay = document.getElementById('sandboxOverlay');
    lineupOverlay = document.getElementById('lineupOverlay');
    endOverlay = document.getElementById('endOverlay');
    retryBtn = document.getElementById('retryBtn');
    finalScoreLine = document.getElementById('finalScoreLine');
    resultTag = document.getElementById('resultTag');
    statsBox = document.getElementById('statsBox');
    controlsEl = document.getElementById('controls');
    hintEl = document.getElementById('hint');
    cyB = document.getElementById('cyB'); crB = document.getElementById('crB');
    cyR = document.getElementById('cyR'); crR = document.getElementById('crR');
    lineupBlueEl = document.getElementById('lineupBlue');
    lineupRedEl = document.getElementById('lineupRed');
  }

  // ================= Utility =================
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function randInt(a,b){ return Math.floor(rand(a,b+1)); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function normVec(dx,dy){
    var len = Math.sqrt(dx*dx+dy*dy);
    if(len < 0.0001) return {x:0,y:0};
    return {x:dx/len, y:dy/len};
  }
  function fmtTime(t){
    t = Math.max(0, Math.ceil(t));
    var m = Math.floor(t/60), s = t%60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }
  function skillToMultiplier(score){
    var lo = CFG.skillScale.min, hi = CFG.skillScale.max;
    var t = clamp((score-lo)/(hi-lo), 0, 1);
    return 0.5 + t*1.0; // 50 -> 0.5x, 200 -> 1.5x
  }
  function gradeFor(score){
    var tiers = CFG.gradeTiers;
    for(var i=0;i<tiers.length;i++) if(score <= tiers[i].max) return tiers[i];
    return tiers[tiers.length-1];
  }
  function generatePlayerName(){
    var isIndo = Math.random() < 0.55;
    if(isIndo) return { name: pick(CFG.names.idFirst)+' '+pick(CFG.names.idLast), origin:'id' };
    return { name: pick(CFG.names.intlFirst)+' '+pick(CFG.names.intlLast), origin:'intl' };
  }

  // ================= SVG icons =================
  var SVG = {
    yellow: '<svg width="30" height="42" viewBox="0 0 30 42"><rect x="1" y="1" width="28" height="40" rx="4" fill="#ffd400" stroke="rgba(0,0,0,0.35)" stroke-width="2"/></svg>',
    red: '<svg width="30" height="42" viewBox="0 0 30 42"><rect x="1" y="1" width="28" height="40" rx="4" fill="#ff3b3b" stroke="rgba(0,0,0,0.35)" stroke-width="2"/></svg>',
    whistle: '<svg width="46" height="34" viewBox="0 0 46 34"><circle cx="14" cy="17" r="13" fill="none" stroke="#fff" stroke-width="3"/><rect x="24" y="13" width="18" height="8" rx="4" fill="#fff"/><circle cx="14" cy="17" r="4" fill="#fff"/></svg>',
    flag: '<svg width="30" height="40" viewBox="0 0 30 40"><rect x="13" y="2" width="3" height="36" fill="#eee"/><path d="M16 4 L29 9 L16 14 Z" fill="#ffd400"/></svg>',
    ball: '<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="#fff" stroke="rgba(0,0,0,0.4)" stroke-width="2"/><polygon points="17,9 22,13 20,19 14,19 12,13" fill="#222"/></svg>'
  };
  function flash(title, sub, icon){
    var html = '';
    if(icon) html += '<div>'+icon+'</div>';
    html += '<div class="flashTitle">'+title+'</div>';
    if(sub) html += '<div class="flashSub">'+sub+'</div>';
    centerFlash.innerHTML = html;
    centerFlash.classList.remove('show');
    void centerFlash.offsetWidth;
    centerFlash.classList.add('show');
  }

  // ================= Field constants (filled from config on init) =================
  var FW, FH, GOAL_HEIGHT, GOAL_TOP, GOAL_BOTTOM, PLAYER_R, BALL_R, POSSESSION_R, STEAL_R;
  var ROLE_ADV = { GK:0.05, DF:0.22, MF:0.48, FW:0.72 };
  var ROLE_SUPPORT_DIST = { DF:80, MF:150, FW:190 };

  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize(){
    var maxW = window.innerWidth - 20;
    var maxH = window.innerHeight - 150;
    var stw = FW + 260, sth = FH + 210;
    var scale = Math.min(maxW/stw, maxH/sth);
    if(scale <= 0 || !isFinite(scale)) scale = 0.5;
    canvas.style.width = (stw*scale)+'px';
    canvas.style.height = (sth*scale)+'px';
    canvas.width = Math.round(stw*dpr);
    canvas.height = Math.round(sth*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    STW = stw; STH = sth;
  }
  var STW, STH, MARGIN_X, MARGIN_Y;

  // ================= Referee =================
  var referee = { type:'adil', favoredTeam:null, profile:null, pos:null };
  function setupReferee(type){
    referee.type = type;
    referee.profile = CFG.refereeProfiles[type] || CFG.refereeProfiles.adil;
    referee.favoredTeam = (type === 'tidak_adil') ? (Math.random()<0.5?'blue':'red') : null;
    referee.pos = { x: FW/2, y: FH/2 };
  }

  // ================= Crowd =================
  var crowd = [];
  function buildCrowd(){
    crowd = [];
    var spacing = 22;
    function fillBand(x0,y0,x1,y1){
      for(var y=y0; y<y1; y+=spacing){
        for(var x=x0; x<x1; x+=spacing){
          var jx = x + rand(-4,4);
          var jy = y + rand(-4,4);
          if(Math.random() < 0.12) continue;
          crowd.push({ x:jx, y:jy, faction: jx<STW/2?'blue':'red', phase:rand(0,Math.PI*2), speed:rand(1.6,2.6), tone:rand(0.75,1.15) });
        }
      }
    }
    fillBand(0, 6, STW, MARGIN_Y-12);
    fillBand(0, STH-MARGIN_Y+12, STW, STH-6);
    fillBand(6, MARGIN_Y, MARGIN_X-12, STH-MARGIN_Y);
    fillBand(STW-MARGIN_X+12, MARGIN_Y, STW-6, STH-MARGIN_Y);
  }
  var crowdMood = { blue:{state:'idle',timer:0}, red:{state:'idle',timer:0} };
  function refreshAmbientFromMood(){
    var target = 0.07;
    if(crowdMood.blue.state==='cheer' || crowdMood.red.state==='cheer') target = 0.34;
    else if(crowdMood.blue.state==='sad' && crowdMood.red.state==='sad') target = 0.04;
    setAmbientTarget(target);
  }
  function setCrowdMood(team,state,dur){
    crowdMood[team].state=state; crowdMood[team].timer=dur;
    refreshAmbientFromMood();
  }
  function updateCrowdMood(dt){
    var changed = false;
    ['blue','red'].forEach(function(t){
      if(crowdMood[t].timer>0){
        crowdMood[t].timer -= dt;
        if(crowdMood[t].timer<=0){ crowdMood[t].state='idle'; changed=true; }
      }
    });
    if(changed) refreshAmbientFromMood();
  }
  function drawCrowd(t){
    for(var i=0;i<crowd.length;i++){
      var c = crowd[i];
      var mood = crowdMood[c.faction];
      var amp, colorBase, yOff;
      if(mood.state==='cheer'){ amp=6; colorBase=c.faction==='blue'?[125,225,255]:[255,107,107]; yOff=-2; }
      else if(mood.state==='sad'){ amp=1; colorBase=c.faction==='blue'?[60,80,110]:[110,60,60]; yOff=3; }
      else { amp=2.5; colorBase=c.faction==='blue'?[90,140,190]:[190,100,95]; yOff=0; }
      var bounce = Math.sin(t*c.speed+c.phase)*amp;
      var r=Math.round(colorBase[0]*c.tone), g=Math.round(colorBase[1]*c.tone), b=Math.round(colorBase[2]*c.tone);
      ctx.fillStyle = 'rgb('+r+','+g+','+b+')';
      ctx.fillRect(c.x-2, c.y+yOff+bounce-2, 4, 5);
    }
  }

  // ================= Match config & squads =================
  var matchConfig = null;
  var players = [];
  var ball = { x:0,y:0, vx:0,vy:0, controller:null, freeTimer:0, offsideFlag:null };
  var scoreBlue=0, scoreRed=0;
  var stats = { blueYellow:0, blueRed:0, redYellow:0, redRed:0 };
  var matchTime = 300;
  var phase = 'idle';
  var phaseTimer = 0;
  var lastFrameTs = null;
  var rafId = null;
  var keys = { up:false, down:false, left:false, right:false, shoot:false };

  function buildSquad(){
    players = [];
    var teams = [
      { team:'blue', attackDir:1, ownGoalX:0, cfg:matchConfig.squad.blue, extraUser:true },
      { team:'red', attackDir:-1, ownGoalX:FW, cfg:matchConfig.squad.red, extraUser:false }
    ];
    teams.forEach(function(T){
      var roles = ['GK','DF','MF','FW'];
      var counts = { GK:T.cfg.GK||0, DF:T.cfg.DF||0, MF:T.cfg.MF||0, FW:T.cfg.FW||0 };
      roles.forEach(function(role){
        var n = counts[role] + (T.extraUser && role==='FW' ? 1 : 0);
        if(n <= 0) return;
        var placedUser = false;
        for(var i=0;i<n;i++){
          var isUserSlot = false;
          if(T.extraUser && role==='FW' && !placedUser && i===Math.floor(n/2)){ isUserSlot=true; placedUser=true; }
          var x = T.ownGoalX + T.attackDir*ROLE_ADV[role]*FW;
          var y;
          if(role==='GK') y = GOAL_TOP + (GOAL_BOTTOM-GOAL_TOP)*((i+1)/(n+1));
          else y = 40 + (FH-80)*((i+1)/(n+1));
          var skillScore = isUserSlot ? CFG.skillScale.userDefault : Math.round(rand(matchConfig.skillMin, matchConfig.skillMax));
          var g = generatePlayerName();
          players.push({
            team:T.team, role:role, isUser:isUserSlot,
            name:g.name, origin:g.origin,
            x:x, y:y, baseX:x, baseY:y, vx:0, vy:0,
            facing:{x:T.attackDir,y:0},
            jinkSign: Math.random()<0.5 ? 1 : -1,
            skillScore: skillScore,
            skill: skillToMultiplier(skillScore),
            actionCooldown:0, shotTimer:rand(0.3,0.8),
            yellowCards:0, sentOff:false,
            color: T.team==='blue' ? (isUserSlot?'#7de1ff':(role==='GK'?'#ffd479':'#3fa8e0')) : (isUserSlot?'#ff6b6b':(role==='GK'?'#ffd479':'#e0483f'))
          });
        }
      });
    });
  }

  function resetPositionsSoft(){
    players.forEach(function(p){ if(p.sentOff) return; p.x=p.baseX; p.y=p.baseY; p.actionCooldown=0; });
    ball.x=FW/2; ball.y=FH/2; ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0; ball.offsideFlag=null;
  }
  function placeBallAt(x,y){
    ball.x = clamp(x, BALL_R+2, FW-BALL_R-2);
    ball.y = clamp(y, BALL_R+2, FH-BALL_R-2);
    ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0.35; ball.offsideFlag=null;
  }
  function getUser(){ for(var i=0;i<players.length;i++) if(players[i].isUser) return players[i]; return null; }
  function nearestOfTeam(team,x,y){
    var best=null, bestD=Infinity;
    for(var i=0;i<players.length;i++){
      var p=players[i]; if(p.team!==team || p.sentOff) continue;
      var d = Math.sqrt((p.x-x)*(p.x-x)+(p.y-y)*(p.y-y));
      if(d<bestD){ bestD=d; best=p; }
    }
    return best;
  }

  // ================= Offside =================
  function checkOffsideOnKick(p){
    if(!matchConfig.offside) return;
    var attackDir = p.team==='blue'?1:-1;
    var opponents = players.filter(function(q){ return q.team!==p.team && !q.sentOff; });
    if(opponents.length<1) return;
    var advVals = opponents.map(function(q){ return q.x*attackDir; }).sort(function(a,b){ return b-a; });
    var line = advVals.length>1 ? advVals[1] : advVals[0];
    var ballAdv = ball.x*attackDir;
    var flagged = [];
    players.forEach(function(q){
      if(q.team!==p.team || q===p || q.sentOff) return;
      var qAdv = q.x*attackDir;
      if(qAdv>line && qAdv>ballAdv) flagged.push(q);
    });
    ball.offsideFlag = flagged.length>0 ? { team:p.team, players:flagged, spotX:p.x, spotY:p.y } : null;
  }
  function resolveOffsideIfNeeded(newController){
    if(!ball.offsideFlag) return false;
    var flag = ball.offsideFlag;
    ball.offsideFlag = null;
    if(!newController || newController.team!==flag.team) return false;
    if(flag.players.indexOf(newController)===-1) return false;

    var acc = referee.profile.offsideAcc;
    if(referee.profile.biased) acc = (flag.team===referee.favoredTeam) ? acc*0.3 : Math.min(0.98, acc*1.3);
    if(referee.profile.noisy) acc *= rand(0.6,1.2);
    if(Math.random() > acc) return false;

    var otherTeam = flag.team==='blue' ? 'red' : 'blue';
    triggerStoppage('offside', otherTeam, flag.spotX, flag.spotY);
    return true;
  }

  // ================= Shooting =================
  function doShoot(p, targetX, targetY, power){
    var spread = (1 - p.skill/1.5) * 0.5;
    var baseAngle = Math.atan2(targetY-p.y, targetX-p.x);
    var angle = baseAngle + rand(-spread, spread);
    var pw = power || CFG.match.shootPower;
    ball.vx = Math.cos(angle)*pw;
    ball.vy = Math.sin(angle)*pw;
    ball.controller = null;
    ball.freeTimer = 0.28;
    checkOffsideOnKick(p);
  }

  // ================= Fouls / cards =================
  function handleCard(q, severity){
    var mult = referee.profile.cardMult;
    if(referee.profile.biased) mult *= (q.team===referee.favoredTeam) ? 0.5 : 1.4;
    if(referee.profile.noisy) mult *= rand(0.5,1.3);
    var sev = severity*mult;
    if(sev > 0.88){ sendOff(q); return 'red'; }
    else if(sev > 0.55){
      q.yellowCards++;
      if(q.team==='blue') stats.blueYellow++; else stats.redYellow++;
      if(q.yellowCards>=2){ sendOff(q); return 'red2'; }
      return 'yellow';
    }
    return null;
  }
  function sendOff(q){
    q.sentOff = true;
    if(q.team==='blue') stats.blueRed++; else stats.redRed++;
    var idx = players.indexOf(q);
    if(idx!==-1) players.splice(idx,1);
  }
  function triggerStoppage(kind, possessionTeam, x, y){
    phase = 'stoppage'; phaseTimer = 1.6;
    placeBallAt(x,y);
    playWhistle(0);
    if(kind==='offside') flash('OFFSIDE!', 'Bola untuk '+(possessionTeam==='blue'?'Tim Biru':'Tim Merah'), SVG.flag);
    else if(kind==='foul') flash('PELANGGARAN!', 'Bola untuk '+(possessionTeam==='blue'?'Tim Biru':'Tim Merah'), SVG.whistle);
  }

  // ================= Update user/AI =================
  function updateUser(p, dt){
    var dx=0,dy=0;
    if(keys.up) dy-=1; if(keys.down) dy+=1; if(keys.left) dx-=1; if(keys.right) dx+=1;
    var dir = normVec(dx,dy);
    var speed = CFG.match.userSpeed * matchConfig.speedMultiplier;
    if(dir.x!==0 || dir.y!==0) p.facing=dir;
    var targetVx = dir.x*speed, targetVy = dir.y*speed;
    var smooth = clamp(dt*8, 0, 1);
    p.vx += (targetVx-p.vx)*smooth;
    p.vy += (targetVy-p.vy)*smooth;
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.x = clamp(p.x, PLAYER_R, FW-PLAYER_R);
    p.y = clamp(p.y, PLAYER_R, FH-PLAYER_R);
    if(keys.shoot && ball.controller===p && ball.freeTimer<=0){
      doShoot(p, p.x+p.facing.x*999, p.y+p.facing.y*999, CFG.match.shootPower);
      keys.shoot = false;
    }
  }

  function updateAIPlayer(p, dt){
    var attackDir = p.team==='blue'?1:-1;
    var ownGoalX = p.team==='blue'?0:FW;
    var oppGoalX = p.team==='blue'?FW:0;
    var goalY = FH/2;
    var dir = {x:0,y:0};
    var ctrl = ball.controller;
    var speed = CFG.match.aiBaseSpeed * p.skill * matchConfig.speedMultiplier;

    if(p.role==='GK'){
      var gkX = ownGoalX + attackDir*45;
      var trackY = clamp(ball.y, GOAL_TOP+15, GOAL_BOTTOM-15);
      var ballDist = Math.sqrt((ball.x-p.x)*(ball.x-p.x)+(ball.y-p.y)*(ball.y-p.y));
      if(ctrl===p){
        var clearX = ownGoalX + attackDir*FW*0.5;
        var clearY = FH/2 + rand(-90,90);
        p.shotTimer -= dt;
        if(p.shotTimer<=0){ doShoot(p, clearX, clearY, 380); p.shotTimer = rand(0.4,0.8); }
        dir = {x:0,y:0};
      } else if(ballDist<100 && (!ctrl||ctrl.team!==p.team)){
        dir = normVec(ball.x-p.x, ball.y-p.y);
      } else {
        dir = normVec(gkX-p.x, trackY-p.y);
      }
      speed *= 1.05;
    } else {
      var supportDist = ROLE_SUPPORT_DIST[p.role] || 150;
      if(ctrl===p){
        var tX=oppGoalX, tY=goalY;
        dir = normVec(tX-p.x, tY-p.y);
        var nearOpp = nearestOfTeam(p.team==='blue'?'red':'blue', p.x, p.y);
        if(nearOpp){
          var dOppSq = (nearOpp.x-p.x)*(nearOpp.x-p.x)+(nearOpp.y-p.y)*(nearOpp.y-p.y);
          if(dOppSq < 70*70){
            var perp = { x:-dir.y, y:dir.x };
            dir = normVec(dir.x + perp.x*p.jinkSign*0.65, dir.y + perp.y*p.jinkSign*0.65);
          }
        }
        var dGoal = Math.sqrt((p.x-oppGoalX)*(p.x-oppGoalX)+(p.y-goalY)*(p.y-goalY));
        if(dGoal < CFG.match.shootRange){
          p.shotTimer -= dt;
          if(p.shotTimer<=0 && p.actionCooldown<=0){
            doShoot(p, oppGoalX, goalY+rand(-30,30), CFG.match.shootPower*rand(0.85,1.05));
            p.actionCooldown = 1.1; p.shotTimer = rand(0.5,1.0);
          }
        } else { p.shotTimer = rand(0.3,0.7); }
      } else if(ctrl && ctrl.team===p.team){
        var supportX = clamp(ctrl.x+attackDir*supportDist, PLAYER_R+10, FW-PLAYER_R-10);
        var supportY = clamp(p.baseY+(ctrl.y>FH/2?-50:50), PLAYER_R+10, FH-PLAYER_R-10);
        dir = normVec(supportX-p.x, supportY-p.y);
      } else if(ctrl && ctrl.team!==p.team){
        var defender = nearestOfTeam(p.team, ball.x, ball.y);
        if(defender===p) dir = normVec(ball.x-p.x, ball.y-p.y);
        else {
          var markX = clamp(ownGoalX+attackDir*170, PLAYER_R+10, FW-PLAYER_R-10);
          dir = normVec(markX-p.x, p.baseY-p.y);
        }
      } else {
        var chaser = nearestOfTeam(p.team, ball.x, ball.y);
        if(chaser===p) dir = normVec(ball.x-p.x, ball.y-p.y);
        else {
          var holdX = p.baseX + (ball.x-p.baseX)*0.25;
          var holdY = p.baseY + (ball.y-p.baseY)*0.25;
          dir = normVec(holdX-p.x, holdY-p.y);
        }
      }
      if(p.actionCooldown>0) p.actionCooldown -= dt;
    }

    if(dir.x!==0 || dir.y!==0) p.facing = dir;
    var targetVx = dir.x*speed, targetVy = dir.y*speed;
    var smoothAI = clamp(dt*6.5, 0, 1);
    p.vx += (targetVx-p.vx)*smoothAI;
    p.vy += (targetVy-p.vy)*smoothAI;
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.x = clamp(p.x, PLAYER_R, FW-PLAYER_R);
    p.y = clamp(p.y, PLAYER_R, FH-PLAYER_R);
  }

  function resolvePlayerCollisions(){
    for(var i=0;i<players.length;i++){
      for(var j=i+1;j<players.length;j++){
        var a=players[i], b=players[j];
        var dx=b.x-a.x, dy=b.y-a.y;
        var d=Math.sqrt(dx*dx+dy*dy);
        var minD = PLAYER_R*2*0.85;
        if(d>0 && d<minD){
          var overlap=(minD-d)/2, nx=dx/d, ny=dy/d;
          a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
        }
      }
    }
  }

  function updateBall(dt){
    var prevController = ball.controller;
    if(ball.freeTimer>0){ ball.freeTimer -= dt; }
    else {
      var best=null, bestD=Infinity;
      for(var i=0;i<players.length;i++){
        var p=players[i];
        var d=Math.sqrt((p.x-ball.x)*(p.x-ball.x)+(p.y-ball.y)*(p.y-ball.y));
        if(d<POSSESSION_R && d<bestD){ bestD=d; best=p; }
      }
      if(best!==prevController) resolveOffsideIfNeeded(best);
      ball.controller = best;
    }

    if(ball.controller && ball.freeTimer<=0){
      var p = ball.controller;
      var tx=p.x+p.facing.x*20, ty=p.y+p.facing.y*20;
      ball.x += (tx-ball.x)*0.3; ball.y += (ty-ball.y)*0.3;
      ball.vx *= 0.8; ball.vy *= 0.8;

      for(var k=0;k<players.length;k++){
        var q = players[k];
        if(q.team===p.team) continue;
        var dq = Math.sqrt((q.x-ball.x)*(q.x-ball.x)+(q.y-ball.y)*(q.y-ball.y));
        if(dq < STEAL_R){
          if(Math.random() < 0.5*q.skill*dt){
            var cleanProb = clamp(0.5+(q.skill-p.skill)*0.4, 0.15, 0.85);
            var r = Math.random();
            if(r < cleanProb){
              var away = normVec(ball.x-p.x, ball.y-p.y);
              if(away.x===0 && away.y===0) away = {x:(q.team==='blue'?1:-1), y:0};
              ball.vx = away.x*120+(Math.random()-0.5)*60;
              ball.vy = away.y*120+(Math.random()-0.5)*60;
              ball.controller=null; ball.freeTimer=0.15;
            } else if(matchConfig.fouls && r < cleanProb+(1-cleanProb)*0.65*referee.profile.foulMult){
              var cardResult = handleCard(q, Math.random());
              var subtitle = cardResult==='yellow' ? 'Kartu kuning' : (cardResult ? 'Kartu merah' : null);
              var icon = cardResult==='yellow' ? SVG.yellow : (cardResult ? SVG.red : SVG.whistle);
              phase='stoppage'; phaseTimer=1.7;
              placeBallAt(p.x,p.y);
              playFoulBeep();
              flash('PELANGGARAN!', subtitle || ('Bola untuk '+(p.team==='blue'?'Tim Biru':'Tim Merah')), icon);
              return;
            } else {
              ball.vx=(Math.random()-0.5)*140; ball.vy=(Math.random()-0.5)*140;
              ball.controller=null; ball.freeTimer=0.15;
            }
            break;
          }
        }
      }
    } else {
      ball.x += ball.vx*dt; ball.y += ball.vy*dt;
      var damp = Math.pow(0.985, dt*60);
      ball.vx *= damp; ball.vy *= damp;
    }

    if(ball.y<BALL_R){ ball.y=BALL_R; ball.vy=-ball.vy*0.6; }
    if(ball.y>FH-BALL_R){ ball.y=FH-BALL_R; ball.vy=-ball.vy*0.6; }
    if(ball.x<BALL_R){
      if(ball.y>GOAL_TOP && ball.y<GOAL_BOTTOM) onGoal('red');
      else { ball.x=BALL_R; ball.vx=-ball.vx*0.6; }
    }
    if(ball.x>FW-BALL_R){
      if(ball.y>GOAL_TOP && ball.y<GOAL_BOTTOM) onGoal('blue');
      else { ball.x=FW-BALL_R; ball.vx=-ball.vx*0.6; }
    }
  }

  function onGoal(scoringTeam){
    if(phase!=='play') return;
    if(scoringTeam==='blue') scoreBlue++; else scoreRed++;
    scoreBlueEl.textContent = scoreBlue; scoreRedEl.textContent = scoreRed;
    phase='celebrate'; phaseTimer=2.2;
    playGoalRoar();
    flash('GOL!', scoringTeam==='blue'?'Tim Biru unggul!':'Tim Merah unggul!', SVG.ball);
    if(scoringTeam==='blue'){ setCrowdMood('blue','cheer',2.6); setCrowdMood('red','sad',2.6); }
    else { setCrowdMood('red','cheer',2.6); setCrowdMood('blue','sad',2.6); }
  }

  // ================= Rendering =================
  function drawStadium(t){
    ctx.clearRect(0,0,STW,STH);
    var standGrad = ctx.createLinearGradient(0,0,0,STH);
    standGrad.addColorStop(0,'#1a2038'); standGrad.addColorStop(1,'#0c1020');
    ctx.fillStyle = standGrad; ctx.fillRect(0,0,STW,STH);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for(var i=0;i<3;i++){
      var inset=i*14;
      ctx.fillRect(inset, inset, STW-inset*2, MARGIN_Y-inset-4);
      ctx.fillRect(inset, STH-MARGIN_Y+4, STW-inset*2, MARGIN_Y-inset-4);
    }

    drawCrowd(t);

    [[40,30],[STW-40,30],[40,STH-30],[STW-40,STH-30]].forEach(function(pos){
      ctx.fillStyle='rgba(255,255,220,0.9)';
      ctx.beginPath(); ctx.arc(pos[0],pos[1],6,0,Math.PI*2); ctx.fill();
      var glow = ctx.createRadialGradient(pos[0],pos[1],0,pos[0],pos[1],90);
      glow.addColorStop(0,'rgba(255,255,220,0.18)'); glow.addColorStop(1,'rgba(255,255,220,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(pos[0],pos[1],90,0,Math.PI*2); ctx.fill();
    });

    ctx.save();
    ctx.translate(MARGIN_X, MARGIN_Y);
    drawPitch();
    drawReferee();
    drawPlayers();
    drawBall();
    ctx.restore();
  }

  function drawPitch(){
    var stripeCount=10, stripeW=FW/stripeCount;
    for(var i=0;i<stripeCount;i++){
      ctx.fillStyle = (i%2===0)?'#1e6b34':'#1a5f2e';
      ctx.fillRect(i*stripeW,0,stripeW,FH);
    }
    ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=3;
    ctx.strokeRect(4,4,FW-8,FH-8);
    ctx.beginPath(); ctx.moveTo(FW/2,4); ctx.lineTo(FW/2,FH-4); ctx.stroke();
    ctx.beginPath(); ctx.arc(FW/2,FH/2,60,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(FW/2,FH/2,3,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fill();

    var boxW=110, boxH=260;
    ctx.strokeRect(4, FH/2-boxH/2, boxW, boxH);
    ctx.strokeRect(FW-4-boxW, FH/2-boxH/2, boxW, boxH);
    var smallW=45, smallH=130;
    ctx.strokeRect(4, FH/2-smallH/2, smallW, smallH);
    ctx.strokeRect(FW-4-smallW, FH/2-smallH/2, smallW, smallH);

    ctx.fillStyle='rgba(255,255,255,0.12)';
    ctx.fillRect(-14, GOAL_TOP, 18, GOAL_HEIGHT);
    ctx.fillRect(FW-4, GOAL_TOP, 18, GOAL_HEIGHT);
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=3;
    ctx.strokeRect(-14, GOAL_TOP, 18, GOAL_HEIGHT);
    ctx.strokeRect(FW-4, GOAL_TOP, 18, GOAL_HEIGHT);
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1;
    for(var ny=GOAL_TOP; ny<GOAL_BOTTOM; ny+=10){
      ctx.beginPath(); ctx.moveTo(-14,ny); ctx.lineTo(4,ny); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(FW-4,ny); ctx.lineTo(FW+4,ny); ctx.stroke();
    }
  }

  function drawReferee(){
    if(!referee.pos) return;
    referee.pos.x += (ball.x-referee.pos.x)*0.03;
    referee.pos.y += (ball.y+40-referee.pos.y)*0.03;
    ctx.beginPath(); ctx.arc(referee.pos.x, referee.pos.y, 11, 0, Math.PI*2); ctx.fillStyle='#222'; ctx.fill();
    ctx.beginPath(); ctx.arc(referee.pos.x, referee.pos.y-2, 5, 0, Math.PI*2); ctx.fillStyle='#ffe45c'; ctx.fill();
  }

  function drawPlayers(){
    var roleTag = { GK:'GK', DF:'DF', MF:'MF', FW:'FW' };
    players.forEach(function(p){
      ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.stroke();

      if(p.isUser){
        ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R+5,0,Math.PI*2);
        ctx.lineWidth=2.5; ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.stroke();
      }
      var fx=p.x+p.facing.x*(PLAYER_R+9), fy=p.y+p.facing.y*(PLAYER_R+9);
      ctx.beginPath(); ctx.arc(fx,fy,3.2,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fill();

      if(ball.controller===p){
        ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R+9,0,Math.PI*2);
        ctx.strokeStyle='rgba(255,212,121,0.7)'; ctx.lineWidth=2; ctx.stroke();
      }

      ctx.font='9px -apple-system,sans-serif'; ctx.textAlign='center';
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText(roleTag[p.role]+' · '+p.skillScore, p.x, p.y-PLAYER_R-12);

      if(p.yellowCards>0){ ctx.fillStyle='#ffd400'; ctx.fillRect(p.x-8, p.y+PLAYER_R+3, 5,7); }
    });
  }

  function drawBall(){
    ctx.beginPath(); ctx.arc(ball.x, ball.y+3, BALL_R*0.9,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R*0.4,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill();
  }

  function updateCardsHud(){
    cyB.textContent=stats.blueYellow; crB.textContent=stats.blueRed;
    cyR.textContent=stats.redYellow; crR.textContent=stats.redRed;
  }

  function endMatch(){
    phase='ended';
    playWhistle(1);
    finalScoreLine.textContent = scoreBlue+' - '+scoreRed;
    var tag,color;
    if(scoreBlue>scoreRed){ tag='MENANG!'; color='var(--accent3)'; }
    else if(scoreBlue<scoreRed){ tag='KALAH'; color='var(--danger)'; }
    else { tag='SERI'; color='var(--accent4)'; }
    resultTag.textContent = tag; resultTag.style.color = color;
    statsBox.innerHTML = 'Kartu Kuning — Biru: '+stats.blueYellow+' | Merah: '+stats.redYellow+'<br>Kartu Merah — Biru: '+stats.blueRed+' | Merah: '+stats.redRed;
    endOverlay.classList.remove('hidden');
  }

  // ================= Main loop =================
  function loop(ts){
    if(lastFrameTs===null) lastFrameTs=ts;
    var dt = (ts-lastFrameTs)/1000;
    if(dt>0.05) dt=0.05;
    lastFrameTs=ts;
    var tSec = ts/1000;
    updateCrowdMood(dt);

    if(phase==='play'){
      matchTime -= dt;
      if(matchTime<=0){
        matchTime=0; timePillEl.textContent=fmtTime(matchTime);
        drawStadium(tSec); endMatch(); return;
      }
      timePillEl.textContent = fmtTime(matchTime);
      if(matchConfig.spectator){
        players.forEach(function(p){ updateAIPlayer(p,dt); });
      } else {
        players.forEach(function(p){ if(p.isUser) updateUser(p,dt); else updateAIPlayer(p,dt); });
      }
      resolvePlayerCollisions();
      if(phase==='play') updateBall(dt);
    } else if(phase==='celebrate' || phase==='kickoff' || phase==='stoppage'){
      phaseTimer -= dt;
      if(phaseTimer<=0){
        if(phase==='celebrate') resetPositionsSoft();
        phase='play';
      }
    }
    drawStadium(tSec);
    updateCardsHud();
    rafId = requestAnimationFrame(loop);
  }

  // ================= Flow: mode -> sandbox -> lineup -> kickoff =================
  function applyFieldConstants(){
    FW = CFG.match.fieldWidth; FH = CFG.match.fieldHeight;
    GOAL_HEIGHT = CFG.match.goalHeight;
    GOAL_TOP = FH/2 - GOAL_HEIGHT/2; GOAL_BOTTOM = FH/2 + GOAL_HEIGHT/2;
    PLAYER_R = CFG.match.playerRadius; BALL_R = CFG.match.ballRadius;
    POSSESSION_R = CFG.match.possessionRadius; STEAL_R = CFG.match.stealRadius;
    MARGIN_X = 130; MARGIN_Y = 105;
  }

  function goToLineup(cfg, modeLabel){
    matchConfig = cfg;
    matchConfig.label = modeLabel;
    setupReferee(cfg.referee);
    buildSquad();

    function renderTeamCards(container, team){
      var list = players.filter(function(p){ return p.team===team; })
        .sort(function(a,b){ return b.skillScore-a.skillScore; });
      container.innerHTML = list.map(function(p){
        var grade = gradeFor(p.skillScore);
        var flag = p.origin==='id' ? '🇮🇩' : '🌍';
        var userTag = p.isUser ? (' <span class="pscTag">'+(matchConfig.spectator?'BINTANG':'KAMU')+'</span>') : '';
        return '<div class="playerStatCard">'+
          '<div class="pscBadge '+p.role+'">'+p.role+'</div>'+
          '<div class="pscInfo"><div class="pscName">'+p.name+userTag+'</div>'+
          '<div class="pscTag">'+flag+' '+(p.origin==='id'?'Lokal':'Internasional')+'</div></div>'+
          '<div class="pscScore"><div class="pscNum" style="color:'+grade.color+'">'+p.skillScore+'</div>'+
          '<div class="pscGrade" style="color:'+grade.color+'">'+grade.label+'</div></div>'+
        '</div>';
      }).join('');
    }
    renderTeamCards(lineupBlueEl, 'blue');
    renderTeamCards(lineupRedEl, 'red');

    modeOverlay.classList.add('hidden');
    sandboxOverlay.classList.add('hidden');
    lineupOverlay.classList.remove('hidden');
  }

  function kickoffMatch(){
    scoreBlue=0; scoreRed=0;
    stats = { blueYellow:0, blueRed:0, redYellow:0, redRed:0 };
    scoreBlueEl.textContent='0'; scoreRedEl.textContent='0';
    matchTime = matchConfig.seconds;
    timePillEl.textContent = fmtTime(matchTime);
    modePillEl.textContent = matchConfig.label + (matchConfig.spectator ? ' · SPECTATOR' : '');
    ball.x=FW/2; ball.y=FH/2; ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0; ball.offsideFlag=null;

    lineupOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');

    if(matchConfig.spectator){
      controlsEl.classList.add('hidden');
      hintEl.classList.add('hidden');
    } else {
      var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
      if(isTouch) controlsEl.classList.remove('hidden'); else hintEl.classList.remove('hidden');
    }

    ensureAudio();
    playWhistle(1);
    phase='kickoff'; phaseTimer=1.0;
    flash('KICK OFF!', matchConfig.label + (matchConfig.spectator?' (Nonton)':''), SVG.whistle);
    setCrowdMood('blue','idle',0); setCrowdMood('red','idle',0);

    lastFrameTs=null;
    if(rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // ================= Boot & event wiring =================
  function wireEvents(){
    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
    if(isTouch) controlsEl.classList.remove('hidden'); else hintEl.classList.remove('hidden');
    window.addEventListener('resize', resize);
    resize();
    buildCrowd();

    document.querySelectorAll('.modeBtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        ensureAudio();
        var mode = btn.getAttribute('data-mode');
        if(mode==='sandbox'){
          modeOverlay.classList.add('hidden');
          sandboxOverlay.classList.remove('hidden');
          return;
        }
        var preset = CFG.modes[mode];
        goToLineup({
          squad: CFG.squadDefault,
          skillMin: preset.skillMin, skillMax: preset.skillMax,
          offside: preset.offside, fouls: preset.fouls,
          referee: preset.referee, seconds: preset.seconds,
          speedMultiplier: preset.speedMultiplier,
          spectator: false
        }, preset.label);
      });
    });

    document.getElementById('sbBack').addEventListener('click', function(){
      sandboxOverlay.classList.add('hidden');
      modeOverlay.classList.remove('hidden');
    });
    var sbSpeedInput = document.getElementById('sbSpeed');
    var sbSpeedVal = document.getElementById('sbSpeedVal');
    sbSpeedInput.addEventListener('input', function(){
      sbSpeedVal.textContent = parseFloat(sbSpeedInput.value).toFixed(1)+'x';
    });
    document.getElementById('sbStart').addEventListener('click', function(){
      function num(id){ return parseInt(document.getElementById(id).value,10) || 0; }
      var skillMin = clamp(num('sbSkillMin'), CFG.skillScale.min, CFG.skillScale.max);
      var skillMax = clamp(num('sbSkillMax'), CFG.skillScale.min, CFG.skillScale.max);
      if(skillMax < skillMin){ var tmp=skillMin; skillMin=skillMax; skillMax=tmp; }
      var cfg = {
        squad: {
          blue: { GK:num('sbBlueGK'), DF:num('sbBlueDF'), MF:num('sbBlueMF'), FW:num('sbBlueFW') },
          red:  { GK:num('sbRedGK'),  DF:num('sbRedDF'),  MF:num('sbRedMF'),  FW:num('sbRedFW')  }
        },
        skillMin: skillMin, skillMax: skillMax,
        offside: document.getElementById('sbOffside').value==='1',
        fouls: document.getElementById('sbFouls').value==='1',
        referee: document.getElementById('sbReferee').value,
        seconds: Math.max(30, (parseInt(document.getElementById('sbDuration').value,10)||5)*60),
        speedMultiplier: parseFloat(sbSpeedInput.value) || 1,
        spectator: document.getElementById('sbSpectator').value==='1'
      };
      goToLineup(cfg, 'SANDBOX');
    });

    document.getElementById('lineupBack').addEventListener('click', function(){
      lineupOverlay.classList.add('hidden');
      modeOverlay.classList.remove('hidden');
    });
    document.getElementById('lineupStart').addEventListener('click', kickoffMatch);

    retryBtn.addEventListener('click', function(){
      endOverlay.classList.add('hidden');
      modeOverlay.classList.remove('hidden');
    });

    window.addEventListener('keydown', function(e){
      var k = e.key.toLowerCase();
      if(k==='w'||k==='arrowup') keys.up=true;
      if(k==='s'||k==='arrowdown') keys.down=true;
      if(k==='a'||k==='arrowleft') keys.left=true;
      if(k==='d'||k==='arrowright') keys.right=true;
      if(k===' '||e.code==='Space'){ keys.shoot=true; e.preventDefault(); }
    });
    window.addEventListener('keyup', function(e){
      var k = e.key.toLowerCase();
      if(k==='w'||k==='arrowup') keys.up=false;
      if(k==='s'||k==='arrowdown') keys.down=false;
      if(k==='a'||k==='arrowleft') keys.left=false;
      if(k==='d'||k==='arrowright') keys.right=false;
      if(k===' '||e.code==='Space'){ keys.shoot=false; }
    });

    function bindHold(el,onDown,onUp){
      el.addEventListener('pointerdown', function(e){ e.preventDefault(); onDown(); el.classList.add('active'); });
      el.addEventListener('pointerup', function(){ onUp(); el.classList.remove('active'); });
      el.addEventListener('pointerleave', function(){ onUp(); el.classList.remove('active'); });
      el.addEventListener('pointercancel', function(){ onUp(); el.classList.remove('active'); });
    }
    document.querySelectorAll('.dbtn').forEach(function(btn){
      var k = btn.getAttribute('data-k');
      if(!k) return;
      bindHold(btn, function(){ keys[k]=true; }, function(){ keys[k]=false; });
    });
    bindHold(document.getElementById('shootBtn'), function(){ keys.shoot=true; }, function(){ keys.shoot=false; });
  }

  function init(){
    grabDom();
    applyFieldConstants();
    wireEvents();
    // idle preview render
    matchConfig = { squad: CFG.squadDefault, skillMin: CFG.modes.normal.skillMin, skillMax: CFG.modes.normal.skillMax, offside:true, fouls:true, referee:'adil', seconds:300, speedMultiplier:1, spectator:false, label:'NORMAL' };
    setupReferee('adil');
    buildSquad();
    resize();
    drawStadium(0);
  }

  loadConfig(init);
})();
