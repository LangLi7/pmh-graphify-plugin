// src/host/entry.ts
import z from "@deepseek-ai/schemastery";

// src/host/index.ts
import { readFileSync as readFileSync2, realpathSync, writeFileSync as writeFileSync2 } from "node:fs";
import { isAbsolute as isAbsolute3, relative, resolve as resolve2 } from "node:path";

// src/host/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
var STANDARD_SETUP = "auto";
var STANDARD_COMMAND = "graphify";
var STANDARD_OUT_DIR = "graphify-out";
var KONFIG_DATEINAME = "graphify.json";
var KONFIG_ORDNER = "world";
var GRAPH_DATEINAME = "graph.json";
function standardConfig() {
  return {
    command: STANDARD_COMMAND,
    outDir: STANDARD_OUT_DIR,
    root: process.cwd(),
    setup: STANDARD_SETUP
  };
}
function dshHome(env = process.env) {
  const ausUmgebung = env["DSH_HOME"];
  if (ausUmgebung !== undefined && ausUmgebung.trim() !== "")
    return resolve(ausUmgebung);
  return join(homedir(), ".dsh");
}
function konfigDatei(env = process.env) {
  return join(dshHome(env), KONFIG_ORDNER, KONFIG_DATEINAME);
}
function argsFuer(mode) {
  const args = [".", "--code-only"];
  if (mode === "deep")
    args.push("--mode", "deep");
  else if (mode === "update")
    args.push("--update");
  return args;
}
function graphDatei(config) {
  return isAbsolute(config.outDir) ? join(config.outDir, GRAPH_DATEINAME) : resolve(config.root, config.outDir, GRAPH_DATEINAME);
}
function pruefeBefehl(wert) {
  if (typeof wert !== "string")
    return { ok: false, error: '„command" muss eine Zeichenkette sein.' };
  const befehl = wert.trim();
  if (befehl === "")
    return { ok: false, error: '„command" darf nicht leer sein.' };
  if (/[\u0000\r\n]/u.test(befehl))
    return { ok: false, error: '„command" enthält ein unerlaubtes Zeichen.' };
  return { ok: true, wert: befehl };
}
function pruefeSetup(wert) {
  if (wert === "auto" || wert === "ask" || wert === "never")
    return { ok: true, wert };
  return { ok: false, error: '„setup" muss „auto", „ask" oder „never" sein.' };
}
function pruefePfad(wert, name) {
  if (typeof wert !== "string")
    return { ok: false, error: `„${name}" muss eine Zeichenkette sein.` };
  const pfad = wert.trim();
  if (pfad === "")
    return { ok: false, error: `„${name}" darf nicht leer sein.` };
  if (pfad.includes("\x00"))
    return { ok: false, error: `„${name}" enthält ein Nullzeichen.` };
  if (pfad.split(/[\\/]+/u).includes("..")) {
    return { ok: false, error: `„${name}" darf kein „.." enthalten.` };
  }
  return { ok: true, wert: pfad };
}
function validiereAenderung(roh, basis) {
  if (roh === null || typeof roh !== "object" || Array.isArray(roh)) {
    return { ok: false, error: "Der Körper muss ein JSON-Objekt sein." };
  }
  const daten = roh;
  let command = basis.command;
  let outDir = basis.outDir;
  let root = basis.root;
  let setup = basis.setup;
  if ("command" in daten) {
    const geprueft = pruefeBefehl(daten["command"]);
    if (!geprueft.ok)
      return geprueft;
    command = geprueft.wert;
  }
  if ("outDir" in daten) {
    const geprueft = pruefePfad(daten["outDir"], "outDir");
    if (!geprueft.ok)
      return geprueft;
    outDir = geprueft.wert;
  }
  if ("root" in daten) {
    const geprueft = pruefePfad(daten["root"], "root");
    if (!geprueft.ok)
      return geprueft;
    root = geprueft.wert;
  }
  if ("setup" in daten) {
    const geprueft = pruefeSetup(daten["setup"]);
    if (!geprueft.ok)
      return geprueft;
    setup = geprueft.wert;
  }
  return { ok: true, wert: { command, outDir, root, setup } };
}
function leseConfig(env = process.env) {
  const standard = standardConfig();
  const datei = konfigDatei(env);
  if (!existsSync(datei))
    return standard;
  let roh;
  try {
    roh = JSON.parse(readFileSync(datei, "utf8"));
  } catch {
    return standard;
  }
  const geprueft = validiereAenderung(roh, standard);
  return geprueft.ok ? geprueft.wert : standard;
}
function speichereConfig(roh, env = process.env) {
  const geprueft = validiereAenderung(roh, leseConfig(env));
  if (!geprueft.ok)
    return geprueft;
  const datei = konfigDatei(env);
  try {
    mkdirSync(dirname(datei), { recursive: true });
    writeFileSync(datei, `${JSON.stringify(geprueft.wert, null, 2)}
`, "utf8");
  } catch (problem) {
    return { ok: false, error: `Die Konfiguration konnte nicht geschrieben werden: ${fehlerText(problem)}` };
  }
  return geprueft;
}
function fehlerText(problem) {
  if (problem instanceof Error)
    return problem.message;
  if (typeof problem === "string")
    return problem;
  return String(problem);
}

