// ============================================================
// Ball Team Tycoon — data.js
// Nama, formula ekonomi, dan helper localStorage.
// ============================================================
(function(global){
  'use strict';

  var NAMES = {
    idFirst: ['Andi','Budi','Rizky','Fajar','Dimas','Bagus','Yusuf','Fadli','Reza','Arya','Bayu','Eko','Wahyu','Rendra','Rio','Iqbal','Dedi','Hendra','Agus','Teguh','Doni','Galih','Farhan','Ilham','Rafi','Aldi','Fikri','Panji','Yoga','Adit'],
    idLast: ['Saputra','Pratama','Wijaya','Kusuma','Nugroho','Santoso','Setiawan','Hidayat','Firmansyah','Gunawan','Permana','Ramadhan','Susanto','Wibowo','Halim','Kurniawan','Maulana','Putra','Siregar','Hakim'],
    intlFirst: ['Marco','Luca','Carlos','Diego','Pierre','Lucas','Kevin','Erik','Andres','Nikolai','Owen','Jack','Liam','Mateo','Bruno','Ivan','Sven','Felix','Adrian','Dominik','Noah','Tomas','Viktor','Hugo','Leon'],
    intlLast: ['Silva','Fernandez','Rossi','Novak','Schmidt','Dubois','Andersson','Kowalski','Costa','Martins','Petrov','Larsson','Muller','Garcia','Santos','Ivanov','Nilsson','Bakker','Moreau','Lindqvist']
  };

  var RIVAL_TEAM_NAMES = [
    'Garuda Muda FC','Elang Rimba United','Cahaya Nusantara','Baja Selatan FC','Rimba Timur SC',
    'Vestland Rovers','Nortavia FC','Kastelia United','Bravoria SC','Solmara Athletic',
    'Halden City','Marisol FC','Draventia United','Novaguard SC','Perantau FC',
    'Sungai Emas United','Karang Jaya FC','Tundra Norsk','Aurelia SC','Petralis United'
  ];

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function rand(a,b){ return Math.random()*(b-a)+a; }
  function randInt(a,b){ return Math.floor(rand(a,b+1)); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
  function uid(){ return 'p'+Date.now().toString(36)+Math.floor(Math.random()*99999).toString(36); }

  function generateName(){
    var isIndo = Math.random() < 0.55;
    if(isIndo){
      return { name: pick(NAMES.idFirst)+' '+pick(NAMES.idLast), origin:'id' };
    }
    return { name: pick(NAMES.intlFirst)+' '+pick(NAMES.intlLast), origin:'intl' };
  }

  function generateRivalName(usedSet){
    var pool = RIVAL_TEAM_NAMES.filter(function(n){ return !usedSet || !usedSet[n]; });
    if(pool.length===0) pool = RIVAL_TEAM_NAMES;
    return pick(pool);
  }

  var POSITIONS = ['GK','DF','MF','FW'];
  var POSITION_LABEL = { GK:'Kiper', DF:'Bek', MF:'Gelandang', FW:'Penyerang' };

  function calcOverall(star, variance){
    return Math.round(clamp(35 + star*6 + (variance||0), 35, 99));
  }

  function wageForStar(star, position){
    var base = star*star*45;
    var mult = position==='FW' ? 1.15 : (position==='GK' ? 0.9 : 1.0);
    return Math.round(base*mult/10)*10 + 100;
  }

  function transferCostForStar(star, position, age){
    var base = Math.pow(star, 2.15) * 380;
    var posMult = position==='FW' ? 1.2 : (position==='GK' ? 0.82 : 1.0);
    var ageFactor = age <= 24 ? 1.15 : (age >= 31 ? 0.7 : 1.0);
    var cost = base * posMult * ageFactor * rand(0.88,1.16);
    return Math.max(300, Math.round(cost/10)*10);
  }

  function trainingCostForStar(star, facilityLevel){
    var base = 150 + star*45;
    var discount = 1 - (facilityLevel-1)*0.08;
    return Math.max(60, Math.round(base*discount/10)*10);
  }

  function makePlayer(opts){
    opts = opts || {};
    var g = generateName();
    var position = opts.position || pick(POSITIONS);
    var star = opts.star != null ? opts.star : rand(1,6);
    star = clamp(star, 1, 10);
    var age = opts.age || randInt(17,33);
    var variance = randInt(-3,3);
    return {
      id: uid(),
      name: g.name,
      origin: g.origin,
      position: position,
      star: Math.round(star*10)/10,
      variance: variance,
      age: age,
      wage: wageForStar(star, position),
      contractWeeks: randInt(20,52),
      morale: randInt(60,90),
      fitness: 100,
      trainedThisWeek: false,
      injuredWeeks: 0,
      isUserOwned: true
    };
  }

  function makeStarterSquad(){
    var squad = [];
    var comp = [
      {pos:'GK', n:2}, {pos:'DF', n:4}, {pos:'MF', n:4}, {pos:'FW', n:2}
    ];
    comp.forEach(function(c){
      for(var i=0;i<c.n;i++){
        squad.push(makePlayer({ position:c.pos, star: rand(1.5,4) }));
      }
    });
    return squad;
  }

  function generateMarket(scoutingLevel, count){
    count = count || 8;
    var list = [];
    var maxStarBonus = (scoutingLevel-1)*0.8;
    for(var i=0;i<count;i++){
      var star = clamp(rand(1, 6.5+maxStarBonus), 1, 10);
      var pos = pick(POSITIONS);
      var age = randInt(16,32);
      var p = makePlayer({ position:pos, star:star, age:age });
      p.isUserOwned = false;
      p.cost = transferCostForStar(p.star, p.position, p.age);
      list.push(p);
    }
    return list;
  }

  function squadOverall(squad){
    function bestOf(pos, count){
      var pool = squad.filter(function(p){ return p.position===pos && p.injuredWeeks<=0; })
                       .sort(function(a,b){ return calcOverall(b.star,b.variance)-calcOverall(a.star,a.variance); });
      var vals = [];
      for(var i=0;i<count;i++){
        if(pool[i]) vals.push(calcOverall(pool[i].star, pool[i].variance));
        else vals.push(38); // penalty for missing role
      }
      return vals.reduce(function(a,b){return a+b;},0)/vals.length;
    }
    var gk = bestOf('GK',1);
    var df = bestOf('DF',3);
    var mf = bestOf('MF',3);
    var fw = bestOf('FW',2);
    return Math.round(gk*0.16 + df*0.30 + mf*0.30 + fw*0.24);
  }

  // ============ Storage ============
  var STORAGE_KEY = 'bttycoon_save_v1';

  function saveState(state){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }catch(e){ return false; }
  }
  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); return true; }catch(e){ return false; }
  }

  global.BTT_DATA = {
    NAMES: NAMES,
    RIVAL_TEAM_NAMES: RIVAL_TEAM_NAMES,
    POSITIONS: POSITIONS,
    POSITION_LABEL: POSITION_LABEL,
    pick: pick, rand: rand, randInt: randInt, clamp: clamp, uid: uid,
    generateName: generateName,
    generateRivalName: generateRivalName,
    calcOverall: calcOverall,
    wageForStar: wageForStar,
    transferCostForStar: transferCostForStar,
    trainingCostForStar: trainingCostForStar,
    makePlayer: makePlayer,
    makeStarterSquad: makeStarterSquad,
    generateMarket: generateMarket,
    squadOverall: squadOverall,
    saveState: saveState,
    loadState: loadState,
    clearState: clearState,
    STORAGE_KEY: STORAGE_KEY
  };

})(window);
