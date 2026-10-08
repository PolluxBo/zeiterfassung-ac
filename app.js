(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const DUR_PRESETS = [15, 30, 60, 90, 120, 240, 480];
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  // ---------- Datum ----------
  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { week: Math.ceil(((t - y0) / 864e5 + 1) / 7), year: t.getUTCFullYear() };
  };
  const fmtDate = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtMin = m => `${Math.floor(m / 60)}:${pad(m % 60)}`;
  const lastWorkday = d => { const w = d.getDay(); return w === 6 ? addDays(d, -1) : w === 0 ? addDays(d, -2) : d; };

  // ---------- Speicher (localStorage auf dem Gerät) ----------
  const PREFIX = "zac:";
  const store = {
    get(k, fallback) { try { const v = JSON.parse(localStorage.getItem(PREFIX + k)); return v ?? fallback; } catch { return fallback; } },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; }
      catch { toast("Speichern fehlgeschlagen. Ist privates Surfen aktiv?"); return false; }
    },
    remove(k) { try { localStorage.removeItem(PREFIX + k); } catch {} },
    getDay(key) { return store.get("d-" + key, []); },
    setDay(key, entries) { if (entries.length) return store.set("d-" + key, entries); store.remove("d-" + key); return true; },
    allDays() {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX + "d-")) out[k.slice(PREFIX.length + 2)] = JSON.parse(localStorage.getItem(k));
        }
      } catch {}
      return out;
    }
  };

  // ---------- Zustand ----------
  const state = {
    sel: keyOf(lastWorkday(new Date())),
    monday: null,
    settings: Object.assign({ email: "", name: "", kunden: [] }, store.get("settings", {})),
    dur: 60,
    editId: null,
    range: "day"
  };
  state.monday = mondayOf(fromKey(state.sel));

  const toast = msg => {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
  };
  const sum = es => es.reduce((a, e) => a + (e.min || 0), 0);
  const weekKeys = () => [0, 1, 2, 3, 4].map(i => keyOf(addDays(state.monday, i)));
  const rangeKeys = () => state.range === "day" ? [state.sel] : weekKeys();

  // ---------- Rendern ----------
  function renderWeek() {
    const kw = isoWeek(state.monday);
    $("kwLabel").textContent = `KW ${kw.week} · ${fmtDate(state.monday).slice(0, 6)}–${fmtDate(addDays(state.monday, 4))}`;
    const today = keyOf(new Date());
    const days = $("days"); days.textContent = "";
    let total = 0;
    weekKeys().forEach(k => {
      const d = fromKey(k), m = sum(store.getDay(k)); total += m;
      const b = document.createElement("button");
      b.className = "day" + (m ? " has" : "") + (k === today ? " today" : "");
      b.setAttribute("aria-pressed", String(k === state.sel));
      b.setAttribute("aria-label", `${WD_LONG[d.getDay()]} ${fmtDate(d)}, ${fmtMin(m)} Stunden`);
      b.innerHTML = `<span class="wd">${WD[d.getDay()]}</span><span class="dt">${d.getDate()}.</span><span class="hs">${m ? fmtMin(m) : "–"}</span>`;
      b.onclick = () => { state.sel = k; cancelEdit(); renderAll(); };
      days.appendChild(b);
    });
    $("weekTotal").textContent = fmtMin(total) + " h";
  }

  function renderList() {
    const d = fromKey(state.sel), es = store.getDay(state.sel);
    $("listDay").textContent = `${WD_LONG[d.getDay()]}, ${fmtDate(d)}`;
    $("formDay").textContent = `für ${WD[d.getDay()]}, ${fmtDate(d)}`;
    const list = $("list"); list.textContent = "";
    if (!es.length) {
      const p = document.createElement("div"); p.className = "empty";
      p.textContent = "Für diesen Tag ist noch nichts erfasst. Kunde und Zeit oben eintragen und speichern.";
      list.appendChild(p);
    }
    es.forEach(e => {
      const r = document.createElement("div");
      r.className = "entry" + (e.id === state.editId ? " editing" : "");
      r.tabIndex = 0; r.setAttribute("role", "button");
      const k = document.createElement("span"); k.className = "k"; k.textContent = e.kunde;
      const t = document.createElement("span"); t.className = "t"; t.textContent = fmtMin(e.min) + " h";
      r.append(k, t);
      if (e.notiz) { const n = document.createElement("span"); n.className = "n"; n.textContent = e.notiz; r.appendChild(n); }
      r.onclick = () => startEdit(e);
      r.onkeydown = ev => { if (ev.key === "Enter") startEdit(e); };
      list.appendChild(r);
    });
    $("dayTotal").textContent = fmtMin(sum(es)) + " h";
  }

  function renderDur() {
    $("dur").innerHTML = `${fmtMin(state.dur)}<small>h</small>`;
    [...$("durChips").children].forEach(c => c.classList.toggle("on", +c.dataset.m === state.dur));
  }

  function renderKunden() {
    const ks = state.settings.kunden || [];
    const dl = $("kundenListe"); dl.textContent = "";
    ks.forEach(k => { const o = document.createElement("option"); o.value = k; dl.appendChild(o); });
    const ch = $("kundenChips"); ch.textContent = "";
    ks.slice(0, 8).forEach(k => {
      const b = document.createElement("button"); b.className = "chip"; b.textContent = k;
      b.onclick = () => { $("kunde").value = k; };
      ch.appendChild(b);
    });
  }

  function renderSend() {
    const em = state.settings.email;
    $("addr").textContent = em || "Keine Empfänger-Adresse hinterlegt. Bitte unter Einstellungen eintragen.";
    $("copyAddr").disabled = !em;
    $("rangeDay").setAttribute("aria-pressed", String(state.range === "day"));
    $("rangeWeek").setAttribute("aria-pressed", String(state.range === "week"));
    const es = rangeKeys().flatMap(k => store.getDay(k));
    $("rangeInfo").textContent = `${es.length} ${es.length === 1 ? "Eintrag" : "Einträge"} · ${fmtMin(sum(es))} h`;
    $("export").disabled = !es.length;
  }

  function renderAll() { renderWeek(); renderList(); renderSend(); }

  // ---------- Erfassung ----------
  function setDur(m) { state.dur = Math.max(15, Math.min(24 * 60, m)); renderDur(); }

  function startEdit(e) {
    state.editId = e.id;
    $("kunde").value = e.kunde; $("notiz").value = e.notiz || ""; setDur(e.min);
    $("formTitle").textContent = "Eintrag bearbeiten";
    $("save").textContent = "Änderung speichern";
    $("cancelEdit").hidden = $("delete").hidden = false;
    renderList();
    $("kunde").scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function cancelEdit() {
    state.editId = null;
    $("kunde").value = ""; $("notiz").value = ""; setDur(60);
    $("formTitle").textContent = "Neuer Eintrag";
    $("save").textContent = "Eintrag speichern";
    $("cancelEdit").hidden = $("delete").hidden = true;
  }

  function saveSettingsState() { store.set("settings", state.settings); }

  function saveEntry() {
    const kunde = $("kunde").value.trim();
    if (!kunde) { toast("Bitte einen Kunden eintragen."); $("kunde").focus(); return; }
    const notiz = $("notiz").value.trim();
    const es = store.getDay(state.sel);
    if (state.editId) {
      const i = es.findIndex(e => e.id === state.editId);
      if (i >= 0) es[i] = { ...es[i], kunde, min: state.dur, notiz };
    } else {
      es.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kunde, min: state.dur, notiz });
    }
    if (!store.setDay(state.sel, es)) return;
    const was = state.editId;
    const ks = [kunde, ...(state.settings.kunden || []).filter(k => k.toLowerCase() !== kunde.toLowerCase())].slice(0, 40);
    if (ks.join("|") !== (state.settings.kunden || []).join("|")) {
      state.settings.kunden = ks; saveSettingsState(); renderKunden();
    }
    cancelEdit(); renderAll();
    toast(was ? "Eintrag geändert" : "Eintrag gespeichert");
  }

  function deleteEntry() {
    if (!state.editId) return;
    const btn = $("delete");
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = "1"; btn.textContent = "Wirklich löschen?";
      setTimeout(() => { delete btn.dataset.confirm; btn.textContent = "Löschen"; }, 3000);
      return;
    }
    delete btn.dataset.confirm; btn.textContent = "Löschen";
    const es = store.getDay(state.sel).filter(e => e.id !== state.editId);
    if (!store.setDay(state.sel, es)) return;
    cancelEdit(); renderAll(); toast("Eintrag gelöscht");
  }

  // ---------- Excel ----------
  function periodText() {
    if (state.range === "day") { const d = fromKey(state.sel); return `${WD_LONG[d.getDay()]}, ${fmtDate(d)}`; }
    return `KW ${isoWeek(state.monday).week}: ${fmtDate(state.monday)} – ${fmtDate(addDays(state.monday, 4))}`;
  }

  function fileName() {
    if (state.range === "day") return `Zeiterfassung_AC_${state.sel}.xlsx`;
    const kw = isoWeek(state.monday);
    return `Zeiterfassung_AC_KW${pad(kw.week)}_${kw.year}.xlsx`;
  }

  function buildWorkbook() {
    const keys = rangeKeys();
    const rows = [
      ["Zeiterfassung AC"],
      ["Mitarbeiter", state.settings.name || ""],
      ["Zeitraum", periodText()],
      [],
      ["Datum", "Wochentag", "Kunde", "Tätigkeit / Notiz", "Dauer (h:mm)", "Stunden"]
    ];
    const first = rows.length + 1;
    let total = 0;
    const perK = {};
    keys.forEach(k => {
      const d = fromKey(k);
      store.getDay(k).forEach(e => {
        total += e.min;
        perK[e.kunde] = (perK[e.kunde] || 0) + e.min;
        rows.push([d, WD_LONG[d.getDay()], e.kunde, e.notiz || "", e.min / 1440, Math.round(e.min / 60 * 100) / 100]);
      });
    });
    const last = rows.length;
    rows.push([]);
    const totalRow = rows.length + 1;
    rows.push(["", "", "", "Summe", null, null]);
    rows.push([]);
    rows.push(["Summe je Kunde"]);
    Object.entries(perK).sort((a, b) => b[1] - a[1])
      .forEach(([k, m]) => rows.push(["", "", k, "", m / 1440, Math.round(m / 60 * 100) / 100]));

    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    ws[`E${totalRow}`] = { t: "n", f: `SUM(E${first}:E${last})`, v: total / 1440 };
    ws[`F${totalRow}`] = { t: "n", f: `SUM(F${first}:F${last})`, v: Math.round(total / 60 * 100) / 100 };
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = first - 1; r <= range.e.r; r++) {
      const a = ws[XLSX.utils.encode_cell({ r, c: 0 })]; if (a && a.t === "d") a.z = "dd.mm.yyyy";
      const e = ws[XLSX.utils.encode_cell({ r, c: 4 })]; if (e && e.t === "n") e.z = "[h]:mm";
      const f = ws[XLSX.utils.encode_cell({ r, c: 5 })]; if (f && f.t === "n") f.z = "0.00";
    }
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 40 }, { wch: 13 }, { wch: 10 }];
    ws["!autofilter"] = { ref: `A${first - 1}:F${last}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zeiterfassung");
    return wb;
  }

  function mailText() {
    const lines = ["Hallo,", "", `anbei die Zeiterfassung für ${periodText()}.`, ""];
    let total = 0;
    rangeKeys().forEach(k => {
      const es = store.getDay(k); if (!es.length) return;
      const d = fromKey(k);
      lines.push(`${WD[d.getDay()]}, ${fmtDate(d)}`);
      es.forEach(e => { total += e.min; lines.push(`  • ${e.kunde}: ${fmtMin(e.min)} h${e.notiz ? " – " + e.notiz : ""}`); });
    });
    lines.push("", `Summe: ${fmtMin(total)} h`, "", "Viele Grüße");
    if (state.settings.name) lines.push(state.settings.name);
    return lines.join("\n");
  }

  function copyAddr(silent) {
    const em = state.settings.email; if (!em) return;
    const fallback = () => {
      const sel = window.getSelection(), r = document.createRange();
      r.selectNodeContents($("addr")); sel.removeAllRanges(); sel.addRange(r);
      if (!silent) toast("Adresse markiert. Jetzt „Kopieren“ wählen.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(em).then(() => { if (!silent) toast("Adresse kopiert"); }, fallback);
    } else fallback();
  }

  // Datei über das Teilen-Menü anbieten, sonst herunterladen.
  async function shareFile(file, title, text) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text }); return "shared"; }
      catch (e) { if (e && e.name === "AbortError") return "aborted"; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return "downloaded";
  }

  async function exportXlsx() {
    if (typeof XLSX === "undefined") { toast("Excel-Modul nicht geladen. Bitte App neu öffnen."); return; }
    if (!state.settings.email) { toast("Bitte zuerst die Empfänger-Adresse unter Einstellungen eintragen."); $("settingsBox").open = true; $("email").focus(); return; }
    copyAddr(true);
    const buf = XLSX.write(buildWorkbook(), { bookType: "xlsx", type: "array", cellDates: true });
    const file = new File([buf], fileName(), { type: XLSX_MIME });
    const subject = `Zeiterfassung AC – ${periodText()}`;
    const res = await shareFile(file, subject, mailText());
    if (res === "shared") toast("Übergeben. In Mail an " + state.settings.email + " senden.");
    else if (res === "downloaded") toast("Excel-Datei heruntergeladen");
  }

  // ---------- Einstellungen & Sicherung ----------
  function saveSettings() {
    const em = $("email").value.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast("Die E-Mail-Adresse sieht unvollständig aus."); $("email").focus(); return; }
    state.settings.email = em;
    state.settings.name = $("mitarbeiter").value.trim();
    saveSettingsState();
    toast("Einstellungen gespeichert");
    $("settingsBox").open = false;
    renderSend();
  }

  async function backup() {
    const data = { app: "Zeiterfassung AC", version: 1, created: new Date().toISOString(), settings: state.settings, days: store.allDays() };
    const file = new File([JSON.stringify(data, null, 1)], `Zeiterfassung_AC_Sicherung_${keyOf(new Date())}.json`, { type: "application/json" });
    const res = await shareFile(file, "Zeiterfassung AC Sicherung", "");
    if (res !== "aborted") toast("Sicherung erstellt");
  }

  function restore(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || data.app !== "Zeiterfassung AC" || typeof data.days !== "object") throw new Error("format");
        let n = 0;
        Object.entries(data.days).forEach(([k, es]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(es)) return;
          const current = store.getDay(k);
          const ids = new Set(current.map(e => e.id));
          const merged = current.concat(es.filter(e => e && !ids.has(e.id)));
          n += merged.length - current.length;
          store.setDay(k, merged);
        });
        if (data.settings) {
          state.settings = Object.assign({ email: "", name: "", kunden: [] }, data.settings, {
            email: state.settings.email || data.settings.email || "",
            name: state.settings.name || data.settings.name || ""
          });
          saveSettingsState();
          $("email").value = state.settings.email; $("mitarbeiter").value = state.settings.name;
          renderKunden();
        }
        renderAll();
        toast(`Sicherung geladen: ${n} Einträge ergänzt`);
      } catch {
        toast("Diese Datei ist keine Sicherung von Zeiterfassung AC.");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Woche wechseln ----------
  function shiftWeek(n) {
    state.monday = addDays(state.monday, 7 * n);
    const keepWd = (fromKey(state.sel).getDay() + 6) % 7;
    state.sel = keyOf(addDays(state.monday, keepWd));
    cancelEdit(); renderAll();
  }

  function goToday() {
    state.sel = keyOf(lastWorkday(new Date()));
    state.monday = mondayOf(fromKey(state.sel));
    cancelEdit(); renderAll();
  }

  // ---------- Events ----------
  DUR_PRESETS.forEach(m => {
    const b = document.createElement("button"); b.className = "chip"; b.dataset.m = m; b.textContent = fmtMin(m);
    b.onclick = () => setDur(m); $("durChips").appendChild(b);
  });
  $("minus").onclick = () => setDur(state.dur - 15);
  $("plus").onclick = () => setDur(state.dur + 15);
  $("save").onclick = saveEntry;
  $("cancelEdit").onclick = () => { cancelEdit(); renderList(); };
  $("delete").onclick = deleteEntry;
  $("prevWeek").onclick = () => shiftWeek(-1);
  $("nextWeek").onclick = () => shiftWeek(1);
  $("kwLabel").onclick = goToday;
  $("rangeDay").onclick = () => { state.range = "day"; renderSend(); };
  $("rangeWeek").onclick = () => { state.range = "week"; renderSend(); };
  $("export").onclick = exportXlsx;
  $("copyAddr").onclick = () => copyAddr(false);
  $("saveSettings").onclick = saveSettings;
  $("backup").onclick = backup;
  $("restoreBtn").onclick = () => $("restoreFile").click();
  $("restoreFile").onchange = e => { const f = e.target.files[0]; if (f) restore(f); e.target.value = ""; };

  // Beim Zurückkehren in die App den heutigen Tag aktualisieren
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderWeek(); });

  // Dauerhaften Speicher anfragen, damit iOS die Daten nicht aufräumt
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- Start ----------
  $("email").value = state.settings.email || "";
  $("mitarbeiter").value = state.settings.name || "";
  if (!state.settings.email) $("settingsBox").open = true;
  renderDur(); renderKunden(); renderAll();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