// src/host/http.ts
var JSON_KOPF = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
function json(res, status, wert) {
  const koerper = Buffer.from(JSON.stringify(wert), "utf8");
  res.statusCode = status;
  for (const [name, wertDesKopfs] of Object.entries(JSON_KOPF))
    res.setHeader(name, wertDesKopfs);
  res.setHeader("Content-Length", String(koerper.byteLength));
  res.end(koerper);
}
var MAX_JSON_BYTES = 64 * 1024;
async function readJson(req, maxBytes = MAX_JSON_BYTES) {
  const angekuendigt = req.headers["content-length"];
  if (typeof angekuendigt === "string") {
    const laenge = Number.parseInt(angekuendigt, 10);
    if (Number.isFinite(laenge) && laenge > maxBytes) {
      return { ok: false, status: 413, error: `Der Körper ist größer als ${maxBytes} Bytes.` };
    }
  }
  const teile = [];
  let gesamt = 0;
  const strom = req;
  try {
    for await (const stueck of strom) {
      if (typeof stueck === "string") {
        const puffer = Buffer.from(stueck, "utf8");
        gesamt += puffer.byteLength;
        if (gesamt > maxBytes)
          return { ok: false, status: 413, error: `Der Körper ist größer als ${maxBytes} Bytes.` };
        teile.push(puffer);
        continue;
      }
      if (stueck instanceof Uint8Array) {
        gesamt += stueck.byteLength;
        if (gesamt > maxBytes)
          return { ok: false, status: 413, error: `Der Körper ist größer als ${maxBytes} Bytes.` };
        teile.push(Buffer.from(stueck));
        continue;
      }
      return { ok: false, status: 400, error: "Der Körper enthält einen unbekannten Datentyp." };
    }
  } catch {
    return { ok: false, status: 400, error: "Der Körper konnte nicht gelesen werden." };
  }
  const text = Buffer.concat(teile).toString("utf8").trim();
  if (text === "")
    return { ok: true, wert: {} };
  try {
    return { ok: true, wert: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Der Körper ist kein gültiges JSON." };
  }
}
function normalisiereAdresse(adresse) {
  const klein = adresse.trim().toLowerCase();
  return klein.startsWith("::ffff:") ? klein.slice("::ffff:".length) : klein;
}
function istLokal(req) {
  const adresse = req.socket.remoteAddress;
  if (adresse === undefined)
    return false;
  const normal = normalisiereAdresse(adresse);
  return normal === "::1" || normal === "127.0.0.1" || normal.startsWith("127.");
}

// src/host/world-graph.ts
function emptyWorldGraph(generatedAt = new Date().toISOString()) {
  return { nodes: [], edges: [], sources: [], generatedAt };
}
function edgeKindFromRelation(relation) {
  switch (relation) {
    case "link":
    case "links_to":
    case "references":
      return "link";
    case "contains":
      return "contains";
    case "calls":
      return "calls";
    case "imports":
    case "imports_from":
      return "imports";
    case "inherits":
      return "inherits";
    case "uses":
      return "uses";
    default:
      return "relation";
  }
}
function confidenceFrom(confidence) {
  return confidence === "EXTRACTED" || confidence === "INFERRED" || confidence === "AMBIGUOUS" ? confidence : "AMBIGUOUS";
}

// src/host/mapping.ts
var PRAEFIX = "graphify:";
var DATEI_ENDUNGEN = [".py", ".ts", ".js", ".go", ".rs", ".java", ".md", ".json"];
function istObjekt(wert) {
  return wert !== null && typeof wert === "object" && !Array.isArray(wert);
}
function text(wert) {
  return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}
function istDateiKnoten(id, label, dateiTyp, ort) {
  if (dateiTyp !== "code")
    return false;
  const klein = label.toLowerCase();
  if (DATEI_ENDUNGEN.some((endung) => klein.endsWith(endung)))
    return true;
  return ort === "L1" && !id.includes("_");
}
function knotenAus(wert) {
  if (!istObjekt(wert))
    return;
  const id = text(wert["id"]);
  if (id === undefined)
    return;
  const label = text(wert["label"]) ?? id;
  const pfad = text(wert["source_file"]);
  const roheGemeinde = wert["community"];
  const community = typeof roheGemeinde === "number" && Number.isFinite(roheGemeinde) ? roheGemeinde : undefined;
  const kind = istDateiKnoten(id, label, wert["file_type"], wert["source_location"]) ? "file" : "symbol";
  return {
    id: `${PRAEFIX}${id}`,
    label,
    kind,
    source: "graphify",
    ...pfad !== undefined ? { path: pfad } : {},
    ...community !== undefined ? { community } : {}
  };
}
function kanteAus(wert) {
  if (!istObjekt(wert))
    return;
  const quelle = text(wert["source"]);
  const ziel = text(wert["target"]);
  if (quelle === undefined || ziel === undefined)
    return;
  const relation = text(wert["relation"]);
  return {
    from: `${PRAEFIX}${quelle}`,
    to: `${PRAEFIX}${ziel}`,
    kind: edgeKindFromRelation(relation ?? ""),
    confidence: confidenceFrom(wert["confidence"]),
    ...relation !== undefined ? { relation } : {}
  };
}
function leererGraph(datei, error, generatedAt = new Date().toISOString()) {
  const status = {
    id: "graphify",
    label: "Graphify",
    available: false,
    nodes: 0,
    edges: 0,
    detail: `Datei: ${datei}`,
    error
  };
  return { ...emptyWorldGraph(generatedAt), sources: [status] };
}
function worldGraphAus(roh, datei, generatedAt = new Date().toISOString()) {
  if (!istObjekt(roh))
    return leererGraph(datei, "Die Graphify-Ausgabe ist kein JSON-Objekt.", generatedAt);
  const knotenRoh = roh["nodes"];
  const kantenRoh = roh["links"];
  if (!Array.isArray(knotenRoh)) {
    return leererGraph(datei, 'Der Graphify-Ausgabe fehlt die Liste „nodes".', generatedAt);
  }
  if (!Array.isArray(kantenRoh)) {
    return leererGraph(datei, 'Der Graphify-Ausgabe fehlt die Liste „links".', generatedAt);
  }
  const nodes = [];
  for (const eintrag of knotenRoh) {
    const knoten = knotenAus(eintrag);
    if (knoten !== undefined)
      nodes.push(knoten);
  }
  const edges = [];
  for (const eintrag of kantenRoh) {
    const kante = kanteAus(eintrag);
    if (kante !== undefined)
      edges.push(kante);
  }
  const status = {
    id: "graphify",
    label: "Graphify",
    available: true,
    nodes: nodes.length,
    edges: edges.length,
    detail: `${datei} · gelesen ${generatedAt} · ${nodes.length} Knoten, ${edges.length} Kanten`
  };
  return { nodes, edges, sources: [status], generatedAt };
}

// src/host/setup.ts
import { existsSync as existsSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { basename, isAbsolute as isAbsolute2, join as join2 } from "node:path";
var PAKET = "graphifyy";
var INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
var MAX_AUSGABE = 8 * 1024;
function findeBefehl(befehl) {
  const wert = befehl.trim();
  if (wert === "")
    return null;
  if (isAbsolute2(wert))
    return existsSync2(wert) ? wert : null;
  try {
    return Bun.which(wert);
  } catch {
    return null;
  }
}
function kandidaten(platform = process.platform, home = homedir2(), appData = process.env["APPDATA"]) {
  if (platform === "win32") {
    const liste = [];
    if (appData !== undefined && appData.trim() !== "") {
      liste.push(join2(appData, "uv", "tools", "graphifyy", "Scripts", "graphify.exe"));
    }
    liste.push(join2(home, ".local", "bin", "graphify.exe"));
    return liste;
  }
  return [
    join2(home, ".local", "bin", "graphify"),
    join2(home, ".local", "share", "uv", "tools", "graphifyy", "bin", "graphify")
  ];
}
function findeGraphify(command) {
  const direkt = findeBefehl(command);
  if (direkt !== null)
    return direkt;
  for (const kandidat of kandidaten()) {
    if (existsSync2(kandidat))
      return kandidat;
  }
  return null;
}
function waehleMethode(hatUv, hatPipx, hatPython) {
  if (hatUv)
    return "uv";
  if (hatPipx)
    return "pipx";
  if (hatPython)
    return "pip";
  return "none";
}
function installBefehl(method, python) {
  if (method === "uv")
    return ["uv", "tool", "install", PAKET];
  if (method === "pipx")
    return ["pipx", "install", PAKET];
  if (method === "pip") {
    if (python === null)
      return null;
    const starter = /^py(?:\.exe)?$/iu.test(basename(python));
    return [python, ...starter ? ["-3"] : [], "-m", "pip", "install", "--user", PAKET];
  }
  return null;
}
function hinweise(platform) {
  if (platform === "win32") {
    return [
      "Kein uv, pipx oder Python gefunden.",
      "uv installieren: winget install --id=astral-sh.uv -e",
      'Danach im Panel erneut auf „Prüfen" gehen.'
    ];
  }
  return [
    "Kein uv, pipx oder Python gefunden.",
    "uv installieren: curl -LsSf https://astral.sh/uv/install.sh | sh",
    'Danach im Panel erneut auf „Prüfen" gehen.'
  ];
}
var letztes = null;
var laufend = null;
var versucht = false;
function setupStatus(config = leseConfig()) {
  const cli = findeGraphify(config.command);
  const uv = findeBefehl("uv");
  const pipx = findeBefehl("pipx");
  const python = findeBefehl("python3") ?? findeBefehl("python") ?? findeBefehl("py");
  const method = waehleMethode(uv !== null, pipx !== null, python !== null);
  return {
    platform: process.platform,
    command: config.command,
    cli,
    uv,
    pipx,
    python,
    method,
    installable: method !== "none",
    modus: config.setup,
    installiert: letztes,
    hinweise: method === "none" && cli === null ? hinweise(process.platform) : []
  };
}
async function leseStrom(strom, grenze) {
  const leser = strom.getReader();
  const teile = [];
  let gesamt = 0;
  try {
    for (;; ) {
      const { done, value } = await leser.read();
      if (done)
        break;
      if (value === undefined)
        continue;
      const rest = grenze - gesamt;
      if (rest <= 0)
        continue;
      const stueck = value.byteLength > rest ? value.subarray(0, rest) : value;
      teile.push(Buffer.from(stueck));
      gesamt += stueck.byteLength;
    }
  } finally {
    leser.releaseLock();
  }
  return Buffer.concat(teile).toString("utf8");
}
async function installiere(method) {
  const config = leseConfig();
  const status = setupStatus(config);
  const wahl = method ?? status.method;
  const at = new Date().toISOString();
  const args = installBefehl(wahl, status.python);
  if (args === null) {
    const ergebnis2 = {
      ok: false,
      method: wahl,
      command: "",
      output: "",
      error: wahl === "none" ? "Kein uv, pipx oder Python gefunden — bitte zuerst uv installieren." : `Der Weg „${wahl}" braucht einen Pfad, der nicht gefunden wurde.`,
      at,
      pfad: null
    };
    letztes = ergebnis2;
    return ergebnis2;
  }
  const befehl = args.join(" ");
  const controller = new AbortController;
  const uhr = setTimeout(() => controller.abort(), INSTALL_TIMEOUT_MS);
  let ausgabe = "";
  let exitCode = null;
  let fehler;
  try {
    const prozess = Bun.spawn([...args], {
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal
    });
    const [aus, err] = await Promise.all([
      leseStrom(prozess.stdout, MAX_AUSGABE),
      leseStrom(prozess.stderr, MAX_AUSGABE)
    ]);
    exitCode = await prozess.exited;
    ausgabe = [aus, err].filter((teil) => teil.trim() !== "").join(`
`).slice(0, MAX_AUSGABE);
  } catch (problem) {
    fehler = `Die Installation konnte nicht gestartet werden: ${fehlerText(problem)}`;
  } finally {
    clearTimeout(uhr);
  }
  if (controller.signal.aborted)
    fehler = `Zeitüberschreitung nach ${INSTALL_TIMEOUT_MS / 60000} Minuten.`;
  if (fehlerFrei(exitCode, fehler)) {
    const pfad = findeGraphify("graphify") ?? findeGraphify(leseConfig().command);
    if (pfad !== null)
      speichereConfig({ command: pfad });
    const ergebnis2 = {
      ok: true,
      method: wahl,
      command: befehl,
      output: ausgabe,
      at,
      pfad
    };
    letztes = ergebnis2;
    return ergebnis2;
  }
  const ergebnis = {
    ok: false,
    method: wahl,
    command: befehl,
    output: ausgabe,
    error: fehler ?? `Die Installation endete mit Code ${String(exitCode ?? "?")}. Die Ausgabe oben nennt den Grund.`,
    at,
    pfad: null
  };
  letztes = ergebnis;
  return ergebnis;
}
function fehlerFrei(exitCode, fehler) {
  return fehler === undefined && exitCode === 0;
}
function starteInstallation(method) {
  if (laufend !== null)
    return laufend;
  const lauf = installiere(method);
  laufend = lauf;
  lauf.finally(() => {
    if (laufend === lauf)
      laufend = null;
  });
  return lauf;
}
async function autoInstalliere() {
  if (versucht)
    return null;
  versucht = true;
  const config = leseConfig();
  if (config.setup !== "auto")
    return null;
  if (findeGraphify(config.command) !== null)
    return null;
  const status = setupStatus(config);
  if (status.method === "none")
    return null;
  return starteInstallation(status.method);
}

// src/host/index.ts
var name = "dsh-plugin-graphify";
var inject = ["webServer"];
var BASIS = "/api/world/graphify";
var PFAD_STATUS = `${BASIS}/status`;
var PFAD_GRAPH = `${BASIS}/graph`;
var PFAD_RUN = `${BASIS}/run`;
var PFAD_CONFIG = `${BASIS}/config`;
var PFAD_FILE = `${BASIS}/file`;
var PFAD_SETUP = `${BASIS}/setup`;
var TIMEOUT_MS = 10 * 60 * 1000;
var MAX_AUSGABE2 = 16 * 1024;
function nurLokal(req, res) {
  if (istLokal(req))
    return true;
  json(res, 403, { error: "Diese Route ist nur von diesem Rechner erreichbar." });
  return false;
}
function methodeNichtErlaubt(res, erlaubt) {
  res.setHeader("Allow", erlaubt.join(", "));
  json(res, 405, { error: `Erlaubt: ${erlaubt.join(", ")}.` });
}
function ladeGraph(graphFile, generatedAt) {
  try {
    const roh = JSON.parse(readFileSync2(graphFile, "utf8"));
    return worldGraphAus(roh, graphFile, generatedAt);
  } catch (problem) {
    return leererGraph(graphFile, `Die Datei konnte nicht gelesen werden: ${fehlerText(problem)}`, generatedAt);
  }
}
function graphifyStatus(config = leseConfig()) {
  const graphFile = graphDatei(config);
  const graph = ladeGraph(graphFile);
  const quelle = graph.sources[0];
  const lesbar = quelle?.available === true;
  const cli = findeGraphify(config.command);
  const available = cli !== null || lesbar;
  const teile = [
    cli === null ? `CLI „${config.command}" nicht gefunden` : `CLI: ${cli}`,
    lesbar ? `Graph: ${graphFile}` : `kein lesbarer Graph unter ${graphFile}`
  ];
  if (!available)
    teile.push("Graphify ist weder installiert noch liegt ein Graph vor.");
  const error = lesbar ? undefined : quelle?.error ?? `Kein Graph unter ${graphFile}.`;
  return {
    id: "graphify",
    label: "Graphify",
    available,
    command: config.command,
    outDir: config.outDir,
    graphFile,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    detail: teile.join(" · "),
    ...error !== undefined ? { error } : {}
  };
}
function macheStatusHandler() {
  return (req, res) => {
    if (!nurLokal(req, res))
      return;
    if ((req.method ?? "GET") !== "GET") {
      methodeNichtErlaubt(res, ["GET"]);
      return;
    }
    json(res, 200, graphifyStatus());
  };
}
function macheGraphHandler() {
  return (req, res) => {
    if (!nurLokal(req, res))
      return;
    if ((req.method ?? "GET") !== "GET") {
      methodeNichtErlaubt(res, ["GET"]);
      return;
    }
    const config = leseConfig();
    json(res, 200, ladeGraph(graphDatei(config)));
  };
}
function macheConfigHandler() {
  return async (req, res) => {
    if (!nurLokal(req, res))
      return;
    const methode = req.method ?? "GET";
    if (methode === "GET") {
      json(res, 200, configAntwort(leseConfig()));
      return;
    }
    if (methode !== "POST") {
      methodeNichtErlaubt(res, ["GET", "POST"]);
      return;
    }
    const gelesen = await readJson(req);
    if (!gelesen.ok) {
      json(res, gelesen.status, { error: gelesen.error });
      return;
    }
    const gespeichert = speichereConfig(gelesen.wert);
    if (!gespeichert.ok) {
      json(res, 400, { error: gespeichert.error });
      return;
    }
    json(res, 200, configAntwort(gespeichert.wert));
  };
}
function configAntwort(config) {
  return {
    command: config.command,
    outDir: config.outDir,
    root: config.root,
    setup: config.setup
  };
}
function modusAus(roh) {
  if (roh === null || typeof roh !== "object" || Array.isArray(roh)) {
    return { ok: false, error: "Der Körper muss ein JSON-Objekt sein." };
  }
  const daten = roh;
  if (!("mode" in daten))
    return { ok: true, mode: undefined };
  const mode = daten["mode"];
  if (mode === "deep" || mode === "update")
    return { ok: true, mode };
  return { ok: false, error: '„mode" muss „deep" oder „update" sein.' };
}
function macheRunHandler() {
  return async (req, res) => {
    if (!nurLokal(req, res))
      return;
    if ((req.method ?? "GET") !== "POST") {
      methodeNichtErlaubt(res, ["POST"]);
      return;
    }
    const gelesen = await readJson(req);
    if (!gelesen.ok) {
      json(res, gelesen.status, { error: gelesen.error });
      return;
    }
    const modus = modusAus(gelesen.wert);
    if (!modus.ok) {
      json(res, 400, { error: modus.error });
      return;
    }
    json(res, 200, await fuehreAus(leseConfig(), modus.mode));
  };
}
async function fuehreAus(config, mode) {
  const args = argsFuer(mode);
  const befehl = [config.command, ...args];
  const controller = new AbortController;
  const uhr = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let exitCode = null;
  let ausgabe = "";
  let fehler;
  try {
    const prozess = Bun.spawn(befehl, {
      cwd: config.root,
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal
    });
    const [aus, err] = await Promise.all([
      leseStrom2(prozess.stdout, MAX_AUSGABE2),
      leseStrom2(prozess.stderr, MAX_AUSGABE2)
    ]);
    exitCode = await prozess.exited;
    ausgabe = begrenze([aus, err].filter((teil) => teil !== "").join(`
`), MAX_AUSGABE2);
  } catch (problem) {
    fehler = `Graphify konnte nicht gestartet werden: ${fehlerText(problem)}`;
  } finally {
    clearTimeout(uhr);
  }
  if (controller.signal.aborted)
    fehler = `Zeitüberschreitung nach ${TIMEOUT_MS / 60000} Minuten.`;
  return {
    ok: fehler === undefined && exitCode === 0,
    exitCode,
    mode: mode ?? "default",
    command: befehl.join(" "),
    output: ausgabe,
    ...fehler !== undefined ? { error: fehler } : {}
  };
}
async function leseStrom2(strom, grenze) {
  const leser = strom.getReader();
  const teile = [];
  let gesamt = 0;
  let gekuerzt = false;
  try {
    for (;; ) {
      const { done, value } = await leser.read();
      if (done)
        break;
      if (value === undefined)
        continue;
      const rest = grenze - gesamt;
      if (rest <= 0) {
        gekuerzt = true;
        continue;
      }
      const stueck = value.byteLength > rest ? value.subarray(0, rest) : value;
      teile.push(Buffer.from(stueck));
      gesamt += stueck.byteLength;
      if (value.byteLength > rest)
        gekuerzt = true;
    }
  } finally {
    leser.releaseLock();
  }
  const text2 = Buffer.concat(teile).toString("utf8");
  return gekuerzt ? `${text2}
… (gekürzt auf ${grenze} Bytes)` : text2;
}
function begrenze(text2, grenze) {
  const roh = Buffer.from(text2, "utf8");
  if (roh.byteLength <= grenze)
    return text2;
  const hinweis = `
… (gekürzt)
`;
  const hinweisBytes = Buffer.byteLength(hinweis, "utf8");
  if (grenze <= hinweisBytes + 3)
    return roh.subarray(0, grenze).toString("utf8");
  const platz = grenze - hinweisBytes - 3;
  return `${roh.subarray(0, platz).toString("utf8")}${hinweis}`;
}
var SPRACHEN = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".sh": "bash",
  ".ps1": "powershell"
};
function dateiZiel(rel) {
  if (rel.length === 0 || rel.includes("\x00") || isAbsolute3(rel)) {
    return { ok: false, status: 400, error: "Der Pfad muss relativ zur Wurzel sein." };
  }
  const wurzel = resolve2(leseConfig().root);
  const ziel = resolve2(wurzel, rel);
  const zurueck = relative(wurzel, ziel);
  if (zurueck.startsWith("..") || isAbsolute3(zurueck)) {
    return { ok: false, status: 403, error: "Der Pfad liegt außerhalb der Wurzel." };
  }
  const endung = ziel.toLowerCase().slice(ziel.lastIndexOf("."));
  const sprache = SPRACHEN[endung];
  if (sprache === undefined) {
    return { ok: false, status: 415, error: `Für ${endung || "diese Datei"} gibt es keinen Viewer.` };
  }
  try {
    const echteWurzel = realpathSync(wurzel);
    const echtesZiel = realpathSync(ziel);
    const echtRel = relative(echteWurzel, echtesZiel);
    if (echtRel.startsWith("..") || isAbsolute3(echtRel)) {
      return { ok: false, status: 403, error: "Der Pfad liegt außerhalb der Wurzel." };
    }
  } catch (fehler) {
    return { ok: false, status: 404, error: fehlerText(fehler) };
  }
  return { ok: true, ziel, rel: zurueck.replaceAll("\\", "/"), sprache };
}
function macheFileHandler() {
  return (req, res) => {
    if (!nurLokal(req, res))
      return;
    const methode = req.method ?? "GET";
    if (methode === "POST") {
      dateiWrite(req, res);
      return;
    }
    if (methode !== "GET") {
      methodeNichtErlaubt(res, ["GET", "POST"]);
      return;
    }
    const url = new URL(req.url ?? "", "http://localhost");
    const rel = url.searchParams.get("path");
    if (rel === null || rel.length === 0) {
      json(res, 400, { error: "Erwartet wird ?path=<relativer Pfad>." });
      return;
    }
    const ziel = dateiZiel(rel);
    if (!ziel.ok) {
      json(res, ziel.status, { error: ziel.error });
      return;
    }
    try {
      const inhalt = readFileSync2(ziel.ziel, "utf8");
      json(res, 200, {
        path: ziel.rel,
        content: inhalt.slice(0, 400000),
        language: ziel.sprache,
        lines: inhalt.split(`
`).length
      });
    } catch (fehler) {
      json(res, 404, { error: fehlerText(fehler) });
    }
  };
}
async function dateiWrite(req, res) {
  const gelesen = await readJson(req);
  if (!gelesen.ok) {
    json(res, gelesen.status, { error: gelesen.error });
    return;
  }
  const daten = typeof gelesen.wert === "object" && gelesen.wert !== null ? gelesen.wert : {};
  const pfad = daten["path"];
  const inhalt = daten["content"];
  if (typeof pfad !== "string" || typeof inhalt !== "string") {
    json(res, 400, { error: 'Erwartet wird { "path": "…", "content": "…" }.' });
    return;
  }
  if (inhalt.length > 400000) {
    json(res, 413, { error: "Eine Datei darf höchstens 400 000 Zeichen haben." });
    return;
  }
  const ziel = dateiZiel(pfad);
  if (!ziel.ok) {
    json(res, ziel.status, { error: ziel.error });
    return;
  }
  try {
    writeFileSync2(ziel.ziel, inhalt, "utf8");
    json(res, 200, {
      ok: true,
      path: ziel.rel,
      language: ziel.sprache,
      lines: inhalt.split(`
`).length,
      bytes: Buffer.byteLength(inhalt, "utf8")
    });
  } catch (fehler) {
    json(res, 500, { error: fehlerText(fehler) });
  }
}
function methodeAus(roh) {
  if (roh === null || typeof roh !== "object" || Array.isArray(roh)) {
    return { ok: false, error: "Der Körper muss ein JSON-Objekt sein." };
  }
  const daten = roh;
  if (!("method" in daten))
    return { ok: true, method: undefined };
  const methode = daten["method"];
  if (methode === "uv" || methode === "pipx" || methode === "pip")
    return { ok: true, method: methode };
  return { ok: false, error: '„method" muss „uv", „pipx" oder „pip" sein.' };
}
function macheSetupHandler() {
  return async (req, res) => {
    if (!nurLokal(req, res))
      return;
    const methode = req.method ?? "GET";
    if (methode === "GET") {
      json(res, 200, setupStatus());
      return;
    }
    if (methode !== "POST") {
      methodeNichtErlaubt(res, ["GET", "POST"]);
      return;
    }
    const gelesen = await readJson(req);
    if (!gelesen.ok) {
      json(res, gelesen.status, { error: gelesen.error });
      return;
    }
    const wahl = methodeAus(gelesen.wert);
    if (!wahl.ok) {
      json(res, 400, { error: wahl.error });
      return;
    }
    const ergebnis = await starteInstallation(wahl.method);
    json(res, 200, { ...setupStatus(), installiert: ergebnis });
  };
}
function apply(ctx) {
  ctx.effect(() => {
    const wege = [
      { kind: "exact", path: PFAD_STATUS, handler: macheStatusHandler() },
      { kind: "exact", path: PFAD_GRAPH, handler: macheGraphHandler() },
      { kind: "exact", path: PFAD_RUN, handler: macheRunHandler() },
      { kind: "exact", path: PFAD_CONFIG, handler: macheConfigHandler() },
      { kind: "exact", path: PFAD_FILE, handler: macheFileHandler() },
      { kind: "exact", path: PFAD_SETUP, handler: macheSetupHandler() }
    ];
    const ab = wege.map((weg) => ctx.webServer.register(weg));
    return () => {
      for (const einer of ab.reverse())
        einer();
    };
  }, `${name} ${BASIS}`);
  ctx.effect(() => {
    autoInstalliere().then((ergebnis) => {
      if (ergebnis === null)
        return;
      if (ergebnis.ok) {
        console.log(`graphify: CLI installiert (${ergebnis.method})${ergebnis.pfad === null ? "" : `: ${ergebnis.pfad}`}`);
      } else {
        console.warn(`graphify: Installation über ${ergebnis.method} fehlgeschlagen — ${ergebnis.error ?? "ohne Meldung"}`);
      }
    }).catch((problem) => {
      console.warn(`graphify: Selbstinstallation nicht möglich — ${fehlerText(problem)}`);
    });
    return () => {
      return;
    };
  }, `${name} Selbstinstallation`);
}
var host_default = apply;

// src/host/entry.ts
var Config = z.object({
  surface: z.union([z.const("sidebar"), z.const("plugins"), z.const("both"), z.const("none")]).default("sidebar").description("sidebar · plugins · both · none"),
  order: z.natural().max(999).default(12).description("Platz in der Liste, kleinere Zahl zuerst"),
  label: z.string().default("").description("leer = Beschriftung aus dem Sprachpaket"),
  view: z.union([z.const("split"), z.const("graph"), z.const("list")]).default("split").description("split · graph · list — welche Flächen aufgehen"),
  level: z.union([z.const("gesamt"), z.const("gruppe"), z.const("nachbarschaft")]).default("gesamt").description("gesamt · gruppe · nachbarschaft — die Ebene beim Öffnen"),
  depth: z.natural().min(1).max(3).default(2).description("Nachbarschaft um den Knoten: 1 bis 3"),
  limit: z.natural().min(20).max(400).default(160).description("Höchstzahl gezeichneter Knoten: 20 bis 400"),
  labels: z.boolean().default(true).description("Namen an den Knoten zeichnen"),
  colour: z.union([z.const("community"), z.const("kind")]).default("community").description("community · kind — Farbe nach Gruppe oder nach Art"),
  motion: z.boolean().default(true).description("Layout beim Öffnen und Ziehen weiterrechnen"),
  inspector: z.union([z.const("right"), z.const("below"), z.const("off")]).default("right").description("right · below · off — wohin die Knotendaten kommen")
});
export {
  Config,
  apply,
  host_default as default,
  inject,
  name
};
