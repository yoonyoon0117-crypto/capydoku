/*
 * Capydoku — puzzle engine.
 *
 * Rules: an N×N grid is split into N connected color regions. Exactly one
 * capybara goes in every row, every column and every region, and no two
 * capybaras may touch — not even diagonally.
 *
 * The generator carves regions around a valid placement, then reshapes them
 * until a solver proves the puzzle has exactly one solution. Region sizes are
 * kept balanced so the bigger boards need real deduction instead of a lucky
 * one-cell shortcut.
 *
 * Runs in the browser (window.CapydokuEngine) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CapydokuEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DIFFICULTIES = [
    { key: 'beginner', label: '초급', size: 5, group: 'easy', hint: '입문·어린이 추천' },
    { key: 'easy', label: '쉬움', size: 6, group: 'easy', hint: '한 걸음 더' },
    { key: 'normal', label: '보통', size: 7, group: 'hard', hint: '도전 시작' },
    { key: 'hard', label: '어려움', size: 8, group: 'hard', hint: '집중 필요' },
    { key: 'expert', label: '전문가', size: 9, group: 'hard', hint: '고수용' },
    { key: 'master', label: '마스터', size: 10, group: 'hard', hint: '최고 난도' }
  ];

  // Region size limits per board, tuned so small boards stay friendly and big
  // ones avoid a pile of one-cell giveaways.
  var LEVEL_RULES = {
    5: { minRegion: 1, maxRegion: 8 },
    6: { minRegion: 1, maxRegion: 10 },
    7: { minRegion: 1, maxRegion: 12 },
    8: { minRegion: 2, maxRegion: 15 },
    9: { minRegion: 2, maxRegion: 18 },
    10: { minRegion: 2, maxRegion: 20 }
  };

  // Verified puzzles used when a seed does not reach a unique layout inside
  // its attempt budget. Filled at build time by scripts/build-pool.js.
  var FALLBACK_POOL = {
    5: [
      { r: '0001100011024412244324443', s: '03142' },
      { r: '0002200221302443344433444', s: '14203' },
      { r: '1110211122112234443344433', s: '30241' },
      { r: '1102211224112243334433344', s: '20314' },
      { r: '0011122211422334443344443', s: '03142' },
      { r: '0112211122311223344433444', s: '02413' },
      { r: '1000211022110243302433444', s: '20314' },
      { r: '1111011120334223342233444', s: '41302' }
    ],
    6: [
      { r: '000011041112044122444322445555445555', s: '025314' },
      { r: '022222022331222333444333444533455555', s: '052413' },
      { r: '002222000211350244355544335544335554', s: '153042' },
      { r: '111022151022553224553344553344555344', s: '304251' },
      { r: '000113020013421113422233445335445555', s: '241503' },
      { r: '111000111200111203154443554443555443', s: '413520' },
      { r: '022222022241002244035544055544055544', s: '053142' },
      { r: '012222011222001122033152033455333555', s: '024135' }
    ],
    7: [
      { r: '1000022110002214433321443333144333314445556445555', s: '3164250' },
      { r: '0000011220011122001132555333255443325554432554446', s: '2405316' },
      { r: '1100022110022211022441112443115544455544665554666', s: '2036415' },
      { r: '2201111220011142222334242233444433344455554455556', s: '2415036' },
      { r: '3000011300001132221113322221635544463554446335444', s: '4631520' },
      { r: '2222202111122211332341633334166554466555446554444', s: '5142630' },
      { r: '0000111000111100214113322444622544462255446665555', s: '3520641' },
      { r: '1111002133442233444223334422666445566664456666555', s: '4051362' },
      { r: '1111220131122253332325533334555444455566445666664', s: '6042513' },
      { r: '2220001442011144211134223333444665344466534666555', s: '3624051' },
      { r: '1111100111100033344203334440333464453366446666666', s: '6251304' },
      { r: '1100000111000033114423311422334442233345556335555', s: '4261350' }
    ],
    8: [
      { r: '5220001152200011552334445533344455376446577766667777666677776666', s: '37246051' },
      { r: '1111220211112202111152224114533241445533444757336447773364477773', s: '61752403' },
      { r: '0002222100222111002221110022313144443336574433365744466677444666', s: '27463051' },
      { r: '1100000010030000113300021133322244336222445566224455562647755666', s: '60741352' },
      { r: '3001111130222111332222443222244433744444377444456677555567775555', s: '26405713' },
      { r: '2220011122211141322222413333344433334444335544445555544677775666', s: '35146270' },
      { r: '1111102211100022333022273000227733342277554466775666677756667777', s: '52603147' },
      { r: '0011111101111144022211442233314422333444266634756666347566663477', s: '04135726' },
      { r: '1110023314110233441102234440002377440663774446557744665577777665', s: '30572641' },
      { r: '1102222211023222442233334423335344265353442655534466675546667777', s: '20351647' },
      { r: '2222000022220031222400312224443355554443655577436665777366677773', s: '57164203' },
      { r: '2220011122200115222001152220333544203335442633554626335746666357', s: '35240617' },
      { r: '1111220011111233111122231166422366664443667544436675555366775553', s: '61475302' },
      { r: '2201111122011333422233334423353744335557446555574666657766677777', s: '24160537' },
      { r: '1000004410000044132222441332244411322444113324556333667766666777', s: '20315746' },
      { r: '0233311102333111223331112333311122263441666655446666574466665744', s: '07136425' }
    ],
    9: [
      { r: '555555000550000001554442221544644333546643333556663333778666333778666333888666663', s: '685741302' },
      { r: '222210000222210330225443337555443777555444777855544777888666677886666777888666777', s: '740531682' },
      { r: '111000333112000033112222233122223333111422383544478883566678833667778833677778888', s: '516830247' },
      { r: '000211111002211116044223366444833666448855566488855556488855656788855666777888666', s: '273516804' },
      { r: '002222111044221111044622111446623331544663333546677333586677777588887777588887777', s: '185720364' },
      { r: '220111111220151544623155544623355444633555448633555588666677888667777788777778888', s: '251374068' },
      { r: '222000011222200011442233331744333331744333335774443665774446688777776688777666888', s: '372418506' },
      { r: '022221111022223131223333333233533333222556664552555664555577666888887777888888777', s: '061483752' },
      { r: '000333333020033331020033331554444433554444477554666477855666777888666777888866777', s: '281750463' },
      { r: '000211111000222213002224333005424333005444333505447333555667788555777788555778888', s: '172640358' },
      { r: '202311111202311144222314446333344466335554466775555666775588886777888888777888888', s: '150364827' },
      { r: '000133344020133344021133344111335344661335444661555544666555554666888877666666888', s: '031475286' },
      { r: '333100222331102222333002444355444446555546466555546668577777668557777888557777888', s: '425061738' },
      { r: '111100000134442222134442222334455222344455666355555666388566676388887777888888887', s: '407135862' },
      { r: '000001111000111412556333412556334444566664474564444777566444777886477777886777777', s: '358460271' },
      { r: '222111000211111070222130077222133007452333777455333377556663377566777777556666788', s: '731502468' },
      { r: '000003333111000003114442223114442223114444223154444233755486663778886666888886666', s: '426851703' },
      { r: '442200001442220001444223333444422333466655533666665557665555777668888877668888877', s: '483605172' },
      { r: '110000222110000222133302222444333522464443522466633555466665555666666777667777788', s: '415307268' },
      { r: '420133335420113335422223555422233555466555577466655557466668877466668777468888877', s: '241507386' },
      { r: '333300001333300101333320111533420446553444446555884446555887766555887776588887776', s: '684130752' },
      { r: '000111112001111112001111122033322226034426666335555566338555776338858777333888877', s: '027135864' },
      { r: '556600000556002210556002213556622233755622443755666644777666644778888844778888884', s: '475861302' },
      { r: '333222204133222204133552224336655444666665444666555544666885774666888774888877777', s: '705184263' }
    ],
    10: [
      { r: '1111122200111112222011112223301111533330144455333344555576684499557668444957766844499977684999977768', s: '8046137592' },
      { r: '0000011112000011112230000116623311116664333311664453338864445558866444555866777755888677775888869999', s: '2491805736' },
      { r: '3333000111333330011233333222223334444222334444422256444442225666442277556666777755566877775588888899', s: '4861302759' },
      { r: '1111003222111103322241133332224411333332444133355544666355554446665655798886665579888866559988886666', s: '5386297041' },
      { r: '4433300111444333312244433332224443333222444433362275544366667558486666777848666677788866667799888666', s: '5796318042' },
      { r: '4444410000444411022044411102234441110033466661555566666788556677778885777778888599999888859999988888', s: '6479081352' },
      { r: '0114422222011142222201154444263315444666355554466635555566667777886966777888699977888899997788899999', s: '0381649257' },
      { r: '2222333300211133300024443665502443366555444666665544766666657778886999778888999977888899997788899999', s: '8304296157' },
      { r: '1111110000111111100011111000226444433322664555552266755555226777555522667777555567779999886777777999', s: '6185240397' },
      { r: '0000222111000222111108442221130844444153886664445588666447558886699775888669977588899999778899999777', s: '1649583702' },
      { r: '2223333000222333001122233334442233556444773355644477755566647775666664777588996977788889997788889999', s: '7902835146' },
      { r: '4222220005422222100542262213054446223355446666355564667775556666667777668897777766889779978888999999', s: '8617093524' },
      { r: '2211111000222214133362244443336244445583624455558866655755586666977758666997778866669979886669999988', s: '7419260583' },
      { r: '2011111555201115555522331555553333144445336774444536677448853667799888666777988866779998886677999988', s: '1403792586' },
      { r: '1111144005144444422514444433256444333355664443335566777733556677883558697788885869978888886997888888', s: '7086491352' },
      { r: '0222133344022211334455221333445552133344555214444855664444886666777788669977778869997778889999977888', s: '0526813794' },
      { r: '1100000000111000100011111112203444222222334442255533445555553333855565779885566677988886667799888666', s: '9270468153' },
      { r: '0011111333205514333320511444335554444436555544446655554466668855666777885567677788858777778888887799', s: '1408635729' },
      { r: '1000022222111112444411152244443315224444375555544467777755446778855944667788899966688889996668889999', s: '4251970368' },
      { r: '0002211111022221155500222155550032411555333444455536644775556666477755666647777586669777778888999977', s: '1642593807' },
      { r: '1113366044133336600413333662245553666444555766644455776664485777766848577778884877997988889999999888', s: '7083915264' },
      { r: '0000000111002111111102222133334442213333444221333344445333364555553666555555666755558899975555889999', s: '0316247958' },
      { r: '3333222240331122224033332224443636655544666665554466666855556667788999777777889977777888997777788999', s: '9240861357' },
      { r: '0002222111000222331140222333114025553333442553333344445555334644555533666665577766668777978888888797', s: '2936051748' },
      { r: '0000002222300000211230002221113332222911433332291144355599114455556911447577699144777668914777766899', s: '1852036479' },
      { r: '2111110000211111111022111111002222344400553334447065553444776553347777955377777799588778779998888888', s: '8514630972' },
      { r: '0000011111000000011155002001115500223336558822344655582233365558226336778882666679888886667988888666', s: '3746829051' },
      { r: '2222200111222321114423333154443335335444663555544766655557776669599777886999977788699997778999999777', s: '5704862913' },
      { r: '0011115555002114555530211445553001145555444444455766444555776666477777666888799766688889996668889999', s: '1420573968' },
      { r: '0000000132004011113244444111324444116333445555683345555568334455666889745566688977756688897775888999', s: '2497135068' },
      { r: '3333222001333322240133322244446633244444663224544466388854556668885555776888555577688885559968888555', s: '7953862041' },
      { r: '2200033355221103335522443333554443333555444336355546666677754666667777668866777788889677778888999977', s: '4206195837' },
      { r: '5333333310532224411053224444105333477466533377446655577799968857779966888777999687777999968887799996', s: '9731628405' },
      { r: '3334442000333444220133344422113388444255338444425538884442556888895555688779555588899999998899999999', s: '7961380425' },
      { r: '1111111320141413332044444443224444443322444665333264466555556666699555668669977766888977778888999777', s: '9086153724' },
      { r: '0322211222032222112203322222273355522777355556477735855647793388866779888888777988888779998888879999', s: '0741635829' },
      { r: '0000002222100400002213340222221334442222133344445533336444553663664455386666555798868665779988888777', s: '3072685941' },
      { r: '1111111003665541122366544422236655544423665544443366555743386555774338655778488895777888889997788888', s: '8579420361' },
      { r: '4003222111443333222144553222224455333222465537777766655777776666555779666687777966668788896688888999', s: '2975031648' },
      { r: '1111000444111110000411111020041311522224333352224435535666443555566666355557766633955577789999977778', s: '4061827593' },
      { r: '1111111100414433312044443333204444355336444455556677775555667777756666977998888697998888889999888888', s: '9184057263' },
      { r: '1111111002444441112244444443235554443333555744433685577773368855776666888777666688999966668899999666', s: '7586419302' },
      { r: '3111110000331122220033222422006334445555663444445566344445556664444577668888887766668888796668888879', s: '6241370859' },
      { r: '4000011111400000001140002201114003322222444433222577743666657884666966788899996688889996668888999999', s: '4853196027' },
      { r: '1111100222111113022241111333224143333322444333337744435537776455553777666655778866665579886666557988', s: '5283140697' },
      { r: '0000111222000111222200011122220003312222444333337754443663775544466677988866677798888887779998888777', s: '3584207961' },
      { r: '0000222444000022444100322244410332254444033555466433555556643358866669335886677955558877995558888799', s: '0931625748' },
      { r: '0000011111000031111100003322226663333222666333334255663334425556388444579688844497968844449996888444', s: '4796803152' },
      { r: '1112333003122233333322225444332255554436777555444677755566667999966666779996666679988886669998888886', s: '7038649152' },
      { r: '1000222222110000023214047003321404753333444475333344447553336444775553666677588866669758886666978888', s: '3197260584' },
      { r: '4400000333440000333144220333314425566833744556688877756668887776686888777778889977799988997777799999', s: '4928136075' },
      { r: '0000011111000011122200001332220000133222044433355504333333554444888655477488966677788899997777889999', s: '0485297136' },
      { r: '3110000000311010000031111000223351222224335228222433555822446755982244677598888467559888886779998888', s: '6481930275' },
      { r: '0022111111022212111100222212113222222211355244261135554446118555444666888554476688899997668889999966', s: '1840539726' },
      { r: '1111000222511110022255111002235555504443555555444699577774669977778466997777866699777888869999778886', s: '4179628350' },
      { r: '2220000113222200011326660001332266644133226664443566666444358866774499888877799988887779998888779999', s: '3708592416' },
      { r: '0001111111011132222200333332220033332222403335222540333525254446655555444667778846669977784666998888', s: '1382074695' },
      { r: '2222230011222223333144222333334444445533444444553344447555336466795553666779988866677998886777999888', s: '6928150374' },
      { r: '2000000000222000311125503333335500333333550633333495563377449566677744958887744498888777449988887744', s: '5807924631' },
      { r: '2221110000221113000422133330042213000004233333504483337555448338775596888877999688888777968888877999', s: '6203859417' }
    ]
  };

  // ---------------------------------------------------------------- utilities

  function hashString(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function clampSize(size) {
    var s = size | 0;
    if (s < 5) s = 5;
    if (s > 10) s = 10;
    return s;
  }

  function difficultyByKey(key) {
    for (var i = 0; i < DIFFICULTIES.length; i++) {
      if (DIFFICULTIES[i].key === key) return DIFFICULTIES[i];
    }
    return DIFFICULTIES[0];
  }

  function difficultyBySize(size) {
    for (var i = 0; i < DIFFICULTIES.length; i++) {
      if (DIFFICULTIES[i].size === size) return DIFFICULTIES[i];
    }
    return DIFFICULTIES[0];
  }

  function rulesFor(size) {
    return LEVEL_RULES[clampSize(size)] || LEVEL_RULES[9];
  }

  // Today's date in Asia/Seoul, formatted as YYYY-MM-DD.
  function dateKeySeoul(date) {
    var d = date instanceof Date ? date : new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(d);
      var out = {};
      for (var i = 0; i < parts.length; i++) out[parts[i].type] = parts[i].value;
      return out.year + '-' + out.month + '-' + out.day;
    } catch (e) {
      var t = new Date(d.getTime() + 9 * 3600 * 1000);
      var mm = String(t.getUTCMonth() + 1).padStart(2, '0');
      var dd = String(t.getUTCDate()).padStart(2, '0');
      return t.getUTCFullYear() + '-' + mm + '-' + dd;
    }
  }

  // ------------------------------------------------------------ board helpers

  function rowOf(size, index) {
    return (index / size) | 0;
  }

  function colOf(size, index) {
    return index % size;
  }

  function neighborsOf(size, index) {
    var r = rowOf(size, index);
    var c = colOf(size, index);
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr;
        var cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        out.push(rr * size + cc);
      }
    }
    return out;
  }

  // Capybaras that already clash with a capybara at `index`.
  function conflictingCells(puzzle, capybaras, index) {
    var size = puzzle.size;
    var regions = puzzle.regions;
    var r = rowOf(size, index);
    var c = colOf(size, index);
    var rid = regions[index];
    var out = [];
    for (var i = 0; i < capybaras.length; i++) {
      var other = capybaras[i];
      if (other === index) continue;
      var orow = rowOf(size, other);
      var ocol = colOf(size, other);
      if (orow === r || ocol === c || regions[other] === rid) out.push(other);
      else if (Math.abs(orow - r) <= 1 && Math.abs(ocol - c) <= 1) out.push(other);
    }
    return out;
  }

  // Cells that can no longer hold a capybara because of the ones placed.
  function blockedCells(puzzle, capybaras) {
    var size = puzzle.size;
    var regions = puzzle.regions;
    var blocked = new Uint8Array(size * size);
    var rowUsed = new Uint8Array(size);
    var colUsed = new Uint8Array(size);
    var regionUsed = new Uint8Array(size);
    var i;
    for (i = 0; i < capybaras.length; i++) {
      var idx = capybaras[i];
      rowUsed[rowOf(size, idx)] = 1;
      colUsed[colOf(size, idx)] = 1;
      regionUsed[regions[idx]] = 1;
    }
    for (i = 0; i < size * size; i++) {
      if (rowUsed[rowOf(size, i)] || colUsed[colOf(size, i)] || regionUsed[regions[i]]) blocked[i] = 1;
    }
    for (i = 0; i < capybaras.length; i++) {
      var nbrs = neighborsOf(size, capybaras[i]);
      for (var k = 0; k < nbrs.length; k++) blocked[nbrs[k]] = 1;
      blocked[capybaras[i]] = 0;
    }
    return blocked;
  }

  function isSolved(regions, size, capybaras) {
    if (capybaras.length !== size) return false;
    var rowUsed = new Uint8Array(size);
    var colUsed = new Uint8Array(size);
    var regionUsed = new Uint8Array(size);
    var seen = new Uint8Array(size * size);
    for (var i = 0; i < capybaras.length; i++) {
      var idx = capybaras[i];
      if (idx < 0 || idx >= size * size || seen[idx]) return false;
      seen[idx] = 1;
      var r = rowOf(size, idx);
      var c = colOf(size, idx);
      if (rowUsed[r] || colUsed[c] || regionUsed[regions[idx]]) return false;
      rowUsed[r] = 1;
      colUsed[c] = 1;
      regionUsed[regions[idx]] = 1;
      for (var k = 0; k < i; k++) {
        var o = capybaras[k];
        if (Math.abs(rowOf(size, o) - r) <= 1 && Math.abs(colOf(size, o) - c) <= 1) return false;
      }
    }
    return true;
  }

  // --------------------------------------------------------------- solutions

  // Random valid placement: one per row and column, never diagonally adjacent.
  function randomSolution(size, rng) {
    var cols = new Int8Array(size).fill(-1);
    var used = new Uint8Array(size);

    function place(row) {
      if (row === size) return true;
      var order = [];
      for (var c = 0; c < size; c++) order.push(c);
      shuffle(order, rng);
      for (var i = 0; i < order.length; i++) {
        var cc = order[i];
        if (used[cc]) continue;
        if (row > 0 && Math.abs(cols[row - 1] - cc) <= 1) continue;
        used[cc] = 1;
        cols[row] = cc;
        if (place(row + 1)) return true;
        used[cc] = 0;
        cols[row] = -1;
      }
      return false;
    }

    if (!place(0)) return null;
    var out = [];
    for (var r = 0; r < size; r++) out.push(cols[r]);
    return out;
  }

  /*
   * Balanced region growth: the smallest region always gets the next cell, so
   * every region ends up close to N cells instead of leaving tiny leftovers.
   */
  function carveBalanced(size, solution, rng, maxRegion) {
    var total = size * size;
    var regions = new Int8Array(total).fill(-1);
    var sizes = new Uint8Array(size);
    var frontiers = [];
    var r, rid, i;

    for (r = 0; r < size; r++) {
      frontiers.push([]);
      regions[r * size + solution[r]] = r;
      sizes[r] = 1;
    }

    function growFrontier(idx, owner) {
      var row = rowOf(size, idx);
      var col = colOf(size, idx);
      for (var d = 0; d < 4; d++) {
        var rr = row + (d === 0 ? 1 : d === 1 ? -1 : 0);
        var cc = col + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var ni = rr * size + cc;
        if (regions[ni] === -1) frontiers[owner].push(ni);
      }
    }

    for (r = 0; r < size; r++) growFrontier(r * size + solution[r], r);

    var assigned = size;
    while (assigned < total) {
      var best = [];
      var bestSize = Infinity;
      for (rid = 0; rid < size; rid++) {
        if (sizes[rid] >= maxRegion) continue;
        var list = frontiers[rid];
        var valid = [];
        for (i = 0; i < list.length; i++) {
          if (regions[list[i]] === -1) valid.push(list[i]);
        }
        frontiers[rid] = valid;
        if (!valid.length) continue;
        if (sizes[rid] < bestSize) {
          bestSize = sizes[rid];
          best = [rid];
        } else if (sizes[rid] === bestSize) {
          best.push(rid);
        }
      }
      if (!best.length) break;
      var owner = best[(rng() * best.length) | 0];
      var cells = frontiers[owner];
      var pick = cells[(rng() * cells.length) | 0];
      regions[pick] = owner;
      sizes[owner]++;
      assigned++;
      growFrontier(pick, owner);
    }

    return regions;
  }

  // Grow N connected regions, each seeded with one cell of the solution.
  function carveRegions(size, solution, rng, maxRegion) {
    var total = size * size;
    var regions = new Int8Array(total).fill(-1);
    var sizes = new Uint8Array(size);
    var r, i;

    for (r = 0; r < size; r++) {
      regions[r * size + solution[r]] = r;
      sizes[r] = 1;
    }

    var assigned = size;
    while (assigned < total) {
      var candidates = [];
      for (i = 0; i < total; i++) {
        if (regions[i] !== -1) continue;
        var ri = rowOf(size, i);
        var ci = colOf(size, i);
        var neigh = [];
        for (var d = 0; d < 4; d++) {
          var rr = ri + (d === 0 ? 1 : d === 1 ? -1 : 0);
          var cc = ci + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var rid = regions[rr * size + cc];
          if (rid !== -1 && neigh.indexOf(rid) === -1) neigh.push(rid);
        }
        if (neigh.length) candidates.push([i, neigh]);
      }
      if (!candidates.length) break;

      var pick = candidates[(rng() * candidates.length) | 0];
      var options = [];
      for (var n = 0; n < pick[1].length; n++) {
        if (sizes[pick[1][n]] < maxRegion) options.push(pick[1][n]);
      }
      if (!options.length) options = pick[1];
      options.sort(function (a, b) {
        return sizes[a] - sizes[b];
      });
      var chosen = options.length > 1 && rng() < 0.3 ? options[1] : options[0];
      regions[pick[0]] = chosen;
      sizes[chosen]++;
      assigned++;
    }

    return regions;
  }

  // ------------------------------------------------------------------ solver

  /*
   * Counts solutions up to `limit`, storing each as columns per row.
   * Row-major search with bitmasks for columns, regions and diagonal contact.
   */
  function solve(regions, size, limit) {
    size = clampSize(size);
    limit = limit || 2;
    var total = size * size;
    var regionCells = [];
    for (var i = 0; i < size; i++) regionCells.push([]);
    for (var cell = 0; cell < total; cell++) regionCells[regions[cell]].push(cell);

    var count = 0;
    var solutions = [];
    var cols = new Int8Array(size).fill(-1);
    var visited = 0;

    function regionsStillPossible(startRow, colMask, regMask) {
      for (var rid = 0; rid < size; rid++) {
        if (regMask & (1 << rid)) continue;
        var possible = false;
        var list = regionCells[rid];
        for (var k = 0; k < list.length; k++) {
          var rr = (list[k] / size) | 0;
          if (rr < startRow) continue;
          if (colMask & (1 << (list[k] % size))) continue;
          possible = true;
          break;
        }
        if (!possible) return false;
      }
      return true;
    }

    function dfs(row, colMask, regMask, prevCol) {
      visited++;
      if (row === size) {
        count++;
        if (solutions.length < limit) solutions.push(Array.prototype.slice.call(cols));
        return count >= limit;
      }
      if (!regionsStillPossible(row, colMask, regMask)) return false;

      for (var c = 0; c < size; c++) {
        var bit = 1 << c;
        if (colMask & bit) continue;
        if (prevCol >= 0 && Math.abs(c - prevCol) <= 1) continue;
        var reg = regions[row * size + c];
        if (regMask & (1 << reg)) continue;
        cols[row] = c;
        if (dfs(row + 1, colMask | bit, regMask | (1 << reg), c)) {
          cols[row] = -1;
          return true;
        }
        cols[row] = -1;
      }
      return false;
    }

    dfs(0, 0, 0, -1);
    return { count: count, solutions: solutions, visited: visited };
  }

  function countSolutions(regions, size, limit) {
    return solve(regions, size, limit || 2).count;
  }

  // --------------------------------------------------------------- shaping

  function regionSizes(regions, size) {
    var sizes = new Array(size).fill(0);
    for (var i = 0; i < regions.length; i++) sizes[regions[i]]++;
    return sizes;
  }

  // True when removing `skip` keeps region `rid` in one piece.
  function staysConnected(regions, size, rid, skip) {
    var cells = [];
    for (var i = 0; i < size * size; i++) {
      if (regions[i] === rid && i !== skip) cells.push(i);
    }
    if (cells.length <= 1) return true;
    var inRegion = new Set(cells);
    var seen = new Set([cells[0]]);
    var stack = [cells[0]];
    while (stack.length) {
      var cur = stack.pop();
      var r = rowOf(size, cur);
      var c = colOf(size, cur);
      for (var d = 0; d < 4; d++) {
        var rr = r + (d === 0 ? 1 : d === 1 ? -1 : 0);
        var cc = c + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var ni = rr * size + cc;
        if (inRegion.has(ni) && !seen.has(ni)) {
          seen.add(ni);
          stack.push(ni);
        }
      }
    }
    return seen.size === cells.length;
  }

  /*
   * One cell can change region without disturbing the intended solution as
   * long as it is not that solution's own cell: every region keeps its
   * capybara. Such a move also breaks every alternative solution that used the
   * cell, which is how the puzzle is pushed down to a single answer.
   */
  function candidateMoves(size, regions, solutionCells, cells, minRegion, maxRegion) {
    var sizes = regionSizes(regions, size);
    var moves = [];
    for (var k = 0; k < cells.length; k++) {
      var x = cells[k];
      if (solutionCells[x]) continue;
      var r = rowOf(size, x);
      var c = colOf(size, x);
      var from = regions[x];
      if (sizes[from] <= minRegion) continue;
      if (!staysConnected(regions, size, from, x)) continue;
      var targets = [];
      for (var d = 0; d < 4; d++) {
        var rr = r + (d === 0 ? 1 : d === 1 ? -1 : 0);
        var cc = c + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var other = regions[rr * size + cc];
        if (other === from) continue;
        if (sizes[other] >= maxRegion) continue;
        if (targets.indexOf(other) === -1) targets.push(other);
      }
      for (var t = 0; t < targets.length; t++) moves.push([x, targets[t]]);
    }
    return moves;
  }

  // Lower is tidier and more balanced.
  function regionScore(regions, size, minRegion, maxRegion) {
    var sizes = regionSizes(regions, size);
    var score = 0;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var i0 = r * size + c;
        if (c + 1 < size && regions[i0] !== regions[i0 + 1]) score += 1;
        if (r + 1 < size && regions[i0] !== regions[i0 + size]) score += 1;
      }
    }
    for (var i = 0; i < size; i++) {
      var s = sizes[i];
      if (s < minRegion) score += (minRegion - s) * 8;
      else if (s > maxRegion) score += (s - maxRegion) * 6;
      else score += Math.abs(s - size) * 0.55;
    }
    return score;
  }

  /*
   * Nudges the regions until the intended solution is the only one left. Each
   * step looks at a sample of alternative solutions and moves the cell they
   * lean on most into a neighbouring region.
   */
  function refineToUnique(size, solution, regionArr, rng, rules, maxIterations, sampleSize) {
    var solutionCells = {};
    for (var r = 0; r < size; r++) solutionCells[r * size + solution[r]] = 1;
    var regions = regionArr.slice();

    for (var iter = 0; iter < maxIterations; iter++) {
      var result = solve(regions, size, sampleSize || 26);
      if (result.count === 1) return { regions: regions, iterations: iter };

      var popularity = {};
      var alts = result.solutions;
      for (var s = 0; s < alts.length; s++) {
        for (var row = 0; row < size; row++) {
          var cell = row * size + alts[s][row];
          if (solutionCells[cell]) continue;
          popularity[cell] = (popularity[cell] || 0) + 1;
        }
      }
      var ranked = Object.keys(popularity)
        .map(Number)
        .sort(function (a, b) {
          return popularity[b] - popularity[a];
        });

      var moves = [];
      for (var q = 0; q < ranked.length && q < 24 && !moves.length; q++) {
        moves = candidateMoves(size, regions, solutionCells, [ranked[q]], rules.minRegion, rules.maxRegion);
      }
      if (!moves.length) {
        var free = [];
        for (var f = 0; f < size * size; f++) if (!solutionCells[f]) free.push(f);
        moves = candidateMoves(size, regions, solutionCells, free, rules.minRegion, rules.maxRegion);
      }
      if (!moves.length) return null;

      var move = moves[(rng() * moves.length) | 0];
      regions[move[0]] = move[1];
    }
    return null;
  }

  /*
   * Grows regions that ended up too small by absorbing an adjacent cell, as
   * long as the swap keeps every region connected and the answer unique.
   */
  function repairTinyRegions(size, solution, regionArr, targetMin, rng) {
    var solutionCells = {};
    for (var r = 0; r < size; r++) solutionCells[r * size + solution[r]] = 1;
    var regions = regionArr.slice();
    var sizes = regionSizes(regions, size);

    for (var guard = 0; guard < 400; guard++) {
      var worst = -1;
      var worstSize = Infinity;
      for (var rid = 0; rid < size; rid++) {
        if (sizes[rid] < targetMin && sizes[rid] < worstSize) {
          worst = rid;
          worstSize = sizes[rid];
        }
      }
      if (worst < 0) return regions;

      var candidates = [];
      for (var i = 0; i < size * size; i++) {
        if (regions[i] !== worst || sizes[worst] === 0) continue;
        var row = rowOf(size, i);
        var col = colOf(size, i);
        for (var d = 0; d < 4; d++) {
          var rr = row + (d === 0 ? 1 : d === 1 ? -1 : 0);
          var cc = col + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var ni = rr * size + cc;
          var other = regions[ni];
          if (other === worst) continue;
          if (solutionCells[ni]) continue;
          if (sizes[other] <= 1) continue;
          if (candidates.indexOf(ni) === -1) candidates.push(ni);
        }
      }
      if (!candidates.length) return regions;

      var applied = false;
      for (var k = 0; k < candidates.length; k++) {
        var cell = candidates[k];
        var from = regions[cell];
        if (!staysConnected(regions, size, from, cell)) continue;
        var trial = regions.slice();
        trial[cell] = worst;
        if (solve(trial, size, 2).count !== 1) continue;
        regions = trial;
        sizes[from]--;
        sizes[worst]++;
        applied = true;
        break;
      }
      if (!applied) return regions;
    }
    return regions;
  }

  /*
   * Random boundary moves that keep the puzzle unique but tidy up region
   * shapes; only improvements are kept.
   */
  function polishRegions(size, solution, regionArr, rng, rules, trials) {
    var solutionCells = {};
    for (var r = 0; r < size; r++) solutionCells[r * size + solution[r]] = 1;
    var best = regionArr.slice();
    var bestScore = regionScore(best, size, rules.minRegion, rules.maxRegion);
    var total = size * size;

    for (var t = 0; t < trials; t++) {
      var start = (rng() * total) | 0;
      if (solutionCells[start]) continue;
      var moves = candidateMoves(size, best, solutionCells, [start], rules.minRegion, rules.maxRegion);
      if (!moves.length) continue;
      var move = moves[(rng() * moves.length) | 0];
      var trial = best.slice();
      trial[move[0]] = move[1];
      if (solve(trial, size, 2).count !== 1) continue;
      var score = regionScore(trial, size, rules.minRegion, rules.maxRegion);
      if (score < bestScore) {
        best = trial;
        bestScore = score;
      }
    }
    return best;
  }

  // -------------------------------------------------------------- generator

  function encodeRegions(regions) {
    var out = '';
    for (var i = 0; i < regions.length; i++) out += regions[i].toString(36);
    return out;
  }

  function decodeRegions(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) out.push(parseInt(str[i], 36));
    return out;
  }

  function encodeSolution(solution) {
    var out = '';
    for (var i = 0; i < solution.length; i++) out += solution[i].toString(36);
    return out;
  }

  function decodeSolution(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) out.push(parseInt(str[i], 36));
    return out;
  }

  /*
   * Search profile per board: a wider restart budget with shorter refinements
   * converges faster on big boards than one long refinement that stalls.
   */
  function genProfile(size) {
    if (size <= 6) return { attempts: 14, refine: 600, sample: 24 };
    if (size === 7) return { attempts: 14, refine: 400, sample: 20 };
    if (size === 8) return { attempts: 14, refine: 200, sample: 20 };
    if (size === 9) return { attempts: 30, refine: 80, sample: 16 };
    return { attempts: 60, refine: 40, sample: 12 };
  }

  function attemptBudget(size) {
    return genProfile(size).attempts;
  }

  function polishTrials(size) {
    return size * size * (size >= 9 ? 2 : 3);
  }

  /*
   * Generates a puzzle for `size` from `seed`. The same seed always produces
   * the same puzzle. A layout is only returned once the solver has confirmed
   * exactly one solution and the region sizes respect the level rules; when
   * that cannot be reached within the attempt budget, a verified pool puzzle
   * is used, picked deterministically from the seed.
   */
  function generatePuzzle(size, seed, options) {
    size = clampSize(size);
    seed = seed == null ? 'seed' : String(seed);
    options = options || {};
    var rules = rulesFor(size);
    var profile = genProfile(size);
    var attempts = options.attempts || profile.attempts;
    
    var rng = mulberry32(hashString('capydoku:' + seed + ':' + size));

    for (var attempt = 0; attempt < attempts; attempt++) {
      var solution = randomSolution(size, rng);
      if (!solution) continue;
      var carved = Array.prototype.slice.call(carveRegions(size, solution, rng, rules.maxRegion));
      var refined = refineToUnique(
        size,
        solution,
        carved,
        rng,
        { minRegion: 1, maxRegion: rules.maxRegion },
        options.maxRefine || profile.refine,
        options.solutionSample || profile.sample
      );
      if (!refined) continue;
      var repaired = repairTinyRegions(size, solution, refined.regions, rules.minRegion, rng);
      var polished = polishRegions(size, solution, repaired, rng, rules, polishTrials(size));
      if (solve(polished, size, 2).count !== 1) continue;
      var sizes = regionSizes(polished, size);
      var fits = true;
      for (var i = 0; i < size; i++) {
        if (sizes[i] < rules.minRegion || sizes[i] > rules.maxRegion) fits = false;
      }
      if (!fits) continue;
      return {
        size: size,
        regions: polished,
        solution: solution,
        seed: seed,
        source: 'generated',
        attempts: attempt + 1,
        refinements: refined.iterations
      };
    }

    var pool = FALLBACK_POOL[size] || [];
    if (pool.length) {
      var entry = pool[hashString(seed + ':fallback') % pool.length];
      return {
        size: size,
        regions: decodeRegions(entry.r),
        solution: decodeSolution(entry.s),
        seed: seed,
        source: 'fallback',
        attempts: attempts
      };
    }

    // Should never happen with a bundled pool; keep the app playable anyway.
    var fallbackSolution = randomSolution(size, rng);
    var fallbackRegions = Array.prototype.slice.call(
      carveRegions(size, fallbackSolution, rng, rules.maxRegion)
    );
    return {
      size: size,
      regions: fallbackRegions,
      solution: fallbackSolution,
      seed: seed,
      source: 'unverified',
      attempts: attempts
    };
  }

  function setFallbackPool(size, entries) {
    FALLBACK_POOL[size] = entries;
  }

  function fallbackPoolSizes() {
    var out = {};
    Object.keys(FALLBACK_POOL).forEach(function (k) {
      out[k] = FALLBACK_POOL[k].length;
    });
    return out;
  }

  return {
    DIFFICULTIES: DIFFICULTIES,
    FALLBACK_POOL: FALLBACK_POOL,
    LEVEL_RULES: LEVEL_RULES,
    difficultyByKey: difficultyByKey,
    difficultyBySize: difficultyBySize,
    rulesFor: rulesFor,
    dateKeySeoul: dateKeySeoul,
    hashString: hashString,
    mulberry32: mulberry32,
    rowOf: rowOf,
    colOf: colOf,
    neighborsOf: neighborsOf,
    conflictingCells: conflictingCells,
    blockedCells: blockedCells,
    isSolved: isSolved,
    solve: solve,
    countSolutions: countSolutions,
    regionSizes: regionSizes,
    regionScore: regionScore,
    carveBalanced: carveBalanced,
    refineToUnique: refineToUnique,
    generatePuzzle: generatePuzzle,
    encodeRegions: encodeRegions,
    decodeRegions: decodeRegions,
    encodeSolution: encodeSolution,
    decodeSolution: decodeSolution,
    setFallbackPool: setFallbackPool,
    fallbackPoolSizes: fallbackPoolSizes
  };
});
