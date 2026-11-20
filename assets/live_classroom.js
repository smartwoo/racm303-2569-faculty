/* ==========================================================================
   RACM 303 (2569) — Live Case Discussion Classroom Engine (Rooms 1–6)
   Kahoot / Mentimeter Style Real-Time Student Responses & Shared Countdown Timer
   Transports: MQTT over WSS (443/8084) + PeerJS WebRTC + BroadcastChannel
   Strict Confidentiality: Transmits ONLY room/timer/question IDs & student inputs
   ========================================================================== */
(function () {
  "use strict";

  const TOPIC_NS = "racm303/2569/hsd/v2";
  const BC_NAME = "racm303_hsd_live_v2";
  const BROKERS = [
    "wss://mqtt.eclipseprojects.io:443/mqtt",
    "wss://broker.emqx.io:8084/mqtt"
  ];

  const ROOM_DEFS = [
    { id: 1, name: "ห้องกลุ่ม 1", roomCode: "1C1-02", label: "กลุ่ม 1 · 1C1-02" },
    { id: 2, name: "ห้องกลุ่ม 2", roomCode: "1C1-03", label: "กลุ่ม 2 · 1C1-03" },
    { id: 3, name: "ห้องกลุ่ม 3", roomCode: "1C1-04", label: "กลุ่ม 3 · 1C1-04" },
    { id: 4, name: "ห้องกลุ่ม 4", roomCode: "1C1-05", label: "กลุ่ม 4 · 1C1-05" },
    { id: 5, name: "ห้องกลุ่ม 5", roomCode: "1C1-06", label: "กลุ่ม 5 · 1C1-06" },
    { id: 6, name: "ห้องกลุ่ม 6", roomCode: "1C1-07", label: "กลุ่ม 6 · 1C1-07" }
  ];

  function randomId(prefix) {
    return (
      (prefix || "m") +
      "_" +
      Math.random().toString(36).slice(2, 9) +
      Date.now().toString(36).slice(-4)
    );
  }

  function safeGetStorage(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
  }

  function clampRoom(n) {
    const num = Number(n);
    return num >= 1 && num <= 6 ? Math.floor(num) : 1;
  }

  const clientInstanceId = randomId("cli");
  const persistentPid = (function () {
    let pid = safeGetStorage("racm303_live_pid_v1", "");
    if (!pid) {
      pid = randomId("stu");
      safeSetStorage("racm303_live_pid_v1", pid);
    }
    return pid;
  })();

  const seenMsgIds = new Set();
  function rememberMsgId(id) {
    if (!id) return false;
    if (seenMsgIds.has(id)) return true;
    seenMsgIds.add(id);
    if (seenMsgIds.size > 1200) {
      const first = seenMsgIds.values().next().value;
      seenMsgIds.delete(first);
    }
    return false;
  }

  const state = {
    role: window.PORTAL_ROLE === "faculty" ? "faculty" : "student",
    roomId: clampRoom(safeGetStorage("racm303_live_room_v1", "1")),
    participantId: persistentPid,
    studentId: "",
    displayName: safeGetStorage("racm303_live_name_v1", ""),
    nickname: "",
    area: "",
    followTeacher: safeGetStorage("racm303_live_follow_v1", "1") !== "0",
    anonymousWall: safeGetStorage("racm303_live_anon_v1", "0") === "1",
    soundMuted: safeGetStorage("racm303_live_mute_v1", "0") === "1",
    connectedTransports: new Set(),
    mqttClients: [],
    peer: null,
    peerConns: new Map(),
    hostConn: null,
    bc: null,

    // Shared Timer State (drift-free via performance.now())
    timer: {
      seq: 0,
      running: false,
      durationSec: 300,
      baseRemainingMs: 300000,
      anchorPerfNow: performance.now(),
      questionId: "",
      label: "จับเวลาอภิปรายกลุ่มย่อย",
      chimePlayedForSeq: -1
    },

    // Teacher Active Question / Slide Pointer
    teacherPointer: {
      seq: 0,
      module: "",
      caseId: "",
      questionId: "",
      sentWallMs: 0
    },

    // Responses: Map<questionId, Map<participantId, ResponseRecord>>
    responsesByQuestion: new Map(),
    clearedAtByQuestion: new Map(),

    // Presence: Map<participantId, { role, name, lastSeenMs }>
    presence: new Map()
  };

  const listeners = {
    timer: new Set(),
    responses: new Set(),
    presence: new Set(),
    pointer: new Set(),
    connection: new Set()
  };

  function emit(kind, payload) {
    const set = listeners[kind];
    if (!set) return;
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch (_) {}
    });
  }

  function on(kind, fn) {
    if (!listeners[kind]) return function () {};
    listeners[kind].add(fn);
    return function () {
      listeners[kind].delete(fn);
    };
  }

  function roomTopic(subpath) {
    return `${TOPIC_NS}/room-${state.roomId}/${subpath}`;
  }

  function playTimerChime() {
    if (state.soundMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [659.25, 880, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.14;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
      setTimeout(() => {
        if (ctx && typeof ctx.close === "function") ctx.close().catch(() => {});
      }, 1500);
    } catch (_) {}
  }

  function getTimerRemainingMs() {
    const t = state.timer;
    if (!t.running) return Math.max(0, Math.round(t.baseRemainingMs));
    const elapsed = Math.max(0, performance.now() - t.anchorPerfNow);
    return Math.max(0, Math.round(t.baseRemainingMs - elapsed));
  }

  function formatMs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function getTimerSnapshot() {
    const remMs = getTimerRemainingMs();
    const durMs = Math.max(1000, (state.timer.durationSec || 300) * 1000);
    return {
      running: state.timer.running && remMs > 0,
      remainingMs: remMs,
      durationSec: state.timer.durationSec || 300,
      pct: Math.max(0, Math.min(100, (remMs / durMs) * 100)),
      formatted: formatMs(remMs),
      isWarning: remMs > 0 && remMs <= 60000,
      isUrgent: remMs > 0 && remMs <= 15000,
      isTimeUp: state.timer.seq > 0 && remMs === 0,
      label: state.timer.label || "",
      questionId: state.timer.questionId || ""
    };
  }

  // Tick loop every 250ms so countdown updates smoothly across Student & Teacher
  setInterval(() => {
    if (state.timer.running) {
      const rem = getTimerRemainingMs();
      if (rem <= 0) {
        state.timer.running = false;
        state.timer.baseRemainingMs = 0;
        if (state.timer.chimePlayedForSeq !== state.timer.seq) {
          state.timer.chimePlayedForSeq = state.timer.seq;
          playTimerChime();
        }
      }
      emit("timer", getTimerSnapshot());
    }
  }, 250);

  // Prune stale presence entries every 15s & send heartbeat every 20s
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    state.presence.forEach((val, key) => {
      if (key !== state.participantId && now - (val.lastSeenMs || 0) > 65000) {
        state.presence.delete(key);
        changed = true;
      }
    });
    if (changed) emit("presence", getPresenceSummary());
  }, 15000);

  setInterval(() => {
    publishPresence();
  }, 20000);

  function publishPacket(subpath, payload, retain) {
    const msg = Object.assign({}, payload, {
      msgId: payload.msgId || randomId("pkt"),
      roomId: state.roomId,
      senderCli: clientInstanceId,
      sentWallMs: Date.now()
    });
    rememberMsgId(msg.msgId);

    const raw = JSON.stringify(msg);

    // 1. BroadcastChannel (instant same-browser tabs)
    if (state.bc) {
      try {
        state.bc.postMessage({ subpath, msg, retained: false });
      } catch (_) {}
    }

    // 2. MQTT over WSS
    const fullTopic = roomTopic(subpath);
    state.mqttClients.forEach((client) => {
      try {
        if (client && client.connected) {
          client.publish(fullTopic, raw, { qos: 0, retain: Boolean(retain) });
        }
      } catch (_) {}
    });

    // 3. PeerJS WebRTC DataChannel
    const peerEnv = { subpath, msg };
    if (state.role === "faculty") {
      state.peerConns.forEach((conn) => {
        try {
          if (conn && conn.open) conn.send(peerEnv);
        } catch (_) {}
      });
    } else if (state.hostConn && state.hostConn.open) {
      try {
        state.hostConn.send(peerEnv);
      } catch (_) {}
    }
  }

  function handleIncomingPacket(subpath, msg, isRetained) {
    if (!msg || typeof msg !== "object") return;
    if (Number(msg.roomId) !== state.roomId) return;
    if (msg.senderCli === clientInstanceId) return;
    if (rememberMsgId(msg.msgId)) return;

    // If faculty receives from a PeerJS student, relay to other PeerJS students
    if (state.role === "faculty" && state.peerConns.size > 1) {
      state.peerConns.forEach((conn) => {
        try {
          if (conn && conn.open) conn.send({ subpath, msg });
        } catch (_) {}
      });
    }

    if (msg.type === "timer") {
      const seq = Number(msg.seq) || 0;
      if (seq < state.timer.seq && msg.sentWallMs < (state.timer.lastWallMs || 0)) return;
      let rem = Math.max(0, Number(msg.remainingMs) || 0);
      if (msg.running && isRetained && msg.sentWallMs) {
        const wallElapsed = Math.max(0, Date.now() - Number(msg.sentWallMs));
        rem = Math.max(0, rem - wallElapsed);
      }
      state.timer.seq = Math.max(state.timer.seq + 1, seq);
      state.timer.durationSec = Math.max(10, Number(msg.durationSec) || 300);
      state.timer.baseRemainingMs = rem;
      state.timer.anchorPerfNow = performance.now();
      state.timer.running = Boolean(msg.running) && rem > 0;
      state.timer.label = String(msg.label || "จับเวลาอภิปรายกลุ่มย่อย").slice(0, 100);
      state.timer.questionId = String(msg.questionId || "").slice(0, 32);
      state.timer.lastWallMs = Number(msg.sentWallMs) || Date.now();
      if (rem > 0) state.timer.chimePlayedForSeq = -1;
      emit("timer", getTimerSnapshot());
      return;
    }

    if (msg.type === "slide") {
      if ((Number(msg.sentWallMs) || 0) < (state.teacherPointer.sentWallMs || 0)) return;
      state.teacherPointer = {
        seq: Number(msg.seq) || 0,
        module: String(msg.module || "").slice(0, 12),
        caseId: String(msg.caseId || "").slice(0, 24),
        questionId: String(msg.questionId || "").slice(0, 24),
        sentWallMs: Number(msg.sentWallMs) || Date.now()
      };
      emit("pointer", Object.assign({}, state.teacherPointer));
      return;
    }

    if (msg.type === "clear_q") {
      const qid = String(msg.questionId || "");
      const clearTs = Number(msg.clearedAtWallMs) || Date.now();
      if (!qid) return;
      const prevClear = state.clearedAtByQuestion.get(qid) || 0;
      if (clearTs > prevClear) {
        state.clearedAtByQuestion.set(qid, clearTs);
        const qMap = state.responsesByQuestion.get(qid);
        if (qMap) {
          qMap.forEach((rec, pid) => {
            if ((rec.updatedWallMs || 0) <= clearTs) qMap.delete(pid);
          });
        }
        emit("responses", { questionId: qid });
      }
      return;
    }

    if (msg.type === "resp") {
      const qid = String(msg.questionId || "").slice(0, 32);
      const pid = String(msg.participantId || "").slice(0, 48);
      if (!qid || !pid) return;
      const updatedMs = Number(msg.updatedWallMs) || Number(msg.sentWallMs) || Date.now();
      const clearedAt = state.clearedAtByQuestion.get(qid) || 0;
      if (updatedMs <= clearedAt) return;

      if (!state.responsesByQuestion.has(qid)) {
        state.responsesByQuestion.set(qid, new Map());
      }
      const qMap = state.responsesByQuestion.get(qid);
      const existing = qMap.get(pid);
      if (existing && (existing.updatedWallMs || 0) > updatedMs) return;

      const cleanCells = {};
      const cleanCellStatuses = {};
      let hasNonEmpty = false;
      let anySubmitted = false;
      const rawCellStatuses =
        msg.cellStatuses && typeof msg.cellStatuses === "object" ? msg.cellStatuses : {};
      if (msg.cells && typeof msg.cells === "object") {
        Object.keys(msg.cells).slice(0, 32).forEach((k) => {
          const val = String(msg.cells[k] || "").slice(0, 500);
          if (val.trim()) {
            cleanCells[k] = val;
            const cStat = rawCellStatuses[k]
              ? rawCellStatuses[k] === "submitted"
                ? "submitted"
                : "typing"
              : msg.status === "submitted"
              ? "submitted"
              : "typing";
            cleanCellStatuses[k] = cStat;
            if (cStat === "submitted") anySubmitted = true;
            hasNonEmpty = true;
          }
        });
      }

      if (!hasNonEmpty) {
        qMap.delete(pid);
      } else {
        qMap.set(pid, {
          participantId: pid,
          studentId: String(msg.studentId || "").slice(0, 16),
          displayName: String(msg.displayName || "นักศึกษาในห้อง").slice(0, 80),
          nickname: String(msg.nickname || "").slice(0, 32),
          area: String(msg.area || "").slice(0, 40),
          questionId: qid,
          cells: cleanCells,
          cellStatuses: cleanCellStatuses,
          status: msg.status === "submitted" || anySubmitted ? "submitted" : "typing",
          updatedWallMs: updatedMs
        });
      }

      // Also refresh presence from active typing!
      state.presence.set(pid, {
        participantId: pid,
        role: "student",
        name: String(msg.displayName || "นักศึกษา").slice(0, 60),
        lastSeenMs: Date.now()
      });
      emit("responses", { questionId: qid, participantId: pid });
      emit("presence", getPresenceSummary());
      return;
    }

    if (msg.type === "presence") {
      const pid = String(msg.participantId || "").slice(0, 48);
      if (!pid) return;
      state.presence.set(pid, {
        participantId: pid,
        role: msg.role === "faculty" ? "faculty" : "student",
        name: String(msg.name || "ผู้เข้าร่วม").slice(0, 60),
        lastSeenMs: Date.now()
      });
      emit("presence", getPresenceSummary());
    }
  }

  function updateConnectionBadge() {
    emit("connection", getConnectionStatus());
  }

  function getConnectionStatus() {
    const list = Array.from(state.connectedTransports);
    const hasCloud = list.some((x) => x.startsWith("mqtt") || x.startsWith("peer"));
    return {
      online: hasCloud,
      localReady: Boolean(state.bc),
      transports: list,
      label: hasCloud
        ? "เชื่อมต่อสดข้ามอุปกรณ์ (Live Cloud)"
        : state.bc
        ? "พร้อมซิงค์ในเครือข่าย/แท็บเครื่อง"
        : "โหมดออฟไลน์"
    };
  }

  function subscribeCurrentRoomMqtt(client) {
    if (!client || !client.connected) return;
    try {
      client.subscribe(`${TOPIC_NS}/room-${state.roomId}/#`, { qos: 0 });
    } catch (_) {}
  }

  function unsubscribeRoomMqtt(client, oldRoomId) {
    if (!client || !client.connected || !oldRoomId) return;
    try {
      client.unsubscribe(`${TOPIC_NS}/room-${oldRoomId}/#`);
    } catch (_) {}
  }

  function initBroadcastChannel() {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      state.bc = new BroadcastChannel(BC_NAME);
      state.connectedTransports.add("local");
      state.bc.onmessage = (ev) => {
        if (!ev || !ev.data) return;
        handleIncomingPacket(ev.data.subpath || "", ev.data.msg, false);
      };
      updateConnectionBadge();
    } catch (_) {}
  }

  function initMqttBrokers() {
    if (!window.mqtt || typeof window.mqtt.connect !== "function") return;
    BROKERS.forEach((url, idx) => {
      try {
        const tag = `mqtt${idx + 1}`;
        const client = window.mqtt.connect(url, {
          clientId: `racm303_${state.role}_${Math.random().toString(16).slice(2, 10)}`,
          clean: true,
          connectTimeout: 7000,
          reconnectPeriod: 5000,
          keepalive: 45
        });
        client.on("connect", () => {
          state.connectedTransports.add(tag);
          subscribeCurrentRoomMqtt(client);
          updateConnectionBadge();
          publishPresence();
        });
        client.on("close", () => {
          state.connectedTransports.delete(tag);
          updateConnectionBadge();
        });
        client.on("error", () => {
          state.connectedTransports.delete(tag);
          updateConnectionBadge();
        });
        client.on("message", (topic, payloadBuf, packet) => {
          try {
            const prefix = `${TOPIC_NS}/room-${state.roomId}/`;
            if (!topic.startsWith(prefix)) return;
            const subpath = topic.slice(prefix.length);
            const text = payloadBuf ? payloadBuf.toString() : "";
            if (!text) return;
            const parsed = JSON.parse(text);
            handleIncomingPacket(subpath, parsed, Boolean(packet && packet.retain));
          } catch (_) {}
        });
        state.mqttClients.push(client);
      } catch (_) {}
    });
  }

  function teardownPeer() {
    if (state.hostConn) {
      try {
        state.hostConn.close();
      } catch (_) {}
      state.hostConn = null;
    }
    state.peerConns.forEach((c) => {
      try {
        c.close();
      } catch (_) {}
    });
    state.peerConns.clear();
    if (state.peer) {
      try {
        state.peer.destroy();
      } catch (_) {}
      state.peer = null;
    }
    state.connectedTransports.delete("peer");
    updateConnectionBadge();
  }

  function initPeerForRoom() {
    teardownPeer();
    if (typeof window.Peer !== "function") return;
    const hostPeerId = `racm303-2569-hsd-r${state.roomId}`;
    try {
      if (state.role === "faculty") {
        const peer = new window.Peer(hostPeerId, { debug: 0 });
        state.peer = peer;
        peer.on("open", () => {
          state.connectedTransports.add("peer");
          updateConnectionBadge();
        });
        peer.on("connection", (conn) => {
          state.peerConns.set(conn.peer, conn);
          conn.on("open", () => {
            // Send current timer & slide pointer immediately to newly connected student
            try {
              conn.send({
                subpath: "timer",
                msg: {
                  type: "timer",
                  msgId: randomId("sync"),
                  roomId: state.roomId,
                  seq: state.timer.seq,
                  running: state.timer.running,
                  durationSec: state.timer.durationSec,
                  remainingMs: getTimerRemainingMs(),
                  label: state.timer.label,
                  questionId: state.timer.questionId,
                  sentWallMs: Date.now()
                }
              });
              if (state.teacherPointer.questionId) {
                conn.send({
                  subpath: "slide",
                  msg: Object.assign({ type: "slide", msgId: randomId("sync"), roomId: state.roomId }, state.teacherPointer)
                });
              }
            } catch (_) {}
          });
          conn.on("data", (data) => {
            if (data && data.msg) handleIncomingPacket(data.subpath || "", data.msg, false);
          });
          conn.on("close", () => state.peerConns.delete(conn.peer));
          conn.on("error", () => state.peerConns.delete(conn.peer));
        });
        peer.on("error", () => {
          // Another co-teacher may already hold the hostPeerId; MQTT handles multi-teacher seamlessly
          state.connectedTransports.delete("peer");
          updateConnectionBadge();
        });
      } else {
        const peer = new window.Peer(undefined, { debug: 0 });
        state.peer = peer;
        peer.on("open", () => {
          try {
            const conn = peer.connect(hostPeerId, { reliable: true });
            state.hostConn = conn;
            conn.on("open", () => {
              state.connectedTransports.add("peer");
              updateConnectionBadge();
              publishPresence();
            });
            conn.on("data", (data) => {
              if (data && data.msg) handleIncomingPacket(data.subpath || "", data.msg, false);
            });
            conn.on("close", () => {
              state.connectedTransports.delete("peer");
              updateConnectionBadge();
            });
            conn.on("error", () => {
              state.connectedTransports.delete("peer");
              updateConnectionBadge();
            });
          } catch (_) {}
        });
        peer.on("error", () => {});
      }
    } catch (_) {}
  }

  function publishPresence() {
    const myName = getEffectiveDisplayName();
    state.presence.set(state.participantId, {
      participantId: state.participantId,
      role: state.role,
      name: myName,
      lastSeenMs: Date.now()
    });
    publishPacket(
      `presence/${state.participantId}`,
      {
        type: "presence",
        participantId: state.participantId,
        role: state.role,
        name: myName
      },
      false
    );
    emit("presence", getPresenceSummary());
  }

  function getPresenceSummary() {
    let students = 0;
    let teachers = 0;
    const list = [];
    state.presence.forEach((p) => {
      if (p.role === "faculty") teachers += 1;
      else students += 1;
      list.push(p);
    });
    return {
      total: students + teachers,
      students,
      teachers,
      list
    };
  }

  function getEffectiveDisplayName() {
    if (state.role === "faculty") {
      return state.displayName || "อาจารย์ประจำกลุ่ม";
    }
    if (state.displayName && state.displayName.trim()) {
      return state.displayName.trim();
    }
    return `นศพ. กลุ่ม ${state.roomId} (#${state.participantId.slice(-4)})`;
  }

  function setStudentProfile(studentObj) {
    if (studentObj && studentObj.id) {
      state.studentId = String(studentObj.id);
      state.participantId = `sid_${studentObj.id}`;
      const nick = String(studentObj.nickname || studentObj.nick || "").trim();
      state.nickname = nick;
      state.area = studentObj.area || "";
      const baseName = studentObj.name || studentObj.fullName || studentObj.id;
      state.displayName = nick ? `${nick} (${baseName})` : `${studentObj.id} ${baseName}`;
      if (studentObj.disc >= 1 && studentObj.disc <= 6) {
        setRoom(studentObj.disc, true);
      }
    }
    publishPresence();
  }

  function setCustomDisplayName(nameStr) {
    const clean = String(nameStr || "").trim().slice(0, 60);
    state.displayName = clean;
    safeSetStorage("racm303_live_name_v1", clean);
    publishPresence();
  }

  function setRoom(roomNum, silentSave) {
    const next = clampRoom(roomNum);
    const prev = state.roomId;
    if (next === prev && state.presence.size > 0) return;

    state.mqttClients.forEach((c) => unsubscribeRoomMqtt(c, prev));
    state.roomId = next;
    if (!silentSave) safeSetStorage("racm303_live_room_v1", String(next));

    // Reset room-scoped caches when switching rooms
    state.responsesByQuestion.clear();
    state.clearedAtByQuestion.clear();
    state.presence.clear();
    state.timer = {
      seq: 0,
      running: false,
      durationSec: 300,
      baseRemainingMs: 300000,
      anchorPerfNow: performance.now(),
      questionId: "",
      label: "จับเวลาอภิปรายกลุ่มย่อย",
      chimePlayedForSeq: -1
    };

    state.mqttClients.forEach((c) => subscribeCurrentRoomMqtt(c));
    initPeerForRoom();
    publishPresence();
    emit("timer", getTimerSnapshot());
    emit("responses", { questionId: "*" });
  }

  /* ---------- Teacher Timer & Slide Pointer Controls ---------- */
  function startTimer(durationSec, questionId, label) {
    const sec = Math.max(10, Math.min(3600, Number(durationSec) || state.timer.durationSec || 300));
    state.timer.seq += 1;
    state.timer.durationSec = sec;
    state.timer.baseRemainingMs = sec * 1000;
    state.timer.anchorPerfNow = performance.now();
    state.timer.running = true;
    state.timer.chimePlayedForSeq = -1;
    if (questionId !== undefined) state.timer.questionId = questionId;
    if (label !== undefined) state.timer.label = label;

    publishPacket(
      "timer",
      {
        type: "timer",
        seq: state.timer.seq,
        running: true,
        durationSec: sec,
        remainingMs: sec * 1000,
        questionId: state.timer.questionId,
        label: state.timer.label
      },
      true
    );
    emit("timer", getTimerSnapshot());
  }

  function togglePauseTimer() {
    const rem = getTimerRemainingMs();
    state.timer.seq += 1;
    if (state.timer.running) {
      state.timer.running = false;
      state.timer.baseRemainingMs = rem;
    } else {
      const nextMs = rem > 0 ? rem : (state.timer.durationSec || 300) * 1000;
      state.timer.baseRemainingMs = nextMs;
      state.timer.anchorPerfNow = performance.now();
      state.timer.running = true;
      state.timer.chimePlayedForSeq = -1;
    }
    publishPacket(
      "timer",
      {
        type: "timer",
        seq: state.timer.seq,
        running: state.timer.running,
        durationSec: state.timer.durationSec,
        remainingMs: state.timer.baseRemainingMs,
        questionId: state.timer.questionId,
        label: state.timer.label
      },
      true
    );
    emit("timer", getTimerSnapshot());
  }

  function addTimerSeconds(deltaSec) {
    const cur = getTimerRemainingMs();
    const nextMs = Math.max(0, Math.min(3600 * 1000, cur + (Number(deltaSec) || 60) * 1000));
    state.timer.seq += 1;
    state.timer.baseRemainingMs = nextMs;
    state.timer.anchorPerfNow = performance.now();
    if (nextMs > 0) state.timer.chimePlayedForSeq = -1;
    state.timer.durationSec = Math.max(state.timer.durationSec, Math.ceil(nextMs / 1000));
    publishPacket(
      "timer",
      {
        type: "timer",
        seq: state.timer.seq,
        running: state.timer.running,
        durationSec: state.timer.durationSec,
        remainingMs: nextMs,
        questionId: state.timer.questionId,
        label: state.timer.label
      },
      true
    );
    emit("timer", getTimerSnapshot());
  }

  function resetTimer(durationSec) {
    const sec = Math.max(10, Math.min(3600, Number(durationSec) || state.timer.durationSec || 300));
    state.timer.seq += 1;
    state.timer.running = false;
    state.timer.durationSec = sec;
    state.timer.baseRemainingMs = sec * 1000;
    state.timer.anchorPerfNow = performance.now();
    state.timer.chimePlayedForSeq = -1;
    publishPacket(
      "timer",
      {
        type: "timer",
        seq: state.timer.seq,
        running: false,
        durationSec: sec,
        remainingMs: sec * 1000,
        questionId: state.timer.questionId,
        label: state.timer.label
      },
      true
    );
    emit("timer", getTimerSnapshot());
  }

  function broadcastTeacherQuestionPointer(moduleId, caseId, questionId) {
    if (state.role !== "faculty") return;
    state.teacherPointer.seq += 1;
    state.teacherPointer.module = moduleId || "";
    state.teacherPointer.caseId = caseId || "";
    state.teacherPointer.questionId = questionId || "";
    state.teacherPointer.sentWallMs = Date.now();
    publishPacket(
      "slide",
      {
        type: "slide",
        seq: state.teacherPointer.seq,
        module: state.teacherPointer.module,
        caseId: state.teacherPointer.caseId,
        questionId: state.teacherPointer.questionId
      },
      true
    );
  }

  /* ---------- Student Per-Cell Live Typing & Per-Block Submission ---------- */
  const debounceTimers = new Map();
  const lastSentAtByQuestion = new Map();
  const pendingCellsByQuestion = new Map();
  let submittedTextByCell = (function () {
    try {
      return JSON.parse(safeGetStorage("racm303_hs_disc_submitted_cells_v1", "{}")) || {};
    } catch (_) {
      return {};
    }
  })();

  function saveSubmittedCellsStore() {
    safeSetStorage("racm303_hs_disc_submitted_cells_v1", JSON.stringify(submittedTextByCell));
  }

  function getCellSubmissionState(inputId, currentVal) {
    const trimmed = String(currentVal || "").trim();
    if (!trimmed) return "empty";
    const prevSent = submittedTextByCell[inputId];
    if (prevSent === undefined) return "ready";
    return prevSent === trimmed ? "submitted" : "dirty";
  }

  function clearSubmittedCells(inputIds) {
    if (!inputIds) {
      submittedTextByCell = {};
    } else {
      inputIds.forEach((id) => delete submittedTextByCell[id]);
    }
    saveSubmittedCellsStore();
  }

  function publishStudentQuestionCells(questionId, cellsObj, forceSubmitAll) {
    if (!questionId || !cellsObj) return;
    const cleanCells = {};
    const cleanCellStatuses = {};
    let hasAny = false;
    let anySubmitted = false;

    Object.keys(cellsObj).forEach((k) => {
      const v = String(cellsObj[k] || "").slice(0, 500);
      const trimmed = v.trim();
      if (trimmed) {
        cleanCells[k] = v;
        hasAny = true;
        if (forceSubmitAll) {
          submittedTextByCell[k] = trimmed;
        }
        const isCellSub = submittedTextByCell[k] === trimmed;
        cleanCellStatuses[k] = isCellSub ? "submitted" : "typing";
        if (isCellSub) anySubmitted = true;
      }
    });
    if (forceSubmitAll) saveSubmittedCellsStore();

    const overallStatus = anySubmitted ? "submitted" : "typing";
    const updatedMs = Date.now();
    lastSentAtByQuestion.set(questionId, updatedMs);

    if (!state.responsesByQuestion.has(questionId)) {
      state.responsesByQuestion.set(questionId, new Map());
    }
    const qMap = state.responsesByQuestion.get(questionId);
    if (!hasAny) {
      qMap.delete(state.participantId);
    } else {
      qMap.set(state.participantId, {
        participantId: state.participantId,
        studentId: state.studentId,
        displayName: getEffectiveDisplayName(),
        nickname: state.nickname,
        area: state.area,
        questionId,
        cells: cleanCells,
        cellStatuses: cleanCellStatuses,
        status: overallStatus,
        updatedWallMs: updatedMs
      });
    }

    publishPacket(
      `resp/${questionId}/${state.participantId}`,
      {
        type: "resp",
        participantId: state.participantId,
        studentId: state.studentId,
        displayName: getEffectiveDisplayName(),
        nickname: state.nickname,
        area: state.area,
        questionId,
        cells: cleanCells,
        cellStatuses: cleanCellStatuses,
        status: overallStatus,
        updatedWallMs: updatedMs
      },
      true
    );
    emit("responses", { questionId, participantId: state.participantId });
  }

  function queueLiveTyping(questionId, cellsObj) {
    if (!questionId) return;
    pendingCellsByQuestion.set(questionId, Object.assign({}, cellsObj));
    const now = Date.now();
    const lastSent = lastSentAtByQuestion.get(questionId) || 0;
    const elapsed = now - lastSent;

    // Leading edge: send immediately if >= 280ms since last packet
    if (elapsed >= 280) {
      const prevT = debounceTimers.get(questionId);
      if (prevT) {
        clearTimeout(prevT);
        debounceTimers.delete(questionId);
      }
      pendingCellsByQuestion.delete(questionId);
      publishStudentQuestionCells(questionId, cellsObj, false);
      return;
    }

    // Trailing edge: guarantee latest characters are flushed shortly after burst typing
    if (!debounceTimers.has(questionId)) {
      const waitMs = Math.max(80, 300 - elapsed);
      const t = setTimeout(() => {
        debounceTimers.delete(questionId);
        const latest = pendingCellsByQuestion.get(questionId);
        pendingCellsByQuestion.delete(questionId);
        if (latest) publishStudentQuestionCells(questionId, latest, false);
      }, waitMs);
      debounceTimers.set(questionId, t);
    }
  }

  function flushLiveTyping(questionId, cellsObj) {
    if (!questionId) return;
    const prevT = debounceTimers.get(questionId);
    if (prevT) {
      clearTimeout(prevT);
      debounceTimers.delete(questionId);
    }
    const latest = cellsObj || pendingCellsByQuestion.get(questionId);
    pendingCellsByQuestion.delete(questionId);
    if (latest) publishStudentQuestionCells(questionId, latest, false);
  }

  function submitSingleCell(questionId, inputId, cellsObj) {
    if (!questionId || !inputId || !cellsObj) return false;
    const val = String(cellsObj[inputId] || "").trim();
    if (!val) return false;
    const prevT = debounceTimers.get(questionId);
    if (prevT) {
      clearTimeout(prevT);
      debounceTimers.delete(questionId);
    }
    pendingCellsByQuestion.delete(questionId);
    submittedTextByCell[inputId] = val;
    saveSubmittedCellsStore();
    publishStudentQuestionCells(questionId, cellsObj, false);
    return true;
  }

  function submitQuestionFinal(questionId, cellsObj) {
    const prevT = debounceTimers.get(questionId);
    if (prevT) {
      clearTimeout(prevT);
      debounceTimers.delete(questionId);
    }
    pendingCellsByQuestion.delete(questionId);
    publishStudentQuestionCells(questionId, cellsObj, true);
  }

  function clearQuestionResponses(questionId) {
    if (!questionId) return;
    const now = Date.now();
    state.clearedAtByQuestion.set(questionId, now);
    const qMap = state.responsesByQuestion.get(questionId);
    if (qMap) qMap.clear();
    publishPacket(
      `clear/${questionId}`,
      {
        type: "clear_q",
        questionId,
        clearedAtWallMs: now
      },
      true
    );
    emit("responses", { questionId });
  }

  function getQuestionResponses(questionId) {
    const qMap = state.responsesByQuestion.get(questionId);
    if (!qMap) return [];
    return Array.from(qMap.values()).sort((a, b) => {
      if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
      return (b.updatedWallMs || 0) - (a.updatedWallMs || 0);
    });
  }

  function getCellResponses(questionId, inputId) {
    const qMap = state.responsesByQuestion.get(questionId);
    if (!qMap || !inputId) return [];
    const items = [];
    qMap.forEach((rec) => {
      const txt = rec.cells && rec.cells[inputId];
      if (!txt || !String(txt).trim()) return;
      const cStat =
        rec.cellStatuses && rec.cellStatuses[inputId]
          ? rec.cellStatuses[inputId]
          : rec.status === "submitted"
          ? "submitted"
          : "typing";
      items.push({
        participantId: rec.participantId,
        studentId: rec.studentId,
        displayName: rec.displayName,
        nickname: rec.nickname,
        area: rec.area,
        questionId,
        inputId,
        text: String(txt).trim(),
        status: cStat === "submitted" ? "submitted" : "typing",
        updatedWallMs: rec.updatedWallMs || 0,
        fullRecord: rec
      });
    });
    return items.sort((a, b) => {
      if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
      return (b.updatedWallMs || 0) - (a.updatedWallMs || 0);
    });
  }

  function setFollowTeacher(flag) {
    state.followTeacher = Boolean(flag);
    safeSetStorage("racm303_live_follow_v1", state.followTeacher ? "1" : "0");
  }

  function setAnonymousWall(flag) {
    state.anonymousWall = Boolean(flag);
    safeSetStorage("racm303_live_anon_v1", state.anonymousWall ? "1" : "0");
    emit("responses", { questionId: "*" });
  }

  function setSoundMuted(flag) {
    state.soundMuted = Boolean(flag);
    safeSetStorage("racm303_live_mute_v1", state.soundMuted ? "1" : "0");
  }

  let initialized = false;
  function startEngine() {
    if (initialized) return;
    initialized = true;
    initBroadcastChannel();
    initMqttBrokers();
    initPeerForRoom();
    publishPresence();
  }

  window.RACM_LIVE_CLASSROOM = {
    rooms: ROOM_DEFS,
    startEngine,
    on,
    getRoomId: () => state.roomId,
    getRoomDef: (id) => ROOM_DEFS.find((r) => r.id === clampRoom(id || state.roomId)) || ROOM_DEFS[0],
    setRoom,
    setStudentProfile,
    setCustomDisplayName,
    getDisplayName: getEffectiveDisplayName,
    getParticipantId: () => state.participantId,
    getConnectionStatus,
    getPresenceSummary,
    getTimerSnapshot,
    startTimer,
    togglePauseTimer,
    addTimerSeconds,
    resetTimer,
    broadcastTeacherQuestionPointer,
    getTeacherPointer: () => Object.assign({}, state.teacherPointer),
    queueLiveTyping,
    flushLiveTyping,
    submitSingleCell,
    submitQuestionFinal,
    getCellSubmissionState,
    clearSubmittedCells,
    clearQuestionResponses,
    getQuestionResponses,
    getCellResponses,
    getFollowTeacher: () => state.followTeacher,
    setFollowTeacher,
    getAnonymousWall: () => state.anonymousWall,
    setAnonymousWall,
    getSoundMuted: () => state.soundMuted,
    setSoundMuted
  };
})();
