(function(){
  'use strict';

  // ================= Fallback config =================
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
    teamDefaults: { blue:{name:'Tim Biru',color:'#3fa8e0',flag:'🔵',logo:null}, red:{name:'Tim Merah',color:'#e0483f',flag:'🔴',logo:null} },
    squadDefault: { blue:{GK:1,DF:2,MF:2,FW:1}, red:{GK:1,DF:2,MF:2,FW:2} },
    brands: [
      { name:'VOLTA ENERGY', tagline:'Power The Match', color:'#f4c400', accent:'#111318' },
      { name:'AERIS AIRWAYS', tagline:'Fly With Champions', color:'#1c3faa', accent:'#ffffff' },
      { name:'NEXORA MOBILE', tagline:'Connect The Game', color:'#9b3ffb', accent:'#ffffff' },
      { name:'STRIKE SPORT', tagline:'Wear The Win', color:'#e0212f', accent:'#111318' },
      { name:'GOLDLEAF BANK', tagline:'Banking On Victory', color:'#caa03d', accent:'#111318' }
    ],
    match: { fieldWidth:960, fieldHeight:600, goalHeight:170, playerRadius:14, ballRadius:8, possessionRadius:24, stealRadius:20, userSpeed:175, aiBaseSpeed:150, shootPower:430, shootRange:300 },
    modes: {
      latihan:{ label:'LATIHAN', skillMin:50, skillMax:75, offside:false, fouls:false, referee:'pemula', halfTimeMinutes:2.5, fullTimeMinutes:5, extraTimeEnabled:false, extraTimeMinutes:0, hydrationBreak:false, benchBlue:0, benchRed:0, speedMultiplier:1.0 },
      easy:{ label:'EASY', skillMin:75, skillMax:105, offside:true, fouls:true, referee:'pemula', halfTimeMinutes:2.5, fullTimeMinutes:5, extraTimeEnabled:false, extraTimeMinutes:0, hydrationBreak:false, benchBlue:0, benchRed:0, speedMultiplier:1.0 },
      normal:{ label:'NORMAL', skillMin:105, skillMax:140, offside:true, fouls:true, referee:'adil', halfTimeMinutes:2.5, fullTimeMinutes:5, extraTimeEnabled:false, extraTimeMinutes:0, hydrationBreak:false, benchBlue:0, benchRed:0, speedMultiplier:1.0 },
      hard:{ label:'SUSAH', skillMin:140, skillMax:195, offside:true, fouls:true, referee:'pro', halfTimeMinutes:2.5, fullTimeMinutes:5, extraTimeEnabled:false, extraTimeMinutes:0, hydrationBreak:false, benchBlue:0, benchRed:0, speedMultiplier:1.08 }
    },
    refereeProfiles: {
      adil:{ foulMult:1.0, offsideAcc:0.95, cardMult:1.0, biased:false, noisy:false },
      tidak_adil:{ foulMult:1.0, offsideAcc:0.85, cardMult:1.0, biased:true, noisy:false },
      pro:{ foulMult:1.15, offsideAcc:0.99, cardMult:1.15, biased:false, noisy:false },
      pemula:{ foulMult:0.55, offsideAcc:0.55, cardMult:0.7, biased:false, noisy:true }
    }
  };

  var CFG = null;
  var TEAMS_KEY = 'bolagol_teams_v1';
  var teams = null;

  function loadConfig(cb){
    fetch('config.json').then(function(r){ if(!r.ok) throw new Error('bad'); return r.json(); })
      .then(function(json){ CFG = json; cb(); })
      .catch(function(){ CFG = DEFAULT_CONFIG; cb(); });
  }

  function loadTeams(){
    try{ var raw = localStorage.getItem(TEAMS_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }
  function saveTeams(){ try{ localStorage.setItem(TEAMS_KEY, JSON.stringify(teams)); }catch(e){} }
  function initTeams(){
    var loaded = loadTeams();
    teams = loaded || { blue: shallowCopy(CFG.teamDefaults.blue), red: shallowCopy(CFG.teamDefaults.red) };
  }
  function shallowCopy(o){ var r={}; for(var k in o) r[k]=o[k]; return r; }

  // ================= DOM refs =================
  var canvas, ctx;
  var sbNameBlueEl, sbNameRedEl, sbScoreBlueEl, sbScoreRedEl, sbFlagBlueEl, sbFlagRedEl, sbClockEl, sbPeriodEl;
  var modeOverlay, sandboxOverlay, lineupOverlay, endOverlay, customOverlay;
  var retryBtn, finalScoreLine, resultTag, statsBox;
  var controlsEl, hintEl, cyB, crB, cyR, crR, cardsBlueNameEl, cardsRedNameEl;
  var lineupBlueEl, lineupRedEl, lineupBlueTitleEl, lineupRedTitleEl;
  var bannerEl, bannerInnerEl, adBreakEl, adCardEl;
  var leadBlueNameEl, leadRedNameEl;

  function grabDom(){
    canvas = document.getElementById('field'); ctx = canvas.getContext('2d');
    sbNameBlueEl=document.getElementById('sbNameBlue'); sbNameRedEl=document.getElementById('sbNameRed');
    sbScoreBlueEl=document.getElementById('sbScoreBlue'); sbScoreRedEl=document.getElementById('sbScoreRed');
    sbFlagBlueEl=document.getElementById('sbFlagBlue'); sbFlagRedEl=document.getElementById('sbFlagRed');
    sbClockEl=document.getElementById('sbClock'); sbPeriodEl=document.getElementById('sbPeriod');
    modeOverlay=document.getElementById('modeOverlay'); sandboxOverlay=document.getElementById('sandboxOverlay');
    lineupOverlay=document.getElementById('lineupOverlay'); endOverlay=document.getElementById('endOverlay');
    customOverlay=document.getElementById('customOverlay');
    retryBtn=document.getElementById('retryBtn'); finalScoreLine=document.getElementById('finalScoreLine');
    resultTag=document.getElementById('resultTag'); statsBox=document.getElementById('statsBox');
    controlsEl=document.getElementById('controls'); hintEl=document.getElementById('hint');
    cyB=document.getElementById('cyB'); crB=document.getElementById('crB');
    cyR=document.getElementById('cyR'); crR=document.getElementById('crR');
    cardsBlueNameEl=document.getElementById('cardsBlueName'); cardsRedNameEl=document.getElementById('cardsRedName');
    lineupBlueEl=document.getElementById('lineupBlue'); lineupRedEl=document.getElementById('lineupRed');
    lineupBlueTitleEl=document.getElementById('lineupBlueTitle'); lineupRedTitleEl=document.getElementById('lineupRedTitle');
    bannerEl=document.getElementById('banner'); bannerInnerEl=document.getElementById('bannerInner');
    adBreakEl=document.getElementById('adBreak'); adCardEl=document.getElementById('adCard');
    leadBlueNameEl=document.getElementById('leadBlueName'); leadRedNameEl=document.getElementById('leadRedName');
  }

  // ================= Utility =================
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function randInt(a,b){ return Math.floor(rand(a,b+1)); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function normVec(dx,dy){
    var len=Math.sqrt(dx*dx+dy*dy);
    if(len<0.0001) return {x:0,y:0};
    return {x:dx/len, y:dy/len};
  }
  function fmtMMSS(t){
    t = Math.max(0, Math.floor(t));
    var m=Math.floor(t/60), s=t%60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }
  function skillToMultiplier(score){
    var lo=CFG.skillScale.min, hi=CFG.skillScale.max;
    var t=clamp((score-lo)/(hi-lo),0,1);
    return 0.5+t*1.0;
  }
  function gradeFor(score){
    var tiers=CFG.gradeTiers;
    for(var i=0;i<tiers.length;i++) if(score<=tiers[i].max) return tiers[i];
    return tiers[tiers.length-1];
  }
  function generatePlayerName(){
    var isIndo = Math.random()<0.55;
    if(isIndo) return { name: pick(CFG.names.idFirst)+' '+pick(CFG.names.idLast), origin:'id' };
    return { name: pick(CFG.names.intlFirst)+' '+pick(CFG.names.intlLast), origin:'intl' };
  }

  // ================= Banner (non-blocking broadcast lower-third) =================
  var bannerHideTimer = null;
  function bannerShow(title, sub, accentColor){
    bannerInnerEl.style.borderLeftColor = accentColor || '#ffd479';
    bannerInnerEl.innerHTML = '<div><div style="font-size:14.5px;">'+title+'</div>'+(sub?'<div class="bSub">'+sub+'</div>':'')+'</div>';
    bannerInnerEl.classList.remove('show');
    void bannerInnerEl.offsetWidth;
    bannerInnerEl.classList.add('show');
  }

  // ================= Audio (prosedural) =================
  var audioCtx=null, ambientGain=null, ambientTarget=0.07;
  function ensureAudio(){
    if(audioCtx){ if(audioCtx.state==='suspended') audioCtx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    audioCtx = new AC();
    var bufSize = audioCtx.sampleRate*2;
    var buffer = audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for(var i=0;i<bufSize;i++) data[i]=(Math.random()*2-1);
    var noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer=buffer; noiseSrc.loop=true;
    var filter = audioCtx.createBiquadFilter();
    filter.type='bandpass'; filter.frequency.value=550; filter.Q.value=0.5;
    ambientGain = audioCtx.createGain(); ambientGain.gain.value=0;
    noiseSrc.connect(filter).connect(ambientGain).connect(audioCtx.destination);
    noiseSrc.start();
  }
  function setAmbientTarget(v){
    ambientTarget=v;
    if(ambientGain && audioCtx){
      ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(v, audioCtx.currentTime+0.4);
    }
  }
  function playTone(freq,duration,type,gainVal,startDelay){
    if(!audioCtx) return;
    var t0=audioCtx.currentTime+(startDelay||0);
    var osc=audioCtx.createOscillator(), g=audioCtx.createGain();
    osc.type=type||'sine'; osc.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(gainVal||0.18,t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0+duration+0.02);
  }
  function playWhistle(long){
    if(!audioCtx) return;
    playTone(2900, long?0.5:0.18, 'square',0.12,0);
    if(!long) playTone(2900,0.18,'square',0.12,0.22);
  }
  function playFoulBeep(){
    if(!audioCtx) return;
    playTone(2600,0.16,'square',0.11,0);
    playTone(2100,0.2,'square',0.11,0.2);
  }
  function playGoalRoar(){
    if(!audioCtx) return;
    var t0=audioCtx.currentTime;
    var bufSize=audioCtx.sampleRate*1.6;
    var buffer=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
    var data=buffer.getChannelData(0);
    for(var i=0;i<bufSize;i++) data[i]=(Math.random()*2-1);
    var src=audioCtx.createBufferSource(); src.buffer=buffer;
    var filter=audioCtx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=850; filter.Q.value=0.4;
    var g=audioCtx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.linearRampToValueAtTime(0.42,t0+0.15);
    g.gain.linearRampToValueAtTime(0.05,t0+1.4);
    src.connect(filter).connect(g).connect(audioCtx.destination);
    src.start(t0); src.stop(t0+1.6);
  }

  // ================= Field constants =================
  var FW,FH,GOAL_HEIGHT,GOAL_TOP,GOAL_BOTTOM,PLAYER_R,BALL_R,POSSESSION_R,STEAL_R;
  var ROLE_ADV = { GK:0.05, DF:0.22, MF:0.48, FW:0.72 };
  var ROLE_SUPPORT_DIST = { DF:80, MF:150, FW:190 };
  var dpr = Math.min(window.devicePixelRatio||1,2);
  var STW,STH,MARGIN_X,MARGIN_Y;

  function resize(){
    var maxW=window.innerWidth-20, maxH=window.innerHeight-170;
    var stw=FW+260, sth=FH+210;
    var scale=Math.min(maxW/stw, maxH/sth);
    if(scale<=0||!isFinite(scale)) scale=0.5;
    canvas.style.width=(stw*scale)+'px'; canvas.style.height=(sth*scale)+'px';
    canvas.width=Math.round(stw*dpr); canvas.height=Math.round(sth*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    STW=stw; STH=sth;
  }

  // ================= Referee =================
  var referee = { type:'adil', favoredTeam:null, profile:null, pos:null };
  function setupReferee(type){
    referee.type=type;
    referee.profile = CFG.refereeProfiles[type] || CFG.refereeProfiles.adil;
    referee.favoredTeam = (type==='tidak_adil') ? (Math.random()<0.5?'blue':'red') : null;
    referee.pos = { x:FW/2, y:FH/2 };
  }

  // ================= Crowd =================
  var crowd = [];
  function hexToRgb(hex){
    hex = hex.replace('#','');
    if(hex.length===3) hex = hex.split('').map(function(c){return c+c;}).join('');
    var num = parseInt(hex,16);
    return [(num>>16)&255,(num>>8)&255,num&255];
  }
  function buildCrowd(){
    crowd=[];
    var spacing=22;
    function fillBand(x0,y0,x1,y1){
      for(var y=y0;y<y1;y+=spacing){
        for(var x=x0;x<x1;x+=spacing){
          var jx=x+rand(-4,4), jy=y+rand(-4,4);
          if(Math.random()<0.12) continue;
          crowd.push({ x:jx, y:jy, faction: jx<STW/2?'blue':'red', phase:rand(0,Math.PI*2), speed:rand(1.6,2.6), tone:rand(0.75,1.15) });
        }
      }
    }
    fillBand(0,6,STW,MARGIN_Y-12);
    fillBand(0,STH-MARGIN_Y+12,STW,STH-6);
    fillBand(6,MARGIN_Y,MARGIN_X-12,STH-MARGIN_Y);
    fillBand(STW-MARGIN_X+12,MARGIN_Y,STW-6,STH-MARGIN_Y);
  }
  var crowdMood = { blue:{state:'idle',timer:0}, red:{state:'idle',timer:0} };
  function refreshAmbientFromMood(){
    var target=0.07;
    if(crowdMood.blue.state==='cheer'||crowdMood.red.state==='cheer') target=0.34;
    else if(crowdMood.blue.state==='sad'&&crowdMood.red.state==='sad') target=0.04;
    setAmbientTarget(target);
  }
  function setCrowdMood(team,state,dur){ crowdMood[team].state=state; crowdMood[team].timer=dur; refreshAmbientFromMood(); }
  function updateCrowdMood(dt){
    var changed=false;
    ['blue','red'].forEach(function(t){
      if(crowdMood[t].timer>0){ crowdMood[t].timer-=dt; if(crowdMood[t].timer<=0){ crowdMood[t].state='idle'; changed=true; } }
    });
    if(changed) refreshAmbientFromMood();
  }
  function drawCrowd(t){
    for(var i=0;i<crowd.length;i++){
      var c=crowd[i];
      var mood=crowdMood[c.faction];
      var baseRgb = hexToRgb(teams[c.faction].color);
      var amp,yOff,mult;
      if(mood.state==='cheer'){ amp=6; yOff=-2; mult=1.25; }
      else if(mood.state==='sad'){ amp=1; yOff=3; mult=0.45; }
      else { amp=2.5; yOff=0; mult=0.8; }
      var bounce=Math.sin(t*c.speed+c.phase)*amp;
      var r=Math.round(baseRgb[0]*c.tone*mult), g=Math.round(baseRgb[1]*c.tone*mult), b=Math.round(baseRgb[2]*c.tone*mult);
      ctx.fillStyle='rgb('+r+','+g+','+b+')';
      ctx.fillRect(c.x-2, c.y+yOff+bounce-2, 4, 5);
    }
  }

  // ================= Billboards (5 fictional brands) =================
  var billboardScroll = 0;
  function drawBillboard(){
    var stripY=-22, stripH=16;
    var blockW=190;
    var cycleWidth = blockW*CFG.brands.length;
    var offset = -(billboardScroll % cycleWidth);
    var x = offset;
    ctx.save();
    ctx.font='bold 9.5px -apple-system,sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
    while(x < FW+blockW){
      for(var i=0;i<CFG.brands.length;i++){
        var b = CFG.brands[i];
        if(x+blockW>0 && x<FW){
          ctx.fillStyle=b.color; ctx.fillRect(x, stripY, blockW-6, stripH);
          ctx.fillStyle=b.accent; ctx.fillText(b.name+'  •  '+b.tagline, x+8, stripY+stripH/2+1);
        }
        x += blockW;
      }
    }
    ctx.restore();
  }

  // ================= Half-time ad break =================
  var adTimer=null, adIndex=0;
  function renderAdSlide(){
    var b = CFG.brands[adIndex];
    adCardEl.style.background = b.color;
    adCardEl.style.color = b.accent;
    adCardEl.innerHTML = '<span class="adLabel">IKLAN</span>'+b.name+'<span class="adTag">'+b.tagline+'</span>';
  }
  function startAdCarousel(){
    adIndex=0; renderAdSlide();
    adTimer = setInterval(function(){ adIndex=(adIndex+1)%CFG.brands.length; renderAdSlide(); }, 1300);
  }
  function stopAdCarousel(){ if(adTimer) clearInterval(adTimer); adTimer=null; }

  // ================= Match state =================
  var matchConfig=null;
  var players=[], bench={blue:[],red:[]};
  var ball={ x:0,y:0,vx:0,vy:0,controller:null,freeTimer:0,offsideFlag:null };
  var scoreBlue=0, scoreRed=0;
  var stats={ blueYellow:0, blueRed:0, redYellow:0, redRed:0 };
  var phase='idle'; // idle | play | break | ended
  var breakKind=null, breakTimer=0, breakCurRef=null;
  var elapsed=0;
  var periods=[], periodIndex=0;
  var hydrationDone={};
  var subSchedule={ blue:[], red:[] };
  var lastFrameTs=null, rafId=null;
  var keys={ up:false,down:false,left:false,right:false,shoot:false };

  function buildSquad(){
    players=[]; bench={blue:[],red:[]};
    var teamDefs=[
      { team:'blue', attackDir:1, ownGoalX:0, cfg:matchConfig.squad.blue, extraUser:true, benchN: matchConfig.benchBlue||0 },
      { team:'red', attackDir:-1, ownGoalX:FW, cfg:matchConfig.squad.red, extraUser:false, benchN: matchConfig.benchRed||0 }
    ];
    teamDefs.forEach(function(T){
      var roles=['GK','DF','MF','FW'];
      var counts={ GK:T.cfg.GK||0, DF:T.cfg.DF||0, MF:T.cfg.MF||0, FW:T.cfg.FW||0 };
      roles.forEach(function(role){
        var n = counts[role] + (T.extraUser && role==='FW' ? 1 : 0);
        if(n<=0) return;
        var placedUser=false;
        for(var i=0;i<n;i++){
          var isUserSlot=false;
          if(T.extraUser && role==='FW' && !placedUser && i===Math.floor(n/2)){ isUserSlot=true; placedUser=true; }
          var x=T.ownGoalX+T.attackDir*ROLE_ADV[role]*FW;
          var y;
          if(role==='GK') y=GOAL_TOP+(GOAL_BOTTOM-GOAL_TOP)*((i+1)/(n+1));
          else y=40+(FH-80)*((i+1)/(n+1));
          var skillScore = isUserSlot ? CFG.skillScale.userDefault : Math.round(rand(matchConfig.skillMin, matchConfig.skillMax));
          var g = generatePlayerName();
          players.push({
            team:T.team, role:role, isUser:isUserSlot,
            name:g.name, origin:g.origin,
            x:x, y:y, baseX:x, baseY:y, vx:0, vy:0,
            facing:{x:T.attackDir,y:0},
            jinkSign: Math.random()<0.5?1:-1,
            skillScore:skillScore, skill:skillToMultiplier(skillScore),
            actionCooldown:0, shotTimer:rand(0.3,0.8),
            yellowCards:0, sentOff:false,
            color: teams[T.team].color
          });
        }
      });
      for(var bi=0; bi<T.benchN; bi++){
        var brole = pick(['DF','MF','FW']);
        var bSkill = Math.round(rand(matchConfig.skillMin, matchConfig.skillMax));
        var bg = generatePlayerName();
        bench[T.team].push({
          team:T.team, role:brole, isUser:false, name:bg.name, origin:bg.origin,
          skillScore:bSkill, skill:skillToMultiplier(bSkill),
          yellowCards:0, sentOff:false, color: teams[T.team].color,
          x:0,y:0,baseX:0,baseY:0,vx:0,vy:0, facing:{x:T.attackDir,y:0}, jinkSign: Math.random()<0.5?1:-1,
          actionCooldown:0, shotTimer:rand(0.3,0.8)
        });
      }
    });
  }

  function resetPositionsSoft(){
    players.forEach(function(p){ if(p.sentOff) return; p.x=p.baseX; p.y=p.baseY; p.vx=0; p.vy=0; p.actionCooldown=0; });
    ball.x=FW/2; ball.y=FH/2; ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0; ball.offsideFlag=null;
  }
  function placeBallAt(x,y){
    ball.x=clamp(x,BALL_R+2,FW-BALL_R-2); ball.y=clamp(y,BALL_R+2,FH-BALL_R-2);
    ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0.35; ball.offsideFlag=null;
  }
  function nearestOfTeam(team,x,y){
    var best=null,bestD=Infinity;
    for(var i=0;i<players.length;i++){
      var p=players[i]; if(p.team!==team||p.sentOff) continue;
      var d=Math.sqrt((p.x-x)*(p.x-x)+(p.y-y)*(p.y-y));
      if(d<bestD){ bestD=d; best=p; }
    }
    return best;
  }

  // ================= Offside =================
  function checkOffsideOnKick(p){
    if(!matchConfig.offside) return;
    var attackDir=p.team==='blue'?1:-1;
    var opponents=players.filter(function(q){ return q.team!==p.team && !q.sentOff; });
    if(opponents.length<1) return;
    var advVals=opponents.map(function(q){ return q.x*attackDir; }).sort(function(a,b){ return b-a; });
    var line=advVals.length>1?advVals[1]:advVals[0];
    var ballAdv=ball.x*attackDir;
    var flagged=[];
    players.forEach(function(q){
      if(q.team!==p.team||q===p||q.sentOff) return;
      var qAdv=q.x*attackDir;
      if(qAdv>line && qAdv>ballAdv) flagged.push(q);
    });
    ball.offsideFlag = flagged.length>0 ? { team:p.team, players:flagged, spotX:p.x, spotY:p.y } : null;
  }
  function resolveOffsideIfNeeded(newController){
    if(!ball.offsideFlag) return false;
    var flag=ball.offsideFlag; ball.offsideFlag=null;
    if(!newController||newController.team!==flag.team) return false;
    if(flag.players.indexOf(newController)===-1) return false;
    var acc=referee.profile.offsideAcc;
    if(referee.profile.biased) acc=(flag.team===referee.favoredTeam)?acc*0.3:Math.min(0.98,acc*1.3);
    if(referee.profile.noisy) acc*=rand(0.6,1.2);
    if(Math.random()>acc) return false;
    var otherTeam = flag.team==='blue'?'red':'blue';
    triggerStoppage('offside', otherTeam, flag.spotX, flag.spotY);
    return true;
  }

  // ================= Shooting =================
  function doShoot(p,targetX,targetY,power){
    var spread=(1-p.skill/1.5)*0.5;
    var baseAngle=Math.atan2(targetY-p.y,targetX-p.x);
    var angle=baseAngle+rand(-spread,spread);
    var pw=power||CFG.match.shootPower;
    ball.vx=Math.cos(angle)*pw; ball.vy=Math.sin(angle)*pw;
    ball.controller=null; ball.freeTimer=0.28;
    checkOffsideOnKick(p);
  }

  // ================= Fouls / cards =================
  function handleCard(q,severity){
    var mult=referee.profile.cardMult;
    if(referee.profile.biased) mult*=(q.team===referee.favoredTeam)?0.5:1.4;
    if(referee.profile.noisy) mult*=rand(0.5,1.3);
    var sev=severity*mult;
    if(sev>0.88){ sendOff(q); return 'red'; }
    else if(sev>0.55){
      q.yellowCards++;
      if(q.team==='blue') stats.blueYellow++; else stats.redYellow++;
      if(q.yellowCards>=2){ sendOff(q); return 'red2'; }
      return 'yellow';
    }
    return null;
  }
  function sendOff(q){
    q.sentOff=true;
    if(q.team==='blue') stats.blueRed++; else stats.redRed++;
    var idx=players.indexOf(q); if(idx!==-1) players.splice(idx,1);
  }
  function triggerStoppage(kind, possessionTeam, x, y){
    if(phase!=='play') return;
    placeBallAt(x,y);
    playWhistle(0);
    var tm = teams[possessionTeam];
    if(kind==='offside') bannerShow('🚩 OFFSIDE', 'Bola untuk '+tm.name, tm.color);
    else if(kind==='foul') bannerShow('⚠️ PELANGGARAN', 'Bola untuk '+tm.name, tm.color);
  }

  // ================= Substitution (sandbox only) =================
  function scheduleSubs(){
    subSchedule = { blue:[], red:[] };
    var totalNormal = matchConfig.fullTimeMinutes*60;
    ['blue','red'].forEach(function(team){
      var n = Math.min(bench[team].length, 2);
      var times = [];
      if(n>=1) times.push(totalNormal*rand(0.28,0.48));
      if(n>=2) times.push(totalNormal*rand(0.62,0.86));
      subSchedule[team] = times;
    });
  }
  function maybeDoSubs(){
    ['blue','red'].forEach(function(team){
      var sched = subSchedule[team];
      for(var i=sched.length-1;i>=0;i--){
        if(elapsed >= sched[i]){
          sched.splice(i,1);
          doSubstitution(team);
        }
      }
    });
  }
  function doSubstitution(team){
    var benchArr = bench[team];
    if(!benchArr || benchArr.length===0) return;
    var incoming = benchArr.shift();
    var candidates = players.filter(function(p){ return p.team===team && !p.isUser && p.role===incoming.role; });
    if(candidates.length===0) candidates = players.filter(function(p){ return p.team===team && !p.isUser && p.role!=='GK'; });
    if(candidates.length===0){ benchArr.unshift(incoming); return; }
    var outgoing = candidates[Math.floor(Math.random()*candidates.length)];
    incoming.x=outgoing.x; incoming.y=outgoing.y; incoming.baseX=outgoing.baseX; incoming.baseY=outgoing.baseY;
    incoming.facing=outgoing.facing; incoming.vx=0; incoming.vy=0; incoming.role=outgoing.role;
    var idx=players.indexOf(outgoing);
    if(idx!==-1) players.splice(idx,1,incoming);
    bannerShow('🔄 PERGANTIAN PEMAIN', teams[team].name+': '+outgoing.name+' ➜ '+incoming.name, teams[team].color);
    playWhistle(0);
  }

  // ================= User / AI movement =================
  function updateUser(p,dt){
    var dx=0,dy=0;
    if(keys.up) dy-=1; if(keys.down) dy+=1; if(keys.left) dx-=1; if(keys.right) dx+=1;
    var dir=normVec(dx,dy);
    var speed=CFG.match.userSpeed*matchConfig.speedMultiplier;
    if(dir.x!==0||dir.y!==0) p.facing=dir;
    var targetVx=dir.x*speed, targetVy=dir.y*speed;
    var smooth=clamp(dt*8,0,1);
    p.vx+=(targetVx-p.vx)*smooth; p.vy+=(targetVy-p.vy)*smooth;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.x=clamp(p.x,PLAYER_R,FW-PLAYER_R); p.y=clamp(p.y,PLAYER_R,FH-PLAYER_R);
    if(keys.shoot && ball.controller===p && ball.freeTimer<=0){
      doShoot(p, p.x+p.facing.x*999, p.y+p.facing.y*999, CFG.match.shootPower);
      keys.shoot=false;
    }
  }

  function updateAIPlayer(p,dt){
    var attackDir=p.team==='blue'?1:-1;
    var ownGoalX=p.team==='blue'?0:FW;
    var oppGoalX=p.team==='blue'?FW:0;
    var goalY=FH/2;
    var dir={x:0,y:0};
    var ctrl=ball.controller;
    var speed=CFG.match.aiBaseSpeed*p.skill*matchConfig.speedMultiplier;

    if(p.role==='GK'){
      var gkX=ownGoalX+attackDir*45;
      var trackY=clamp(ball.y,GOAL_TOP+15,GOAL_BOTTOM-15);
      var ballDist=Math.sqrt((ball.x-p.x)*(ball.x-p.x)+(ball.y-p.y)*(ball.y-p.y));
      if(ctrl===p){
        var clearX=ownGoalX+attackDir*FW*0.5, clearY=FH/2+rand(-90,90);
        p.shotTimer-=dt;
        if(p.shotTimer<=0){ doShoot(p,clearX,clearY,380); p.shotTimer=rand(0.4,0.8); }
        dir={x:0,y:0};
      } else if(ballDist<100 && (!ctrl||ctrl.team!==p.team)){
        dir=normVec(ball.x-p.x, ball.y-p.y);
      } else {
        dir=normVec(gkX-p.x, trackY-p.y);
      }
      speed*=1.05;
    } else {
      var supportDist=ROLE_SUPPORT_DIST[p.role]||150;
      if(ctrl===p){
        var tX=oppGoalX, tY=goalY;
        dir=normVec(tX-p.x, tY-p.y);
        var nearOpp = nearestOfTeam(p.team==='blue'?'red':'blue', p.x, p.y);
        if(nearOpp){
          var dOppSq=(nearOpp.x-p.x)*(nearOpp.x-p.x)+(nearOpp.y-p.y)*(nearOpp.y-p.y);
          if(dOppSq<70*70){
            var perp={x:-dir.y,y:dir.x};
            dir=normVec(dir.x+perp.x*p.jinkSign*0.65, dir.y+perp.y*p.jinkSign*0.65);
          }
        }
        var dGoal=Math.sqrt((p.x-oppGoalX)*(p.x-oppGoalX)+(p.y-goalY)*(p.y-goalY));
        if(dGoal<CFG.match.shootRange){
          p.shotTimer-=dt;
          if(p.shotTimer<=0 && p.actionCooldown<=0){
            doShoot(p,oppGoalX,goalY+rand(-30,30),CFG.match.shootPower*rand(0.85,1.05));
            p.actionCooldown=1.1; p.shotTimer=rand(0.5,1.0);
          }
        } else { p.shotTimer=rand(0.3,0.7); }
      } else if(ctrl && ctrl.team===p.team){
        var supportX=clamp(ctrl.x+attackDir*supportDist,PLAYER_R+10,FW-PLAYER_R-10);
        var supportY=clamp(p.baseY+(ctrl.y>FH/2?-50:50),PLAYER_R+10,FH-PLAYER_R-10);
        dir=normVec(supportX-p.x, supportY-p.y);
      } else if(ctrl && ctrl.team!==p.team){
        var defender=nearestOfTeam(p.team, ball.x, ball.y);
        if(defender===p) dir=normVec(ball.x-p.x, ball.y-p.y);
        else {
          var markX=clamp(ownGoalX+attackDir*170,PLAYER_R+10,FW-PLAYER_R-10);
          dir=normVec(markX-p.x, p.baseY-p.y);
        }
      } else {
        var chaser=nearestOfTeam(p.team, ball.x, ball.y);
        if(chaser===p) dir=normVec(ball.x-p.x, ball.y-p.y);
        else {
          var holdX=p.baseX+(ball.x-p.baseX)*0.25, holdY=p.baseY+(ball.y-p.baseY)*0.25;
          dir=normVec(holdX-p.x, holdY-p.y);
        }
      }
      if(p.actionCooldown>0) p.actionCooldown-=dt;
    }

    if(dir.x!==0||dir.y!==0) p.facing=dir;
    var targetVx=dir.x*speed, targetVy=dir.y*speed;
    var smoothAI=clamp(dt*6.5,0,1);
    p.vx+=(targetVx-p.vx)*smoothAI; p.vy+=(targetVy-p.vy)*smoothAI;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.x=clamp(p.x,PLAYER_R,FW-PLAYER_R); p.y=clamp(p.y,PLAYER_R,FH-PLAYER_R);
  }

  function resolvePlayerCollisions(){
    for(var i=0;i<players.length;i++){
      for(var j=i+1;j<players.length;j++){
        var a=players[i], b=players[j];
        var dx=b.x-a.x, dy=b.y-a.y;
        var d=Math.sqrt(dx*dx+dy*dy);
        var minD=PLAYER_R*2*0.85;
        if(d>0 && d<minD){
          var overlap=(minD-d)/2, nx=dx/d, ny=dy/d;
          a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
        }
      }
    }
  }

  function updateBall(dt){
    var prevController=ball.controller;
    if(ball.freeTimer>0){ ball.freeTimer-=dt; }
    else {
      var best=null,bestD=Infinity;
      for(var i=0;i<players.length;i++){
        var p=players[i];
        var d=Math.sqrt((p.x-ball.x)*(p.x-ball.x)+(p.y-ball.y)*(p.y-ball.y));
        if(d<POSSESSION_R && d<bestD){ bestD=d; best=p; }
      }
      if(best!==prevController) resolveOffsideIfNeeded(best);
      ball.controller=best;
    }

    if(ball.controller && ball.freeTimer<=0){
      var p=ball.controller;
      var tx=p.x+p.facing.x*20, ty=p.y+p.facing.y*20;
      ball.x+=(tx-ball.x)*0.3; ball.y+=(ty-ball.y)*0.3;
      ball.vx*=0.8; ball.vy*=0.8;

      for(var k=0;k<players.length;k++){
        var q=players[k];
        if(q.team===p.team) continue;
        var dq=Math.sqrt((q.x-ball.x)*(q.x-ball.x)+(q.y-ball.y)*(q.y-ball.y));
        if(dq<STEAL_R){
          if(Math.random()<0.5*q.skill*dt){
            var cleanProb=clamp(0.5+(q.skill-p.skill)*0.4,0.15,0.85);
            var r=Math.random();
            if(r<cleanProb){
              var away=normVec(ball.x-p.x, ball.y-p.y);
              if(away.x===0&&away.y===0) away={x:(q.team==='blue'?1:-1),y:0};
              ball.vx=away.x*120+(Math.random()-0.5)*60; ball.vy=away.y*120+(Math.random()-0.5)*60;
              ball.controller=null; ball.freeTimer=0.15;
            } else if(matchConfig.fouls && r<cleanProb+(1-cleanProb)*0.65*referee.profile.foulMult){
              var cardResult=handleCard(q, Math.random());
              var subtitle=cardResult==='yellow'?'Kartu kuning untuk '+q.name:(cardResult?'Kartu merah untuk '+q.name:null);
              placeBallAt(p.x,p.y);
              playFoulBeep();
              bannerShow('⚠️ PELANGGARAN!', subtitle||('Bola untuk '+teams[p.team].name), teams[p.team].color);
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
      ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
      var damp=Math.pow(0.985,dt*60);
      ball.vx*=damp; ball.vy*=damp;
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

  function popScore(team){
    var el = team==='blue' ? sbScoreBlueEl : sbScoreRedEl;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }

  function onGoal(scoringTeam){
    if(phase!=='play') return;
    if(scoringTeam==='blue') scoreBlue++; else scoreRed++;
    sbScoreBlueEl.textContent=scoreBlue; sbScoreRedEl.textContent=scoreRed;
    popScore(scoringTeam);
    playGoalRoar();
    var tm=teams[scoringTeam];
    bannerShow('⚽ GOOL!', tm.name+' mencetak gol!', tm.color);
    setCrowdMood(scoringTeam,'cheer',2.6);
    setCrowdMood(scoringTeam==='blue'?'red':'blue','sad',2.6);
    resetPositionsSoft();
  }

  // ================= Periods / time engine =================
  function buildPeriods(){
    var h1 = matchConfig.halfTimeMinutes*60;
    var h2 = matchConfig.fullTimeMinutes*60;
    periods = [
      { key:'H1', label:'BABAK 1', nominalEnd:h1, end:h1, addedMin:0, addedAnnounced:false },
      { key:'H2', label:'BABAK 2', nominalEnd:h2, end:h2, addedMin:0, addedAnnounced:false }
    ];
    periodIndex=0;
    hydrationDone={};
  }

  function startBreak(kind, curRef){
    phase='break'; breakKind=kind; breakCurRef=curRef;
    if(kind==='halftime'){
      breakTimer=7.2;
      adBreakEl.classList.remove('hidden');
      startAdCarousel();
      bannerShow('⏸️ HALF TIME', 'Jeda babak pertama', teams.blue.color);
      playWhistle(1);
    } else if(kind==='hydration'){
      breakTimer=3.0;
      bannerShow('💧 HYDRATION BREAK', 'Jeda minum sejenak', '#7de1ff');
      playWhistle(0);
    } else if(kind==='fulltime_et'){
      breakTimer=3.2;
      bannerShow('⏱️ FULL TIME - SERI!', 'Lanjut ke Extra Time', '#ffd479');
      playWhistle(1);
    }
  }

  function resolveBreakEnd(){
    if(breakKind==='halftime'){
      adBreakEl.classList.add('hidden'); stopAdCarousel();
      periodIndex++;
      resetPositionsSoft();
      bannerShow('▶️ KICK OFF BABAK 2', '', '#c6ff8f');
      playWhistle(1);
      phase='play';
    } else if(breakKind==='hydration'){
      phase='play';
    } else if(breakKind==='fulltime_et'){
      var etHalf = (matchConfig.extraTimeMinutes/2)*60;
      var startPoint = breakCurRef.end;
      periods.push({ key:'ET1', label:'EXTRA TIME 1', nominalEnd:startPoint+etHalf, end:startPoint+etHalf, addedMin:0, addedAnnounced:false });
      periods.push({ key:'ET2', label:'EXTRA TIME 2', nominalEnd:startPoint+etHalf*2, end:startPoint+etHalf*2, addedMin:0, addedAnnounced:false });
      periodIndex++;
      resetPositionsSoft();
      phase='play';
    }
  }

  function advancePeriod(){
    var cur = periods[periodIndex];
    if(cur.key==='H1'){
      startBreak('halftime', cur);
    } else if(cur.key==='H2'){
      if(scoreBlue!==scoreRed || !matchConfig.extraTimeEnabled){
        endMatch();
      } else {
        startBreak('fulltime_et', cur);
      }
    } else if(cur.key==='ET1'){
      bannerShow('EXTRA TIME 1 SELESAI', 'Lanjut Extra Time 2', '#ffd479');
      periodIndex++;
      resetPositionsSoft();
    } else if(cur.key==='ET2'){
      endMatch();
    }
  }

  function handlePeriods(dt){
    var cur = periods[periodIndex];
    if(!cur) return;

    if(matchConfig.hydrationBreak && !hydrationDone[cur.key] && elapsed >= cur.nominalEnd*0.5){
      hydrationDone[cur.key]=true;
      startBreak('hydration', cur);
      return;
    }

    if(!cur.addedAnnounced && elapsed >= cur.end - 0.05){
      var add = randInt(1,4);
      cur.addedMin=add; cur.addedAnnounced=true; cur.end += add*60;
      bannerShow('➕ '+cur.label+' +'+add+" MENIT", 'Waktu tambahan', '#ffd479');
    } else if(cur.addedAnnounced && elapsed >= cur.end){
      advancePeriod();
    }
  }

  function renderScoreboardClock(){
    sbClockEl.textContent = fmtMMSS(elapsed);
    var label;
    if(phase==='break'){
      label = breakKind==='halftime' ? 'HALF TIME' : (breakKind==='hydration' ? 'HYDRATION BREAK' : 'FULL TIME');
    } else if(phase==='ended'){
      label = 'FULL TIME';
    } else {
      var cur = periods[periodIndex];
      label = cur ? cur.label : 'BELUM MULAI';
      if(cur && cur.addedAnnounced && elapsed < cur.end) label += ' +'+cur.addedMin+"'";
    }
    sbPeriodEl.textContent = label;
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
    if(scoreBlue>scoreRed){ tag=teams.blue.name+' MENANG!'; color=teams.blue.color; }
    else if(scoreBlue<scoreRed){ tag=teams.red.name+' MENANG!'; color=teams.red.color; }
    else { tag='SERI'; color='#ffd479'; }
    resultTag.textContent=tag; resultTag.style.color=color;
    statsBox.innerHTML = 'Kartu Kuning — '+teams.blue.name+': '+stats.blueYellow+' | '+teams.red.name+': '+stats.redYellow+
      '<br>Kartu Merah — '+teams.blue.name+': '+stats.blueRed+' | '+teams.red.name+': '+stats.redRed;
    endOverlay.classList.remove('hidden');
  }

  // ================= Rendering =================
  function drawStadium(t){
    ctx.clearRect(0,0,STW,STH);
    var standGrad=ctx.createLinearGradient(0,0,0,STH);
    standGrad.addColorStop(0,'#1a2038'); standGrad.addColorStop(1,'#0c1020');
    ctx.fillStyle=standGrad; ctx.fillRect(0,0,STW,STH);

    ctx.fillStyle='rgba(255,255,255,0.03)';
    for(var i=0;i<3;i++){
      var inset=i*14;
      ctx.fillRect(inset,inset,STW-inset*2,MARGIN_Y-inset-4);
      ctx.fillRect(inset,STH-MARGIN_Y+4,STW-inset*2,MARGIN_Y-inset-4);
    }
    drawCrowd(t);
    [[40,30],[STW-40,30],[40,STH-30],[STW-40,STH-30]].forEach(function(pos){
      ctx.fillStyle='rgba(255,255,220,0.9)';
      ctx.beginPath(); ctx.arc(pos[0],pos[1],6,0,Math.PI*2); ctx.fill();
      var glow=ctx.createRadialGradient(pos[0],pos[1],0,pos[0],pos[1],90);
      glow.addColorStop(0,'rgba(255,255,220,0.18)'); glow.addColorStop(1,'rgba(255,255,220,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(pos[0],pos[1],90,0,Math.PI*2); ctx.fill();
    });

    ctx.save();
    ctx.translate(MARGIN_X, MARGIN_Y);
    drawBillboard();
    drawPitch();
    drawReferee();
    drawPlayers();
    drawBall();
    ctx.restore();
  }

  function drawPitch(){
    var stripeCount=10, stripeW=FW/stripeCount;
    for(var i=0;i<stripeCount;i++){
      ctx.fillStyle=(i%2===0)?'#1e6b34':'#1a5f2e';
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
    ctx.beginPath(); ctx.arc(referee.pos.x,referee.pos.y,11,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill();
    ctx.beginPath(); ctx.arc(referee.pos.x,referee.pos.y-2,5,0,Math.PI*2); ctx.fillStyle='#ffe45c'; ctx.fill();
  }

  function drawPlayers(){
    players.forEach(function(p){
      ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R,0,Math.PI*2);
      ctx.fillStyle = p.role==='GK' ? '#ffd479' : p.color;
      ctx.fill();
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
      ctx.fillText(p.role+' · '+p.skillScore, p.x, p.y-PLAYER_R-12);
      if(p.yellowCards>0){ ctx.fillStyle='#ffd400'; ctx.fillRect(p.x-8, p.y+PLAYER_R+3, 5,7); }
    });
  }

  function drawBall(){
    ctx.beginPath(); ctx.arc(ball.x, ball.y+3, BALL_R*0.9,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R*0.4,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill();
  }

  // ================= Main loop =================
  function loop(ts){
    if(lastFrameTs===null) lastFrameTs=ts;
    var dt=(ts-lastFrameTs)/1000;
    if(dt>0.05) dt=0.05;
    lastFrameTs=ts;
    var tSec=ts/1000;

    updateCrowdMood(dt);
    billboardScroll += dt*40;

    if(phase==='play'){
      elapsed += dt;
      handlePeriods(dt);
      if(phase==='play'){
        maybeDoSubs();
        if(matchConfig.spectator){
          players.forEach(function(p){ updateAIPlayer(p,dt); });
        } else {
          players.forEach(function(p){ if(p.isUser) updateUser(p,dt); else updateAIPlayer(p,dt); });
        }
        resolvePlayerCollisions();
        if(phase==='play') updateBall(dt);
      }
    } else if(phase==='break'){
      breakTimer -= dt;
      if(breakTimer<=0) resolveBreakEnd();
    }

    renderScoreboardClock();
    drawStadium(tSec);
    updateCardsHud();
    rafId = requestAnimationFrame(loop);
  }

  // ================= Branding / lineup / flow =================
  function setFlagOrLogo(el, teamObj){
    if(teamObj.logo) el.innerHTML='<img src="'+teamObj.logo+'" style="width:18px;height:18px;border-radius:4px;object-fit:cover;display:block;">';
    else el.textContent = teamObj.flag || '⚽';
  }
  function applyTeamBranding(){
    leadBlueNameEl.textContent = teams.blue.name; leadBlueNameEl.style.color = teams.blue.color;
    leadRedNameEl.textContent = teams.red.name; leadRedNameEl.style.color = teams.red.color;
    sbNameBlueEl.textContent = teams.blue.name.toUpperCase();
    sbNameRedEl.textContent = teams.red.name.toUpperCase();
    setFlagOrLogo(sbFlagBlueEl, teams.blue);
    setFlagOrLogo(sbFlagRedEl, teams.red);
    cardsBlueNameEl.textContent = teams.blue.name;
    cardsRedNameEl.textContent = teams.red.name;
    lineupBlueTitleEl.textContent = teams.blue.name; lineupBlueTitleEl.style.color = teams.blue.color;
    lineupRedTitleEl.textContent = teams.red.name; lineupRedTitleEl.style.color = teams.red.color;
  }

  function applyFieldConstants(){
    FW=CFG.match.fieldWidth; FH=CFG.match.fieldHeight;
    GOAL_HEIGHT=CFG.match.goalHeight;
    GOAL_TOP=FH/2-GOAL_HEIGHT/2; GOAL_BOTTOM=FH/2+GOAL_HEIGHT/2;
    PLAYER_R=CFG.match.playerRadius; BALL_R=CFG.match.ballRadius;
    POSSESSION_R=CFG.match.possessionRadius; STEAL_R=CFG.match.stealRadius;
    MARGIN_X=130; MARGIN_Y=105;
  }

  function cardHtml(p, isBench){
    var grade=gradeFor(p.skillScore);
    var flag=p.origin==='id'?'🇮🇩':'🌍';
    var badgeClass = isBench ? 'BENCH' : p.role;
    var userTag = p.isUser ? (' <span class="pscTag">'+(matchConfig.spectator?'BINTANG':'KAMU')+'</span>') : '';
    return '<div class="playerStatCard">'+
      '<div class="pscBadge '+badgeClass+'">'+p.role+'</div>'+
      '<div class="pscInfo"><div class="pscName">'+p.name+userTag+'</div>'+
      '<div class="pscTag">'+flag+' '+(p.origin==='id'?'Lokal':'Internasional')+'</div></div>'+
      '<div class="pscScore"><div class="pscNum" style="color:'+grade.color+'">'+p.skillScore+'</div>'+
      '<div class="pscGrade" style="color:'+grade.color+'">'+grade.label+'</div></div>'+
    '</div>';
  }
  function renderTeamCards(container, team){
    var starters = players.filter(function(p){ return p.team===team; }).sort(function(a,b){ return b.skillScore-a.skillScore; });
    var html = starters.map(function(p){ return cardHtml(p,false); }).join('');
    var benchArr = bench[team]||[];
    if(benchArr.length>0){
      html += '<div class="benchLabel">Cadangan ('+benchArr.length+')</div>';
      html += benchArr.map(function(p){ return cardHtml(p,true); }).join('');
    }
    container.innerHTML = html;
  }

  function goToLineup(cfg, modeLabel){
    matchConfig = cfg; matchConfig.label = modeLabel;
    setupReferee(cfg.referee);
    buildSquad();
    renderTeamCards(lineupBlueEl, 'blue');
    renderTeamCards(lineupRedEl, 'red');
    modeOverlay.classList.add('hidden');
    sandboxOverlay.classList.add('hidden');
    lineupOverlay.classList.remove('hidden');
  }

  function kickoffMatch(){
    scoreBlue=0; scoreRed=0;
    stats={ blueYellow:0, blueRed:0, redYellow:0, redRed:0 };
    sbScoreBlueEl.textContent='0'; sbScoreRedEl.textContent='0';
    ball.x=FW/2; ball.y=FH/2; ball.vx=0; ball.vy=0; ball.controller=null; ball.freeTimer=0; ball.offsideFlag=null;
    elapsed=0;
    buildPeriods();
    scheduleSubs();

    lineupOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');

    if(matchConfig.spectator){ controlsEl.classList.add('hidden'); hintEl.classList.add('hidden'); }
    else {
      var isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
      if(isTouch) controlsEl.classList.remove('hidden'); else hintEl.classList.remove('hidden');
    }

    ensureAudio();
    playWhistle(1);
    bannerShow('▶️ KICK OFF!', matchConfig.label+(matchConfig.spectator?' (Nonton)':''), teams.blue.color);
    setCrowdMood('blue','idle',0); setCrowdMood('red','idle',0);

    phase='play';
    lastFrameTs=null;
    if(rafId) cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(loop);
  }

  // ================= Team customization wiring =================
  var tempLogo = { blue:null, red:null };
  function openCustomization(){
    document.getElementById('custBlueName').value = teams.blue.name;
    document.getElementById('custBlueColor').value = teams.blue.color;
    document.getElementById('custBlueFlag').value = teams.blue.flag||'';
    document.getElementById('custRedName').value = teams.red.name;
    document.getElementById('custRedColor').value = teams.red.color;
    document.getElementById('custRedFlag').value = teams.red.flag||'';
    tempLogo.blue = teams.blue.logo; tempLogo.red = teams.red.logo;
    updateLogoPreview('blue'); updateLogoPreview('red');
    modeOverlay.classList.add('hidden');
    customOverlay.classList.remove('hidden');
  }
  function updateLogoPreview(team){
    var img = document.getElementById(team==='blue'?'custBlueLogoPreview':'custRedLogoPreview');
    if(tempLogo[team]){ img.src=tempLogo[team]; img.classList.remove('hidden'); }
    else { img.classList.add('hidden'); img.src=''; }
  }

  function wireCustomization(){
    document.getElementById('openCustomBtn').addEventListener('click', openCustomization);
    ['blue','red'].forEach(function(team){
      var fileInput = document.getElementById(team==='blue'?'custBlueLogo':'custRedLogo');
      fileInput.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function(ev){ tempLogo[team]=ev.target.result; updateLogoPreview(team); };
        reader.readAsDataURL(file);
      });
      document.getElementById(team==='blue'?'custBlueLogoClear':'custRedLogoClear').addEventListener('click', function(){
        tempLogo[team]=null; updateLogoPreview(team);
      });
    });
    document.getElementById('custReset').addEventListener('click', function(){
      document.getElementById('custBlueName').value = CFG.teamDefaults.blue.name;
      document.getElementById('custBlueColor').value = CFG.teamDefaults.blue.color;
      document.getElementById('custBlueFlag').value = CFG.teamDefaults.blue.flag;
      document.getElementById('custRedName').value = CFG.teamDefaults.red.name;
      document.getElementById('custRedColor').value = CFG.teamDefaults.red.color;
      document.getElementById('custRedFlag').value = CFG.teamDefaults.red.flag;
      tempLogo.blue=null; tempLogo.red=null;
      updateLogoPreview('blue'); updateLogoPreview('red');
    });
    document.getElementById('custSave').addEventListener('click', function(){
      teams.blue = {
        name: document.getElementById('custBlueName').value.trim() || CFG.teamDefaults.blue.name,
        color: document.getElementById('custBlueColor').value,
        flag: document.getElementById('custBlueFlag').value.trim() || '🔵',
        logo: tempLogo.blue
      };
      teams.red = {
        name: document.getElementById('custRedName').value.trim() || CFG.teamDefaults.red.name,
        color: document.getElementById('custRedColor').value,
        flag: document.getElementById('custRedFlag').value.trim() || '🔴',
        logo: tempLogo.red
      };
      saveTeams();
      applyTeamBranding();
      customOverlay.classList.add('hidden');
      modeOverlay.classList.remove('hidden');
    });
  }

  // ================= Boot & event wiring =================
  function wireEvents(){
    var isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
    if(isTouch) controlsEl.classList.remove('hidden'); else hintEl.classList.remove('hidden');
    window.addEventListener('resize', resize);
    resize();
    buildCrowd();
    wireCustomization();

    document.querySelectorAll('.modeBtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        ensureAudio();
        var mode=btn.getAttribute('data-mode');
        if(mode==='sandbox'){ modeOverlay.classList.add('hidden'); sandboxOverlay.classList.remove('hidden'); return; }
        var preset=CFG.modes[mode];
        goToLineup({
          squad: CFG.squadDefault,
          skillMin: preset.skillMin, skillMax: preset.skillMax,
          offside: preset.offside, fouls: preset.fouls, referee: preset.referee,
          halfTimeMinutes: preset.halfTimeMinutes, fullTimeMinutes: preset.fullTimeMinutes,
          extraTimeEnabled: preset.extraTimeEnabled, extraTimeMinutes: preset.extraTimeMinutes,
          hydrationBreak: preset.hydrationBreak, benchBlue: preset.benchBlue, benchRed: preset.benchRed,
          speedMultiplier: preset.speedMultiplier, spectator:false
        }, preset.label);
      });
    });

    document.getElementById('sbBack').addEventListener('click', function(){
      sandboxOverlay.classList.add('hidden'); modeOverlay.classList.remove('hidden');
    });
    var sbSpeedInput=document.getElementById('sbSpeed');
    var sbSpeedVal=document.getElementById('sbSpeedVal');
    sbSpeedInput.addEventListener('input', function(){ sbSpeedVal.textContent=parseFloat(sbSpeedInput.value).toFixed(1)+'x'; });

    document.getElementById('sbStart').addEventListener('click', function(){
      function num(id){ return parseInt(document.getElementById(id).value,10) || 0; }
      function fnum(id){ return parseFloat(document.getElementById(id).value) || 0; }
      var skillMin=clamp(num('sbSkillMin'), CFG.skillScale.min, CFG.skillScale.max);
      var skillMax=clamp(num('sbSkillMax'), CFG.skillScale.min, CFG.skillScale.max);
      if(skillMax<skillMin){ var tmp=skillMin; skillMin=skillMax; skillMax=tmp; }
      var halfT = Math.max(0.5, fnum('sbHalfTime'));
      var fullT = Math.max(halfT+0.5, fnum('sbFullTime'));
      var cfg = {
        squad: {
          blue:{ GK:num('sbBlueGK'), DF:num('sbBlueDF'), MF:num('sbBlueMF'), FW:num('sbBlueFW') },
          red:{ GK:num('sbRedGK'), DF:num('sbRedDF'), MF:num('sbRedMF'), FW:num('sbRedFW') }
        },
        benchBlue: num('sbBlueBench'), benchRed: num('sbRedBench'),
        skillMin:skillMin, skillMax:skillMax,
        offside: document.getElementById('sbOffside').value==='1',
        fouls: document.getElementById('sbFouls').value==='1',
        referee: document.getElementById('sbReferee').value,
        halfTimeMinutes: halfT, fullTimeMinutes: fullT,
        extraTimeEnabled: document.getElementById('sbExtraTime').value==='1',
        extraTimeMinutes: Math.max(1, fnum('sbExtraMinutes')),
        hydrationBreak: document.getElementById('sbHydration').value==='1',
        speedMultiplier: parseFloat(sbSpeedInput.value)||1,
        spectator: document.getElementById('sbSpectator').value==='1'
      };
      goToLineup(cfg, 'SANDBOX');
    });

    document.getElementById('lineupBack').addEventListener('click', function(){
      lineupOverlay.classList.add('hidden'); modeOverlay.classList.remove('hidden');
    });
    document.getElementById('lineupStart').addEventListener('click', kickoffMatch);
    retryBtn.addEventListener('click', function(){ endOverlay.classList.add('hidden'); modeOverlay.classList.remove('hidden'); });

    window.addEventListener('keydown', function(e){
      var k=e.key.toLowerCase();
      if(k==='w'||k==='arrowup') keys.up=true;
      if(k==='s'||k==='arrowdown') keys.down=true;
      if(k==='a'||k==='arrowleft') keys.left=true;
      if(k==='d'||k==='arrowright') keys.right=true;
      if(k===' '||e.code==='Space'){ keys.shoot=true; e.preventDefault(); }
    });
    window.addEventListener('keyup', function(e){
      var k=e.key.toLowerCase();
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
      var k=btn.getAttribute('data-k'); if(!k) return;
      bindHold(btn, function(){ keys[k]=true; }, function(){ keys[k]=false; });
    });
    bindHold(document.getElementById('shootBtn'), function(){ keys.shoot=true; }, function(){ keys.shoot=false; });
  }

  function init(){
    grabDom();
    applyFieldConstants();
    initTeams();
    applyTeamBranding();
    wireEvents();

    matchConfig = { squad: CFG.squadDefault, skillMin:CFG.modes.normal.skillMin, skillMax:CFG.modes.normal.skillMax,
      offside:true, fouls:true, referee:'adil', halfTimeMinutes:2.5, fullTimeMinutes:5,
      extraTimeEnabled:false, extraTimeMinutes:0, hydrationBreak:false, benchBlue:0, benchRed:0,
      speedMultiplier:1, spectator:false, label:'NORMAL' };
    setupReferee('adil');
    buildSquad();
    resize();
    drawStadium(0);
    sbPeriodEl.textContent='BELUM MULAI';
  }

  loadConfig(init);
})();
