/* ==========================================================================
   RACM 303 (ปีการศึกษา 2569) — Interactive Course & Guided Learning Controller
   Supports window.PORTAL_ROLE = "student" | "faculty"
   ========================================================================== */
(function () {
  "use strict";

  const ROLE = window.PORTAL_ROLE === "faculty" ? "faculty" : "student";
  const SCHED = window.RACM_SCHEDULE_DATA || {};
  const ROSTER = window.RACM_ROSTER_DATA || { students: [], courseTeachers: [], appsScriptReconciliation: [] };
  const MANUAL = window.RACM_MANUAL_DATA || { chapters: [] };
  const HS = window.RACM_HS_DATA || { docs: [], rapidReview: [], glossary: [], selfCheck: [] };
  const FACULTY = window.RACM_FACULTY_DATA || { docs: [], links: [] };

  const $ = (id) => document.getElementById(id);
  const compareTH = (a, b) => String(a || "").localeCompare(String(b || ""), "th", { numeric: true });

  const state = {
    activeTab: "schedule",
    schedSub: "daily", // daily | master | spec
    practiceSub: "rapid", // rapid | flashcards | qa
    facultySub: "guides", // guides | links
    myStudent: null,
    classContext: null,
    showPhotos: ROLE === "faculty",
    showSitesOverview: false,
    visibleStudents: [],
    manualChapterId: "ALL",
    activeDocId: "HS1",
    activeFacultyDocId: (FACULTY.docs[0] && FACULTY.docs[0].id) || "hs1-tg",
    readerFontPx: Number(localStorage.getItem("racm303_font_px")) || 16.5,
    masteredCards: new Set(JSON.parse(localStorage.getItem("racm303_mastered_fc") || "[]")),
    fcShuffleSeed: null
  };

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function make(tag, text, cls) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  /* ---------- Lazy Photo Observer (Drive Thumbnail + Monogram Fallback) ---------- */
  function studentInitials(s) {
    const parts = String(s.name || "").trim().split(/\s+/);
    const a = parts[0] ? [...parts[0]][0] : "น";
    const b = parts[1] ? [...parts[1]][0] : "";
    return (a + b).toUpperCase();
  }

  const photoObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          photoObserver.unobserve(entry.target);
          mountStudentPhoto(entry.target);
        });
      }, { rootMargin: "160px" })
    : null;

  function mountStudentPhoto(box) {
    const pid = box.dataset.photoId;
    const initials = box.dataset.initials || "นศ";
    if (!pid) {
      box.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      return;
    }
    const img = document.createElement("img");
    img.alt = box.dataset.studentName || "รูปนักศึกษา";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
    img.onerror = () => {
      box.innerHTML = `<span class="avatar-monogram" title="เปิดดูรูปใน Apps Script ได้จากปุ่มด้านบน">${escapeHtml(initials)}</span>`;
    };
    box.replaceChildren(img);
  }

  /* ---------- Personalization Bar ---------- */
  function initPersonalizer() {
    const list = $("studentLookupList");
    const input = $("personalStudentInput");
    if (!list || !input) return;

    ROSTER.students.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = `${s.id} — ${s.fullName}`;
      opt.label = `กลุ่มพื้นที่ ${s.area} · Discussion ${s.disc}`;
      list.appendChild(opt);
    });

    const savedId = localStorage.getItem("racm303_my_sid");
    if (savedId) {
      const found = ROSTER.students.find((s) => s.id === savedId);
      if (found) applyMyStudent(found, false);
    }

    input.addEventListener("change", handlePersonalInput);
    input.addEventListener("input", () => {
      const val = input.value.trim();
      const m = val.match(/^(\d{7})\b/);
      if (m) {
        const found = ROSTER.students.find((s) => s.id === m[1]);
        if (found) applyMyStudent(found, true);
      }
    });

    const clearBtn = $("clearPersonalBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.myStudent = null;
        localStorage.removeItem("racm303_my_sid");
        input.value = "";
        if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
        if ($("schedAreaFilter")) $("schedAreaFilter").value = "";
        updatePersonalBanner();
        renderScheduleDaily();
      });
    }
  }

  function handlePersonalInput() {
    const input = $("personalStudentInput");
    if (!input) return;
    const q = input.value.trim().toLocaleLowerCase("th");
    if (!q) return;
    const found = ROSTER.students.find(
      (s) =>
        q.startsWith(s.id) ||
        s.fullName.toLocaleLowerCase("th") === q ||
        s.name.toLocaleLowerCase("th") === q ||
        `${s.id} — ${s.fullName}`.toLocaleLowerCase("th") === q
    );
    if (found) applyMyStudent(found, true);
  }

  function applyMyStudent(student, syncFilters) {
    state.myStudent = student;
    localStorage.setItem("racm303_my_sid", student.id);
    const input = $("personalStudentInput");
    if (input) input.value = `${student.id} — ${student.fullName}`;

    if (syncFilters) {
      if ($("schedDiscFilter")) $("schedDiscFilter").value = String(student.disc);
      if ($("schedAreaFilter")) $("schedAreaFilter").value = student.area;
    }

    // Pre-fill SRN Filename Generator
    if ($("srnAreaSelect")) $("srnAreaSelect").value = student.area;
    if ($("srnStudentId")) $("srnStudentId").value = student.id;
    if ($("srnStudentName")) $("srnStudentName").value = student.fullName;
    updateSrnFilename();

    updatePersonalBanner();
    renderScheduleDaily();
  }

  function updatePersonalBanner() {
    const summary = $("personalSummary");
    const clearBtn = $("clearPersonalBtn");
    if (!summary) return;
    summary.replaceChildren();
    if (!state.myStudent) {
      summary.appendChild(
        make("span", "พิมพ์รหัส 7 หลักหรือชื่อ เพื่อกรองห้องเรียน กลุ่มอภิปราย พื้นที่ภาคสนาม และตั้งชื่อไฟล์ SRN อัตโนมัติ")
      );
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    const s = state.myStudent;
    const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
    const hsRot = (SCHED.hsRotation || []).find((x) => x.group === s.disc);
    summary.append(
      make("span", `Discussion ${s.disc} (${hsRot ? hsRot.room : ""})`, "personal-chip"),
      make("span", `พื้นที่: ${s.area}${site ? " · ห้อง " + site.room.split(" ")[0] : ""}`, "personal-chip"),
      make("span", `อ.ที่ปรึกษา: ${s.advisor}`, "personal-chip")
    );
    if (clearBtn) clearBtn.hidden = false;
  }

  /* ---------- Primary Tab Routing ---------- */
  function switchTab(tabId, pushHash = true) {
    const validTabs = ["schedule", "students", "manual", "textbooks", "practice"];
    if (ROLE === "faculty") validTabs.push("audit", "faculty-docs");
    if (!validTabs.includes(tabId)) tabId = "schedule";

    state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tabId}`;
    });

    document.body.classList.toggle("print-students-mode", tabId === "students");

    if (pushHash) {
      history.replaceState(null, "", `#${tabId}`);
    }

    if (tabId === "schedule") renderScheduleCurrent();
    if (tabId === "students") renderStudentsView();
    if (tabId === "manual") renderManualReader();
    if (tabId === "textbooks") renderTextbookReader();
    if (tabId === "practice") renderPracticeCurrent();
    if (tabId === "audit" && ROLE === "faculty") renderAuditView();
    if (tabId === "faculty-docs" && ROLE === "faculty") renderFacultyDocsView();
  }

  /* ---------- Per-Session Group Assignments Helper (Apps Script UX) ---------- */
  function getSessionAssignments(session) {
    if (session.hsModule) {
      const mod = session.hsModule;
      return (SCHED.hsRotation || []).map((rot) => {
        const cell = rot[mod] || {};
        return {
          type: "discussion",
          groupId: String(rot.group),
          label: `Discussion กลุ่มที่ ${rot.group} (${rot.count} คน)`,
          shortGroup: String(rot.group),
          lecturer: cell.instructor || "",
          room: cell.room || rot.room,
          highlightRoom: !!cell.highlightRoom,
          facultyFlag: cell.facultyFlag || ""
        };
      });
    }
    if (session.isFieldGroupSession) {
      const allowed = session.allowedSites || null;
      return (SCHED.fieldworkSites || [])
        .filter((site) => !allowed || allowed.includes(site.id))
        .map((site) => {
          let extra = "";
          if (session.code === "SG3" && ["เพชรบูรณ์ 2", "อุบลรัตน์", "อุ้มผาง"].includes(site.shortName)) {
            extra = " (อ.ที่ปรึกษา Online)";
          } else if (session.code === "SG4" && site.shortName === "เพชรบูรณ์ 2") {
            extra = " (อ.ที่ปรึกษา Online)";
          }
          return {
            type: "area",
            groupId: site.shortName,
            label: `กลุ่มพื้นที่ ${site.shortName} (${site.count} คน)`,
            shortGroup: site.shortName,
            lecturer: site.advisors + extra,
            room: session.code === "FIELD" ? `${site.hospital} ${site.province}` : site.room,
            highlightRoom: false,
            facultyFlag: ""
          };
        });
    }
    return [];
  }

  function sessionMatchesTeacher(session, teacherKey, assignments) {
    if (!teacherKey) return true;
    if (String(session.lecturers || "").includes(teacherKey)) return true;
    return assignments.some((a) => String(a.lecturer || "").includes(teacherKey));
  }

  /* ---------- Tab 1: Teaching Schedule ---------- */
  function initScheduleControls() {
    const teacherSel = $("schedTeacherFilter");
    if (teacherSel) {
      ROSTER.courseTeachers.forEach((t) => {
        teacherSel.add(new Option(t.label, t.key));
      });
    }
    const discSel = $("schedDiscFilter");
    if (discSel) {
      (SCHED.hsGroups || []).forEach((g) => {
        discSel.add(new Option(`Discussion ${g.id} (${g.defaultRoom.split(" ")[0]})`, String(g.id)));
      });
    }
    const areaSel = $("schedAreaFilter");
    if (areaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(`${s.shortName} (${s.hospital})`, s.shortName));
      });
    }

    ["schedWeekFilter", "schedCatFilter", "schedTeacherFilter", "schedDiscFilter", "schedAreaFilter"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("change", renderScheduleDaily);
    });
    if ($("schedSearchInput")) {
      $("schedSearchInput").addEventListener("input", renderScheduleDaily);
    }
    if ($("resetSchedFiltersBtn")) {
      $("resetSchedFiltersBtn").addEventListener("click", () => {
        ["schedWeekFilter", "schedCatFilter", "schedTeacherFilter", "schedDiscFilter", "schedAreaFilter", "schedSearchInput"].forEach((id) => {
          if ($(id)) $(id).value = "";
        });
        renderScheduleDaily();
      });
    }

    document.querySelectorAll("[data-sched-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.schedSub = btn.dataset.schedSub;
        document.querySelectorAll("[data-sched-sub]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.schedSub === state.schedSub ? "true" : "false")
        );
        renderScheduleCurrent();
      });
    });

    if ($("exportIcsBtn")) $("exportIcsBtn").addEventListener("click", downloadScheduleIcs);
    if ($("printScheduleBtn")) {
      $("printScheduleBtn").addEventListener("click", () => {
        document.body.classList.remove("print-students-mode");
        window.print();
      });
    }
  }

  function renderScheduleCurrent() {
    $("schedDailyWrap").hidden = state.schedSub !== "daily";
    $("schedMasterWrap").hidden = state.schedSub !== "master";
    $("schedSpecWrap").hidden = state.schedSub !== "spec";
    if (state.schedSub === "daily") renderScheduleDaily();
    if (state.schedSub === "master") renderScheduleMaster();
    if (state.schedSub === "spec") renderScheduleSpec();
  }

  function renderScheduleDaily() {
    // Milestones strip
    const msWrap = $("milestoneStrip");
    if (msWrap && !msWrap.dataset.rendered) {
      msWrap.dataset.rendered = "1";
      (SCHED.milestones || []).forEach((m) => {
        const card = make("div", null, "milestone-card");
        card.append(
          make("div", m.date, "ms-date"),
          make("div", m.title, "ms-title"),
          make("div", m.channel, "ms-channel")
        );
        msWrap.appendChild(card);
      });
    }

    const weekVal = ($("schedWeekFilter") && $("schedWeekFilter").value) || "";
    const catVal = ($("schedCatFilter") && $("schedCatFilter").value) || "";
    const teacherVal = ($("schedTeacherFilter") && $("schedTeacherFilter").value) || "";
    const discVal = ($("schedDiscFilter") && $("schedDiscFilter").value) || "";
    const areaVal = ($("schedAreaFilter") && $("schedAreaFilter").value) || "";
    const q = (($("schedSearchInput") && $("schedSearchInput").value) || "").trim().toLocaleLowerCase("th");

    const sessions = (SCHED.sessions || []).filter((s) => {
      if (ROLE === "student" && s.studentVisible === false) return false;
      if (weekVal && String(s.week) !== weekVal) return false;
      if (catVal && s.category !== catVal) return false;

      const assignments = getSessionAssignments(s);
      if (!sessionMatchesTeacher(s, teacherVal, assignments)) return false;

      // If filtering by specific fieldwork area, check Friday 11 Dec 4-group restriction
      if (areaVal && s.allowedSites) {
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal);
        if (siteObj && !s.allowedSites.includes(siteObj.id)) return false;
      }

      if (q) {
        const hay = [
          s.code,
          s.title,
          s.objectives,
          s.lecturers,
          s.room,
          s.dateTH,
          ...assignments.map((a) => `${a.label} ${a.lecturer} ${a.room}`)
        ]
          .join(" ")
          .toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const statusEl = $("schedStatusText");
    if (statusEl) {
      const filtersDesc = [
        weekVal ? `สัปดาห์ที่ ${weekVal}` : "ครบทั้ง 6 สัปดาห์",
        teacherVal ? `อาจารย์: ${teacherVal}` : "",
        discVal ? `Discussion ${discVal}` : "",
        areaVal ? `พื้นที่ ${areaVal}` : ""
      ].filter(Boolean);
      statusEl.textContent = `แสดง ${sessions.length} คาบกิจกรรม · ${filtersDesc.join(" · ")}`;
    }

    const listEl = $("scheduleSessionsContainer");
    if (!listEl) return;
    listEl.replaceChildren();

    if (!sessions.length) {
      listEl.appendChild(make("div", "ไม่พบคาบเรียนที่ตรงกับตัวกรอง ลองกด “ล้างตัวกรอง” เพื่อดูตารางทั้งหมด", "empty-state"));
      return;
    }

    const catNames = {
      HS: "วิทยาศาสตร์ระบบสุขภาพ (HS)",
      EP: "ระบาดวิทยาคลินิกและชุมชน (EP)",
      SG: "กลุ่มย่อย & ภาคสนาม",
      PANEL: "เสวนา / ปฏิบัติการเชิงระบบ",
      EXAM: "การสอบ & กำหนดส่งงาน",
      HOLIDAY: "วันหยุด / เดินทางภาคสนาม",
      STAFF: "ภาควิชาฯ เตรียมความพร้อม"
    };

    let lastWeek = null;
    let lastDate = "";

    sessions.forEach((s) => {
      if (s.week !== lastWeek) {
        lastWeek = s.week;
        lastDate = "";
        const wg = (SCHED.masterGrid || []).find((w) => w.week === s.week);
        listEl.appendChild(make("div", `สัปดาห์ที่ ${s.week}${wg ? " · " + wg.range : ""}`, "week-divider"));
      }
      if (s.dateTH !== lastDate) {
        lastDate = s.dateTH;
        listEl.appendChild(make("h3", s.dateTH, "day-heading"));
      }

      const card = make("article", null, "session-card");
      const main = make("div", null, "session-main");

      const timeCol = make("div", s.timeLabel, "session-time");
      timeCol.appendChild(make("small", `${s.code} · ${s.checkIn || ""}`));
      main.appendChild(timeCol);

      const bodyCol = make("div", null, "session-topic");
      const badges = make("div", null, "session-badges");
      badges.append(
        make("span", catNames[s.category] || s.category, `badge cat-${s.category}`),
        make("span", s.format, "badge")
      );
      bodyCol.appendChild(badges);
      bodyCol.appendChild(make("h3", s.title));
      if (s.objectives) {
        bodyCol.appendChild(make("p", s.objectives, "session-objectives"));
      }

      const assignments = getSessionAssignments(s);
      const visibleAssignments = teacherVal
        ? assignments.filter((a) => String(a.lecturer).includes(teacherVal))
        : assignments;

      // Personal / Filter highlight banner inside card
      const activeDisc = discVal || (state.myStudent ? String(state.myStudent.disc) : "");
      const activeArea = areaVal || (state.myStudent ? state.myStudent.area : "");

      if (s.hsModule && activeDisc) {
        const myA = assignments.find((a) => a.shortGroup === activeDisc);
        if (myA) {
          const pbox = make("div", null, "personal-match-box");
          pbox.innerHTML = `<div><strong>ห้องเรียนของคุณ (${escapeHtml(myA.label)}):</strong> ห้อง <strong>${escapeHtml(myA.room)}</strong> · อาจารย์ประจำกลุ่ม: ${escapeHtml(myA.lecturer)}</div>`;
          const btn = make("button", `ดูรายชื่อกลุ่ม ${myA.shortGroup}`, "btn sm");
          btn.type = "button";
          btn.addEventListener("click", () => jumpToClassRoster(s, myA));
          pbox.appendChild(btn);
          bodyCol.appendChild(pbox);
        }
      } else if (s.isFieldGroupSession && activeArea) {
        const myA = assignments.find((a) => a.shortGroup === activeArea);
        if (myA) {
          const pbox = make("div", null, "personal-match-box");
          pbox.innerHTML = `<div><strong>กลุ่มพื้นที่ของคุณ (${escapeHtml(myA.shortGroup)}):</strong> ${escapeHtml(myA.room)} · อ.ที่ปรึกษา: ${escapeHtml(myA.lecturer)}</div>`;
          const btn = make("button", `ดูรายชื่อ ${myA.shortGroup}`, "btn sm");
          btn.type = "button";
          btn.addEventListener("click", () => jumpToClassRoster(s, myA));
          pbox.appendChild(btn);
          bodyCol.appendChild(pbox);
        }
      }

      const meta = make("div", null, "session-meta");
      meta.appendChild(make("span", `ผู้สอน: ${s.lecturers}`));
      const roomSpan = make("span", `ห้อง/สถานที่: ${s.room}`, "room-pill");
      bodyCol.appendChild(meta);
      bodyCol.appendChild(roomSpan);

      if (ROLE === "faculty" && s.facultyNote) {
        bodyCol.appendChild(make("div", `[บันทึกสำหรับอาจารย์/ผู้ประสานงาน] ${s.facultyNote}`, "faculty-flag-box"));
      }

      // Action buttons
      const actions = make("div", null, "session-actions");
      if (s.docLink) {
        const bDoc = make("button", `อ่านเอกสารคำสอน ${s.docLink}`, "btn sm teal");
        bDoc.type = "button";
        bDoc.addEventListener("click", () => openTextbookDoc(s.docLink));
        actions.appendChild(bDoc);
      }
      if (s.wbLink) {
        const bWb = make("button", `เปิดสมุดแบบฝึกหัด (${s.wbLink})`, "btn sm");
        bWb.type = "button";
        bWb.addEventListener("click", () => openTextbookDoc(s.wbLink));
        actions.appendChild(bWb);
      }
      if (s.zoom) {
        const zLink = make("a", `เข้าห้อง Zoom (${s.zoom.id} · รหัส ${s.zoom.pass})`, "btn sm primary");
        zLink.href = s.zoom.url;
        zLink.target = "_blank";
        zLink.rel = "noopener";
        actions.appendChild(zLink);
      }
      if (!assignments.length && s.category !== "HOLIDAY" && s.category !== "STAFF") {
        const bAll = make("button", "ดูรายชื่อนักศึกษาทั้งชั้น (169 คน)", "btn sm");
        bAll.type = "button";
        bAll.addEventListener("click", () =>
          jumpToClassRoster(s, { type: "all", groupId: "", label: "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้งชั้น (169 คน)", lecturer: s.lecturers, room: s.room })
        );
        actions.appendChild(bAll);
      }
      if (s.code === "SRN 1" || s.code === "SRN 2 & SLIDES") {
        const bSrn = make("button", "ตั้งชื่อไฟล์ PDF สำหรับส่ง SRN", "btn sm");
        bSrn.type = "button";
        bSrn.addEventListener("click", () => {
          switchTab("students");
          const srnEl = $("srnGeneratorBox");
          if (srnEl) srnEl.scrollIntoView({ behavior: "smooth" });
        });
        actions.appendChild(bSrn);
      }
      if (actions.childElementCount > 0) bodyCol.appendChild(actions);

      main.appendChild(bodyCol);
      card.appendChild(main);

      // Expandable Per-Group Assignments Accordion (ported & enhanced from Apps Script)
      if (visibleAssignments.length > 0) {
        const details = make("details", null, "assignments");
        details.open = Boolean(teacherVal || q);
        const kindText = s.hsModule ? "กลุ่มอภิปราย Discussion" : "กลุ่มพื้นที่ภาคสนาม";
        details.appendChild(
          make("summary", `ดูรายละเอียดแยกตาม${kindText} (${visibleAssignments.length} กลุ่ม) · อาจารย์ · ห้องเรียน · รายชื่อนักศึกษา`)
        );
        visibleAssignments.forEach((item) => {
          const isMine =
            (item.type === "discussion" && activeDisc === item.shortGroup) ||
            (item.type === "area" && activeArea === item.shortGroup);
          const row = make("div", null, `assignment-row${isMine ? " is-my-group" : ""}`);
          row.appendChild(make("div", item.label, "assignment-group"));
          const lecDiv = make("div", item.lecturer, "assignment-lecturer");
          if (ROLE === "faculty" && item.facultyFlag) {
            lecDiv.appendChild(make("div", `[${item.facultyFlag}]`, "faculty-flag-box"));
          }
          row.appendChild(lecDiv);
          row.appendChild(make("div", item.room, `room-pill${item.highlightRoom ? " highlight" : ""}`));
          const rBtn = make("button", "ดูรายชื่อ", "btn sm");
          rBtn.type = "button";
          rBtn.addEventListener("click", () => jumpToClassRoster(s, item));
          row.appendChild(rBtn);
          details.appendChild(row);
        });
        card.appendChild(details);
      }

      listEl.appendChild(card);
    });
  }

  function renderScheduleMaster() {
    const wrap = $("schedMasterContent");
    if (!wrap || wrap.dataset.rendered) return;
    wrap.dataset.rendered = "1";

    const rowsHtml = (SCHED.masterGrid || [])
      .map(
        (w) => `
      <tr>
        <td><strong>สัปดาห์ที่ ${w.week}</strong><br><small>${escapeHtml(w.range)}</small></td>
        <td>${escapeHtml(w.mon)}</td>
        <td>${escapeHtml(w.tue)}</td>
        <td>${escapeHtml(w.wed)}</td>
        <td>${escapeHtml(w.thu)}</td>
        <td>${escapeHtml(w.fri)}</td>
        <td>${escapeHtml(w.wknd)}</td>
      </tr>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="data-card">
        <h3>ผังตารางภาพรวมตลอด 6 สัปดาห์ (25 พฤศจิกายน – 30 ธันวาคม 2569)</h3>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>สัปดาห์</th>
                <th>จันทร์</th>
                <th>อังคาร</th>
                <th>พุธ</th>
                <th>พฤหัสบดี</th>
                <th>ศุกร์</th>
                <th>เสาร์–อาทิตย์</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderScheduleSpec() {
    const wrap = $("schedSpecContent");
    if (!wrap || wrap.dataset.rendered) return;
    wrap.dataset.rendered = "1";

    const rotRows = (SCHED.hsRotation || [])
      .map(
        (r) => `
      <tr>
        <td><strong>กลุ่มที่ ${r.group}</strong> (${r.count} คน)<br><small>ห้องหลัก ${escapeHtml(r.room)}</small></td>
        <td>${escapeHtml(r.HS1.instructor)}</td>
        <td>${escapeHtml(r.HS2.instructor)}</td>
        <td>${escapeHtml(r.HS3.instructor)}</td>
        <td>${escapeHtml(r.HS4.instructor)}<br><small><strong>ห้อง ${escapeHtml(r.HS4.room)}</strong></small></td>
        <td>${escapeHtml(r.HS5.instructor)}</td>
        <td>${escapeHtml(r.HS6.instructor)}</td>
      </tr>`
      )
      .join("");

    const hsSpecRows = ((SCHED.tableSpec && SCHED.tableSpec.hs) || [])
      .map(
        (x) => `<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.date)}</td><td><strong>${escapeHtml(x.weight)}</strong></td></tr>`
      )
      .join("");

    const epSpecRows = ((SCHED.tableSpec && SCHED.tableSpec.ep) || [])
      .map(
        (x) => `<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.date)}</td><td><strong>${escapeHtml(x.weight)}</strong></td></tr>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="data-card">
        <h3>ตารางหมุนเวียนอาจารย์ประจำกลุ่มอภิปราย HS1–HS6 (6 กลุ่มย่อย · 169 คน)</h3>
        <p style="margin:0 0 12px;font-size:14px;color:var(--muted)">หมายเหตุสำคัญ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปใช้ห้อง <strong>2C2-03</strong> ชั่วคราว และช่วงบ่าย (HS5) กลับเข้าห้อง <strong>1C1-07</strong> ตามปกติ</p>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>กลุ่มอภิปราย</th>
                <th>HS1 (26 พ.ย. เช้า)</th>
                <th>HS2 (30 พ.ย. เช้า)</th>
                <th>HS3 (30 พ.ย. บ่าย)</th>
                <th>HS4 (1 ธ.ค. เช้า)</th>
                <th>HS5 (1 ธ.ค. บ่าย)</th>
                <th>HS6 (4 ธ.ค. เช้า)</th>
              </tr>
            </thead>
            <tbody>${rotRows}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <h3>สัดส่วนเนื้อหาการสอบภาคทฤษฎีระบบสุขภาพ (HS1–HS6 · สอบ อ. 22 ธ.ค. 2569 แบบ Open Note 1 แผ่น A4 ลายมือ)</h3>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead><tr><th>รหัส</th><th>หัวข้อบทเรียน</th><th>วันเรียน</th><th>น้ำหนัก</th></tr></thead>
            <tbody>${hsSpecRows}</tbody>
          </table>
        </div>
      </div>
      <div class="data-card">
        <h3>สัดส่วนเนื้อหาการสอบภาคทฤษฎีระบาดวิทยา (EP1–EP9 · สอบ อ. 8 ธ.ค. 2569)</h3>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead><tr><th>รหัส</th><th>หัวข้อบทเรียน</th><th>วันเรียน</th><th>น้ำหนัก</th></tr></thead>
            <tbody>${epSpecRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ---------- .ics Calendar Export ---------- */
  function downloadScheduleIcs() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ramathibodi Community Medicine//RACM 303 2569//TH",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:RACM 303 (ปีการศึกษา 2569)"
    ];
    const stamp = "20261118T040000Z";
    (SCHED.sessions || []).forEach((s) => {
      if (s.studentVisible === false || !s.dateISO) return;
      if (state.myStudent && s.allowedSites) {
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === state.myStudent.area);
        if (siteObj && !s.allowedSites.includes(siteObj.id)) return;
      }
      const dStart = s.dateISO.replace(/-/g, "");
      const dEnd = (s.endDateISO || s.dateISO).replace(/-/g, "");
      const tStart = (s.startTime || "09:00").replace(":", "") + "00";
      const tEnd = (s.endTime || "12:00").replace(":", "") + "00";
      let loc = s.room || "";
      if (state.myStudent) {
        const assigns = getSessionAssignments(s);
        const myA = assigns.find(
          (a) =>
            (a.type === "discussion" && a.shortGroup === String(state.myStudent.disc)) ||
            (a.type === "area" && a.shortGroup === state.myStudent.area)
        );
        if (myA) loc = `${myA.room} (${myA.label})`;
      }
      const desc = `${s.objectives || ""}\\nผู้สอน: ${s.lecturers || ""}`.replace(/\r?\n/g, "\\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${s.id}@racm303-2569.mahidol`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Bangkok:${dStart}T${tStart}`,
        `DTEND;TZID=Asia/Bangkok:${dEnd}T${tEnd}`,
        `SUMMARY:[RACM 303] ${s.title.replace(/[,;]/g, " ")}`,
        `LOCATION:${loc.replace(/[,;]/g, " ")}`,
        `DESCRIPTION:${desc.replace(/[,;]/g, " ")}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.myStudent ? `RACM303_2569_${state.myStudent.id}.ics` : "RACM303_2569_Schedule.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Tab 2: Student Roster, Fieldwork Sites & SRN Filename Generator ---------- */
  function jumpToClassRoster(session, assignment) {
    state.classContext = {
      topic: session.title,
      date: session.dateTH,
      time: session.timeLabel,
      lecturer: assignment.lecturer || session.lecturers,
      room: assignment.room || session.room,
      type: assignment.type,
      groupId: assignment.groupId,
      label: assignment.label
    };
    if ($("studentSearchInput")) $("studentSearchInput").value = "";
    if ($("studentAreaFilter")) $("studentAreaFilter").value = assignment.type === "area" ? assignment.groupId : "";
    if ($("studentDiscFilter")) $("studentDiscFilter").value = assignment.type === "discussion" ? assignment.groupId : "";
    switchTab("students");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initStudentsControls() {
    const areaSel = $("studentAreaFilter");
    const srnAreaSel = $("srnAreaSelect");
    (SCHED.fieldworkSites || []).forEach((s) => {
      if (areaSel) areaSel.add(new Option(`${s.shortName} · ${s.advisors} (${s.count} คน)`, s.shortName));
      if (srnAreaSel) srnAreaSel.add(new Option(`${s.shortName} (${s.hospital})`, s.shortName));
    });

    const discSel = $("studentDiscFilter");
    (SCHED.hsGroups || []).forEach((g) => {
      if (discSel) discSel.add(new Option(`Discussion กลุ่มที่ ${g.id} (${g.count} คน)`, String(g.id)));
    });

    if (areaSel) {
      areaSel.addEventListener("change", () => {
        if (areaSel.value && discSel) discSel.value = "";
        state.classContext = null;
        renderStudentsView();
      });
    }
    if (discSel) {
      discSel.addEventListener("change", () => {
        if (discSel.value && areaSel) areaSel.value = "";
        state.classContext = null;
        renderStudentsView();
      });
    }
    if ($("studentSearchInput")) {
      $("studentSearchInput").addEventListener("input", renderStudentsView);
    }
    if ($("clearStudentFiltersBtn")) {
      $("clearStudentFiltersBtn").addEventListener("click", () => {
        state.classContext = null;
        if ($("studentSearchInput")) $("studentSearchInput").value = "";
        if (areaSel) areaSel.value = "";
        if (discSel) discSel.value = "";
        renderStudentsView();
      });
    }

    const photoToggle = $("togglePhotosBtn");
    if (photoToggle) {
      photoToggle.textContent = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
      photoToggle.addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        photoToggle.textContent = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
        renderStudentsView();
      });
    }

    const toggleSitesBtn = $("toggleSitesOverviewBtn");
    if (toggleSitesBtn) {
      toggleSitesBtn.addEventListener("click", () => {
        state.showSitesOverview = !state.showSitesOverview;
        $("sitesOverviewGrid").hidden = !state.showSitesOverview;
        toggleSitesBtn.textContent = state.showSitesOverview
          ? "ซ่อนรายละเอียด 9 พื้นที่ภาคสนาม"
          : "ดูรายละเอียดโรงพยาบาลและวันเดินทาง 9 พื้นที่";
      });
    }

    if ($("printStudentsBtn")) {
      $("printStudentsBtn").addEventListener("click", printStudentRosterOnePage);
    }

    // SRN Filename Generator
    ["srnRoundSelect", "srnAreaSelect", "srnStudentId", "srnStudentName"].forEach((id) => {
      if ($(id)) $(id).addEventListener("input", updateSrnFilename);
      if ($(id)) $(id).addEventListener("change", updateSrnFilename);
    });
    if ($("copySrnFilenameBtn")) {
      $("copySrnFilenameBtn").addEventListener("click", () => {
        const text = ($("srnFilenamePreview") && $("srnFilenamePreview").textContent) || "";
        navigator.clipboard.writeText(text).then(() => {
          const b = $("copySrnFilenameBtn");
          const prev = b.textContent;
          b.textContent = "คัดลอกชื่อไฟล์แล้ว";
          setTimeout(() => (b.textContent = prev), 1600);
        });
      });
    }
    updateSrnFilename();

    window.addEventListener("beforeprint", () => {
      if (state.activeTab === "students") fitPrintRoster();
    });
    window.addEventListener("afterprint", () => {
      document.querySelectorAll(".student-card h3, .student-card p").forEach((el) => el.style.removeProperty("font-size"));
    });
  }

  function updateSrnFilename() {
    const round = ($("srnRoundSelect") && $("srnRoundSelect").value) || "SRN1";
    const area = ($("srnAreaSelect") && $("srnAreaSelect").value) || "กุฉินารายณ์";
    const sid = (($("srnStudentId") && $("srnStudentId").value) || "").trim() || "6702xxx";
    const sname = (($("srnStudentName") && $("srnStudentName").value) || "").trim() || "ชื่อ-นามสกุล";
    const preview = $("srnFilenamePreview");
    if (preview) preview.textContent = `${round}_${area}_${sid}_${sname}.pdf`;
  }

  function buildAppsScriptDeepLink(areaVal, discVal) {
    const base = ROSTER.appsScriptUrl;
    if (!base) return "#";
    const params = new URLSearchParams({ page: "students" });
    if (discVal) {
      params.set("type", "discussion");
      params.set("group", discVal);
    } else if (areaVal) {
      params.set("type", "area");
      params.set("group", areaVal);
    }
    return `${base}?${params.toString()}`;
  }

  function renderStudentsView() {
    const areaVal = ($("studentAreaFilter") && $("studentAreaFilter").value) || "";
    const discVal = ($("studentDiscFilter") && $("studentDiscFilter").value) || "";
    const q = (($("studentSearchInput") && $("studentSearchInput").value) || "").trim().toLocaleLowerCase("th");

    // Render 9 Fieldwork Sites overview cards once
    const sitesGrid = $("sitesOverviewGrid");
    if (sitesGrid && !sitesGrid.dataset.rendered) {
      sitesGrid.dataset.rendered = "1";
      (SCHED.fieldworkSites || []).forEach((site) => {
        const c = make("div", null, "site-card");
        c.dataset.siteName = site.shortName;
        c.innerHTML = `
          <div class="site-card-head">
            <h3>${site.id}. ${escapeHtml(site.shortName)}</h3>
            <span class="badge cat-SG">${site.count} คน</span>
          </div>
          <p class="site-meta"><strong>${escapeHtml(site.hospital)}</strong> (${escapeHtml(site.province)})</p>
          <p class="site-meta">อ.ที่ปรึกษา: ${escapeHtml(site.advisors)}</p>
          <p class="site-meta">ห้องกลุ่มย่อย: <strong>${escapeHtml(site.room)}</strong></p>
          <p class="site-meta">ช่วงภาคสนาม: ${escapeHtml(site.datesTH)}</p>
          <p class="site-meta">${escapeHtml(site.travelNote)}</p>`;
        const filterBtn = make("button", `กรองรายชื่อกลุ่ม ${site.shortName}`, "btn sm");
        filterBtn.type = "button";
        filterBtn.addEventListener("click", () => {
          if ($("studentAreaFilter")) $("studentAreaFilter").value = site.shortName;
          if ($("studentDiscFilter")) $("studentDiscFilter").value = "";
          state.classContext = null;
          renderStudentsView();
        });
        c.appendChild(filterBtn);
        sitesGrid.appendChild(c);
      });
    }
    if (sitesGrid) {
      sitesGrid.querySelectorAll(".site-card").forEach((c) => {
        c.classList.toggle("active-site", c.dataset.siteName === areaVal);
      });
    }

    // Context Banner from Schedule click
    const ctxBox = $("classContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.classContext;
      if (state.classContext) {
        const c = state.classContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง: ${c.room}`),
          make("p", `ผู้สอน: ${c.lecturer} · กลุ่ม: ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปคาบเรียน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        const gasLink = make("a", "เปิดดูรูปถ่ายใน Apps Script ต้นฉบับ", "btn sm teal");
        gasLink.href = buildAppsScriptDeepLink(areaVal, discVal);
        gasLink.target = "_blank";
        gasLink.rel = "noopener";
        right.append(backBtn, gasLink);
        ctxBox.append(left, right);
      }
    }

    // Update top Apps Script deep-link button
    const topGasBtn = $("openAppsScriptRosterBtn");
    if (topGasBtn) {
      topGasBtn.href = buildAppsScriptDeepLink(areaVal, discVal);
    }

    // Filter students
    const list = ROSTER.students.filter((s) => {
      if (areaVal && s.area !== areaVal) return false;
      if (discVal && String(s.disc) !== discVal) return false;
      if (q) {
        const hay = `${s.id} ${s.fullName} ${s.nickname} ${s.area} ${s.advisor} discussion ${s.disc}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => (discVal ? compareTH(a.id, b.id) : compareTH(a.area, b.area) || compareTH(a.id, b.id)));
    state.visibleStudents = list;

    const selectionLabel = discVal
      ? `กลุ่มอภิปราย Discussion ${discVal}`
      : areaVal
      ? `กลุ่มพื้นที่ ${areaVal}`
      : "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้งหมด";

    if ($("studentStatusText")) {
      $("studentStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    if ($("printStudentsBtn")) {
      $("printStudentsBtn").disabled = list.length === 0;
    }

    // Print Heading (matches Apps Script 1-page A4 print header)
    const printHeading = $("printHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.classContext) {
        printHeading.append(
          make("div", state.classContext.topic),
          make("div", `${state.classContext.date} · ${state.classContext.time} · ${state.classContext.room}`)
        );
      }
    }

    const cardsEl = $("studentCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อนักศึกษาตามเงื่อนไขที่เลือก", "empty-state"));
      return;
    }

    let lastArea = null;
    list.forEach((s) => {
      if (!discVal && s.area !== lastArea) {
        lastArea = s.area;
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
        const h = make("div", null, "area-group-header");
        h.append(
          make("h3", `กลุ่มพื้นที่ ${s.area}${siteObj ? " (" + siteObj.hospital + " " + siteObj.province + ")" : ""}`),
          make("p", `อาจารย์ที่ปรึกษา: ${s.advisor}${siteObj ? " · ห้อง " + siteObj.room : ""}`)
        );
        cardsEl.appendChild(h);
      }

      const card = make("article", null, "student-card");
      const initials = studentInitials(s);
      const portrait = make("div", null, `student-portrait${state.showPhotos ? "" : " compact-avatar"}`);
      portrait.dataset.photoId = s.photoId || "";
      portrait.dataset.initials = initials;
      portrait.dataset.studentName = s.fullName;
      portrait.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      if (state.showPhotos && s.photoId) {
        if (photoObserver) photoObserver.observe(portrait);
        else mountStudentPhoto(portrait);
      }

      card.appendChild(portrait);
      card.appendChild(make("h3", s.nickname || s.fullName));
      if (s.nickname) card.appendChild(make("p", s.fullName));
      card.appendChild(make("p", `รหัส: ${s.id}${s.program === "MD-M.Eng" ? " (MD-M.Eng)" : ""}`, "sid-mono"));
      card.appendChild(make("p", `พื้นที่: ${s.area}`, "s-area"));
      card.appendChild(make("p", `Discussion: กลุ่มที่ ${s.disc}`, "disc-line"));
      cardsEl.appendChild(card);
    });
  }

  /* 1-Page A4 Auto-Fitting Print Layout (ported directly from Apps Script) */
  function computePrintLayout(count) {
    const cols = count <= 20 ? 4 : count <= 40 ? 5 : count <= 60 ? 6 : Math.ceil(Math.sqrt(count * 0.76));
    const rows = Math.max(1, Math.ceil(count / cols));
    const height = Math.min(58, (250 - (rows - 1) * 1.5) / rows);
    return {
      cols,
      rows,
      height,
      photo: state.showPhotos ? height * 0.54 : height * 0.28,
      title: Math.min(10.5, height * 0.23),
      text: Math.min(8, height * 0.18)
    };
  }

  function fitPrintRoster() {
    const layout = computePrintLayout(state.visibleStudents.length || 1);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--pc", String(layout.cols));
    rootStyle.setProperty("--pr", `${layout.height}mm`);
    rootStyle.setProperty("--pp", `${layout.photo}mm`);
    rootStyle.setProperty("--pt", `${layout.title}pt`);
    rootStyle.setProperty("--pb", `${layout.text}pt`);
  }

  async function printStudentRosterOnePage() {
    if (!state.visibleStudents.length) return;
    document.body.classList.add("print-students-mode");
    if (state.showPhotos) {
      document.querySelectorAll("#studentCardsContainer .student-portrait").forEach((box) => {
        if (!box.querySelector("img") && box.dataset.photoId) mountStudentPhoto(box);
      });
    }
    fitPrintRoster();
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    window.print();
  }

  /* ---------- Reader Utilities (Font Size & Lightbox & TOC) ---------- */
  function applyReaderFontSize(px) {
    const clamped = Math.min(21, Math.max(14, px));
    state.readerFontPx = clamped;
    localStorage.setItem("racm303_font_px", String(clamped));
    document.documentElement.style.setProperty("--reader-size", `${clamped}px`);
  }

  function wireFontButtons() {
    applyReaderFontSize(state.readerFontPx);
    document.querySelectorAll("[data-font-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = Number(btn.dataset.fontDelta);
        if (d === 0) applyReaderFontSize(16.5);
        else applyReaderFontSize(state.readerFontPx + d);
      });
    });
  }

  function attachProseEnhancements(proseContainer, tocContainer) {
    if (!proseContainer) return;
    // Build heading TOC
    if (tocContainer) {
      tocContainer.replaceChildren();
      const headings = proseContainer.querySelectorAll("h2, h3");
      headings.forEach((h, idx) => {
        if (!h.id) h.id = `sec-h-${idx}`;
        const li = document.createElement("li");
        const a = make("a", h.textContent.trim(), `toc-link${h.tagName === "H3" ? " toc-sub" : ""}`);
        a.href = `#${h.id}`;
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          h.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(a);
        tocContainer.appendChild(li);
      });
    }

    // Attach Lightbox to images
    proseContainer.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.classList.add("zoomable-img");
      img.addEventListener("click", () => openLightbox(img.src, img.alt || ""));
    });
  }

  function openLightbox(src, caption) {
    const lb = $("imageLightbox");
    if (!lb) return;
    $("lightboxImg").src = src;
    $("lightboxCaption").textContent = caption;
    lb.hidden = false;
  }

  /* ---------- Tab 3: 2569 Course Manual ---------- */
  function initManualControls() {
    const search = $("manualSearchInput");
    if (search) search.addEventListener("input", renderManualReader);
  }

  function renderManualReader() {
    const picker = $("manualChapterList");
    const prose = $("manualProseContainer");
    if (!picker || !prose) return;

    const chapters = MANUAL.chapters || [];
    if (!picker.dataset.rendered) {
      picker.dataset.rendered = "1";
      const allLi = document.createElement("li");
      const allBtn = make("button", "อ่านครบทั้งเล่มต่อเนื่อง (บทที่ 1–17 & ภาคผนวก)", "doc-picker-btn");
      allBtn.type = "button";
      allBtn.dataset.chId = "ALL";
      allBtn.addEventListener("click", () => {
        state.manualChapterId = "ALL";
        renderManualReader();
      });
      allLi.appendChild(allBtn);
      picker.appendChild(allLi);

      chapters.forEach((ch) => {
        const li = document.createElement("li");
        const btn = make("button", ch.title, "doc-picker-btn");
        btn.type = "button";
        btn.dataset.chId = ch.id;
        btn.addEventListener("click", () => {
          state.manualChapterId = ch.id;
          renderManualReader();
          prose.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(btn);
        picker.appendChild(li);
      });
    }

    picker.querySelectorAll(".doc-picker-btn").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.chId === state.manualChapterId ? "true" : "false");
    });

    const q = (($("manualSearchInput") && $("manualSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const selected = state.manualChapterId === "ALL" ? chapters : chapters.filter((c) => c.id === state.manualChapterId);
    const filtered = q
      ? selected.filter((c) => `${c.title} ${c.html.replace(/<[^>]+>/g, " ")}`.toLocaleLowerCase("th").includes(q))
      : selected;

    if (!filtered.length) {
      prose.innerHTML = `<div class="empty-state">ไม่พบหัวข้อในคู่มือที่ตรงกับคำค้นหา “${escapeHtml(q)}”</div>`;
      return;
    }

    const intro = state.manualChapterId === "ALL" && !q && MANUAL.introHtml ? MANUAL.introHtml + "<hr class='doc-divider'>" : "";
    prose.innerHTML = intro + filtered.map((c) => `<section id="${escapeHtml(c.id)}">${c.html}</section>`).join("<hr class='doc-divider'>");
    attachProseEnhancements(prose, null);
  }

  /* ---------- Tab 4: HS1–HS6 Guided Learning Textbooks & Workbooks ---------- */
  function openTextbookDoc(docId) {
    state.activeDocId = docId;
    switchTab("textbooks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTextbooksControls() {
    const expandAllBtn = $("toggleAllAnswersBtn");
    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", () => {
        const prose = $("textbookProseContainer");
        if (!prose) return;
        const detailsList = [...prose.querySelectorAll("details")];
        const anyClosed = detailsList.some((d) => !d.open);
        detailsList.forEach((d) => (d.open = anyClosed));
        expandAllBtn.textContent = anyClosed ? "ซ่อนแนวคำตอบทั้งหมด" : "เปิดแนวคำตอบทั้งหมด";
      });
    }
  }

  function renderTextbookReader() {
    const picker = $("textbookDocList");
    const toc = $("textbookHeadingToc");
    const prose = $("textbookProseContainer");
    const metaTitle = $("activeTextbookMeta");
    const gdocBtn = $("activeTextbookGdocBtn");
    if (!picker || !prose) return;

    const docs = HS.docs || [];
    if (!picker.dataset.rendered) {
      picker.dataset.rendered = "1";
      docs.forEach((doc) => {
        const li = document.createElement("li");
        const btn = make("button", `${doc.badge} · ${doc.title}`, "doc-picker-btn");
        btn.type = "button";
        btn.dataset.docId = doc.id;
        btn.addEventListener("click", () => {
          state.activeDocId = doc.id;
          renderTextbookReader();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        li.appendChild(btn);
        picker.appendChild(li);
      });
    }

    picker.querySelectorAll(".doc-picker-btn").forEach((b) => {
      b.setAttribute("aria-current", b.dataset.docId === state.activeDocId ? "true" : "false");
    });

    const current = docs.find((d) => d.id === state.activeDocId) || docs[0];
    if (!current) return;

    if (metaTitle) {
      metaTitle.textContent = `${current.badge} — ${current.sessionInfo || current.subtitle || ""}`;
    }
    if (gdocBtn) {
      if (current.docUrl) {
        gdocBtn.href = current.docUrl;
        gdocBtn.hidden = false;
      } else {
        gdocBtn.hidden = true;
      }
    }

    prose.innerHTML = current.html;
    attachProseEnhancements(prose, toc);
  }

  /* ---------- Tab 5: Rapid Review, 111 Flashcards & 82 Self-Check Q&A ---------- */
  function initPracticeControls() {
    document.querySelectorAll("[data-practice-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.practiceSub = btn.dataset.practiceSub;
        document.querySelectorAll("[data-practice-sub]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.practiceSub === state.practiceSub ? "true" : "false")
        );
        renderPracticeCurrent();
      });
    });

    ["practiceModuleFilter", "practiceSearchInput"].forEach((id) => {
      if ($(id)) $(id).addEventListener("input", renderPracticeCurrent);
      if ($(id)) $(id).addEventListener("change", renderPracticeCurrent);
    });

    if ($("shuffleFlashcardsBtn")) {
      $("shuffleFlashcardsBtn").addEventListener("click", () => {
        state.fcShuffleSeed = Date.now();
        renderFlashcards();
      });
    }
  }

  function renderPracticeCurrent() {
    $("practiceRapidWrap").hidden = state.practiceSub !== "rapid";
    $("practiceFlashcardsWrap").hidden = state.practiceSub !== "flashcards";
    $("practiceQaWrap").hidden = state.practiceSub !== "qa";
    if ($("shuffleFlashcardsBtn")) $("shuffleFlashcardsBtn").hidden = state.practiceSub !== "flashcards";

    if (state.practiceSub === "rapid") renderRapidReview();
    if (state.practiceSub === "flashcards") renderFlashcards();
    if (state.practiceSub === "qa") renderSelfCheckQa();
  }

  function renderRapidReview() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const container = $("practiceRapidWrap");
    if (!container) return;

    const items = (HS.rapidReview || []).filter((r) => {
      if (mod && r.module !== mod) return false;
      if (q && !`${r.module} ${r.moduleTitle} ${r.html}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `ตารางทบทวนเร็ว (High-Yield Rapid Review) · แสดง ${items.length} บทเรียน`;
    }

    container.innerHTML = items.length
      ? items
          .map(
            (r) => `
        <article class="data-card editorial-prose">
          <h3><span class="badge cat-HS" style="margin-right:8px">${escapeHtml(r.module)}</span>${escapeHtml(r.moduleTitle)}</h3>
          ${r.html}
        </article>`
          )
          .join("")
      : `<div class="empty-state">ไม่พบตารางทบทวนเร็วที่ตรงกับคำค้นหา</div>`;
  }

  function renderFlashcards() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const grid = $("flashcardsGrid");
    if (!grid) return;

    let cards = (HS.glossary || []).filter((g) => {
      if (mod && g.module !== mod) return false;
      if (q && !`${g.termTH} ${g.termEN} ${g.definition}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if (state.fcShuffleSeed) {
      cards = [...cards].sort((a, b) => ((a.id.charCodeAt(4) * 31 + state.fcShuffleSeed) % 97) - ((b.id.charCodeAt(4) * 31 + state.fcShuffleSeed) % 97));
    }

    const masteredCount = (HS.glossary || []).filter((g) => state.masteredCards.has(g.id)).length;
    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `บัตรคำศัพท์สำคัญ ${cards.length} คำ · จำแม่นแล้ว ${masteredCount} / ${(HS.glossary || []).length} คำ`;
    }

    grid.replaceChildren();
    if (!cards.length) {
      grid.appendChild(make("div", "ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข", "empty-state"));
      return;
    }

    cards.forEach((g) => {
      const card = make("article", null, `flashcard${state.masteredCards.has(g.id) ? " is-mastered" : ""}`);
      const top = make("div");
      const headRow = make("div", null, "fc-top");
      headRow.append(
        make("span", g.module, "badge cat-HS"),
        make("span", state.masteredCards.has(g.id) ? "จำแม่นแล้ว" : "คลิกเพื่อพลิกดูนิยาม", "badge")
      );
      top.append(headRow, make("h3", g.termTH || g.termFull, "fc-term-th"));
      if (g.termEN) top.appendChild(make("p", g.termEN, "fc-term-en"));

      const def = make("div", g.definition, "fc-def");
      def.hidden = true;
      top.appendChild(def);

      const actions = make("div", null, "fc-actions");
      const flipBtn = make("button", "ดูความหมาย", "btn sm");
      flipBtn.type = "button";
      flipBtn.addEventListener("click", () => {
        def.hidden = !def.hidden;
        card.classList.toggle("is-flipped", !def.hidden);
        flipBtn.textContent = def.hidden ? "ดูความหมาย" : "ซ่อนความหมาย";
      });

      const masterBtn = make("button", state.masteredCards.has(g.id) ? "จำได้แล้ว ✓" : "ทำเครื่องหมายว่าจำได้", "btn sm teal");
      masterBtn.type = "button";
      masterBtn.addEventListener("click", () => {
        if (state.masteredCards.has(g.id)) state.masteredCards.delete(g.id);
        else state.masteredCards.add(g.id);
        localStorage.setItem("racm303_mastered_fc", JSON.stringify([...state.masteredCards]));
        renderFlashcards();
      });

      actions.append(flipBtn, masterBtn);
      card.append(top, actions);
      grid.appendChild(card);
    });
  }

  function renderSelfCheckQa() {
    const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
    const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const wrap = $("practiceQaWrap");
    if (!wrap) return;

    const items = (HS.selfCheck || []).filter((item) => {
      if (mod && item.module !== mod) return false;
      if (q && !`${item.question} ${item.answerHtml}`.toLocaleLowerCase("th").includes(q)) return false;
      return true;
    });

    if ($("practiceStatusText")) {
      $("practiceStatusText").textContent = `คลังคำถามทบทวนตนเอง (Active Recall Q&A) · แสดง ${items.length} ข้อ จากทั้งหมด ${(HS.selfCheck || []).length} ข้อ`;
    }

    wrap.replaceChildren();
    if (!items.length) {
      wrap.appendChild(make("div", "ไม่พบโจทย์คำถามที่ตรงกับคำค้นหา", "empty-state"));
      return;
    }

    items.forEach((item) => {
      const card = make("article", null, "qa-card");
      card.appendChild(make("span", `${item.module} · ข้อที่ ${item.num}`, "badge cat-HS"));
      card.appendChild(make("h3", item.question, "qa-question"));

      const scratch = make("textarea", null, "qa-scratch");
      scratch.placeholder = "ลองพิมพ์ร่างคำตอบด้วยตนเองสั้นๆ ก่อนเปิดดูแนวคำตอบ (Retrieval Practice)…";
      card.appendChild(scratch);

      const ansBox = make("div", null, "qa-answer");
      ansBox.innerHTML = item.answerHtml;
      ansBox.hidden = true;

      const btn = make("button", "ดูแนวคำตอบ", "btn sm teal");
      btn.type = "button";
      btn.addEventListener("click", () => {
        ansBox.hidden = !ansBox.hidden;
        btn.textContent = ansBox.hidden ? "ดูแนวคำตอบ" : "ซ่อนแนวคำตอบ";
      });

      card.append(btn, ansBox);
      wrap.appendChild(card);
    });
  }

  /* ---------- Faculty Tab 6: Schedule Audit, Apps Script Sync & Sign-Off ---------- */
  function renderAuditView() {
    const wrap = $("auditContentContainer");
    if (!wrap || wrap.dataset.rendered) return;
    wrap.dataset.rendered = "1";

    const auditCards = (SCHED.auditItems || [])
      .map(
        (a, idx) => `
      <div class="audit-card">
        <h4>${idx + 1}. ${escapeHtml(a.session)}</h4>
        <p><strong>ประเด็นที่พบ:</strong> ${escapeHtml(a.issue)}</p>
        <p><strong>ข้อเสนอดำเนินการ:</strong> ${escapeHtml(a.action)}</p>
      </div>`
      )
      .join("");

    const reconRows = (ROSTER.appsScriptReconciliation || [])
      .map(
        (r) => `
      <tr>
        <td><strong>${escapeHtml(r.rows)}</strong><br><small>${escapeHtml(r.topic)}</small></td>
        <td>${escapeHtml(r.inSheetV1)}</td>
        <td><strong>${escapeHtml(r.revisedFix)}</strong></td>
      </tr>`
      )
      .join("");

    const fixedBlocks = (SCHED.fixedSummary || [])
      .map(
        (f) => `
      <div class="data-card">
        <h3>${escapeHtml(f.title)}</h3>
        <ul>${f.items.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>
      </div>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="data-card" style="border-color:var(--amber-line);background:#fffdf8">
        <h3>ส่วนที่ 1: ประเด็น [รอยืนยัน] ก่อนประกาศใช้ตารางสอนและคู่มือปีการศึกษา 2569 (7 รายการ)</h3>
        <div class="audit-grid">${auditCards}</div>
      </div>

      <div class="data-card">
        <div class="section-header" style="margin-bottom:12px">
          <div>
            <h3 style="margin:0">ส่วนที่ 2: การเชื่อมโยงและอัปเดตฐานข้อมูล Google Apps Script (schedule-racm303-v1)</h3>
            <p style="margin:4px 0 0;font-size:14px;color:var(--muted)">เปรียบเทียบข้อมูลในชีต <code>schedule-racm303-v1</code> กับตารางฉบับปรับปรุง พร้อมไฟล์ CSV โครงสร้าง 16 คอลัมน์ที่แก้ครบทุกจุดแล้วสำหรับนำไปวางทับใน Google Sheet ได้ทันที</p>
          </div>
          <div class="header-actions">
            <a class="btn teal sm" href="${escapeHtml(ROSTER.revisedCsvPath)}" download>ดาวน์โหลด CSV อัปเดตชีต (v2)</a>
            <a class="btn sm" href="${escapeHtml(ROSTER.appsScriptSheetUrl)}" target="_blank" rel="noopener">เปิด Google Sheet ต้นฉบับ</a>
            <a class="btn sm" href="${escapeHtml(ROSTER.appsScriptUrl)}" target="_blank" rel="noopener">เปิด Apps Script Web App</a>
          </div>
        </div>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>แถวข้อมูล / คาบเรียน</th>
                <th>ข้อมูลเดิมใน schedule-racm303-v1</th>
                <th>ข้อมูลที่ปรับปรุงแล้วในพอร์ทัลและไฟล์ CSV (v2)</th>
              </tr>
            </thead>
            <tbody>${reconRows}</tbody>
          </table>
        </div>
      </div>

      <div class="data-card editorial-prose">
        <h3>ส่วนที่ 3: รายการตรวจสอบก่อนลงนามประกาศใช้คู่มือรายวิชา RACM 303 ปีการศึกษา 2569</h3>
        ${MANUAL.verifySection ? MANUAL.verifySection.html : ""}
      </div>

      ${fixedBlocks}`;
  }

  /* ---------- Faculty Tab 7: Teacher Guides, Revision Notes & Canonical Drive Directory ---------- */
  function initFacultyDocsControls() {
    document.querySelectorAll("[data-fac-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.facultySub = btn.dataset.facSub;
        document.querySelectorAll("[data-fac-sub]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.facSub === state.facultySub ? "true" : "false")
        );
        renderFacultyDocsView();
      });
    });
  }

  function renderFacultyDocsView() {
    const guidesWrap = $("facultyGuidesReaderWrap");
    const linksWrap = $("facultyLinksDirectoryWrap");
    if (!guidesWrap || !linksWrap) return;

    guidesWrap.hidden = state.facultySub !== "guides";
    linksWrap.hidden = state.facultySub !== "links";

    if (state.facultySub === "guides") {
      const picker = $("facultyDocList");
      const toc = $("facultyDocToc");
      const prose = $("facultyProseContainer");
      const docs = FACULTY.docs || [];

      if (picker && !picker.dataset.rendered) {
        picker.dataset.rendered = "1";
        docs.forEach((d) => {
          const li = document.createElement("li");
          const b = make("button", d.title, "doc-picker-btn");
          b.type = "button";
          b.dataset.fdocId = d.id;
          b.addEventListener("click", () => {
            state.activeFacultyDocId = d.id;
            renderFacultyDocsView();
          });
          li.appendChild(b);
          picker.appendChild(li);
        });
      }
      if (picker) {
        picker.querySelectorAll(".doc-picker-btn").forEach((b) =>
          b.setAttribute("aria-current", b.dataset.fdocId === state.activeFacultyDocId ? "true" : "false")
        );
      }
      const cur = docs.find((d) => d.id === state.activeFacultyDocId) || docs[0];
      if (cur && prose) {
        prose.innerHTML = cur.html;
        attachProseEnhancements(prose, toc);
      }
    } else if (!linksWrap.dataset.rendered) {
      linksWrap.dataset.rendered = "1";
      const groups = new Map();
      (FACULTY.links || []).forEach((l) => {
        const cat = l.category || "ลิงก์เอกสาร";
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(l);
      });
      let html = "";
      groups.forEach((items, cat) => {
        html += `<div class="data-card"><h3>${escapeHtml(cat)}</h3><div class="links-grid">`;
        items.forEach((it) => {
          html += `
            <div class="link-card">
              <div>
                <h4>${escapeHtml(it.title)}</h4>
                <p>${escapeHtml(it.note || "")}</p>
              </div>
              <div><a class="btn sm primary" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">เปิดลิงก์ต้นฉบับ</a></div>
            </div>`;
        });
        html += `</div></div>`;
      });
      linksWrap.innerHTML = html;
    }
  }

  /* ---------- Bootstrap ---------- */
  function init() {
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    const lb = $("imageLightbox");
    if (lb) {
      lb.addEventListener("click", (e) => {
        if (e.target === lb || e.target.id === "closeLightboxBtn") lb.hidden = true;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lb.hidden) lb.hidden = true;
      });
    }

    wireFontButtons();
    initPersonalizer();
    initScheduleControls();
    initStudentsControls();
    initManualControls();
    initTextbooksControls();
    initPracticeControls();
    if (ROLE === "faculty") initFacultyDocsControls();

    // Parse URL hash or query parameters (compatible with Apps Script ?page=students&type=...&group=...)
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "students") {
      const t = params.get("type");
      const g = params.get("group") || "";
      if (t === "discussion" && $("studentDiscFilter")) $("studentDiscFilter").value = g;
      if (t === "area" && $("studentAreaFilter")) $("studentAreaFilter").value = g;
      switchTab("students", false);
      return;
    }

    const hash = (window.location.hash || "").replace(/^#/, "");
    switchTab(hash || "schedule", false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
