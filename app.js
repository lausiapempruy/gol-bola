// ============================================================
// Ball Team Tycoon — app.js
// State, ekonomi mingguan, transfer, latihan, FBG Cup, rendering.
// ============================================================
(function(){
  'use strict';
  var D = window.BTT_DATA;
  var state = null;
  var currentSquadFilter = 'ALL';
  var toastTimer = null;

  // ---------- DOM refs ----------
  var onboardOverlay = document.getElementById('onboardOverlay');
  var appEl = document.getElementById('app');
  var clubNameInput = document.getElementById('clubNameInput');
  var startClubBtn = document.getElementById('startClubBtn');

  var hClubName = document.getElementById('hClubName');
  var hSeasonWeek = document.getElementById('hSeasonWeek');
  var hBudget = document.getElementById('hBudget');
  var hReputation = document.getElementById('hReputation');
  var hRating = document.getElementById('hRating');
  var nextWeekBtn = document.getElementById('nextWeekBtn');

  var dashSummary = document.getElementById('dashSummary');
  var newsFeed = document.getElementById('newsFeed');

  var squadCount = document.getElementById('squadCount');
  var squadList = document.getElementById('squadList');
  var squadFilter = document.getElementById('squadFilter');

  var marketList = document.getElementById('marketList');
  var refreshCost = document.getElementById('refreshCost');
  var refreshMarketBtn = document.getElementById('refreshMarketBtn');

  var fbgStatus = document.getElementById('fbgStatus');
  var fbgStandings = document.getElementById('fbgStandings');
  var fbgFixtures = document.getElementById('fbgFixtures');

  var facilitiesList = document.getElementById('facilitiesList');
  var resetBtn = document.getElementById('resetBtn');
  var toastEl = document.getElementById('toast');

  // ---------- Helpers ----------
  function fmtMoney(n){
    var neg = n < 0;
    n = Math.abs(Math.round(n));
    var s = 'Rp' + n.toLocaleString('id-ID');
    return neg ? '-' + s : s;
  }
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2400);
  }
  function save(){ D.saveState(state); }
  function addNews(text, type){
    state.newsLog.unshift({ week: state.week, text: text, type: type || null });
    if(state.newsLog.length > 60) state.newsLog.length = 60;
  }
  function findTeam(comp, name){
    for(var i=0;i<comp.teams.length;i++) if(comp.teams[i].name === name) return comp.teams[i];
    return null;
  }
  function facilitiesUpkeep(){
    var f = state.facilities;
    return (f.stadium + f.training + f.medical + f.scouting) * 80;
  }
  function totalWages(){
    return state.squad.reduce(function(s,p){ return s + p.wage; }, 0);
  }

  // ================= Club lifecycle =================
  function newClub(name){
    state = {
      clubName: name || 'Klub Baru',
      budget: 60000,
      reputation: 40,
      week: 1,
      seasonNumber: 1,
      facilities: { stadium:1, training:1, medical:1, scouting:1 },
      squad: D.makeStarterSquad(),
      market: D.generateMarket(1, 8),
      marketWeek: 1,
      competition: { stage: 'none' },
      newsLog: []
    };
    addNews('Klub ' + state.clubName + ' resmi didirikan dengan modal awal ' + fmtMoney(60000) + '.', 'good');
    save();
    showApp();
    renderAll();
  }

  function showApp(){
    onboardOverlay.classList.add('hidden');
    appEl.classList.remove('hidden');
  }

  function boot(){
    var saved = D.loadState();
    if(saved){
      state = saved;
      if(!state.competition) state.competition = { stage:'none' };
      showApp();
      renderAll();
    }
  }

  // ================= Weekly economy tick =================
  function processWeek(){
    if(!state) return;

    var wages = totalWages();
    var upkeep = facilitiesUpkeep();
    var ticket = Math.round(state.facilities.stadium * 1200 * (0.5 + state.reputation/200) * D.rand(0.85,1.15));
    var sponsorBase = Math.round(3000 + state.reputation * 20);
    var income = ticket + sponsorBase;
    state.budget += income - wages - upkeep;

    addNews('Pemasukan tiket & sponsor +' + fmtMoney(income) + ', gaji & operasional -' + fmtMoney(wages+upkeep) + '.');

    if(Math.random() < 0.15){
      var bonus = D.randInt(300,1400);
      state.budget += bonus;
      addNews('Sponsor memberikan bonus spesial +' + fmtMoney(bonus) + '!', 'good');
    }

    var medLvl = state.facilities.medical;
    state.squad.forEach(function(p){
      if(p.injuredWeeks > 0){
        p.injuredWeeks--;
        p.fitness = D.clamp(p.fitness + 15 + (medLvl-1)*3, 0, 100);
      } else {
        p.fitness = D.clamp(p.fitness + 5, 0, 100);
        var injuryChance = 0.03 * (1 - (medLvl-1)*0.15);
        if(Math.random() < injuryChance){
          p.injuredWeeks = D.randInt(1,4);
          p.fitness = D.clamp(p.fitness - 40, 10, 100);
          addNews(p.name + ' mengalami cedera, absen ' + p.injuredWeeks + ' minggu.', 'bad');
        }
      }
      p.trainedThisWeek = false;
      p.contractWeeks--;
      if(p.contractWeeks <= 0){
        p.contractWeeks = D.randInt(20,52);
        p.wage = Math.round(p.wage * D.rand(1.03,1.12) / 10) * 10;
        addNews('Kontrak ' + p.name + ' diperpanjang otomatis, gaji naik jadi Rp' + p.wage.toLocaleString('id-ID') + '/mg.');
      }
    });

    state.week++;

    var comp = state.competition;
    if(comp && ['kualifikasi','grup','semifinal','final'].indexOf(comp.stage) !== -1){
      playMatchdayFixtures();
    }

    if(state.budget < -8000){
      addNews('PERINGATAN: Keuangan klub kritis! Jual pemain atau kurangi latihan.', 'bad');
    }

    save();
    renderAll();
  }

  // ================= Training =================
  function trainPlayer(id){
    var p = state.squad.filter(function(x){ return x.id === id; })[0];
    if(!p) return;
    if(p.injuredWeeks > 0){ toast(p.name + ' sedang cedera, tidak bisa latihan.'); return; }
    if(p.trainedThisWeek){ toast(p.name + ' sudah latihan minggu ini.'); return; }
    var cost = D.trainingCostForStar(p.star, state.facilities.training);
    if(state.budget < cost){ toast('Kas tidak cukup untuk latihan ini.'); return; }

    state.budget -= cost;
    var ageFactor = p.age < 23 ? 1.2 : (p.age > 29 ? 0.8 : 1.0);
    var inc = D.rand(0.05,0.35) * (1 + (state.facilities.training-1)*0.15) * ageFactor;
    p.star = D.clamp(Math.round((p.star+inc)*10)/10, 1, 10);
    p.morale = D.clamp(p.morale+3, 0, 100);
    p.trainedThisWeek = true;
    p.wage = D.wageForStar(p.star, p.position);

    addNews('Sesi latihan ' + p.name + ': rating bintang naik jadi ' + p.star.toFixed(1) + '.');
    save();
    renderAll();
  }

  // ================= Transfer market =================
  function refreshMarket(){
    var cost = 200 + state.facilities.scouting*100;
    if(state.budget < cost){ toast('Kas tidak cukup untuk refresh pasar.'); return; }
    state.budget -= cost;
    state.market = D.generateMarket(state.facilities.scouting, 8);
    state.marketWeek = state.week;
    addNews('Tim scouting menyegarkan pasar transfer (-' + fmtMoney(cost) + ').');
    save();
    renderAll();
  }

  function buyPlayer(id){
    var p = state.market.filter(function(x){ return x.id === id; })[0];
    if(!p) return;
    if(state.squad.length >= 26){ toast('Skuad sudah penuh (maks 26 pemain).'); return; }
    if(state.budget < p.cost){ toast('Kas tidak cukup untuk merekrut pemain ini.'); return; }
    state.budget -= p.cost;
    var cost = p.cost;
    delete p.cost;
    p.isUserOwned = true;
    p.trainedThisWeek = false;
    state.squad.push(p);
    state.market = state.market.filter(function(x){ return x.id !== id; });
    addNews('Merekrut ' + p.name + ' (' + p.position + ', ' + p.star.toFixed(1) + '★) seharga ' + fmtMoney(cost) + '.', 'good');
    save();
    renderAll();
  }

  function sellPlayer(id){
    var p = state.squad.filter(function(x){ return x.id === id; })[0];
    if(!p) return;
    var value = Math.round(D.transferCostForStar(p.star, p.position, p.age) * 0.55);
    state.budget += value;
    state.squad = state.squad.filter(function(x){ return x.id !== id; });
    addNews('Menjual ' + p.name + ' seharga ' + fmtMoney(value) + '.', 'good');
    save();
    renderAll();
  }

  // ================= Facilities =================
  function facilityMeta(key){
    var map = {
      stadium:{ label:'Stadion', desc:'Meningkatkan kapasitas & pemasukan tiket mingguan.' },
      training:{ label:'Pusat Latihan', desc:'Meningkatkan efektivitas & menurunkan biaya latihan pemain.' },
      medical:{ label:'Pusat Medis', desc:'Menurunkan risiko cedera & mempercepat pemulihan pemain.' },
      scouting:{ label:'Jaringan Scouting', desc:'Meningkatkan kualitas pemain yang muncul di pasar transfer.' }
    };
    return map[key];
  }
  function upgradeFacility(key){
    var lvl = state.facilities[key];
    if(lvl >= 5){ toast('Fasilitas ini sudah level maksimum.'); return; }
    var cost = lvl*1500 + 1000;
    if(state.budget < cost){ toast('Kas tidak cukup untuk upgrade ini.'); return; }
    state.budget -= cost;
    state.facilities[key] = lvl+1;
    addNews(facilityMeta(key).label + ' naik ke level ' + (lvl+1) + '! (-' + fmtMoney(cost) + ')', 'good');
    save();
    renderAll();
  }

  // ================= FBG Cup competition =================
  function prizeForStage(stage, kind){
    var table = {
      kualifikasi:{ win:500, draw:150 },
      grup:{ win:900, draw:250 },
      semifinal:{ win:2000, draw:0 },
      final:{ win:8000, draw:0 }
    };
    return (table[stage] && table[stage][kind]) || 0;
  }

  function createGroupStage(stageLabel, ratingRangeMin, ratingRangeMax){
    var userRating = D.squadOverall(state.squad);
    var teams = [{ name: state.clubName, isUser:true, rating:userRating, pts:0,w:0,d:0,l:0,gf:0,ga:0 }];
    var used = {}; used[state.clubName] = true;
    for(var i=0;i<3;i++){
      var nm = D.generateRivalName(used);
      used[nm] = true;
      var r = D.clamp(userRating + D.rand(ratingRangeMin, ratingRangeMax), 30, 99);
      teams.push({ name:nm, isUser:false, rating:Math.round(r), pts:0,w:0,d:0,l:0,gf:0,ga:0 });
    }
    var schedule = [ [[0,1],[2,3]], [[0,2],[3,1]], [[0,3],[1,2]] ];
    var fixtures = [];
    schedule.forEach(function(md, mi){
      md.forEach(function(pair){
        fixtures.push({ matchday: mi+1, home:teams[pair[0]].name, away:teams[pair[1]].name, played:false, gh:null, ga:null });
      });
    });
    state.competition = { stage: stageLabel, teams: teams, fixtures: fixtures, matchdayPointer: 1 };
  }

  function setupKnockout(stage){
    var userRating = D.squadOverall(state.squad);
    var oppRating = D.clamp(userRating + D.rand(0,16), 30, 99);
    var oppName = D.generateRivalName({});
    state.competition = {
      stage: stage,
      teams: [
        { name: state.clubName, isUser:true, rating:userRating, pts:0,w:0,d:0,l:0,gf:0,ga:0 },
        { name: oppName, isUser:false, rating:Math.round(oppRating), pts:0,w:0,d:0,l:0,gf:0,ga:0 }
      ],
      fixtures: [{ matchday:1, home: state.clubName, away: oppName, played:false, gh:null, ga:null }],
      matchdayPointer: 1
    };
  }

  function simulateMatch(ratingHome, ratingAway){
    var diff = ratingHome - ratingAway;
    var expHome = D.clamp(1.3 + diff*0.045, 0.2, 4.5);
    var expAway = D.clamp(1.3 - diff*0.045, 0.2, 4.5);
    var gh = Math.max(0, Math.round(expHome + D.rand(-1,1.3)));
    var ga = Math.max(0, Math.round(expAway + D.rand(-1,1.3)));
    return { gh:gh, ga:ga };
  }

  function playMatchdayFixtures(){
    var comp = state.competition;
    if(!comp || comp.stage === 'none') return;
    var due = comp.fixtures.filter(function(f){ return !f.played && f.matchday === comp.matchdayPointer; });
    if(due.length === 0) return;

    var knockout = (comp.stage === 'semifinal' || comp.stage === 'final');

    due.forEach(function(f){
      var homeTeam = findTeam(comp, f.home), awayTeam = findTeam(comp, f.away);
      var hRating = homeTeam.isUser ? D.squadOverall(state.squad) : homeTeam.rating;
      var aRating = awayTeam.isUser ? D.squadOverall(state.squad) : awayTeam.rating;
      var res = simulateMatch(hRating, aRating);

      var penalties = false;
      if(knockout && res.gh === res.ga){
        penalties = true;
        f.penWinnerIsHome = Math.random() < (hRating/(hRating+aRating));
      }

      f.gh = res.gh; f.ga = res.ga; f.played = true; f.penalties = penalties;

      homeTeam.gf += res.gh; homeTeam.ga += res.ga;
      awayTeam.gf += res.ga; awayTeam.ga += res.gh;
      if(!knockout){
        if(res.gh > res.ga){ homeTeam.w++; homeTeam.pts+=3; awayTeam.l++; }
        else if(res.gh < res.ga){ awayTeam.w++; awayTeam.pts+=3; homeTeam.l++; }
        else { homeTeam.d++; awayTeam.d++; homeTeam.pts++; awayTeam.pts++; }
      }

      if(homeTeam.isUser || awayTeam.isUser){
        var userIsHome = homeTeam.isUser;
        var userScore = userIsHome ? res.gh : res.ga;
        var oppScore = userIsHome ? res.ga : res.gh;
        var oppName = userIsHome ? awayTeam.name : homeTeam.name;
        var outcome = userScore > oppScore ? 'Menang' : (userScore < oppScore ? 'Kalah' : 'Seri');
        var penNote = penalties ? ' (adu penalti)' : '';
        addNews('Hasil ' + comp.stage.toUpperCase() + ': ' + state.clubName + ' ' + res.gh + ' - ' + res.ga + ' ' + oppName + ' (' + outcome + ')' + penNote,
          outcome === 'Menang' ? 'good' : (outcome === 'Kalah' ? 'bad' : null));

        if(!knockout){
          var prize = outcome === 'Menang' ? prizeForStage(comp.stage,'win') : (outcome === 'Seri' ? prizeForStage(comp.stage,'draw') : 0);
          if(prize > 0){ state.budget += prize; addNews('Bonus performa pertandingan: +' + fmtMoney(prize), 'good'); }
        } else {
          var winnerIsUser = penalties ? (userIsHome ? f.penWinnerIsHome : !f.penWinnerIsHome) : (userScore > oppScore);
          if(winnerIsUser){
            var prizeK = prizeForStage(comp.stage,'win');
            state.budget += prizeK;
            addNews('Bonus kemenangan ' + comp.stage + ': +' + fmtMoney(prizeK), 'good');
          }
        }
      }
    });

    comp.matchdayPointer++;
    var allPlayed = comp.fixtures.every(function(f){ return f.played; });
    if(allPlayed) evaluateStageEnd();
  }

  function evaluateStageEnd(){
    var comp = state.competition;

    if(comp.stage === 'kualifikasi' || comp.stage === 'grup'){
      var sorted = comp.teams.slice().sort(function(a,b){
        if(b.pts !== a.pts) return b.pts - a.pts;
        var gdA=a.gf-a.ga, gdB=b.gf-b.ga;
        if(gdB !== gdA) return gdB-gdA;
        return b.gf-a.gf;
      });
      var userTeam = comp.teams.filter(function(t){ return t.isUser; })[0];
      var userRank = sorted.indexOf(userTeam) + 1;

      if(comp.stage === 'kualifikasi'){
        if(userRank <= 2){
          addNews(state.clubName + ' LOLOS kualifikasi FBG Cup sebagai peringkat ' + userRank + '!', 'good');
          state.reputation = D.clamp(state.reputation+4, 0, 100);
          createGroupStage('grup', -4, 12);
        } else {
          addNews(state.clubName + ' GAGAL lolos kualifikasi FBG Cup (peringkat ' + userRank + ').', 'bad');
          state.budget += 200;
          comp.stage = 'gagal_kualifikasi';
          state.reputation = D.clamp(state.reputation-2, 0, 100);
        }
      } else {
        if(userRank <= 2){
          addNews(state.clubName + ' lolos ke babak GUGUR FBG Cup sebagai peringkat ' + userRank + ' grup!', 'good');
          state.reputation = D.clamp(state.reputation+6, 0, 100);
          setupKnockout('semifinal');
        } else {
          addNews(state.clubName + ' tersingkir di fase grup FBG Cup (peringkat ' + userRank + ').', 'bad');
          comp.stage = 'tersingkir_grup';
          state.reputation = D.clamp(state.reputation-1, 0, 100);
        }
      }
    } else if(comp.stage === 'semifinal'){
      var f = comp.fixtures[0];
      var userIsHome = comp.teams[0].isUser;
      var winnerIsUser = f.penalties ? (userIsHome ? f.penWinnerIsHome : !f.penWinnerIsHome) : (userIsHome ? f.gh>f.ga : f.ga>f.gh);
      if(winnerIsUser){
        addNews(state.clubName + ' MENANG semifinal dan melaju ke FINAL FBG Cup!', 'good');
        state.reputation = D.clamp(state.reputation+8, 0, 100);
        setupKnockout('final');
      } else {
        addNews(state.clubName + ' kalah di semifinal FBG Cup.', 'bad');
        state.budget += 3000;
        addNews('Bonus semifinalis: +' + fmtMoney(3000), 'good');
        comp.stage = 'tersingkir_semifinal';
      }
    } else if(comp.stage === 'final'){
      var f2 = comp.fixtures[0];
      var userIsHome2 = comp.teams[0].isUser;
      var winnerIsUser2 = f2.penalties ? (userIsHome2 ? f2.penWinnerIsHome : !f2.penWinnerIsHome) : (userIsHome2 ? f2.gh>f2.ga : f2.ga>f2.gh);
      if(winnerIsUser2){
        addNews(state.clubName + ' JUARA FBG Cup musim ini! 🏆', 'good');
        state.budget += 8000;
        state.reputation = D.clamp(state.reputation+15, 0, 100);
        comp.stage = 'champion';
      } else {
        addNews(state.clubName + ' menjadi runner-up FBG Cup musim ini.', 'bad');
        state.budget += 3000;
        state.reputation = D.clamp(state.reputation+5, 0, 100);
        comp.stage = 'runner_up';
      }
    }
  }

  function startQualification(){
    createGroupStage('kualifikasi', -10, 5);
    addNews('Babak kualifikasi FBG Cup musim ini dimulai!', 'good');
    save(); renderAll();
  }

  function startNewSeason(){
    state.seasonNumber++;
    state.squad.forEach(function(p){ p.age++; });
    state.competition = { stage:'none' };
    addNews('Musim ' + state.seasonNumber + ' dimulai. Pemain bertambah usia satu tahun.', 'good');
    save(); renderAll();
  }

  var TERMINAL_STAGES = ['gagal_kualifikasi','tersingkir_grup','tersingkir_semifinal','runner_up','champion'];

  function fbgStageLabel(comp){
    if(!comp || comp.stage === 'none') return 'Klub belum mengikuti FBG Cup musim ini.';
    var map = {
      kualifikasi:'Sedang menjalani babak Kualifikasi FBG Cup.',
      grup:'Sedang menjalani Fase Grup FBG Cup.',
      semifinal:'Klub lolos ke babak SEMIFINAL FBG Cup!',
      final:'Klub lolos ke babak FINAL FBG Cup!',
      gagal_kualifikasi:'Gagal lolos kualifikasi musim ini.',
      tersingkir_grup:'Tersingkir di fase grup musim ini.',
      tersingkir_semifinal:'Tersingkir di semifinal musim ini.',
      runner_up:'Runner-up FBG Cup musim ini!',
      champion:'JUARA FBG Cup musim ini! 🏆'
    };
    return map[comp.stage] || '';
  }

  // ================= Rendering =================
  function renderTopbar(){
    hClubName.textContent = state.clubName;
    hSeasonWeek.textContent = 'Musim ' + state.seasonNumber + ' · Minggu ' + state.week;
    hBudget.textContent = fmtMoney(state.budget);
    hReputation.textContent = state.reputation + '/100';
    hRating.textContent = D.squadOverall(state.squad);
  }

  function summaryRow(label,val,cls){
    return '<div class="summaryRow"><span>'+label+'</span><span class="val'+(cls?' '+cls:'')+'">'+val+'</span></div>';
  }

  function renderDashboard(){
    var wages = totalWages();
    var upkeep = facilitiesUpkeep();
    dashSummary.innerHTML =
      summaryRow('Nama Klub', state.clubName) +
      summaryRow('Kas', fmtMoney(state.budget), state.budget>=0?'pos':'neg') +
      summaryRow('Reputasi', state.reputation+'/100') +
      summaryRow('Rating Tim', D.squadOverall(state.squad)) +
      summaryRow('Jumlah Pemain', state.squad.length+'/26') +
      summaryRow('Estimasi Gaji Mingguan', fmtMoney(-wages), 'neg') +
      summaryRow('Estimasi Upkeep Fasilitas', fmtMoney(-upkeep), 'neg') +
      summaryRow('Status FBG Cup', fbgStageLabel(state.competition));

    newsFeed.innerHTML = state.newsLog.slice(0,25).map(function(n){
      return '<div class="newsItem'+(n.type?' '+n.type:'')+'"><span class="wk">Minggu '+n.week+'</span>'+n.text+'</div>';
    }).join('') || '<p class="tiny">Belum ada berita.</p>';
  }

  function playerCardHtml(p, isSquad){
    var ov = D.calcOverall(p.star, p.variance);
    var stars = '';
    for(var i=1;i<=10;i++) stars += '<span class="starDot'+(i<=Math.round(p.star)?' on':'')+'"></span>';
    var flag = p.origin === 'id' ? '🇮🇩 Lokal' : '🌍 Internasional';
    var injBadge = p.injuredWeeks > 0 ? '<span class="injBadge">Cedera '+p.injuredWeeks+'mg</span>' : '';
    var actions;
    if(isSquad){
      var trainCost = D.trainingCostForStar(p.star, state.facilities.training);
      var sellVal = Math.round(D.transferCostForStar(p.star, p.position, p.age) * 0.55);
      actions =
        '<div class="pCost">OVR '+ov+'</div>'+
        '<button class="btn small" data-action="train" data-id="'+p.id+'" '+((p.trainedThisWeek||p.injuredWeeks>0)?'disabled':'')+'>Latih (Rp'+trainCost.toLocaleString('id-ID')+')</button>'+
        '<button class="btn small danger" data-action="sell" data-id="'+p.id+'">Jual (Rp'+sellVal.toLocaleString('id-ID')+')</button>';
    } else {
      actions =
        '<div class="pCost">Rp'+p.cost.toLocaleString('id-ID')+'</div>'+
        '<button class="btn small primary" data-action="buy" data-id="'+p.id+'">Rekrut</button>';
    }
    return '<div class="playerCard">'+
      '<div class="posBadge '+p.position+'">'+p.position+'</div>'+
      '<div class="pInfo">'+
        '<div class="pName">'+p.name+' <span class="flagBadge">'+flag+'</span>'+injBadge+'</div>'+
        '<div class="pMeta">Usia '+p.age+' · Gaji Rp'+p.wage.toLocaleString('id-ID')+'/mg · OVR '+ov+'</div>'+
        '<div class="starBar">'+stars+'</div>'+
      '</div>'+
      '<div class="pActions">'+actions+'</div>'+
    '</div>';
  }

  function renderSquad(){
    var list = state.squad.filter(function(p){ return currentSquadFilter==='ALL' || p.position===currentSquadFilter; })
      .sort(function(a,b){ return D.calcOverall(b.star,b.variance) - D.calcOverall(a.star,a.variance); });
    squadCount.textContent = state.squad.length;
    squadList.innerHTML = list.map(function(p){ return playerCardHtml(p,true); }).join('') || '<p class="tiny">Tidak ada pemain di posisi ini.</p>';
  }

  function renderMarket(){
    refreshCost.textContent = (200 + state.facilities.scouting*100).toLocaleString('id-ID');
    marketList.innerHTML = state.market.map(function(p){ return playerCardHtml(p,false); }).join('') || '<p class="tiny">Pasar kosong, klik refresh pasar.</p>';
  }

  function renderFBG(){
    var comp = state.competition;
    var html = '';
    if(!comp || comp.stage === 'none'){
      html = '<p class="lead">'+fbgStageLabel(comp)+'</p><div class="btn primary" id="startQualiBtn">Mulai Kualifikasi FBG Cup</div>';
    } else {
      html = '<p class="lead">'+fbgStageLabel(comp)+'</p>';
      if(TERMINAL_STAGES.indexOf(comp.stage) !== -1){
        html += '<div class="btn primary" id="newSeasonBtn">Mulai Musim Baru</div>';
      }
    }
    fbgStatus.innerHTML = html;

    if(comp && comp.teams && comp.teams.length > 2){
      var sorted = comp.teams.slice().sort(function(a,b){
        if(b.pts !== a.pts) return b.pts - a.pts;
        var gdA=a.gf-a.ga, gdB=b.gf-b.ga;
        if(gdB !== gdA) return gdB-gdA;
        return b.gf - a.gf;
      });
      var rows = sorted.map(function(t){
        return '<tr class="'+(t.isUser?'userRow':'')+'"><td class="teamCell">'+t.name+'</td><td>'+t.w+'</td><td>'+t.d+'</td><td>'+t.l+'</td><td>'+t.gf+'</td><td>'+t.ga+'</td><td>'+(t.gf-t.ga)+'</td><td>'+t.pts+'</td></tr>';
      }).join('');
      fbgStandings.innerHTML = '<table class="standings"><thead><tr><th>Tim</th><th>M</th><th>S</th><th>K</th><th>GM</th><th>GK</th><th>SG</th><th>Poin</th></tr></thead><tbody>'+rows+'</tbody></table>';
    } else {
      fbgStandings.innerHTML = '';
    }

    if(comp && comp.fixtures){
      fbgFixtures.innerHTML = comp.fixtures.map(function(f){
        var scoreTxt = f.played ? (f.gh+' - '+f.ga+(f.penalties?' (pen)':'')) : 'vs';
        return '<div class="fixtureRow'+(f.played?' played':'')+'"><span>MD'+f.matchday+' · '+f.home+'</span><span class="fixtureScore">'+scoreTxt+'</span><span>'+f.away+'</span></div>';
      }).join('');
    } else {
      fbgFixtures.innerHTML = '';
    }
  }

  function renderFacilities(){
    var keys = ['stadium','training','medical','scouting'];
    facilitiesList.innerHTML = keys.map(function(key){
      var meta = facilityMeta(key);
      var lvl = state.facilities[key];
      var cost = lvl*1500 + 1000;
      var dots = '';
      for(var i=1;i<=5;i++) dots += '<span'+(i<=lvl?' class="on"':'')+'></span>';
      var btn = lvl >= 5
        ? '<button class="btn ghost small" disabled>Level Maksimum</button>'
        : '<button class="btn primary small" data-action="upgrade" data-key="'+key+'">Upgrade (Rp'+cost.toLocaleString('id-ID')+')</button>';
      return '<div class="facilityCard">'+
        '<h3>'+meta.label+' — Lv.'+lvl+'</h3>'+
        '<div class="facDesc">'+meta.desc+'</div>'+
        '<div class="levelDots">'+dots+'</div>'+
        btn+
      '</div>';
    }).join('');
  }

  function renderAll(){
    renderTopbar();
    renderDashboard();
    renderSquad();
    renderMarket();
    renderFBG();
    renderFacilities();
  }

  // ================= Event wiring =================
  startClubBtn.addEventListener('click', function(){
    var name = clubNameInput.value.trim();
    if(!name){ toast('Isi dulu nama klubnya, bang.'); return; }
    newClub(name);
  });
  clubNameInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter') startClubBtn.click();
  });

  nextWeekBtn.addEventListener('click', processWeek);
  refreshMarketBtn.addEventListener('click', refreshMarket);
  resetBtn.addEventListener('click', function(){
    if(confirm('Yakin reset total progres klub? Aksi ini permanen.')){
      D.clearState();
      location.reload();
    }
  });

  document.querySelectorAll('.tabBtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tabBtn').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.tabPane').forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tab-'+btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  squadFilter.addEventListener('click', function(e){
    var btn = e.target.closest ? e.target.closest('.chipBtn') : null;
    if(!btn) return;
    squadFilter.querySelectorAll('.chipBtn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    currentSquadFilter = btn.getAttribute('data-pos');
    renderSquad();
  });

  document.body.addEventListener('click', function(e){
    var actionEl = e.target.closest ? e.target.closest('[data-action]') : null;
    if(actionEl){
      var action = actionEl.getAttribute('data-action');
      if(action === 'train') trainPlayer(actionEl.getAttribute('data-id'));
      else if(action === 'sell') sellPlayer(actionEl.getAttribute('data-id'));
      else if(action === 'buy') buyPlayer(actionEl.getAttribute('data-id'));
      else if(action === 'upgrade') upgradeFacility(actionEl.getAttribute('data-key'));
      return;
    }
    if(e.target.id === 'startQualiBtn') startQualification();
    if(e.target.id === 'newSeasonBtn') startNewSeason();
  });

  boot();
})();
