(function () {
  "use strict";
  // ================= Daily Training Coach =================
  // A self-contained phone app: a setup questionnaire builds each person's 4-week plan by fixed rules,
  // and a morning check-in adjusts each day. Ported from Doug's Lift + Swim Log (Oct 18, 2026).

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const pd = (x) => { const [y, m, d] = x.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtD = (dt) => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  const dow = (x) => (pd(x).getDay() + 6) % 7;
  const mondayOf = (x) => { const d = pd(x); d.setDate(d.getDate() - dow(x)); return fmtD(d); };
  const niceDate = (x) => pd(x).toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"});
  const clock = (m) => { const t = Math.round(m); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  const restTxt = (s) => s >= 60 ? (s % 60 ? Math.floor(s / 60) + " min " + (s % 60) + " sec" : (s / 60) + " min") : s + " sec";
  const r15 = (s) => Math.round(s / 15) * 15;
  const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
  const baseName = (n) => String(n).replace(/\s*\(\d[\d.]*\s*lb\)\s*$/i, "").trim();

  // ---------- state ----------
  let profile = null;                 // the setup answers; null = show the setup
  let settings = {kind: "settings", cycle: 1};
  let sessions = {};                  // "c<cycle>-w<week>-<key>" -> logged sets
  let checkins = {};                  // "checkin-YYYY-MM-DD" -> morning readings
  let extras = {};                    // "extra-YYYY-MM-DD" -> cardio, finisher and stretching logged that day
  let week = 1, dayKey = null, store = null, pendingId = null, saveTimer = null;
  let editingProfile = false, ciEditing = false, confirmingReset = false;
  let curCardio = "swim", afterLift = "stretching, then cardio", afterLiftSay = "Stretch next.";
  const sid = (c, w, k) => "c" + c + "-w" + w + "-" + k;
  const setStatus = (txt, cls) => { const s = $("status"); if (s) { s.textContent = txt; s.className = "status" + (cls ? " " + cls : ""); } };

  // ================= exercise library =================
  // [name, pattern, equipment (g gym, d dumbbells, b bands, w bodyweight), min level (0 new, 1 some, 2 experienced),
  //  joint stress {k knee, b back, s shoulder: 0-2}, flags (bw bodyweight, side per side, timed, stretch, power)]
  const LIB = [
    ["Barbell back squat", "squat", "g", 1, {k: 2, b: 1}, "stretch"],
    ["Goblet squat", "squat", "gd", 0, {k: 2}, "stretch"],
    ["Leg press", "squat", "g", 0, {k: 2}, ""],
    ["Box squat", "squat", "g", 1, {k: 1, b: 1}, ""],
    ["Banded squat", "squat", "b", 0, {k: 2}, ""],
    ["Bodyweight squat", "squat", "w", 0, {k: 2}, "bw"],
    ["Sit-to-stand from a chair", "squat", "w", 0, {k: 1}, "bw"],
    ["Trap-bar deadlift", "hinge", "g", 1, {k: 1, b: 2}, ""],
    ["Dumbbell Romanian deadlift", "hinge", "gd", 0, {b: 1}, "stretch"],
    ["Hip thrust", "hinge", "g", 0, {}, ""],
    ["Cable pull-through", "hinge", "g", 0, {}, ""],
    ["Band good morning", "hinge", "b", 0, {b: 1}, ""],
    ["Glute bridge", "hinge", "w", 0, {}, "bw"],
    ["Single-leg glute bridge", "hinge", "w", 1, {}, "bw side"],
    ["Bulgarian split squat", "lunge", "gd", 1, {k: 2}, "side stretch"],
    ["Reverse lunge", "lunge", "gd", 0, {k: 2}, "side stretch"],
    ["Step-up", "lunge", "gd", 0, {k: 2}, "side"],
    ["Walking lunge", "lunge", "gd", 1, {k: 2}, "side stretch"],
    ["Bodyweight reverse lunge", "lunge", "w", 0, {k: 2}, "bw side"],
    ["Clean and press", "vpush", "g", 2, {k: 1, b: 1, s: 2}, "power"],
    ["Barbell bench press", "hpush", "g", 1, {s: 2}, ""],
    ["Dumbbell bench press", "hpush", "g", 0, {s: 1}, "stretch"],
    ["Machine chest press", "hpush", "g", 0, {s: 1}, ""],
    ["Dumbbell floor press", "hpush", "d", 0, {s: 1}, ""],
    ["Band chest press", "hpush", "b", 0, {s: 1}, ""],
    ["Push-up", "hpush", "w", 1, {s: 1}, "bw"],
    ["Incline push-up", "hpush", "w", 0, {s: 1}, "bw"],
    ["Dumbbell shoulder press", "vpush", "gd", 0, {s: 2}, ""],
    ["Landmine press", "vpush", "g", 0, {s: 1}, "side"],
    ["Band overhead press", "vpush", "b", 0, {s: 2}, ""],
    ["Pike push-up", "vpush", "w", 2, {s: 2}, "bw"],
    ["Prone Y-T raise", "vpush", "w", 0, {}, "bw"],
    ["Seated cable row", "hpull", "g", 0, {}, ""],
    ["Chest-supported dumbbell row", "hpull", "g", 0, {}, ""],
    ["One-arm dumbbell row", "hpull", "gd", 0, {b: 1}, "side"],
    ["Band row", "hpull", "b", 0, {}, ""],
    ["Reverse snow angel", "hpull", "w", 0, {}, "bw"],
    ["Lat pulldown", "vpull", "g", 0, {s: 1}, "stretch"],
    ["Pull-up", "vpull", "g", 2, {s: 2}, "bw"],
    ["Assisted pull-up", "vpull", "g", 1, {s: 1}, ""],
    ["Dumbbell pullover", "vpull", "d", 1, {s: 2}, "stretch"],
    ["Band pulldown", "vpull", "b", 0, {s: 1}, ""],
    ["Superman lat pull", "vpull", "w", 0, {}, "bw"],
    ["Dead bug", "core", "w", 0, {}, "bw side"],
    ["Plank", "core", "w", 0, {s: 1}, "bw timed"],
    ["Side plank", "core", "w", 0, {}, "bw timed side"],
    ["Bird dog", "core", "w", 0, {}, "bw side"],
    ["Pallof press", "core", "gb", 0, {}, "side"],
    ["Cable crunch", "core", "g", 1, {b: 1}, ""],
    ["Reverse crunch", "core", "w", 1, {b: 1}, "bw"],
    ["Hanging knee raise", "core", "g", 1, {s: 1}, "bw"],
    ["Farmer carry", "carry", "gd", 0, {b: 1}, ""],
    ["Suitcase carry", "carry", "gd", 0, {}, "side"]
  ].map(([name, pat, eq, lvl, j, fl]) => ({name, pat, eq, lvl, j, bw: /\bbw\b/.test(fl), side: /\bside\b/.test(fl), timed: /\btimed\b/.test(fl), stretch: /\bstretch\b/.test(fl), power: /\bpower\b/.test(fl)}));
  const BYNAME = Object.fromEntries(LIB.map(x => [x.name, x]));
  const BODYWEIGHT = new Set(LIB.filter(x => x.bw).map(x => x.name));
  const STRETCH = new Set(LIB.filter(x => x.stretch).map(x => x.name));
  const isBW = (n) => BODYWEIGHT.has(baseName(n));
  const FIXED_REPS = {"Plank": ["30 sec", "45 sec"], "Side plank": ["20 sec per side", "30 sec per side"], "Dead bug": ["8 per side", "10 per side"],
    "Bird dog": ["8 per side", "10 per side"], "Pallof press": ["10 per side", "10 per side"], "Farmer carry": ["40 yd", "50 yd"],
    "Suitcase carry": ["40 yd per side", "40 yd per side"], "Clean and press": ["5", "5"], "Prone Y-T raise": ["10", "12"],
    "Superman lat pull": ["10", "12"], "Reverse snow angel": ["10", "12"], "Sit-to-stand from a chair": ["10", "12"]};
  const VIDEO_Q = {"Clean and press": "barbell clean and press technique", "Sit-to-stand from a chair": "sit to stand exercise seniors",
    "Prone Y-T raise": "prone y t raise exercise", "Superman lat pull": "superman lat pull exercise", "Reverse snow angel": "reverse snow angel exercise",
    "Cable pull-through": "cable pull through glutes form", "Fat-burn finisher": "stationary bike intervals beginners",
    "Swim, freestyle": "freestyle swimming technique for adults", "Couch stretch": "couch stretch hip flexor", "90/90 hip switches": "90 90 hip switch mobility",
    "Deep squat hold": "deep squat hold mobility", "Doorway pec stretch": "doorway pec stretch", "Thoracic open books": "thoracic open book stretch",
    "Kneeling lat stretch": "kneeling lat stretch bench", "Wall slides": "wall slides shoulder mobility", "Cat-cow": "cat cow stretch",
    "Hamstring stretch": "standing hamstring stretch", "Lying hamstring stretch with a strap": "lying hamstring stretch strap",
    "Figure-4 glute stretch": "figure 4 glute stretch", "Standing hip flexor stretch": "standing hip flexor stretch",
    "Single-leg balance": "single leg balance exercise older adults", "Child's pose": "child's pose stretch", "Open-book stretch": "open book stretch"};
  const videoUrl = (name) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(VIDEO_Q[name] || (name + " proper form"));
  const watchBtn = (name, label) => `<a class="watch" href="${videoUrl(name)}" target="_blank" rel="noopener noreferrer"><span class="play" aria-hidden="true">▶</span>${esc(label || "Watch how")}</a>`;
  function stretchChips(text) {
    return text.split(" · ").map(item => {
      const name = item.replace(/\s+(×\d+.*|\d+\s*sec.*)$/, "").trim(), dose = item.slice(name.length).trim();
      return `<a class="chip" href="${videoUrl(name)}" target="_blank" rel="noopener noreferrer"><span class="play" aria-hidden="true">▶</span><b>${esc(name)}</b>${dose ? `<span>${esc(dose)}</span>` : ""}</a>`;
    }).join("");
  }

  // ================= setup answers → plan rules =================
  const SCREEN = [
    ["heart", "Has a doctor ever said you have a heart condition, or that you should only do exercise a doctor recommends?"],
    ["chestActive", "Do you get chest pain, pressure or tightness when you're active?"],
    ["chestRest", "In the past month, have you had chest pain when you were not active?"],
    ["dizzy", "Do you lose your balance from dizziness, or have you ever passed out?"],
    ["joint", "Do you have a bone or joint problem that exercise could make worse?"],
    ["bpMeds", "Do you take medicine for blood pressure or a heart condition?"],
    ["other", "Is there any other reason you shouldn't exercise without a doctor's OK (pregnancy, recent surgery, diabetes with complications)?"]
  ];
  const GOALS = [["fat", "Lose fat"], ["strength", "Get stronger"], ["flex", "Flexibility and mobility"], ["heart", "Heart health and endurance"]];
  const P = () => profile || {};
  const screenYes = () => SCREEN.some(([k]) => P().screen && P().screen[k] === "yes");
  const easyStart = () => screenYes() && !P().cleared;
  function level() {
    const p = P();
    if (easyStart()) return 0;
    if (p.experience === "new" || p.recent === "none") return 0;
    if (p.experience === "experienced" && p.recent === "regular") return 2;
    return 1;
  }
  const LEVEL_NAME = ["Beginner", "Intermediate", "Experienced"];
  // Related movements in the same body area, used when a joint rules out the planned one.
  const RELATED = {squat: ["hinge"], lunge: ["hinge", "squat"], hinge: ["squat"], hpush: ["hpull", "vpull"], vpush: ["hpull", "vpull"], vpull: ["hpull"], hpull: ["vpull"], core: [], carry: ["core"]};
  const has = (g) => (P().goals || []).includes(g);
  function eqSet() {
    const p = P(), s = new Set(["w"]);
    if (p.gym === "yes") { s.add("g"); s.add("d"); s.add("b"); }
    else { (p.home || []).forEach(h => { if (h === "dumbbells") s.add("d"); if (h === "bands") s.add("b"); }); }
    return s;
  }
  const hasPool = () => P().pool === "yes" && P().swims !== "no";
  const ageNum = () => +P().age || 0;
  const hrNumbersOk = () => P().watch === "yes" && P().betaBlocker !== "yes";
  const permJoints = () => P().joints || [];          // ongoing issues: "k", "b", "s"

  const TEMPLATES = {
    2: [["Full body A", ["squat", "hpush", "hpull", "hinge", "core", "core"]], ["Full body B", ["hinge", "vpush", "vpull", "lunge", "core", "carry"]]],
    3: [["Full body A", ["squat", "hpush", "hpull", "core", "core"]], ["Full body B", ["hinge", "vpush", "vpull", "lunge", "core"]],
        ["Full body C", ["squat", "vpull", "hpush", "hinge", "carry", "core"]]],
    4: [["Lower body A", ["squat", "hinge", "lunge", "core", "core"]], ["Upper body A", ["hpush", "hpull", "vpush", "vpull", "core"]],
        ["Lower body B", ["hinge", "squat", "lunge", "carry", "core"]], ["Upper body B", ["vpush", "vpull", "hpush", "hpull", "core"]]],
    5: [["Lower body A", ["squat", "hinge", "lunge", "core", "core"]], ["Upper body A", ["hpush", "hpull", "vpush", "vpull", "core"]],
        ["Lower body B", ["hinge", "squat", "lunge", "carry", "core"]], ["Upper body B", ["vpush", "vpull", "hpush", "hpull", "core"]],
        ["Full body", ["squat", "hpush", "hpull", "hinge", "core", "carry"]]]
  };
  function plan() {
    const n = Math.min(5, Math.max(2, +P().days || 3));
    return TEMPLATES[n].map(([title, slots], i) => ({key: "s" + (i + 1), title, slots, focus: /^Lower/.test(title) ? "lower" : /^Upper/.test(title) ? "upper" : "full"}));
  }
  // Candidates for one movement pattern, best first.
  function candidates(pat, opts) {
    const eq = eqSet(), lv = level(), pj = permJoints(), o = opts || {};
    let list = LIB.filter(x => x.pat === pat && [...x.eq].some(e => eq.has(e)) && x.lvl <= lv && (!x.power || (has("strength") && lv >= 2 && ageNum() < 65)));
    // Ongoing joint issues: leave out the moves that load that joint hardest, when something else exists.
    const ok = list.filter(x => pj.every(j => (x.j[j] || 0) < 2));
    if (ok.length || o.strict) list = ok;
    if (o.limit) { const okj = list.filter(x => Object.entries(o.limit).every(([j, max]) => (x.j[j] || 0) <= max)); list = okj; }
    if (ageNum() >= 65) { const gentler = list.filter(x => !/pike|hanging|^pull-up$/i.test(x.name)); if (gentler.length) list = gentler; }
    // Best equipment they have first (gym, then dumbbells, then bands, then bodyweight), then closest to their level.
    return list.slice().sort((a, b) => (eqRank(a) - eqRank(b)) || (b.lvl - a.lvl) || (LIB.indexOf(a) - LIB.indexOf(b)));
  }
  function eqRank(x) {
    const eq = eqSet();
    return x.eq.includes("g") && eq.has("g") ? 0 : x.eq.includes("d") && eq.has("d") ? 1 : x.eq.includes("b") && eq.has("b") ? 2 : 3;
  }
  // Variety only among the best-equipment group, so a dumbbell user repeats a dumbbell press rather than dropping to bodyweight.
  function pickVaried(c, occ) {
    if (!c.length) return null;
    const top = c.filter(x => eqRank(x) === eqRank(c[0]));
    return top[occ % top.length];
  }
  const repsFor = (name, main, w) => {
    const lv = level(), f = FIXED_REPS[name];
    if (f) return f[lv >= 1 ? 1 : 0];
    if (easyStart()) return main ? "12" : "12";
    const str = has("strength");
    if (main) return !str ? "10" : lv === 0 ? "8" : ({1: "8", 2: "8", 3: "5", 4: "8"}[w] || "8");
    return str ? "10" : "12";
  };
  function setsFor(main, w) {
    const lv = level();
    let s = easyStart() ? 2 : main ? [3, 3, 4][lv] : [2, 3, 3][lv];
    if (w === 2 && !main && !easyStart()) s += 1;
    if (w === 4) s = Math.max(2, s - 1);
    return Math.min(5, s);
  }
  const restFor = (x, main) => main ? (easyStart() ? 90 : [90, 150, 180][level()]) : x.pat === "core" ? 45 : 60;
  // The lifts for one session in one week, chosen so a pattern used twice in a week gets a different exercise.
  function liftsFor(w, sp) {
    const used = new Set(), seen = {}, sessIdx = plan().findIndex(s => s.key === sp.key);
    // count how many times each pattern appeared in earlier sessions this week, for variety
    plan().slice(0, Math.max(0, sessIdx)).forEach(s => s.slots.forEach(p => { seen[p] = (seen[p] || 0) + 1; }));
    return sp.slots.map((pat, i) => {
      // An ongoing joint problem that rules out a whole movement (every lunge loads the knee) moves to a related one.
      let c = [];
      for (const pt of [pat, ...(RELATED[pat] || [])]) { c = candidates(pt, {strict: true}).filter(x => !used.has(x.name)); if (c.length) break; }
      if (!c.length) c = candidates(pat).filter(x => !used.has(x.name));
      if (!c.length) return null;
      const occ = (seen[pat] || 0) + (w === 2 && i > 0 ? 1 : 0);
      seen[pat] = (seen[pat] || 0) + 1;
      let x = pickVaried(c, occ), stepFrom = null;
      const easy = stepDown(x, c, w, sp);
      if (easy) { stepFrom = x.name; x = easy; }
      used.add(x.name);
      const main = i === 0 && pat !== "core";
      return {name: x.name, pat, sets: setsFor(main, w), reps: repsFor(x.name, main, w), base: restFor(x, main), main, side: x.side, lib: x, stepFrom};
    }).filter(Boolean);
  }
  // A bodyweight move missed in two sessions in a row steps back to an easier move of the same kind
  // (push-up → incline push-up) until the easier one is done cleanly twice. A session already started keeps its move.
  function stepDown(x, c, w, sp) {
    if (!x.bw) return null;
    const easy = c.filter(y => y.lvl < x.lvl && y.name !== x.name).sort((a, b) => (b.bw - a.bw) || (b.lvl - a.lvl))[0];
    if (!easy) return null;
    const curId = sid(settings.cycle, w, sp.key), body = sessions[curId];
    if (setsOf(body, x.name).some(s => s && (s.r != null || s.w != null))) return null;
    if (setsOf(body, easy.name).some(s => s && (s.r != null || s.w != null))) return easy;
    const work = historyFor(x.name, curId).filter(h => h.week !== 4 && !h.light);
    if (work.length < 2) return null;
    const last = work.slice(-2);
    if (last.some(h => judge(h, x.name).hit)) return null;
    const since = last[1].date || "";
    const done = historyFor(easy.name, curId).filter(h => h.week !== 4 && !h.light && (h.date || "") >= since);
    return done.length >= 2 && done.slice(-2).every(h => judge(h, easy.name).hit) ? null : easy;
  }

  // ---------- time budget for one session ----------
  function budget() {
    const M = +P().minutes || 60;
    const warm = 5, mob = has("flex") ? (M >= 60 ? 10 : 6) : (M >= 45 ? 5 : 3);
    let fin = has("fat") && M >= 45 ? 6 : 0;
    let cardio = has("heart") || has("fat") ? (M >= 90 ? 25 : M >= 75 ? 20 : M >= 60 ? 15 : M >= 45 ? 8 : has("heart") ? 6 : 0) : 0;
    const change = () => cardio ? 2 : 0;
    let lift = M - warm - mob - fin - cardio - change();
    while (lift < 18 && cardio > 0) { cardio = Math.max(0, cardio - 2); lift = M - warm - mob - fin - cardio - change(); }
    while (lift < 18 && fin > 0) { fin = 0; lift = M - warm - mob - fin - cardio - change(); }
    return {M, warm, mob, fin, cardio, change: change(), lift: Math.max(12, lift)};
  }
  const workSec = (it) => (it.main ? 60 : STRETCH.has(baseName(it.name)) ? 55 : 45) * (it.side ? 1.6 : 1);
  const CHANGE = 60;
  // Fit sets and rests into the lifting minutes: trim accessory sets (then drop the last extras) when long,
  // stretch rests toward their caps when short. Never adds sets.
  function fit(items, liftMin) {
    const WINDOW = liftMin * 60, RAMP = items.length && items[0].main ? (level() === 0 ? 120 : 240) : 0;
    const restAt = (it, f) => Math.min(it.main ? 180 : 75, Math.max(it.main ? 90 : 30, r15(it.base * f)));
    const fixed = () => RAMP + items.reduce((a, it) => a + it.sets * workSec(it) + CHANGE, 0);
    const total = (f) => items.reduce((a, it) => a + (it.sets - 1) * restAt(it, f), 0);
    for (let g = 0; g < 20 && WINDOW - fixed() < total(0); g++) {
      const acc = items.filter(it => !it.main && it.sets > 2).pop();
      if (acc) { acc.sets -= 1; continue; }
      if (items.length > 2) { items.pop(); continue; }
      break;
    }
    let lo = 0, hi = 3;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (total(mid) > WINDOW - fixed()) hi = mid; else lo = mid; }
    items.forEach((it, i) => { it.rest = restAt(it, Math.max(lo, 0.5)); it.ramp = i === 0 ? RAMP : 0; });
  }

  // ---------- cardio, finisher, stretching ----------
  function cardioKind(sp, joints) {
    const p = P(), j = joints || {}, idx = plan().findIndex(s => s.key === sp.key);
    const knee = permJoints().includes("k") || j.k, back = permJoints().includes("b") || j.b, shoulder = j.s === "sore";
    const opts = [];
    if (hasPool() && !shoulder) opts.push("swim");
    if (p.gym === "yes") { opts.push("bike"); if (!knee && !back && ageNum() < 65) opts.push("rower"); if (!knee && ageNum() < 70) opts.push("stairs"); opts.push("incline walk"); }
    if (!opts.length || (p.gym !== "yes" && !hasPool())) opts.push("walk");
    // Legs-heavy days swim or bike so tired legs get a break; otherwise rotate.
    if (sp.focus === "lower" && opts.includes("swim")) return "swim";
    if (sp.focus === "lower" && opts.includes("bike")) return "bike";
    return opts[idx % opts.length];
  }
  const CARDIO_NAME = {swim: "Swim, freestyle", bike: "Stationary bike", rower: "Rower", stairs: "Stair climber", "incline walk": "Incline treadmill walk", walk: "Brisk walk"};
  function zoneTxt() {
    const base = "easy-steady: you can talk in full sentences";
    if (!hrNumbersOk() || !ageNum()) return base;
    const max = Math.round(208 - 0.7 * ageNum());
    return `${base}, about ${Math.round(max * 0.6)}–${Math.round(max * 0.7)} bpm on your watch`;
  }
  const MOB = {
    lower: ["Couch stretch 45 sec per side", "90/90 hip switches ×8", "Hamstring stretch 45 sec per side", "Deep squat hold 45 sec"],
    upper: ["Doorway pec stretch 45 sec per side", "Thoracic open books ×8 per side", "Kneeling lat stretch 45 sec", "Wall slides ×10"],
    full: ["Couch stretch 45 sec per side", "Doorway pec stretch 45 sec per side", "Cat-cow ×10", "Hamstring stretch 45 sec per side"]
  };
  const KNEE_MOB = {"Couch stretch 45 sec per side": "Standing hip flexor stretch 45 sec per side", "90/90 hip switches ×8": "Figure-4 glute stretch 45 sec per side",
    "Deep squat hold 45 sec": "Lying hamstring stretch with a strap 45 sec per side", "Hamstring stretch 45 sec per side": "Lying hamstring stretch with a strap 45 sec per side"};
  function mobilityFor(sp, mobMin, joints) {
    let list = MOB[sp.focus].slice(0, mobMin >= 6 ? 4 : 3);
    const knee = permJoints().includes("k") || (joints && joints.k);
    if (knee) list = [...new Set(list.map(x => KNEE_MOB[x] || x))];
    if (ageNum() >= 60) list.push("Single-leg balance 30 sec per side");
    return list.join(" · ");
  }

  // ================= daily joint adjustments =================
  // Morning answer per joint: none | mild | sore. mild: swap moves that load that joint hardest (main lift stays,
  // about 80%); sore: swap anything that loads it. Swapped moves come from the same movement when possible.
  const JOINT_NAME = {k: "knee", b: "lower back", s: "shoulder"};
  const SAFE_POOL = ["Glute bridge", "Dead bug", "Bird dog", "Side plank", "Reverse snow angel", "Superman lat pull"];
  function jointAdjust(items, joints) {
    const act = Object.entries(joints || {}).filter(([, v]) => v === "mild" || v === "sore");
    if (!act.length) return;
    const taken = new Set(items.map(i => i.name));
    items.forEach(it => {
      const x = BYNAME[it.name] || {j: {}};
      let worst = null;
      act.forEach(([j, sev]) => { const st = x.j[j] || 0; if ((sev === "sore" && st >= 1) || (sev === "mild" && st >= 2)) worst = worst && worst.sev === "sore" ? worst : {j, sev}; });
      if (!worst) return;
      if (worst.sev === "mild" && it.main) { it.jointLoad = 0.8; it.jointWhy = JOINT_NAME[worst.j]; return; }
      const limit = {}; act.forEach(([j, sev]) => { limit[j] = sev === "sore" ? 0 : 1; });
      // Same movement first; then a related one in the same body area (legs → hip moves, presses → rows); then gentle basics.
      const tryPats = [it.pat, ...(RELATED[it.pat] || [])];
      let alt = null;
      for (const pt of tryPats) { alt = candidates(pt, {limit}).find(c => !taken.has(c.name)); if (alt) break; }
      alt = alt || SAFE_POOL.map(n => BYNAME[n]).find(c => c && !taken.has(c.name) && [...c.eq].some(e => eqSet().has(e)) && Object.entries(limit).every(([j, max]) => (c.j[j] || 0) <= max));
      if (!alt) { it.drop = true; return; }
      taken.add(alt.name);
      it.jointFrom = it.name; it.jointWhy = JOINT_NAME[worst.j]; it.name = alt.name; it.pat = alt.pat; it.side = alt.side;
      it.reps = repsFor(alt.name, it.main, 1); it.base = Math.min(it.base, 90);
    });
    for (let i = items.length - 1; i >= 0; i--) if (items[i].drop) items.splice(i, 1);
  }

  // ================= building a session =================
  // mode from the check-in light: null (green), "yellow", "light" (red day, light version), "recovery", "stop"
  function buildSession(w, sp, mode, joints) {
    const B = budget(), rows = [];
    const ck = cardioKind(sp, joints), cardioName = CARDIO_NAME[ck];
    curCardio = ck;
    const mob = mobilityFor(sp, B.mob, joints);
    if (mode === "stop") { rows.end = 0; return rows; }
    if (mode === "recovery") {
      rows.push({fixed: true, start: 0, track: "mobility", plan: 10, name: "Mobility: easy stretching", meta: "10 min · " + mob + " · Slow nose breathing 1 min"});
      rows.push({fixed: true, start: 10, track: "cardio", ctype: ck, plan: 25, eff: 3, name: ck === "swim" ? "Swim, freestyle" : ck === "walk" ? "Easy walk" : cardioName,
        meta: "20–30 min, " + zoneTxt() + ". Easy is the point today."});
      rows.end = 0; return rows;
    }
    const items = liftsFor(w, sp);
    jointAdjust(items, joints);
    if (mode === "yellow") items.forEach(it => { if (it.main) it.sets = Math.max(2, it.sets - 1); });
    if (mode === "light") items.forEach(it => { it.sets = 2; });
    fit(items, B.lift);
    rows.push({fixed: true, start: 0, name: "Warm-up", meta: B.warm + " min · Easy cardio until you're warm, then a light practice set of the first exercise"});
    let t = B.warm * 60;
    items.forEach(it => {
      t += it.ramp;
      rows.push({name: it.name, sets: it.sets, reps: it.reps, rest: it.rest, start: t / 60, ramp: it.ramp / 60, main: it.main,
        stepFrom: it.stepFrom, jointFrom: it.jointFrom, jointLoad: it.jointLoad, jointWhy: it.jointWhy});
      t += it.sets * workSec(it) + (it.sets - 1) * it.rest + CHANGE;
    });
    const end = t / 60, liftEnd = Math.ceil(end);
    const steady = w === 4 || mode === "yellow" || easyStart() || level() === 0 || ageNum() >= 65;
    const kneeNow = permJoints().includes("k") || (joints && joints.k);
    const machine = P().gym === "yes" ? (kneeNow || permJoints().includes("b") ? "Bike" : "Bike or rower") : hasPool() ? "Swim" : "Fast marching in place or brisk walking";
    const fin = mode === "light" || (joints && joints.k === "sore") ? 0 : B.fin;
    let at = liftEnd;
    if (fin) {
      rows.push({fixed: true, start: at, track: "finisher", plan: fin, eff: steady ? 5 : 7, name: "Fat-burn finisher", meta: fin + " min · " + (steady
        ? `${machine} at a steady, comfortable push, no all-out effort`
        : `${machine}: 6 rounds of 30 sec hard, 30 sec easy. Hard means 7 out of 10, never all-out. Keep breathing.`)});
      at += fin;
    }
    rows.push({fixed: true, start: at, track: "mobility", plan: B.mob, name: "Mobility: stretch what you trained", meta: B.mob + " min · " + mob});
    at += B.mob;
    if (B.cardio) {
      rows.push({fixed: true, start: at, name: "Water break, get to " + (ck === "walk" ? "your walk" : "the " + (ck === "swim" ? "pool" : cardioName.toLowerCase())), meta: B.change + " min"});
      rows.push({fixed: true, start: at + B.change, track: "cardio", ctype: ck, plan: B.cardio, eff: 5, name: cardioName, meta: B.cardio + " min · " + zoneTxt() + "."
        + (ck === "swim" && joints && joints.k === "sore" ? " Use a pull buoy if kicking bothers the knee." : "")});
    }
    afterLift = [fin ? `${fin}-minute finisher` : "", `${B.mob} minutes of stretching`, B.cardio ? cardioName.toLowerCase() : ""].filter(Boolean).join(", then ");
    afterLiftSay = fin ? "Finisher next, then stretch." : "Stretch next.";
    rows.end = end;
    return rows;
  }

  // ================= progression (same rules as the original log) =================
  function setsOf(body, name) {
    if (!body || !body.sets) return [];
    if (body.sets[name]) return body.sets[name];
    const bn = baseName(name), k = Object.keys(body.sets).find(x => baseName(x) === bn);
    return k ? body.sets[k] : [];
  }
  // Weight to add after a clean session. Big lower-body lifts add about 5% of the weight (at least 5 lb),
  // so a light squat goes up 5 lb and a heavy one 10–15 lb; everything else adds 5 lb (the smallest dumbbell step).
  function incFor(n, w) {
    if (/lunge|step-up|split squat|goblet|dumbbell/i.test(n)) return 5;
    if (!/squat|deadlift|leg press|hip thrust/i.test(n)) return 5;
    return typeof w === "number" && w > 0 ? round5(w * 0.05) : 5;
  }
  function historyFor(name, currentId) {
    const bn = baseName(name), out = [];
    for (const [id, s] of Object.entries(sessions)) {
      if (id === currentId || !s || !s.sets) continue;
      const done = setsOf(s, bn).filter(x => x && (x.w != null || x.r != null));
      if (!done.length) continue;
      const plan = (s.plan && (s.plan[bn] || s.plan[name])) || null;
      out.push({id, week: s.week, t: s.updatedAt || 0, date: s.date || "", sets: done, plan,
        light: s.readiness === "light" || (s.jointAdj || []).includes(bn)});
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
  }
  function judge(h, bn) {
    const p = h.plan || {sets: h.sets.length, reps: 0};
    const ws = h.sets.map(x => x.w).filter(v => typeof v === "number" && v > 0);
    // The weight they really used counts, not the suggestion: someone who typed 50 when the target said 20 builds from 50.
    const allWeighed = ws.length && ws.length === h.sets.length;
    const usedW = isBW(bn) ? null : allWeighed ? Math.min(...ws) : typeof p.w === "number" ? p.w : (ws.length ? Math.min(...ws) : null);
    const hit = h.sets.length >= (p.sets || 1) && h.sets.every(x => (x.r || 0) >= (p.reps || 0) && (usedW == null || (typeof x.w === "number" && x.w >= usedW)));
    const rs = h.sets.map(x => +x.r || 0);
    return {usedW, hit, reps: p.reps || 0, sets: p.sets || h.sets.length,
      minR: rs.length ? Math.min(...rs) : 0, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0};
  }
  function targetFor(name, repsTxt, wk, currentId) {
    const bn = baseName(name), tReps = parseInt(repsTxt, 10) || 0, timed = /sec/.test(repsTxt);
    const work = historyFor(name, currentId).filter(h => h.week !== 4 && !h.light);
    if (wk === 4 && isBW(bn)) return {w: null, reps: tReps, kind: "deload", msg: "Easy week: easy sets, stop well short of your limit"};
    if (wk === 4) {
      const last = work.length ? judge(work[work.length - 1], bn) : null, base = last && last.usedW != null ? last.usedW : null;
      return {w: base != null ? round5(base * 0.6) : null, reps: tReps, kind: "deload", msg: base != null ? `Easy week: about 60% of your ${base} lb` : "Easy week: go light, about 60% of your usual weight"};
    }
    if (!work.length && isBW(bn)) return {w: null, reps: tReps, kind: "new", msg: "First time: do every set with good form, stop 2 reps short of your limit"};
    if (!work.length) return {w: null, reps: tReps, kind: "new", msg: "First time: pick a weight you can lift for every set with 2–3 reps to spare"};
    const a = judge(work[work.length - 1], bn);
    const unit = timed ? "sec" : "reps";
    if (a.usedW == null) {
      const prev = Math.max(tReps, a.reps), cap = timed ? 90 : 20;
      if (a.hit) {
        const add = timed ? 5 : 1;
        if (prev >= cap) return {w: null, reps: cap, kind: "hold", msg: timed ? `Top of the range at ${cap} sec. Keep it here and squeeze harder, or move to a tougher variation` : `Top of the range at ${cap} reps. Make it harder: lower for 3 seconds on every rep`};
        return {w: null, reps: Math.min(cap, prev + add), kind: "up", msg: `You hit every set last time. Add ${add} ${timed ? "sec" : "rep"} per set`};
      }
      // Well short (under 70% of the target on average): meet them where they are and build back up.
      if (a.reps && a.avgR < a.reps * 0.7) {
        const r0 = Math.max(timed ? 10 : 3, Math.round(a.avgR));
        return {w: null, reps: r0, kind: "down", msg: `Last time averaged ${Math.round(a.avgR)} of ${a.reps} ${unit}. Today's target matches that, then it climbs again`};
      }
      return {w: null, reps: prev, kind: "hold", msg: "Hold here until you finish every set"};
    }
    // Far more reps than asked on every set: the weight is too light, so jump toward the weight that fits the target
    // (estimated with the Epley formula), up to +25%, or +50% when every set beat the target by 6 or more.
    const want = Math.max(tReps, a.reps);
    if (a.hit && !timed && want && a.minR >= want + 3) {
      const fitW = round5(a.usedW * (1 + a.minR / 30) / (1 + tReps / 30));
      const capW = round5(a.usedW * (a.minR >= want + 6 ? 1.5 : 1.25)), inc = incFor(bn, a.usedW);
      const next = Math.max(a.usedW + inc, Math.min(fitW, capW));
      if (next > a.usedW + inc) return {w: next, reps: tReps, kind: "up", from: a.usedW, msg: `+${next - a.usedW} lb. You did ${a.minR}+ reps on every set at ${a.usedW} lb, so that was too light`};
    }
    if (a.hit && a.reps && tReps > a.reps) return {w: a.usedW, reps: tReps, kind: "hold", msg: `Same ${a.usedW} lb: more reps today (${tReps} vs ${a.reps} last time)`};
    if (a.hit) { const inc = incFor(bn, a.usedW); return {w: a.usedW + inc, reps: tReps, kind: "up", from: a.usedW, msg: `+${inc} lb. You hit all ${a.sets} sets at ${a.usedW} lb last time`}; }
    // Well short of the reps (under 70% on average): too heavy, so drop 10% now instead of waiting for a second miss.
    if (a.reps && a.avgR < a.reps * 0.7) return {w: round5(a.usedW * 0.9), reps: tReps, kind: "down", msg: `Last time averaged ${Math.round(a.avgR)} of ${a.reps} reps at ${a.usedW} lb. Drop 10% and build back up`};
    const b = work.length > 1 ? judge(work[work.length - 2], bn) : null;
    if (b && !b.hit && b.usedW === a.usedW) return {w: round5(a.usedW * 0.9), reps: tReps, kind: "down", msg: `Missed at ${a.usedW} lb twice. Drop 10% and build back up`};
    return {w: a.usedW, reps: tReps, kind: "hold", msg: `Stay at ${a.usedW} lb until you hit every set`};
  }
  function lastFor(name, currentId) {
    let best = null;
    for (const [id, s] of Object.entries(sessions)) {
      if (id === currentId || !s.sets) continue;
      const done = setsOf(s, name).filter(x => x && (x.w || x.r));
      if (done.length && (!best || (s.updatedAt || 0) > best.t)) best = {t: s.updatedAt || 0, sets: done};
    }
    return best;
  }

  // ================= weeks =================
  const hasData = (b) => !!(b && b.sets && Object.values(b.sets).some(a => (a || []).some(x => x && (x.w != null || x.r != null || x.done))));
  function weekLogged(w) {
    const pre = "c" + settings.cycle + "-w" + w + "-", out = [];
    for (const [id, b] of Object.entries(sessions)) if (id.startsWith(pre) && hasData(b)) out.push({key: id.slice(pre.length), date: b.date || "", body: b});
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function weekStart(w) { const l = weekLogged(w).filter(x => x.date); return l.length ? l[0].date : null; }
  function currentProgramWeek() {
    const thisMon = mondayOf(today()); let latest = 0;
    for (let w = 1; w <= 4; w++) { const st = weekStart(w); if (!st) continue; if (mondayOf(st) === thisMon) return w; if (mondayOf(st) < thisMon) latest = w; }
    return Math.min(4, latest + 1);
  }
  const titleOf = (key) => (plan().find(s => s.key === key) || {title: key}).title;
  const WEEK_NOTE = {1: "Base week", 2: "More volume", 3: "Harder week", 4: "Easy week, about 60%"};

  // ================= morning check-in =================
  const ciId = (d) => "checkin-" + d;
  const ciToday = () => checkins[ciId(today())] || null;
  function ciBaseline(date) {
    const prior = Object.values(checkins).filter(c => c && c.date && c.date < date).sort((a, b) => b.date.localeCompare(a.date));
    const avg = (k) => { const v = prior.map(c => c[k]).filter(x => typeof x === "number" && x > 0).slice(0, 7);
      return {avg: v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length}; };
    return {hrv: avg("hrv"), rhr: avg("rhr")};
  }
  function scoreCheckin(c) {
    const b = ciBaseline(c.date), flags = []; let stop = "";
    if (c.symptoms) stop = "You marked chest pressure, unusual breathlessness or dizziness.";
    else if (c.sys >= 180 || c.dia >= 110) stop = `Blood pressure ${c.sys || "–"}/${c.dia || "–"} is too high to train.`;
    if (typeof c.sleep === "number" && c.sleep < 6) flags.push(`Sleep ${c.sleep} h, under 6`);
    if (hrNumbersOk() && c.rhr && b.rhr.avg != null && c.rhr >= b.rhr.avg + 7) flags.push(`Resting HR ${c.rhr}, ${Math.round(c.rhr - b.rhr.avg)} above your 7-day average of ${Math.round(b.rhr.avg)}`);
    if (hrNumbersOk() && c.hrv && b.hrv.avg != null && c.hrv <= b.hrv.avg * 0.85) flags.push(`HRV ${c.hrv} ms, ${Math.round(100 * (1 - c.hrv / b.hrv.avg))}% below your 7-day average of ${Math.round(b.hrv.avg)}`);
    if (!stop && (c.sys >= 160 || c.dia >= 100)) flags.push(`Blood pressure ${c.sys || "–"}/${c.dia || "–"}, at or above 160/100`);
    if (c.energy && c.energy <= 2) flags.push(`Energy ${c.energy} out of 5`);
    return {light: stop ? "stop" : flags.length >= 2 ? "red" : flags.length === 1 ? "yellow" : "green", flags, stop};
  }
  const LIGHTS = {
    green: {name: "Green", head: "Full plan today", plan: "Run the session as written and go for every target."},
    yellow: {name: "Yellow", head: "Train, but hold back", plan: "One fewer set on the main lift, no weight increases, effort about 7 out of 10, and a steady finisher instead of intervals."},
    red: {name: "Red", head: "Recovery day", plan: "No heavy lifting. Easy stretching, then 20–30 minutes of easy cardio. Today's session waits for your next training day."},
    stop: {name: "Stop", head: "No training today", plan: "Sit and rest 5 minutes, then recheck and score again. Blood pressure still 180/110 or higher: call your doctor today. Chest pain or pressure, trouble breathing or fainting: call 911."}
  };
  const isTodaySession = (sp, body) => body && body.date ? body.date === today() : week === currentProgramWeek();
  function sessionMode(sp, body) {
    const c = ciToday();
    if (!c || !isTodaySession(sp, body)) return null;
    if (c.light === "yellow") return "yellow";
    if (c.light === "red") return c.choice === "light" ? "light" : "recovery";
    if (c.light === "stop") return "stop";
    return null;
  }
  function jointsToday() {
    const c = ciToday(), j = {};
    if (c && c.joints) for (const k of ["k", "b", "s"]) if (c.joints[k] === "mild" || c.joints[k] === "sore") j[k] = c.joints[k];
    return j;
  }
  const numIn = (id) => { const e = $(id); if (!e) return null; const x = parseFloat(e.value); return isFinite(x) && x > 0 ? x : null; };
  const radioVal = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value || null;

  function renderCheckin() {
    const el = $("checkin");
    if (!profile || editingProfile) { el.hidden = true; return; }
    el.hidden = false;
    const c = ciToday(), formMode = !c || ciEditing, p = P(), wm = p.watchMetrics || [];
    const b = ciBaseline(today());
    const useHR = hrNumbersOk() && (wm.includes("hrv") || wm.includes("rhr"));
    const baseTxt = !useHR ? "" : b.hrv.avg != null || b.rhr.avg != null
      ? `Your 7-day averages: HRV ${b.hrv.avg != null ? Math.round(b.hrv.avg) + " ms" : "not enough yet"} · resting HR ${b.rhr.avg != null ? Math.round(b.rhr.avg) + " bpm" : "not enough yet"}.`
      : `Building your baseline: ${Math.max(b.hrv.n, b.rhr.n)} of 3 mornings logged. Heart numbers start counting after 3.`;
    if (formMode && el.dataset.mode === "form") { const n = $("ciBase"); if (n) n.textContent = baseTxt; return; }
    el.dataset.mode = formMode ? "form" : "result";
    if (formMode) {
      const v = (k) => c && c[k] != null ? esc(c[k]) : "";
      const field = (id, label, unit, ph, key, mode) => `<label class="ci-field"><span class="label">${label}</span><span class="field"><input id="${id}" type="number" inputmode="${mode || "numeric"}" step="${mode === "decimal" ? "0.1" : "1"}" min="0" value="${v(key)}" placeholder="${ph}"><span>${unit}</span></span></label>`;
      const fields = [field("ciSleep", p.watch === "yes" && wm.includes("sleep") ? "Sleep (from your watch)" : "Sleep (your best guess)", "hours", "7.0", "sleep", "decimal")];
      if (p.watch === "yes" && wm.includes("hrv")) fields.push(field("ciHrv", "Overnight HRV", "ms", "35", "hrv"));
      if (p.watch === "yes" && wm.includes("rhr")) fields.push(field("ciRhr", "Resting heart rate", "bpm", "60", "rhr"));
      if (p.cuff === "yes") { fields.push(field("ciSys", "BP top number", "sys", "125", "sys")); fields.push(field("ciDia", "BP bottom number", "dia", "80", "dia")); }
      const energy = [1, 2, 3, 4, 5].map(n => `<label class="ci-pill"><input type="radio" name="ciEnergy" id="ciEnergy-${n}" value="${n}" ${(c && c.energy ? c.energy : 3) === n ? "checked" : ""}><span>${n}</span></label>`).join("");
      const joints = ["k", "b", "s"].map(j => `<div class="ci-jrow"><span class="ci-jname">${{k: "Knees", b: "Lower back", s: "Shoulders"}[j]}</span><div class="ci-pills">${
        [["none", "Fine"], ["mild", "Mild"], ["sore", "Sore"]].map(([val, t]) => `<label class="ci-pill"><input type="radio" name="ciJ-${j}" id="ciJ-${j}-${val}" value="${val}" ${((c && c.joints && c.joints[j]) || "none") === val ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></div>`).join("");
      el.innerHTML = `<span class="label">Before you train · ${esc(niceDate(today()))}</span>
        <h3>Morning check-in</h3>
        <p class="ci-help">${p.watch === "yes" ? "Take sleep and the overnight numbers from your watch app after it syncs. " : ""}${p.cuff === "yes" ? "Blood pressure: before coffee and morning pills, seated 5 minutes, two readings 1 minute apart, enter the average. " : ""}Leave blank anything you don't have.</p>
        <div class="ci-grid">${fields.join("")}</div>
        <fieldset class="ci-knee"><legend class="label">Energy right now (1 = wiped out, 5 = great)</legend><div class="ci-pills">${energy}</div></fieldset>
        <fieldset class="ci-knee"><legend class="label">Any joint discomfort this morning? Mild = achy or stiff. Sore = sharp pain, swelling or giving way.</legend>${joints}</fieldset>
        <label class="ci-check"><input type="checkbox" id="ciSym" ${c && c.symptoms ? "checked" : ""}><span>Right now I have chest pressure, unusual breathlessness or dizziness</span></label>
        ${baseTxt ? `<p class="ci-base" id="ciBase">${esc(baseTxt)}</p>` : ""}
        <div class="ci-btns"><button type="button" class="btn" id="ciScore">Score my morning</button>${c ? `<button type="button" class="btn alt" id="ciCancel">Cancel</button>` : ""}</div>
        <span class="meta" id="ciMsg"></span>${trendHtml()}`;
      return;
    }
    const L = LIGHTS[c.light] || LIGHTS.green, jt = jointsToday();
    const jtxt = Object.keys(jt).length ? `<p class="ci-plan"><b>Joints:</b> ${Object.entries(jt).map(([j, s]) => JOINT_NAME[j] + " " + s).join(", ")}. Exercises that load ${Object.keys(jt).length > 1 ? "them" : "it"} are swapped or lighter today.</p>` : "";
    el.innerHTML = `<span class="label">Morning check-in · ${esc(niceDate(today()))}</span>
      <div class="light ${c.light}" role="status"><span class="lamp" aria-hidden="true"></span><span class="lt"><b>${L.name}</b><span class="lh">${esc(L.head)}</span></span></div>
      ${c.stop ? `<p class="ci-plan"><b>${esc(c.stop)}</b></p>` : ""}
      ${(c.flags || []).length ? `<ul class="ci-flags">${c.flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : c.light === "green" ? `<p class="ci-plan"><b>No flags.</b> You're good to go.</p>` : ""}
      <p class="ci-plan">${esc(L.plan)}</p>${jtxt}
      <div class="ci-btns">${c.light !== "stop" ? `<button type="button" class="btn" id="shareDay">Share today's call</button>` : ""}<button type="button" class="btn alt" id="ciEdit">Change answers</button></div>${trendHtml()}`;
  }
  function trendHtml() {
    const list = Object.values(checkins).filter(c => c && c.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    if (!list.length) return "";
    const cols = [["sleep", "Sleep h"], ...(hrNumbersOk() ? [["hrv", "HRV"], ["rhr", "RHR"]] : []), ["energy", "Energy"]];
    const rows = list.map(c => `<tr><td>${esc(niceDate(c.date))}</td>${cols.map(([k]) => `<td class="n">${c[k] ?? "–"}</td>`).join("")}${P().cuff === "yes" ? `<td class="n">${c.sys ? c.sys + "/" + (c.dia ?? "–") : "–"}</td>` : ""}<td><span class="dot-l ${esc(c.light || "")}"></span>${esc((LIGHTS[c.light] || {}).name || "")}</td></tr>`).join("");
    return `<details class="ci-trend"><summary>Last ${list.length} morning${list.length > 1 ? "s" : ""}</summary>
      <div class="ci-tablewrap"><table class="ci-table"><thead><tr><th>Day</th>${cols.map(([, t]) => `<th>${t}</th>`).join("")}${P().cuff === "yes" ? "<th>BP</th>" : ""}<th>Light</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }
  async function saveCheckin(c) {
    checkins[ciId(c.date)] = c;
    try { if (store) await store.save(ciId(c.date), c); } catch (e) { setStatus("Couldn't save your check-in. Check your connection and score again.", "warn"); }
  }
  function scoreFromForm() {
    const c = {kind: "checkin", date: today(), sleep: numIn("ciSleep"), hrv: numIn("ciHrv"), rhr: numIn("ciRhr"), sys: numIn("ciSys"), dia: numIn("ciDia"),
      energy: +radioVal("ciEnergy") || null, symptoms: !!($("ciSym") && $("ciSym").checked),
      joints: {k: radioVal("ciJ-k") || "none", b: radioVal("ciJ-b") || "none", s: radioVal("ciJ-s") || "none"}};
    const prev = ciToday(), s = scoreCheckin(c);
    Object.assign(c, {light: s.light, flags: s.flags, stop: s.stop, choice: prev && prev.light === "red" && s.light === "red" ? prev.choice || null : null, savedAt: Date.now()});
    ciEditing = false; $("checkin").dataset.mode = "";
    saveCheckin(c); renderCheckin(); renderSession();
    try { $("checkin").scrollIntoView({block: "start", behavior: "smooth"}); } catch (e) {}
  }
  function adjustBanner(mode, sp) {
    const L = ciToday();
    if (mode === "yellow") return `<div class="adjust yellow"><span class="label">Adjusted by your morning check-in</span><h3>Yellow day</h3>
      <p>${esc((L.flags || [])[0] || "")}.</p><p>One fewer set on the main lift, no weight increases today, steady finisher. Effort about 7 out of 10: stop each set with 3 reps left.</p></div>`;
    if (mode === "recovery") return `<div class="adjust recovery"><span class="label">Adjusted by your morning check-in</span><h3>Red day: recovery instead</h3>
      <p>${esc((L.flags || []).join(". "))}.</p><p>${esc(sp.title)} isn't logged today, so it waits for your next training day. Nothing you skip today lowers your weights.</p>
      <div class="ci-btns"><button type="button" class="btn alt" id="ciLightOn">Do a light version instead</button></div></div>`;
    if (mode === "light") return `<div class="adjust light"><span class="label">Adjusted by your morning check-in</span><h3>Red day: light version</h3>
      <p>2 easy sets per exercise at about 60% of target, no finisher. These sets don't count toward weight increases or drops.</p>
      <div class="ci-btns"><button type="button" class="btn alt" id="ciLightOff">Switch back to recovery</button></div></div>`;
    if (mode === "stop") return `<div class="adjust stop"><span class="label">From your morning check-in</span><h3>No training today</h3><p>${esc(L.stop || "")}</p><p>${esc(LIGHTS.stop.plan)}</p></div>`;
    return "";
  }
  function jointBanner(joints, rows, mode) {
    if (!Object.keys(joints).length || mode === "stop") return "";
    const swaps = rows.filter(r => r.jointFrom).map(r => `${r.jointFrom} → ${r.name}`), lighter = rows.filter(r => r.jointLoad).map(r => r.name);
    const sore = Object.values(joints).includes("sore"), parts = [];
    if (swaps.length) parts.push("Swapped: " + swaps.join(", ") + ".");
    if (lighter.length) parts.push(`Kept but lighter: ${lighter.join(", ")} at about 80%, only through a pain-free range.`);
    if (!swaps.length && !lighter.length) parts.push("Nothing in today's lifts loads it hard, so the lifts stay. Stop any set that hurts.");
    return `<div class="adjust ${sore ? "light" : "yellow"}"><span class="label">Adjusted for your ${Object.keys(joints).map(j => JOINT_NAME[j]).join(" and ")}</span>
      <h3>${sore ? "Sore joint: protect it today" : "Achy joint: joint-friendly day"}</h3><p>${esc(parts.join(" "))}</p>
      <p>Cardio and stretches avoid loading it too. These sets don't count toward weight increases or drops.</p>
      ${sore ? `<p><b>Get it checked</b> if it's swollen, locks or gives way, or you can't put full weight on it.</p>` : ""}</div>`;
  }

  // ================= setup form =================
  // The restore panel lives in "Your data" at the bottom of the main screen. On a fresh install the main screen is hidden
  // behind setup, so it's moved onto the setup screen (and back again once there's a profile).
  function dockRestore(toSetup) {
    const host = toSetup ? $("suRestoreBox") : document.querySelector(".savebar");
    if (!host || $("restorePanel").parentNode === host) return;
    if (toSetup) host.append($("restorePanel"), $("restoreConfirm"), $("saveStatus"));
    else { $("backupPanel").after($("restorePanel"), $("restoreConfirm")); host.append($("saveStatus")); }
  }
  function renderSetup() {
    const el = $("setup"), show = !profile || editingProfile;
    el.hidden = !show; $("main").hidden = show;
    if (!show) { dockRestore(false); return; }
    if (el.dataset.ready === "1") return;          // don't wipe answers mid-typing on a background sync
    dockRestore(false);
    el.dataset.ready = "1";
    const p = profile || {};
    const radios = (name, opts, cur) => `<div class="ci-pills wrap">${opts.map(([v, t]) => `<label class="ci-opt"><input type="radio" name="${name}" id="${name}-${v}" value="${v}" ${cur === v ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>`;
    const checks = (name, opts, cur) => `<div class="ci-pills wrap">${opts.map(([v, t]) => `<label class="ci-opt"><input type="checkbox" name="${name}" id="${name}-${v}" value="${v}" ${(cur || []).includes(v) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>`;
    const yn = (name, cur) => radios(name, [["yes", "Yes"], ["no", "No"]], cur);
    const q = (title, body, id) => `<div class="sq" ${id ? `id="${id}"` : ""}><p class="sq-t">${title}</p>${body}</div>`;
    el.innerHTML = `
      <header class="hero"><span class="hero-eyebrow">Strength · Flexibility · Fat loss · Heart</span><h1>Daily Training Coach</h1><div class="lane" aria-hidden="true"></div>
        <p class="sub">${editingProfile ? "Change any answer and tap Save. Your plan rebuilds; your logged history stays." : "Answer a few questions and the app builds your 4-week plan. Every morning a quick check-in adjusts that day. About 3 minutes."}</p></header>
      ${profile ? "" : `<section class="card su" id="suRestoreBox"><p class="ci-help"><b>Used this app before?</b> Restore your backup instead and skip the questions.</p>
        <div class="ci-btns"><button type="button" class="btn alt" id="suRestore">Restore a backup</button></div></section>`}
      <section class="card su"><h2>About you</h2>
        ${q("Your first name (optional)", `<span class="field"><input id="suName" type="text" autocomplete="given-name" value="${esc(p.name || "")}" placeholder="Name"></span>`)}
        ${q("Your age", `<span class="field"><input id="suAge" type="number" inputmode="numeric" min="18" max="100" value="${esc(p.age || "")}" placeholder="Age"><span>years</span></span>`)}
      </section>
      <section class="card su"><h2>Health check</h2><p class="ci-help">Standard questions asked before starting exercise. A "yes" doesn't stop you; it starts you on an easy plan until a doctor says you're clear.</p>
        ${SCREEN.map(([k, t]) => q(t, yn("suS-" + k, p.screen && p.screen[k]))).join("")}
        ${q("If you answered yes to any: has a doctor cleared you for exercise?", radios("suCleared", [["yes", "Yes, I'm cleared"], ["no", "Not yet"]], p.cleared ? "yes" : p.screen ? "no" : null))}
        ${q("Do you take a beta-blocker (like metoprolol, atenolol, carvedilol or propranolol)?", radios("suBeta", [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]], p.betaBlocker))}
      </section>
      <section class="card su"><h2>Your devices</h2>
        ${q("Do you wear a health watch or band?", yn("suWatch", p.watch))}
        ${q("Which of these does it show you each morning?", checks("suWM", [["sleep", "Sleep hours"], ["hrv", "Overnight HRV"], ["rhr", "Resting heart rate"]], p.watchMetrics), "suWMq")}
        ${q("Do you have a blood pressure cuff at home?", yn("suCuff", p.cuff))}
      </section>
      <section class="card su"><h2>Your training</h2>
        ${q("In the last 3 months, how often have you worked out?", radios("suRecent", [["none", "Not at all"], ["some", "1–2 times a week"], ["regular", "3 or more times a week"]], p.recent))}
        ${q("How much weight-lifting experience do you have?", radios("suExp", [["new", "New to it"], ["some", "Some"], ["experienced", "Experienced"]], p.experience))}
        ${q("What are your goals? Pick all that fit.", checks("suGoals", GOALS, p.goals || ["fat", "strength", "flex", "heart"]))}
        ${q("How many days a week can you train?", radios("suDays", [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]], p.days ? String(p.days) : "3"))}
        ${q("How long is each session?", radios("suMin", [["30", "30 min"], ["45", "45 min"], ["60", "60 min"], ["75", "75 min"], ["90", "90 min"]], p.minutes ? String(p.minutes) : "60"))}
      </section>
      <section class="card su"><h2>Where you train</h2>
        ${q("Do you have access to a full gym?", yn("suGym", p.gym))}
        ${q("At home, what do you have?", checks("suHome", [["dumbbells", "Dumbbells"], ["bands", "Resistance bands"]], p.home), "suHomeq")}
        ${q("Do you have access to a pool?", yn("suPool", p.pool))}
        ${q("Can you swim laps comfortably?", yn("suSwims", p.swims), "suSwimsq")}
        ${q("Any ongoing joint problems? The plan leaves out the moves that load them hardest.", checks("suJoints", [["k", "Knees"], ["b", "Lower back"], ["s", "Shoulders"]], p.joints))}
      </section>
      <p class="ci-help">This app gives general exercise guidance, not medical advice. Stop and get checked for chest pain or pressure, jaw or arm pain, fainting or unusual breathlessness.</p>
      <div class="ci-btns"><button type="button" class="btn" id="suSave">${editingProfile ? "Save and rebuild my plan" : "Build my plan"}</button>${editingProfile ? `<button type="button" class="btn alt" id="suCancel">Cancel</button>` : ""}</div>
      <p class="status warn" id="suMsg"></p>`;
    setupVisibility();
  }
  function setupVisibility() {
    const w = radioVal("suWatch"), g = radioVal("suGym"), pool = radioVal("suPool");
    const show = (id, on) => { const e = $(id); if (e) e.hidden = !on; };
    show("suWMq", w === "yes"); show("suHomeq", g === "no"); show("suSwimsq", pool === "yes");
  }
  function readSetup() {
    const list = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x => x.value);
    const age = parseInt($("suAge").value, 10);
    const screen = {}; SCREEN.forEach(([k]) => { screen[k] = radioVal("suS-" + k); });
    const missing = [];
    if (!age) missing.push("your age");
    if (SCREEN.some(([k]) => !screen[k])) missing.push("every health check question");
    if (!radioVal("suWatch")) missing.push("whether you wear a health watch");
    if (!radioVal("suCuff")) missing.push("whether you have a BP cuff");
    if (!radioVal("suRecent")) missing.push("how often you've worked out");
    if (!radioVal("suExp")) missing.push("your lifting experience");
    if (!list("suGoals").length) missing.push("at least one goal");
    if (!radioVal("suGym")) missing.push("whether you have a gym");
    if (!radioVal("suPool")) missing.push("whether you have a pool");
    if (missing.length) return {error: "Still needed: " + missing.join(", ") + "."};
    if (age < 18) return {error: "This app is built for adults 18 and over."};
    if (age > 100) return {error: "Check your age and try again."};
    return {value: {kind: "profile", schema: 1, name: $("suName").value.trim().slice(0, 40), age, screen,
      cleared: radioVal("suCleared") === "yes", betaBlocker: radioVal("suBeta") || "no",
      watch: radioVal("suWatch"), watchMetrics: radioVal("suWatch") === "yes" ? list("suWM") : [], cuff: radioVal("suCuff"),
      recent: radioVal("suRecent"), experience: radioVal("suExp"), goals: list("suGoals"), days: +radioVal("suDays") || 3, minutes: +radioVal("suMin") || 60,
      gym: radioVal("suGym"), home: radioVal("suGym") === "no" ? list("suHome") : [], pool: radioVal("suPool"), swims: radioVal("suPool") === "yes" ? (radioVal("suSwims") || "yes") : "no",
      joints: list("suJoints"), updatedAt: Date.now(), createdAt: (profile && profile.createdAt) || Date.now()}};
  }
  async function saveSetup() {
    const r = readSetup();
    if (r.error) { $("suMsg").textContent = r.error; return; }
    profile = r.value; editingProfile = false; $("setup").dataset.ready = "";
    try { if (store) await store.save("profile", profile); } catch (e) { setStatus("Couldn't save your setup. Check your connection and try again.", "warn"); }
    week = currentProgramWeek(); dayKey = null; renderAll();
    try { window.scrollTo({top: 0, behavior: "smooth"}); } catch (e) {}
  }

  // ================= main screen =================
  function summaryTxt() {
    const p = P(), B = budget(), eq = p.gym === "yes" ? "full gym" : (p.home || []).length ? "home: " + p.home.join(" and ") : "no equipment";
    const goals = (p.goals || []).map(g => (GOALS.find(x => x[0] === g) || [0, g])[1].toLowerCase()).join(", ");
    return `${LEVEL_NAME[level()]} plan · ${plan().length} days a week · ${B.M} min (${B.lift} lifting${B.fin ? `, ${B.fin} finisher` : ""}, ${B.mob} stretching${B.cardio ? `, ${B.cardio} cardio` : ""}) · ${eq}${hasPool() ? " + pool" : ""} · goals: ${goals}`;
  }
  function renderHeader() {
    const p = P();
    $("hello").textContent = p.name ? `${p.name}'s training` : "Your training";
    $("planSummary").textContent = summaryTxt();
    $("easyBanner").hidden = !easyStart();
  }
  function renderWeek() {
    $("weekSeg").innerHTML = [1, 2, 3, 4].map(w => `<button type="button" id="wk${w}" aria-pressed="${w === week}" data-w="${w}">Week ${w}</button>`).join("");
    $("cycleLabel").textContent = "· cycle " + settings.cycle;
  }
  function renderTabs() {
    const sp = plan();
    if (!sp.find(s => s.key === dayKey)) {
      const loggedToday = sp.find(s => (sessions[sid(settings.cycle, week, s.key)] || {}).date === today());
      dayKey = (loggedToday || sp.find(s => !hasData(sessions[sid(settings.cycle, week, s.key)])) || sp[0]).key;
    }
    $("dayTabs").innerHTML = sp.map((s, i) => {
      const body = sessions[sid(settings.cycle, week, s.key)], logged = hasData(body);
      const mark = logged ? `<span class="dot">✓ ${body.date ? esc(niceDate(body.date)) : "logged"}</span>` : '<span class="meta">&nbsp;</span>';
      return `<button type="button" id="day-${s.key}" aria-pressed="${s.key === dayKey}" data-k="${s.key}"><span class="label">Day ${i + 1}</span><b>${esc(s.title)}</b>${mark}</button>`;
    }).join("");
  }
  function extraLine() {
    const xs = Object.values(extras).filter(x => x && x.week === week && (x.cycle || 1) === settings.cycle);
    const cMin = xs.reduce((a, x) => a + (x.cardio && typeof x.cardio.min === "number" ? x.cardio.min : 0), 0);
    const fins = xs.filter(x => x.finisher && (x.finisher.done || x.finisher.min)).length;
    const st = xs.filter(x => x.mobility && (x.mobility.done || x.mobility.min || (x.mobility.stretches || []).length)).length;
    return `<p class="wk-extra">Cardio this week: <b>${cMin} min</b> · Finishers: <b>${fins}</b> · Stretching: <b>${st} of ${plan().length} days</b></p>`;
  }
  function renderWeekCard() {
    const sp = plan(), done = sp.filter(s => hasData(sessions[sid(settings.cycle, week, s.key)])).length;
    const st = weekStart(week), next = sp.find(s => !hasData(sessions[sid(settings.cycle, week, s.key)]));
    const lifted = new Set(); weekLogged(week).forEach(l => Object.entries(l.body.sets || {}).forEach(([ex, arr]) => { if ((arr || []).some(x => x && (x.w != null || x.r != null))) lifted.add(baseName(ex)); }));
    const abs = LIB.filter(x => x.pat === "core" && lifted.has(x.name)).length;
    const cur = currentProgramWeek();
    $("weekCard").innerHTML = `<span class="label">This week</span><h3>Week ${week}: ${done} of ${sp.length} done</h3>
      <p class="wk-musts">${st ? "Started " + esc(niceDate(st)) + ". " : ""}${next ? "Next up: " + esc(next.title) + "." : week < 4 ? "Week complete. Rest, then start Week " + (week + 1) + "." : "Cycle complete. Start a new cycle below."} Core moves this week: ${Math.min(abs, 3)} of 3.</p>
      ${extraLine()}
      <p class="meta">Space your days out when you can: no more than 2 hard days in a row, and take at least 1 full rest day a week.</p>
      ${cur !== week ? `<button type="button" class="btn alt" id="goCurrentWeek" data-goweek="${cur}">Go to this week (Week ${cur})</button>` : ""}`;
  }
  // ================= cardio + stretch logging =================
  // One record per calendar day, "extra-YYYY-MM-DD", kept apart from sessions so logging a recovery-day
  // walk never marks a lifting day done. Existing data is untouched.
  const XID = (d) => "extra-" + d;
  function xDateFor(sp, body) { return body && body.date ? body.date : isTodaySession(sp, body) ? today() : null; }
  function xPart(date, part) { const e = date && extras[XID(date)]; return (e && e[part]) || {}; }
  const xVal = (v) => v != null ? esc(v) : "";
  const stretchNames = (meta) => String(meta).split(" · ").slice(1).map(it => it.replace(/\s+(×\d+.*|\d+\s*sec.*)$/, "").trim()).filter(Boolean);
  const DIST_UNIT = {swim: "laps", stairs: "floors", rower: "meters", bike: "miles", "incline walk": "miles", walk: "miles"};
  function trackHtml(r, date, sp) {
    if (!date) return `<div class="track"><p class="xhint">Log this on the day you do it.</p></div>`;
    const x = xPart(date, r.track);
    const attrs = `data-part="${r.track}" data-date="${date}" data-day="${esc(sp.key)}" data-plan="${r.plan}"${r.ctype ? ` data-ctype="${esc(r.ctype)}"` : ""}`;
    const f = (k, unit, ph, opt = "") => `<label class="field"><input data-x="1" data-xk="${k}" type="number" inputmode="${unit === "miles" ? "decimal" : "numeric"}" enterkeyhint="next" min="0" ${opt} placeholder="${ph}" value="${xVal(x[k])}" aria-label="${esc(r.name)} ${unit}"><span>${unit}</span></label>`;
    if (r.track === "mobility") {
      const done = new Set(x.stretches || []);
      const list = stretchNames(r.meta).map(n => `<button type="button" class="xst" data-name="${esc(n)}" aria-pressed="${done.has(n)}"><span class="box">${done.has(n) ? "✓" : "○"}</span>${esc(n)}</button>`).join("");
      return `<div class="track" ${attrs}><span class="label">Log your stretching: tap each one you did</span>
        <div class="xst-list">${list}</div>
        <div class="xgrid">${f("min", "min", r.plan)}</div>
        <button type="button" class="xdone" aria-pressed="${!!x.done}">${x.done ? "✓ Stretching done" : "Mark stretching done"}</button></div>`;
    }
    if (r.track === "finisher") {
      return `<div class="track" ${attrs}><span class="label">Log your finisher</span>
        <div class="xgrid">${f("min", "min", r.plan)}${f("effort", "effort /10", r.eff, 'max="10"')}</div>
        <button type="button" class="xdone" aria-pressed="${!!x.done}">${x.done ? "✓ Finisher done" : "Mark finisher done"}</button></div>`;
    }
    const unit = DIST_UNIT[r.ctype] || "miles", hr = hrNumbersOk();
    return `<div class="track" ${attrs}><span class="label">Log your ${({swim: "swim", bike: "bike ride", rower: "rowing", stairs: "stair climber", "incline walk": "incline walk", walk: "walk"})[r.ctype] || "cardio"}</span>
      <div class="xgrid">${f("min", "min", r.plan)}${f("dist", unit, "–", unit === "miles" ? 'step="0.1"' : "")}${f("effort", "effort /10", r.eff, 'max="10"')}${hr ? f("hr", "avg HR", "–") : ""}</div>
      <p class="xhint">Effort ${r.eff} out of 10 is the goal.${hr ? " Average heart rate from your watch, if it recorded one." : ""}</p>
      <button type="button" class="xdone" aria-pressed="${!!x.done}">${x.done ? "✓ Cardio done" : "Mark cardio done"}</button></div>`;
  }
  let xTimer = null, xPending = null;
  const xMeta = (box) => ({cycle: settings.cycle, week, day: box.dataset.day});
  function editExtra(date, part, patch, meta) {
    const id = XID(date);
    const e = extras[id] ? JSON.parse(JSON.stringify(extras[id])) : {kind: "extra", date};
    Object.assign(e, meta);
    e[part] = Object.assign({}, e[part], patch);
    e.savedAt = Date.now();
    extras[id] = e; xPending = id;
    setStatus("Saving…");
    clearTimeout(xTimer);
    xTimer = setTimeout(flushExtra, ("done" in patch || "stretches" in patch) ? 0 : 300);
  }
  async function flushExtra() {
    clearTimeout(xTimer);
    if (!xPending || !store) return;
    const id = xPending; xPending = null;
    try { await store.save(id, extras[id]); setStatus(store.label, store.cls); renderWeekCard(); }
    catch (e) { setStatus("Couldn't save your cardio or stretching. Edit it again to retry.", "warn"); }
  }
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.x) return;
    const box = t.closest(".track");
    if (!box || !box.dataset.date) return;
    editExtra(box.dataset.date, box.dataset.part, {[t.dataset.xk]: t.value === "" ? null : Number(t.value)}, xMeta(box));
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button.xdone, button.xst");
    if (!b) return;
    const box = b.closest(".track");
    if (!box || !box.dataset.date) return;
    const part = box.dataset.part, date = box.dataset.date, meta = xMeta(box), card = box.closest(".ex");
    const setSt = (btn, on) => { btn.setAttribute("aria-pressed", on); const bx = btn.querySelector(".box"); if (bx) bx.textContent = on ? "✓" : "○"; };
    if (b.classList.contains("xst")) {
      setSt(b, b.getAttribute("aria-pressed") !== "true");
      editExtra(date, part, {stretches: [...box.querySelectorAll(".xst")].filter(x => x.getAttribute("aria-pressed") === "true").map(x => x.dataset.name)}, meta);
      return;
    }
    const on = b.getAttribute("aria-pressed") !== "true", patch = {done: on, plan: +box.dataset.plan};
    if (on) {
      // One tap logs the plan: empty minutes take the planned time; no stretches ticked means all of them.
      const mi = box.querySelector('[data-xk="min"]');
      if (mi && mi.value === "") { mi.value = box.dataset.plan; patch.min = +box.dataset.plan; }
      if (part === "mobility" && !box.querySelector('.xst[aria-pressed="true"]')) {
        box.querySelectorAll(".xst").forEach(x => setSt(x, true));
        patch.stretches = [...box.querySelectorAll(".xst")].map(x => x.dataset.name);
      }
      if (part === "cardio") patch.type = box.dataset.ctype;
    }
    const word = part === "mobility" ? "stretching" : part;
    b.setAttribute("aria-pressed", on);
    b.textContent = on ? `✓ ${word[0].toUpperCase() + word.slice(1)} done` : `Mark ${word} done`;
    if (card) card.classList.toggle("logged", on);
    editExtra(date, part, patch, meta);
  });
  document.addEventListener("focusout", (e) => { if (e.target && e.target.dataset && e.target.dataset.x) flushExtra(); });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter" || !t || !t.dataset || !t.dataset.x) return;
    e.preventDefault();
    const ins = [...t.closest(".track").querySelectorAll("input[data-x]")], i = ins.indexOf(t);
    if (ins[i + 1]) ins[i + 1].focus(); else t.blur();
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushExtra(); });
  window.addEventListener("pagehide", () => { flushExtra(); });

  function renderSession() {
    if (!profile) return;
    const sp = plan().find(s => s.key === dayKey) || plan()[0];
    const id = sid(settings.cycle, week, sp.key), body = sessions[id] || {};
    const mode = sessionMode(sp, body), joints = isTodaySession(sp, body) ? jointsToday() : {};
    const rows = buildSession(week, sp, mode, joints);
    $("sessionEyebrow").textContent = mode === "recovery" ? `Week ${week} · Recovery day` : mode === "stop" ? `Week ${week} · No training today`
      : `Week ${week} · ${WEEK_NOTE[week]} · lifting ends at ${clock(rows.end)}${mode === "yellow" ? " · yellow day" : mode === "light" ? " · light version" : ""}`;
    $("sessionTitle").textContent = sp.title;
    const lifts = rows.filter(r => !r.fixed);
    const xDate = xDateFor(sp, body);
    $("exList").innerHTML = adjustBanner(mode, sp) + jointBanner(joints, rows, mode) + rows.map((r, ri) => {
      if (r.fixed) {
        const isMob = /^Mobility/.test(r.name), parts = String(r.meta).split(" · "), lead = parts.shift();
        const inner = isMob ? `<div class="meta"><b>${esc(lead)}</b></div><div class="chips">${stretchChips(parts.join(" · "))}</div>` : `<div class="meta">${esc(r.meta)}</div>`;
        const link = /finisher/i.test(r.name) ? watchBtn("Fat-burn finisher", "Watch: interval technique") : /^Swim/.test(r.name) ? watchBtn("Swim, freestyle", "Watch: freestyle technique")
          : /Stair|Rower|bike|treadmill/i.test(r.name) && !/^Water/.test(r.name) ? watchBtn(r.name, "Watch: proper form") : "";
        const xp = r.track && xDate ? xPart(xDate, r.track) : {};
        return `<div class="ex fixed${isMob ? " mob" : ""}${xp.done ? " logged" : ""}"><div class="exhead"><span class="clock">${clock(r.start)}</span><div class="exbody"><div class="exname">${esc(r.name)}</div>${inner}${link}</div></div>${r.track ? trackHtml(r, xDate, sp) : ""}</div>`;
      }
      const logged = setsOf(body, r.name), last = lastFor(r.name, id);
      let tg = targetFor(r.name, r.reps, week, id);
      if (mode === "yellow" && tg.kind === "up") {
        if (tg.w != null) { const w0 = tg.from != null ? tg.from : tg.w - incFor(baseName(r.name), tg.w); tg = {w: w0, reps: tg.reps, kind: "hold", msg: `Yellow day: stay at ${w0} lb, no increase today`}; }
        else { const add = /sec/.test(r.reps) ? 5 : 1; tg = {w: null, reps: Math.max(1, tg.reps - add), kind: "hold", msg: "Yellow day: same as last time, no increase today"}; }
      }
      if (mode === "light") tg = {w: tg.w != null ? round5(tg.w * 0.6) : null, reps: tg.reps, kind: "deload", msg: tg.w != null ? `Light day: about 60% of ${tg.w} lb. Smooth, easy reps` : "Light day: easy reps, stop well short of your limit"};
      else if (r.jointLoad && tg.w != null) tg = {w: round5(tg.w * r.jointLoad), reps: tg.reps, kind: "down", msg: `Easy on your ${r.jointWhy}: about 80% of ${tg.w} lb, only through a pain-free range`};
      else if (r.jointLoad) tg = Object.assign({}, tg, {msg: `Easy on your ${r.jointWhy}: go about 20% lighter and only as deep as is pain-free`});
      const repsOut = tg.reps || (parseInt(r.reps, 10) || ""), repsShow = String(r.reps).replace(/^\d+/, String(repsOut));
      const planAttr = `data-ps="${r.sets}" data-pr="${repsOut}" data-pw="${tg.w != null ? tg.w : ""}"`;
      const arrow = {up: "▲", hold: "■", down: "▼", deload: "▽", "new": "●"}[tg.kind];
      const bw = isBW(r.name), unit = /sec/.test(r.reps) ? "sec" : "reps";
      const lastTxt = last ? last.sets.map(x => bw ? (x.r != null ? x.r : "–") + " " + unit : (x.w ? x.w : "–") + "×" + (x.r || "–")).join(", ") : "";
      const li = lifts.indexOf(r), nextName = lifts[li + 1] ? lifts[li + 1].name : "";
      const sets = Array.from({length: r.sets}, (_, si) => {
        const v = logged[si] || {};
        return `<div class="set${bw ? " bw" : ""}"><span class="n">S${si + 1}</span>
          ${bw ? "" : `<label class="field"><input id="w-${ri}-${si}" inputmode="decimal" enterkeyhint="next" type="number" min="0" step="2.5" placeholder="${tg.w != null ? tg.w : (last && last.sets[si] && last.sets[si].w ? esc(last.sets[si].w) : "–")}" value="${v.w != null ? esc(v.w) : ""}" data-ex="${esc(r.name)}" data-s="${si}" data-f="w" ${planAttr} aria-label="${esc(r.name)} set ${si + 1} weight"><span>lb</span></label>`}
          <label class="field"><input id="r-${ri}-${si}" inputmode="numeric" enterkeyhint="done" type="number" min="0" step="1" placeholder="${repsOut}" value="${v.r != null ? esc(v.r) : ""}" data-ex="${esc(r.name)}" data-s="${si}" data-f="r" ${planAttr} aria-label="${esc(r.name)} set ${si + 1} ${unit}"><span>${unit}</span></label>
          <button type="button" class="tick" id="t-${ri}-${si}" aria-pressed="${!!v.done}" data-ex="${esc(r.name)}" data-s="${si}" data-of="${r.sets}" data-rest="${r.rest}" data-next="${esc(nextName)}" ${planAttr} aria-label="Mark set ${si + 1} done">✓</button></div>`;
      }).join("");
      return `<article class="ex"><div class="exhead"><div class="exnum"><span class="num">${li + 1}</span><span class="clock">${clock(r.start)}</span></div>
        <div class="exbody"><div class="exname">${esc(r.name)}</div>
        ${r.jointFrom ? `<p class="cue">Swapped in for ${esc(r.jointFrom)} to spare your ${esc(r.jointWhy)}.</p>` : ""}
        ${r.stepFrom && !r.jointFrom ? `<p class="cue">Easier version of ${esc(r.stepFrom)} for now. Do it cleanly twice and ${esc(r.stepFrom)} comes back.</p>` : ""}
        <div class="target ${tg.kind}"><span class="tgt-main">Target: ${tg.w != null ? tg.w + " lb × " : bw ? "bodyweight × " : ""}${esc(repsShow)}</span><span class="tgt-why">${arrow} ${esc(tg.msg)}</span></div>
        <div class="meta"><b>${r.sets} sets × ${esc(repsShow)}</b> · rest ${restTxt(r.rest)} between sets${r.ramp ? ` · do ${Math.round(r.ramp)} min of lighter warm-up sets first` : ""}</div>
        ${STRETCH.has(baseName(r.name)) ? `<p class="cue">Stretch focus: lower for 3 seconds and pause 1 second in the deepest position you can control.</p>` : ""}
        ${watchBtn(baseName(r.name), "Watch how to do it")}
        ${lastTxt ? `<div class="last">Last time: <b>${esc(lastTxt)}</b></div>` : ""}</div></div><div class="sets">${sets}</div></article>`;
    }).join("");
  }
  function renderFooter() {
    $("cycleMeta").textContent = `Cycle ${settings.cycle}. Start a new cycle after week 4; your history carries over as "Last time".`;
    $("cycleCtl").innerHTML = confirmingReset
      ? `<div class="confirm"><span>Start cycle ${settings.cycle + 1} at week 1?</span><button type="button" class="ghost" id="cycleYes">Start new cycle</button><button type="button" class="ghost" id="cycleNo">Cancel</button></div>`
      : `<button type="button" class="ghost" id="cycleNew">Start a new cycle</button>`;
  }
  function renderAll() {
    renderSetup();
    if (!profile || editingProfile) { renderCheckin(); return; }
    renderHeader(); renderNudge(); renderCheckin(); renderWeek(); renderTabs(); renderWeekCard(); renderSession(); renderFooter(); renderProgress();
  }
  // ---------- My progress: one chart per exercise plus morning trends, drawn on the page (works offline) ----------
  function progressSeries() {
    const by = {};
    for (const s of Object.values(sessions)) {
      if (!s || !s.sets || !s.date) continue;
      for (const [ex, arr] of Object.entries(s.sets)) {
        const bn = baseName(ex), done = (arr || []).filter(x => x && x.r != null && +x.r > 0);
        if (!done.length) continue;
        const bw = isBW(bn), timed = (FIXED_REPS[bn] || []).some(t => /sec/.test(t));
        let y, top;
        if (bw) { y = Math.max(...done.map(x => +x.r)); top = y + (timed ? " sec" : " reps"); }
        else {
          const ws = done.filter(x => +x.w > 0); if (!ws.length) continue;
          const best = ws.reduce((m, x) => { const e = +x.w * (1 + Math.min(+x.r, 12) / 30); return !m || e > m.e ? {e, x} : m; }, null);
          y = Math.round(best.e); top = best.x.w + " lb × " + best.x.r;
        }
        const ser = by[bn] = by[bn] || {name: bn, bw, timed, pts: {}};
        const cur = ser.pts[s.date];
        if (!cur || y > cur.y) ser.pts[s.date] = {d: s.date, y, top, light: s.readiness === "light" || s.week === 4};
      }
    }
    return Object.values(by).map(o => Object.assign(o, {pts: Object.values(o.pts).sort((a, b) => a.d.localeCompare(b.d))}))
      .sort((a, b) => (b.pts.length - a.pts.length) || b.pts[b.pts.length - 1].d.localeCompare(a.pts[a.pts.length - 1].d));
  }
  function sparkSvg(pts, label) {
    const W = 320, H = 120, px = 10, py = 12, ys = pts.map(p => p.y);
    // Keep the vertical scale at least ±15% of the average, so small day-to-day noise doesn't look dramatic.
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const mid = (lo + hi) / 2, minSpan = Math.max(Math.abs(mid) * 0.3, 1);
    if (hi - lo < minSpan) { lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const t0 = pd(pts[0].d).getTime(), t1 = pd(pts[pts.length - 1].d).getTime(), span = Math.max(1, t1 - t0);
    const X = (p) => pts.length === 1 ? W / 2 : px + (pd(p.d).getTime() - t0) / span * (W - 2 * px);
    const Y = (v) => H - py - (v - lo) / (hi - lo) * (H - 2 * py);
    const line = pts.map(p => X(p).toFixed(1) + "," + Y(p.y).toFixed(1)).join(" ");
    const dots = pts.map(p => `<circle cx="${X(p).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5" class="${p.light ? "pdot light" : "pdot"}"/>`).join("");
    return `<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      <line x1="${px}" x2="${W - px}" y1="${H - py}" y2="${H - py}" class="pbase"/>${pts.length > 1 ? `<polyline points="${line}" class="pline"/>` : ""}${dots}</svg>`;
  }
  function renderProgress() {
    const box = $("progress"), card = $("progressCard"); if (!box || !card) return;
    const series = progressSeries();
    const n = series.length;
    $("progressCount").textContent = n ? `${n} exercise${n === 1 ? "" : "s"}` : "";
    if (!card.open) return;
    const fmtShort = (d) => pd(d).toLocaleDateString([], {month: "short", day: "numeric"});
    const parts = [];
    // Morning trends first: they move fastest and matter most for heart health.
    const ci = Object.values(checkins).filter(c => c && c.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    const trend = (key, name, unit, goodDown) => {
      const pts = ci.filter(c => typeof c[key] === "number" && c[key] > 0).map(c => ({d: c.date, y: c[key]}));
      if (pts.length < 2) return "";
      const a = pts[0].y, b = pts[pts.length - 1].y, diff = Math.round((b - a) * 10) / 10;
      const good = diff === 0 ? "" : (diff < 0) === goodDown ? " pgood" : " pbad";
      return `<div class="pitem"><div class="phead"><b>${name}</b><span class="pnum${good}">${a} → ${b} ${unit}</span></div>
        ${sparkSvg(pts, name + " trend")}<div class="pdates"><span>${fmtShort(pts[0].d)}</span><span>${pts.length} mornings</span><span>${fmtShort(pts[pts.length - 1].d)}</span></div></div>`;
    };
    const morning = [hrNumbersOk() ? trend("rhr", "Resting heart rate", "bpm", true) : "", hrNumbersOk() ? trend("hrv", "Overnight HRV", "ms", false) : "", trend("sleep", "Sleep", "h", false)].join("");
    if (morning) parts.push(`<h3 class="psec">Mornings</h3>${morning}`);
    const lifts = series.map(o => {
      const a = o.pts[0], b = o.pts[o.pts.length - 1];
      const pct = a.y ? Math.round((b.y - a.y) / a.y * 100) : 0;
      const unit = o.bw ? (o.timed ? "sec" : "reps") : "lb";
      const head = o.pts.length === 1 ? `First time: ${esc(b.top)}` : `${a.y} → ${b.y} ${unit}${pct ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`;
      return `<div class="pitem"><div class="phead"><b>${esc(o.name)}</b><span class="pnum${pct > 0 ? " pgood" : pct < 0 ? " pbad" : ""}">${head}</span></div>
        ${sparkSvg(o.pts, o.name + " progress")}
        <div class="pdates"><span>${fmtShort(a.d)}</span><span>${o.pts.length} sessions</span><span>${fmtShort(b.d)}</span></div>
        <div class="meta">Best set last time: <b>${esc(b.top)}</b></div></div>`;
    }).join("");
    if (lifts) parts.push(`<h3 class="psec">Lifts</h3><p class="meta">Weighted lifts show your estimated max: what your best set says you could lift once. Bodyweight moves show your best set. Hollow dots are easy weeks and light days.</p>${lifts}`);
    box.innerHTML = parts.join("") || `<p class="meta">Log a few workouts and your progress shows up here, one chart per exercise.</p>`;
  }
  document.addEventListener("toggle", (e) => { if (e.target && e.target.id === "progressCard") renderProgress(); }, true);
  // ---------- backup reminder (phone and browser versions; the Claude version saves to the cloud already) ----------
  function noteBackup() { settings = Object.assign({}, settings, {lastBackupAt: Date.now()}); saveSettings(); renderNudge(); }
  function renderNudge() {
    const el = $("backupNudge"); if (!el) return;
    const dates = Object.values(sessions).filter(hasData).map(b => b.date).filter(Boolean).sort();
    const first = dates[0], now = Date.now(), DAY = 864e5;
    const last = settings.lastBackupAt || 0, snooze = settings.backupSnoozeUntil || 0;
    const due = STANDALONE && first && now > snooze && (last ? now - last > 30 * DAY : now - pd(first).getTime() > 7 * DAY);
    el.hidden = !due;
    if (!due) return;
    const n = Object.values(sessions).filter(hasData).length;
    el.innerHTML = `<span class="label">Back up your training</span>
      <p>${last ? `Your last backup was ${Math.floor((now - last) / DAY)} days ago.` : "You haven't made a backup yet."} You have ${n} workout${n === 1 ? "" : "s"} saved only on this phone. If the phone is lost or reset, they're gone.</p>
      <p>Tap <b>Back up now</b>, then pick <b>Google Drive</b>. It takes 10 seconds.</p>
      <div class="ci-btns"><button type="button" class="btn" id="nudgeBackup">Back up now</button><button type="button" class="btn alt" id="nudgeLater">Remind me in a week</button></div>`;
  }

  // ================= edits and saving =================
  function currentBody() {
    const id = sid(settings.cycle, week, dayKey);
    const b = sessions[id] ? JSON.parse(JSON.stringify(sessions[id])) : {kind: "session", cycle: settings.cycle, week, day: dayKey, sets: {}};
    b.sets = b.sets || {};
    return [id, b];
  }
  function edit(ex, si, patch, planVal) {
    const [id, b] = currentBody();
    if (planVal) b.plan = Object.assign({}, b.plan, {[ex]: planVal});
    const arr = b.sets[ex] || [];
    arr[si] = Object.assign({}, arr[si] || {}, patch);
    for (let i = 0; i < arr.length; i++) if (!arr[i]) arr[i] = {};
    b.sets[ex] = arr; b.updatedAt = Date.now(); if (!b.date) b.date = today();
    const sp = plan().find(s => s.key === dayKey), m = sp ? sessionMode(sp, b) : null;
    if (m === "yellow" || m === "light") b.readiness = m;
    else if (b.readiness && b.date === today() && ciToday()) delete b.readiness;
    // Main lifts done lighter for a joint stay out of progression.
    const rows = sp ? buildSession(week, sp, m, jointsToday()) : [];
    const r = rows.find(x => x.name === ex && x.jointLoad);
    if (r && isTodaySession(sp, b)) b.jointAdj = [...new Set([...(b.jointAdj || []), baseName(ex)])];
    sessions[id] = b; pendingId = id; setStatus("Saving…");
    clearTimeout(saveTimer); saveTimer = setTimeout(flush, patch && "done" in patch ? 0 : 300);
  }
  async function flush() {
    if (!pendingId || !store) return;
    const id = pendingId; pendingId = null;
    try { await store.save(id, sessions[id]); setStatus(store.label, store.cls); renderTabs(); renderWeekCard(); }
    catch (e) { setStatus("Couldn't save. Check your connection, then edit a set to retry.", "warn"); }
  }
  async function flushNow() { clearTimeout(saveTimer); await flush(); await flushExtra(); }
  async function saveSettings() { try { if (store) await store.save("settings", settings); } catch (e) {} }
  const planOf = (el) => ({sets: +el.dataset.ps || 0, reps: +el.dataset.pr || 0, w: el.dataset.pw === "" || el.dataset.pw == null ? null : +el.dataset.pw});
  const saveMsg = (txt, cls) => { const s = $("saveStatus"); s.textContent = txt; s.style.color = cls === "warn" ? "var(--warn)" : cls === "ok" ? "var(--good)" : ""; };

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("#setup")) { setupVisibility(); return; }
    if (!t.dataset || !t.dataset.f) return;
    edit(t.dataset.ex, +t.dataset.s, {[t.dataset.f]: t.value === "" ? null : Number(t.value)}, planOf(t));
  });
  document.addEventListener("change", (e) => { if (e.target && e.target.closest && e.target.closest("#setup")) setupVisibility(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.w) { flush(); week = +b.dataset.w; dayKey = null; renderAll(); }
    else if (b.dataset.k) { flush(); dayKey = b.dataset.k; renderTabs(); renderSession(); }
    else if (b.dataset.goweek) { flush(); week = +b.dataset.goweek; dayKey = null; renderAll(); }
    else if (b.classList.contains("tick")) {
      const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on);
      const patch = {done: on};
      if (on) {
        const [, ri, si] = b.id.split("-"), wi = $(`w-${ri}-${si}`), rn = $(`r-${ri}-${si}`);
        if (wi && wi.value === "" && b.dataset.pw !== "") { wi.value = b.dataset.pw; patch.w = +b.dataset.pw; }
        if (rn && rn.value === "" && b.dataset.pr) { rn.value = b.dataset.pr; patch.r = +b.dataset.pr; }
      }
      edit(b.dataset.ex, +b.dataset.s, patch, planOf(b));
      if (on) setDone(b);
    }
    else if (b.id === "suSave") saveSetup();
    else if (b.id === "suCancel") { editingProfile = false; $("setup").dataset.ready = ""; renderAll(); }
    else if (b.id === "editSetup") { editingProfile = true; $("setup").dataset.ready = ""; renderAll(); try { window.scrollTo({top: 0}); } catch (err) {} }
    else if (b.id === "clearedBtn") { profile = Object.assign({}, profile, {cleared: true, updatedAt: Date.now()}); if (store) store.save("profile", profile).catch(() => {}); renderAll(); }
    else if (b.id === "ciScore") scoreFromForm();
    else if (b.id === "ciEdit") { ciEditing = true; $("checkin").dataset.mode = ""; renderCheckin(); }
    else if (b.id === "ciCancel") { ciEditing = false; $("checkin").dataset.mode = ""; renderCheckin(); }
    else if (b.id === "ciLightOn" || b.id === "ciLightOff") { const c = ciToday(); if (!c) return; saveCheckin(Object.assign({}, c, {choice: b.id === "ciLightOn" ? "light" : null, savedAt: Date.now()})); renderSession(); }
    else if (b.id === "exportXlsx") exportExcel();
    else if (b.id === "backupJson" || b.id === "nudgeBackup") backupData();
    else if (b.id === "nudgeLater") { settings = Object.assign({}, settings, {backupSnoozeUntil: Date.now() + 7 * 864e5}); saveSettings(); renderNudge(); }
    else if (b.id === "suRestore") { dockRestore(true); $("restorePanel").hidden = false; }
    else if (b.id === "restorePick") { $("restorePanel").hidden = false; $("backupPanel").hidden = true; }
    else if (b.id === "restoreChooseFile") $("restoreFile").click();
    else if (b.id === "restoreUseText") checkBackup($("restoreText").value);
    else if (b.id === "restoreClose") $("restorePanel").hidden = true;
    else if (b.id === "backupClose") $("backupPanel").hidden = true;
    else if (b.id === "backupCopy") {
      const ta = $("backupText"), sel = () => { ta.focus(); ta.select(); saveMsg("Text selected. Use your phone's Copy.", ""); };
      try { navigator.clipboard.writeText(ta.value).then(() => { noteBackup(); saveMsg("Copied. Paste it into an email to yourself or a note in Google Drive.", "ok"); }, sel); } catch (err) { sel(); }
    }
    else if (b.id === "restoreYes") applyRestore();
    else if (b.id === "restoreNo") { pendingRestore = null; $("restoreConfirm").hidden = true; saveMsg("Restore cancelled."); }
    else if (b.id === "tbStart") startWorkout();
    else if (b.id === "shareDay") shareCard("checkin");
    else if (b.id === "shareWorkout") shareCard("workout");
    else if (b.id === "tbTest") testAlerts();
    else if (b.id === "tbPause") pauseWorkout();
    else if (b.id === "tbEnd") { tb.confirmEnd = true; renderTimer(); }
    else if (b.id === "tbEndNo") { tb.confirmEnd = false; renderTimer(); }
    else if (b.id === "tbEndYes") endWorkout();
    else if (b.id === "tbSkip") { tb.restEnd = 0; restOver(); }
    else if (b.id === "cycleNew") { confirmingReset = true; renderFooter(); }
    else if (b.id === "cycleNo") { confirmingReset = false; renderFooter(); }
    else if (b.id === "cycleYes") { confirmingReset = false; flush(); settings = Object.assign({}, settings, {cycle: settings.cycle + 1}); week = 1; dayKey = null; saveSettings(); renderAll(); }
  });
  window.addEventListener("pagehide", () => { flush(); persistTimer(); });
  // Android back button / back gesture: close an open panel first; otherwise send the app to the background
  // (never quit it, so a running rest timer and unsaved typing survive).
  (function androidBack() {
    const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!AppPlugin || !AppPlugin.addListener) return;
    AppPlugin.addListener("backButton", () => {
      for (const id of ["restoreConfirm", "restorePanel", "backupPanel"]) {
        const e = $(id);
        if (e && !e.hidden) { e.hidden = true; if (id === "restoreConfirm") pendingRestore = null; return; }
      }
      flush(); persistTimer();
      AppPlugin.minimizeApp();
    });
    AppPlugin.addListener("pause", () => { clearTimeout(saveTimer); flush(); flushExtra(); persistTimer(); });
  })();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { clearTimeout(saveTimer); flush(); persistTimer(); } });
  document.addEventListener("focusout", (e) => { if (e.target && e.target.dataset && e.target.dataset.f) { clearTimeout(saveTimer); flush(); } });

  // ================= saving files: works in Claude, in the Android app, and in a phone browser =================
  const STANDALONE = !(window.claude && window.claude.use);
  const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  async function saveFile(filename, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], {type: mime || "application/octet-stream"});
    if (!STANDALONE) {
      let d = null;
      try { d = await window.claude.use("downloads"); } catch (e) { d = null; }
      if (d) { await d.save({filename, data: blob}); return "saved"; }
    }
    const P = window.Capacitor && window.Capacitor.Plugins;       // Android app built with Capacitor
    if (P && P.Filesystem && P.Share) {
      const w = await P.Filesystem.writeFile({path: filename, data: await blobToB64(blob), directory: "CACHE"});
      await P.Share.share({title: filename, url: w.uri, dialogTitle: /backup/i.test(filename) ? "Save your backup (Google Drive is safest)" : "Save or send " + filename});
      return "shared";
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");     // phone or desktop browser
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  }

  // ================= share card: one tap makes a picture of today's call or workout =================
  // Shown only after the check-in and after "End" on the workout timer, never between sets.
  // Privacy: the card never shows sleep, heart rate, HRV or blood pressure, only the coach's call, lifts and the streak.
  const SHARE_URL = "coach.mineargear.com";
  const LKEY = "coach.lastWorkout";
  function lastWorkout() { try { const x = JSON.parse(localStorage.getItem(LKEY) || "null"); return x && x.date === today() ? x : null; } catch (e) { return null; } }
  // Weeks in a row with anything logged (a workout or a morning check-in). Rest and easy days count.
  // The current week can't break the run until it's over.
  function weeksInARow() {
    const act = new Set();
    for (const b of Object.values(sessions)) if (b && b.date && hasData(b)) act.add(mondayOf(b.date));
    for (const c of Object.values(checkins)) if (c && c.date && c.light) act.add(mondayOf(c.date));
    const d = pd(mondayOf(today()));
    if (!act.has(fmtD(d))) d.setDate(d.getDate() - 7);
    let n = 0;
    while (act.has(fmtD(d)) && n < 520) { n++; d.setDate(d.getDate() - 7); }
    return n;
  }
  function todaysWorkout() {
    let best = null;
    for (const [id, b] of Object.entries(sessions)) if (b && b.date === today() && hasData(b) && (!best || (b.updatedAt || 0) > (best.b.updatedAt || 0))) best = {id, b};
    return best;
  }
  // "Heaviest yet" lines: today's top weight (or best reps) beats every earlier normal session. Light and easy-week days don't brag.
  function winsFor(id, b) {
    const ci = b.date === today() ? ciToday() : null;
    const out = [], easy = b.readiness === "light" || b.week === 4 || !!(ci && ci.light === "red");
    for (const [name, arr] of Object.entries(b.sets || {})) {
      const done = (arr || []).filter(x => x && (x.done || x.r != null || x.w != null));
      if (!done.length) continue;
      const bn = baseName(name), prev = historyFor(name, id).filter(h => !h.light && h.week !== 4 && (h.date || "") < today());
      if (easy || !prev.length) { out.push({t: `${bn} · ${done.length} set${done.length > 1 ? "s" : ""}`, up: false}); continue; }
      if (isBW(bn)) {
        const unit = /plank/i.test(bn) ? "sec" : "reps", best = Math.max(...done.map(x => +x.r || 0)), pb = Math.max(...prev.flatMap(h => h.sets.map(x => +x.r || 0)));
        out.push(best > pb ? {t: `${bn}: ${best} ${unit}, best yet`, up: true} : {t: `${bn} · ${done.length} sets`, up: false});
      } else {
        const ws = done.map(x => x.w).filter(v => typeof v === "number" && v > 0);
        const top = ws.length ? Math.max(...ws) : 0, pt = Math.max(0, ...prev.flatMap(h => h.sets.map(x => +x.w || 0)));
        out.push(top && pt && top > pt ? {t: `${bn}: ${top} lb, +${top - pt}`, up: true} : {t: `${bn} · ${done.length} sets`, up: false});
      }
    }
    return out.sort((a, c) => (c.up ? 1 : 0) - (a.up ? 1 : 0));
  }
  function cardFacts(kind) {
    const c = ciToday(), wk = weeksInARow();
    if (c && c.light === "stop") return null;          // never make a share card on a stop day
    const call = !c ? null
      : c.light === "green" ? {word: "GO", col: "#C8F542", line: "Coach said go. Full plan today."}
      : c.light === "yellow" ? {word: "EASY", col: "#FFB547", line: "Coach said ease off today. I listened."}
      : c.light === "red" && c.choice === "light" ? {word: "LIGHT", col: "#FF7A6B", line: "Coach said take it light today. I listened."}
      : c.light === "red" ? {word: "REST", col: "#FF7A6B", line: "Coach said rest today. I listened."} : null;
    const streak = wk > 1 ? `${wk} weeks in a row` : "Week 1";
    if (kind === "checkin") {
      if (!call) return null;
      return {word: call.word, col: call.col, head: call.line, sub: "My training app checks in with me every morning and sets the workout to match.", lines: [], streak,
        text: `${call.line} ${streak}. Daily Training Coach: https://${SHARE_URL}`};
    }
    const tw = todaysWorkout(), lw = lastWorkout();
    const key = tw ? tw.id.split("-").slice(2).join("-") : null, title = key ? titleOf(key) : "Workout";
    const sets = tw ? Object.values(tw.b.sets || {}).reduce((n, a) => n + (a || []).filter(x => x && (x.done || x.r != null)).length, 0) : 0;
    const bits = [lw && lw.min ? lw.min + " min" : "", sets ? sets + " sets" : ""].filter(Boolean).join(" · ");
    const lines = tw ? winsFor(tw.id, tw.b).slice(0, 3) : [];
    const up = lines.filter(l => l.up).length;
    return {word: call ? call.word : "DONE", col: call ? call.col : "#C8F542", head: `${title} done${bits ? " · " + bits : ""}`,
      sub: call && call.word !== "GO" ? call.line : up ? `${up} lift${up > 1 ? "s" : ""} at my heaviest yet.` : "", lines, streak,
      text: `${title} done${bits ? " (" + bits + ")" : ""}. ${streak}. Daily Training Coach: https://${SHARE_URL}`};
  }
  function wrapText(g, txt, x, y, maxW, lh) {
    const words = String(txt).split(" "); let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
    }
    if (line) g.fillText(line, x, y);
    return y;
  }
  // Night Session look (theme 3): near-black, one lime accent, wide Archivo headlines.
  async function drawCard(f) {
    const D = '"Archivo", "Arial Black", sans-serif', B = '"Atkinson Hyperlegible", system-ui, sans-serif';
    try { await Promise.all([`900 300px ${D}`, `800 90px ${D}`, `700 58px ${B}`, `400 44px ${B}`].map(x => document.fonts.load(x))); } catch (e) {}
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const wide = (v) => { try { g.fontStretch = v; } catch (e) {} };
    g.fillStyle = "#0C0F14"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#161B22"; g.beginPath(); (g.roundRect ? g.roundRect(48, 48, W - 96, H - 96, 44) : g.rect(48, 48, W - 96, H - 96)); g.fill();
    g.strokeStyle = "#2A333F"; g.lineWidth = 2; g.stroke();
    let y = 150;
    const eyebrow = ("Daily Training Coach · " + niceDate(today())).toUpperCase();
    g.fillStyle = "#B4BEC9"; let ez = 40; g.font = `700 ${ez}px ${B}`;
    try { g.letterSpacing = "5px"; } catch (e) {}
    while (g.measureText(eyebrow).width > W - 200 && ez > 26) { ez -= 2; g.font = `700 ${ez}px ${B}`; }
    g.fillText(eyebrow, 100, y);
    try { g.letterSpacing = "0px"; } catch (e) {}
    y += 44;
    for (let x = 100; x < W - 100; x += 46) { g.fillStyle = "#C8F542"; g.fillRect(x, y, Math.min(36, W - 100 - x), 8); }
    y += 300;
    wide("expanded");
    let size = 300; g.font = `900 ${size}px ${D}`;
    while (g.measureText(f.word).width > W - 200 && size > 120) { size -= 10; g.font = `900 ${size}px ${D}`; }
    g.fillStyle = f.col; g.fillText(f.word, 92, y);
    wide("normal");
    y += 100; g.fillStyle = "#F1F4F7"; g.font = `700 56px ${B}`; y = wrapText(g, f.head, 100, y, W - 200, 68);
    if (f.sub) { y += 64; g.fillStyle = "#D3DAE2"; g.font = `400 44px ${B}`; y = wrapText(g, f.sub, 100, y, W - 200, 56); }
    if (f.lines.length) {
      y += 20; g.font = `400 42px ${B}`;
      for (const l of f.lines) { y += 62; if (y > H - 320) break; g.fillStyle = l.up ? "#C8F542" : "#D3DAE2"; g.fillText((l.up ? "↑ " : "• ") + l.t, 100, y); }
    }
    g.fillStyle = "#2A333F"; g.fillRect(100, H - 270, W - 200, 2);
    wide("expanded"); g.fillStyle = "#F1F4F7"; g.font = `800 72px ${D}`;
    let sz = 72; while (g.measureText(f.streak.toUpperCase()).width > W - 200 && sz > 40) { sz -= 4; g.font = `800 ${sz}px ${D}`; }
    g.fillText(f.streak.toUpperCase(), 100, H - 168); wide("normal");
    g.fillStyle = "#C8F542"; g.font = `700 44px ${B}`; g.fillText(SHARE_URL, 100, H - 100);
    return await new Promise((res) => cv.toBlob(res, "image/png"));
  }
  async function shareCard(kind) {
    const f = cardFacts(kind);
    if (!f) return;
    setStatus("Making your picture…");
    try {
      const blob = await drawCard(f), name = "coach-" + today() + ".png";
      const P = window.Capacitor && window.Capacitor.Plugins;
      if (STANDALONE && P && P.Filesystem && P.Share) {          // Android app: the phone's share screen, picture attached
        const w = await P.Filesystem.writeFile({path: name, data: await blobToB64(blob), directory: "CACHE"});
        await P.Share.share({title: "My training today", text: f.text, url: w.uri, dialogTitle: "Share today"});
      } else {
        let file = null; try { file = new File([blob], name, {type: "image/png"}); } catch (e) {}
        if (STANDALONE && file && navigator.canShare && navigator.canShare({files: [file]})) await navigator.share({files: [file], text: f.text});
        else await saveFile(name, blob, "image/png");             // Claude or a desktop browser: save the picture
      }
      setStatus(store ? store.label : "", store ? store.cls : "");
    } catch (e) {
      if (e && (e.name === "AbortError" || /cancel/i.test(String(e.message || e)))) { setStatus(store ? store.label : "", store ? store.cls : ""); return; }
      setStatus("Couldn't share the picture. Try again.", "warn");
    }
  }

  // ================= Excel export =================
    // ---------- Excel export (native .xlsx with line charts, built with JSZip) ----------
  function buildWorkbook(JSZipLib, sessionList, titleOf) {
    const X = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    const colL = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const cell = (v, r, c, bold) => {
      const ref = colL(c) + (r + 1), st = bold ? ' s="1"' : "";
      if (v === null || v === undefined || v === "") return "";
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    };
    const sheetXml = (rows, widths, hasDrawing, opt = {}) =>
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"${opt.first ? ' tabSelected="1"' : ""}>${opt.freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews>` +
      `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>` +
      rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c, r === (opt.head || 0))).join("")}</row>`).join("") +
      `</sheetData><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>${hasDrawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
    const chartXml = (title, axisTitle, sheet, catCol, valCol, n, color, hdr = 1) => {
      const q = "'" + sheet.replace(/'/g, "''") + "'";
      const rich = (t, sz) => `<c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="${sz}" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="${sz}" b="1"/><a:t>${X(t)}</a:t></a:r></a:p></c:rich></c:tx>`;
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>` +
        `<c:title>${rich(title, 1400)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>` +
        `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>` +
        `<c:tx><c:strRef><c:f>${q}!$${colL(valCol)}$${hdr}</c:f></c:strRef></c:tx>` +
        `<c:spPr><a:ln w="31750" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>` +
        `<c:marker><c:symbol val="circle"/><c:size val="8"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:marker>` +
        `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>` +
        `<c:cat><c:strRef><c:f>${q}!$${colL(catCol)}$${hdr + 1}:$${colL(catCol)}$${hdr + n}</c:f></c:strRef></c:cat>` +
        `<c:val><c:numRef><c:f>${q}!$${colL(valCol)}$${hdr + 1}:$${colL(valCol)}$${hdr + n}</c:f></c:numRef></c:val><c:smooth val="0"/></c:ser>` +
        `<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>` +
        `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
        `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` +
        `<c:title>${rich(axisTitle, 1000)}<c:overlay val="0"/></c:title><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>` +
        `</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
    };
    const anchor = (rel, id, row0, row1) =>
      `<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
      `<xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
      `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
      `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
      `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rel}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

    // ---- gather data ----
    const sorted = sessionList.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.updatedAt || 0) - (b.updatedAt || 0));
    const log = [["Date", "Cycle", "Week", "Session", "Exercise", "Set", "Weight (lb)", "Reps", "Volume (lb)", "Est. max (lb)", "Done"]];
    const byEx = new Map();
    sorted.forEach(s => {
      const date = s.date || (s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 10) : "");
      Object.entries(s.sets || {}).forEach(([exRaw, arr]) => {
        const ex = baseName(exRaw);
        let top = null, vol = 0, reps = 0, any = false, e1rm = null;
        (arr || []).forEach((x, i) => {
          if (!x || (x.w == null && x.r == null && !x.done)) return;
          any = true;
          const w = typeof x.w === "number" ? x.w : null, r = typeof x.r === "number" ? x.r : null;
          if (w != null) top = top == null ? w : Math.max(top, w);
          if (r != null) reps += r;
          if (w != null && r != null) vol += w * r;
          // Estimated one-rep max (Epley), so sets of 5 and sets of 8 land on one comparable strength line.
          const est = w != null && r != null && r > 0 && r <= 15 ? Math.round(w * (1 + r / 30)) : null;
          if (est != null) e1rm = e1rm == null ? est : Math.max(e1rm, est);
          log.push([date, s.cycle, s.week, titleOf(s.day), ex, i + 1, w, r, w != null && r != null ? w * r : null, est, x.done ? "Yes" : ""]);
        });
        if (!any) return;
        if (!byEx.has(ex)) byEx.set(ex, []);
        byEx.get(ex).push({label: date + " (C" + s.cycle + " W" + s.week + ")", date, cycle: s.cycle, week: s.week, top, reps, vol, e1rm});
      });
    });

    // ---- sheets ----
    const used = new Set(["charts", "summary", "set log", "missed days by week", "missed days by month", "morning check-ins", "cardio and stretching"]);
    const sheetName = (n) => {
      let base = n.replace(/[\[\]:*?\/\\']/g, "").replace(/\s+/g, " ").trim().slice(0, 31) || "Exercise", nm = base, k = 2;
      while (used.has(nm.toLowerCase()) || used.has(nm)) { nm = base.slice(0, 28) + " " + k++; }
      used.add(nm); used.add(nm.toLowerCase()); return nm;
    };
    const summary = [["Exercise", "Sessions logged", "First top weight (lb)", "Latest top weight (lb)", "Best weight (lb)", "Change (lb)", "Latest volume (lb)", "Best est. max (lb)", "Est. max change (lb)", "Sheet"]];
    const sheets = [{name: "Summary", rows: summary, widths: [34, 16, 20, 21, 17, 13, 19, 18, 20, 30], freeze: true},
                    {name: "Set log", rows: log, widths: [12, 8, 8, 32, 34, 6, 13, 8, 13, 14, 8], freeze: true}];
    let chartN = 0;
    const exNames = Array.from(byEx.keys()).sort();
    const overview = [];   // one chart per exercise for the Charts tab
    exNames.forEach(ex => {
      const pts = byEx.get(ex), nm = sheetName(ex);
      const weighted = pts.some(p => p.top != null);
      const nCharts = weighted ? 3 : 1, top = nCharts * 20;     // charts fill the top of the tab, numbers start below
      const hdr = top + 1;                                       // 1-based header row of the numbers table
      const rows = Array.from({length: top}, () => [])
        .concat([["Session", "Cycle", "Week", "Top weight (lb)", "Total reps", "Volume (lb)", "Est. max (lb)"]])
        .concat(pts.map(p => [p.label, p.cycle, p.week, p.top, p.reps || null, p.vol || null, p.e1rm]));
      const charts = [];
      if (weighted) {
        charts.push({id: ++chartN, xml: chartXml(ex + ": estimated max (strength trend)", "lb", nm, 0, 6, pts.length, "2F7D4F", hdr)});
        charts.push({id: ++chartN, xml: chartXml(ex + ": top weight", "lb", nm, 0, 3, pts.length, "0B6E8A", hdr)});
        charts.push({id: ++chartN, xml: chartXml(ex + ": volume (weight × reps)", "lb", nm, 0, 5, pts.length, "C26A1B", hdr)});
        overview.push(chartXml(ex + ": estimated max (strength trend)", "lb", nm, 0, 6, pts.length, "2F7D4F", hdr));
      } else {
        charts.push({id: ++chartN, xml: chartXml(ex + ": total reps / seconds", "reps / seconds", nm, 0, 4, pts.length, "0B6E8A", hdr)});
        overview.push(chartXml(ex + ": total reps / seconds", "reps / seconds", nm, 0, 4, pts.length, "0B6E8A", hdr));
      }
      sheets.push({name: nm, rows, widths: [26, 8, 8, 16, 12, 14, 14], charts, head: top});
      const tops = pts.map(p => p.top).filter(v => v != null), ests = pts.map(p => p.e1rm).filter(v => v != null);
      summary.push([ex, pts.length, tops[0] ?? null, tops[tops.length - 1] ?? null, tops.length ? Math.max(...tops) : null,
        tops.length > 1 ? tops[tops.length - 1] - tops[0] : null, pts[pts.length - 1].vol || null,
        ests.length ? Math.max(...ests) : null, ests.length > 1 ? ests[ests.length - 1] - ests[0] : null, nm]);
    });
    if (summary.length === 1) summary.push(["No sets logged yet"]);
    // Morning check-ins: HRV and resting HR charts on top, readings table below. Sits after the missed-days tabs.
    {
      const cis = Object.values(checkins || {}).filter(c => c && c.date).sort((a, b) => a.date.localeCompare(b.date));
      if (cis.length) {
        const top = 40, hdr = top + 1, nm = "Morning check-ins";
        const rows = Array.from({length: top}, () => [])
          .concat([["Date", "Sleep (h)", "HRV (ms)", "Resting HR (bpm)", "BP top", "BP bottom", "Light", "Flags", "Knee"]])
          .concat(cis.map(c => [c.date, c.sleep ?? null, c.hrv ?? null, c.rhr ?? null, c.sys ?? null, c.dia ?? null,
            (LIGHTS[c.light] || {}).name || "", (c.flags || []).join("; ") || (c.stop || ""), c.knee && c.knee !== "none" ? c.knee : ""]));
        const charts = [{id: ++chartN, xml: chartXml("Overnight HRV (higher is better)", "ms", nm, 0, 2, cis.length, "2F7D4F", hdr)},
                        {id: ++chartN, xml: chartXml("Resting heart rate (lower is better)", "bpm", nm, 0, 3, cis.length, "C26A1B", hdr)}];
        sheets.splice(2, 0, {name: nm, rows, widths: [12, 10, 10, 16, 9, 10, 9, 60, 8], charts, head: top});
      }
    }
    // Cardio and stretching: minutes charts on top, one row per day, weekly totals below. Sits after the check-ins.
    {
      const xs = Object.values(extras || {}).filter(x => x && x.date).sort((a, b) => a.date.localeCompare(b.date));
      if (xs.length) {
        const top = 40, hdr = top + 1, nm = "Cardio and stretching";
        const n = (v) => typeof v === "number" ? v : null;
        const rows = Array.from({length: top}, () => [])
          .concat([["Date", "Week", "Session", "Cardio", "Cardio min", "Distance", "Unit", "Effort /10", "Avg HR", "Finisher min", "Finisher effort", "Stretch min", "Stretches done"]])
          .concat(xs.map(x => { const c = x.cardio || {}, f = x.finisher || {}, m = x.mobility || {};
            return [x.date, x.week ?? "", x.day ? titleOf(x.day) : "", CARDIO_NAME[c.type] || "", n(c.min), n(c.dist), n(c.dist) != null ? (DIST_UNIT[c.type] || "") : "",
              n(c.effort), n(c.hr), n(f.min), n(f.effort), n(m.min), (m.stretches || []).join(", ")]; }));
        const wk = new Map();
        xs.forEach(x => { const k = mondayOf(x.date), t = wk.get(k) || {c: 0, fin: 0, st: 0, sd: 0}, m = x.mobility || {};
          t.c += n((x.cardio || {}).min) || 0; if (x.finisher && (x.finisher.done || x.finisher.min)) t.fin++;
          t.st += n(m.min) || 0; if (m.done || m.min || (m.stretches || []).length) t.sd++; wk.set(k, t); });
        rows.push([]);
        rows.push(["Week of (Monday)", "", "", "", "Cardio min", "", "", "", "", "Finishers", "", "Stretch min", "Stretch days"]);
        for (const [k, t] of wk) rows.push([k, "", "", "", t.c, "", "", "", "", t.fin, "", t.st, t.sd]);
        const charts = [{id: ++chartN, xml: chartXml("Cardio minutes per day", "min", nm, 0, 4, xs.length, "0B6E8A", hdr)},
                        {id: ++chartN, xml: chartXml("Stretching minutes per day", "min", nm, 0, 11, xs.length, "2F7D4F", hdr)}];
        const at = sheets.findIndex(sh => sh.name === "Morning check-ins");
        sheets.splice(at >= 0 ? at + 1 : 2, 0, {name: nm, rows, widths: [16, 7, 24, 22, 11, 10, 8, 10, 9, 12, 14, 12, 60], charts, head: top});
      }
    }
    // Charts tab first, so the graphs are the first thing you see when the file opens.
    const chartRows = overview.length ? [] : [["No sets logged yet. Log a workout, then export again to see your charts."]];
    sheets.unshift({name: "Charts", rows: chartRows, widths: [14, 14, 14, 14, 14, 14, 14], first: true,
      charts: overview.map(xml => ({id: ++chartN, xml}))});

    // ---- package ----
    const zip = new JSZipLib();
    let ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`;
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
      `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B6E8A"/><bgColor indexed="64"/></patternFill></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    let wbSheets = "", wbRels = "";
    sheets.forEach((sh, i) => {
      const n = i + 1, hasCharts = !!(sh.charts && sh.charts.length);
      zip.file(`xl/worksheets/sheet${n}.xml`, sheetXml(sh.rows, sh.widths, hasCharts, {freeze: sh.freeze, head: sh.head || 0, first: i === 0}));
      ct += `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      wbSheets += `<sheet name="${X(sh.name)}" sheetId="${n}" r:id="rId${n}"/>`;
      wbRels += `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`;
      if (hasCharts) {
        zip.file(`xl/worksheets/_rels/sheet${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`);
        let anchors = "", drels = "";
        sh.charts.forEach((ch, k) => {
          anchors += anchor("rId" + (k + 1), ch.id, k * 20 + (sh.first ? 0 : 0), k * 20 + 19);
          drels += `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${ch.id}.xml"/>`;
          zip.file(`xl/charts/chart${ch.id}.xml`, ch.xml);
          ct += `<Override PartName="/xl/charts/chart${ch.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
        });
        zip.file(`xl/drawings/drawing${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);
        zip.file(`xl/drawings/_rels/drawing${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drels}</Relationships>`);
        ct += `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
      }
    });
    wbRels += `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets}</sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels}</Relationships>`);
    zip.file("[Content_Types].xml", ct + "</Types>");
    return {zip, exerciseCount: exNames.length, setCount: log.length - 1};
  }


  async function exportExcel() {
    const btn = $("exportXlsx"); await flushNow();
    const list = Object.values(sessions).filter(s => s && s.sets && Object.values(s.sets).some(a => (a || []).some(x => x && (x.w != null || x.r != null))));
    if (!list.length) { saveMsg("Log at least one set before exporting.", "warn"); return; }
    if (!window.JSZip) { saveMsg("The Excel builder didn't load. Reload the app and try again.", "warn"); return; }
    btn.disabled = true; saveMsg("Building your workbook…");
    try {
      const {zip, exerciseCount, setCount} = buildWorkbook(window.JSZip, list, titleOf);
      const blob = await zip.generateAsync({type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      await saveFile("Training Log " + today() + ".xlsx", blob);
      saveMsg(`Exported ${setCount} sets across ${exerciseCount} exercises, each with its own chart.`, "ok");
    } catch (e) {
      const code = e && e.code;
      saveMsg(code === "declined" ? "Export cancelled." : code === "rate_limited" ? "A save prompt is already open. Finish that one first." : "The export didn't go through. Try again.", code === "declined" ? "" : "warn");
    } finally { btn.disabled = false; }
  }

  // ================= backup / restore =================
  const BACKUP_APP = "daily-training-coach";
  let pendingRestore = null;
  async function backupData() {
    await flushNow();
    const payload = {app: BACKUP_APP, schema: 1, exportedAt: new Date().toISOString(), profile, settings, sessions, checkins, extras};
    $("backupText").value = JSON.stringify(payload);
    try {
      const how = await saveFile("Training backup " + today() + ".json", JSON.stringify(payload, null, 1), "application/json");
      noteBackup();
      saveMsg(how === "shared" ? "Backup ready. If you picked Google Drive, it's safe even if you lose this phone." : "Backed up. Keep this file somewhere safe: Google Drive, or email it to yourself.", "ok");
    }
    catch (e) {
      if (e && e.code === "declined") { saveMsg("Backup cancelled."); return; }
      $("backupPanel").hidden = false; $("restorePanel").hidden = true; saveMsg("Couldn't save a file here. Copy the text below instead.", "warn");
    }
  }
  $("restoreFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    const rd = new FileReader(); rd.onload = () => checkBackup(rd.result); rd.onerror = () => saveMsg("Couldn't read that file. Try again.", "warn"); rd.readAsText(f);
  });
  function checkBackup(text) {
    let data; const bad = () => saveMsg("That isn't a backup from this app. Copy it again and paste the whole thing.", "warn");
    try { data = JSON.parse(String(text || "").trim()); } catch (err) { bad(); return; }
    if (!data || data.app !== BACKUP_APP || typeof data.sessions !== "object") { bad(); return; }
    const has = (x) => x && (x.w != null || x.r != null);
    const writes = []; let newS = 0, filled = 0;
    for (const [id, s] of Object.entries(data.sessions || {})) {
      if (!/^c\d+-w[1-4]-s[1-5]$/.test(id) || !s || !s.sets) continue;
      const cur = sessions[id];
      if (!cur) { writes.push([id, Object.assign({kind: "session"}, s)]); newS++; continue; }
      const body = JSON.parse(JSON.stringify(cur)); body.sets = body.sets || {}; let ch = 0;
      for (const [ex, arrIn] of Object.entries(s.sets)) {
        const arr = (body.sets[ex] || []).slice();
        (arrIn || []).forEach((x, i) => { if (has(x) && !has(arr[i])) { arr[i] = Object.assign({}, arr[i], x); ch++; } });
        for (let i = 0; i < arr.length; i++) if (!arr[i]) arr[i] = {};
        body.sets[ex] = arr;
      }
      if (ch) { body.updatedAt = Date.now(); writes.push([id, body]); filled += ch; }
    }
    const ci = Object.entries(data.checkins || {}).filter(([id, c]) => /^checkin-\d{4}-\d{2}-\d{2}$/.test(id) && c && !checkins[id]);
    const xs = Object.entries(data.extras || {}).filter(([id, x]) => /^extra-\d{4}-\d{2}-\d{2}$/.test(id) && x && typeof x === "object" && !extras[id]);
    pendingRestore = {writes, ci, xs, profile: !profile && data.profile ? data.profile : null};
    const box = $("restoreConfirm");
    box.innerHTML = !writes.length && !ci.length && !xs.length && !pendingRestore.profile
      ? `<span>Everything in this backup is already here.</span><button type="button" class="btn alt" id="restoreNo">Close</button>`
      : `<span>Backup from ${esc((data.exportedAt || "").slice(0, 10) || "unknown date")}: ${newS} new session${newS === 1 ? "" : "s"}, ${filled} set${filled === 1 ? "" : "s"} to fill in, ${ci.length} check-in${ci.length === 1 ? "" : "s"}${xs.length ? `, ${xs.length} day${xs.length === 1 ? "" : "s"} of cardio and stretching` : ""}. Anything already entered here is kept.</span>
         <button type="button" class="btn" id="restoreYes">Restore</button><button type="button" class="btn alt" id="restoreNo">Cancel</button>`;
    box.hidden = false; $("restorePanel").hidden = true;
  }
  async function applyRestore() {
    if (!pendingRestore || !store) return;
    const {writes, ci, xs, profile: pr} = pendingRestore; pendingRestore = null; $("restoreConfirm").hidden = true;
    try {
      if (pr) { profile = pr; await store.save("profile", pr); }
      for (const [id, body] of writes) { sessions[id] = body; await store.save(id, body); }
      for (const [id, c] of ci) { const v = Object.assign({kind: "checkin"}, c); checkins[id] = v; await store.save(id, v); }
      for (const [id, x] of (xs || [])) { const v = Object.assign({kind: "extra"}, x); extras[id] = v; await store.save(id, v); }
      renderAll(); saveMsg("Restored. Your history and \"Last time\" numbers are back.", "ok");
    } catch (e) { renderAll(); saveMsg("Restore stopped partway. Paste and restore again to finish.", "warn"); }
  }

  // ================= workout timer (from the original log) =================
    // ---------- workout timer ----------
  const tb = { start: 0, paused: 0, pausedAt: 0, running: false, restEnd: 0, restLen: 0, restMsg: "", goUntil: 0, confirmEnd: false, ctx: null, lock: null };
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const elapsed = () => !tb.start ? 0 : ((tb.running ? Date.now() : tb.pausedAt) - tb.start - tb.paused);

  // Alerts are short one-shot clips. A phone treats a sub-second sound as a brief interruption:
  // your music dips or pauses for the beep and the spoken cue, then comes back on its own.
  // (A continuously open audio channel would grab the speaker and stop your music for good.)
  const clipCache = {};
  function beepClip(times, freq) {
    const key = times + ":" + freq;
    if (clipCache[key]) return clipCache[key];
    const rate = 22050, tone = 0.2, gap = 0.12, n = Math.floor(rate * (times * (tone + gap) + 0.05));
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / rate, k = Math.floor(t / (tone + gap)), local = t - k * (tone + gap);
      let s = 0;
      if (k < times && local < tone) { const env = Math.min(1, local / 0.01, (tone - local) / 0.03); s = Math.sin(2 * Math.PI * freq * local) * 0.85 * env; }
      v.setInt16(44 + i * 2, s * 32767, true);
    }
    return (clipCache[key] = URL.createObjectURL(new Blob([buf], {type: "audio/wav"})));
  }
  function audio() { try { beepClip(1, 660); beepClip(2, 880); beepClip(3, 990); } catch (e) {} }
  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }
  function beep(times, freq) {
    buzz(times === 1 ? [150] : times === 2 ? [200, 100, 200] : [200, 100, 200, 100, 400]);
    try { const a = new Audio(beepClip(times, freq || 880)); a.volume = 1; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function say(text, delay) {
    try {
      if (!("speechSynthesis" in window)) return;
      setTimeout(() => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.05; u.volume = 1; u.lang = "en-US"; window.speechSynthesis.speak(u); }, delay || 0);
    } catch (e) {}
  }
  function testAlerts() { audio(); beep(2, 880); say("Start rest", 700); setTimeout(() => { beep(1, 990); say("20 seconds left", 450); }, 3500); setTimeout(() => { beep(3, 990); say("Go", 900); }, 7500); }
  async function wake() { try { if (navigator.wakeLock) tb.lock = await navigator.wakeLock.request("screen"); } catch (e) {} }

  // ---------- workout clock survives closing the app ----------
  // The clock is wall-clock based (start time + paused time), so saving those numbers is enough:
  // reopen the log and it shows the real time since you started, rest countdown included.
  const TKEY = "liftlog.timer.v1";
  function timerSnapshot() {
    return {kind: "timer", start: tb.start, paused: tb.paused, pausedAt: tb.pausedAt, running: tb.running,
      restEnd: tb.restEnd, restLen: tb.restLen, restMsg: tb.restMsg, date: today(), week, dayKey, cycle: settings.cycle, savedAt: Date.now()};
  }
  function persistTimer() {
    const snap = timerSnapshot();
    try { localStorage.setItem(TKEY, JSON.stringify(snap)); } catch (e) {}
    try { if (store && store.saveTimer) store.saveTimer(snap).catch(() => {}); } catch (e) {}
  }
  function localTimer() { try { return JSON.parse(localStorage.getItem(TKEY) || "null"); } catch (e) { return null; } }
  function restoreTimer(t) {
    if (!t || !t.start || t.date !== today() || tb.start) return false;
    Object.assign(tb, {start: t.start, paused: t.paused || 0, pausedAt: t.pausedAt || 0, running: !!t.running,
      restEnd: t.restEnd || 0, restLen: t.restLen || 0, restMsg: t.restMsg || ""});
    if (tb.restEnd && tb.restEnd <= Date.now()) tb.restEnd = 0;   // rest ran out while closed
    if (t.week) week = t.week;
    if (t.dayKey) dayKey = t.dayKey;
    if (tb.running) wake();
    return true;
  }
  function startWorkout() {
    audio();
    if (!tb.start) { tb.start = Date.now(); tb.paused = 0; }
    else if (!tb.running) { tb.paused += Date.now() - tb.pausedAt; }
    tb.running = true; wake(); beep(1, 660); say("Workout started", 150); renderTimer(); persistTimer();
  }
  function pauseWorkout() { if (!tb.running) return; tb.running = false; tb.pausedAt = Date.now(); try { tb.lock && tb.lock.release(); } catch (e) {} renderTimer(); persistTimer(); }
  function endWorkout() {
    tb.confirmEnd = false; const ms = elapsed(), total = fmt(ms);
    try { localStorage.setItem(LKEY, JSON.stringify({date: today(), min: Math.max(1, Math.round(ms / 60000))})); } catch (e) {}
    tb.start = 0; tb.running = false; tb.restEnd = 0; tb.goUntil = 0;
    try { tb.lock && tb.lock.release(); } catch (e) {}
    renderTimer(); $("tbLabel").textContent = "Last workout: " + total; persistTimer();
  }
  function setDone(b) {
    audio();
    if (!tb.start || !tb.running) startWorkout();
    const si = +b.dataset.s, of = +b.dataset.of, rest = +b.dataset.rest, next = b.dataset.next;
    const lastSet = si + 1 >= of;
    if (lastSet && !next) {
      tb.restEnd = 0; tb.goUntil = Date.now() + 8000; tb.restMsg = "Lifting done. Next: " + afterLift + ".";
      beep(3, 990); say("Lifting done. " + afterLiftSay, 750); renderTimer(); persistTimer(); return;
    }
    tb.restLen = (lastSet ? 60 : rest) * 1000;
    tb.restEnd = Date.now() + tb.restLen; tb.goUntil = 0;
    tb.restMsg = lastSet ? "1 min to change over. Next: " + next : b.dataset.ex + ": set " + (si + 2) + " of " + of + " next";
    tb.warnedFor = 0;
    beep(2, 880); say("Start rest", 600);
    document.querySelectorAll(".ex.active").forEach(e => e.classList.remove("active"));
    const card = b.closest(".ex"); if (card) card.classList.add("active");
    renderTimer(); persistTimer();
  }
  function restOver() {
    tb.restEnd = 0; tb.goUntil = Date.now() + 6000;
    beep(3, 990); say("Go", 900); renderTimer(); persistTimer();
  }
  function renderTimer() {
    const started = !!tb.start;
    $("tbBtns").innerHTML = tb.confirmEnd
      ? `<span class="meta">End this workout?</span><button type="button" class="btn" id="tbEndYes">End workout</button><button type="button" class="btn alt" id="tbEndNo">Keep going</button>`
      : !started ? (lastWorkout() ? `<button type="button" class="btn" id="shareWorkout">Share this workout</button><button type="button" class="btn alt" id="tbStart">Start again</button>`
        : `<button type="button" class="btn" id="tbStart">Start workout</button><button type="button" class="btn alt" id="tbTest">Test sound</button>`)
      : (tb.running ? `<button type="button" class="btn alt" id="tbPause">Pause</button>` : `<button type="button" class="btn" id="tbStart">Resume</button>`)
        + `<button type="button" class="btn alt" id="tbEnd">End</button>`;
    if (started) $("tbLabel").textContent = tb.running ? "Workout time" : "Paused";
    else if (!/^Last workout/.test($("tbLabel").textContent)) $("tbLabel").textContent = "Workout timer · tap Start, then ✓ each set";
    tickTimer();
  }
  function tickTimer() {
    $("tbTime").textContent = fmt(elapsed());
    const now = Date.now(), rest = $("tbRest");
    if (tb.restEnd && tb.running) {
      const left = tb.restEnd - now;
      if (left <= 0) { restOver(); return; }
      // Spoken heads-up with 20 seconds of rest left (once per rest).
      if (left <= 20000 && tb.restLen > 20000 && tb.warnedFor !== tb.restEnd) { tb.warnedFor = tb.restEnd; beep(1, 990); say("20 seconds left", 450); }
      rest.hidden = false;
      $("tbWord").textContent = "Rest"; $("tbWord").className = "tb-restword";
      $("tbRestTime").textContent = fmt(left + 999);
      $("tbBar").style.width = Math.min(100, 100 * (1 - left / tb.restLen)) + "%";
      if ($("tbNext").textContent !== tb.restMsg) $("tbNext").textContent = tb.restMsg;
      $("tbSkip").hidden = false;
    } else if (tb.goUntil > now) {
      rest.hidden = false;
      $("tbWord").textContent = /Lifting done/.test(tb.restMsg) ? "Done" : "Go"; $("tbWord").className = "tb-restword go";
      $("tbRestTime").textContent = ""; $("tbBar").style.width = "100%";
      $("tbNext").textContent = tb.restMsg; $("tbSkip").hidden = true;
    } else if (!(tb.restEnd && !tb.running)) {
      rest.hidden = true;
    }
  }
  setInterval(tickTimer, 250);
  // Keyboard handling: while typing a weight or reps, shrink the pinned timer to one slim line
  // and scroll the box you're typing in to the middle of what's left of the screen.
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches("input, textarea")) return;
    document.body.classList.add("typing");
    setTimeout(() => { try { t.scrollIntoView({block: "center", behavior: "smooth"}); } catch (err) {} }, 250);
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches("input, textarea")) document.body.classList.remove("typing"); }, 120);
  });
  // Tapping Enter (Go/Next on the phone keyboard) moves from weight to reps, then closes the keyboard.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter" || !t || !t.dataset || !t.dataset.f) return;
    e.preventDefault();
    const [kind, ri, si] = t.id.split("-");
    const next = kind === "w" ? $(`r-${ri}-${si}`) : null;
    if (next) next.focus(); else t.blur();
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && tb.running) wake(); });



  // ================= storage =================
  function localStore() {
    const K = "coach.v1";
    try { const raw = JSON.parse(localStorage.getItem(K) || "{}"); profile = raw.profile || null; settings = raw.settings || settings; sessions = raw.sessions || {}; checkins = raw.checkins || {}; extras = raw.extras || {}; } catch (e) {}
    const persist = () => { try { localStorage.setItem(K, JSON.stringify({profile, settings, sessions, checkins, extras})); } catch (e) {} };
    return {label: STANDALONE ? "Saved on this phone" : "Saved on this device only", cls: STANDALONE ? "ok" : "warn", save: async () => persist(), saveTimer: async () => {}};
  }
  async function init() {
    renderAll(); renderTimer(); setStatus("Connecting…");
    let db = null, uid = null;
    try { if (window.claude && window.claude.use) { db = await window.claude.use("db"); const user = await window.claude.use("user"); uid = user ? await user.id() : null; } } catch (e) { db = null; }
    if (!db || !uid) { store = localStore(); week = currentProgramWeek(); dayKey = null; restoreTimer(localTimer()); renderAll(); renderTimer(); setStatus(store.label, store.cls); return; }
    const col = db.collection("data/users/" + uid);
    store = {label: "Saved", cls: "ok", save: (id, v) => col.doc(id).set(v), saveTimer: (t) => col.doc("timer").set(t)};
    let first = true;
    col.onSnapshot((snap) => {
      const next = {}, nextCi = {}, nextX = {}; let timerDoc = null, prof = null;
      snap.docs.forEach(d => {
        const v = d.data(); if (!v) return;
        if (d.id === "timer") timerDoc = v;
        else if (d.id === "settings") settings = Object.assign({cycle: 1}, v);
        else if (d.id === "profile") prof = v;
        else if (v.kind === "session") next[d.id] = v;
        else if (v.kind === "checkin") nextCi[d.id] = v;
        else if (v.kind === "extra") nextX[d.id] = v;
      });
      if (pendingId && sessions[pendingId]) next[pendingId] = sessions[pendingId];
      sessions = next;
      const tci = checkins[ciId(today())];
      if (tci && (!nextCi[ciId(today())] || (nextCi[ciId(today())].savedAt || 0) < (tci.savedAt || 0))) nextCi[ciId(today())] = tci;
      checkins = nextCi;
      for (const [id, x] of Object.entries(extras)) if (x && (!nextX[id] || (nextX[id].savedAt || 0) < (x.savedAt || 0))) nextX[id] = x;
      extras = nextX;
      if (prof && (!profile || (prof.updatedAt || 0) >= (profile.updatedAt || 0))) profile = prof;
      const active = document.activeElement, typing = active && active.dataset && (active.dataset.f || active.dataset.x);
      let resumed = false;
      if (first) {
        week = currentProgramWeek(); dayKey = null;
        const loc = localTimer(), t = (timerDoc && (!loc || (timerDoc.savedAt || 0) >= (loc.savedAt || 0))) ? timerDoc : loc;
        resumed = restoreTimer(t);
      }
      if (first || !typing) renderAll();
      if (first) { first = false; renderTimer(); setStatus(resumed ? "Picked up where you left off. Your clock kept running." : Object.keys(sessions).length ? "Saved" : "Ready. Your sets save as you type.", "ok"); }
    }, () => setStatus("Lost connection. Reload to reconnect.", "warn"));
  }
  if (globalThis.__COACH_TEST__) {   // test hook only; never set on the published page
    globalThis.__coach = {setProfile: (p) => { profile = p; }, setCheckin: (c) => { checkins[ciId(today())] = c; }, plan, buildSession, budget, level, scoreCheckin, cardioKind,
      setSessions: (x) => { sessions = x; }, targetFor, liftsFor, judge, incFor,
      setCheckins: (x) => { checkins = x; }, weeksInARow, cardFacts, winsFor, drawCard};
    return;
  }
  init();
})();

