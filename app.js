/*
 * Capydoku — app shell.
 * iPhone-first UI for the puzzle engine: tap/drag input, tangerine lives,
 * undo, hints, daily challenge, dark mode, colour-blind patterns and local
 * save data. No ads, no tracking, no network calls.
 */
(function () {
  'use strict';

  var E = window.CapydokuEngine;
  if (!E) {
    document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">엔진을 불러오지 못했어요. 새로고침해 주세요.</p>';
    return;
  }

  /* ------------------------------------------------------- 카피바라 도감 */
  /* SKINS:SOURCE:BEGIN — /workspace/tmp/hamdoku/skins-preview.mjs extracts this block for artwork previews */
  var SKIN_PALETTES = {
    warm: { fur: '#b8865f', ear: '#8d6242', earIn: '#c08c6b', muzzle: '#ecd2b2', nose: '#7a5540', eye: '#3f2a1e', cheek: '#e79c86' },
    sun: { fur: '#c1915f', ear: '#9c6f45', earIn: '#cfa87f', muzzle: '#f7e6cc', nose: '#7a5540', eye: '#3f2a1e', cheek: '#ec9f88' },
    night: { fur: '#8f87b0', ear: '#6d668c', earIn: '#aa9fca', muzzle: '#f0e8fb', nose: '#5b5476', eye: '#2e2a45', cheek: '#f0a6bf' },
    cream: { fur: '#dcb489', ear: '#bd9268', earIn: '#eccdab', muzzle: '#fff3e2', nose: '#7a5540', eye: '#3f2a1e', cheek: '#f4a79c' }
  };

  function num(v) {
    return Math.round(v * 100) / 100;
  }

  /* four-point twinkle */
  function sparklePath(cx, cy, r) {
    var k = num(r * 0.2);
    return (
      'M' + num(cx) + ' ' + num(cy - r) +
      'Q' + num(cx + k) + ' ' + num(cy - k) + ' ' + num(cx + r) + ' ' + num(cy) +
      'Q' + num(cx + k) + ' ' + num(cy + k) + ' ' + num(cx) + ' ' + num(cy + r) +
      'Q' + num(cx - k) + ' ' + num(cy + k) + ' ' + num(cx - r) + ' ' + num(cy) +
      'Q' + num(cx - k) + ' ' + num(cy - k) + ' ' + num(cx) + ' ' + num(cy - r) + 'Z'
    );
  }

  /* five-point star */
  function starPath(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 ? r * 0.47 : r;
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(num(cx + Math.cos(a) * rad) + ' ' + num(cy + Math.sin(a) * rad));
    }
    return 'M' + pts.join('L') + 'Z';
  }

  /* one body for every capybara so the family stays recognisable */
  function capyBody(p) {
    return (
      '<ellipse cx="14.5" cy="17.5" rx="7" ry="5.6" fill="' + p.ear + '"/>' +
      '<ellipse cx="49.5" cy="17.5" rx="7" ry="5.6" fill="' + p.ear + '"/>' +
      '<ellipse cx="14.5" cy="17.5" rx="3.2" ry="2.6" fill="' + p.earIn + '"/>' +
      '<ellipse cx="49.5" cy="17.5" rx="3.2" ry="2.6" fill="' + p.earIn + '"/>' +
      '<rect x="4.5" y="12" width="55" height="46" rx="16" fill="' + p.fur + '"/>' +
      '<rect x="13" y="34" width="38" height="21" rx="10.5" fill="' + p.muzzle + '"/>'
    );
  }

  /* close nostrils in the middle of the muzzle (cx 28 / 36), rosy cheeks */
  function capyNose(p) {
    return (
      '<ellipse cx="28" cy="43.5" rx="1.7" ry="1.4" fill="' + p.nose + '"/>' +
      '<ellipse cx="36" cy="43.5" rx="1.7" ry="1.4" fill="' + p.nose + '"/>'
    );
  }

  function capyCheeks(p, strength) {
    var o = strength || 0.78;
    return (
      '<ellipse cx="12.6" cy="37" rx="3.5" ry="2.3" fill="' + p.cheek + '" opacity="' + o + '"/>' +
      '<ellipse cx="51.4" cy="37" rx="3.5" ry="2.3" fill="' + p.cheek + '" opacity="' + o + '"/>'
    );
  }

  function mouthSmile(p) {
    return (
      '<path d="M32 45.4v2.1M32 47.5c-1.4 1.8-3.4 1.8-4.6.4M32 47.5c1.4 1.8 3.4 1.8 4.6.4" ' +
      'stroke="' + p.nose + '" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
    );
  }

  function mouthSweet(p) {
    return '<path d="M28.7 46.2c1.2 2.7 5.9 2.7 7.1 0" stroke="' + p.nose + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  }

  function mouthSmirk(p) {
    return '<path d="M29.3 47.2c2.2 2.1 5.6 1.3 7-1.2" stroke="' + p.nose + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  }

  /* open happy mouth — a little tongue peeks out */
  function mouthOpen(p) {
    return (
      '<path d="M28.1 46.1h7.8a3.9 3.9 0 0 1-7.8 0z" fill="' + p.nose + '"/>' +
      '<ellipse cx="32" cy="48.1" rx="1.9" ry="1.05" fill="#f09a9c"/>'
    );
  }

  function eyesRound(p, r) {
    r = r || 2.7;
    return (
      '<circle cx="20.5" cy="29.5" r="' + r + '" fill="' + p.eye + '"/>' +
      '<circle cx="43.5" cy="29.5" r="' + r + '" fill="' + p.eye + '"/>' +
      '<circle cx="' + num(20.5 - r * 0.34) + '" cy="' + num(29.5 - r * 0.34) + '" r="' + num(r * 0.35) + '" fill="#fff8f0"/>' +
      '<circle cx="' + num(43.5 - r * 0.34) + '" cy="' + num(29.5 - r * 0.34) + '" r="' + num(r * 0.35) + '" fill="#fff8f0"/>'
    );
  }

  function eyesSparkle(p) {
    return (
      '<circle cx="20.5" cy="29.5" r="3.3" fill="' + p.eye + '"/>' +
      '<circle cx="43.5" cy="29.5" r="3.3" fill="' + p.eye + '"/>' +
      '<circle cx="19.4" cy="28.3" r="1.25" fill="#fff8f0"/>' +
      '<circle cx="42.4" cy="28.3" r="1.25" fill="#fff8f0"/>' +
      '<circle cx="21.8" cy="30.9" r="0.65" fill="#fff8f0" opacity="0.9"/>' +
      '<circle cx="44.8" cy="30.9" r="0.65" fill="#fff8f0" opacity="0.9"/>'
    );
  }

  function eyesHappy(p) {
    return (
      '<path d="M17.3 30.9q3.2-4 6.4 0" stroke="' + p.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M40.3 30.9q3.2-4 6.4 0" stroke="' + p.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    );
  }

  function eyesSleepy(p) {
    return (
      '<path d="M17.2 29.4q3.3 3.8 6.6 0" stroke="' + p.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M40.2 29.4q3.3 3.8 6.6 0" stroke="' + p.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    );
  }

  function eyesWink(p) {
    return (
      '<circle cx="20.5" cy="29.5" r="3.15" fill="' + p.eye + '"/>' +
      '<circle cx="19.4" cy="28.4" r="1.15" fill="#fff8f0"/>' +
      '<circle cx="21.7" cy="30.8" r="0.6" fill="#fff8f0" opacity="0.9"/>' +
      '<path d="M40.3 30.7q3.2-3.9 6.4 0" stroke="' + p.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    );
  }

  function eyesShades() {
    return (
      '<path d="M13.4 28.2l-3.2-1.3M50.6 28.2l3.2-1.3" stroke="#3a2f28" stroke-width="1.5" stroke-linecap="round"/>' +
      '<rect x="13.4" y="25.3" width="13.7" height="8.7" rx="4.25" fill="#2f2622"/>' +
      '<rect x="36.9" y="25.3" width="13.7" height="8.7" rx="4.25" fill="#2f2622"/>' +
      '<rect x="26.2" y="27.7" width="11.6" height="2.1" rx="1.05" fill="#2f2622"/>' +
      '<path d="M17.1 27.4l4.5 5.3M40.6 27.4l4.5 5.3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.42"/>'
    );
  }

  function eyesProud(p) {
    return (
      eyesRound(p, 2.7) +
      '<path d="M16.9 27.2h7.2M40 27.2h7.2" stroke="' + p.fur + '" stroke-width="2.1" stroke-linecap="round"/>'
    );
  }

  function eyesTwinkle(p) {
    return (
      '<circle cx="20.5" cy="29.5" r="3.4" fill="' + p.eye + '"/>' +
      '<circle cx="43.5" cy="29.5" r="3.4" fill="' + p.eye + '"/>' +
      '<path d="' + sparklePath(19.3, 28.3, 2.1) + '" fill="#fff8f0"/>' +
      '<path d="' + sparklePath(42.3, 28.3, 2.1) + '" fill="#fff8f0"/>'
    );
  }

  function propTangerine() {
    return (
      '<circle cx="48.5" cy="11" r="6.2" fill="#ff9f43"/>' +
      '<circle cx="46.8" cy="9.4" r="1.8" fill="#ffc078" opacity="0.9"/>' +
      '<path d="M48.6 5.1c1.8-2.5 4.4-2.8 6.4-2-.9 2.6-3.3 3.8-6.4 2z" fill="#77b56a"/>'
    );
  }

  function propOnsenTowel() {
    return (
      '<path d="M21.2 4.2c2.2-1.5-2.2-2.8 0-4.2M29.4 3.8c2.2-1.5-2.2-2.8 0-4.2M38.2 4.2c2.2-1.5-2.2-2.8 0-4.2" stroke="#bccbd8" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.75"/>' +
      '<g transform="rotate(-7 32 11)">' +
      '<rect x="17.4" y="13.6" width="29.2" height="4.2" rx="2.1" fill="#8a5c3c" opacity="0.18"/>' +
      '<rect x="16" y="7.4" width="32" height="9.6" rx="4.4" fill="#f8f0e6" stroke="#e6d8c8" stroke-width="0.9"/>' +
      '<rect x="17.6" y="4" width="28.8" height="7.6" rx="3.6" fill="#fffdf8" stroke="#ecdccb" stroke-width="0.9"/>' +
      '<path d="M19.4 11.2h25.2" stroke="#eadccd" stroke-width="1"/>' +
      '<path d="M19.4 13.4h25.2" stroke="#f4d4c2" stroke-width="1.6"/>' +
      '<path d="M20.8 8.2h22.4" stroke="#f3e6d8" stroke-width="0.9"/>' +
      '<path d="M45.4 10.4c2.2.4 3.6 1.9 3.6 4v3.2c0 1.6-1.2 2.7-2.8 2.7h-1.8z" fill="#fffdf8" stroke="#ecdccb" stroke-width="0.85"/>' +
      '</g>'
    );
  }

  function propRibbon() {
    return (
      '<ellipse cx="40.6" cy="9.9" rx="6.4" ry="4.2" fill="#ff9dc0" transform="rotate(-19 40.6 9.9)"/>' +
      '<ellipse cx="52.4" cy="9.9" rx="6.4" ry="4.2" fill="#ff9dc0" transform="rotate(19 52.4 9.9)"/>' +
      '<ellipse cx="41.2" cy="9.8" rx="3.2" ry="2.1" fill="#ffc6da" transform="rotate(-19 41.2 9.8)"/>' +
      '<ellipse cx="51.8" cy="9.8" rx="3.2" ry="2.1" fill="#ffc6da" transform="rotate(19 51.8 9.8)"/>' +
      '<path d="M37.6 7.6c1.4-1.2 3.2-1.6 4.8-1.2M55.4 7.6c-1.4-1.2-3.2-1.6-4.8-1.2" stroke="#ffd3e3" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<path d="M45.4 12.6c-1.5 2.7-3.5 3.9-5.7 3.5 1.3-2.5 3-4 5.7-3.5z" fill="#ff8fb9"/>' +
      '<path d="M47.7 12.6c1.5 2.7 3.5 3.9 5.7 3.5-1.3-2.5-3-4-5.7-3.5z" fill="#ff8fb9"/>' +
      '<circle cx="46.5" cy="10.4" r="3" fill="#ff7fae"/>' +
      '<circle cx="45.4" cy="9.4" r="0.9" fill="#ffd6e5"/>'
    );
  }

  function propStrawberry() {
    return (
      '<path d="M48.6 19.7c-4.7-2.5-7.7-6.2-7.7-9.4 0-2.6 2-4.5 4.7-4.5 1.6 0 2.6.5 3 .8.4-.3 1.4-.8 3-.8 2.7 0 4.7 1.9 4.7 4.5 0 3.2-3 6.9-7.7 9.4z" fill="#f4566b"/>' +
      '<path d="M44.4 7.6c-1.4-.6-2.4-1.4-3-2.4 1.8-.3 3.4.2 4.6 1.4z" fill="#f88a99" opacity="0.8"/>' +
      '<ellipse cx="45.3" cy="10.2" rx="0.75" ry="1.05" fill="#ffe4ad"/>' +
      '<ellipse cx="51.9" cy="10.2" rx="0.75" ry="1.05" fill="#ffe4ad"/>' +
      '<ellipse cx="48.6" cy="13.2" rx="0.75" ry="1.05" fill="#ffe4ad"/>' +
      '<ellipse cx="46.1" cy="15.6" rx="0.65" ry="0.95" fill="#ffe4ad"/>' +
      '<ellipse cx="51.1" cy="15.6" rx="0.65" ry="0.95" fill="#ffe4ad"/>' +
      '<path d="M48.6 7.4c-1.8-1-4.4-3-5.4-4.6 2.6-.5 4.6.4 5.4 2.2z" fill="#6fae5f"/>' +
      '<path d="M48.6 7.4c1.8-1 4.4-3 5.4-4.6-2.6-.5-4.6.4-5.4 2.2z" fill="#6fae5f"/>' +
      '<path d="M48.6 7.6l-1.9-5.2h3.8z" fill="#5b9a4f"/>' +
      '<path d="M48.6 3.2c0-1.4.5-2.4 1.3-3.1" stroke="#5b9a4f" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
    );
  }

  function propClover() {
    return (
      '<circle cx="44.6" cy="6.4" r="3.4" fill="#74c06f"/>' +
      '<circle cx="52.4" cy="6.4" r="3.4" fill="#74c06f"/>' +
      '<circle cx="44.6" cy="12.8" r="3.4" fill="#74c06f"/>' +
      '<circle cx="52.4" cy="12.8" r="3.4" fill="#74c06f"/>' +
      '<path d="M45.4 5.4l1.9 1.5M51.6 5.4l-1.9 1.5M45.4 13.4l1.9-1.5M51.6 13.4l-1.9-1.5" stroke="#e9f8e6" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/>' +
      '<circle cx="48.5" cy="9.6" r="1.5" fill="#4f9750"/>' +
      '<path d="M48.5 14.9c.7 2.3.3 3.8-.6 4.9" stroke="#4f9750" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
    );
  }

  function propNightcap() {
    return (
      '<path d="M12.8 14.8C13 6.4 20.2 1.2 28.4 1.2c7.4 0 13.6 4 17 10 1 1.8 2.4 2.6 4 2.2l-.4 3h-36.2z" fill="#c9b8ee"/>' +
      '<path d="M14.8 11.4c1.8-5 7.8-8.2 14.4-8.2 4.8 0 9 1.8 11.6 4.8" stroke="#dccdf7" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.9"/>' +
      '<circle cx="39.6" cy="9.6" r="0.9" fill="#fff" opacity="0.55"/>' +
      '<circle cx="33" cy="6.2" r="0.75" fill="#fff" opacity="0.45"/>' +
      '<circle cx="50.4" cy="12.2" r="3.5" fill="#fffdf8" stroke="#e9dff6" stroke-width="0.8"/>' +
      '<circle cx="49.2" cy="10.9" r="1.1" fill="#f1e9ff"/>' +
      '<rect x="11.8" y="12.2" width="35.6" height="6" rx="3" fill="#fffdf8" stroke="#e9dff6" stroke-width="0.8"/>' +
      '<text x="3.2" y="11.8" font-size="10" font-weight="700" fill="#a3948a" font-family="-apple-system, BlinkMacSystemFont, sans-serif">Z</text>' +
      '<text x="10.6" y="5.4" font-size="6.8" font-weight="700" fill="#b7a99d" font-family="-apple-system, BlinkMacSystemFont, sans-serif">z</text>'
    );
  }

  function propZzz() {
    return '';
  }

  function propStarPin() {
    return (
      '<path d="' + starPath(48.4, 9.6, 6.2) + '" fill="#ffd766" stroke="#eeb43c" stroke-width="0.8" stroke-linejoin="round"/>' +
      '<path d="' + starPath(48.4, 9.6, 2.5) + '" fill="#fff3c4" opacity="0.9"/>' +
      '<circle cx="46.2" cy="7" r="0.75" fill="#fff8dd"/>'
    );
  }

  function propCrown() {
    return (
      '<path d="M21.2 14.2V6.4l5.4 3.5L32 3.6l5.4 6.3 5.4-3.5v7.8z" fill="#ffd24d" stroke="#e2a52e" stroke-width="0.9" stroke-linejoin="round"/>' +
      '<rect x="21.2" y="12.4" width="21.6" height="3.6" rx="1.8" fill="#ffc93c" stroke="#e2a52e" stroke-width="0.8"/>' +
      '<circle cx="32" cy="14.2" r="1.3" fill="#f4566b"/>' +
      '<circle cx="26" cy="14.2" r="1" fill="#6cb6ff"/>' +
      '<circle cx="38" cy="14.2" r="1" fill="#7bd389"/>' +
      '<path d="' + sparklePath(14.6, 6.8, 2.6) + '" fill="#ffe08a"/>' +
      '<path d="' + sparklePath(49.8, 4.4, 2) + '" fill="#ffe08a" opacity="0.9"/>'
    );
  }

  function propSparkles(color, soft) {
    return (
      '<path d="' + sparklePath(12.2, 7.4, 3.1) + '" fill="' + color + '"/>' +
      '<path d="' + sparklePath(56, 5.8, 2.2) + '" fill="' + color + '" opacity="' + (soft || 0.9) + '"/>' +
      '<path d="' + sparklePath(8.8, 24.4, 1.7) + '" fill="' + color + '" opacity="0.7"/>'
    );
  }

  /* a soft rainbow arching over the legendary capybara */
  function rainbowArch() {
    var bands = ['#ff8f8f', '#ffb46e', '#ffe27a', '#8fd98a', '#8bc7ff', '#bda6ff'];
    var out = '';
    for (var i = 0; i < bands.length; i++) {
      var r = 19.6 - i * 2.1;
      out +=
        '<path d="M' + num(32 - r) + ' 21A' + num(r) + ' ' + num(r) + ' 0 0 1 ' + num(32 + r) + ' 21" ' +
        'fill="none" stroke="' + bands[i] + '" stroke-width="2.2"/>';
    }
    return out;
  }

  var SKIN_ART = {
    default: function (p) {
      return capyBody(p) + capyCheeks(p) + capyNose(p) + mouthSmile(p) + eyesRound(p) + propTangerine();
    },
    onsen: function (p) {
      return capyBody(p) + capyCheeks(p, 0.9) + capyNose(p) + mouthOpen(p) + eyesHappy(p) + propOnsenTowel();
    },
    ribbon: function (p) {
      return capyBody(p) + capyCheeks(p) + capyNose(p) + mouthSweet(p) + eyesSparkle(p) + propRibbon() +
        '<path d="' + sparklePath(57.4, 13.4, 2) + '" fill="#ffd0e0"/>';
    },
    strawberry: function (p) {
      return capyBody(p) + capyCheeks(p, 0.85) + capyNose(p) + mouthSweet(p) + eyesRound(p) + propStrawberry();
    },
    perfect: function (p) {
      return capyBody(p) + capyCheeks(p) + capyNose(p) + mouthSmirk(p) + eyesShades();
    },
    clover: function (p) {
      return capyBody(p) + capyCheeks(p, 0.85) + capyNose(p) + mouthOpen(p) + eyesWink(p) + propClover() +
        '<path d="' + sparklePath(13, 5.6, 2.4) + '" fill="#ffe9a8"/>';
    },
    sleepy: function (p) {
      return capyBody(p) + capyCheeks(p, 0.85) + capyNose(p) + mouthSweet(p) + eyesSleepy(p) + propNightcap();
    },
    star: function (p) {
      return capyBody(p) + capyCheeks(p, 0.8) + capyNose(p) + mouthSweet(p) + eyesTwinkle(p) + propStarPin() +
        propSparkles('#ffe9a8', 0.85);
    },
    crown: function (p) {
      return capyBody(p) + capyCheeks(p) + capyNose(p) + mouthSmirk(p) + eyesProud(p) + propCrown();
    },
    rainbow: function (p) {
      return rainbowArch() + capyBody(p) + capyCheeks(p, 0.95) + capyNose(p) + mouthOpen(p) + eyesSparkle(p) +
        propSparkles('#fff3c8', 0.95);
    }
  };

  var SKIN_PALETTE_OF = { default: 'warm', onsen: 'warm', ribbon: 'warm', strawberry: 'warm', perfect: 'warm', clover: 'warm', sleepy: 'warm', star: 'night', crown: 'sun', rainbow: 'cream' };

  function skinSvg(key) {
    var draw = SKIN_ART[key] || SKIN_ART.default;
    var p = SKIN_PALETTES[SKIN_PALETTE_OF[key]] || SKIN_PALETTES.warm;
    return (
      '<svg class="capi" data-skin="' + (SKIN_ART[key] ? key : 'default') + '" viewBox="0 0 64 64" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + draw(p) + '</svg>'
    );
  }

  /* the silhouette shown on a card that is still locked */
  function lockedSkinSvg() {
    var p = { fur: '#cec2b6', ear: '#b3a597', earIn: '#dcd2c7', muzzle: '#e9e0d6', nose: '#9b8d7d', eye: '#9b8d7d', cheek: '#d6ccc2' };
    return (
      '<svg class="capi capi-locked" data-skin="locked" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      capyBody(p) +
      capyNose(p) +
      '<path d="M26.9 41.2c0-3.2 2.4-5.6 5.3-5.6 2.9 0 5.1 2.2 5.1 5 0 2.5-2 3.4-3.7 4.5-1.1.7-1.8 1.5-1.8 2.6" ' +
      'stroke="#8e8070" stroke-width="2.7" fill="none" stroke-linecap="round"/>' +
      '<circle cx="32" cy="51" r="2" fill="#8e8070"/>' +
      '</svg>'
    );
  }

  /* ------------------------------------------------ 도감 해금 조건 */
  function dailyDays(s) {
    var seen = {};
    Object.keys(s.dailyDone || {}).forEach(function (k) {
      if (s.dailyDone[k]) seen[k.split(':')[0]] = true;
    });
    return Object.keys(seen).length;
  }

  function sizeClears(s, size) {
    return Math.max(0, Number((s.sizeClears || {})[String(size)]) || 0);
  }

  function hardClears(s) {
    var total = 0;
    Object.keys(s.sizeClears || {}).forEach(function (k) {
      if (Number(k) >= 7) total += Math.max(0, Number(s.sizeClears[k]) || 0);
    });
    return total;
  }

  function otherUnlocked(s) {
    var list = (s.skins && s.skins.unlocked) || [];
    return list.filter(function (k) {
      return k !== 'rainbow';
    }).length;
  }

  var SKIN_LIST = [
    { key: 'default', name: '기본 귤 카피바라', cond: '처음부터 함께해요', need: 1, unit: '', progress: function () { return { have: 1, need: 1 }; } },
    { key: 'onsen', name: '수건 온천 카피바라', cond: '누적 3판 클리어', need: 3, unit: '판', progress: function (s) { return { have: s.cleared || 0, need: 3 }; } },
    { key: 'ribbon', name: '핑크 리본 카피바라', cond: '누적 6판 클리어', need: 6, unit: '판', progress: function (s) { return { have: s.cleared || 0, need: 6 }; } },
    { key: 'strawberry', name: '딸기 카피바라', cond: '누적 10판 클리어', need: 10, unit: '판', progress: function (s) { return { have: s.cleared || 0, need: 10 }; } },
    { key: 'perfect', name: '선글라스 쿨바라', cond: '실수 없이 1판 클리어', need: 1, unit: '판', progress: function (s) { return { have: s.perfectClears || 0, need: 1 }; } },
    { key: 'clover', name: '네잎클로버 카피바라', cond: '오늘의 퍼즐 3일 클리어', need: 3, unit: '일', progress: function (s) { return { have: dailyDays(s), need: 3 }; } },
    { key: 'sleepy', name: '꿀잠 수면모자 카피바라', cond: '한 판 10분 넘게 집중해 클리어', need: 1, unit: '판', progress: function (s) { return { have: s.longClears || 0, need: 1 }; } },
    { key: 'star', name: '별빛 마법 카피바라', cond: '누적 25판 클리어', need: 25, unit: '판', progress: function (s) { return { have: s.cleared || 0, need: 25 }; } },
    { key: 'crown', name: '왕관 마스터바라', cond: '어려운 레벨(7×7 이상) 3판 클리어', need: 3, unit: '판', progress: function (s) { return { have: hardClears(s), need: 3 }; } },
    { key: 'rainbow', name: '무지개 전설 카피바라', cond: '카피바라 9종을 모두 모으면', need: 9, unit: '종', progress: function (s) { return { have: Math.min(9, otherUnlocked(s)), need: 9 }; } }
  ];
  /* SKINS:SOURCE:END */

  var SVG_CACHE = {};
  var LOCKED_SVG = '';

  function skinSvgCached(key) {
    if (!SVG_CACHE[key]) SVG_CACHE[key] = skinSvg(key);
    return SVG_CACHE[key];
  }

  function lockedSvgCached() {
    if (!LOCKED_SVG) LOCKED_SVG = lockedSkinSvg();
    return LOCKED_SVG;
  }

  function skinByKey(key) {
    for (var i = 0; i < SKIN_LIST.length; i++) if (SKIN_LIST[i].key === key) return SKIN_LIST[i];
    return SKIN_LIST[0];
  }

  var X_SVG = '<svg class="xmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var X_SVG_AUTO = '<svg class="xmark auto" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

  /* 🎉 win burst — colourful confetti popping out around the finished board */
  var PARTY_COLORS = ['#ff8a5b', '#ffd166', '#7bd389', '#6cb6ff', '#ff9ecb', '#b79bff'];

  var KEY = {
    settings: 'capydoku.settings.v1',
    stats: 'capydoku.stats.v1',
    progress: 'capydoku.progress.v1'
  };
  var DEFAULT_SETTINGS = {
    theme: 'auto',
    colorblind: false,
    autoX: false,
    mode: 'auto',
    difficulty: 'easy',
    group: 'easy',
    prefsVersion: 2
  };
  var DEFAULT_STATS = {
    cleared: 0, best: {}, streak: 0, lastDaily: null, dailyDone: {},
    perfectClears: 0, longClears: 0, sizeClears: {},
    skins: { unlocked: ['default'], active: 'default' }
  };

  var el = {};
  var storedSettings = readJSON(KEY.settings, {});
  if (!storedSettings || typeof storedSettings !== 'object') storedSettings = {};
  if (storedSettings.prefsVersion !== DEFAULT_SETTINGS.prefsVersion) {
    /* v3: the faint auto ✕ hint is off by default now, so a value saved while
       the old default was on (true) is dropped as well — otherwise an already
       open browser keeps drawing the hints. The settings switch opts back in. */
    storedSettings.autoX = false;
    storedSettings.prefsVersion = DEFAULT_SETTINGS.prefsVersion;
    writeJSON(KEY.settings, storedSettings);
  }
  var settings = merge(DEFAULT_SETTINGS, storedSettings);
  var stats = merge(DEFAULT_STATS, readJSON(KEY.stats, {}));
  normalizeStats();

  var state = null;
  var blocked = null;
  var cellEls = [];
  /* cells whose auto ✕ was dismissed by the player; cleared whenever the
     placed capybaras change, since the hint is then about something else */
  var mutedHints = Object.create(null);
  var lastCapySig = '';
  var timerHandle = null;
  var toastHandle = null;
  var saveHandle = null;
  var activeSheet = null;
  var pendingConfirm = null;
  var newSkinKeys = [];
  var drag = null;
  /* 자동 순환: a second tap inside this window on the same cell is a double
     tap (capybara attempt), anything later is a fresh single tap */
  var DOUBLE_TAP_MS = 350;
  var lastTap = null;

  // ------------------------------------------------------------ small utils

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = base[k];
    });
    Object.keys(extra || {}).forEach(function (k) {
      out[k] = extra[k];
    });
    return out;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode or full storage — keep playing */
    }
  }

  /* saved stats from older versions only hold the basics; fill in what the
     도감 needs without losing anything the player already earned */
  function normalizeStats() {
    if (typeof stats.cleared !== 'number') stats.cleared = 0;
    if (!stats.best || typeof stats.best !== 'object') stats.best = {};
    if (!stats.dailyDone || typeof stats.dailyDone !== 'object') stats.dailyDone = {};
    if (typeof stats.perfectClears !== 'number') stats.perfectClears = 0;
    if (typeof stats.longClears !== 'number') stats.longClears = 0;
    if (!stats.sizeClears || typeof stats.sizeClears !== 'object') {
      stats.sizeClears = {};
      /* a level with a best time was cleared at least once */
      Object.keys(stats.best).forEach(function (k) {
        var diff = E.difficultyByKey(k);
        if (diff && diff.key === k) stats.sizeClears[String(diff.size)] = 1;
      });
    }
    var skins = stats.skins && typeof stats.skins === 'object' ? stats.skins : {};
    if (!Array.isArray(skins.unlocked)) skins.unlocked = ['default'];
    if (skins.unlocked.indexOf('default') === -1) skins.unlocked.unshift('default');
    skins.unlocked = skins.unlocked.filter(function (k, i, arr) {
      return !!SKIN_ART[k] && arr.indexOf(k) === i;
    });
    if (typeof skins.active !== 'string' || skins.unlocked.indexOf(skins.active) === -1) skins.active = 'default';
    stats.skins = skins;
    writeJSON(KEY.stats, stats);
  }

  function todayKey() {
    return E.dateKeySeoul(new Date());
  }

  function formatTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function puzzleRef() {
    return { size: state.size, regions: state.regions };
  }

  function capybaras() {
    var out = [];
    for (var i = 0; i < state.board.length; i++) if (state.board[i] === 2) out.push(i);
    return out;
  }

  function isSolutionCell(index) {
    return state.solution[E.rowOf(state.size, index)] === E.colOf(state.size, index);
  }

  function hasProgress() {
    return !!state && !state.solved && state.board.some(function (v) {
      return v !== 0;
    });
  }

  // ------------------------------------------------------------------ theme

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveDark() {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    return prefersDark();
  }

  function applyTheme() {
    var dark = effectiveDark();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#171310' : '#fdf6ee');
    el.btnTheme.textContent = dark ? '☀️' : '🌙';
    el.btnTheme.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
    if (el.setDark) el.setDark.checked = dark;
  }

  // ------------------------------------------------------------- puzzle flow

  function newSeed(diffKey) {
    return 'random-' + diffKey + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function startPuzzle(diffKey, daily, options) {
    options = options || {};
    lastTap = null;
    var diff = E.difficultyByKey(diffKey || settings.difficulty);
    var dateKey = todayKey();
    var seed = options.seed || (daily ? 'daily-' + dateKey + '-' + diff.key : newSeed(diff.key));

    var puzzle;
    if (options.puzzle) {
      puzzle = options.puzzle;
    } else {
      try {
        puzzle = E.generatePuzzle(diff.size, seed);
      } catch (err) {
        toast('퍼즐을 만드는 데 문제가 생겼어요. 다시 시도해 주세요.');
        return;
      }
    }

    settings.difficulty = diff.key;
    settings.group = diff.group;
    writeJSON(KEY.settings, settings);

    state = {
      difficulty: diff.key,
      size: puzzle.size,
      regions: puzzle.regions,
      solution: puzzle.solution,
      seed: seed,
      daily: !!daily,
      dailyKey: daily ? dateKey : null,
      board: options.board ? options.board.slice() : new Array(puzzle.size * puzzle.size).fill(0),
      seeds: typeof options.seeds === 'number' ? options.seeds : 3,
      lost: typeof options.lost === 'number' ? options.lost : 0,
      hints: options.hints || 0,
      elapsedMs: options.elapsedMs || 0,
      runningSince: null,
      history: [],
      solved: !!options.solved
    };

    hideWinBanner();
    buildBoard();
    recomputeBlocked();
    renderAll();
    sizeBoard();

    if (state.solved) {
      showWinBanner(elapsed());
    } else {
      startTimer();
    }
    saveProgressNow();
    updateDailyBadge();
  }

  function restartPuzzle() {
    if (!state) return;
    var keepDaily = state.daily;
    startPuzzle(state.difficulty, keepDaily, keepDaily ? {} : { seed: state.seed });
  }

  function elapsed() {
    if (!state) return 0;
    return state.elapsedMs + (state.runningSince ? Date.now() - state.runningSince : 0);
  }

  function startTimer() {
    if (!state || state.solved) return;
    if (!state.runningSince) state.runningSince = Date.now();
    if (!timerHandle) {
      timerHandle = setInterval(function () {
        if (state && !state.solved) el.timer.textContent = formatTime(elapsed());
      }, 500);
    }
    el.timer.textContent = formatTime(elapsed());
  }

  function pauseTimer() {
    if (!state) return;
    if (state.runningSince) {
      state.elapsedMs += Date.now() - state.runningSince;
      state.runningSince = null;
    }
    el.timer.textContent = formatTime(elapsed());
  }

  // ------------------------------------------------------------------ board

  function buildBoard() {
    var n = state.size;
    el.board.style.setProperty('--n', n);
    el.board.classList.toggle('cb', !!settings.colorblind);
    el.board.innerHTML = '';
    cellEls = [];
    var frag = document.createDocumentFragment();

    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n);
      var c = i % n;
      var cell = document.createElement('div');
      cell.className = 'cell r' + state.regions[i];
      cell.dataset.i = String(i);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', (r + 1) + '행 ' + (c + 1) + '열');
      if (r === 0 || state.regions[i - n] !== state.regions[i]) cell.classList.add('edge-t');
      if (c === 0 || state.regions[i - 1] !== state.regions[i]) cell.classList.add('edge-l');
      if (c === n - 1) cell.classList.add('edge-r');
      if (r === n - 1) cell.classList.add('edge-b');
      frag.appendChild(cell);
      cellEls.push(cell);
    }
    el.board.appendChild(frag);
  }

  function recomputeBlocked() {
    var capy = capybaras();
    var sig = capy.join(',');
    if (sig !== lastCapySig) {
      lastCapySig = sig;
      mutedHints = Object.create(null);
    }
    blocked = E.blockedCells(puzzleRef(), capy);
  }

  function muteHint(index) {
    if (blocked && blocked[index]) mutedHints[index] = true;
  }

  function renderBoard() {
    var capyHtml = skinSvgCached(stats.skins.active);
    for (var i = 0; i < cellEls.length; i++) {
      var v = state.board[i];
      var html = '';
      if (v === 2) html = capyHtml;
      else if (v === 1) html = X_SVG;
      else if (settings.autoX && blocked[i] && !mutedHints[i]) html = X_SVG_AUTO;
      var cell = cellEls[i];
      if (cell.__html !== html) {
        cell.innerHTML = html;
        cell.__html = html;
      }
      cell.classList.toggle('filled', v === 2);
      cell.classList.toggle('marked', v === 1);
    }
  }

  function renderSeeds(popIndex) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      out += '<span class="seed' + (i >= state.seeds ? ' spent' : '') + (popIndex === i ? ' pop' : '') + '">🍊</span>';
    }
    el.seeds.innerHTML = out;
  }

  function renderStatus() {
    renderSeeds();
    el.timer.textContent = formatTime(elapsed());
    var left = state.size - capybaras().length;
    el.remain.textContent = state.size + '×' + state.size + ' · ' + Math.max(0, left) + ' 남음';
  }

  function renderDifficulty() {
    var activeGroup = settings.group || 'easy';
    $$('.level-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.group === activeGroup);
    });
    var list = E.DIFFICULTIES.filter(function (d) {
      return d.group === activeGroup;
    });
    el.diffs.style.setProperty('--cols', list.length);
    el.diffs.innerHTML = list
      .map(function (d) {
        var active = state && state.difficulty === d.key ? ' active' : '';
        return (
          '<button class="diff' + active + '" type="button" data-diff="' + d.key + '">' +
          '<b>' + d.label + '</b><span>' + d.size + '×' + d.size + '</span></button>'
        );
      })
      .join('');
  }

  function renderModes() {
    $$('.mode').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === settings.mode);
    });
  }

  function renderAll() {
    renderStatus();
    renderBoard();
    renderModes();
    renderDifficulty();
  }

  // ------------------------------------------------------------ move handling

  function pushHistory(items) {
    if (!items || !items.length) return;
    state.history.push({ type: 'cells', items: items });
    if (state.history.length > 400) state.history.shift();
  }

  function setCell(index, value) {
    var from = state.board[index];
    if (from === value) return;
    state.board[index] = value;
    pushHistory([{ i: index, from: from, to: value }]);
  }

  function markCell(index) {
    if (state.board[index] !== 0) return null;
    state.board[index] = 1;
    return { i: index, from: 0, to: 1 };
  }

  /* a memo drag paints ✕ across empty cells, or erases ✕ across marked ones
     depending on the cell the gesture started on */
  function dragCell(index) {
    if (drag && drag.erasing) {
      if (state.board[index] !== 1) return null;
      state.board[index] = 0;
      muteHint(index);
      return { i: index, from: 1, to: 0 };
    }
    return markCell(index);
  }

  function afterChange() {
    recomputeBlocked();
    renderStatus();
    renderBoard();
    saveProgress();
  }

  function tapCell(index) {
    if (!state || state.solved) {
      if (state && state.solved) toast('이미 완성한 퍼즐이에요. 새 퍼즐을 시작해 보세요!');
      return;
    }
    if (settings.mode === 'place') return handlePlace(index);
    if (settings.mode === 'memo') return toggleMemo(index);
    return autoTap(index);
  }

  /* 자동 순환: one tap on an empty cell marks it ✕, one tap on ✕ erases the
     mark (no tangerine), and a quick double tap — on an empty cell or on ✕ —
     is a capybara attempt. A wrong attempt costs a tangerine and the cell is
     left empty. One tap on a placed capybara removes it. */
  function autoTap(index) {
    var now = Date.now();
    var value = state.board[index];
    var quick = !!lastTap && lastTap.index === index && now - lastTap.time < DOUBLE_TAP_MS;

    if (value === 2) {
      lastTap = null;
      setCell(index, 0);
      afterChange();
      return;
    }

    if (quick) {
      /* the second tap of a double tap is a capybara attempt. A wrong attempt
         must leave the cell empty, so any ✕ the first tap left is cleared. */
      lastTap = null;
      if (value === 1 && !isSolutionCell(index)) {
        setCell(index, 0);
        muteHint(index);
        afterChange();
      }
      handlePlace(index);
      return;
    }

    lastTap = { index: index, time: now };
    if (value === 0) {
      setCell(index, 1);
    } else {
      setCell(index, 0);
      muteHint(index);
    }
    afterChange();
  }

  function toggleMemo(index) {
    if (state.board[index] === 0) {
      setCell(index, 1);
    } else if (state.board[index] === 1) {
      setCell(index, 0);
      muteHint(index);
    } else {
      setCell(index, 0);
    }
    afterChange();
  }

  function handlePlace(index) {
    if (state.solved) return;
    var current = state.board[index];
    if (current === 2) {
      setCell(index, 0);
      afterChange();
      return;
    }
    if (isSolutionCell(index)) {
      setCell(index, 2);
      afterChange();
      checkWin();
    } else {
      mistake(index);
    }
  }

  function mistakeReason(index, conflicts) {
    if (!conflicts.length) return '이 칸엔 카피바라가 없어요';
    var size = state.size;
    var r = E.rowOf(size, index);
    var c = E.colOf(size, index);
    var rid = state.regions[index];
    var touching = false;
    var line = false;
    var region = false;
    for (var k = 0; k < conflicts.length; k++) {
      var o = conflicts[k];
      var orow = E.rowOf(size, o);
      var ocol = E.colOf(size, o);
      if (orow === r || ocol === c) line = true;
      if (state.regions[o] === rid) region = true;
      if (orow !== r && ocol !== c && Math.abs(orow - r) <= 1 && Math.abs(ocol - c) <= 1) touching = true;
    }
    if (touching) return '너무 가까워요! 대각선도 안 돼요';
    if (line) return '같은 줄에 이미 카피바라가 있어요';
    if (region) return '같은 구역에 이미 카피바라가 있어요';
    return '이 칸엔 카피바라가 없어요';
  }

  function mistake(index) {
    state.seeds = Math.max(0, state.seeds - 1);
    state.lost = (state.lost || 0) + 1;
    var conflicts = E.conflictingCells(puzzleRef(), capybaras(), index);
    var message = mistakeReason(index, conflicts);

    renderStatus();
    renderSeeds(state.seeds);
    var cell = cellEls[index];
    cell.classList.add('wrong');
    setTimeout(function () {
      cell.classList.remove('wrong');
    }, 620);
    conflicts.forEach(function (c) {
      var target = cellEls[c];
      if (!target) return;
      target.classList.add('conflict');
      setTimeout(function () {
        target.classList.remove('conflict');
      }, 960);
    });

    toast(message + ' 🍊 -1');
    vibrate(state.seeds === 0 ? [20, 60, 20] : 20);
    saveProgress();

    if (state.seeds === 0) {
      setTimeout(function () {
        if (state && state.seeds === 0 && !state.solved) openSheet('sheetSeeds');
      }, 760);
    }
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* ignore */
    }
  }

  function checkWin() {
    if (E.isSolved(state.regions, state.size, capybaras())) finishPuzzle();
  }

  function finishPuzzle() {
    if (!state || state.solved) return;
    pauseTimer();
    state.solved = true;
    var time = elapsed();

    stats.cleared = (stats.cleared || 0) + 1;
    if (!state.lost) stats.perfectClears = (stats.perfectClears || 0) + 1;
    if (time >= 10 * 60 * 1000) stats.longClears = (stats.longClears || 0) + 1;
    var sizeKey = String(state.size);
    stats.sizeClears[sizeKey] = (Number(stats.sizeClears[sizeKey]) || 0) + 1;
    var prevBest = stats.best[state.difficulty];
    if (!prevBest || time < prevBest) stats.best[state.difficulty] = time;

    var streakLine = '–';
    if (state.daily) {
      var today = todayKey();
      var yesterday = E.dateKeySeoul(new Date(Date.now() - 86400000));
      if (stats.lastDaily !== today) {
        stats.streak = stats.lastDaily === yesterday ? (stats.streak || 0) + 1 : 1;
        stats.lastDaily = today;
      }
      stats.dailyDone[today + ':' + state.difficulty] = true;
      streakLine = '🔥 ' + (stats.streak || 1) + '일';
    } else if (stats.streak) {
      streakLine = '🔥 ' + stats.streak + '일';
    }

    writeJSON(KEY.stats, stats);
    var freshSkins = evaluateUnlocks();
    updateDailyBadge();
    saveProgressNow();

    el.winTime.textContent = formatTime(time);
    el.winBest.textContent = formatTime(stats.best[state.difficulty]);
    el.winStreak.textContent = streakLine;
    el.winSub.textContent = state.daily
      ? '오늘의 퍼즐을 풀었어요. 카피바라가 귤을 찾았어요 🍊'
      : '카피바라가 귤을 찾았어요 🍊';
    showWinUnlocks(freshSkins);
    openSheet('sheetWin');
    partyBurst();
    vibrate([12, 40, 12, 40, 24]);
  }

  /* Confetti pops outward around the board square (🎉, not tangerines falling
     from the sky). It is a short, pointer-transparent layer above the scrim and
     below the win sheet, removed as soon as the pieces have landed. */
  function partyBurst() {
    if (!el.board || !el.overlay) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var previous = document.querySelector('.party');
    if (previous) previous.remove();

    var rect = el.board.getBoundingClientRect();
    if (!rect.width) return;
    var layer = document.createElement('div');
    layer.className = 'party';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.left = rect.left + 'px';
    layer.style.top = rect.top + 'px';
    layer.style.width = rect.width + 'px';
    layer.style.height = rect.height + 'px';

    var count = 46;
    var reach = Math.max(110, rect.width * 0.52);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var piece = document.createElement('i');
      var sparkle = i === 5 || i === 17 || i === 29 || i === 41;
      /* a fountain around the square: most pieces arc up and out over the
         board, the rest shoot sideways, none of them drop from the sky */
      var angle;
      if (i < 32) {
        angle = -Math.PI * (0.05 + (0.9 * i) / 32) + (Math.random() - 0.5) * 0.16;
      } else {
        angle = (i % 2 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7;
      }
      var distance = reach * (0.72 + Math.random() * 0.62);
      if (sparkle) {
        piece.className = 'party-bit sparkle';
        piece.textContent = '✦';
        piece.style.color = i % 2 ? '#ffe08a' : '#ff9ecb';
        piece.style.fontSize = 15 + Math.random() * 7 + 'px';
      } else {
        piece.className = 'party-bit' + (i % 3 === 0 ? ' round' : '');
        piece.style.background = PARTY_COLORS[i % PARTY_COLORS.length];
        piece.style.width = 5 + Math.random() * 6 + 'px';
        piece.style.height = 8 + Math.random() * 6 + 'px';
      }
      piece.style.setProperty('--dx', Math.round(Math.cos(angle) * distance) + 'px');
      piece.style.setProperty('--dy', Math.round(Math.sin(angle) * distance) + 'px');
      piece.style.setProperty('--rot', Math.round(Math.random() * 620 - 310) + 'deg');
      piece.style.animationDelay = (Math.random() * 0.22).toFixed(2) + 's';
      piece.style.animationDuration = (1.05 + Math.random() * 0.45).toFixed(2) + 's';
      frag.appendChild(piece);
    }
    layer.appendChild(frag);

    /* under the sheets so the modal text and buttons stay crisp */
    var sheet = el.overlay.querySelector('.sheet');
    if (sheet) el.overlay.insertBefore(layer, sheet);
    else el.overlay.appendChild(layer);

    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, 1900);
  }

  function undo() {
    if (!state || !state.history.length) {
      toast('되돌릴 동작이 없어요');
      return;
    }
    var entry = state.history.pop();
    var items = entry.items || [];
    for (var i = 0; i < items.length; i++) state.board[items[i].i] = items[i].from;
    state.solved = false;
    lastTap = null;
    hideWinBanner();
    afterChange();
  }

  function hint() {
    if (!state || state.solved) return;
    var options = [];
    for (var r = 0; r < state.size; r++) {
      var idx = r * state.size + state.solution[r];
      if (state.board[idx] !== 2) options.push(idx);
    }
    if (!options.length) return;
    var pick = options[Math.floor(Math.random() * options.length)];
    var from = state.board[pick];
    state.board[pick] = 2;
    state.hints += 1;
    lastTap = null;
    pushHistory([{ i: pick, from: from, to: 2 }]);
    afterChange();
    var cell = cellEls[pick];
    if (cell) {
      cell.classList.add('hinted');
      setTimeout(function () {
        cell.classList.remove('hinted');
      }, 1100);
    }
    toast('💡 ' + (E.rowOf(state.size, pick) + 1) + '행 ' + (E.colOf(state.size, pick) + 1) + '열 — 여기엔 카피바라가 살아요');
    checkWin();
  }

  // ------------------------------------------------------------------ toast

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2100);
  }

  // ----------------------------------------------------------------- sheets

  function openSheet(id) {
    el.overlay.hidden = false;
    $$('.sheet').forEach(function (sheet) {
      sheet.hidden = sheet.id !== id;
    });
    activeSheet = id;
    if (state && !state.solved) pauseTimer();
    var sheet = document.getElementById(id);
    if (sheet) sheet.scrollTop = 0;
  }

  function closeSheet() {
    el.overlay.hidden = true;
    $$('.sheet').forEach(function (sheet) {
      sheet.hidden = true;
    });
    activeSheet = null;
    pendingConfirm = null;
    if (state && !state.solved && !document.hidden) startTimer();
    saveProgress();
  }

  function askConfirm(title, sub, action) {
    el.restartTitle.textContent = title;
    el.restartSub.textContent = sub;
    pendingConfirm = action;
    openSheet('sheetRestart');
  }

  // -------------------------------------------------------------- statistics

  function updateDailyBadge() {
    var today = todayKey();
    var done = stats.dailyDone[today + ':' + settings.difficulty];
    if (done) {
      el.dailyBadge.hidden = false;
      el.dailyBadge.textContent = '완료';
    } else if (stats.streak) {
      el.dailyBadge.hidden = false;
      el.dailyBadge.textContent = stats.streak + '일';
    } else {
      el.dailyBadge.hidden = true;
    }
  }

  // ---------------------------------------------------------------- 도감

  function isUnlocked(key) {
    return stats.skins.unlocked.indexOf(key) !== -1;
  }

  function unlockedCount() {
    return stats.skins.unlocked.length;
  }

  /* grant every skin whose condition the saved stats already meet; returns
     only the ones that are new this time so the win sheet can celebrate */
  function evaluateUnlocks() {
    var added = [];
    SKIN_LIST.forEach(function (skin) {
      if (isUnlocked(skin.key)) return;
      var p = skin.progress(stats);
      if (p.have >= p.need) {
        stats.skins.unlocked.push(skin.key);
        added.push(skin.key);
      }
    });
    if (added.length) writeJSON(KEY.stats, stats);
    updateCollectionBadge();
    return added;
  }

  function equipSkin(key) {
    if (!isUnlocked(key)) return false;
    stats.skins.active = key;
    writeJSON(KEY.stats, stats);
    applySkin();
    renderCollection();
    return true;
  }

  /* the equipped capybara is used on the board, the brand badge, the 카피바라
     mode button and the win sheet */
  function applySkin() {
    var svg = skinSvgCached(stats.skins.active);
    el.brandBadge.innerHTML = svg;
    el.winCapi.innerHTML = svg;
    var placeMode = $('.mode[data-mode="place"]');
    if (placeMode) placeMode.innerHTML = '<span class="mode-capi">' + svg + '</span>카피바라';
    if (state) renderBoard();
    updateCollectionBadge();
  }

  function updateCollectionBadge() {
    if (!el.btnCollection || !el.collectionCount) return;
    el.collectionCount.textContent = unlockedCount() + '/' + SKIN_LIST.length;
    el.btnCollection.setAttribute('aria-label', '카피바라 도감 ' + unlockedCount() + ' / ' + SKIN_LIST.length);
    el.btnCollection.classList.toggle('has-new', newSkinKeys.length > 0);
  }

  function renderCollection() {
    if (!el.collectGrid) return;
    var total = SKIN_LIST.length;
    var have = unlockedCount();
    el.collectSummary.innerHTML = '수집 현황 <b>' + have + ' / ' + total + '</b> · 누적 클리어 ' + (stats.cleared || 0) + '판';
    el.collectBarFill.style.width = Math.round((have / total) * 100) + '%';
    el.collectBar.setAttribute('aria-valuemax', String(total));
    el.collectBar.setAttribute('aria-valuenow', String(have));

    el.collectGrid.innerHTML = SKIN_LIST.map(function (skin) {
      var unlocked = isUnlocked(skin.key);
      var active = stats.skins.active === skin.key;
      var fresh = newSkinKeys.indexOf(skin.key) !== -1;
      var p = skin.progress(stats);
      var ratio = p.need ? Math.min(1, p.have / p.need) : 0;
      var cls = 'skin-card ' + (unlocked ? 'is-unlocked' : 'is-locked') + (active ? ' is-active' : '');
      var label = unlocked
        ? skin.name + (active ? ' 사용 중' : ' 장착하기')
        : skin.name + ' 잠김, ' + skin.cond;
      var foot = unlocked
        ? '<span class="skin-state">' + (active ? '사용 중' : '장착') + '</span>'
        : '<span class="skin-bar"><i style="width:' + Math.round(ratio * 100) + '%"></i></span>' +
          '<span class="skin-count">' + Math.min(p.have, p.need) + ' / ' + p.need + (skin.unit || '') + '</span>';
      return (
        '<button class="' + cls + '" type="button" data-skin="' + skin.key + '"' +
        (unlocked ? '' : ' disabled') + ' aria-label="' + label + '"' +
        (unlocked ? ' aria-pressed="' + (active ? 'true' : 'false') + '"' : '') + '>' +
        '<span class="skin-art">' + (unlocked ? skinSvgCached(skin.key) : lockedSvgCached()) +
        (fresh ? '<span class="skin-new">NEW</span>' : '') + '</span>' +
        '<b class="skin-name">' + skin.name + '</b>' +
        '<span class="skin-cond">' + (unlocked ? skin.cond + ' ✓' : skin.cond) + '</span>' +
        '<span class="skin-foot">' + foot + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function showWinUnlocks(keys) {
    if (!keys || !keys.length) {
      el.winUnlock.hidden = true;
      el.unlockList.innerHTML = '';
      return;
    }
    newSkinKeys = keys.slice();
    el.unlockList.innerHTML = keys.map(function (key) {
      var skin = skinByKey(key);
      return '<span class="unlock-item"><i class="unlock-art">' + skinSvgCached(key) + '</i><b>' + skin.name + '</b></span>';
    }).join('');
    el.winUnlock.hidden = false;
    updateCollectionBadge();
  }

  function useNewSkin() {
    var key = newSkinKeys[0];
    if (!key) return;
    newSkinKeys = [];
    closeSheet();
    if (equipSkin(key)) toast('🎉 ' + skinByKey(key).name + ' 장착!');
    updateCollectionBadge();
  }

  function renderSettings() {
    el.setCb.checked = !!settings.colorblind;
    el.setAutoX.checked = !!settings.autoX;
    applyTheme();
    el.statCleared.textContent = String(stats.cleared || 0);
    el.statStreak.textContent = String(stats.streak || 0);
    var bests = Object.keys(stats.best || {})
      .filter(function (k) {
        return typeof stats.best[k] === 'number';
      })
      .sort(function (a, b) {
        return stats.best[a] - stats.best[b];
      });
    if (bests.length) {
      var key = bests[0];
      var label = E.difficultyByKey(key).label;
      el.statBest.textContent = formatTime(stats.best[key]);
      el.bestNote.innerHTML = bests
        .map(function (k) {
          return E.difficultyByKey(k).label + ' ' + formatTime(stats.best[k]);
        })
        .join(' · ');
      el.bestNote.dataset.lead = label;
    } else {
      el.statBest.textContent = '–';
      el.bestNote.textContent = '난이도별 최고 기록은 퍼즐을 완성하면 쌓여요.';
    }
  }

  // -------------------------------------------------------------- persistence

  function saveProgressNow() {
    if (!state) return;
    writeJSON(KEY.progress, {
      v: 1,
      difficulty: state.difficulty,
      size: state.size,
      seed: state.seed,
      daily: state.daily,
      dailyKey: state.dailyKey,
      r: E.encodeRegions(state.regions),
      s: E.encodeSolution(state.solution),
      board: state.board,
      seeds: state.seeds,
      lost: state.lost || 0,
      hints: state.hints,
      elapsedMs: elapsed(),
      solved: state.solved,
      mode: settings.mode,
      savedAt: Date.now()
    });
  }

  function saveProgress() {
    clearTimeout(saveHandle);
    saveHandle = setTimeout(saveProgressNow, 350);
  }

  function restoreProgress() {
    var saved = readJSON(KEY.progress, null);
    if (!saved || !saved.r || !saved.s) return false;
    if (!saved.size || saved.size < 5 || saved.size > 10) return false;
    if (String(saved.r).length !== saved.size * saved.size) return false;
    if (String(saved.s).length !== saved.size) return false;
    if (!Array.isArray(saved.board) || saved.board.length !== saved.size * saved.size) return false;
    if (typeof saved.dailyKey === 'string' && saved.dailyKey && saved.dailyKey !== todayKey() && saved.daily) {
      // Yesterday's daily stays playable, it just stops being "today".
    }
    if (saved.mode) settings.mode = saved.mode;

    try {
      startPuzzle(saved.difficulty, !!saved.daily, {
        seed: saved.seed,
        puzzle: {
          size: saved.size,
          regions: E.decodeRegions(saved.r),
          solution: E.decodeSolution(saved.s)
        },
        board: saved.board,
        seeds: saved.seeds,
        lost: saved.lost,
        hints: saved.hints,
        elapsedMs: saved.elapsedMs,
        solved: saved.solved
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------- layout

  function sizeBoard() {
    var wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var max = Math.min(rect.width || 360, rect.height || 420, 430);
    var size = Math.max(240, Math.floor(max));
    document.documentElement.style.setProperty('--board-size', size + 'px');
  }

  // ----------------------------------------------------------------- events

  function cellFromPoint(x, y) {
    var node = document.elementFromPoint(x, y);
    if (!node) return -1;
    var cell = node.closest ? node.closest('.cell') : null;
    if (!cell || !el.board.contains(cell)) return -1;
    return Number(cell.dataset.i);
  }

  function onPointerDown(e) {
    if (!state || state.solved) return;
    if (e.button !== undefined && e.button !== 0) return;
    var index = cellFromPoint(e.clientX, e.clientY);
    if (index < 0) return;
    e.preventDefault();
    drag = {
      start: index,
      last: index,
      moved: false,
      painting:
        settings.mode === 'memo'
          ? state.board[index] !== 2
          : settings.mode === 'auto' && state.board[index] === 0,
      erasing: settings.mode === 'memo' && state.board[index] === 1,
      items: [],
      pointerId: e.pointerId
    };
    try {
      el.board.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      var startCell = cellEls[drag.start];
      var rect = startCell.getBoundingClientRect();
      var dx = e.clientX - (rect.left + rect.width / 2);
      var dy = e.clientY - (rect.top + rect.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < 12) return;
      drag.moved = true;
      if (drag.painting) {
        var first = dragCell(drag.start);
        if (first) drag.items.push(first);
        renderBoard();
      }
    }
    var index = cellFromPoint(e.clientX, e.clientY);
    if (index < 0 || index === drag.last) return;
    drag.last = index;
    if (drag.painting && settings.mode !== "place") {
      var item = dragCell(index);
      if (item) {
        drag.items.push(item);
        renderBoard();
      }
    }
  }

  function onPointerUp() {
    if (!drag) return;
    var finished = drag;
    drag = null;
    if (finished.moved) {
      /* a drag is not a tap: the next tap starts a fresh single tap */
      lastTap = null;
      if (finished.items.length) {
        pushHistory(finished.items);
        recomputeBlocked();
        renderBoard();
        renderStatus();
        saveProgress();
      }
    } else {
      tapCell(finished.start);
    }
  }

  function bindEvents() {
    el.board.addEventListener('pointerdown', onPointerDown);
    el.board.addEventListener('pointermove', onPointerMove);
    el.board.addEventListener('pointerup', onPointerUp);
    el.board.addEventListener('pointercancel', onPointerUp);
    el.board.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    el.tabRandom.addEventListener('click', function () {
      if (state && state.daily) {
        if (hasProgress()) {
          askConfirm('새 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', function () {
            closeSheet();
            startPuzzle(settings.difficulty, false);
          });
        } else {
          startPuzzle(settings.difficulty, false);
        }
      } else if (hasProgress()) {
        askConfirm('새 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', function () {
          closeSheet();
          startPuzzle(settings.difficulty, false);
        });
      } else {
        startPuzzle(settings.difficulty, false);
      }
    });

    el.tabDaily.addEventListener('click', function () {
      var alreadyToday = state && state.daily && state.dailyKey === todayKey() && state.difficulty === settings.difficulty;
      if (alreadyToday && !state.solved) {
        toast('오늘의 퍼즐을 이미 풀고 있어요');
        return;
      }
      var launch = function () {
        closeSheet();
        startPuzzle(settings.difficulty, true);
      };
      if (hasProgress()) askConfirm('오늘의 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', launch);
      else launch();
    });

    $('#levelSwitch').addEventListener('click', function (e) {
      var btn = e.target.closest('.level-tab');
      if (!btn) return;
      settings.group = btn.dataset.group;
      writeJSON(KEY.settings, settings);
      renderDifficulty();
    });

    el.diffs.addEventListener('click', function (e) {
      var btn = e.target.closest('.diff');
      if (!btn) return;
      var key = btn.dataset.diff;
      if (!key || (state && state.difficulty === key && !state.daily)) return;
      var launch = function () {
        closeSheet();
        startPuzzle(key, false);
      };
      if (hasProgress()) askConfirm(E.difficultyByKey(key).label + ' 퍼즐을 시작할까요?', '지금 풀던 퍼즐은 사라져요.', launch);
      else launch();
    });

    $('#modes').addEventListener('click', function (e) {
      var btn = e.target.closest('.mode');
      if (!btn) return;
      settings.mode = btn.dataset.mode;
      lastTap = null;
      writeJSON(KEY.settings, settings);
      renderModes();
    });

    el.btnTheme.addEventListener('click', function () {
      settings.theme = effectiveDark() ? 'light' : 'dark';
      writeJSON(KEY.settings, settings);
      applyTheme();
      if (activeSheet === 'sheetSettings') renderSettings();
    });

    el.btnSettings.addEventListener('click', function () {
      renderSettings();
      openSheet('sheetSettings');
    });

    el.btnCollection.addEventListener('click', function () {
      renderCollection();
      el.collectNote.textContent = '해금한 카피바라를 누르면 바로 장착돼요.';
      openSheet('sheetCollection');
    });

    el.collectGrid.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.skin-card') : null;
      if (!card || card.disabled) return;
      var key = card.dataset.skin;
      if (!key || key === stats.skins.active) return;
      newSkinKeys = newSkinKeys.filter(function (k) {
        return k !== key;
      });
      if (equipSkin(key)) el.collectNote.textContent = skinByKey(key).name + '를 장착했어요!';
    });

    el.btnUseUnlock.addEventListener('click', useNewSkin);
    el.btnSeeUnlock.addEventListener('click', function () {
      renderCollection();
      el.collectNote.textContent = '방금 해금한 카피바라예요. 눌러서 장착해 보세요!';
      openSheet('sheetCollection');
    });

    el.btnUndo.addEventListener('click', undo);
    el.btnHint.addEventListener('click', hint);
    el.btnRestart.addEventListener('click', function () {
      if (!state) return;
      if (!hasProgress()) {
        restartPuzzle();
        toast('퍼즐을 새로 시작했어요');
        return;
      }
      askConfirm('처음부터 다시 시작할까요?', '지금까지 놓은 카피바라와 메모가 사라져요.', function () {
        closeSheet();
        restartPuzzle();
      });
    });

    el.scrim.addEventListener('click', closeSheet);
    el.btnCloseSettings.addEventListener('click', closeSheet);
    el.btnCloseCollection.addEventListener('click', closeSheet);

    el.btnNextPuzzle.addEventListener('click', function () {
      closeSheet();
      startPuzzle(settings.difficulty, false);
    });
    el.btnCloseWin.addEventListener('click', function () {
      closeSheet();
      if (state && state.solved) showWinBanner(elapsed());
    });

    el.btnRevive.addEventListener('click', function () {
      closeSheet();
      if (!state) return;
      state.seeds = 3;
      renderSeeds();
      saveProgress();
      toast('🍊 귤 3개를 충전했어요!');
    });
    el.btnRestartFromSeeds.addEventListener('click', function () {
      closeSheet();
      restartPuzzle();
    });

    el.btnRestartConfirm.addEventListener('click', function () {
      var action = pendingConfirm;
      closeSheet();
      if (action) action();
    });
    el.btnRestartCancel.addEventListener('click', closeSheet);

    el.btnWinBannerNew.addEventListener('click', function () {
      startPuzzle(settings.difficulty, false);
    });

    el.setDark.addEventListener('change', function () {
      settings.theme = el.setDark.checked ? 'dark' : 'light';
      writeJSON(KEY.settings, settings);
      applyTheme();
    });
    el.setCb.addEventListener('change', function () {
      settings.colorblind = el.setCb.checked;
      writeJSON(KEY.settings, settings);
      el.board.classList.toggle('cb', settings.colorblind);
    });
    el.setAutoX.addEventListener('change', function () {
      settings.autoX = el.setAutoX.checked;
      settings.prefsVersion = DEFAULT_SETTINGS.prefsVersion;
      writeJSON(KEY.settings, settings);
      renderBoard();
    });
    el.btnReset.addEventListener('click', function () {
      var keep = { unlocked: stats.skins.unlocked.slice(), active: stats.skins.active };
      stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
      stats.skins = keep;
      writeJSON(KEY.stats, stats);
      renderSettings();
      updateDailyBadge();
      updateCollectionBadge();
      toast('기록을 초기화했어요 · 도감은 그대로');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (activeSheet === 'sheetWin') {
          closeSheet();
        } else if (activeSheet) {
          closeSheet();
        }
      }
      if (activeSheet) return;
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'h') hint();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseTimer();
        saveProgressNow();
      } else if (state && !state.solved && !activeSheet) {
        startTimer();
      }
    });

    window.addEventListener('pagehide', saveProgressNow);

    window.addEventListener('resize', sizeBoard);
    window.addEventListener('orientationchange', function () {
      setTimeout(sizeBoard, 120);
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (settings.theme === 'auto') {
          applyTheme();
          if (activeSheet === 'sheetSettings') renderSettings();
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    document.addEventListener('gesturestart', function (e) {
      e.preventDefault();
    });
  }

  // -------------------------------------------------------------- win banner

  function showWinBanner(time) {
    el.winBannerText.textContent = '완성! ' + formatTime(time);
    el.winBanner.hidden = false;
  }

  function hideWinBanner() {
    el.winBanner.hidden = true;
  }

  // -------------------------------------------------------------------- boot

  function cacheElements() {
    el.board = $('#board');
    el.timer = $('#timer');
    el.seeds = $('#seeds');
    el.remain = $('#remain');
    el.toast = $('#toast');
    el.winBanner = $('#winBanner');
    el.winBannerText = $('#winBannerText');
    el.btnWinBannerNew = $('#btnWinBannerNew');
    el.diffs = $('#diffs');
    el.tabRandom = $('#tabRandom');
    el.tabDaily = $('#tabDaily');
    el.dailyBadge = $('#dailyBadge');
    el.btnTheme = $('#btnTheme');
    el.btnSettings = $('#btnSettings');
    el.btnUndo = $('#btnUndo');
    el.btnHint = $('#btnHint');
    el.btnRestart = $('#btnRestart');
    el.overlay = $('#overlay');
    el.scrim = $('#scrim');
    el.restartTitle = $('#restartTitle');
    el.restartSub = $('#sheetRestart .win-sub');
    el.btnRestartConfirm = $('#btnRestartConfirm');
    el.btnRestartCancel = $('#btnRestartCancel');
    el.winTime = $('#winTime');
    el.winBest = $('#winBest');
    el.winStreak = $('#winStreak');
    el.winSub = $('#winSub');
    el.btnNextPuzzle = $('#btnNextPuzzle');
    el.btnCloseWin = $('#btnCloseWin');
    el.btnRevive = $('#btnRevive');
    el.btnRestartFromSeeds = $('#btnRestartFromSeeds');
    el.setDark = $('#setDark');
    el.setCb = $('#setCb');
    el.setAutoX = $('#setAutoX');
    el.statCleared = $('#statCleared');
    el.statStreak = $('#statStreak');
    el.statBest = $('#statBest');
    el.bestNote = $('#bestNote');
    el.btnReset = $('#btnReset');
    el.btnCloseSettings = $('#btnCloseSettings');
    el.brandBadge = $('#brandBadge');
    el.winCapi = $('#winCapi');
    el.btnCollection = $('#btnCollection');
    el.collectionCount = $('#collectionCount');
    el.collectSummary = $('#collectSummary');
    el.collectBar = $('#collectBar');
    el.collectBarFill = $('#collectBarFill');
    el.collectGrid = $('#collectGrid');
    el.collectNote = $('#collectNote');
    el.btnCloseCollection = $('#btnCloseCollection');
    el.winUnlock = $('#winUnlock');
    el.unlockList = $('#unlockList');
    el.btnUseUnlock = $('#btnUseUnlock');
    el.btnSeeUnlock = $('#btnSeeUnlock');
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    var reg = null;
    /* iPhone home-screen apps keep the page alive for days, so ask for a new
       sw.js on every open and whenever the app comes back to the foreground.
       The worker itself serves the core files network-first, so once it is
       updated a reload picks up the deployed code. */
    var checkUpdate = function () {
      if (!reg) return;
      reg.update().catch(function () {
        /* offline is fine — the cached app keeps playing */
      });
    };
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('./sw.js')
        .then(function (r) {
          reg = r;
          checkUpdate();
        })
        .catch(function () {
          /* offline support is a bonus, never a blocker */
        });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkUpdate();
    });
  }

  function boot() {
    cacheElements();
    evaluateUnlocks();
    applySkin();

    applyTheme();
    renderModes();
    bindEvents();
    renderDifficulty();

    if (!restoreProgress()) startPuzzle(settings.difficulty, false);
    requestAnimationFrame(sizeBoard);
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        sizeBoard();
      }).observe(document.querySelector('.board-wrap'));
    }
    registerSW();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Exposed for automated UI tests only.
  window.__capydoku = {
    get state() {
      return state;
    },
    get settings() {
      return settings;
    },
    get stats() {
      return stats;
    },
    engine: E,
    startPuzzle: startPuzzle,
    tapCell: tapCell,
    mistake: mistake,
    hint: hint,
    undo: undo,
    isSolutionCell: isSolutionCell,
    skins: SKIN_LIST,
    unlockedSkins: function () {
      return stats.skins.unlocked.slice();
    },
    activeSkin: function () {
      return stats.skins.active;
    },
    equipSkin: equipSkin,
    renderCollection: renderCollection,
    openCollection: function () {
      renderCollection();
      openSheet('sheetCollection');
    },
    setStats: function (patch) {
      stats = merge(stats, patch);
      normalizeStats();
      evaluateUnlocks();
      renderSettings();
      updateCollectionBadge();
    }
  };
})();
