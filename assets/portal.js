/* ==========================================================================
   RACM 303 (ปีการศึกษา 2569) — Faculty & Coordinator Portal Controller
   Google Calendar & Apple iCal Views · Per-Group & Per-Student Fieldwork Sync
   One-Time (.ics / .csv) Downloads & Live Hosted Subscribe (.ics / webcal://)
   ========================================================================== */
(function () {
  "use strict";

  const ROLE = "faculty";
  const PORTAL_BASE_URL = "https://smartwoo.github.io/racm303-2569-faculty";
  const RAMED_COURSE_URL = "https://elearning.ra.mahidol.ac.th/ramed/course/view.php?id=398";
  const RAMED_ASSIGN_INDEX_URL = "https://elearning.ra.mahidol.ac.th/ramed/mod/assign/index.php?id=398";
  const RAMED_LOGIN_URL = "https://elearning.ra.mahidol.ac.th/ramed/login/index.php";
  const RAMED_BASE_PREFIX = "https://elearning.ra.mahidol.ac.th/ramed/";
  const GOOGLE_FORM_URL = "https://forms.gle/1Gsg2SmSfuuEwmcE9";
  const SCHED = window.RACM_SCHEDULE_DATA || {};
  const ROSTER = window.RACM_ROSTER_DATA || { students: [], courseTeachers: [] };
  const MANUAL = window.RACM_MANUAL_DATA || { chapters: [] };
  const HS = window.RACM_HS_DATA || { docs: [], rapidReview: [], glossary: [], selfCheck: [] };
  const HSD_DATA = window.RACM_HS_DISCUSSION_DATA || { modules: [], cases: [] };
  const HSD_KEY = window.RACM_HS_DISCUSSION_KEY || { facilitationPlans: {}, keys: {} };
  const FACULTY = window.RACM_FACULTY_DATA || { docs: [], links: [] };

  const $ = (id) => document.getElementById(id);
  const compareTH = (a, b) => String(a || "").localeCompare(String(b || ""), "th", { numeric: true });

  const WEEK_BOUNDS = [
    { week: 1, start: "2026-11-23", end: "2026-11-29", label: "สัปดาห์ที่ 1 · 23–29 พ.ย. 2569 (เปิดรายวิชา · HS1 · EP1–3)" },
    { week: 2, start: "2026-11-30", end: "2026-12-06", label: "สัปดาห์ที่ 2 · 30 พ.ย. – 6 ธ.ค. 2569 (HS2–HS6 · EP4–9)" },
    { week: 3, start: "2026-12-07", end: "2026-12-13", label: "สัปดาห์ที่ 3 · 7–13 ธ.ค. 2569 (สอบ EP · เดินทางสู่ภาคสนามตามกลุ่ม)" },
    { week: 4, start: "2026-12-14", end: "2026-12-20", label: "สัปดาห์ที่ 4 · 14–20 ธ.ค. 2569 (ฝึกปฏิบัติงานภาคสนาม 9 พื้นที่)" },
    { week: 5, start: "2026-12-21", end: "2026-12-27", label: "สัปดาห์ที่ 5 · 21–27 ธ.ค. 2569 (สอบ HS · สังเคราะห์ข้อมูลภาคสนาม)" },
    { week: 6, start: "2026-12-28", end: "2027-01-03", label: "สัปดาห์ที่ 6 · 28 ธ.ค. 2569 – 3 ม.ค. 2570 (นำเสนอภาคสนาม & ปิดรายวิชา)" }
  ];

  const TH_MONTHS_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const TH_DOW_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
  const TH_DOW_FULL = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

  const CAT_NAMES = {
    HS: "วิทยาศาสตร์ระบบสุขภาพ (HS)",
    EP: "ระบาดวิทยาคลินิกและชุมชน (EP)",
    SG: "กลุ่มย่อย & ภาคสนาม",
    PANEL: "เสวนา / ปฏิบัติการเชิงระบบ",
    EXAM: "การสอบ & กำหนดส่งงาน",
    HOLIDAY: "วันหยุดราชการ",
    STAFF: "เตรียมความพร้อมภาควิชาฯ"
  };

  const state = {
    activeTab: "schedule",
    schedSub: "month", // month | week | daily | spec
    calScope: "student", // student | group | teacher | all
    calWeek: 1,
    practiceSub: "rapid",
    facultySub: "guides",
    hsdModule: "ALL",
    hsdViewMode: localStorage.getItem("racm303_hsd_vmode") || "slide",
    hsdSlideIdx: 0,
    hsdHideScenario: false,
    hsdTheater: false,
    hsdFacultyMode: "teacher", // teacher | projector | student
    hsdDrafts: JSON.parse(localStorage.getItem("racm303_hs_disc_drafts_v1") || "{}"),
    hsdRevealedKeys: new Set(),
    myStudent: null,
    discContext: null,
    fieldContext: null,
    showPhotos: true,
    calSideTab: "milestones",
    showCalSidebar: true,
    showSitesOverview: true,
    showZoomDrawer: false,
    visibleDiscStudents: [],
    visibleFieldStudents: [],
    submittedMap: JSON.parse(localStorage.getItem("racm303_submitted_map") || "{}"),
    pinnedRamedUrl: localStorage.getItem("racm303_moodle_course_url") || "",
    ramedPinged: false,
    inspectedPdfBytes: null,
    inspectedPdfOrigName: "",
    manualChapterId: "ALL",
    activeDocId: "HS1",
    activeFacultyDocId: "hs-disc-teacher-key",
    readerFontPx: Number(localStorage.getItem("racm303_font_px")) || 16.5,
    readerViewMode: "scroll", // scroll | deck | sorter
    sorterZoomPct: Number(localStorage.getItem("racm303_sorter_zoom")) || 100,
    canvasZoomPct: Number(localStorage.getItem("racm303_canvas_zoom")) || 100,
    discViewMode: "cards", // cards | deck | sorter | table
    fieldViewMode: "cards", // cards | deck | sorter | table
    rosterZoomPct: Number(localStorage.getItem("racm303_roster_zoom")) || 100,
    discDeckIdx: 0,
    fieldDeckIdx: 0,
    adminSortField: "id",
    adminSortAsc: true,
    myTeacherKey: localStorage.getItem("racm303_my_teacher") || "",
    conciergeDateISO: "",
    conciergeOpen: localStorage.getItem("racm303_concierge_tab_open") === "1",
    conciergeTab: "today",
    conciergeTeacherAllDays: false,
    mapInspectorStyle: "formation",
    ramedLoginId: localStorage.getItem("racm303_login_uid") || "",
    fieldOverviewStyle: "map", // map | cards
    mapHoverSite: "",
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

  function getSiteIdByAreaName(areaName) {
    const found = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaName);
    return found ? found.id : 1;
  }

  /* ---------- Date & Time Helpers ---------- */
  function parseISODate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function formatISODate(dt) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDaysISO(iso, delta) {
    const dt = parseISODate(iso);
    dt.setUTCDate(dt.getUTCDate() + delta);
    return formatISODate(dt);
  }

  function formatThaiShortDate(iso, forceMonth) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (forceMonth || d === 1 || (m === 11 && d === 25)) {
      return `${d} ${TH_MONTHS_SHORT[m]}${y === 2027 ? " 70" : ""}`;
    }
    return String(d);
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || "09:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function to12HourAmPm(hhmm) {
    const [hRaw, mRaw] = String(hhmm || "09:00").split(":").map(Number);
    const h = Number.isFinite(hRaw) ? hRaw : 9;
    const m = Number.isFinite(mRaw) ? mRaw : 0;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function isoToUsDate(iso) {
    const [y, m, d] = String(iso).split("-");
    return `${m}/${d}/${y}`;
  }

  function setBtnLabel(btn, text) {
    if (!btn) return;
    const span = btn.querySelector ? btn.querySelector("[data-btn-label]") : null;
    if (span) span.textContent = text;
    else btn.textContent = text;
  }

  function copyTextWithFeedback(text, btn, doneLabel = "คัดลอกแล้ว ✓") {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const span = btn.querySelector ? btn.querySelector("[data-btn-label]") : null;
      const prev = span ? span.textContent : btn.textContent;
      if (span) span.textContent = doneLabel;
      else btn.textContent = doneLabel;
      setTimeout(() => {
        if (span) span.textContent = prev;
        else btn.textContent = prev;
      }, 1500);
    });
  }

  function printWithCleanTitle(tempTitle) {
    document.body.classList.remove("print-students-mode", "print-disc-mode", "print-single-hsd-case");
    const prevTitle = document.title;
    if (tempTitle) document.title = tempTitle;
    window.print();
    if (tempTitle) {
      setTimeout(() => {
        document.title = prevTitle;
      }, 600);
    }
  }

  /* ---------- Client-Side Genuine OpenXML (.docx) Stored-ZIP Exporter (for Filtered Views) ---------- */
  const CRC32_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  function crc32Bytes(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildStoredZipBlob(entries, mimeType) {
    const enc = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach((entry) => {
      const nameBytes = enc.encode(entry.name);
      const dataBytes = entry.bytes instanceof Uint8Array ? entry.bytes : enc.encode(String(entry.content || ""));
      const crc = crc32Bytes(dataBytes);
      const size = dataBytes.length;

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
      lv.setUint16(8, 0, true); // STORE (uncompressed)
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0x5774, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x5774, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);

      localParts.push(local, dataBytes);
      centralParts.push(central);
      offset += local.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce((acc, b) => acc + b.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], { type: mimeType });
  }

  function escXml(str) {
    return String(str || "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wRunXml(text, opts = {}) {
    const t = escXml(text);
    if (!t) return "";
    const rPr = [
      `<w:rFonts w:ascii="Sarabun" w:hAnsi="Sarabun" w:cs="Sarabun" w:eastAsia="Sarabun"/>`,
      opts.bold ? "<w:b/><w:bCs/>" : "",
      opts.color ? `<w:color w:val="${opts.color}"/>` : "",
      opts.sz ? `<w:sz w:val="${opts.sz}"/><w:szCs w:val="${opts.sz}"/>` : `<w:sz w:val="23"/><w:szCs w:val="23"/>`
    ].join("");
    return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
  }

  function wParaXml(runsXml, spaceBefore = 60, spaceAfter = 100) {
    return `<w:p><w:pPr><w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="290" w:lineRule="auto"/></w:pPr>${runsXml}</w:p>`;
  }

  function domNodeToWordBlocks(rootNode) {
    const out = [];
    const extractCellText = (el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll("textarea, button, svg, script, style").forEach((n) => n.remove());
      return clone.textContent.replace(/\s+/g, " ").trim();
    };
    const walk = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (node.hidden || (node.classList && node.classList.contains("hsd-no-print"))) return;
      const tag = String(node.tagName || "").toUpperCase();
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "BUTTON" || tag === "SVG" || tag === "TEXTAREA") return;
      if (tag === "H1" || tag === "H2") {
        out.push(wParaXml(wRunXml(node.textContent.trim(), { bold: true, sz: 30, color: "002D72" }), 220, 100));
      } else if (tag === "H3" || tag === "H4") {
        out.push(wParaXml(wRunXml(node.textContent.trim(), { bold: true, sz: 25, color: "0F766E" }), 160, 80));
      } else if (tag === "H5" || tag === "H6") {
        out.push(wParaXml(wRunXml(node.textContent.trim(), { bold: true, sz: 23, color: "1E293B" }), 120, 60));
      } else if (tag === "P" || tag === "BLOCKQUOTE" || tag === "FIGCAPTION") {
        const txt = node.textContent.replace(/\s+/g, " ").trim();
        if (txt) out.push(wParaXml(wRunXml(txt, { sz: tag === "FIGCAPTION" ? 19 : 23, color: tag === "FIGCAPTION" ? "475569" : "162238" }), 40, 100));
      } else if (tag === "UL" || tag === "OL") {
        const isOrdered = tag === "OL";
        [...node.children].forEach((li, idx) => {
          if (String(li.tagName || "").toUpperCase() !== "LI") return;
          const prefix = isOrdered ? `${idx + 1}. ` : "• ";
          const txt = li.textContent.replace(/\s+/g, " ").trim();
          if (txt) out.push(wParaXml(wRunXml(prefix + txt, { sz: 23 }), 30, 60));
        });
      } else if (tag === "TABLE") {
        const rows = [...node.querySelectorAll("tr")];
        if (!rows.length) return;
        const trXml = rows
          .map((tr, rIdx) => {
            const cells = [...tr.querySelectorAll("th, td")];
            if (!cells.length) return "";
            const isHead = rIdx === 0 || cells.every((c) => String(c.tagName || "").toUpperCase() === "TH");
            const tcXml = cells
              .map((cell) => {
                const txt = extractCellText(cell);
                const shd = isHead ? `<w:shd w:val="clear" w:color="auto" w:fill="E8EEF7"/>` : "";
                return `<w:tc><w:tcPr>${shd}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>${wParaXml(
                  wRunXml(txt, { bold: isHead, sz: 20, color: isHead ? "00245C" : "162238" }),
                  20,
                  20
                )}</w:tc>`;
              })
              .join("");
            return `<w:tr>${tcXml}</w:tr>`;
          })
          .join("");
        out.push(
          `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>` +
            `<w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>` +
            `<w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>` +
            `<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>` +
            `<w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>` +
            `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
            `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
            `</w:tblBorders></w:tblPr>${trXml}</w:tbl>`
        );
      } else {
        [...node.children].forEach(walk);
      }
    };
    [...rootNode.children].forEach(walk);
    return out.join("");
  }

  function downloadHtmlAsGenuineDocx(title, subtitle, htmlString, filename) {
    const holder = document.createElement("div");
    holder.innerHTML = htmlString;
    const bodyXml =
      wParaXml(wRunXml(title, { bold: true, sz: 34, color: "002D72" }), 0, 80) +
      (subtitle ? wParaXml(wRunXml(subtitle, { bold: true, sz: 21, color: "475569" }), 0, 180) : "") +
      domNodeToWordBlocks(holder) +
      `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020"/></w:sectPr>`;

    const entries = [
      {
        name: "[Content_Types].xml",
        content:
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
          `</Types>`
      },
      {
        name: "_rels/.rels",
        content:
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
          `</Relationships>`
      },
      {
        name: "word/document.xml",
        content:
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
      }
    ];

    const blob = buildStoredZipBlob(
      entries,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  /* ---------- Student Portrait Loader ---------- */
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
      }, { rootMargin: "220px" })
    : null;

  function mountStudentPhoto(box) {
    const sid = box.dataset.studentId || "";
    const pid = box.dataset.photoId || "";
    const initials = box.dataset.initials || "นศ";
    const sLabel = box.dataset.studentName || initials;
    if (!sid && !pid) {
      box.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
      return;
    }
    const img = document.createElement("img");
    img.alt = box.dataset.studentName || "รูปนักศึกษา";
    img.loading = "lazy";
    img.decoding = "async";
    if (sid) {
      img.src = `assets/photos/${encodeURIComponent(sid)}.jpg`;
      img.onerror = () => {
        if (pid && !img.dataset.triedDrive) {
          img.dataset.triedDrive = "1";
          img.referrerPolicy = "no-referrer";
          img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
          return;
        }
        box.innerHTML = `<span class="avatar-monogram" title="${escapeHtml(sLabel)}">${escapeHtml(initials)}</span>`;
      };
    } else {
      img.referrerPolicy = "no-referrer";
      img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(pid)}&sz=w320`;
      img.onerror = () => {
        box.innerHTML = `<span class="avatar-monogram" title="${escapeHtml(sLabel)}">${escapeHtml(initials)}</span>`;
      };
    }
    box.replaceChildren(img);
  }

  /* ---------- Student Nickname Store, Live Sheet Sync & Display Formatter ---------- */
  const NICKNAME_OVERRIDES_KEY = "racm303_nicknames_v1";
  const SHEET_NICKNAMES_CACHE_KEY = "racm303_sheet_nicknames_v1";

  function loadJsonMapSafe(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  let nicknameOverridesCache = loadJsonMapSafe(NICKNAME_OVERRIDES_KEY);
  let sheetNicknamesCache = loadJsonMapSafe(SHEET_NICKNAMES_CACHE_KEY);

  function cleanNicknameValue(raw) {
    const v = String(raw == null ? "" : raw).trim();
    if (!v || v === "~" || v === "-" || v === "—") return "";
    return v;
  }

  function getEffectiveNickname(s) {
    if (!s) return "";
    return (
      cleanNicknameValue(nicknameOverridesCache[s.id]) ||
      cleanNicknameValue(sheetNicknamesCache[s.id]) ||
      cleanNicknameValue(s.nickname)
    );
  }

  function saveStudentNicknameOverride(sid, rawNick) {
    if (!sid) return;
    const cleaned = cleanNicknameValue(rawNick);
    if (cleaned) nicknameOverridesCache[sid] = cleaned;
    else delete nicknameOverridesCache[sid];
    try {
      localStorage.setItem(NICKNAME_OVERRIDES_KEY, JSON.stringify(nicknameOverridesCache));
    } catch (_) {}
    const stu = (ROSTER.students || []).find((x) => x.id === sid);
    if (stu) stu.nickname = getEffectiveNickname(stu);
    try {
      const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("racm303_live_sync") : null;
      if (ch) {
        ch.postMessage({ kind: "nicknames_updated" });
        ch.close();
      }
    } catch (_) {}
  }

  // Hydrate in-memory roster with any cached/saved nicknames immediately
  (ROSTER.students || []).forEach((s) => {
    const eff = getEffectiveNickname(s);
    if (eff) s.nickname = eff;
  });

  function getStudentNameParts(s) {
    const nick = getEffectiveNickname(s);
    const cleanFull = String((s && (s.name || s.fullName)) || "").trim();
    if (nick) {
      return {
        lead: nick,
        paren: cleanFull ? `(${cleanFull})` : "",
        hasNick: true
      };
    }
    const spIdx = cleanFull.indexOf(" ");
    if (spIdx > 0) {
      const first = cleanFull.slice(0, spIdx).trim();
      const rest = cleanFull.slice(spIdx + 1).trim();
      return {
        lead: first,
        paren: rest ? `(${rest})` : "",
        hasNick: false
      };
    }
    return {
      lead: cleanFull,
      paren: "",
      hasNick: false
    };
  }

  function parseSimpleCsvRows(csvText) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      if (inQuotes) {
        if (ch === '"' && csvText[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
    if (cur.length || row.length) {
      row.push(cur.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows;
  }

  async function syncLiveNicknamesFromGoogleSheet() {
    if (typeof fetch !== "function") return;
    try {
      const url = "https://docs.google.com/spreadsheets/d/19ShqCzyAH7vJm1Ssph_Loer3Yh2WwfhnFD_XGFmqv_Q/gviz/tq?tqx=out:csv&sheet=Group%20Name";
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp || !resp.ok) return;
      const csv = await resp.text();
      const rows = parseSimpleCsvRows(csv);
      if (rows.length < 2) return;
      const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
      const idIdx = Math.max(0, header.findIndex((h) => h.includes("id")));
      const nickIdx = header.findIndex((h) => h.includes("nick") || h.includes("ชื่อเล่น"));
      if (nickIdx < 0) return;
      let updatedCount = 0;
      const freshMap = {};
      for (let r = 1; r < rows.length; r++) {
        const rawId = String(rows[r][idIdx] || "").replace(/\.0$/, "").trim();
        const rawNick = cleanNicknameValue(rows[r][nickIdx]);
        if (/^\d{7}$/.test(rawId) && rawNick) {
          freshMap[rawId] = rawNick;
        }
      }
      if (Object.keys(freshMap).length > 0) {
        sheetNicknamesCache = { ...sheetNicknamesCache, ...freshMap };
        try {
          localStorage.setItem(SHEET_NICKNAMES_CACHE_KEY, JSON.stringify(sheetNicknamesCache));
        } catch (_) {}
        (ROSTER.students || []).forEach((s) => {
          const next = getEffectiveNickname(s);
          if (next && next !== s.nickname) {
            s.nickname = next;
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          if (state.activeTab === "discussion") renderDiscussionView();
          else if (state.activeTab === "fieldwork") renderFieldworkView();
          if (typeof renderRoleConcierge === "function") renderRoleConcierge();
        }
      }
    } catch (_) {
      // Silent fallback if offline
    }
  }

  /* ---------- Student Lookup & Personalization Sync ---------- */
  function findStudentByQuery(rawVal) {
    const q = String(rawVal || "").trim().toLocaleLowerCase("th");
    if (!q) return null;
    const m = q.match(/^(\d{7})\b/);
    if (m) {
      const byId = ROSTER.students.find((s) => s.id === m[1]);
      if (byId) return byId;
    }
    return (
      ROSTER.students.find((s) => {
        const nick = getEffectiveNickname(s).toLocaleLowerCase("th");
        return (
          q.startsWith(s.id) ||
          (nick && nick === q) ||
          s.fullName.toLocaleLowerCase("th") === q ||
          s.name.toLocaleLowerCase("th") === q ||
          `${s.id} — ${s.fullName}`.toLocaleLowerCase("th") === q
        );
      }) || null
    );
  }

  function clearAllPersonalization() {
    state.myStudent = null;
    state.myTeacherKey = "";
    state.ramedLoginId = "";
    localStorage.removeItem("racm303_my_sid");
    localStorage.removeItem("racm303_my_teacher");
    localStorage.removeItem("racm303_login_uid");
    ["personalStudentInput", "studioStudentInput", "subStudentQuickInput", "conciergeStudentInput", "ramedMyLoginIdInput", "schedDiscFilter", "schedAreaFilter", "schedTeacherFilter", "studioTeacherSelect", "personalTeacherSelect", "conciergeTeacherSelect"].forEach((id) => {
      if ($(id)) $(id).value = "";
    });
    updatePersonalBanner();
    refreshCalendarStudioUI();
    if (typeof syncRamedPerUserIdentityUI === "function") syncRamedPerUserIdentityUI();
    if (state.activeTab === "schedule") renderScheduleCurrent();
    if (state.activeTab === "discussion") renderDiscussionView();
    if (state.activeTab === "hs-discussion") {
      renderHsLiveClassroomBar();
      renderHsDiscussionView();
    }
    if (state.activeTab === "fieldwork") renderFieldworkView();
    if (state.activeTab === "submissions") renderSubmissionsView();
  }

  function initPersonalizer() {
    const list = $("studentLookupList");
    const input = $("personalStudentInput");
    if (list) {
      ROSTER.students.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = `${s.id} — ${s.fullName}`;
        opt.label = `กลุ่มพื้นที่ ${s.area} · Discussion ${s.disc}`;
        list.appendChild(opt);
      });
    }

    const bindStudentInput = (el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        const found = findStudentByQuery(el.value);
        if (found) {
          state.calScope = "student";
          applyMyStudent(found, true);
        }
      });
      el.addEventListener("input", () => {
        const val = el.value.trim();
        const m = val.match(/^(\d{7})\b/);
        if (m) {
          const found = ROSTER.students.find((s) => s.id === m[1]);
          if (found) {
            state.calScope = "student";
            applyMyStudent(found, true);
          }
        }
      });
    };

    bindStudentInput(input);
    bindStudentInput($("studioStudentInput"));
    bindStudentInput($("subStudentQuickInput"));

    ["clearPersonalBtn", "studioClearSelectionBtn"].forEach((id) => {
      const btn = $(id);
      if (btn) btn.addEventListener("click", clearAllPersonalization);
    });
  }

  function applyMyStudent(student, syncFilters) {
    state.myStudent = student;
    state.ramedLoginId = student.id;
    localStorage.setItem("racm303_my_sid", student.id);
    localStorage.setItem("racm303_login_uid", student.id);
    if (window.RACM_LIVE_CLASSROOM) {
      window.RACM_LIVE_CLASSROOM.setStudentProfile(student);
    }
    const formatted = `${student.id} — ${student.fullName}`;
    if ($("personalStudentInput")) $("personalStudentInput").value = formatted;
    if ($("studioStudentInput")) $("studioStudentInput").value = formatted;
    if ($("subStudentQuickInput")) $("subStudentQuickInput").value = formatted;

    if (syncFilters) {
      if ($("schedDiscFilter")) $("schedDiscFilter").value = String(student.disc);
      if ($("schedAreaFilter")) $("schedAreaFilter").value = student.area;
      if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
      if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
      if ($("discGroupSelect") && !$("discGroupSelect").value) $("discGroupSelect").value = String(student.disc);
      if ($("fieldAreaSelect") && !$("fieldAreaSelect").value) $("fieldAreaSelect").value = student.area;
    }

    if ($("srnAreaSelect")) $("srnAreaSelect").value = student.area;
    if ($("srnStudentId")) $("srnStudentId").value = student.id;
    if ($("srnStudentName")) $("srnStudentName").value = student.fullName;
    updateSrnFilename();

    updatePersonalBanner();
    refreshCalendarStudioUI();
    if (typeof syncRamedPerUserIdentityUI === "function") syncRamedPerUserIdentityUI();
    if (state.activeTab === "schedule") renderScheduleCurrent();
    if (state.activeTab === "discussion") renderDiscussionView();
    if (state.activeTab === "hs-discussion") renderHsDiscussionView();
    if (state.activeTab === "fieldwork") renderFieldworkView();
    if (state.activeTab === "submissions") renderSubmissionsView();
  }

  function selectFieldworkGroupOnly(shortName) {
    state.myStudent = null;
    localStorage.removeItem("racm303_my_sid");
    if ($("personalStudentInput")) $("personalStudentInput").value = "";
    if ($("studioStudentInput")) $("studioStudentInput").value = "";
    if ($("subStudentQuickInput")) $("subStudentQuickInput").value = "";
    if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
    if ($("schedTeacherFilter")) $("schedTeacherFilter").value = "";
    if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
    if ($("schedAreaFilter")) $("schedAreaFilter").value = shortName || "";
    state.calScope = shortName ? "group" : "all";
    updatePersonalBanner();
    refreshCalendarStudioUI();
    renderScheduleCurrent();
  }

  function updatePersonalBanner() {
    const summary = $("personalSummary");
    const clearBtn = $("clearPersonalBtn");
    if (!summary) return;
    summary.replaceChildren();
    if (!state.myStudent) {
      summary.appendChild(
        make("span", "พิมพ์รหัส 7 หลักหรือชื่อ เพื่อผูกห้อง Discussion กลุ่มภาคสนาม และดาวน์โหลดปฏิทินส่วนตัว (.ics / .csv)")
      );
      if (clearBtn) clearBtn.hidden = true;
      if (typeof renderRoleConcierge === "function") renderRoleConcierge();
      return;
    }
    const s = state.myStudent;
    const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
    const hsRot = (SCHED.hsRotation || []).find((x) => x.group === s.disc);

    const discChip = make("button", `Discussion ${s.disc} (${hsRot ? hsRot.room : ""}) ↗`, "personal-chip");
    discChip.type = "button";
    discChip.style.cursor = "pointer";
    discChip.title = "คลิกเพื่อดูรายชื่อสมาชิกกลุ่ม Discussion ของฉัน";
    discChip.addEventListener("click", () => {
      if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
      switchTab("discussion");
    });

    const areaChip = make("button", `พื้นที่: ${s.area} ↗`, "personal-chip");
    areaChip.type = "button";
    areaChip.style.cursor = "pointer";
    areaChip.title = "คลิกเพื่อดูข้อมูลและสมาชิกกลุ่มพื้นที่ภาคสนามของฉัน";
    areaChip.addEventListener("click", () => {
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = s.area;
      switchTab("fieldwork");
    });

    summary.append(
      discChip,
      areaChip,
      make("span", `อ.ที่ปรึกษา: ${s.advisor}`, "personal-chip")
    );
    if (clearBtn) clearBtn.hidden = false;
    if (typeof renderRoleConcierge === "function") renderRoleConcierge();
  }

  /* ---------- Primary Tab Routing ---------- */
  function normalizeTabId(rawTab) {
    if (!rawTab) return "schedule";
    if (rawTab === "students") return "fieldwork";
    if (rawTab === "srn" || rawTab === "elearning") return "submissions";
    if (rawTab === "discussion-hs" || rawTab === "hs-cases") return "hs-discussion";
    const m = String(rawTab).match(/^hs-discussion-(HS[1-6])$/i);
    if (m) {
      state.hsdModule = m[1].toUpperCase();
      if ($("hsdModuleSelect")) $("hsdModuleSelect").value = state.hsdModule;
      return "hs-discussion";
    }
    if (rawTab === "leave-form" || rawTab === "absence") return "leave";
    return rawTab;
  }

  function openHsDiscussion(mod) {
    state.hsdModule = mod && /^HS[1-6]$/.test(mod) ? mod : "ALL";
    state.hsdSlideIdx = 0;
    if ($("hsdModuleSelect")) $("hsdModuleSelect").value = state.hsdModule;
    switchTab("hs-discussion");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchTab(tabId, pushHash = true) {
    tabId = normalizeTabId(tabId);
    const validTabs = ROLE === "faculty"
      ? ["schedule", "discussion", "hs-discussion", "fieldwork", "submissions", "leave", "audit", "faculty-docs", "manual", "textbooks", "practice"]
      : ["schedule", "discussion", "hs-discussion", "fieldwork", "submissions", "leave", "manual", "textbooks", "practice"];
    if (!validTabs.includes(tabId)) tabId = "schedule";

    state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tabId}`;
    });

    document.body.classList.remove("print-leave-form-mode");
    document.body.classList.toggle("print-students-mode", tabId === "discussion" || tabId === "fieldwork");
    document.body.classList.toggle("print-disc-mode", tabId === "discussion");
    document.body.classList.remove("print-single-hsd-case");

    if (pushHash) {
      const suffix = tabId === "hs-discussion" && state.hsdModule !== "ALL" ? `-${state.hsdModule}` : "";
      history.replaceState(null, "", `#${tabId}${suffix}`);
    }

    if (tabId === "schedule") renderScheduleCurrent();
    if (tabId === "discussion") renderDiscussionView();
    if (tabId === "hs-discussion") renderHsDiscussionView();
    if (tabId === "fieldwork") renderFieldworkView();
    if (tabId === "submissions") renderSubmissionsView();
    if (tabId === "leave" && typeof renderLeavePortalView === "function") renderLeavePortalView();
    if (tabId === "manual") renderManualReader();
    if (tabId === "textbooks") renderTextbookReader();
    if (tabId === "practice") renderPracticeCurrent();
    if (ROLE === "faculty" && tabId === "audit" && typeof renderAuditView === "function") renderAuditView();
    if (ROLE === "faculty" && tabId === "faculty-docs" && typeof renderFacultyDocsView === "function") renderFacultyDocsView();
  }

  /* ---------- Per-Session Group Assignments & Fieldwork Personalization ---------- */
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
          let roomLabel = site.room;
          if (session.code === "FIELD") {
            roomLabel = `${site.hospital} ${site.province}`;
          } else if (session.code === "TRAVEL") {
            roomLabel = `จุดนัดหมายการเดินทาง กลุ่ม${site.shortName} (${site.departShortTH || ""})`;
          } else if (session.code === "RETURN") {
            roomLabel = `${site.hospital} ${site.province} → กรุงเทพฯ / CNMI`;
          }
          return {
            type: "area",
            groupId: site.shortName,
            label: `กลุ่มพื้นที่ ${site.shortName} (${site.count} คน)`,
            shortGroup: site.shortName,
            lecturer: site.advisors + extra,
            room: roomLabel,
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

  function getActivePersonalContext() {
    const discVal = ($("schedDiscFilter") && $("schedDiscFilter").value) || (state.myStudent ? String(state.myStudent.disc) : "");
    const areaVal = ($("schedAreaFilter") && $("schedAreaFilter").value) || (state.myStudent ? state.myStudent.area : "");
    const teacherVal = ($("schedTeacherFilter") && $("schedTeacherFilter").value) || "";
    const siteObj = areaVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal) : null;
    return { discVal, areaVal, teacherVal, siteObj };
  }

  function resolveEffectiveSessionDetails(session, ctx) {
    const assignments = getSessionAssignments(session);
    let title = session.title || "";
    let room = session.room || "";
    let lecturer = session.lecturers || "";
    let personalLabel = "";
    let startISO = session.dateISO;
    let endISO = session.endDateISO || session.dateISO;

    if (session.hsModule && ctx.discVal) {
      const m = assignments.find((a) => a.shortGroup === ctx.discVal);
      if (m) {
        title = `${session.title} [กลุ่ม ${ctx.discVal} · ห้อง ${m.room.split(" ")[0]}]`;
        room = `${m.room} (${m.label})`;
        lecturer = m.lecturer;
        personalLabel = `ห้อง ${m.room.split(" ")[0]}`;
      }
    } else if (session.isFieldGroupSession && ctx.areaVal && ctx.siteObj) {
      const site = ctx.siteObj;
      const m = assignments.find((a) => a.shortGroup === ctx.areaVal);
      if (m) {
        room = m.room;
        lecturer = m.lecturer;
        personalLabel = site.room.split(" ")[0];
      }
      if (session.code === "FIELD") {
        startISO = site.startDateISO || session.dateISO;
        endISO = site.endDateISO || session.endDateISO || session.dateISO;
        title = `ฝึกปฏิบัติงานภาคสนาม · ${site.hospital} ${site.province} (${site.datesTH})`;
        personalLabel = site.shortName;
      } else if (session.code === "TRAVEL") {
        title = `ออกเดินทางสู่พื้นที่ภาคสนาม · กลุ่ม ${site.hospital} ${site.province} (${site.departShortTH || session.timeLabel})`;
        personalLabel = `เดินทาง · ${site.shortName}`;
      } else if (session.code === "RETURN") {
        title = `เดินทางกลับจากภาคสนาม · กลุ่ม ${site.hospital} ${site.province} (${site.returnShortTH || ""})`;
        personalLabel = `เดินทางกลับ · ${site.shortName}`;
      } else {
        title = `${session.title.replace(/\s*\(เฉพาะ 4 กลุ่ม[^)]*\)|\s*\(4 กลุ่ม[^)]*\)/g, "")} [กลุ่ม${site.shortName} · ห้อง ${site.room.split(" ")[0]}]`;
      }
    } else if (ctx.teacherVal && assignments.length) {
      const tm = assignments.find((a) => String(a.lecturer).includes(ctx.teacherVal));
      if (tm) {
        room = `${tm.room} (${tm.label})`;
        lecturer = tm.lecturer;
        personalLabel = `${tm.shortGroup} · ${tm.room.split(" ")[0]}`;
      }
    }

    const isAllDay = session.code === "FIELD" || session.category === "HOLIDAY" || session.category === "STAFF";
    return { assignments, title, room, lecturer, personalLabel, startISO, endISO, isAllDay };
  }

  function getFilteredSessions(ignoreWeekDropdown = false) {
    const weekVal = ignoreWeekDropdown ? "" : (($("schedWeekFilter") && $("schedWeekFilter").value) || "");
    const catVal = ($("schedCatFilter") && $("schedCatFilter").value) || "";
    const ctx = getActivePersonalContext();
    const q = (($("schedSearchInput") && $("schedSearchInput").value) || "").trim().toLocaleLowerCase("th");

    return (SCHED.sessions || []).filter((s) => {
      if (ROLE === "student" && s.studentVisible === false) return false;
      if (weekVal && String(s.week) !== weekVal) return false;
      if (catVal && s.category !== catVal) return false;

      const assignments = getSessionAssignments(s);
      if (!sessionMatchesTeacher(s, ctx.teacherVal, assignments)) return false;

      if (ctx.areaVal && s.allowedSites && ctx.siteObj) {
        if (!s.allowedSites.includes(ctx.siteObj.id)) return false;
      }

      if (q) {
        const zoomHay = s.zoom ? `zoom ${s.zoom.id} ${s.zoom.pass} ${s.zoom.url}` : "";
        const hay = [
          s.code,
          s.title,
          s.objectives,
          s.lecturers,
          s.room,
          s.dateTH,
          zoomHay,
          ROLE === "faculty" ? (s.facultyNote || "") : "",
          ...assignments.map((a) => `${a.label} ${a.lecturer} ${a.room}`)
        ]
          .join(" ")
          .toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ---------- Calendar Personalize, Download & Subscribe Studio ---------- */
  function computeSubscribeRelativePath(ctx) {
    if (ROLE === "faculty" && ctx.teacherVal) {
      const idx = (ROSTER.courseTeachers || []).findIndex((t) => t.key === ctx.teacherVal);
      if (idx >= 0) {
        return `calendars/teacher_${String(idx + 1).padStart(2, "0")}.ics`;
      }
    }
    if (ctx.discVal && ctx.siteObj && ROLE === "student") {
      return `calendars/d${ctx.discVal}_g${ctx.siteObj.id}.ics`;
    }
    if (ctx.discVal && ctx.siteObj && state.myStudent) {
      return `calendars/d${ctx.discVal}_g${ctx.siteObj.id}.ics`;
    }
    if (ctx.siteObj) {
      return `calendars/group_${ctx.siteObj.id}_${ctx.siteObj.slug}.ics`;
    }
    return "calendars/all.ics";
  }

  function refreshCalendarStudioUI() {
    const ctx = getActivePersonalContext();
    const sessionsToExport = getSessionsForExport();

    // Update scope tabs visual state
    document.querySelectorAll("[data-cal-scope]").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.calScope === state.calScope ? "true" : "false");
    });

    if ($("calScopeStudentPane")) $("calScopeStudentPane").hidden = state.calScope !== "student";
    if ($("calScopeGroupPane")) $("calScopeGroupPane").hidden = state.calScope !== "group";
    if ($("calScopeTeacherPane")) $("calScopeTeacherPane").hidden = state.calScope !== "teacher";
    if ($("calScopeAllPane")) $("calScopeAllPane").hidden = state.calScope !== "all";

    if ($("studioClearSelectionBtn")) {
      $("studioClearSelectionBtn").hidden = !(state.myStudent || ctx.areaVal || ctx.discVal);
    }
    if ($("studioClearTeacherBtn")) {
      $("studioClearTeacherBtn").hidden = !ctx.teacherVal;
    }

    // Highlight active fieldwork group pill
    document.querySelectorAll(".cal-group-pill").forEach((pill) => {
      pill.classList.toggle("is-selected", pill.dataset.areaName === ctx.areaVal);
    });

    // Update summary box & dynamic CTA button labels
    const sumBox = $("calTargetSummaryBox");
    const dlIcsBtn = $("studioDownloadIcsBtn");
    const dlCsvBtn = $("studioDownloadCsvBtn");
    const topIcsBtn = $("exportIcsBtn");
    const topCsvBtn = $("exportGcalCsvBtn");

    let shortTarget = "ตารางรวมทั้งรายวิชา";
    if (state.myStudent && ctx.siteObj) {
      const s = state.myStudent;
      const site = ctx.siteObj;
      shortTarget = `${s.id} (${site.shortName})`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ตารางเฉพาะตัวนักศึกษา:</strong> ${escapeHtml(s.fullName)} (<code>${escapeHtml(s.id)}</code>) · Discussion ${s.disc} · กลุ่ม <strong>${escapeHtml(site.hospital)} ${escapeHtml(site.province)}</strong><br>` +
          `<strong>เวลาลงภาคสนามของกลุ่มนี้:</strong> ออกเดินทาง ${escapeHtml(site.departShortTH || "")} · ระยะฝึก <strong>${escapeHtml(site.datesTH)}</strong> · ${site.hasFri11Dec ? "มีเรียนกลุ่มย่อย 5–6 วันศุกร์ที่ 11 ธ.ค." : "ไม่มีเรียนวันศุกร์ที่ 11 ธ.ค. (อยู่ระหว่างภาคสนาม)"} · รวม <strong>${sessionsToExport.length} รายการ</strong> (พร้อมลิงก์ Zoom)`;
      }
    } else if (ctx.teacherVal) {
      const tObj = (ROSTER.courseTeachers || []).find((t) => t.key === ctx.teacherVal);
      shortTarget = `อ.${ctx.teacherVal}`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ปฏิทินภาระงานอาจารย์:</strong> ${escapeHtml(tObj ? tObj.label : ctx.teacherVal)}<br>` +
          `คัดเฉพาะคาบบรรยาย กลุ่มอภิปราย HS และกลุ่มที่ปรึกษาภาคสนามของท่าน รวม <strong>${sessionsToExport.length} รายการ</strong> (พร้อมฝังลิงก์ Zoom ครบทุกคาบออนไลน์)`;
      }
    } else if (ctx.siteObj) {
      const site = ctx.siteObj;
      shortTarget = `กลุ่ม${site.shortName}`;
      if (sumBox) {
        sumBox.innerHTML =
          `<strong>ตารางเฉพาะกลุ่มภาคสนาม:</strong> <strong>${escapeHtml(site.hospital)} ${escapeHtml(site.province)}</strong> (${site.count} คน · ห้องกลุ่มย่อย <code>${escapeHtml(site.room.split(" ")[0])}</code> · อ.ที่ปรึกษา: ${escapeHtml(site.advisors)})<br>` +
          `<strong>เวลาลงภาคสนามของกลุ่มนี้:</strong> ออกเดินทาง ${escapeHtml(site.departShortTH || "")} · ระยะฝึก <strong>${escapeHtml(site.datesTH)}</strong> · ${site.hasFri11Dec ? "รวมคาบกลุ่มย่อย 5–6 วันศุกร์ที่ 11 ธ.ค. แล้ว" : "ตัดคาบวันศุกร์ที่ 11 ธ.ค. ออกอัตโนมัติ (กลุ่มนี้เดินทางแล้ว)"} · รวม <strong>${sessionsToExport.length} รายการ</strong>`;
      }
    } else if (ctx.discVal) {
      shortTarget = `Discussion ${ctx.discVal}`;
      if (sumBox) {
        sumBox.innerHTML = `<strong>กรองเฉพาะกลุ่มอภิปราย Discussion ${escapeHtml(ctx.discVal)}:</strong> รวม <strong>${sessionsToExport.length} รายการ</strong> (เลือกกลุ่มพื้นที่ภาคสนามเพิ่มเติมด้านบนเพื่อผูกวันเดินทางภาคสนามได้)`;
      }
    } else {
      if (sumBox) {
        sumBox.innerHTML =
          ROLE === "faculty"
            ? `<strong>กำลังเลือก: ตารางรวมทั้งรายวิชา (${sessionsToExport.length} รายการ)</strong> — เลือกชื่ออาจารย์หรือกลุ่มภาคสนามด้านบนเพื่อแยกดาวน์โหลดเฉพาะภาระงานของท่านหรือเฉพาะกลุ่มได้ทันที`
            : `<strong>กำลังเลือก: ตารางรวมทั้งชั้นปี 169 คน (${sessionsToExport.length} รายการ)</strong> — พิมพ์รหัสนักศึกษาหรือคลิกเลือกกลุ่มภาคสนามด้านบน เพื่อให้ระบบปรับวันเดินทางไป-กลับภาคสนามและห้องเรียนเฉพาะของตัวเองอัตโนมัติ`;
      }
    }

    setBtnLabel(dlIcsBtn, `Export .ics (${shortTarget})`);
    setBtnLabel(dlCsvBtn, `Export .csv (${shortTarget})`);
    setBtnLabel(topIcsBtn, `Export iCal .ics (${shortTarget})`);
    setBtnLabel(topCsvBtn, `Google .csv (${shortTarget})`);
    setBtnLabel($("sideDlIcsQuickBtn"), `Export .ics (${shortTarget})`);
    setBtnLabel($("sideDlCsvQuickBtn"), `Export .csv (${shortTarget})`);
    if ($("calSideSyncTargetLabel")) {
      $("calSideSyncTargetLabel").textContent = `กำลังซิงค์: ${shortTarget} (${sessionsToExport.length} คาบ · พร้อมลิงก์ Zoom)`;
    }

    // Update Subscribe URL (.ics over HTTPS for Google Calendar "From URL" & webcal:// for Apple Calendar)
    const relFeed = computeSubscribeRelativePath(ctx);
    const httpsFeedUrl = `${PORTAL_BASE_URL}/${relFeed}`;
    const webcalFeedUrl = httpsFeedUrl.replace(/^https:\/\//i, "webcal://");
    if ($("studioSubscribeUrlInput")) $("studioSubscribeUrlInput").value = httpsFeedUrl;
    if ($("studioWebcalLink")) $("studioWebcalLink").href = webcalFeedUrl;
    if ($("sideWebcalQuickLink")) $("sideWebcalQuickLink").href = webcalFeedUrl;
    if (ROLE === "faculty" && ctx.teacherVal !== undefined) {
      state.myTeacherKey = ctx.teacherVal || "";
      if (state.myTeacherKey) localStorage.setItem("racm303_my_teacher", state.myTeacherKey);
      if ($("personalTeacherSelect") && $("personalTeacherSelect").value !== state.myTeacherKey) {
        $("personalTeacherSelect").value = state.myTeacherKey;
      }
    }
    if (typeof renderRoleConcierge === "function") renderRoleConcierge();
  }

  function initCalendarDownloadStudio() {
    // Render 9 Fieldwork Group quick-select pills
    const grid = $("studioGroupPillsGrid");
    if (grid && !grid.dataset.rendered) {
      grid.dataset.rendered = "1";
      (SCHED.fieldworkSites || []).forEach((site) => {
        const pill = make("button", null, "cal-group-pill");
        pill.type = "button";
        pill.dataset.areaName = site.shortName;
        pill.innerHTML = `<strong>${escapeHtml(site.shortName)}</strong><small>${site.count} คน</small>`;
        pill.addEventListener("click", () => {
          selectFieldworkGroupOnly(site.shortName);
        });
        grid.appendChild(pill);
      });
    }

    // Faculty studio teacher dropdown
    const studioTeacher = $("studioTeacherSelect");
    if (studioTeacher && !studioTeacher.dataset.rendered) {
      studioTeacher.dataset.rendered = "1";
      (ROSTER.courseTeachers || []).forEach((t) => {
        studioTeacher.add(new Option(t.label, t.key));
      });
      studioTeacher.addEventListener("change", () => {
        const val = studioTeacher.value;
        if ($("schedTeacherFilter")) $("schedTeacherFilter").value = val;
        if (val) {
          state.myStudent = null;
          if ($("schedAreaFilter")) $("schedAreaFilter").value = "";
          if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
          state.calScope = "teacher";
        }
        updatePersonalBanner();
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    if ($("studioClearTeacherBtn")) {
      $("studioClearTeacherBtn").addEventListener("click", clearAllPersonalization);
    }

    // Scope mode switching buttons
    document.querySelectorAll("[data-cal-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextScope = btn.dataset.calScope;
        state.calScope = nextScope;
        if (nextScope === "all") {
          clearAllPersonalization();
          state.calScope = "all";
        } else if (nextScope === "group" && state.myStudent) {
          const areaKeep = state.myStudent.area;
          selectFieldworkGroupOnly(areaKeep);
        }
        refreshCalendarStudioUI();
      });
    });

    if ($("studioDownloadIcsBtn")) $("studioDownloadIcsBtn").addEventListener("click", downloadScheduleIcs);
    if ($("studioDownloadCsvBtn")) $("studioDownloadCsvBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("studioCopySubUrlBtn")) {
      $("studioCopySubUrlBtn").addEventListener("click", () => {
        const urlEl = $("studioSubscribeUrlInput");
        if (urlEl && urlEl.value) {
          copyTextWithFeedback(urlEl.value, $("studioCopySubUrlBtn"), "คัดลอกลิงก์ .ics แล้ว ✓");
        }
      });
    }
  }

  /* ---------- Tab 1: Schedule & Calendar Controls + Side-Tab Inspector ---------- */
  function findSessionForMilestone(m) {
    const sessions = SCHED.sessions || [];
    const dStr = String(m.date || "");
    const tStr = String(m.title || "");
    if (dStr.includes("8 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-08" && s.category === "EXAM") || sessions.find((s) => s.dateISO === "2026-12-08");
    }
    if (dStr.includes("22 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-22" && s.category === "EXAM") || sessions.find((s) => s.dateISO === "2026-12-22");
    }
    if (dStr.includes("29 ธ.ค.")) {
      return sessions.find((s) => s.dateISO === "2026-12-29");
    }
    if (dStr.includes("30 ธ.ค.") && tStr.includes("4A")) {
      return sessions.find((s) => s.dateISO === "2026-12-30" && s.category !== "EXAM") || sessions.find((s) => s.dateISO === "2026-12-30");
    }
    return null;
  }

  function renderZoomHubAndMilestones() {
    const msWrap = $("milestoneStrip");
    if (msWrap && !msWrap.dataset.rendered) {
      msWrap.dataset.rendered = "1";
      (SCHED.milestones || []).forEach((m) => {
        const card = make("div", null, `milestone-card ms-type-${m.type || "info"}`);
        card.setAttribute("role", "button");
        card.tabIndex = 0;

        let actionHint = "ดูในปฏิทิน →";
        if (m.type === "deadline") actionHint = "เปิดหน้าส่งงาน →";
        else if (m.type === "fieldwork") actionHint = "ดู 9 พื้นที่ภาคสนาม →";

        const activateMilestone = () => {
          if (m.type === "deadline") {
            if ($("srnRoundSelect")) {
              $("srnRoundSelect").value = String(m.title).includes("SRN 1") ? "SRN1" : "SRN2";
              updateSrnFilename();
            }
            switchTab("submissions");
            return;
          }
          if (m.type === "fieldwork") {
            switchTab("fieldwork");
            return;
          }
          const matched = findSessionForMilestone(m);
          if (matched) {
            state.calWeek = Number(matched.week) || 1;
            if ($("schedWeekFilter") && $("schedWeekFilter").value) {
              $("schedWeekFilter").value = String(state.calWeek);
            }
            state.schedSub = "week";
            syncSegButtons();
            renderScheduleCurrent();
            openEventModal(matched);
          }
        };

        card.addEventListener("click", activateMilestone);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            activateMilestone();
          }
        });

        const topRow = make("div", null, "ms-top-row");
        topRow.append(make("span", m.date, "ms-date"), make("span", actionHint, "ms-action-hint"));

        card.append(
          topRow,
          make("div", m.title, "ms-title"),
          make("div", m.channel, "ms-channel")
        );
        msWrap.appendChild(card);
      });
    }

    const rooms = (SCHED.courseMeta && SCHED.courseMeta.zoomRooms) || [];
    const zoomList = $("zoomRoomsHubList");
    if (zoomList && !zoomList.dataset.rendered) {
      zoomList.dataset.rendered = "1";
      rooms.forEach((zr) => {
        const card = make("div", null, "zoom-room-card");
        const info = make("div", null, "zoom-room-info");
        info.appendChild(make("strong", zr.label));
        info.appendChild(make("div", `Meeting ID: ${zr.id}  ·  Passcode: ${zr.pass}`, "zoom-room-meta"));

        const acts = make("div", null, "header-actions");
        const joinLink = make("a", "เข้าห้องเรียน Zoom ↗", "btn sm primary");
        joinLink.href = zr.url;
        joinLink.target = "_blank";
        joinLink.rel = "noopener";

        const copyBtn = make("button", "คัดลอกลิงก์ & รหัส", "btn sm");
        copyBtn.type = "button";
        copyBtn.addEventListener("click", () =>
          copyTextWithFeedback(`${zr.label}\nZoom Link: ${zr.url}\nMeeting ID: ${zr.id}\nPasscode: ${zr.pass}`, copyBtn)
        );

        acts.append(joinLink, copyBtn);
        card.append(info, acts);
        zoomList.appendChild(card);
      });
    }

    const sideZoomList = $("calSideZoomList");
    if (sideZoomList && !sideZoomList.dataset.rendered) {
      sideZoomList.dataset.rendered = "1";
      rooms.forEach((zr) => {
        const card = make("div", null, "side-zoom-card");
        card.appendChild(make("strong", zr.label, "side-zoom-title"));
        card.appendChild(make("div", `ID: ${zr.id} · Pass: ${zr.pass}`, "side-zoom-meta"));
        const acts = make("div", null, "side-zoom-actions");
        const joinLink = make("a", "เข้า Zoom ↗", "btn sm primary");
        joinLink.href = zr.url;
        joinLink.target = "_blank";
        joinLink.rel = "noopener";
        const copyBtn = make("button", "คัดลอก", "btn sm");
        copyBtn.type = "button";
        copyBtn.addEventListener("click", () =>
          copyTextWithFeedback(`${zr.label}\nZoom Link: ${zr.url}\nMeeting ID: ${zr.id}\nPasscode: ${zr.pass}`, copyBtn)
        );
        acts.append(joinLink, copyBtn);
        card.appendChild(acts);
        sideZoomList.appendChild(card);
      });
    }
  }

  function syncCalSideTabs() {
    document.querySelectorAll("[data-side-tab]").forEach((btn) => {
      btn.setAttribute("aria-selected", btn.dataset.sideTab === state.calSideTab ? "true" : "false");
    });
    if ($("calSideMilestonesPane")) $("calSideMilestonesPane").hidden = state.calSideTab !== "milestones";
    if ($("calSideZoomPane")) $("calSideZoomPane").hidden = state.calSideTab !== "zoom";
    if ($("calSideSyncPane")) $("calSideSyncPane").hidden = state.calSideTab !== "sync";
  }

  function initScheduleControls() {
    renderZoomHubAndMilestones();
    initCalendarDownloadStudio();

    document.querySelectorAll("[data-side-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.calSideTab = btn.dataset.sideTab || "milestones";
        syncCalSideTabs();
      });
    });

    const toggleSidebarBtn = $("toggleCalSidebarBtn");
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener("click", () => {
        state.showCalSidebar = !state.showCalSidebar;
        toggleSidebarBtn.setAttribute("aria-expanded", state.showCalSidebar ? "true" : "false");
        if ($("calSideInspector")) $("calSideInspector").hidden = !state.showCalSidebar;
        if ($("calWorkspaceSplit")) {
          $("calWorkspaceSplit").classList.toggle("is-sidebar-collapsed", !state.showCalSidebar);
        }
      });
    }

    if ($("sideDlIcsQuickBtn")) $("sideDlIcsQuickBtn").addEventListener("click", downloadScheduleIcs);
    if ($("sideDlCsvQuickBtn")) $("sideDlCsvQuickBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("sideOpenFullStudioBtn")) {
      $("sideOpenFullStudioBtn").addEventListener("click", () => {
        const disc = $("calStudioDisclosure");
        if (disc) {
          disc.open = true;
          disc.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    const teacherSel = $("schedTeacherFilter");
    if (teacherSel) {
      ROSTER.courseTeachers.forEach((t) => {
        teacherSel.add(new Option(t.label, t.key));
      });
    }
    const discSel = $("schedDiscFilter");
    if (discSel) {
      (SCHED.hsGroups || []).forEach((g) => {
        discSel.add(new Option(`Discussion ${g.id}`, String(g.id)));
      });
    }
    const areaSel = $("schedAreaFilter");
    if (areaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(s.shortName, s.shortName));
      });
    }

    if ($("schedWeekFilter")) {
      $("schedWeekFilter").addEventListener("change", () => {
        const w = Number($("schedWeekFilter").value);
        if (w >= 1 && w <= 6) state.calWeek = w;
        renderScheduleCurrent();
      });
    }

    if ($("schedAreaFilter")) {
      $("schedAreaFilter").addEventListener("change", () => {
        const val = $("schedAreaFilter").value;
        if (state.myStudent && val !== state.myStudent.area) {
          state.myStudent = null;
          localStorage.removeItem("racm303_my_sid");
          if ($("personalStudentInput")) $("personalStudentInput").value = "";
          if ($("studioStudentInput")) $("studioStudentInput").value = "";
          state.calScope = val ? "group" : "all";
          updatePersonalBanner();
        } else if (!state.myStudent && val) {
          state.calScope = "group";
        }
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    if ($("schedTeacherFilter")) {
      $("schedTeacherFilter").addEventListener("change", () => {
        const val = $("schedTeacherFilter").value;
        if ($("studioTeacherSelect")) $("studioTeacherSelect").value = val;
        if (val && ROLE === "faculty") state.calScope = "teacher";
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    ["schedCatFilter", "schedDiscFilter"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("change", () => {
          refreshCalendarStudioUI();
          renderScheduleCurrent();
        });
      }
    });

    if ($("schedSearchInput")) {
      $("schedSearchInput").addEventListener("input", renderScheduleCurrent);
    }
    if ($("resetSchedFiltersBtn")) {
      $("resetSchedFiltersBtn").addEventListener("click", () => {
        ["schedWeekFilter", "schedCatFilter", "schedTeacherFilter", "schedDiscFilter", "schedAreaFilter", "schedSearchInput"].forEach((id) => {
          if ($(id)) $(id).value = "";
        });
        if ($("studioTeacherSelect")) $("studioTeacherSelect").value = "";
        if (state.myStudent) {
          if ($("schedDiscFilter")) $("schedDiscFilter").value = String(state.myStudent.disc);
          if ($("schedAreaFilter")) $("schedAreaFilter").value = state.myStudent.area;
        }
        state.calWeek = 1;
        refreshCalendarStudioUI();
        renderScheduleCurrent();
      });
    }

    document.querySelectorAll("[data-sched-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.schedSub = btn.dataset.schedSub;
        syncSegButtons();
        renderScheduleCurrent();
      });
    });

    if ($("calPrevBtn")) {
      $("calPrevBtn").addEventListener("click", () => {
        if (state.schedSub === "month") state.schedSub = "week";
        state.calWeek = Math.max(1, state.calWeek - 1);
        if ($("schedWeekFilter") && $("schedWeekFilter").value) $("schedWeekFilter").value = String(state.calWeek);
        syncSegButtons();
        renderScheduleCurrent();
      });
    }
    if ($("calNextBtn")) {
      $("calNextBtn").addEventListener("click", () => {
        if (state.schedSub === "month") state.schedSub = "week";
        state.calWeek = Math.min(6, state.calWeek + 1);
        if ($("schedWeekFilter") && $("schedWeekFilter").value) $("schedWeekFilter").value = String(state.calWeek);
        syncSegButtons();
        renderScheduleCurrent();
      });
    }
    if ($("calStartWeekBtn")) {
      $("calStartWeekBtn").addEventListener("click", () => {
        state.calWeek = 1;
        if ($("schedWeekFilter")) $("schedWeekFilter").value = "";
        renderScheduleCurrent();
      });
    }

    const zoomDrawerBtn = $("toggleZoomDrawerBtn");
    const zoomDrawer = $("zoomSyncDrawer");
    if (zoomDrawerBtn && zoomDrawer) {
      zoomDrawerBtn.addEventListener("click", () => {
        state.showZoomDrawer = !state.showZoomDrawer;
        zoomDrawer.hidden = !state.showZoomDrawer;
        zoomDrawerBtn.setAttribute("aria-expanded", state.showZoomDrawer ? "true" : "false");
      });
    }

    const hasActiveScheduleFilter = () => {
      const ids = ["schedWeekFilter", "schedCatFilter", "schedTeacherFilter", "schedDiscFilter", "schedAreaFilter", "schedSearchInput"];
      return Boolean(state.myStudent || ids.some((id) => $(id) && String($(id).value || "").trim() !== ""));
    };

    if ($("exportIcsBtn")) $("exportIcsBtn").addEventListener("click", downloadScheduleIcs);
    if ($("exportGcalCsvBtn")) $("exportGcalCsvBtn").addEventListener("click", downloadScheduleGoogleCsv);
    if ($("exportSchedulePdfBtn")) {
      $("exportSchedulePdfBtn").addEventListener("click", (ev) => {
        if (!hasActiveScheduleFilter()) return; // allow native download of pre-built PDF
        ev.preventDefault();
        const ctx = getActivePersonalContext();
        const tag = ctx.teacherVal || (state.myStudent && state.myStudent.id) || ctx.areaVal || "เฉพาะเงื่อนไขที่กรอง";
        printWithCleanTitle(`ตารางสอน_RACM303_2569_${sanitizeFilenamePart(tag)}`);
      });
    }
    if ($("exportScheduleDocxBtn")) {
      $("exportScheduleDocxBtn").addEventListener("click", (ev) => {
        if (!hasActiveScheduleFilter()) return; // allow native download of pre-built DOCX
        ev.preventDefault();
        const ctx = getActivePersonalContext();
        const sessions = getFilteredSessions(false);
        const rowsHtml = sessions
          .map((s) => {
            const eff = resolveEffectiveSessionDetails(s, ctx);
            return `<tr><td>สัปดาห์ ${s.week} · ${escapeHtml(s.dateTH)} (${escapeHtml(eff.startTime || s.startTime)}–${escapeHtml(eff.endTime || s.endTime)})</td><td>${escapeHtml(eff.title || s.title)}</td><td>${escapeHtml(eff.lecturers || s.lecturers || "-")}</td><td>${escapeHtml(eff.room || s.room || "-")}</td></tr>`;
          })
          .join("");
        const tag = ctx.teacherVal || (state.myStudent && `${state.myStudent.id}_${state.myStudent.fullName}`) || ctx.areaVal || "Filtered";
        downloadHtmlAsGenuineDocx(
          "ตารางกิจกรรมการเรียนการสอน รายวิชา RACM 303 ปีการศึกษา 2569",
          `เงื่อนไขที่กรอง: ${tag} · รวม ${sessions.length} คาบกิจกรรม`,
          `<table><thead><tr><th>วัน-เวลา</th><th>หัวข้อและกิจกรรม</th><th>ผู้สอน</th><th>ห้องเรียน / ช่องทาง</th></tr></thead><tbody>${rowsHtml}</tbody></table>`,
          `ตารางสอน_RACM303_2569_${sanitizeFilenamePart(tag)}.docx`
        );
      });
    }
    if ($("printScheduleBtn")) {
      $("printScheduleBtn").addEventListener("click", () => printWithCleanTitle(""));
    }

    const modal = $("calendarEventModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeEventModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) closeEventModal();
      });
    }

    syncCalSideTabs();
    refreshCalendarStudioUI();
  }

  function syncSegButtons() {
    document.querySelectorAll("[data-sched-sub]").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.schedSub === state.schedSub ? "true" : "false")
    );
  }

  function updateScheduleStatusBar(sessionsCount) {
    const statusEl = $("schedStatusText");
    const titleEl = $("calPeriodTitle");
    const ctx = getActivePersonalContext();
    const weekVal = ($("schedWeekFilter") && $("schedWeekFilter").value) || "";

    if (titleEl) {
      if (state.schedSub === "week") {
        const wb = WEEK_BOUNDS.find((w) => w.week === state.calWeek) || WEEK_BOUNDS[0];
        titleEl.textContent = wb.label;
      } else if (state.schedSub === "spec") {
        titleEl.textContent = "ตารางหมุนเวียนกลุ่มอภิปราย HS1–HS6 และสัดส่วนข้อสอบ";
      } else if (weekVal) {
        const wb = WEEK_BOUNDS.find((w) => String(w.week) === weekVal);
        titleEl.textContent = wb ? wb.label : "พฤศจิกายน – ธันวาคม 2569";
      } else {
        titleEl.textContent = "พฤศจิกายน – ธันวาคม 2569 (ปฏิทินรายวิชาครบ 6 สัปดาห์)";
      }
    }

    if ($("calPrevBtn")) $("calPrevBtn").disabled = state.schedSub === "week" && state.calWeek <= 1;
    if ($("calNextBtn")) $("calNextBtn").disabled = state.schedSub === "week" && state.calWeek >= 6;

    if (statusEl) {
      const parts = [
        `พบ ${sessionsCount} คาบกิจกรรม`,
        ctx.teacherVal ? `อาจารย์: ${ctx.teacherVal}` : "",
        ctx.discVal ? `Discussion ${ctx.discVal}` : "",
        ctx.areaVal ? `กลุ่มพื้นที่ ${ctx.areaVal}` : "",
        "คลิกที่คาบเรียนเพื่อดูรายละเอียด ลิงก์ Zoom หรือเพิ่มเข้าปฏิทิน"
      ].filter(Boolean);
      statusEl.textContent = parts.join(" · ");
    }
  }

  function renderScheduleCurrent() {
    if ($("schedMonthWrap")) $("schedMonthWrap").hidden = state.schedSub !== "month";
    if ($("schedWeekWrap")) $("schedWeekWrap").hidden = state.schedSub !== "week";
    if ($("schedDailyWrap")) $("schedDailyWrap").hidden = state.schedSub !== "daily";
    if ($("schedSpecWrap")) $("schedSpecWrap").hidden = state.schedSub !== "spec";

    if (state.schedSub === "month") renderScheduleMonth();
    else if (state.schedSub === "week") renderScheduleWeek();
    else if (state.schedSub === "daily") renderScheduleDaily();
    else if (state.schedSub === "spec") renderScheduleSpec();
  }

  /* ---------- View 1: Month Calendar Matrix (Google Calendar / Apple iCal Style) ---------- */
  function expandSessionsByDate(sessions, ctx) {
    const map = new Map();
    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      let cur = eff.startISO;
      const last = eff.endISO || eff.startISO;
      let guard = 0;
      while (cur <= last && guard < 20) {
        if (!map.has(cur)) map.set(cur, []);
        map.get(cur).push({ session: s, eff, isSpanContinuation: cur !== eff.startISO });
        cur = addDaysISO(cur, 1);
        guard++;
      }
    });
    return map;
  }

  function renderScheduleMonth() {
    const wrap = $("schedMonthContent");
    if (!wrap) return;
    const ctx = getActivePersonalContext();
    const sessions = getFilteredSessions(false);
    updateScheduleStatusBar(sessions.length);

    const byDate = expandSessionsByDate(sessions, ctx);
    const weekFilterVal = ($("schedWeekFilter") && $("schedWeekFilter").value) || "";
    const visibleWeeks = weekFilterVal
      ? WEEK_BOUNDS.filter((wb) => String(wb.week) === weekFilterVal)
      : WEEK_BOUNDS;

    const shell = make("div", null, "cal-month-shell");
    const minWrap = make("div", null, "cal-month-min");

    const head = make("div", null, "cal-dow-header");
    head.appendChild(make("div", "สัปดาห์", "cal-dow-cell"));
    TH_DOW_FULL.forEach((dName) => head.appendChild(make("div", dName, "cal-dow-cell")));
    minWrap.appendChild(head);

    visibleWeeks.forEach((wb) => {
      const row = make("div", null, "cal-month-row");
      const wCell = make("div", null, "cal-week-num");
      wCell.title = `คลิกเพื่อเปิดตารางรายสัปดาห์ที่ ${wb.week}`;
      wCell.innerHTML = `<span>W${wb.week}</span><small style="font-size:10px;opacity:0.8">รายชั่วโมง</small>`;
      wCell.addEventListener("click", () => {
        state.calWeek = wb.week;
        state.schedSub = "week";
        syncSegButtons();
        renderScheduleCurrent();
      });
      row.appendChild(wCell);

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const iso = addDaysISO(wb.start, dIdx);
        const isOutside = iso < "2026-11-24" || iso > "2026-12-30";
        const dayItems = byDate.get(iso) || [];
        const hasHoliday = dayItems.some((x) => x.session.category === "HOLIDAY");
        const hasExam = dayItems.some((x) => x.session.category === "EXAM");
        const cell = make(
          "div",
          null,
          `cal-day-cell${dIdx >= 5 ? " is-weekend" : ""}${isOutside ? " is-outside" : ""}${hasHoliday ? " is-holiday-day" : ""}${hasExam ? " is-exam-day" : ""}`
        );

        const dayHead = make("div", null, "cal-day-head");
        const isMonthStart = iso.endsWith("-01") || iso === "2026-11-25";
        const dNum = make("span", formatThaiShortDate(iso, dIdx === 0), `cal-day-num${isMonthStart ? " is-month-start" : ""}`);
        dayHead.appendChild(dNum);
        if (hasHoliday) {
          dayHead.appendChild(make("span", "🏖 วันหยุด", "cal-day-flag is-holiday"));
        } else if (hasExam) {
          dayHead.appendChild(make("span", "สอบ/ส่งงาน", "cal-day-flag is-exam"));
        }
        cell.appendChild(dayHead);

        const evWrap = make("div", null, "cal-day-events");
        dayItems.forEach(({ session: s, eff }) => {
          const chip = make("button", null, `cal-chip cat-${s.category}${eff.isAllDay ? " is-allday" : ""}`);
          chip.type = "button";
          chip.dataset.calSessionId = s.id;
          const shortTime = s.category === "HOLIDAY" ? "🏖 วันหยุด" : eff.isAllDay ? "ทั้งวัน" : (s.startTime || "");
          let labelTitle = "";
          if (s.category === "HOLIDAY") {
            labelTitle = s.title;
          } else if (s.code === "FIELD") {
            labelTitle = ctx.areaVal ? `ภาคสนาม: ${ctx.areaVal}` : "ฝึกภาคสนาม (9 กลุ่ม)";
          } else if (s.code === "TRAVEL") {
            labelTitle = ctx.areaVal ? `ออกเดินทาง (${ctx.areaVal})` : eff.title;
          } else if (s.code === "RETURN") {
            labelTitle = ctx.areaVal ? `เดินทางกลับ (${ctx.areaVal})` : eff.title;
          } else {
            labelTitle = `${s.code}: ${s.title.replace(/^\*?HS\d:\s*|^EP\d.*:\s*/i, "")}`;
          }

          chip.appendChild(make("span", shortTime, "chip-time"));
          chip.appendChild(make("span", labelTitle, "chip-title"));
          if (typeof hasUploadedSessionSlide === "function" && hasUploadedSessionSlide(s.id)) {
            chip.appendChild(make("span", "Slide", "chip-slide-ready"));
          } else if (s.zoom) {
            chip.appendChild(make("span", "Zoom", "chip-zoom"));
          }
          chip.addEventListener("click", () => openEventModal(s));
          evWrap.appendChild(chip);
        });

        cell.appendChild(evWrap);
        row.appendChild(cell);
      }

      minWrap.appendChild(row);
    });

    shell.appendChild(minWrap);
    wrap.replaceChildren(shell);
  }

  /* ---------- View 2: Week Time-Grid View (08:00–18:00 / Dynamic 24:00 for Evening Travel) ---------- */
  function renderScheduleWeek() {
    const wrap = $("schedWeekContent");
    if (!wrap) return;

    const weekDropdownVal = Number(($("schedWeekFilter") && $("schedWeekFilter").value) || 0);
    if (weekDropdownVal >= 1 && weekDropdownVal <= 6) {
      state.calWeek = weekDropdownVal;
    }

    const wb = WEEK_BOUNDS.find((w) => w.week === state.calWeek) || WEEK_BOUNDS[0];
    const ctx = getActivePersonalContext();
    const allFiltered = getFilteredSessions(true);
    const byDate = expandSessionsByDate(allFiltered, ctx);

    const weekSet = new Set();
    let maxEndMin = 18 * 60;
    for (let i = 0; i < 7; i++) {
      (byDate.get(addDaysISO(wb.start, i)) || []).forEach((x) => {
        weekSet.add(x.session.id);
        if (!x.eff.isAllDay) {
          maxEndMin = Math.max(maxEndMin, timeToMinutes(x.session.endTime || "12:00"));
        }
      });
    }
    updateScheduleStatusBar(weekSet.size);

    const HOUR_START = 8;
    const HOUR_END = maxEndMin > 18 * 60 ? Math.min(24, Math.ceil(maxEndMin / 60)) : 18;
    const HOUR_PX = 56;

    const shell = make("div", null, "cal-week-shell");
    const minWrap = make("div", null, "cal-week-min");

    const head = make("div", null, "cal-week-head");
    head.appendChild(make("div", `W${wb.week}`, "cal-gutter-label"));
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const dayItems = byDate.get(iso) || [];
      const isHol = dayItems.some((x) => x.session.category === "HOLIDAY");
      const isEx = dayItems.some((x) => x.session.category === "EXAM");
      const hc = make("div", null, `cal-week-head-cell${isHol ? " is-holiday-day" : ""}${isEx ? " is-exam-day" : ""}`);
      hc.innerHTML = `<span class="wd-name">${TH_DOW_SHORT[i]}${isHol ? " · วันหยุด" : ""}</span><span class="wd-num">${escapeHtml(formatThaiShortDate(iso, true))}</span>`;
      head.appendChild(hc);
    }
    minWrap.appendChild(head);

    const allDayRow = make("div", null, "cal-allday-row");
    allDayRow.appendChild(make("div", "ตลอดวัน", "cal-gutter-label"));
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const dayItems = byDate.get(iso) || [];
      const isHol = dayItems.some((x) => x.session.category === "HOLIDAY");
      const adCell = make("div", null, `cal-allday-cell${isHol ? " is-holiday-day" : ""}`);
      dayItems
        .filter((x) => x.eff.isAllDay)
        .forEach(({ session: s, eff }) => {
          const chip = make("button", null, `cal-chip is-allday cat-${s.category}`);
          chip.type = "button";
          chip.dataset.calSessionId = s.id;
          const txt =
            s.category === "HOLIDAY"
              ? `🏖 วันหยุด: ${eff.title}`
              : s.code === "FIELD" && ctx.areaVal
                ? `ฝึกภาคสนาม (${ctx.areaVal})`
                : eff.title;
          chip.appendChild(make("span", txt, "chip-title"));
          chip.addEventListener("click", () => openEventModal(s));
          adCell.appendChild(chip);
        });
      allDayRow.appendChild(adCell);
    }
    minWrap.appendChild(allDayRow);

    const body = make("div", null, "cal-timegrid-body");
    const gutter = make("div", null, "cal-time-gutter");
    for (let h = HOUR_START; h < HOUR_END; h++) {
      gutter.appendChild(make("div", `${String(h).padStart(2, "0")}:00`, "cal-hour-tick"));
    }
    body.appendChild(gutter);

    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(wb.start, i);
      const dayItems = byDate.get(iso) || [];
      const isHol = dayItems.some((x) => x.session.category === "HOLIDAY");
      const col = make("div", null, `cal-day-col${i >= 5 ? " is-weekend" : ""}${isHol ? " is-holiday-day" : ""}`);
      col.style.height = `${(HOUR_END - HOUR_START) * HOUR_PX}px`;
      if (isHol) {
        const holBanner = make("div", "🏖 วันหยุดราชการ (งดการเรียนการสอนในชั้นเรียน)", "cal-week-holiday-watermark");
        col.appendChild(holBanner);
      }
      dayItems
        .filter((x) => !x.eff.isAllDay)
        .forEach(({ session: s, eff }) => {
          const sMin = Math.max(HOUR_START * 60, timeToMinutes(s.startTime || "09:00"));
          const eMin = Math.min(HOUR_END * 60, Math.max(sMin + 30, timeToMinutes(s.endTime || "12:00")));
          const topPx = ((sMin - HOUR_START * 60) / 60) * HOUR_PX;
          const heightPx = Math.max(30, ((eMin - sMin) / 60) * HOUR_PX - 2);

          const block = make("button", null, `cal-timed-event cat-${s.category}`);
          block.type = "button";
          block.dataset.calSessionId = s.id;
          block.style.top = `${topPx}px`;
          block.style.height = `${heightPx}px`;

          const slideBadge = typeof hasUploadedSessionSlide === "function" && hasUploadedSessionSlide(s.id) ? " · 📊 Slide" : "";
          const timeLine = `${s.startTime}–${s.endTime}${s.zoom ? " · 🎥 Zoom" : ""}${slideBadge}`;
          block.appendChild(make("span", timeLine, "ev-time"));
          block.appendChild(make("span", `${s.code}: ${eff.title}`, "ev-title"));
          if (heightPx >= 58) {
            block.appendChild(make("span", eff.personalLabel || eff.room, "ev-room"));
          }
          block.addEventListener("click", () => openEventModal(s));
          col.appendChild(block);
        });
      body.appendChild(col);
    }

    minWrap.appendChild(body);
    shell.appendChild(minWrap);
    wrap.replaceChildren(shell);
  }

  /* ---------- View 3: Detailed Agenda / Daily Cards (Full-Card Color Coding for Rapid Skim/Scan) ---------- */
  function renderScheduleDaily() {
    const sessions = getFilteredSessions(false);
    updateScheduleStatusBar(sessions.length);

    const listEl = $("scheduleSessionsContainer");
    if (!listEl) return;
    listEl.replaceChildren();

    if (!sessions.length) {
      listEl.appendChild(make("div", "ไม่พบคาบเรียนที่ตรงกับตัวกรอง ลองกด “ล้างตัวกรอง” เพื่อดูตารางทั้งหมด", "empty-state"));
      return;
    }

    const ctx = getActivePersonalContext();
    let lastWeek = null;
    let lastDate = "";

    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      const isHoliday = s.category === "HOLIDAY";
      if (s.week !== lastWeek) {
        lastWeek = s.week;
        lastDate = "";
        const wg = (SCHED.masterGrid || []).find((w) => w.week === s.week);
        listEl.appendChild(make("div", `สัปดาห์ที่ ${s.week}${wg ? " · " + wg.range : ""}`, "week-divider"));
      }
      const dateHeadingText = s.code === "FIELD" && ctx.siteObj ? `ช่วงฝึกภาคสนาม (${ctx.siteObj.datesTH})` : s.dateTH;
      if (dateHeadingText !== lastDate) {
        lastDate = dateHeadingText;
        const dayH = make("h3", dateHeadingText, `day-heading${isHoliday ? " is-holiday-heading" : ""}`);
        listEl.appendChild(dayH);
      }

      const card = make("article", null, `session-card cat-${s.category}`);
      const main = make("div", null, "session-main");

      const timeLabelTxt = isHoliday
        ? "🏖 วันหยุดราชการ"
        : s.code === "FIELD" && ctx.siteObj
          ? ctx.siteObj.badgeDates || s.timeLabel
          : s.timeLabel;
      const timeCol = make("div", timeLabelTxt, "session-time");
      const subCodeTxt = isHoliday
        ? "งดการเรียนการสอน"
        : [s.code, s.checkIn && s.checkIn !== "—" ? s.checkIn : ""].filter(Boolean).join(" · ");
      if (subCodeTxt) timeCol.appendChild(make("small", subCodeTxt));
      main.appendChild(timeCol);

      const bodyCol = make("div", null, "session-topic");
      const badges = make("div", null, "session-badges");
      const catText = isHoliday ? "🏖 วันหยุดราชการ · งดคลาสเรียนในชั้นเรียน" : (CAT_NAMES[s.category] || s.category);
      badges.appendChild(make("span", catText, `badge cat-${s.category}`));
      if (s.format && !isHoliday && s.format !== (CAT_NAMES[s.category] || s.category)) {
        badges.appendChild(make("span", s.format, "badge"));
      }
      if (s.zoom) {
        badges.appendChild(make("span", `Zoom ID: ${s.zoom.id}`, "badge cat-EP"));
      }
      bodyCol.appendChild(badges);
      bodyCol.appendChild(make("h3", eff.title));
      if (s.objectives) {
        bodyCol.appendChild(make("p", s.objectives, "session-objectives"));
      }

      const assignments = eff.assignments;
      const visibleAssignments = ctx.teacherVal
        ? assignments.filter((a) => String(a.lecturer).includes(ctx.teacherVal))
        : assignments;

      if (s.hsModule && ctx.discVal) {
        const myA = assignments.find((a) => a.shortGroup === ctx.discVal);
        if (myA) {
          const pbox = make("div", null, "personal-match-box");
          pbox.innerHTML = `<div><strong>ห้องเรียนของคุณ (${escapeHtml(myA.label)}):</strong> ห้อง <strong>${escapeHtml(myA.room)}</strong> · อาจารย์ประจำกลุ่ม: ${escapeHtml(myA.lecturer)}</div>`;
          const btn = make("button", `ดูรายชื่อกลุ่ม ${myA.shortGroup}`, "btn sm");
          btn.type = "button";
          btn.addEventListener("click", () => jumpToClassRoster(s, myA));
          pbox.appendChild(btn);
          bodyCol.appendChild(pbox);
        }
      } else if (s.isFieldGroupSession && ctx.areaVal) {
        const myA = assignments.find((a) => a.shortGroup === ctx.areaVal);
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

      if (s.zoom) {
        const zBox = make("div", null, "zoom-inline-box");
        const zMeta = make("div", null, "zoom-inline-meta");
        zMeta.innerHTML = `<strong>ห้องเรียนออนไลน์ Zoom:</strong> Meeting ID <code>${escapeHtml(s.zoom.id)}</code> · Passcode <code>${escapeHtml(s.zoom.pass)}</code>`;
        const zActs = make("div", null, "header-actions");
        const zJoin = make("a", "เข้าร่วมห้องเรียน Zoom ↗", "btn sm primary");
        zJoin.href = s.zoom.url;
        zJoin.target = "_blank";
        zJoin.rel = "noopener";
        const zCopy = make("button", "คัดลอกลิงก์", "btn sm");
        zCopy.type = "button";
        zCopy.addEventListener("click", () => copyTextWithFeedback(s.zoom.url, zCopy));
        zActs.append(zJoin, zCopy);
        zBox.append(zMeta, zActs);
        bodyCol.appendChild(zBox);
      }

      if (!isHoliday) {
        if (eff.lecturer && eff.lecturer !== "—") {
          const meta = make("div", null, "session-meta");
          meta.appendChild(make("span", `ผู้สอน: ${eff.lecturer}`));
          bodyCol.appendChild(meta);
        }
        if (eff.room && eff.room !== "—") {
          const roomSpan = make("span", `ห้อง/สถานที่: ${eff.room}`, "room-pill");
          bodyCol.appendChild(roomSpan);
        }
      }

      if (ROLE === "faculty" && s.facultyNote) {
        bodyCol.appendChild(make("div", `[บันทึกสำหรับอาจารย์/ผู้ประสานงาน] ${s.facultyNote}`, "faculty-flag-box"));
      }

      const actions = make("div", null, "session-actions");
      const targetHsMod = s.hsModule || (/^HS[1-6]$/.test(s.docLink || "") ? s.docLink : "");
      if (targetHsMod && !isHoliday) {
        const discLabel = ROLE === "faculty"
          ? `โจทย์ & เฉลย Discussion (${targetHsMod}) →`
          : `โจทย์ & ใบงาน Discussion (${targetHsMod}) →`;
        const bHsd = make("button", discLabel, s.hsModule ? "btn sm primary" : "btn sm");
        bHsd.type = "button";
        bHsd.addEventListener("click", () => openHsDiscussion(targetHsMod));
        actions.appendChild(bHsd);
      }
      if (typeof appendSessionMaterialButtons === "function" && !isHoliday) {
        appendSessionMaterialButtons(actions, s, false);
      } else {
        if (s.conciseLink) {
          const bConcise = make("button", `อ่านฉบับย่อ (${s.hsModule || s.docLink})`, "btn sm teal");
          bConcise.type = "button";
          bConcise.addEventListener("click", () => openTextbookDoc(s.conciseLink));
          actions.appendChild(bConcise);
        }
        if (s.docLink) {
          const bDoc = make("button", `อ่านฉบับเต็ม ${s.docLink}`, s.conciseLink ? "btn sm" : "btn sm teal");
          bDoc.type = "button";
          bDoc.addEventListener("click", () => openTextbookDoc(s.docLink));
          actions.appendChild(bDoc);
        }
        if (s.wbLink) {
          const bWb = make("button", `Worksheet (${s.wbLink.replace("-WB", "")})`, "btn sm");
          bWb.type = "button";
          bWb.addEventListener("click", () => openTextbookDoc(s.wbLink));
          actions.appendChild(bWb);
        }
      }
      if (s.actionUrl) {
        const bExt = make("a", s.actionLabel || "เปิดลิงก์ส่งงาน ↗", "btn sm primary");
        bExt.href = s.actionUrl;
        bExt.target = "_blank";
        bExt.rel = "noopener";
        actions.appendChild(bExt);
      }
      if (s.code === "SRN 2 & SLIDES") {
        const bRamed = make("a", "ส่ง SRN 2 ในห้องเรียน E-learning ↗", "btn sm primary");
        bRamed.href = getActiveRamedTargetUrl();
        bRamed.target = "_blank";
        bRamed.rel = "noopener";
        actions.appendChild(bRamed);
      }
      if (s.code === "SRN 1" || s.code === "SRN 2 & SLIDES") {
        const bSrn = make("button", "เตรียมไฟล์ & ศูนย์การส่งงาน", "btn sm teal");
        bSrn.type = "button";
        bSrn.addEventListener("click", () => {
          if ($("srnRoundSelect")) {
            $("srnRoundSelect").value = s.code === "SRN 1" ? "SRN1" : "SRN2";
            updateSrnFilename();
          }
          switchTab("submissions");
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        actions.appendChild(bSrn);
      }

      const gcalSingle = make("a", "+ Google Calendar", "btn sm");
      gcalSingle.href = buildGoogleCalendarTemplateUrl(s);
      gcalSingle.target = "_blank";
      gcalSingle.rel = "noopener";
      actions.appendChild(gcalSingle);

      const icsSingle = make("button", "บันทึก .ics คาบนี้", "btn sm");
      icsSingle.type = "button";
      icsSingle.addEventListener("click", () => downloadSingleSessionIcs(s));
      actions.appendChild(icsSingle);

      if (!assignments.length && s.category !== "HOLIDAY" && s.category !== "STAFF") {
        const bAll = make("button", "ดูรายชื่อทั้งชั้น (169 คน)", "btn sm");
        bAll.type = "button";
        bAll.addEventListener("click", () =>
          jumpToClassRoster(s, { type: "all", groupId: "", label: "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้งชั้น (169 คน)", lecturer: s.lecturers, room: s.room })
        );
        actions.appendChild(bAll);
      }

      bodyCol.appendChild(actions);
      main.appendChild(bodyCol);
      card.appendChild(main);

      if (visibleAssignments.length > 0) {
        const details = make("details", null, "assignments");
        details.open = Boolean(ctx.teacherVal);
        const kindText = s.hsModule ? "กลุ่มอภิปราย Discussion" : "กลุ่มพื้นที่ภาคสนาม";
        details.appendChild(
          make("summary", `ดูรายละเอียดแยกตาม${kindText} (${visibleAssignments.length} กลุ่ม) · อาจารย์ · ห้องเรียน · รายชื่อนักศึกษา`)
        );
        visibleAssignments.forEach((item) => {
          const isMine =
            (item.type === "discussion" && ctx.discVal === item.shortGroup) ||
            (item.type === "area" && ctx.areaVal === item.shortGroup);
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

  /* ---------- View 4: HS1–HS6 Rotation & Exam Table Spec ---------- */
  function renderScheduleSpec() {
    const wrap = $("schedSpecContent");
    if (!wrap) return;
    updateScheduleStatusBar((SCHED.sessions || []).filter((s) => ROLE === "faculty" || s.studentVisible !== false).length);
    if (wrap.dataset.rendered) return;
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
        <p style="margin:0 0 12px;font-size:14px;color:var(--muted)">เวลาเรียนระบบสุขภาพ: ช่วงเช้า <strong>08.30–12.00 น.</strong> (บรรยาย 08.30–09.30 · กลุ่มย่อย 09.40–12.00) และช่วงบ่าย <strong>13.30–17.00 น.</strong> (บรรยาย 13.30–14.30 · กลุ่มย่อย 14.40–17.00) · หมายเหตุ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปใช้ห้อง <strong>2C2-03</strong> ชั่วคราว และช่วงบ่าย (HS5) กลับเข้าห้อง <strong>1C1-07</strong> ตามปกติ</p>
        <div class="clean-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>กลุ่มอภิปราย</th>
                <th>HS1 (26 พ.ย. 08.30–12.00)</th>
                <th>HS2 (30 พ.ย. 08.30–12.00)</th>
                <th>HS3 (30 พ.ย. 13.30–17.00)</th>
                <th>HS4 (1 ธ.ค. 08.30–12.00)</th>
                <th>HS5 (1 ธ.ค. 13.30–17.00)</th>
                <th>HS6 (4 ธ.ค. 08.30–12.00)</th>
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

  /* ---------- Interactive Calendar Event Detail Popover Modal ---------- */
  function openEventModal(session) {
    const modal = $("calendarEventModal");
    const card = $("calendarEventModalCard");
    if (!modal || !card) return;

    const ctx = getActivePersonalContext();
    const eff = resolveEffectiveSessionDetails(session, ctx);
    card.replaceChildren();

    const top = make("div", null, "cal-modal-top");
    const badges = make("div", null, "session-badges");
    badges.append(
      make("span", CAT_NAMES[session.category] || session.category, `badge cat-${session.category}`),
      make("span", session.code, "badge"),
      make("span", session.format || "", "badge")
    );
    const closeBtn = make("button", "×", "cal-modal-close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "ปิดหน้าต่างรายละเอียด");
    closeBtn.addEventListener("click", closeEventModal);
    top.append(badges, closeBtn);
    card.appendChild(top);

    const h3 = make("h3", eff.title);
    h3.id = "calModalTitle";
    card.appendChild(h3);

    const dateLine = session.code === "FIELD" && ctx.siteObj ? ctx.siteObj.datesTH : `${session.dateTH} · ${session.timeLabel}`;
    const details = make("div", null, "cal-modal-detail-list");
    details.innerHTML = `
      <div><strong>วัน-เวลา:</strong> ${escapeHtml(dateLine)}${session.checkIn ? " (" + escapeHtml(session.checkIn) + ")" : ""}</div>
      <div><strong>สถานที่ / ห้องเรียน:</strong> <span class="room-pill">${escapeHtml(eff.room)}</span></div>
      <div><strong>อาจารย์ผู้สอน / วิทยากร:</strong> ${escapeHtml(eff.lecturer)}</div>
    `;
    card.appendChild(details);

    if (session.zoom) {
      const zBox = make("div", null, "zoom-inline-box");
      const zMeta = make("div", null, "zoom-inline-meta");
      zMeta.innerHTML = `<strong>ลิงก์เข้าห้องเรียน Zoom:</strong><br>Meeting ID: <code>${escapeHtml(session.zoom.id)}</code> · Passcode: <code>${escapeHtml(session.zoom.pass)}</code>`;
      const zActs = make("div", null, "header-actions");
      const zJoin = make("a", "เข้าร่วมประชุม Zoom ↗", "btn sm primary");
      zJoin.href = session.zoom.url;
      zJoin.target = "_blank";
      zJoin.rel = "noopener";
      const zCopy = make("button", "คัดลอกลิงก์ Zoom", "btn sm");
      zCopy.type = "button";
      zCopy.addEventListener("click", () => copyTextWithFeedback(session.zoom.url, zCopy));
      zActs.append(zJoin, zCopy);
      zBox.append(zMeta, zActs);
      card.appendChild(zBox);
    }

    if (session.objectives) {
      const objP = make("p", session.objectives, "session-objectives");
      objP.style.marginTop = "10px";
      card.appendChild(objP);
    }

    if (ROLE === "faculty" && session.facultyNote) {
      card.appendChild(make("div", `[บันทึกผู้ประสานงาน] ${session.facultyNote}`, "faculty-flag-box"));
    }

    const studyRow = make("div", null, "session-actions");
    const modalHsMod = session.hsModule || (/^HS[1-6]$/.test(session.docLink || "") ? session.docLink : "");
    if (modalHsMod && session.category !== "HOLIDAY") {
      const bHsd = make(
        "button",
        ROLE === "faculty" ? `เปิดโจทย์ & เฉลย Discussion (${modalHsMod}) →` : `เปิดโจทย์ & ใบงาน Discussion (${modalHsMod}) →`,
        session.hsModule ? "btn sm primary" : "btn sm"
      );
      bHsd.type = "button";
      bHsd.addEventListener("click", () => {
        closeEventModal();
        openHsDiscussion(modalHsMod);
      });
      studyRow.appendChild(bHsd);
    }
    if (typeof appendSessionMaterialButtons === "function" && session.category !== "HOLIDAY") {
      appendSessionMaterialButtons(studyRow, session, true);
    } else {
      if (session.conciseLink) {
        const bc = make("button", `อ่านบทเรียนฉบับย่อ (${session.hsModule || session.docLink})`, "btn sm teal");
        bc.type = "button";
        bc.addEventListener("click", () => {
          closeEventModal();
          openTextbookDoc(session.conciseLink);
        });
        studyRow.appendChild(bc);
      }
      if (session.docLink) {
        const bd = make("button", `อ่านฉบับเต็ม (${session.docLink})`, session.conciseLink ? "btn sm" : "btn sm teal");
        bd.type = "button";
        bd.addEventListener("click", () => {
          closeEventModal();
          openTextbookDoc(session.docLink);
        });
        studyRow.appendChild(bd);
      }
      if (session.wbLink) {
        const bw = make("button", `Worksheet (${session.wbLink.replace("-WB", "")})`, "btn sm");
        bw.type = "button";
        bw.addEventListener("click", () => {
          closeEventModal();
          openTextbookDoc(session.wbLink);
        });
        studyRow.appendChild(bw);
      }
    }
    if (session.actionUrl) {
      const ba = make("a", session.actionLabel || "เปิดลิงก์ส่งงาน ↗", "btn sm primary");
      ba.href = session.actionUrl;
      ba.target = "_blank";
      ba.rel = "noopener";
      studyRow.appendChild(ba);
    }
    if (session.code === "SRN 2 & SLIDES") {
      const br = make("a", "ส่ง SRN 2 ในห้องเรียน E-learning ↗", "btn sm primary");
      br.href = getActiveRamedTargetUrl();
      br.target = "_blank";
      br.rel = "noopener";
      studyRow.appendChild(br);
    }
    if (session.code === "SRN 1" || session.code === "SRN 2 & SLIDES") {
      const bs = make("button", "เตรียมไฟล์ & ศูนย์การส่งงาน", "btn sm teal");
      bs.type = "button";
      bs.addEventListener("click", () => {
        closeEventModal();
        if ($("srnRoundSelect")) {
          $("srnRoundSelect").value = session.code === "SRN 1" ? "SRN1" : "SRN2";
          updateSrnFilename();
        }
        switchTab("submissions");
      });
      studyRow.appendChild(bs);
    }
    if (studyRow.childElementCount > 0) card.appendChild(studyRow);

    const footer = make("div", null, "cal-modal-footer");
    const leftExport = make("div", null, "header-actions");
    const gcalBtn = make("a", "+ เพิ่มเข้า Google Calendar ทันที ↗", "btn sm cal-gcal-btn");
    gcalBtn.href = buildGoogleCalendarTemplateUrl(session);
    gcalBtn.target = "_blank";
    gcalBtn.rel = "noopener";

    const icsBtn = make("button", null, "btn sm cal-ics-btn");
    icsBtn.type = "button";
    icsBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Export เฉพาะคาบนี้ (.ics)`;
    icsBtn.addEventListener("click", () => downloadSingleSessionIcs(session));

    leftExport.append(gcalBtn, icsBtn);

    const viewAgendaBtn = make("button", "ดูในมุมมองกำหนดการเต็ม", "btn sm");
    viewAgendaBtn.type = "button";
    viewAgendaBtn.addEventListener("click", () => {
      closeEventModal();
      state.schedSub = "daily";
      syncSegButtons();
      renderScheduleCurrent();
    });

    footer.append(leftExport, viewAgendaBtn);
    card.appendChild(footer);

    modal.hidden = false;
  }

  function closeEventModal() {
    const modal = $("calendarEventModal");
    if (modal) modal.hidden = true;
  }

  /* ---------- Dual-Format Calendar Downloads: iCalendar (.ics) & Google Calendar (.csv) ---------- */
  function escapeIcsText(str) {
    return String(str == null ? "" : str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function buildEventDescriptionAndLocation(session, eff) {
    const descParts = [];
    if (session.zoom) {
      descParts.push(
        `🎥 ลิงก์เข้าห้องเรียน Zoom: ${session.zoom.url}`,
        `Meeting ID: ${session.zoom.id} | Passcode: ${session.zoom.pass}`,
        ""
      );
    }
    if (session.actionUrl) {
      descParts.push(`🔗 ลิงก์ส่งงาน/แบบฟอร์ม: ${session.actionUrl}`, "");
    }
    if (session.objectives) {
      descParts.push(`วัตถุประสงค์: ${session.objectives}`);
    }
    descParts.push(
      `อาจารย์ผู้สอน: ${eff.lecturer}`,
      `สถานที่/ห้องเรียน: ${eff.room}`,
      `รูปแบบ: ${session.format || ""}${session.checkIn ? " (" + session.checkIn + ")" : ""}`
    );

    const locationStr = session.zoom
      ? `${eff.room} | Zoom: ${session.zoom.url}`
      : eff.room;

    return {
      description: descParts.filter((x) => x !== undefined).join("\n").trim(),
      location: locationStr
    };
  }

  function getSessionsForExport() {
    const ctx = getActivePersonalContext();
    return (SCHED.sessions || []).filter((s) => {
      if (ROLE === "student" && s.studentVisible === false) return false;
      if (!s.dateISO) return false;
      const assignments = getSessionAssignments(s);
      if (!sessionMatchesTeacher(s, ctx.teacherVal, assignments)) return false;
      if (ctx.areaVal && s.allowedSites && ctx.siteObj) {
        if (!s.allowedSites.includes(ctx.siteObj.id)) return false;
      } else if (!ctx.areaVal && !ctx.teacherVal && (s.code === "TRAVEL" || s.code === "RETURN")) {
        // In unfiltered whole-class mode, keep w4-fieldwork and avoid duplicating all 9 travel batches unless filtering
        return true;
      }
      return true;
    });
  }

  function buildIcsCalendarString(sessions, calName) {
    const ctx = getActivePersonalContext();
    const stamp = "20261118T070000Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ramathibodi Community Medicine//RACM 303 2569//TH",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(calName)}`,
      "X-WR-TIMEZONE:Asia/Bangkok",
      "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
      "X-PUBLISHED-TTL:PT12H",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Bangkok",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0700",
      "TZOFFSETTO:+0700",
      "TZNAME:+07",
      "END:STANDARD",
      "END:VTIMEZONE"
    ];

    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      const { description, location } = buildEventDescriptionAndLocation(s, eff);
      const summary = `[RACM 303] ${eff.title}`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${s.id}@racm303-2569.mahidol.ac.th`);
      lines.push(`DTSTAMP:${stamp}`);

      if (eff.isAllDay) {
        const dStart = eff.startISO.replace(/-/g, "");
        const dEndExclusive = addDaysISO(eff.endISO || eff.startISO, 1).replace(/-/g, "");
        lines.push(`DTSTART;VALUE=DATE:${dStart}`);
        lines.push(`DTEND;VALUE=DATE:${dEndExclusive}`);
      } else {
        const dStart = eff.startISO.replace(/-/g, "");
        const dEnd = (eff.endISO || eff.startISO).replace(/-/g, "");
        const tStart = (s.startTime || "09:00").replace(":", "") + "00";
        const tEnd = (s.endTime || "12:00").replace(":", "") + "00";
        lines.push(`DTSTART;TZID=Asia/Bangkok:${dStart}T${tStart}`);
        lines.push(`DTEND;TZID=Asia/Bangkok:${dEnd}T${tEnd}`);
      }

      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
      lines.push(`LOCATION:${escapeIcsText(location)}`);
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
      if (s.zoom && s.zoom.url) {
        lines.push(`URL:${s.zoom.url}`);
        lines.push(`X-GOOGLE-CONFERENCE:${s.zoom.url}`);
      } else if (s.actionUrl) {
        lines.push(`URL:${s.actionUrl}`);
      }

      if (!eff.isAllDay && s.category !== "HOLIDAY") {
        const alarmTrigger = s.code === "TRAVEL" ? "-PT60M" : "-PT15M";
        lines.push(
          "BEGIN:VALARM",
          `TRIGGER:${alarmTrigger}`,
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeIcsText("แจ้งเตือนกำหนดการ " + summary)}`,
          "END:VALARM"
        );
      }

      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  function getExportFilenameSuffix() {
    const ctx = getActivePersonalContext();
    if (state.myStudent) return `_${state.myStudent.id}_${state.myStudent.area.replace(/\s+/g, "")}`;
    if (ctx.teacherVal) return `_${ctx.teacherVal.replace(/\s+/g, "_")}`;
    if (ctx.siteObj) return `_กลุ่ม${ctx.siteObj.shortName.replace(/\s+/g, "")}`;
    if (ctx.discVal) return `_Disc${ctx.discVal}`;
    return "";
  }

  function getActiveCalendarDisplayName() {
    const ctx = getActivePersonalContext();
    if (state.myStudent) {
      return `RACM 303 (2569) · ${state.myStudent.fullName} (${state.myStudent.area})`;
    }
    if (ctx.teacherVal) {
      return `RACM 303 (2569) · อาจารย์ ${ctx.teacherVal}`;
    }
    if (ctx.siteObj) {
      return `RACM 303 (2569) · กลุ่ม ${ctx.siteObj.hospital}`;
    }
    return "RACM 303 (ปีการศึกษา 2569)";
  }

  function triggerBlobDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function downloadScheduleIcs() {
    const sessions = getSessionsForExport();
    const ics = buildIcsCalendarString(sessions, getActiveCalendarDisplayName());
    triggerBlobDownload(ics, "text/calendar;charset=utf-8", `RACM303_2569_Calendar${getExportFilenameSuffix()}.ics`);
  }

  function downloadSingleSessionIcs(session) {
    const ics = buildIcsCalendarString([session], `RACM 303 · ${session.code}`);
    triggerBlobDownload(ics, "text/calendar;charset=utf-8", `RACM303_2569_${session.id}.ics`);
  }

  function csvCell(val) {
    const s = String(val == null ? "" : val).replace(/"/g, '""');
    return `"${s}"`;
  }

  function downloadScheduleGoogleCsv() {
    const sessions = getSessionsForExport();
    const ctx = getActivePersonalContext();
    const header = [
      "Subject",
      "Start Date",
      "Start Time",
      "End Date",
      "End Time",
      "All Day Event",
      "Description",
      "Location",
      "Private"
    ].join(",");

    const rows = [header];
    sessions.forEach((s) => {
      const eff = resolveEffectiveSessionDetails(s, ctx);
      const { description, location } = buildEventDescriptionAndLocation(s, eff);
      const subject = `[RACM 303] ${eff.title}`;
      const startDate = isoToUsDate(eff.startISO);
      const endDate = isoToUsDate(eff.endISO || eff.startISO);
      const startTime = eff.isAllDay ? "" : to12HourAmPm(s.startTime || "09:00");
      const endTime = eff.isAllDay ? "" : to12HourAmPm(s.endTime || "12:00");
      const allDay = eff.isAllDay ? "True" : "False";

      rows.push(
        [
          csvCell(subject),
          csvCell(startDate),
          csvCell(startTime),
          csvCell(endDate),
          csvCell(endTime),
          csvCell(allDay),
          csvCell(description),
          csvCell(location),
          csvCell("False")
        ].join(",")
      );
    });

    const csvContent = "\uFEFF" + rows.join("\r\n") + "\r\n";
    triggerBlobDownload(
      csvContent,
      "text/csv;charset=utf-8",
      `RACM303_2569_GoogleCalendar${getExportFilenameSuffix()}.csv`
    );
  }

  function buildGoogleCalendarTemplateUrl(session) {
    const ctx = getActivePersonalContext();
    const eff = resolveEffectiveSessionDetails(session, ctx);
    const { description, location } = buildEventDescriptionAndLocation(session, eff);

    let datesParam = "";
    if (eff.isAllDay) {
      const d1 = eff.startISO.replace(/-/g, "");
      const d2 = addDaysISO(eff.endISO || eff.startISO, 1).replace(/-/g, "");
      datesParam = `${d1}/${d2}`;
    } else {
      const d1 = eff.startISO.replace(/-/g, "");
      const d2 = (eff.endISO || eff.startISO).replace(/-/g, "");
      const t1 = (session.startTime || "09:00").replace(":", "") + "00";
      const t2 = (session.endTime || "12:00").replace(":", "") + "00";
      datesParam = `${d1}T${t1}/${d2}T${t2}`;
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `[RACM 303] ${eff.title}`,
      dates: datesParam,
      ctz: "Asia/Bangkok",
      location: location,
      details: description
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /* ---------- Roster Navigation Helper from Schedule Sessions ---------- */
  function jumpToClassRoster(session, assignment) {
    const ctxPayload = {
      topic: session.title,
      date: session.dateTH,
      time: session.timeLabel,
      lecturer: assignment.lecturer || session.lecturers,
      room: assignment.room || session.room,
      type: assignment.type,
      groupId: assignment.groupId,
      label: assignment.label
    };

    if (assignment.type === "discussion") {
      state.discContext = ctxPayload;
      if ($("discSearchInput")) $("discSearchInput").value = "";
      if ($("discGroupSelect")) $("discGroupSelect").value = assignment.groupId || "";
      switchTab("discussion");
    } else {
      state.fieldContext = ctxPayload;
      if ($("fieldSearchInput")) $("fieldSearchInput").value = "";
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = assignment.type === "area" ? (assignment.groupId || "") : "";
      switchTab("fieldwork");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncPhotoToggleButtons() {
    const label = state.showPhotos ? "ซ่อนรูปถ่าย (โหมดกะทัดรัด)" : "แสดงรูปถ่ายนักศึกษา";
    ["discTogglePhotosBtn", "fieldTogglePhotosBtn"].forEach((id) => {
      if ($(id)) $(id).textContent = label;
    });
  }

  function renderStudentCardElement(s, mode) {
    const siteId = getSiteIdByAreaName(s.area);
    const parts = getStudentNameParts(s);
    const card = make("article", null, `student-card is-interactive card-site-${siteId} chip-site-${siteId}`);
    if (state.myStudent && state.myStudent.id === s.id) {
      card.classList.add("is-my-student");
    }
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${parts.lead} ${parts.paren} รหัส ${s.id} คลิกเพื่อดูรายละเอียดและตารางเรียน`);

    const initials = studentInitials(s);
    const portrait = make("div", null, `student-portrait${state.showPhotos ? "" : " compact-avatar"}`);
    portrait.dataset.studentId = s.id || "";
    portrait.dataset.photoId = s.photoId || "";
    portrait.dataset.initials = initials;
    portrait.dataset.studentName = s.fullName;
    portrait.innerHTML = `<span class="avatar-monogram">${escapeHtml(initials)}</span>`;
    if (state.showPhotos && (s.id || s.photoId)) {
      if (photoObserver) photoObserver.observe(portrait);
      else mountStudentPhoto(portrait);
    }

    card.appendChild(portrait);
    card.appendChild(make("h3", parts.lead, "stu-card-lead"));
    if (parts.paren) {
      card.appendChild(make("p", parts.paren, "stu-card-paren"));
    }
    card.appendChild(make("p", `รหัส: ${s.id}${s.program === "MD-M.Eng" ? " (MD-M.Eng)" : ""}`, "sid-mono"));

    const pillWrap = make("div", null, "s-area area-sub-pill-wrap");
    pillWrap.innerHTML = `<span class="area-sub-pill area-site-${siteId}"><i class="area-dot"></i>${siteId}. ${escapeHtml(s.area)}</span>`;

    if (mode === "discussion") {
      const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc);
      card.appendChild(make("p", `Discussion กลุ่มที่ ${s.disc}${rot ? " · ห้อง " + rot.room : ""}`, "disc-room-line"));
      card.appendChild(pillWrap);
    } else {
      card.appendChild(pillWrap);
      card.appendChild(make("p", `Discussion: กลุ่มที่ ${s.disc}`, "disc-line"));
    }

    const hint = make("span", "ดูข้อมูล & ตาราง ↗", "student-quick-hint");
    card.appendChild(hint);

    card.addEventListener("click", () => openStudentQuickModal(s));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openStudentQuickModal(s);
      }
    });
    return card;
  }

  /* ---------- Student Quick-Look Inspector Sheet (User-Centric Profile & Actions) ---------- */
  function openStudentQuickModal(s) {
    if (!s) return;
    let backdrop = $("studentQuickModal");
    if (!backdrop) {
      backdrop = make("div", null, "cal-modal-backdrop");
      backdrop.id = "studentQuickModal";
      backdrop.setAttribute("role", "dialog");
      backdrop.setAttribute("aria-modal", "true");
      backdrop.setAttribute("aria-label", "ข้อมูลนักศึกษาและทางลัดตารางเรียน");
      backdrop.hidden = true;
      const card = make("div", null, "cal-modal-card stu-quick-modal-card");
      card.id = "studentQuickModalCard";
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      backdrop.addEventListener("click", (ev) => {
        if (ev.target === backdrop) backdrop.hidden = true;
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !backdrop.hidden) backdrop.hidden = true;
      });
    }

    const card = $("studentQuickModalCard");
    if (!card) return;
    card.replaceChildren();

    const siteId = getSiteIdByAreaName(s.area);
    const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area) || {};
    const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc) || {};
    const isMine = state.myStudent && state.myStudent.id === s.id;
    const parts = getStudentNameParts(s);

    const top = make("div", null, "cal-modal-top");
    const profileHead = make("div", null, "stu-quick-head");
    const portrait = make("div", null, "student-portrait stu-quick-portrait");
    portrait.dataset.studentId = s.id || "";
    portrait.dataset.photoId = s.photoId || "";
    portrait.dataset.initials = studentInitials(s);
    portrait.dataset.studentName = s.fullName;
    portrait.innerHTML = `<span class="avatar-monogram">${escapeHtml(studentInitials(s))}</span>`;
    mountStudentPhoto(portrait);

    const headInfo = make("div", null, "stu-quick-title-col");
    const badgesRow = make("div", null, "stu-quick-badges");
    badgesRow.innerHTML = `<span class="badge cat-EP">รหัส ${escapeHtml(s.id)}</span>` +
      `<span class="area-sub-pill sm area-site-${siteId}"><i class="area-dot"></i>${siteId}. ${escapeHtml(s.area)}</span>` +
      `<span class="badge">${escapeHtml(s.program === "MD-M.Eng" ? "พ.บ.–วศ.ม. (MD-M.Eng)" : "หลักสูตร พ.บ. ชั้นปีที่ 3")}</span>` +
      (isMine ? `<span class="badge cat-HS">★ ตารางของฉัน</span>` : "");
    headInfo.appendChild(badgesRow);
    const h3Title = make("h3", "");
    h3Title.innerHTML = `${escapeHtml(parts.lead)}${parts.paren ? ` <span class="stu-modal-paren">${escapeHtml(parts.paren)}</span>` : ""}`;
    headInfo.appendChild(h3Title);
    headInfo.appendChild(
      make("p", `Discussion กลุ่มที่ ${s.disc}${rot.room ? " (ห้อง " + rot.room + ")" : ""} · พื้นที่ภาคสนาม ${siteId}. ${s.area}`, "stu-quick-sub")
    );

    const nickBar = make("div", null, "stu-nick-inline-bar");
    const nickInp = document.createElement("input");
    nickInp.type = "text";
    nickInp.className = "stu-nick-inline-input";
    nickInp.placeholder = "ตั้ง/แก้ไขชื่อเล่น…";
    nickInp.value = getEffectiveNickname(s);
    const nickSaveBtn = make("button", "บันทึกชื่อเล่น", "btn sm teal");
    nickSaveBtn.type = "button";
    nickSaveBtn.addEventListener("click", () => {
      saveStudentNicknameOverride(s.id, nickInp.value);
      if (state.activeTab === "discussion") renderDiscussionView();
      else if (state.activeTab === "fieldwork") renderFieldworkView();
      if (typeof renderRoleConcierge === "function") renderRoleConcierge();
      openStudentQuickModal(s);
    });
    nickInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        nickSaveBtn.click();
      }
    });
    nickBar.append(make("span", "✏️ ชื่อเล่น:", "stu-nick-inline-lbl"), nickInp, nickSaveBtn);
    headInfo.appendChild(nickBar);

    profileHead.append(portrait, headInfo);

    const closeBtn = make("button", "✕", "cal-modal-close");
    closeBtn.type = "button";
    closeBtn.title = "ปิดหน้าต่าง (Esc)";
    closeBtn.addEventListener("click", () => {
      backdrop.hidden = true;
    });
    top.append(profileHead, closeBtn);
    card.appendChild(top);

    const detailGrid = make("div", null, "stu-quick-grid");

    // Box 1: Discussion Group
    const discBox = make("div", null, "stu-quick-box");
    discBox.innerHTML = `
      <div class="stu-quick-box-head">
        <strong>กลุ่มอภิปราย Discussion ที่ ${s.disc}</strong>
        <span class="badge cat-HS">ห้องหลัก ${escapeHtml(rot.room || "-")}</span>
      </div>
      <div class="stu-quick-rot-list">
        ${HS_SLOTS_META.map((m) => {
          const cell = rot[m.mod] || {};
          return `<div class="stu-quick-rot-row"><span>${escapeHtml(m.mod)}</span><strong>${escapeHtml(cell.instructor || "-")}</strong><small>ห้อง ${escapeHtml(cell.room || rot.room || "-")}</small></div>`;
        }).join("")}
      </div>
    `;
    const jumpDiscBtn = make("button", `ไปที่รายชื่อกลุ่ม Discussion ${s.disc} →`, "btn sm");
    jumpDiscBtn.type = "button";
    jumpDiscBtn.style.marginTop = "8px";
    jumpDiscBtn.addEventListener("click", () => {
      backdrop.hidden = true;
      if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
      if ($("discAreaSubFilter")) $("discAreaSubFilter").value = "";
      if ($("discSearchInput")) $("discSearchInput").value = "";
      if (state.discViewMode === "deck") state.discDeckIdx = Math.max(0, Number(s.disc) - 1);
      switchTab("discussion");
    });
    discBox.appendChild(jumpDiscBtn);

    // Box 2: Fieldwork Site
    const fieldBox = make("div", null, "stu-quick-box");
    const staffHtml =
      ROLE === "faculty" && site.staffRef
        ? `<p><strong>ผู้ประสานงานพื้นที่:</strong> ${escapeHtml(site.staffRef)}</p>`
        : "";
    fieldBox.innerHTML = `
      <div class="stu-quick-box-head">
        <span class="area-sub-pill area-site-${siteId}"><i class="area-dot"></i>${siteId}. ${escapeHtml(s.area)}</span>
        <span class="badge cat-SG">${site.count || "-"} คน</span>
      </div>
      <div class="stu-quick-meta-lines">
        <p><strong>โรงพยาบาล:</strong> ${escapeHtml(site.hospital || s.area)} (${escapeHtml(site.province || "")})</p>
        <p><strong>อาจารย์ที่ปรึกษา:</strong> ${escapeHtml(s.advisor || site.advisors || "-")}</p>
        <p><strong>ห้องกลุ่มย่อย:</strong> ${escapeHtml(site.room || "-")}</p>
        <p><strong>ช่วงฝึกภาคสนาม:</strong> ${escapeHtml(site.datesTH || "-")}</p>
        ${site.travelNote ? `<p class="muted-line">${escapeHtml(site.travelNote)}</p>` : ""}
        ${staffHtml}
      </div>
    `;
    const jumpFieldBtn = make("button", `ไปที่รายชื่อกลุ่มพื้นที่ ${s.area} →`, "btn sm");
    jumpFieldBtn.type = "button";
    jumpFieldBtn.style.marginTop = "8px";
    jumpFieldBtn.addEventListener("click", () => {
      backdrop.hidden = true;
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = s.area;
      if ($("fieldSearchInput")) $("fieldSearchInput").value = "";
      if (state.fieldViewMode === "deck") {
        const idx = (SCHED.fieldworkSites || []).findIndex((x) => x.shortName === s.area);
        if (idx >= 0) state.fieldDeckIdx = idx;
      }
      switchTab("fieldwork");
    });
    fieldBox.appendChild(jumpFieldBtn);

    detailGrid.append(discBox, fieldBox);
    card.appendChild(detailGrid);

    const footer = make("div", null, "cal-modal-footer stu-quick-footer");
    const bindBtn = make(
      "button",
      isMine ? "✓ กำลังผูกตารางของคนนี้อยู่ · เปิดปฏิทิน" : "★ ผูกตารางเรียน & ดูปฏิทินของคนนี้",
      "btn primary sm"
    );
    bindBtn.type = "button";
    bindBtn.addEventListener("click", () => {
      state.calScope = "student";
      applyMyStudent(s, true);
      backdrop.hidden = true;
      switchTab("schedule");
    });

    const icsLink = make("a", "📅 ปฏิทิน .ics เฉพาะคนนี้", "btn teal sm");
    icsLink.href = `calendars/d${s.disc}_g${siteId}.ics`;
    icsLink.setAttribute("download", `RACM303_2569_${s.id}_d${s.disc}_g${siteId}.ics`);

    const copyBtn = make("button", "📋 คัดลอกข้อมูล", "btn sm");
    copyBtn.type = "button";
    copyBtn.addEventListener("click", () => {
      const summaryText = [
        `${s.id} ${s.fullName}${s.nickname ? " (" + s.nickname + ")" : ""}`,
        `Discussion กลุ่มที่ ${s.disc} (ห้อง ${rot.room || "-"})`,
        `พื้นที่ภาคสนาม: ${siteId}. ${s.area} (${site.hospital || ""} ${site.province || ""})`,
        `อาจารย์ที่ปรึกษา: ${s.advisor || site.advisors || "-"}`
      ].join(" | ");
      copyTextWithFeedback(summaryText, copyBtn);
    });

    footer.append(bindBtn, icsLink, copyBtn);
    card.appendChild(footer);

    backdrop.hidden = false;
  }

  /* ---------- Admin Roster Export & Clipboard Helpers ---------- */
  function exportRosterCsv(list, labelSlug) {
    if (!list || !list.length) return;
    const header = [
      "ลำดับ",
      "รหัสนักศึกษา",
      "ชื่อ-นามสกุล",
      "ชื่อเล่น",
      "หลักสูตร",
      "กลุ่ม Discussion",
      "ห้องหลัก Discussion",
      "ลำดับพื้นที่",
      "กลุ่มพื้นที่ภาคสนาม",
      "โรงพยาบาลชุมชน",
      "จังหวัด",
      "อาจารย์ที่ปรึกษา"
    ].join(",");

    const rows = [header];
    list.forEach((s, i) => {
      const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area) || {};
      const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc) || {};
      rows.push(
        [
          csvCell(i + 1),
          csvCell(s.id),
          csvCell(s.fullName),
          csvCell(s.nickname || ""),
          csvCell(s.program || "MD"),
          csvCell(`กลุ่มที่ ${s.disc}`),
          csvCell(rot.room || ""),
          csvCell(site.id || ""),
          csvCell(s.area),
          csvCell(site.hospital || ""),
          csvCell(site.province || ""),
          csvCell(s.advisor || site.advisors || "")
        ].join(",")
      );
    });
    const safeSlug = String(labelSlug || "roster").replace(/[^\wก-๙-]+/g, "_");
    triggerBlobDownload("\uFEFF" + rows.join("\r\n") + "\r\n", "text/csv;charset=utf-8", `RACM303_2569_${safeSlug}_${list.length}.csv`);
  }

  function copyRosterTsv(list, btn) {
    if (!list || !list.length) return;
    const lines = [
      ["ลำดับ", "รหัสนักศึกษา", "ชื่อ-นามสกุล", "ชื่อเล่น", "หลักสูตร", "Discussion", "พื้นที่ภาคสนาม", "อาจารย์ที่ปรึกษา"].join("\t")
    ];
    list.forEach((s, idx) => {
      lines.push(
        [
          idx + 1,
          s.id,
          s.fullName,
          s.nickname || "-",
          s.program || "MD",
          `กลุ่ม ${s.disc}`,
          s.area,
          s.advisor || "-"
        ].join("\t")
      );
    });
    copyTextWithFeedback(lines.join("\n"), btn, `คัดลอก ${list.length} รายชื่อ ✓`);
  }

  /* ---------- Sticky User-Centric Roster Command Dock, Multi-View & Zoom Controller ---------- */
  let rosterDeckKeyBound = false;

  function clampRosterZoom(val) {
    const n = Math.round((Number(val) || 100) / 10) * 10;
    return Math.max(50, Math.min(160, n));
  }

  function applyRosterZoomVars() {
    const pct = clampRosterZoom(state.rosterZoomPct);
    state.rosterZoomPct = pct;
    localStorage.setItem("racm303_roster_zoom", String(pct));
    const cardMin = Math.round(Math.max(112, Math.min(300, 192 * (pct / 100))));
    const sorterMin = Math.round(Math.max(195, Math.min(480, 310 * (pct / 100))));
    const fontScale = (0.82 + (pct - 50) * 0.0034).toFixed(3);
    const chipAvatar = Math.round(Math.max(20, Math.min(42, 28 * (pct / 100))));

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--roster-card-min", `${cardMin}px`);
    rootStyle.setProperty("--gsorter-col-min", `${sorterMin}px`);
    rootStyle.setProperty("--roster-scale", fontScale);
    rootStyle.setProperty("--gsorter-avatar-px", `${chipAvatar}px`);

    document.querySelectorAll("[data-roster-zoom-range]").forEach((el) => {
      if (Number(el.value) !== pct) el.value = String(pct);
    });
    document.querySelectorAll("[data-roster-zoom-reset]").forEach((btn) => {
      btn.textContent = `${pct}%`;
    });
  }

  function setRosterZoom(nextPct) {
    state.rosterZoomPct = clampRosterZoom(nextPct);
    applyRosterZoomVars();
  }

  function ensureRosterSuite(scope) {
    const isDisc = scope === "discussion";
    const cardsEl = $(isDisc ? "discCardsContainer" : "fieldCardsContainer");
    if (!cardsEl || !cardsEl.parentElement) return null;
    const parent = cardsEl.parentElement;

    let dock = parent.querySelector(`.roster-sticky-dock[data-scope="${scope}"]`);
    if (dock) {
      return {
        dock,
        formationStage: parent.querySelector(`.roster-formation-stage[data-scope="${scope}"]`),
        sorterStage: parent.querySelector(`.roster-gsorter-stage[data-scope="${scope}"]`),
        deckStage: parent.querySelector(`.roster-gdeck-stage[data-scope="${scope}"]`),
        tableStage: parent.querySelector(`.roster-admin-table-stage[data-scope="${scope}"]`),
        cardsEl
      };
    }

    dock = make("div", null, "roster-sticky-dock");
    dock.dataset.scope = scope;
    dock.setAttribute("aria-label", isDisc ? "แถบค้นหาและสลับมุมมองกลุ่ม Discussion" : "แถบค้นหาและสลับมุมมอง 9 พื้นที่ภาคสนาม");

    const topRow = make("div", null, "roster-dock-top");

    // 1. Live Search Input (Focus-safe!)
    const searchWrap = make("div", null, "roster-dock-search");
    const searchIcon = make("span", "🔍", "roster-dock-search-ico");
    searchIcon.setAttribute("aria-hidden", "true");
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "roster-dock-search-input";
    searchInput.placeholder = isDisc
      ? "ค้นหาด่วนตลอดหน้า: รหัส 7 หลัก, ชื่อ, ชื่อเล่น, พื้นที่, อาจารย์…"
      : "ค้นหาด่วนตลอดหน้า: รหัส 7 หลัก, ชื่อ, ชื่อเล่น, รพช., อาจารย์ที่ปรึกษา…";
    searchInput.setAttribute("aria-label", searchInput.placeholder);

    const clearSearchBtn = make("button", "✕", "roster-dock-clear-btn");
    clearSearchBtn.type = "button";
    clearSearchBtn.title = "ล้างคำค้นหา";
    clearSearchBtn.hidden = true;

    const baseSearchInput = $(isDisc ? "discSearchInput" : "fieldSearchInput");
    searchInput.addEventListener("input", () => {
      if (baseSearchInput && baseSearchInput.value !== searchInput.value) {
        baseSearchInput.value = searchInput.value;
      }
      clearSearchBtn.hidden = !searchInput.value;
      if (isDisc) renderDiscussionView();
      else renderFieldworkView();
    });
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      if (baseSearchInput) baseSearchInput.value = "";
      clearSearchBtn.hidden = true;
      searchInput.focus();
      if (isDisc) renderDiscussionView();
      else renderFieldworkView();
    });
    searchWrap.append(searchIcon, searchInput, clearSearchBtn);

    // 2. 4-Way Segmented View Switcher
    const viewSeg = make("div", null, "reader-mode-seg roster-view-seg");
    viewSeg.setAttribute("role", "group");
    viewSeg.setAttribute("aria-label", "เลือกรูปแบบการแสดงรายชื่อกลุ่ม");
    const modes = [
      { id: "cards", label: "☰ การ์ดรูป", title: "มุมมองการ์ดรูปถ่ายต่อเนื่อง (ย่อ-ขยายขนาดการ์ดได้)" },
      { id: "formation", label: "⚡ Formation", title: "ผังทีมแบบ Broadcast Formation พร้อมแท็บสลับกลุ่มกระชับ" },
      { id: "deck", label: "▣ ทีละกลุ่ม", title: "เลื่อนดูทีละกลุ่มซ้าย-ขวา (ลูกศร ← / → หรือปัดนิ้ว)" },
      { id: "sorter", label: "⊞ Group Sorter", title: "กระดานภาพรวมทุกกลุ่มพร้อมกัน ย่อ-ขยายเทียบสมาชิกทุกกลุ่ม" },
      { id: "table", label: "≡ ตาราง Admin", title: "ตารางจัดการรายชื่อสำหรับผู้ประสานงาน เรียงคอลัมน์และส่งออกได้ทันที" }
    ];
    modes.forEach((m) => {
      const b = make("button", m.label, "reader-mode-btn");
      b.type = "button";
      b.dataset.rosterView = m.id;
      b.title = m.title;
      b.addEventListener("click", () => {
        if (isDisc) {
          state.discViewMode = m.id;
          const curSel = ($("discGroupSelect") && $("discGroupSelect").value) || "";
          if ((m.id === "deck" || m.id === "formation") && curSel) {
            state.discDeckIdx = Math.max(0, Number(curSel) - 1);
          }
          renderDiscussionView();
        } else {
          state.fieldViewMode = m.id;
          const curArea = ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "";
          if ((m.id === "deck" || m.id === "formation") && curArea) {
            const foundIdx = (SCHED.fieldworkSites || []).findIndex((x) => x.shortName === curArea);
            if (foundIdx >= 0) state.fieldDeckIdx = foundIdx;
          }
          renderFieldworkView();
        }
      });
      viewSeg.appendChild(b);
    });

    // 3. Zoom In / Zoom Out Cluster + Admin Copy / CSV
    const rightCluster = make("div", null, "roster-dock-actions");
    const zoomBox = make("div", null, "reader-zoom-cluster roster-zoom-cluster");
    const zOut = make("button", "−", "reader-zoom-step");
    zOut.type = "button";
    zOut.title = "ซูมออก (ย่อขนาดการ์ด/ตารางให้เห็นภาพรวมมากขึ้น)";
    zOut.addEventListener("click", () => setRosterZoom(state.rosterZoomPct - 15));

    const zRange = document.createElement("input");
    zRange.type = "range";
    zRange.className = "reader-zoom-range";
    zRange.min = "50";
    zRange.max = "160";
    zRange.step = "10";
    zRange.value = String(clampRosterZoom(state.rosterZoomPct));
    zRange.dataset.rosterZoomRange = scope;
    zRange.setAttribute("aria-label", "แถบซูมย่อ-ขยายรายชื่อกลุ่ม");
    zRange.addEventListener("input", () => setRosterZoom(Number(zRange.value)));

    const zIn = make("button", "+", "reader-zoom-step");
    zIn.type = "button";
    zIn.title = "ซูมเข้า (ขยายรูปถ่ายและตัวอักษรให้ใหญ่ขึ้น)";
    zIn.addEventListener("click", () => setRosterZoom(state.rosterZoomPct + 15));

    const zReset = make("button", `${clampRosterZoom(state.rosterZoomPct)}%`, "reader-zoom-pct-btn");
    zReset.type = "button";
    zReset.dataset.rosterZoomReset = scope;
    zReset.title = "คลิกเพื่อรีเซ็ตระดับการซูมเป็น 100%";
    zReset.addEventListener("click", () => setRosterZoom(100));

    zoomBox.append(zOut, zRange, zIn, zReset);

    const copyBtn = make("button", "📋 คัดลอก", "btn sm");
    copyBtn.type = "button";
    copyBtn.title = "คัดลอกตารางรายชื่อชุดที่กรองอยู่สำหรับวางใน Excel / Google Sheets";
    copyBtn.addEventListener("click", () => {
      const activeList = isDisc ? state.visibleDiscStudents : state.visibleFieldStudents;
      copyRosterTsv(activeList, copyBtn);
    });

    const csvBtn = make("button", "⬇ CSV", "btn sm");
    csvBtn.type = "button";
    csvBtn.title = "ดาวน์โหลดไฟล์ CSV (UTF-8 รองรับภาษาไทยใน Excel) ของรายชื่อชุดที่แสดงอยู่";
    csvBtn.addEventListener("click", () => {
      const activeList = isDisc ? state.visibleDiscStudents : state.visibleFieldStudents;
      const subLabel = isDisc
        ? (($("discGroupSelect") && $("discGroupSelect").value) ? `Discussion_G${$("discGroupSelect").value}` : "Discussion_All")
        : (($("fieldAreaSelect") && $("fieldAreaSelect").value) || "Fieldwork_All");
      exportRosterCsv(activeList, subLabel);
    });

    rightCluster.append(zoomBox, copyBtn, csvBtn);
    topRow.append(searchWrap, viewSeg, rightCluster);

    // Row 2: Persistent Quick-Jump Group Pills
    const jumpStrip = make("div", null, "roster-jump-strip");
    jumpStrip.dataset.jumpStrip = scope;
    dock.append(topRow, jumpStrip);

    const formationStage = make("div", null, "roster-formation-stage");
    formationStage.dataset.scope = scope;
    formationStage.hidden = true;

    const sorterStage = make("div", null, "roster-gsorter-stage");
    sorterStage.dataset.scope = scope;
    sorterStage.hidden = true;

    const deckStage = make("div", null, "roster-gdeck-stage");
    deckStage.dataset.scope = scope;
    deckStage.hidden = true;

    const tableStage = make("div", null, "roster-admin-table-stage");
    tableStage.dataset.scope = scope;
    tableStage.hidden = true;

    const printHeading = $(isDisc ? "discPrintHeading" : "fieldPrintHeading");
    const anchorBefore = printHeading || cardsEl;
    parent.insertBefore(dock, anchorBefore);
    parent.insertBefore(formationStage, cardsEl);
    parent.insertBefore(sorterStage, cardsEl);
    parent.insertBefore(deckStage, cardsEl);
    parent.insertBefore(tableStage, cardsEl);

    // Alt + Mouse Wheel smooth zoom on any roster stage
    [cardsEl, sorterStage, deckStage, tableStage].forEach((stageEl) => {
      stageEl.addEventListener(
        "wheel",
        (ev) => {
          if (!ev.altKey) return;
          ev.preventDefault();
          setRosterZoom(state.rosterZoomPct + (ev.deltaY < 0 ? 10 : -10));
        },
        { passive: false }
      );
    });

    if (!rosterDeckKeyBound) {
      rosterDeckKeyBound = true;
      document.addEventListener("keydown", (ev) => {
        if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const tag = (ev.target && ev.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable)) return;
        if (($("imageLightbox") && !$("imageLightbox").hidden) || ($("studentQuickModal") && !$("studentQuickModal").hidden) || ($("globalSpotlightModal") && !$("globalSpotlightModal").hidden)) {
          return;
        }
        if (state.activeTab === "discussion" && (state.discViewMode === "deck" || state.discViewMode === "formation")) {
          const total = (SCHED.hsGroups || []).length || 6;
          if (ev.key === "ArrowRight") {
            ev.preventDefault();
            state.discDeckIdx = (state.discDeckIdx + 1) % total;
            renderDiscussionView();
          } else if (ev.key === "ArrowLeft") {
            ev.preventDefault();
            state.discDeckIdx = (state.discDeckIdx - 1 + total) % total;
            renderDiscussionView();
          }
        } else if (state.activeTab === "fieldwork" && (state.fieldViewMode === "deck" || state.fieldViewMode === "formation")) {
          const total = (SCHED.fieldworkSites || []).length || 9;
          if (ev.key === "ArrowRight") {
            ev.preventDefault();
            state.fieldDeckIdx = (state.fieldDeckIdx + 1) % total;
            renderFieldworkView();
          } else if (ev.key === "ArrowLeft") {
            ev.preventDefault();
            state.fieldDeckIdx = (state.fieldDeckIdx - 1 + total) % total;
            renderFieldworkView();
          }
        }
      });
    }

    applyRosterZoomVars();
    return { dock, formationStage, sorterStage, deckStage, tableStage, cardsEl };
  }

  function printSingleGroupHelper(scope, groupValue) {
    if (scope === "discussion") {
      const sel = $("discGroupSelect");
      const prev = sel ? sel.value : "";
      if (sel) sel.value = String(groupValue || "");
      renderDiscussionView();
      printRosterOnePage("discussion").finally(() => {
        if (sel && prev !== String(groupValue || "") && state.discViewMode !== "cards") {
          sel.value = prev;
          renderDiscussionView();
        }
      });
    } else {
      const sel = $("fieldAreaSelect");
      const prev = sel ? sel.value : "";
      if (sel) sel.value = String(groupValue || "");
      renderFieldworkView();
      printRosterOnePage("fieldwork").finally(() => {
        if (sel && prev !== String(groupValue || "") && state.fieldViewMode !== "cards") {
          sel.value = prev;
          renderFieldworkView();
        }
      });
    }
  }

  function renderRosterMiniChip(s) {
    const siteId = getSiteIdByAreaName(s.area);
    const parts = getStudentNameParts(s);
    const chip = make("button", null, `gsorter-member-chip chip-site-${siteId}`);
    chip.type = "button";
    if (state.myStudent && state.myStudent.id === s.id) chip.classList.add("is-mine");
    const effNick = getEffectiveNickname(s);
    chip.title = `${s.id} ${s.fullName}${effNick ? " (" + effNick + ")" : ""} · พื้นที่ ${siteId}. ${s.area}`;

    const av = make("span", null, "gsorter-chip-avatar");
    if (state.showPhotos && s.id) {
      const img = document.createElement("img");
      img.src = `assets/photos/${encodeURIComponent(s.id)}.jpg`;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        av.textContent = studentInitials(s);
      };
      av.appendChild(img);
    } else {
      av.textContent = studentInitials(s);
    }

    const label = make("span", null, "gsorter-chip-name");
    label.innerHTML = `<strong class="chip-nick-lead">${escapeHtml(parts.lead)}</strong>${parts.paren ? ` <span class="chip-fullname-paren">${escapeHtml(parts.paren)}</span>` : ""}`;
    const dot = make("i", null, `gsorter-site-dot chip-dot-site-${siteId}`);
    chip.append(av, label, dot);
    chip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openStudentQuickModal(s);
    });
    return chip;
  }

  function renderSiteGroupedMiniChips(students, containerEl) {
    const sites = SCHED.fieldworkSites || [];
    const grouped = new Map();
    sites.forEach((site) => grouped.set(site.shortName, { site, list: [] }));
    (students || []).forEach((s) => {
      if (!grouped.has(s.area)) {
        grouped.set(s.area, { site: { id: getSiteIdByAreaName(s.area), shortName: s.area }, list: [] });
      }
      grouped.get(s.area).list.push(s);
    });

    grouped.forEach(({ site, list }) => {
      if (!list.length) return;
      list.sort((a, b) => compareTH(a.id, b.id));
      const subBlock = make("div", null, `gsorter-site-subgroup chip-site-${site.id}`);
      const subHead = make("div", null, "gsorter-subgroup-head");
      subHead.innerHTML = `<span class="area-sub-pill sm area-site-${site.id}"><i class="area-dot"></i>${escapeHtml(site.shortName)} (${list.length})</span>`;
      const pillsWrap = make("div", null, "gsorter-subgroup-pills");
      list.forEach((s) => pillsWrap.appendChild(renderRosterMiniChip(s)));
      subBlock.append(subHead, pillsWrap);
      containerEl.appendChild(subBlock);
    });
  }

  function renderRosterGroupSorter(scope, stageEl, q, areaSubVal, activeGroupVal) {
    if (!stageEl) return;
    stageEl.replaceChildren();
    const isDisc = scope === "discussion";

    const bar = make("div", null, "gsorter-info-bar");
    bar.innerHTML = isDisc
      ? `<span><strong>⊞ Group Sorter (6 กลุ่ม Discussion · จัดกลุ่มย่อยตามพื้นที่แหล่งฝึก 9 แห่ง)</strong> — ย่อ/ขยายด้วยปุ่ม <code>−</code> <code>+</code> หรือ <code>Alt + เลื่อนเมาส์</code> · คลิกชื่อนักศึกษาเพื่อดูตาราง/ตั้งชื่อเล่น</span>`
      : `<span><strong>⊞ Group Sorter (9 พื้นที่ภาคสนาม)</strong> — เปรียบเทียบสมาชิก อาจารย์ที่ปรึกษา และวันเดินทางครบทั้ง 9 รพช. ในมุมสูง · คลิกชื่อนักศึกษาเพื่อดูข้อมูลด่วน</span>`;
    stageEl.appendChild(bar);

    const grid = make("div", null, "gsorter-grid");
    const matchStudent = (s) => {
      if (isDisc && areaSubVal && s.area !== areaSubVal) return false;
      if (!q) return true;
      const hay = `${s.id} ${s.fullName} ${getEffectiveNickname(s)} discussion กลุ่มที่ ${s.disc} ${s.area} ${s.advisor || ""}`.toLocaleLowerCase("th");
      return hay.includes(q);
    };

    if (isDisc) {
      (SCHED.hsGroups || []).forEach((g, idx) => {
        const rot = (SCHED.hsRotation || []).find((r) => r.group === g.id) || {};
        const allMembers = ROSTER.students.filter((s) => s.disc === g.id).sort((a, b) => compareTH(a.id, b.id));
        const matched = allMembers.filter(matchStudent);
        const hasFilter = Boolean(q || areaSubVal);

        const card = make(
          "article",
          null,
          `gsorter-group-card${String(g.id) === activeGroupVal ? " is-highlighted" : ""}${hasFilter && !matched.length ? " is-dimmed" : ""}`
        );
        const head = make("div", null, "gsorter-card-head");
        const countBadge = hasFilter
          ? `<span class="badge ${matched.length ? "cat-HS" : ""}">พบ ${matched.length} / ${allMembers.length} คน</span>`
          : `<span class="badge cat-HS">${allMembers.length} คน</span>`;
        head.innerHTML = `
          <div>
            <h4>กลุ่ม Discussion ที่ ${g.id}</h4>
            <p class="gsorter-sub">ห้องหลัก ${escapeHtml(rot.room || g.defaultRoom)}</p>
          </div>
          ${countBadge}
        `;
        card.appendChild(head);

        const teachersListWrap = make("div", null, "gsorter-teachers-wrap");
        teachersListWrap.innerHTML = buildHsSixBulletListHtml(rot);
        card.appendChild(teachersListWrap);

        const mixWrap = make("div", null, "disc-site-mix gsorter-mix");
        mixWrap.innerHTML = buildDiscSiteBreakdownHtml(matched.length ? matched : allMembers, g.id);
        card.appendChild(mixWrap);

        const mosaic = make("div", null, "gsorter-avatar-mosaic is-site-grouped");
        const toShow = hasFilter ? matched : allMembers;
        if (toShow.length) {
          renderSiteGroupedMiniChips(toShow, mosaic);
        } else if (hasFilter) {
          mosaic.appendChild(make("span", "ไม่มีสมาชิกที่ตรงกับตัวกรองในกลุ่มนี้", "gsorter-empty-note"));
        }
        card.appendChild(mosaic);

        const foot = make("div", null, "gsorter-card-foot");
        const zoomGroupBtn = make("button", `▶ ซูมเข้ากลุ่มที่ ${g.id}`, "btn sm primary");
        zoomGroupBtn.type = "button";
        zoomGroupBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          state.discDeckIdx = idx;
          state.discViewMode = "deck";
          renderDiscussionView();
        });
        const printOneBtn = make("button", "🖨 พิมพ์ A4", "btn sm");
        printOneBtn.type = "button";
        printOneBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          printSingleGroupHelper("discussion", g.id);
        });
        foot.append(zoomGroupBtn, printOneBtn);
        card.appendChild(foot);

        card.addEventListener("click", () => {
          state.discDeckIdx = idx;
          state.discViewMode = "deck";
          renderDiscussionView();
        });
        grid.appendChild(card);
      });
    } else {
      (SCHED.fieldworkSites || []).forEach((site, idx) => {
        const allMembers = ROSTER.students.filter((s) => s.area === site.shortName).sort((a, b) => compareTH(a.id, b.id));
        const matched = allMembers.filter(matchStudent);
        const hasFilter = Boolean(q);

        const card = make(
          "article",
          null,
          `gsorter-group-card site-accent-${site.id}${site.shortName === activeGroupVal ? " is-highlighted" : ""}${hasFilter && !matched.length ? " is-dimmed" : ""}`
        );
        const head = make("div", null, "gsorter-card-head");
        const countBadge = hasFilter
          ? `<span class="badge ${matched.length ? "cat-SG" : ""}">พบ ${matched.length} / ${allMembers.length} คน</span>`
          : `<span class="badge cat-SG">${allMembers.length} คน</span>`;
        head.innerHTML = `
          <div>
            <h4><span class="area-sub-pill area-site-${site.id}"><i class="area-dot"></i>${site.id}. ${escapeHtml(site.shortName)}</span></h4>
            <p class="gsorter-sub">${escapeHtml(site.hospital)} (${escapeHtml(site.province)})</p>
          </div>
          ${countBadge}
        `;
        card.appendChild(head);

        const metaP = make("p", null, "gsorter-teachers");
        metaP.textContent = `อ.ที่ปรึกษา: ${site.advisors} · ห้อง ${site.room} · ${site.datesTH}`;
        card.appendChild(metaP);
        if (ROLE === "faculty" && site.staffRef) {
          card.appendChild(make("p", `ผู้ประสานงาน: ${site.staffRef}`, "gsorter-staff-line"));
        }

        const mosaic = make("div", null, "gsorter-avatar-mosaic");
        (hasFilter ? matched : allMembers).forEach((s) => mosaic.appendChild(renderRosterMiniChip(s)));
        if (hasFilter && !matched.length) {
          mosaic.appendChild(make("span", "ไม่มีสมาชิกที่ตรงกับคำค้นในพื้นที่นี้", "gsorter-empty-note"));
        }
        card.appendChild(mosaic);

        const foot = make("div", null, "gsorter-card-foot");
        const zoomSiteBtn = make("button", `▶ ซูมเข้า ${site.shortName}`, "btn sm primary");
        zoomSiteBtn.type = "button";
        zoomSiteBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          state.fieldDeckIdx = idx;
          state.fieldViewMode = "deck";
          renderFieldworkView();
        });
        const printOneBtn = make("button", "🖨 พิมพ์ A4", "btn sm");
        printOneBtn.type = "button";
        printOneBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          printSingleGroupHelper("fieldwork", site.shortName);
        });
        foot.append(zoomSiteBtn, printOneBtn);
        card.appendChild(foot);

        card.addEventListener("click", () => {
          state.fieldDeckIdx = idx;
          state.fieldViewMode = "deck";
          renderFieldworkView();
        });
        grid.appendChild(card);
      });
    }

    stageEl.appendChild(grid);
  }

  function renderRosterGroupDeck(scope, stageEl, q, areaSubVal) {
    if (!stageEl) return;
    stageEl.replaceChildren();
    const isDisc = scope === "discussion";
    const groups = isDisc ? SCHED.hsGroups || [] : SCHED.fieldworkSites || [];
    if (!groups.length) return;

    const rawIdx = isDisc ? state.discDeckIdx : state.fieldDeckIdx;
    const idx = ((rawIdx % groups.length) + groups.length) % groups.length;
    if (isDisc) state.discDeckIdx = idx;
    else state.fieldDeckIdx = idx;

    const navBar = make("div", null, "deck-nav-bar");
    const prevBtn = make("button", "‹ กลุ่มก่อนหน้า", "btn sm");
    prevBtn.type = "button";
    prevBtn.addEventListener("click", () => {
      if (isDisc) {
        state.discDeckIdx = (idx - 1 + groups.length) % groups.length;
        renderDiscussionView();
      } else {
        state.fieldDeckIdx = (idx - 1 + groups.length) % groups.length;
        renderFieldworkView();
      }
    });

    const mid = make("div", null, "deck-mid-controls");
    const sel = document.createElement("select");
    sel.className = "deck-slide-select";
    sel.setAttribute("aria-label", "เลือกกลุ่มที่ต้องการเปิดดู");
    groups.forEach((g, i) => {
      const label = isDisc
        ? `กลุ่มที่ ${i + 1}/${groups.length} — Discussion กลุ่มที่ ${g.id} (ห้อง ${g.defaultRoom.split(" ")[0]} · ${g.count} คน)`
        : `พื้นที่ ${i + 1}/${groups.length} — ${g.id}. ${g.shortName} (${g.hospital} ${g.province} · ${g.count} คน)`;
      sel.add(new Option(label, String(i), i === idx, i === idx));
    });
    sel.addEventListener("change", () => {
      const next = Number(sel.value) || 0;
      if (isDisc) {
        state.discDeckIdx = next;
        renderDiscussionView();
      } else {
        state.fieldDeckIdx = next;
        renderFieldworkView();
      }
    });

    const toSorterBtn = make("button", "⊞ Group Sorter", "btn sm");
    toSorterBtn.type = "button";
    toSorterBtn.addEventListener("click", () => {
      if (isDisc) {
        state.discViewMode = "sorter";
        renderDiscussionView();
      } else {
        state.fieldViewMode = "sorter";
        renderFieldworkView();
      }
    });

    const curGroupObj = groups[idx];
    const printGroupBtn = make("button", "🖨 พิมพ์ A4 กลุ่มนี้", "btn sm primary");
    printGroupBtn.type = "button";
    printGroupBtn.addEventListener("click", () => {
      printSingleGroupHelper(scope, isDisc ? curGroupObj.id : curGroupObj.shortName);
    });

    mid.append(sel, toSorterBtn, printGroupBtn);

    const nextBtn = make("button", "กลุ่มถัดไป ›", "btn sm");
    nextBtn.type = "button";
    nextBtn.addEventListener("click", () => {
      if (isDisc) {
        state.discDeckIdx = (idx + 1) % groups.length;
        renderDiscussionView();
      } else {
        state.fieldDeckIdx = (idx + 1) % groups.length;
        renderFieldworkView();
      }
    });

    navBar.append(prevBtn, mid, nextBtn);

    const progTrack = make("div", null, "deck-progress-track");
    const progFill = make("div", null, "deck-progress-fill");
    progFill.style.width = `${((idx + 1) / groups.length) * 100}%`;
    progTrack.appendChild(progFill);

    const slideCard = make("div", null, "deck-slide-card roster-deck-card anim-next");
    // Touch swipe left / right
    let touchX = null;
    slideCard.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches && e.touches.length === 1) touchX = e.touches[0].clientX;
      },
      { passive: true }
    );
    slideCard.addEventListener(
      "touchend",
      (e) => {
        if (touchX === null || !e.changedTouches || !e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) < 55) return;
        if (dx < 0) nextBtn.click();
        else prevBtn.click();
      },
      { passive: true }
    );

    const matchStudent = (s) => {
      if (isDisc && areaSubVal && s.area !== areaSubVal) return false;
      if (!q) return true;
      const hay = `${s.id} ${s.fullName} ${getEffectiveNickname(s)} discussion กลุ่มที่ ${s.disc} ${s.area} ${s.advisor || ""}`.toLocaleLowerCase("th");
      return hay.includes(q);
    };

    if (isDisc) {
      const rot = (SCHED.hsRotation || []).find((r) => r.group === curGroupObj.id) || {};
      const groupAll = ROSTER.students
        .filter((s) => s.disc === curGroupObj.id)
        .sort((a, b) => getSiteIdByAreaName(a.area) - getSiteIdByAreaName(b.area) || compareTH(a.id, b.id));
      const members = groupAll.filter(matchStudent);

      const banner = make("div", null, "gdeck-info-banner");
      banner.innerHTML = `
        <div class="gdeck-banner-top">
          <div>
            <span class="deck-slide-eyebrow">กลุ่มที่ ${idx + 1} จาก ${groups.length} · กดปุ่มลูกศร ← / → เพื่อเลื่อนกลุ่ม</span>
            <h3>กลุ่มอภิปราย Discussion ที่ ${curGroupObj.id} (${members.length}/${groupAll.length} คน · ห้องหลัก ${escapeHtml(rot.room || curGroupObj.defaultRoom)})</h3>
          </div>
          <div class="disc-header-site-pills">${buildDiscSiteBreakdownHtml(members.length ? members : groupAll, curGroupObj.id)}</div>
        </div>
        <div class="disc-rot-slots" style="margin-top:10px">
          ${HS_SLOTS_META.map((m) => {
            const c = rot[m.mod] || {};
            return `<div class="disc-rot-slot"><span class="slot-code">${escapeHtml(m.label)}</span><span class="slot-inst">${escapeHtml(c.instructor || "-")}</span><span class="slot-room${c.highlightRoom ? " room-changed" : ""}">ห้อง ${escapeHtml(c.room || rot.room || "-")}</span></div>`;
          }).join("")}
        </div>
      `;
      slideCard.appendChild(banner);

      const grid = make("div", null, "student-cards");
      if (!members.length) {
        grid.appendChild(make("div", "ไม่มีสมาชิกในกลุ่มนี้ที่ตรงกับคำค้นหา/ป้ายพื้นที่ที่เลือก", "empty-state"));
      } else {
        let lastSiteArea = null;
        members.forEach((s) => {
          if (s.area !== lastSiteArea) {
            lastSiteArea = s.area;
            const sId = getSiteIdByAreaName(s.area);
            const sMeta = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
            const sCount = members.filter((m) => m.area === s.area).length;
            const subBand = make("div", null, `disc-site-subband chip-site-${sId}`);
            subBand.innerHTML = `<span class="area-sub-pill area-site-${sId}"><i class="area-dot"></i>${sId}. ${escapeHtml(s.area)}</span><span class="disc-subband-meta">${sMeta ? escapeHtml(sMeta.hospital) + " (" + escapeHtml(sMeta.province) + ") · " : ""}${sCount} คน</span>`;
            grid.appendChild(subBand);
          }
          grid.appendChild(renderStudentCardElement(s, "discussion"));
        });
      }
      slideCard.appendChild(grid);
    } else {
      const site = curGroupObj;
      const groupAll = ROSTER.students.filter((s) => s.area === site.shortName).sort((a, b) => compareTH(a.id, b.id));
      const members = groupAll.filter(matchStudent);
      const staffLine =
        ROLE === "faculty" && site.staffRef
          ? ` · <strong>ผู้ประสานงาน:</strong> ${escapeHtml(site.staffRef)}`
          : "";

      const banner = make("div", null, "gdeck-info-banner");
      banner.innerHTML = `
        <div class="gdeck-banner-top">
          <div>
            <span class="deck-slide-eyebrow">พื้นที่ที่ ${idx + 1} จาก ${groups.length} · กดปุ่มลูกศร ← / → เพื่อเลื่อนพื้นที่</span>
            <h3><span class="area-sub-pill area-site-${site.id}" style="font-size:15px;padding:4px 12px"><i class="area-dot"></i>${site.id}. ${escapeHtml(site.shortName)}</span> ${escapeHtml(site.hospital)} (${escapeHtml(site.province)}) · ${members.length}/${groupAll.length} คน</h3>
            <p style="margin:6px 0 0;font-size:13.8px;color:var(--ink-body)"><strong>อาจารย์ที่ปรึกษา:</strong> ${escapeHtml(site.advisors)} · <strong>ห้องกลุ่มย่อย:</strong> ${escapeHtml(site.room)} · <strong>ช่วงฝึก:</strong> ${escapeHtml(site.datesTH)}${staffLine}</p>
            <p style="margin:4px 0 0;font-size:13px;color:var(--muted)">${escapeHtml(site.travelNote || "")}</p>
          </div>
          <div class="header-actions">
            <a class="btn sm teal" href="calendars/group_${site.id}_${site.slug}.ics" download="RACM303_2569_group_${site.id}_${site.slug}.ics">📅 ปฏิทิน .ics กลุ่มนี้</a>
          </div>
        </div>
      `;
      slideCard.appendChild(banner);

      const grid = make("div", null, "student-cards");
      if (!members.length) {
        grid.appendChild(make("div", "ไม่มีสมาชิกในพื้นที่นี้ที่ตรงกับคำค้นหา", "empty-state"));
      } else {
        members.forEach((s) => grid.appendChild(renderStudentCardElement(s, "fieldwork")));
      }
      slideCard.appendChild(grid);
    }

    const filmstrip = make("div", null, "deck-filmstrip");
    groups.forEach((g, i) => {
      const chip = make(
        "button",
        isDisc ? `G${g.id} (${g.count})` : `${g.id}.${g.shortName} (${g.count})`,
        `deck-film-chip${i === idx ? " is-active" : ""}`
      );
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (isDisc) {
          state.discDeckIdx = i;
          renderDiscussionView();
        } else {
          state.fieldDeckIdx = i;
          renderFieldworkView();
        }
      });
      filmstrip.appendChild(chip);
    });

    stageEl.append(navBar, progTrack, slideCard, filmstrip);
  }

  function renderRosterAdminTable(scope, stageEl, list) {
    if (!stageEl) return;
    stageEl.replaceChildren();
    if (!list.length) {
      stageEl.appendChild(make("div", "ไม่พบรายชื่อนักศึกษาที่ตรงกับเงื่อนไขการค้นหา", "empty-state"));
      return;
    }

    const siteOrder = new Map((SCHED.fieldworkSites || []).map((s, idx) => [s.shortName, idx]));
    const field = state.adminSortField || "id";
    const dir = state.adminSortAsc ? 1 : -1;

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (field === "id") cmp = compareTH(a.id, b.id);
      else if (field === "name") cmp = compareTH(a.name || a.fullName, b.name || b.fullName);
      else if (field === "nickname") cmp = compareTH(a.nickname || "", b.nickname || "");
      else if (field === "program") cmp = compareTH(a.program || "MD", b.program || "MD");
      else if (field === "disc") cmp = a.disc - b.disc || compareTH(a.id, b.id);
      else if (field === "area") {
        cmp = (siteOrder.get(a.area) ?? 99) - (siteOrder.get(b.area) ?? 99) || compareTH(a.id, b.id);
      } else if (field === "advisor") cmp = compareTH(a.advisor || "", b.advisor || "");
      return cmp * dir;
    });

    const wrap = make("div", null, "clean-table-wrap admin-roster-table-wrap");
    const table = make("table", null, "clean-table admin-roster-table");
    const thead = document.createElement("thead");
    const headTr = document.createElement("tr");

    const cols = [
      { key: null, label: "#" },
      { key: "id", label: "รหัสนักศึกษา" },
      { key: "name", label: "ชื่อ-นามสกุล" },
      { key: "nickname", label: "ชื่อเล่น" },
      { key: "program", label: "หลักสูตร" },
      { key: "disc", label: "Discussion" },
      { key: "area", label: "กลุ่มพื้นที่ภาคสนาม" },
      { key: "advisor", label: "อาจารย์ที่ปรึกษา" },
      { key: null, label: "ทางลัด" }
    ];

    cols.forEach((c) => {
      const th = document.createElement("th");
      if (c.key) {
        th.className = `is-sortable${field === c.key ? " is-sorted" : ""}`;
        const arrow = field === c.key ? (state.adminSortAsc ? " ▲" : " ▼") : " ⇅";
        th.textContent = c.label + arrow;
        th.tabIndex = 0;
        const toggleSort = () => {
          if (state.adminSortField === c.key) state.adminSortAsc = !state.adminSortAsc;
          else {
            state.adminSortField = c.key;
            state.adminSortAsc = true;
          }
          if (scope === "discussion") renderDiscussionView();
          else renderFieldworkView();
        };
        th.addEventListener("click", toggleSort);
        th.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            toggleSort();
          }
        });
      } else {
        th.textContent = c.label;
      }
      headTr.appendChild(th);
    });
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    sorted.forEach((s, idx) => {
      const tr = document.createElement("tr");
      if (state.myStudent && state.myStudent.id === s.id) tr.classList.add("is-my-row");
      const siteId = getSiteIdByAreaName(s.area);
      const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc) || {};

      const tdNum = make("td", String(idx + 1), "td-num");
      const tdId = make("td", s.id, "sid-mono");

      const tdName = make("td", null, "td-student-name");
      const nameFlex = make("div", null, "admin-row-person");
      if (state.showPhotos && s.id) {
        const av = make("span", null, "gsorter-chip-avatar");
        const img = document.createElement("img");
        img.src = `assets/photos/${encodeURIComponent(s.id)}.jpg`;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.onerror = () => {
          av.textContent = studentInitials(s);
        };
        av.appendChild(img);
        nameFlex.appendChild(av);
      }
      nameFlex.appendChild(make("strong", s.fullName));
      tdName.appendChild(nameFlex);

      const tdNick = make("td", s.nickname || "-");
      const tdProg = make("td", s.program === "MD-M.Eng" ? "MD-M.Eng" : "พ.บ.");

      const tdDisc = document.createElement("td");
      const discBtn = make("button", `G${s.disc} · ${rot.room || ""}`, "admin-inline-pill");
      discBtn.type = "button";
      discBtn.title = `กรองเฉพาะกลุ่ม Discussion ที่ ${s.disc}`;
      discBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
        switchTab("discussion");
      });
      tdDisc.appendChild(discBtn);

      const tdArea = document.createElement("td");
      const areaBtn = make("button", null, `area-sub-pill area-site-${siteId} is-btn`);
      areaBtn.type = "button";
      areaBtn.innerHTML = `<i class="area-dot"></i>${siteId}. ${escapeHtml(s.area)}`;
      areaBtn.title = `เปิดดูสมาชิกกลุ่มพื้นที่ ${s.area}`;
      areaBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if ($("fieldAreaSelect")) $("fieldAreaSelect").value = s.area;
        switchTab("fieldwork");
      });
      tdArea.appendChild(areaBtn);

      const tdAdv = make("td", s.advisor || "-", "td-advisor");

      const tdAct = document.createElement("td");
      const openBtn = make("button", "ดูข้อมูล ↗", "btn sm");
      openBtn.type = "button";
      openBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openStudentQuickModal(s);
      });
      tdAct.appendChild(openBtn);

      tr.append(tdNum, tdId, tdName, tdNick, tdProg, tdDisc, tdArea, tdAdv, tdAct);
      tr.addEventListener("click", () => openStudentQuickModal(s));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    stageEl.appendChild(wrap);
  }

  function computeFormationSplit(count) {
    const n = Number(count) || 0;
    if (n <= 0) return [];
    if (n <= 5) return [n];
    if (n === 18) return [4, 5, 5, 4];
    if (n === 19) return [4, 5, 5, 5];
    if (n === 20) return [4, 5, 6, 5];
    if (n === 28) return [5, 6, 6, 6, 5];
    if (n === 29) return [5, 6, 6, 6, 6];
    const rows = n <= 11 ? 2 : n <= 16 ? 3 : n <= 23 ? 4 : 5;
    const base = Math.floor(n / rows);
    let rem = n % rows;
    const arr = new Array(rows).fill(base);
    // Distribute remainder from middle rows outward for balanced tactical symmetry
    const order = [];
    const mid = Math.floor(rows / 2);
    for (let offset = 0; order.length < rows; offset++) {
      if (mid + offset < rows) order.push(mid + offset);
      if (offset > 0 && mid - offset >= 0) order.push(mid - offset);
    }
    for (let i = 0; i < rem; i++) {
      arr[order[i % order.length]] += 1;
    }
    return arr;
  }

  function buildFormationPlayerNode(s, mode, rowIdx, colIdx) {
    const siteId = getSiteIdByAreaName(s.area);
    const siteColor = (typeof SITE_PIN_COLORS !== "undefined" && SITE_PIN_COLORS[siteId]) || "#007aff";
    const parts = getStudentNameParts(s);
    const isMine = state.myStudent && state.myStudent.id === s.id;
    const cleanFull = String(s.name || s.fullName || "").trim();
    const firstFormal = cleanFull.split(/\s+/)[0] || s.id;

    const btn = make("button", null, `fm-player-node${isMine ? " is-mine" : ""}`);
    btn.type = "button";
    btn.style.setProperty("--fm-delay", `${rowIdx * 55 + colIdx * 24}ms`);
    btn.style.setProperty("--node-color", siteColor);
    const effNick = getEffectiveNickname(s);
    btn.title = `${s.id} ${s.fullName}${effNick ? " (" + effNick + ")" : ""} · Discussion กลุ่ม ${s.disc} · พื้นที่ ${siteId}.${s.area}`;

    const avWrap = make("div", null, "fm-avatar-wrap");
    const ring = make("div", null, "fm-avatar-ring");
    if (state.showPhotos && s.id) {
      const img = document.createElement("img");
      img.src = `assets/photos/${encodeURIComponent(s.id)}.jpg`;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        ring.textContent = studentInitials(s);
      };
      ring.appendChild(img);
    } else {
      ring.textContent = studentInitials(s);
    }

    const collar = make(
      "span",
      mode === "discussion" ? `S${siteId}` : `G${s.disc}`,
      "fm-collar-badge"
    );
    avWrap.append(ring, collar);

    const plate = make("div", null, "fm-nameplate");
    const leadTxt = isMine ? `★ ${parts.lead}` : parts.lead;
    const subTxt =
      mode === "discussion"
        ? `${s.area}`
        : parts.hasNick
        ? `${firstFormal} · ${s.id.slice(-3)}`
        : `${s.id}`;
    plate.innerHTML =
      `<span class="fm-plate-lead">${escapeHtml(leadTxt)}</span>` +
      `<span class="fm-plate-sub">${escapeHtml(subTxt)}</span>`;

    btn.append(avWrap, plate);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openStudentQuickModal(s);
    });
    return btn;
  }

  function buildPitchSvgOverlay() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 600 400");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "fm-pitch-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      `<rect x="6" y="6" width="588" height="388" rx="10" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>` +
      `<line x1="6" y1="200" x2="594" y2="200" stroke="rgba(255,255,255,0.11)" stroke-width="1.3"/>` +
      `<circle cx="300" cy="200" r="48" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1.3"/>` +
      `<circle cx="300" cy="200" r="3" fill="rgba(255,255,255,0.18)"/>` +
      `<rect x="195" y="6" width="210" height="52" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>` +
      `<rect x="195" y="342" width="210" height="52" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>`;
    return svg;
  }

  function renderBroadcastFormationBoard(opts) {
    const {
      mode, // "fieldwork" | "discussion"
      wide = false,
      tabs = [], // [{ id, label, color, active, onClick, onHover }]
      crestKicker,
      crestNum,
      teamColor = "#007aff",
      eyebrowText,
      titleText,
      subText,
      mentorLabel,
      mentorValue,
      coachesRot = null,
      members = [],
      viewStyle = "formation", // "formation" | "chips"
      onToggleStyle = null,
      footerActions = null
    } = opts;

    const sortedMembers = [...members].sort((a, b) => {
      if (mode === "discussion") {
        return getSiteIdByAreaName(a.area) - getSiteIdByAreaName(b.area) || compareTH(a.id, b.id);
      }
      return a.disc - b.disc || compareTH(a.id, b.id);
    });
    const splitCounts = computeFormationSplit(sortedMembers.length);
    const formationCode = splitCounts.length ? splitCounts.join("-") : "0";

    const board = make("div", null, `fm-board${wide ? " is-wide" : ""}`);
    board.style.setProperty("--fm-team-color", teamColor);

    if (tabs.length) {
      const tabStrip = make("div", null, "fm-team-tabs");
      tabStrip.setAttribute("role", "tablist");
      tabs.forEach((t) => {
        const b = make("button", null, `fm-team-tab${t.active ? " is-active" : ""}`);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", t.active ? "true" : "false");
        if (t.color) b.style.setProperty("--tab-c", t.color);
        b.innerHTML = (t.color ? `<i class="fm-tab-dot"></i>` : "") + `<span>${escapeHtml(t.label)}</span>`;
        if (t.onHover) b.addEventListener("mouseenter", t.onHover);
        if (t.onClick) b.addEventListener("click", t.onClick);
        tabStrip.appendChild(b);
      });
      board.appendChild(tabStrip);
    }

    const head = make("div", null, "fm-broadcast-head");
    const hLeft = make("div", null, "fm-head-left");
    const crest = make("div", null, "fm-crest-box");
    crest.innerHTML = `<span class="fm-crest-kicker">${escapeHtml(crestKicker)}</span><span class="fm-crest-num">${escapeHtml(crestNum)}</span>`;

    const hTitles = make("div", null, "fm-head-titles");
    hTitles.innerHTML =
      `<div class="fm-head-eyebrow"><span>${escapeHtml(eyebrowText)}</span><span class="fm-formation-tag">FORMATION ${escapeHtml(formationCode)}</span><span>· ${sortedMembers.length} คน</span></div>` +
      `<h3 class="fm-head-name">${escapeHtml(titleText)}</h3>` +
      (subText ? `<p class="fm-head-sub">${escapeHtml(subText)}</p>` : "");
    hLeft.append(crest, hTitles);

    const hRight = make("div", null, "fm-head-right");
    if (mentorValue) {
      const plaque = make("div", null, "fm-mentor-plaque");
      plaque.innerHTML =
        `<span class="fm-mentor-lbl">${escapeHtml(mentorLabel || "อาจารย์ที่ปรึกษา")}</span>` +
        `<span class="fm-mentor-val">${escapeHtml(mentorValue)}</span>`;
      hRight.appendChild(plaque);
    }

    if (typeof onToggleStyle === "function") {
      const sw = make("div", null, "fm-mode-switch");
      const bForm = make("button", "⚡ ผังทีม", "fm-mode-btn");
      bForm.type = "button";
      bForm.setAttribute("aria-pressed", viewStyle === "formation" ? "true" : "false");
      bForm.addEventListener("click", () => onToggleStyle("formation"));

      const bChips = make("button", "☰ รายชื่อ", "fm-mode-btn");
      bChips.type = "button";
      bChips.setAttribute("aria-pressed", viewStyle === "chips" ? "true" : "false");
      bChips.addEventListener("click", () => onToggleStyle("chips"));
      sw.append(bForm, bChips);
      hRight.appendChild(sw);
    }

    head.append(hLeft, hRight);
    board.appendChild(head);

    if (coachesRot) {
      const cStrip = make("div", null, "fm-coaches-strip");
      ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"].forEach((mod) => {
        const cell = coachesRot[mod] || {};
        const item = make("div", null, "fm-coach-cell");
        item.innerHTML = `<strong>${mod} · ${escapeHtml(cell.room || coachesRot.room || "")}</strong><span>${escapeHtml(cell.instructor || "-")}</span>`;
        cStrip.appendChild(item);
      });
      board.appendChild(cStrip);
    }

    if (viewStyle === "chips") {
      const chipBody = make("div", null, "th-inspector-body");
      chipBody.style.background = "#ffffff";
      chipBody.style.padding = "12px";
      const mosaic = make("div", null, "gsorter-avatar-mosaic th-ins-mosaic");
      sortedMembers.forEach((m) => mosaic.appendChild(renderRosterMiniChip(m)));
      chipBody.appendChild(mosaic);
      board.appendChild(chipBody);
    } else {
      const pitch = make("div", null, "fm-pitch-stage");
      pitch.appendChild(buildPitchSvgOverlay());
      const stack = make("div", null, "fm-lines-stack");
      if (!sortedMembers.length) {
        const emp = make("div", "ไม่พบสมาชิกที่ตรงกับตัวกรองในกลุ่มนี้", "empty-state");
        emp.style.background = "rgba(255,255,255,0.92)";
        stack.appendChild(emp);
      } else {
        let cursor = 0;
        splitCounts.forEach((cnt, rIdx) => {
          const rowEl = make("div", null, "fm-line-row");
          const slice = sortedMembers.slice(cursor, cursor + cnt);
          cursor += cnt;
          slice.forEach((stu, cIdx) => {
            rowEl.appendChild(buildFormationPlayerNode(stu, mode, rIdx, cIdx));
          });
          stack.appendChild(rowEl);
        });
      }
      pitch.appendChild(stack);
      board.appendChild(pitch);
    }

    if (footerActions) {
      const foot = make("div", null, "fm-board-foot");
      foot.appendChild(footerActions);
      board.appendChild(foot);
    }

    return board;
  }

  function renderRosterFormationStage(scope, stageEl, q, areaSubVal) {
    if (!stageEl) return;
    stageEl.replaceChildren();
    const isDisc = scope === "discussion";
    const groups = isDisc ? SCHED.hsGroups || [] : SCHED.fieldworkSites || [];
    if (!groups.length) return;

    const rawIdx = isDisc ? state.discDeckIdx : state.fieldDeckIdx;
    const idx = ((rawIdx % groups.length) + groups.length) % groups.length;
    if (isDisc) state.discDeckIdx = idx;
    else state.fieldDeckIdx = idx;

    const curObj = groups[idx];
    const matchStudent = (s) => {
      if (isDisc && areaSubVal && s.area !== areaSubVal) return false;
      if (!q) return true;
      const hay = `${s.id} ${s.fullName} ${getEffectiveNickname(s)} discussion กลุ่มที่ ${s.disc} ${s.area} ${s.advisor || ""}`.toLocaleLowerCase("th");
      return hay.includes(q);
    };

    const tabs = groups.map((g, i) => ({
      id: isDisc ? String(g.id) : g.shortName,
      label: isDisc ? `G${g.id} · ${g.defaultRoom.split(" ")[0]}` : `${g.id}.${g.shortName}`,
      color: isDisc ? "#ffb81c" : (SITE_PIN_COLORS[g.id] || "#007aff"),
      active: i === idx,
      onClick: () => {
        if (isDisc) {
          state.discDeckIdx = i;
          if ($("discGroupSelect")) $("discGroupSelect").value = String(g.id);
          renderDiscussionView();
        } else {
          state.fieldDeckIdx = i;
          if ($("fieldAreaSelect")) $("fieldAreaSelect").value = g.shortName;
          renderFieldworkView();
        }
      }
    }));

    const footActs = make("div", null, "header-actions");
    if (isDisc) {
      const rot = (SCHED.hsRotation || []).find((r) => r.group === curObj.id) || {};
      const allM = ROSTER.students.filter((s) => s.disc === curObj.id);
      const shownM = allM.filter(matchStudent);

      const pdfBtn = make("a", null, "btn sm pdf-red");
      pdfBtn.href = `exports/pdf/RACM303_2569_Discussion_G${curObj.id}.pdf`;
      pdfBtn.setAttribute("download", `ใบรายชื่อ_Discussion_กลุ่มที่_${curObj.id}_A4.pdf`);
      pdfBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF`;

      const printBtn = make("button", null, "btn sm print-ink");
      printBtn.type = "button";
      printBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print (A4)`;
      printBtn.addEventListener("click", () => printSingleGroupHelper("discussion", curObj.id));
      footActs.append(pdfBtn, printBtn);

      stageEl.appendChild(
        renderBroadcastFormationBoard({
          mode: "discussion",
          wide: true,
          tabs,
          crestKicker: "GROUP",
          crestNum: `G${curObj.id}`,
          teamColor: "#0b4db3",
          eyebrowText: `กลุ่มอภิปรายระบบสุขภาพ HS1–HS6`,
          titleText: `Discussion กลุ่มที่ ${curObj.id} · ห้องหลัก ${rot.room || curObj.defaultRoom}`,
          subText: `จัดแถวตามสังกัดโรงพยาบาลภาคสนาม (S1–S9) · คลิกที่การ์ดนักศึกษาเพื่อดูตารางเรียนส่วนตัว`,
          mentorLabel: "อาจารย์ประจำกลุ่มหมุนเวียน",
          mentorValue: "ครบ 6 คาบ HS1–HS6 (แสดงรายคาบด้านล่าง)",
          coachesRot: rot,
          members: shownM,
          footerActions: footActs
        })
      );
    } else {
      const site = curObj;
      const geo = (typeof SITE_GEO_COORDS !== "undefined" && SITE_GEO_COORDS[site.id]) || {};
      const allM = ROSTER.students.filter((s) => s.area === site.shortName);
      const shownM = allM.filter(matchStudent);

      const pdfBtn = make("a", null, "btn sm pdf-red");
      pdfBtn.href = `exports/pdf/RACM303_2569_Fieldwork_S${site.id}.pdf`;
      pdfBtn.setAttribute("download", `ใบรายชื่อ_ภาคสนาม_กลุ่ม${site.id}_${site.shortName}_A4.pdf`);
      pdfBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF`;

      const printBtn = make("button", null, "btn sm print-ink");
      printBtn.type = "button";
      printBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print (A4)`;
      printBtn.addEventListener("click", () => printSingleGroupHelper("fieldwork", site.shortName));

      const icsBtn = make("a", null, "btn sm teal");
      icsBtn.href = `calendars/group_${site.id}_${site.slug}.ics`;
      icsBtn.setAttribute("download", `RACM303_2569_group_${site.id}_${site.slug}.ics`);
      icsBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Export .ics`;
      footActs.append(pdfBtn, printBtn, icsBtn);

      stageEl.appendChild(
        renderBroadcastFormationBoard({
          mode: "fieldwork",
          wide: true,
          tabs,
          crestKicker: "SITE",
          crestNum: String(site.id).padStart(2, "0"),
          teamColor: (typeof SITE_PIN_COLORS !== "undefined" && SITE_PIN_COLORS[site.id]) || "#007aff",
          eyebrowText: `พื้นที่ที่ ${site.id} · ${geo.region || site.province}`,
          titleText: `${site.hospital} (${site.province})`,
          subText: `ห้องกลุ่มย่อย ${site.room} · ช่วงฝึก ${site.datesTH} · จัดแถวตามกลุ่ม Discussion (G1–G6)`,
          mentorLabel: "อาจารย์ที่ปรึกษาประจำพื้นที่",
          mentorValue: site.advisors,
          members: shownM,
          footerActions: footActs
        })
      );
    }
  }

  function syncRosterSuiteUI(scope, opts) {
    const suite = ensureRosterSuite(scope);
    if (!suite) return;
    const isDisc = scope === "discussion";
    const viewMode = isDisc ? state.discViewMode : state.fieldViewMode;
    const { q, activeGroupVal, areaSubVal, list } = opts;

    // Sync search input without stealing cursor focus
    const dockInput = suite.dock.querySelector(".roster-dock-search-input");
    const clearBtn = suite.dock.querySelector(".roster-dock-clear-btn");
    const rawInputVal = ($(isDisc ? "discSearchInput" : "fieldSearchInput") && $(isDisc ? "discSearchInput" : "fieldSearchInput").value) || "";
    if (dockInput && document.activeElement !== dockInput && dockInput.value !== rawInputVal) {
      dockInput.value = rawInputVal;
    }
    if (clearBtn) clearBtn.hidden = !rawInputVal;

    // Sync active view button
    suite.dock.querySelectorAll("[data-roster-view]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.rosterView === viewMode ? "true" : "false");
    });

    // Rebuild Row 2 Quick-Jump Pills with live match counts
    const jumpStrip = suite.dock.querySelector("[data-jump-strip]");
    if (jumpStrip) {
      jumpStrip.replaceChildren();
      const matchQueryOnly = (s) => {
        if (isDisc && areaSubVal && s.area !== areaSubVal) return false;
        if (!q) return true;
        const hay = `${s.id} ${s.fullName} ${s.nickname} discussion กลุ่มที่ ${s.disc} ${s.area} ${s.advisor || ""}`.toLocaleLowerCase("th");
        return hay.includes(q);
      };
      const allMatched = ROSTER.students.filter(matchQueryOnly);

      const allPill = make(
        "button",
        isDisc ? `ทุกกลุ่ม (${allMatched.length})` : `ทุกพื้นที่ (${allMatched.length})`,
        `roster-jump-pill${!activeGroupVal && viewMode !== "deck" ? " is-active" : ""}`
      );
      allPill.type = "button";
      allPill.addEventListener("click", () => {
        if (isDisc) {
          if ($("discGroupSelect")) $("discGroupSelect").value = "";
          if (state.discViewMode === "deck") state.discViewMode = "cards";
          renderDiscussionView();
        } else {
          if ($("fieldAreaSelect")) $("fieldAreaSelect").value = "";
          if (state.fieldViewMode === "deck") state.fieldViewMode = "cards";
          renderFieldworkView();
        }
      });
      jumpStrip.appendChild(allPill);

      if (isDisc) {
        (SCHED.hsGroups || []).forEach((g, idx) => {
          const cnt = allMatched.filter((s) => s.disc === g.id).length;
          const isAct = viewMode === "deck" ? state.discDeckIdx === idx : activeGroupVal === String(g.id);
          const p = make(
            "button",
            `G${g.id} · ${g.defaultRoom.split(" ")[0]} (${cnt})`,
            `roster-jump-pill${isAct ? " is-active" : ""}${cnt === 0 ? " is-zero" : ""}`
          );
          p.type = "button";
          p.dataset.hoverDiscOnly = String(g.id);
          p.addEventListener("click", () => {
            if (state.discViewMode === "deck" || state.discViewMode === "formation") {
              state.discDeckIdx = idx;
              renderDiscussionView();
              return;
            }
            const sel = $("discGroupSelect");
            if (sel) sel.value = sel.value === String(g.id) ? "" : String(g.id);
            state.discContext = null;
            renderDiscussionView();
          });
          jumpStrip.appendChild(p);
        });
      } else {
        (SCHED.fieldworkSites || []).forEach((site, idx) => {
          const cnt = allMatched.filter((s) => s.area === site.shortName).length;
          const isAct = viewMode === "deck" ? state.fieldDeckIdx === idx : activeGroupVal === site.shortName;
          const p = make(
            "button",
            null,
            `roster-jump-pill area-site-${site.id}${isAct ? " is-active" : ""}${cnt === 0 ? " is-zero" : ""}`
          );
          p.type = "button";
          p.dataset.hoverArea = site.shortName;
          p.innerHTML = `<i class="area-dot"></i><span>${site.id}. ${escapeHtml(site.shortName)}</span><strong>(${cnt})</strong>`;
          p.addEventListener("click", () => {
            if (state.fieldViewMode === "deck" || state.fieldViewMode === "formation") {
              state.fieldDeckIdx = idx;
              renderFieldworkView();
              return;
            }
            const sel = $("fieldAreaSelect");
            if (sel) sel.value = sel.value === site.shortName ? "" : site.shortName;
            state.fieldContext = null;
            renderFieldworkView();
          });
          jumpStrip.appendChild(p);
        });
      }
    }

    applyRosterZoomVars();

    // Toggle visible stage while keeping cardsEl populated for 1-page A4 printing
    suite.cardsEl.hidden = viewMode !== "cards";
    if (suite.formationStage) suite.formationStage.hidden = viewMode !== "formation";
    suite.sorterStage.hidden = viewMode !== "sorter";
    suite.deckStage.hidden = viewMode !== "deck";
    suite.tableStage.hidden = viewMode !== "table";

    if (viewMode === "formation" && suite.formationStage) {
      renderRosterFormationStage(scope, suite.formationStage, q, areaSubVal);
    } else if (viewMode === "sorter") {
      renderRosterGroupSorter(scope, suite.sorterStage, q, areaSubVal, activeGroupVal);
    } else if (viewMode === "deck") {
      renderRosterGroupDeck(scope, suite.deckStage, q, areaSubVal);
    } else if (viewMode === "table") {
      renderRosterAdminTable(scope, suite.tableStage, list);
    }
  }

  function buildHsSixBulletListHtml(rot) {
    const r = rot || {};
    const items = ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"].map((mod) => {
      const cell = r[mod] || {};
      const inst = escapeHtml(cell.instructor || "-");
      const roomChangedBadge = cell.highlightRoom
        ? ` <span class="disc-bullet-room-flag">ห้อง ${escapeHtml(cell.room)}</span>`
        : "";
      return `<li><span class="disc-hs-code">${mod}</span><span class="disc-hs-inst">${inst}${roomChangedBadge}</span></li>`;
    });
    return `<ul class="disc-hs-bullets">${items.join("")}</ul>`;
  }

  function buildDiscSiteBreakdownHtml(groupStudents, discGroupId) {
    const counts = new Map();
    groupStudents.forEach((st) => {
      counts.set(st.area, (counts.get(st.area) || 0) + 1);
    });
    const discAttr = discGroupId ? ` data-hover-disc="${escapeHtml(String(discGroupId))}"` : "";
    return (SCHED.fieldworkSites || [])
      .filter((site) => counts.get(site.shortName))
      .map(
        (site) =>
          `<span class="area-sub-pill sm area-site-${site.id} has-hover-peek" data-hover-area="${escapeHtml(site.shortName)}"${discAttr}><i class="area-dot"></i>${site.id}.${escapeHtml(site.shortName)} (${counts.get(site.shortName)})</span>`
      )
      .join("");
  }

  /* ---------- Compact Non-Blocking Hover Peek Card (Photos + Nickname + Name) ---------- */
  let groupHoverWired = false;
  let groupHoverHideTimer = null;
  let activeHoverAnchor = null;

  function ensureGroupHoverPreview() {
    if (groupHoverWired || typeof document === "undefined") return;
    groupHoverWired = true;

    const pop = make("div", null, "group-hover-popover");
    pop.id = "groupHoverPopover";
    pop.hidden = true;
    document.body.appendChild(pop);

    const scheduleHide = () => {
      if (groupHoverHideTimer) clearTimeout(groupHoverHideTimer);
      groupHoverHideTimer = setTimeout(() => {
        pop.hidden = true;
        activeHoverAnchor = null;
      }, 130);
    };

    const cancelHide = () => {
      if (groupHoverHideTimer) {
        clearTimeout(groupHoverHideTimer);
        groupHoverHideTimer = null;
      }
    };

    pop.addEventListener("mouseenter", cancelHide);
    pop.addEventListener("mouseleave", scheduleHide);

    const positionPopover = (anchor) => {
      if (!anchor || !anchor.getBoundingClientRect) return;
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth || 1200;
      const vh = window.innerHeight || 800;
      const pw = pop.offsetWidth || 290;
      const ph = pop.offsetHeight || 160;

      let left = rect.left + rect.width / 2 - pw / 2;
      left = Math.max(10, Math.min(vw - pw - 10, left));

      // Prefer placing cleanly ABOVE the pill so it doesn't cover content below; flip below if near top
      let top = rect.top - ph - 10;
      if (top < 10) {
        top = Math.min(vh - ph - 10, rect.bottom + 10);
      }
      pop.style.left = `${Math.round(left)}px`;
      pop.style.top = `${Math.round(top)}px`;
    };

    const showHoverForAnchor = (anchor) => {
      cancelHide();
      if (activeHoverAnchor === anchor && !pop.hidden) return;
      activeHoverAnchor = anchor;

      const areaName = anchor.dataset.hoverArea || "";
      const discId = anchor.dataset.hoverDisc || "";
      const discOnly = anchor.dataset.hoverDiscOnly || "";

      let members = [];
      let headHtml = "";

      if (areaName) {
        const site = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaName);
        const siteId = site ? site.id : getSiteIdByAreaName(areaName);
        members = ROSTER.students
          .filter((s) => s.area === areaName && (!discId || String(s.disc) === String(discId)))
          .sort((a, b) => compareTH(a.id, b.id));
        const subCtx = discId
          ? `ในกลุ่ม Discussion ${escapeHtml(discId)} · ${members.length} คน`
          : `${site ? escapeHtml(site.hospital) + " · " : ""}${members.length} คน`;
        headHtml = `<span class="area-sub-pill sm area-site-${siteId}"><i class="area-dot"></i>${siteId}. ${escapeHtml(areaName)}</span><span class="ghp-count">${subCtx}</span>`;
      } else if (discOnly) {
        members = ROSTER.students
          .filter((s) => String(s.disc) === String(discOnly))
          .sort((a, b) => getSiteIdByAreaName(a.area) - getSiteIdByAreaName(b.area) || compareTH(a.id, b.id));
        headHtml = `<span class="badge cat-HS">กลุ่ม Discussion ที่ ${escapeHtml(discOnly)}</span><span class="ghp-count">${members.length} คน · แยกตามพื้นที่แหล่งฝึก</span>`;
      }

      if (!members.length) {
        pop.hidden = true;
        return;
      }

      pop.replaceChildren();
      const head = make("div", null, "ghp-head");
      head.innerHTML = headHtml;
      pop.appendChild(head);

      const buildPersonRow = (s) => {
        const sSiteId = getSiteIdByAreaName(s.area);
        const parts = getStudentNameParts(s);
        const row = make("button", null, `ghp-person chip-site-${sSiteId}`);
        row.type = "button";
        const av = make("span", null, "ghp-avatar");
        if (s.id) {
          const img = document.createElement("img");
          img.src = `assets/photos/${encodeURIComponent(s.id)}.jpg`;
          img.alt = "";
          img.loading = "lazy";
          img.onerror = () => {
            av.textContent = studentInitials(s);
          };
          av.appendChild(img);
        } else {
          av.textContent = studentInitials(s);
        }
        const txt = make("span", null, "ghp-txt");
        txt.innerHTML = `<strong>${escapeHtml(parts.lead)}</strong>${parts.paren ? `<small>${escapeHtml(parts.paren)}</small>` : ""}`;
        const dot = make("i", null, `gsorter-site-dot chip-dot-site-${sSiteId}`);
        row.append(av, txt, dot);
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pop.hidden = true;
          openStudentQuickModal(s);
        });
        return row;
      };

      if (discOnly && !areaName) {
        const groupedWrap = make("div", null, "ghp-grouped-sites");
        (SCHED.fieldworkSites || []).forEach((site) => {
          const sub = members.filter((s) => s.area === site.shortName);
          if (!sub.length) return;
          const sec = make("div", null, `ghp-site-sec chip-site-${site.id}`);
          sec.innerHTML = `<div class="ghp-site-sec-head"><span class="area-sub-pill sm area-site-${site.id}"><i class="area-dot"></i>${escapeHtml(site.shortName)} (${sub.length})</span></div>`;
          const subGrid = make("div", null, `ghp-list${sub.length > 3 ? " is-two-col" : ""}`);
          sub.forEach((s) => subGrid.appendChild(buildPersonRow(s)));
          sec.appendChild(subGrid);
          groupedWrap.appendChild(sec);
        });
        pop.appendChild(groupedWrap);
      } else {
        const listEl = make("div", null, `ghp-list${members.length > 6 ? " is-two-col" : ""}`);
        members.forEach((s) => listEl.appendChild(buildPersonRow(s)));
        pop.appendChild(listEl);
      }

      pop.hidden = false;
      positionPopover(anchor);
    };

    document.addEventListener("mouseover", (ev) => {
      const target = ev.target && ev.target.closest ? ev.target.closest("[data-hover-area], [data-hover-disc-only]") : null;
      if (target) showHoverForAnchor(target);
    });
    document.addEventListener("mouseout", (ev) => {
      const target = ev.target && ev.target.closest ? ev.target.closest("[data-hover-area], [data-hover-disc-only]") : null;
      if (!target) return;
      const related = ev.relatedTarget;
      if (related && (target.contains(related) || pop.contains(related))) return;
      scheduleHide();
    });
    window.addEventListener("scroll", () => {
      if (!pop.hidden) pop.hidden = true;
    }, { passive: true });
  }

  /* ---------- Tab 2: Separated Discussion Group Roster (HS1–HS6 · 6 Groups) ---------- */
  const HS_SLOTS_META = [
    { mod: "HS1", label: "HS1 · พฤ. 26 พ.ย. (08.30–12.00)", docId: "HS1" },
    { mod: "HS2", label: "HS2 · จ. 30 พ.ย. (08.30–12.00)", docId: "HS2" },
    { mod: "HS3", label: "HS3 · จ. 30 พ.ย. (13.30–17.00)", docId: "HS3" },
    { mod: "HS4", label: "HS4 · อ. 1 ธ.ค. (08.30–12.00)", docId: "HS4" },
    { mod: "HS5", label: "HS5 · อ. 1 ธ.ค. (13.30–17.00)", docId: "HS5" },
    { mod: "HS6", label: "HS6 · ศ. 4 ธ.ค. (08.30–12.00)", docId: "HS6" }
  ];

  function initDiscussionControls() {
    ensureGroupHoverPreview();
    const discSel = $("discGroupSelect");
    if (discSel) {
      (SCHED.hsGroups || []).forEach((g) => {
        discSel.add(new Option(`กลุ่มอภิปราย Discussion ที่ ${g.id} · ห้อง ${g.defaultRoom.split(" ")[0]} (${g.count} คน)`, String(g.id)));
      });
      discSel.addEventListener("change", () => {
        state.discContext = null;
        if (discSel.value && state.discViewMode === "deck") {
          state.discDeckIdx = Math.max(0, Number(discSel.value) - 1);
        }
        renderDiscussionView();
      });
    }

    const areaSubSel = $("discAreaSubFilter");
    if (areaSubSel) {
      (SCHED.fieldworkSites || []).forEach((site) => {
        areaSubSel.add(new Option(site.shortName, site.shortName));
      });
      areaSubSel.addEventListener("change", renderDiscussionView);
    }

    if ($("discSearchInput")) {
      $("discSearchInput").addEventListener("input", renderDiscussionView);
    }

    if ($("discClearFiltersBtn")) {
      $("discClearFiltersBtn").addEventListener("click", () => {
        state.discContext = null;
        if ($("discSearchInput")) $("discSearchInput").value = "";
        if (discSel) discSel.value = "";
        if (areaSubSel) areaSubSel.value = "";
        renderDiscussionView();
      });
    }

    if ($("discTogglePhotosBtn")) {
      $("discTogglePhotosBtn").addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        syncPhotoToggleButtons();
        renderDiscussionView();
      });
    }

    ["discPrintBtn", "discPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).addEventListener("click", () => printRosterOnePage("discussion"));
    });

    if ($("exportDiscPdfBtn")) {
      $("exportDiscPdfBtn").addEventListener("click", (ev) => {
        if ($("exportDiscPdfBtn").dataset.dynamicPrint === "1") {
          ev.preventDefault();
          printRosterOnePage("discussion");
        }
      });
    }

    if ($("exportDiscDocxBtn")) {
      $("exportDiscDocxBtn").addEventListener("click", (ev) => {
        const dVal = ($("discGroupSelect") && $("discGroupSelect").value) || "";
        const aVal = ($("discAreaSubFilter") && $("discAreaSubFilter").value) || "";
        const qVal = (($("discSearchInput") && $("discSearchInput").value) || "").trim();
        if (!dVal && !aVal && !qVal) return; // use pre-built full Discussion DOCX
        ev.preventDefault();
        const rows = (state.visibleDiscStudents || [])
          .map(
            (s, idx) =>
              `<tr><td>${idx + 1}</td><td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.fullName)}</td><td>${escapeHtml(s.nickname || "-")}</td><td>กลุ่ม ${s.disc}</td><td>${escapeHtml(s.area)}</td></tr>`
          )
          .join("");
        const label = dVal ? `กลุ่มที่_${dVal}` : "Filtered";
        downloadHtmlAsGenuineDocx(
          `รายชื่อสมาชิกกลุ่มอภิปราย Discussion ${dVal ? "กลุ่มที่ " + dVal : "(ตามเงื่อนไขที่กรอง)"}`,
          `รายวิชา RACM 303 ปีการศึกษา 2569 · จำนวน ${(state.visibleDiscStudents || []).length} คน`,
          `<table><thead><tr><th>ลำดับ</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>Discussion</th><th>พื้นที่ภาคสนาม</th></tr></thead><tbody>${rows}</tbody></table>`,
          `รายชื่อ_Discussion_${sanitizeFilenamePart(label)}_RACM303_2569.docx`
        );
      });
    }

    if ($("jumpToHsDiscCasesBtn")) {
      $("jumpToHsDiscCasesBtn").addEventListener("click", () => openHsDiscussion("ALL"));
    }

    syncPhotoToggleButtons();
  }

  function renderDiscussionOverviewCards(activeDiscVal) {
    const grid = $("discOverviewGrid");
    if (!grid) return;

    if (!grid.dataset.rendered) {
      grid.dataset.rendered = "1";
      (SCHED.hsGroups || []).forEach((g, idx) => {
        const rot = (SCHED.hsRotation || []).find((r) => r.group === g.id) || {};
        const groupMembers = ROSTER.students.filter((st) => st.disc === g.id);
        const siteMixHtml = buildDiscSiteBreakdownHtml(groupMembers, g.id);
        const card = make("div", null, "disc-card");
        card.dataset.discId = String(g.id);
        card.setAttribute("role", "button");
        card.tabIndex = 0;

        const roomNote = g.id === 6 ? "ห้องหลัก 1C1-07 (ยกเว้น HS4 เช้า 1 ธ.ค. ใช้ห้อง 2C2-03)" : g.defaultRoom;
        const sixHsBulletsHtml = buildHsSixBulletListHtml(rot);

        card.innerHTML = `
          <div class="disc-card-head">
            <h3>กลุ่มที่ ${g.id}</h3>
            <span class="badge cat-HS">${g.count} คน</span>
          </div>
          <p class="disc-meta"><strong>ห้องเรียน:</strong> ${escapeHtml(roomNote)}</p>
          ${sixHsBulletsHtml}
          <div class="disc-site-mix">${siteMixHtml}</div>
          <div class="disc-card-foot" data-disc-foot="${g.id}">คลิกเพื่อดูสมาชิกกลุ่มที่ ${g.id} · ชี้ที่ป้ายพื้นที่เพื่อดูรูปและชื่อเล่น →</div>
        `;

        // Clicking a site sub-pill inside a Discussion card filters straight to that group + site!
        card.querySelectorAll("[data-hover-area]").forEach((pillEl) => {
          pillEl.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const areaTarget = pillEl.dataset.hoverArea || "";
            if ($("discGroupSelect")) $("discGroupSelect").value = String(g.id);
            if ($("discAreaSubFilter")) {
              $("discAreaSubFilter").value = $("discAreaSubFilter").value === areaTarget ? "" : areaTarget;
            }
            state.discContext = null;
            renderDiscussionView();
          });
        });

        const selectGroup = () => {
          if (state.discViewMode === "deck") {
            state.discDeckIdx = idx;
            renderDiscussionView();
            return;
          }
          const sel = $("discGroupSelect");
          if (!sel) return;
          sel.value = sel.value === String(g.id) ? "" : String(g.id);
          state.discContext = null;
          renderDiscussionView();
        };
        card.addEventListener("click", selectGroup);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectGroup();
          }
        });
        grid.appendChild(card);
      });
    }

    const myDisc = state.myStudent ? String(state.myStudent.disc) : "";
    grid.querySelectorAll(".disc-card").forEach((c) => {
      const id = c.dataset.discId;
      const isSelected = id === activeDiscVal;
      const isMine = myDisc && id === myDisc;
      c.classList.toggle("active-disc", isSelected);
      const foot = c.querySelector("[data-disc-foot]");
      if (foot) {
        if (isSelected) {
          foot.textContent = `✓ กำลังแสดงสมาชิกกลุ่มที่ ${id} (คลิกซ้ำเพื่อดูครบทั้ง 6 กลุ่ม)`;
        } else if (isMine) {
          foot.textContent = `★ กลุ่ม Discussion ของฉัน · ชี้ป้ายสีดูเพื่อน หรือคลิกดูครบกลุ่ม`;
        } else {
          foot.textContent = `คลิกเพื่อดูสมาชิกกลุ่มที่ ${id} · ชี้ที่ป้ายพื้นที่เพื่อดูรูปและชื่อเล่น →`;
        }
      }
    });
  }

  function renderDiscussionAreaLegendBar(discVal, activeAreaVal) {
    const bar = $("discAreaLegendBar");
    if (!bar) return;
    bar.replaceChildren();

    const scoped = ROSTER.students.filter((s) => !discVal || String(s.disc) === discVal);
    const counts = new Map();
    scoped.forEach((s) => counts.set(s.area, (counts.get(s.area) || 0) + 1));

    const allBtn = make(
      "button",
      `ทุกพื้นที่ (${scoped.length})`,
      `area-filter-pill area-all${!activeAreaVal ? " is-active" : ""}`
    );
    allBtn.type = "button";
    allBtn.addEventListener("click", () => {
      if ($("discAreaSubFilter")) $("discAreaSubFilter").value = "";
      renderDiscussionView();
    });
    bar.appendChild(allBtn);

    (SCHED.fieldworkSites || []).forEach((site) => {
      const cnt = counts.get(site.shortName) || 0;
      const pill = make(
        "button",
        null,
        `area-filter-pill area-site-${site.id}${activeAreaVal === site.shortName ? " is-active" : ""}${cnt === 0 ? " is-zero" : ""}`
      );
      pill.type = "button";
      if (cnt > 0) {
        pill.dataset.hoverArea = site.shortName;
        if (discVal) pill.dataset.hoverDisc = discVal;
      }
      pill.innerHTML = `<i class="area-dot"></i><span>${site.id}. ${escapeHtml(site.shortName)}</span><strong class="pill-cnt">${cnt}</strong>`;
      pill.addEventListener("click", () => {
        const sel = $("discAreaSubFilter");
        if (!sel) return;
        sel.value = sel.value === site.shortName ? "" : site.shortName;
        renderDiscussionView();
      });
      bar.appendChild(pill);
    });
  }

  function renderDiscussionRotationBanner(activeDiscVal) {
    const box = $("discRotationDetailBox");
    if (!box) return;
    if (!activeDiscVal) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }

    const rot = (SCHED.hsRotation || []).find((r) => String(r.group) === activeDiscVal);
    if (!rot) {
      box.hidden = true;
      return;
    }

    box.hidden = false;
    box.replaceChildren();

    const head = make("div", null, "section-header");
    head.style.marginBottom = "4px";
    const left = make("div");
    left.append(
      make("h3", `ตารางหมุนเวียนอาจารย์และห้องเรียนประจำกลุ่มอภิปรายที่ ${rot.group} (${rot.count} คน · ห้องหลัก ${rot.room})`),
      make(
        "p",
        rot.group === 6
          ? "หมายเหตุสำคัญ: เช้าวันอังคารที่ 1 ธ.ค. 2569 (HS4) กลุ่มที่ 6 ย้ายไปเรียนที่ห้อง 2C2-03 ชั่วคราว และช่วงบ่าย (HS5) กลับมาใช้ห้อง 1C1-07 ตามปกติ"
          : `สมาชิกกลุ่มอภิปรายที่ ${rot.group} ใช้ห้อง ${rot.room} ชั้น 1 อาคารพรีคลินิก ตลอดทั้งคาบ HS1–HS6`
      )
    );
    const showAllBtn = make("button", "ดูสมาชิกครบทั้ง 6 กลุ่ม (169 คน)", "btn sm");
    showAllBtn.type = "button";
    showAllBtn.addEventListener("click", () => {
      if ($("discGroupSelect")) $("discGroupSelect").value = "";
      state.discContext = null;
      renderDiscussionView();
    });
    head.append(left, showAllBtn);
    box.appendChild(head);

    const slotsGrid = make("div", null, "disc-rot-slots");
    HS_SLOTS_META.forEach((slotMeta) => {
      const cell = rot[slotMeta.mod] || {};
      const slot = make("div", null, "disc-rot-slot");
      slot.appendChild(make("span", slotMeta.label, "slot-code"));
      slot.appendChild(make("span", cell.instructor || "-", "slot-inst"));
      slot.appendChild(
        make("span", `ห้อง ${cell.room || rot.room}`, `slot-room${cell.highlightRoom ? " room-changed" : ""}`)
      );
      const btnRow = make("div", null, "header-actions");
      btnRow.style.marginTop = "6px";
      const discBtn = make("button", `โจทย์ ${slotMeta.mod}`, "btn sm primary");
      discBtn.type = "button";
      discBtn.addEventListener("click", () => openHsDiscussion(slotMeta.mod));
      const readBtn = make("button", `บทเรียน ${slotMeta.mod}`, "btn sm");
      readBtn.type = "button";
      readBtn.addEventListener("click", () => openTextbookDoc(slotMeta.docId));
      btnRow.append(discBtn, readBtn);
      slot.appendChild(btnRow);
      slotsGrid.appendChild(slot);
    });
    box.appendChild(slotsGrid);
  }

  function renderDiscussionView() {
    const discVal = ($("discGroupSelect") && $("discGroupSelect").value) || "";
    const areaSubVal = ($("discAreaSubFilter") && $("discAreaSubFilter").value) || "";
    const q = (($("discSearchInput") && $("discSearchInput").value) || "").trim().toLocaleLowerCase("th");

    renderDiscussionOverviewCards(discVal);
    renderDiscussionRotationBanner(discVal);
    renderDiscussionAreaLegendBar(discVal, areaSubVal);

    const ctxBox = $("discContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.discContext;
      if (state.discContext) {
        const c = state.discContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง: ${c.room}`),
          make("p", `อาจารย์ประจำกลุ่ม: ${c.lecturer} · ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปปฏิทินสอน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        right.append(backBtn);
        ctxBox.append(left, right);
      }
    }

    const discPdfBtn = $("exportDiscPdfBtn");
    if (discPdfBtn) {
      if (!areaSubVal && !q) {
        discPdfBtn.dataset.dynamicPrint = "0";
        if (discVal) {
          discPdfBtn.href = `exports/pdf/RACM303_2569_Discussion_G${encodeURIComponent(discVal)}.pdf`;
          discPdfBtn.setAttribute("download", `ใบรายชื่อ_Discussion_กลุ่มที่_${discVal}_A4.pdf`);
        } else {
          discPdfBtn.href = "exports/pdf/RACM303_2569_Discussion_All.pdf";
          discPdfBtn.setAttribute("download", "ใบรายชื่อ_Discussion_ครบ6กลุ่ม_RACM303_2569.pdf");
        }
      } else {
        discPdfBtn.dataset.dynamicPrint = "1";
      }
    }

    const list = ROSTER.students.filter((s) => {
      if (discVal && String(s.disc) !== discVal) return false;
      if (areaSubVal && s.area !== areaSubVal) return false;
      if (q) {
        const rot = (SCHED.hsRotation || []).find((r) => r.group === s.disc) || {};
        const teachers = HS_SLOTS_META.map((m) => (rot[m.mod] && rot[m.mod].instructor) || "").join(" ");
        const hay = `${s.id} ${s.fullName} ${getEffectiveNickname(s)} discussion กลุ่มที่ ${s.disc} ${s.area} ${s.advisor || ""} ${teachers}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => a.disc - b.disc || getSiteIdByAreaName(a.area) - getSiteIdByAreaName(b.area) || compareTH(a.id, b.id));
    state.visibleDiscStudents = list;

    const rotObj = discVal ? (SCHED.hsRotation || []).find((r) => String(r.group) === discVal) : null;
    const baseLabel = discVal
      ? `สมาชิกกลุ่มอภิปราย Discussion ที่ ${discVal}${rotObj ? " (ห้องหลัก " + rotObj.room + ")" : ""}`
      : "สมาชิกกลุ่มอภิปราย Discussion ทั้ง 6 กลุ่มย่อย";
    const selectionLabel = areaSubVal ? `${baseLabel} · เฉพาะสังกัดพื้นที่ ${areaSubVal}` : baseLabel;

    if ($("discStatusText")) {
      $("discStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    ["discPrintBtn", "discPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).disabled = list.length === 0;
    });

    const printHeading = $("discPrintHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.discContext) {
        printHeading.append(
          make("div", state.discContext.topic),
          make("div", `${state.discContext.date} · ${state.discContext.time} · ห้อง ${state.discContext.room} · อาจารย์: ${state.discContext.lecturer}`)
        );
      } else if (rotObj) {
        const instSummary = HS_SLOTS_META.map((m) => `${m.mod}: ${(rotObj[m.mod] && rotObj[m.mod].instructor) || "-"}`).join(" | ");
        printHeading.appendChild(make("div", instSummary));
      }
    }

    const cardsEl = $("discCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อสมาชิกกลุ่ม Discussion ที่ตรงกับเงื่อนไขที่เลือก", "empty-state"));
    } else {
      let lastDisc = null;
      let lastAreaInDisc = null;
      list.forEach((s) => {
        if (!discVal && s.disc !== lastDisc) {
          lastDisc = s.disc;
          lastAreaInDisc = null;
          const gMeta = (SCHED.hsGroups || []).find((g) => g.id === s.disc);
          const rMeta = (SCHED.hsRotation || []).find((r) => r.group === s.disc);
          const groupMembers = list.filter((st) => st.disc === s.disc);
          const h = make("div", null, "area-group-header");
          const instLine = rMeta
            ? HS_SLOTS_META.map((m) => `${m.mod}: ${(rMeta[m.mod] && rMeta[m.mod].instructor) || "-"}`).join(" · ")
            : "";
          const leftCol = make("div", null, "area-group-title-col");
          leftCol.append(
            make("h3", `กลุ่มอภิปราย Discussion ที่ ${s.disc} (${gMeta ? gMeta.count : ""} คน · ห้อง ${gMeta ? gMeta.defaultRoom : ""})`),
            make("p", `อาจารย์ประจำกลุ่มหมุนเวียน — ${instLine}`)
          );
          const mixRow = make("div", null, "disc-header-site-pills");
          mixRow.innerHTML = buildDiscSiteBreakdownHtml(groupMembers, s.disc);
          h.append(leftCol, mixRow);
          cardsEl.appendChild(h);
        }
        const areaKey = `${s.disc}::${s.area}`;
        if (!areaSubVal && areaKey !== lastAreaInDisc) {
          lastAreaInDisc = areaKey;
          const sId = getSiteIdByAreaName(s.area);
          const sMeta = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
          const sCount = list.filter((st) => st.disc === s.disc && st.area === s.area).length;
          const subBand = make("div", null, `disc-site-subband chip-site-${sId}`);
          subBand.innerHTML = `<span class="area-sub-pill area-site-${sId}"><i class="area-dot"></i>${sId}. ${escapeHtml(s.area)}</span><span class="disc-subband-meta">${sMeta ? escapeHtml(sMeta.hospital) + " (" + escapeHtml(sMeta.province) + ") · " : ""}${sCount} คน</span>`;
          cardsEl.appendChild(subBand);
        }
        cardsEl.appendChild(renderStudentCardElement(s, "discussion"));
      });
    }

    syncRosterSuiteUI("discussion", {
      q,
      activeGroupVal: discVal,
      areaSubVal,
      list
    });
  }

  /* ---------- Tab 3: Interactive Thailand Fieldwork Map + 9 Community Hospital Roster ---------- */
  const THAILAND_OUTLINE_LATLON = [
    [20.46, 99.88], [20.15, 100.09], [20.35, 100.35], [19.78, 100.52], [19.55, 101.08],
    [19.08, 101.28], [18.42, 101.05], [17.78, 101.02], [17.55, 101.42], [17.85, 101.78],
    [18.18, 102.12], [17.88, 102.68], [18.35, 103.25], [18.42, 103.85], [17.98, 104.28],
    [17.42, 104.78], [16.85, 104.75], [16.22, 105.05], [15.65, 105.55], [15.18, 105.52],
    [14.45, 105.22], [14.32, 104.25], [14.42, 103.18], [14.18, 102.58], [13.55, 102.55],
    [12.82, 102.48], [12.18, 102.75], [11.65, 102.90], [12.15, 102.35], [12.58, 101.95],
    [12.65, 101.25], [13.28, 100.92], [13.55, 100.58], [13.45, 100.08], [12.95, 99.98],
    [12.10, 99.98], [11.20, 99.55], [10.45, 99.25], [9.95, 99.15], [9.32, 99.28],
    [9.22, 99.88], [8.45, 100.20], [7.65, 100.42], [6.92, 100.68], [6.75, 101.55],
    [6.22, 102.08], [5.78, 101.82], [5.62, 101.12], [6.15, 100.92], [6.45, 100.22],
    [6.55, 99.68], [7.28, 99.52], [7.88, 98.98], [8.18, 98.32], [8.88, 98.24],
    [9.65, 98.48], [9.98, 98.62], [10.55, 98.85], [10.95, 99.12], [11.75, 99.62],
    [12.52, 99.52], [13.25, 99.32], [13.85, 99.05], [14.55, 98.52], [15.25, 98.32],
    [15.65, 98.58], [15.95, 98.65], [16.45, 98.52], [17.05, 98.12], [17.65, 97.72],
    [18.25, 97.42], [18.85, 97.78], [19.45, 97.92], [19.78, 98.42], [19.65, 98.95],
    [20.08, 99.25], [20.46, 99.88]
  ];

  const SITE_GEO_COORDS = {
    1: { lat: 16.54, lon: 104.05, region: "ภาคตะวันออกเฉียงเหนือ", dx: 10, dy: 4, anchor: "start" }, // กุฉินารายณ์ จ.กาฬสินธุ์
    2: { lat: 17.32, lon: 101.15, region: "ภาคตะวันออกเฉียงเหนือตอนบน", dx: 0, dy: -12, anchor: "middle" }, // ด่านซ้าย จ.เลย
    3: { lat: 8.87, lon: 98.38, region: "ภาคใต้ฝั่งอันดามัน", dx: 12, dy: 4, anchor: "start" }, // ตะกั่วป่า จ.พังงา
    4: { lat: 19.12, lon: 100.80, region: "ภาคเหนือ", dx: 11, dy: 4, anchor: "start" }, // ท่าวังผา จ.น่าน
    5: { lat: 16.50, lon: 101.02, region: "ภาคกลางตอนบน", dx: -10, dy: -4, anchor: "end" }, // เพชรบูรณ์ 1
    6: { lat: 16.12, lon: 101.28, region: "ภาคกลางตอนบน", dx: 11, dy: 8, anchor: "start" }, // เพชรบูรณ์ 2
    7: { lat: 16.75, lon: 102.63, region: "ภาคตะวันออกเฉียงเหนือ", dx: 0, dy: -12, anchor: "middle" }, // อุบลรัตน์ จ.ขอนแก่น
    8: { lat: 17.32, lon: 98.18, region: "ภาคตะวันตก (ชายแดนเหนือ)", dx: 11, dy: -2, anchor: "start" }, // ท่าสองยาง จ.ตาก
    9: { lat: 15.98, lon: 98.86, region: "ภาคตะวันตก (ชายแดนใต้)", dx: 11, dy: 5, anchor: "start" } // อุ้มผาง จ.ตาก
  };

  const SITE_PIN_COLORS = {
    1: "#007aff",
    2: "#28a745",
    3: "#0097a7",
    4: "#e67e22",
    5: "#5856d6",
    6: "#af52de",
    7: "#d97706",
    8: "#0d9488",
    9: "#e11d48"
  };

  function projectThailandLatLon(lat, lon) {
    const x = 34 + (lon - 97.2) * 44.5;
    const y = 26 + (20.6 - lat) * 43.2;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  }

  function initFieldworkControls() {
    ensureGroupHoverPreview();
    const areaSel = $("fieldAreaSelect");
    if (areaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(s.shortName, s.shortName));
      });
      areaSel.addEventListener("change", () => {
        state.fieldContext = null;
        if (areaSel.value && state.fieldViewMode === "deck") {
          const foundIdx = (SCHED.fieldworkSites || []).findIndex((x) => x.shortName === areaSel.value);
          if (foundIdx >= 0) state.fieldDeckIdx = foundIdx;
        }
        renderFieldworkView();
      });
    }

    if ($("fieldSearchInput")) {
      $("fieldSearchInput").addEventListener("input", renderFieldworkView);
    }

    if ($("fieldClearFiltersBtn")) {
      $("fieldClearFiltersBtn").addEventListener("click", () => {
        state.fieldContext = null;
        state.mapHoverSite = "";
        if ($("fieldSearchInput")) $("fieldSearchInput").value = "";
        if (areaSel) areaSel.value = "";
        renderFieldworkView();
      });
    }

    if ($("fieldTogglePhotosBtn")) {
      $("fieldTogglePhotosBtn").addEventListener("click", () => {
        state.showPhotos = !state.showPhotos;
        syncPhotoToggleButtons();
        renderFieldworkView();
      });
    }

    const toggleSitesBtn = $("toggleSitesOverviewBtn");
    if (toggleSitesBtn) {
      toggleSitesBtn.textContent = "ซ่อนแผนที่ 9 พื้นที่";
      toggleSitesBtn.addEventListener("click", () => {
        state.showSitesOverview = !state.showSitesOverview;
        if ($("sitesOverviewGrid")) $("sitesOverviewGrid").hidden = !state.showSitesOverview;
        toggleSitesBtn.textContent = state.showSitesOverview
          ? "ซ่อนแผนที่ 9 พื้นที่"
          : "แสดงแผนที่ประเทศไทย 9 พื้นที่";
      });
    }

    ["fieldPrintBtn", "fieldPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).addEventListener("click", () => printRosterOnePage("fieldwork"));
    });

    if ($("exportFieldPdfBtn")) {
      $("exportFieldPdfBtn").addEventListener("click", (ev) => {
        if ($("exportFieldPdfBtn").dataset.dynamicPrint === "1") {
          ev.preventDefault();
          printRosterOnePage("fieldwork");
        }
      });
    }

    if ($("exportFieldDocxBtn")) {
      $("exportFieldDocxBtn").addEventListener("click", (ev) => {
        const aVal = ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "";
        const qVal = (($("fieldSearchInput") && $("fieldSearchInput").value) || "").trim();
        if (!aVal && !qVal) return; // use pre-built full Fieldwork DOCX
        ev.preventDefault();
        const siteObj = aVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === aVal) : null;
        const rows = (state.visibleFieldStudents || [])
          .map(
            (s, idx) =>
              `<tr><td>${idx + 1}</td><td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.fullName)}</td><td>${escapeHtml(s.nickname || "-")}</td><td>${escapeHtml(s.area)}</td><td>กลุ่ม ${s.disc}</td></tr>`
          )
          .join("");
        const title = siteObj
          ? `รายชื่อนักศึกษาพื้นที่ภาคสนามกลุ่มที่ ${siteObj.id}: ${siteObj.hospital} (${siteObj.province})`
          : "รายชื่อนักศึกษาพื้นที่ภาคสนาม (ตามเงื่อนไขที่กรอง)";
        const sub = siteObj
          ? `อาจารย์ที่ปรึกษา: ${siteObj.advisors} · ห้อง ${siteObj.room} · ${siteObj.datesTH}`
          : `จำนวน ${(state.visibleFieldStudents || []).length} คน`;
        downloadHtmlAsGenuineDocx(
          title,
          sub,
          `<table><thead><tr><th>ลำดับ</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>พื้นที่ภาคสนาม</th><th>กลุ่ม Discussion</th></tr></thead><tbody>${rows}</tbody></table>`,
          `รายชื่อ_ภาคสนาม_${sanitizeFilenamePart(aVal || "Filtered")}_RACM303_2569.docx`
        );
      });
    }

    syncPhotoToggleButtons();
  }

  function renderSitesOverviewSection(sitesGrid, activeAreaVal) {
    if (!sitesGrid) return;
    sitesGrid.hidden = !state.showSitesOverview;
    sitesGrid.className = state.fieldOverviewStyle === "map" ? "th-fieldwork-overview-wrap" : "th-fieldwork-overview-wrap is-cards-mode";
    sitesGrid.replaceChildren();

    const sites = SCHED.fieldworkSites || [];
    if (!sites.length) return;

    // Top mode bar: Map (default) vs 9 Cards
    const modeHead = make("div", null, "th-map-topbar");
    const modeInfo = make("div", null, "th-map-topbar-info");
    modeInfo.innerHTML =
      `<strong>🗺 แผนที่โรงพยาบาลชุมชน 9 พื้นที่ภาคสนามทั่วประเทศ</strong>` +
      `<span>เลื่อนเมาส์ชี้ (Hover) บนหมุดจังหวัดในแผนที่เพื่อดูข้อมูลโรงพยาบาล วันเดินทาง และรูปสมาชิกทันที · คลิกที่หมุดเพื่อล็อกกรองรายชื่อด้านล่าง</span>`;

    const seg = make("div", null, "reader-mode-seg");
    const mapBtn = make("button", "🗺 แผนที่ประเทศไทย (Hover)", "reader-mode-btn");
    mapBtn.type = "button";
    mapBtn.setAttribute("aria-pressed", state.fieldOverviewStyle === "map" ? "true" : "false");
    mapBtn.addEventListener("click", () => {
      state.fieldOverviewStyle = "map";
      renderSitesOverviewSection(sitesGrid, ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "");
    });

    const cardsBtn = make("button", "▦ การ์ด 9 พื้นที่แบบเต็ม", "reader-mode-btn");
    cardsBtn.type = "button";
    cardsBtn.setAttribute("aria-pressed", state.fieldOverviewStyle === "cards" ? "true" : "false");
    cardsBtn.addEventListener("click", () => {
      state.fieldOverviewStyle = "cards";
      renderSitesOverviewSection(sitesGrid, ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "");
    });
    seg.append(mapBtn, cardsBtn);
    modeHead.append(modeInfo, seg);
    sitesGrid.appendChild(modeHead);

    if (state.fieldOverviewStyle === "cards") {
      const classicGrid = make("div", null, "sites-grid");
      sites.forEach((site, idx) => {
        const c = make("div", null, `site-card${site.shortName === activeAreaVal ? " active-site" : ""}`);
        c.dataset.siteName = site.shortName;
        const friBadge = site.hasFri11Dec
          ? `<span class="badge cat-HS">ศ. 11 ธ.ค. มีเรียนกลุ่มย่อย 5–6</span>`
          : `<span class="badge">เดินทาง พฤ. 10 ธ.ค. (ไม่มีเรียน 11 ธ.ค.)</span>`;
        const staffLine =
          ROLE === "faculty" && site.staffRef
            ? `<p class="site-meta"><strong>เจ้าหน้าที่ประสานงาน:</strong> ${escapeHtml(site.staffRef)}</p>`
            : "";

        c.innerHTML = `
          <div class="site-card-head">
            <h3><span class="area-sub-pill area-site-${site.id}" data-hover-area="${escapeHtml(site.shortName)}"><i class="area-dot"></i>${site.id}. ${escapeHtml(site.shortName)}</span></h3>
            <span class="badge cat-SG">${site.count} คน</span>
          </div>
          <p class="site-meta"><strong>${escapeHtml(site.hospital)}</strong> (${escapeHtml(site.province)})</p>
          <p class="site-meta"><strong>อ.ที่ปรึกษา:</strong> ${escapeHtml(site.advisors)}</p>
          <p class="site-meta"><strong>ห้องประชุมกลุ่มย่อย:</strong> ${escapeHtml(site.room)}</p>
          <p class="site-meta"><strong>ช่วงฝึกภาคสนาม:</strong> ${escapeHtml(site.datesTH)}</p>
          <p class="site-meta">${escapeHtml(site.travelNote)}</p>
          ${staffLine}
          <div style="margin-top:6px">${friBadge}</div>
        `;

        const actRow = make("div", null, "header-actions");
        actRow.style.marginTop = "10px";
        const filterBtn = make("button", `ดูรายชื่อกลุ่ม ${site.shortName}`, "btn sm primary");
        filterBtn.type = "button";
        filterBtn.addEventListener("click", () => {
          if (state.fieldViewMode === "deck") {
            state.fieldDeckIdx = idx;
            renderFieldworkView();
            return;
          }
          const sel = $("fieldAreaSelect");
          if (sel) sel.value = sel.value === site.shortName ? "" : site.shortName;
          state.fieldContext = null;
          renderFieldworkView();
        });
        const icsLink = make("a", "Export .ics กลุ่มนี้", "btn sm teal");
        icsLink.href = `calendars/group_${site.id}_${site.slug}.ics`;
        icsLink.setAttribute("download", `RACM303_2569_group_${site.id}_${site.slug}.ics`);
        actRow.append(filterBtn, icsLink);
        c.appendChild(actRow);
        classicGrid.appendChild(c);
      });
      sitesGrid.appendChild(classicGrid);
      return;
    }

    // Interactive Thailand SVG Map + Right-Hand Hover Inspector
    const split = make("div", null, "th-map-studio-grid");
    const mapCard = make("div", null, "th-map-canvas-card");
    const inspector = make("div", null, "th-map-inspector-card");

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 440 680");
    svg.setAttribute("class", "th-svg-map");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "แผนที่ประเทศไทยแสดงตำแหน่งโรงพยาบาลชุมชน 9 พื้นที่ภาคสนาม");

    // Ocean / Sea labels
    const seaGulf = document.createElementNS(svgNS, "text");
    seaGulf.setAttribute("x", "252");
    seaGulf.setAttribute("y", "445");
    seaGulf.setAttribute("class", "th-sea-label");
    seaGulf.textContent = "อ่าวไทย";

    const seaAndaman = document.createElementNS(svgNS, "text");
    seaAndaman.setAttribute("x", "38");
    seaAndaman.setAttribute("y", "492");
    seaAndaman.setAttribute("class", "th-sea-label");
    seaAndaman.textContent = "ทะเลอันดามัน";

    // Thailand Mainland Polygon
    const poly = document.createElementNS(svgNS, "polygon");
    const ptsStr = THAILAND_OUTLINE_LATLON.map(([la, lo]) => projectThailandLatLon(la, lo).join(",")).join(" ");
    poly.setAttribute("points", ptsStr);
    poly.setAttribute("class", "th-land-poly");

    // Phuket & Koh Samui mini-islands
    const phuket = document.createElementNS(svgNS, "ellipse");
    const [pkx, pky] = projectThailandLatLon(7.92, 98.34);
    phuket.setAttribute("cx", String(pkx));
    phuket.setAttribute("cy", String(pky));
    phuket.setAttribute("rx", "4.5");
    phuket.setAttribute("ry", "9");
    phuket.setAttribute("class", "th-land-poly");

    const samui = document.createElementNS(svgNS, "circle");
    const [smx, smy] = projectThailandLatLon(9.52, 100.00);
    samui.setAttribute("cx", String(smx));
    samui.setAttribute("cy", String(smy));
    samui.setAttribute("r", "4.5");
    samui.setAttribute("class", "th-land-poly");

    svg.append(poly, phuket, samui, seaGulf, seaAndaman);

    // Origin Hub: Ramathibodi / CNMI (Bangkok - Samut Prakan)
    const [bx, by] = projectThailandLatLon(13.62, 100.62);
    const routesGroup = document.createElementNS(svgNS, "g");
    const pinsGroup = document.createElementNS(svgNS, "g");

    // Origin marker
    const hubG = document.createElementNS(svgNS, "g");
    hubG.setAttribute("class", "th-origin-hub");
    const hubCircle = document.createElementNS(svgNS, "circle");
    hubCircle.setAttribute("cx", String(bx));
    hubCircle.setAttribute("cy", String(by));
    hubCircle.setAttribute("r", "5.5");
    hubCircle.setAttribute("fill", "#002d72");
    hubCircle.setAttribute("stroke", "#ffb81c");
    hubCircle.setAttribute("stroke-width", "2");
    const hubTxt = document.createElementNS(svgNS, "text");
    hubTxt.setAttribute("x", String(bx + 9));
    hubTxt.setAttribute("y", String(by + 4));
    hubTxt.setAttribute("class", "th-hub-label");
    hubTxt.textContent = "★ รามาฯ / CNMI";
    hubG.append(hubCircle, hubTxt);

    const resolveInspectedSite = () => {
      const targetName =
        state.mapHoverSite ||
        activeAreaVal ||
        (state.myStudent && state.myStudent.area) ||
        (sites[0] && sites[0].shortName);
      return sites.find((x) => x.shortName === targetName) || sites[0];
    };

    const renderMapInspectorContent = () => {
      const curSite = resolveInspectedSite();
      if (!curSite) return;
      const isLocked = activeAreaVal === curSite.shortName;
      const isMine = state.myStudent && state.myStudent.area === curSite.shortName;
      const geo = SITE_GEO_COORDS[curSite.id] || {};

      svg.querySelectorAll("[data-map-site]").forEach((el) => {
        el.classList.toggle("is-focused", el.dataset.mapSite === curSite.shortName);
        el.classList.toggle("is-locked", el.dataset.mapSite === activeAreaVal);
      });

      inspector.replaceChildren();
      inspector.style.padding = "0";
      inspector.style.border = "0";
      inspector.style.background = "transparent";
      inspector.style.boxShadow = "none";

      const members = ROSTER.students
        .filter((s) => s.area === curSite.shortName)
        .sort((a, b) => a.disc - b.disc || compareTH(a.id, b.id));

      const tabs = sites.map((st) => ({
        id: st.shortName,
        label: `${st.id}.${st.shortName}`,
        color: SITE_PIN_COLORS[st.id] || "#007aff",
        active: st.shortName === curSite.shortName,
        onHover: () => {
          if (state.mapHoverSite !== st.shortName) {
            state.mapHoverSite = st.shortName;
            renderMapInspectorContent();
          }
        },
        onClick: () => {
          const sel = $("fieldAreaSelect");
          if (sel) sel.value = sel.value === st.shortName ? "" : st.shortName;
          state.mapHoverSite = st.shortName;
          state.fieldContext = null;
          renderFieldworkView();
        }
      }));

      const actRow = make("div", null, "header-actions");
      const lockBtn = make(
        "button",
        isLocked ? `✓ กำลังกรอง ${curSite.shortName}` : `กรองรายชื่อ ${curSite.shortName} ด้านล่าง`,
        "btn sm primary"
      );
      lockBtn.type = "button";
      lockBtn.addEventListener("click", () => {
        const sel = $("fieldAreaSelect");
        if (sel) sel.value = isLocked ? "" : curSite.shortName;
        state.fieldContext = null;
        renderFieldworkView();
        const dockEl = document.querySelector('.roster-sticky-dock[data-scope="fieldwork"]') || $("fieldCardsContainer");
        if (dockEl && !isLocked) dockEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const pdfSiteLink = make("a", null, "btn sm pdf-red");
      pdfSiteLink.href = `exports/pdf/RACM303_2569_Fieldwork_S${curSite.id}.pdf`;
      pdfSiteLink.setAttribute("download", `ใบรายชื่อ_ภาคสนาม_กลุ่ม${curSite.id}_${curSite.shortName}_A4.pdf`);
      pdfSiteLink.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF`;

      const printSiteBtn = make("button", null, "btn sm print-ink");
      printSiteBtn.type = "button";
      printSiteBtn.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print (A4)`;
      printSiteBtn.addEventListener("click", () => printSingleGroupHelper("fieldwork", curSite.shortName));

      const icsLink = make("a", null, "btn sm teal");
      icsLink.href = `calendars/group_${curSite.id}_${curSite.slug}.ics`;
      icsLink.setAttribute("download", `RACM303_2569_group_${curSite.id}_${curSite.slug}.ics`);
      icsLink.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Export .ics`;

      actRow.append(lockBtn, pdfSiteLink, printSiteBtn, icsLink);

      const staffPart = ROLE === "faculty" && curSite.staffRef ? ` · ผู้ประสานงาน: ${curSite.staffRef}` : "";
      const friNote = curSite.hasFri11Dec ? "ศ. 11 ธ.ค. มีกลุ่มย่อย 5–6" : "เดินทาง พฤ. 10 / พ. 9 ธ.ค.";

      inspector.appendChild(
        renderBroadcastFormationBoard({
          mode: "fieldwork",
          wide: false,
          tabs,
          crestKicker: "SITE",
          crestNum: String(curSite.id).padStart(2, "0"),
          teamColor: SITE_PIN_COLORS[curSite.id] || "#007aff",
          eyebrowText: `พื้นที่ที่ ${curSite.id} · ${geo.region || curSite.province}${isMine ? " · ★ พื้นที่ของฉัน" : ""}`,
          titleText: `${curSite.hospital} (${curSite.province})`,
          subText: `ห้อง ${curSite.room.split(" ")[0]} · ${curSite.datesTH} · ${friNote}${staffPart}`,
          mentorLabel: "อาจารย์ที่ปรึกษา",
          mentorValue: curSite.advisors,
          members,
          viewStyle: state.mapInspectorStyle || "formation",
          onToggleStyle: (nextStyle) => {
            state.mapInspectorStyle = nextStyle;
            renderMapInspectorContent();
          },
          footerActions: actRow
        })
      );
    };

    sites.forEach((site) => {
      const geo = SITE_GEO_COORDS[site.id] || { lat: 15.0, lon: 101.0, dx: 10, dy: 4, anchor: "start" };
      const [sx, sy] = projectThailandLatLon(geo.lat, geo.lon);
      const pinColor = SITE_PIN_COLORS[site.id] || "#007aff";
      const isMine = state.myStudent && state.myStudent.area === site.shortName;

      // Curved dashed route from Ramathibodi/CNMI to hospital
      const route = document.createElementNS(svgNS, "path");
      const mx = ((bx + sx) / 2 + (sy < by ? -12 : 12)).toFixed(1);
      const my = ((by + sy) / 2).toFixed(1);
      route.setAttribute("d", `M ${bx} ${by} Q ${mx} ${my} ${sx} ${sy}`);
      route.setAttribute("class", "th-route-arc");
      route.dataset.mapSite = site.shortName;
      route.style.setProperty("--pin-color", pinColor);
      routesGroup.appendChild(route);

      const pinG = document.createElementNS(svgNS, "g");
      pinG.setAttribute("class", `th-map-pin-group${isMine ? " is-mine" : ""}`);
      pinG.dataset.mapSite = site.shortName;
      pinG.style.setProperty("--pin-color", pinColor);
      pinG.setAttribute("tabindex", "0");
      pinG.setAttribute("role", "button");
      pinG.setAttribute("aria-label", `${site.id}. ${site.shortName} ${site.hospital} ${site.province} ${site.count} คน`);

      const halo = document.createElementNS(svgNS, "circle");
      halo.setAttribute("cx", String(sx));
      halo.setAttribute("cy", String(sy));
      halo.setAttribute("r", "12");
      halo.setAttribute("class", "th-pin-halo");

      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", String(sx));
      dot.setAttribute("cy", String(sy));
      dot.setAttribute("r", "7.5");
      dot.setAttribute("fill", pinColor);
      dot.setAttribute("stroke", "#ffffff");
      dot.setAttribute("stroke-width", "2.2");
      dot.setAttribute("class", "th-pin-dot");

      const numTxt = document.createElementNS(svgNS, "text");
      numTxt.setAttribute("x", String(sx));
      numTxt.setAttribute("y", String(sy + 3.4));
      numTxt.setAttribute("text-anchor", "middle");
      numTxt.setAttribute("class", "th-pin-num");
      numTxt.textContent = String(site.id);

      const lbl = document.createElementNS(svgNS, "text");
      lbl.setAttribute("x", String(sx + geo.dx));
      lbl.setAttribute("y", String(sy + geo.dy));
      lbl.setAttribute("text-anchor", geo.anchor || "start");
      lbl.setAttribute("class", "th-pin-label");
      lbl.textContent = `${site.id}.${site.shortName}`;

      pinG.append(halo, dot, numTxt, lbl);

      const focusSite = () => {
        state.mapHoverSite = site.shortName;
        renderMapInspectorContent();
      };
      const toggleLockSite = () => {
        const sel = $("fieldAreaSelect");
        if (sel) sel.value = sel.value === site.shortName ? "" : site.shortName;
        state.mapHoverSite = site.shortName;
        state.fieldContext = null;
        renderFieldworkView();
      };

      pinG.addEventListener("mouseenter", focusSite);
      pinG.addEventListener("focus", focusSite);
      pinG.addEventListener("click", toggleLockSite);
      pinG.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleLockSite();
        }
      });

      pinsGroup.appendChild(pinG);
    });

    svg.append(routesGroup, hubG, pinsGroup);
    mapCard.appendChild(svg);

    const mapFoot = make("div", null, "th-map-caption");
    mapFoot.innerHTML = `<span>★ จุดเริ่มต้น: คณะแพทยศาสตร์ รพ.รามาธิบดี / CNMI</span><span>คลิกหมุดเพื่อล็อกกลุ่ม · คลิกซ้ำเพื่อดูครบ 9 แห่ง</span>`;
    mapCard.appendChild(mapFoot);

    split.append(mapCard, inspector);
    sitesGrid.appendChild(split);
    renderMapInspectorContent();
  }

  function renderFieldworkView() {
    const areaVal = ($("fieldAreaSelect") && $("fieldAreaSelect").value) || "";
    const q = (($("fieldSearchInput") && $("fieldSearchInput").value) || "").trim().toLocaleLowerCase("th");

    const sitesGrid = $("sitesOverviewGrid");
    if (sitesGrid) {
      renderSitesOverviewSection(sitesGrid, areaVal);
    }

    const ctxBox = $("fieldContextBanner");
    if (ctxBox) {
      ctxBox.replaceChildren();
      ctxBox.hidden = !state.fieldContext;
      if (state.fieldContext) {
        const c = state.fieldContext;
        const left = make("div");
        left.append(
          make("h3", c.topic),
          make("p", `${c.date} · ${c.time} · ห้อง/สถานที่: ${c.room}`),
          make("p", `ผู้สอน/อ.ที่ปรึกษา: ${c.lecturer} · ${c.label}`)
        );
        const right = make("div", null, "header-actions");
        const backBtn = make("button", "กลับไปปฏิทินสอน", "btn sm");
        backBtn.type = "button";
        backBtn.addEventListener("click", () => switchTab("schedule"));
        right.append(backBtn);
        ctxBox.append(left, right);
      }
    }

    const fieldPdfBtn = $("exportFieldPdfBtn");
    if (fieldPdfBtn) {
      const matchedSite = areaVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal) : null;
      if (!q) {
        fieldPdfBtn.dataset.dynamicPrint = "0";
        if (matchedSite) {
          fieldPdfBtn.href = `exports/pdf/RACM303_2569_Fieldwork_S${matchedSite.id}.pdf`;
          fieldPdfBtn.setAttribute("download", `ใบรายชื่อ_ภาคสนาม_กลุ่ม${matchedSite.id}_${matchedSite.shortName}_A4.pdf`);
        } else {
          fieldPdfBtn.href = "exports/pdf/RACM303_2569_Fieldwork_All.pdf";
          fieldPdfBtn.setAttribute("download", "ใบรายชื่อ_9พื้นที่ภาคสนาม_RACM303_2569.pdf");
        }
      } else {
        fieldPdfBtn.dataset.dynamicPrint = "1";
      }
    }

    const siteOrder = new Map((SCHED.fieldworkSites || []).map((s, idx) => [s.shortName, idx]));
    const list = ROSTER.students.filter((s) => {
      if (areaVal && s.area !== areaVal) return false;
      if (q) {
        const siteMeta = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area) || {};
        const hay = `${s.id} ${s.fullName} ${s.nickname} ${s.area} ${siteMeta.hospital || ""} ${siteMeta.province || ""} ${s.advisor} discussion กลุ่มที่ ${s.disc}`.toLocaleLowerCase("th");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const oa = siteOrder.has(a.area) ? siteOrder.get(a.area) : 99;
      const ob = siteOrder.has(b.area) ? siteOrder.get(b.area) : 99;
      return oa - ob || compareTH(a.id, b.id);
    });
    state.visibleFieldStudents = list;

    const activeSiteObj = areaVal ? (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal) : null;
    const selectionLabel = activeSiteObj
      ? `กลุ่มพื้นที่ ${activeSiteObj.shortName} (${activeSiteObj.hospital} ${activeSiteObj.province})`
      : "นักศึกษาแพทย์ชั้นปีที่ 3 ทั้ง 9 พื้นที่ภาคสนาม";

    if ($("fieldStatusText")) {
      $("fieldStatusText").textContent = `${selectionLabel} · แสดง ${list.length} คน จากทั้งหมด ${ROSTER.students.length} คน`;
    }
    ["fieldPrintBtn", "fieldPrintTopBtn"].forEach((id) => {
      if ($(id)) $(id).disabled = list.length === 0;
    });

    const printHeading = $("fieldPrintHeading");
    if (printHeading) {
      printHeading.replaceChildren(make("strong", `RACM 303 (ปีการศึกษา 2569) · ${selectionLabel} · ${list.length} คน`));
      if (state.fieldContext) {
        printHeading.append(
          make("div", state.fieldContext.topic),
          make("div", `${state.fieldContext.date} · ${state.fieldContext.time} · ${state.fieldContext.room}`)
        );
      } else if (activeSiteObj) {
        printHeading.appendChild(
          make("div", `อาจารย์ที่ปรึกษา: ${activeSiteObj.advisors} · ห้องกลุ่มย่อย: ${activeSiteObj.room} · ช่วงฝึก: ${activeSiteObj.datesTH}`)
        );
      }
    }

    const cardsEl = $("fieldCardsContainer");
    if (!cardsEl) return;
    if (photoObserver) photoObserver.disconnect();
    cardsEl.replaceChildren();

    if (!list.length) {
      cardsEl.appendChild(make("div", "ไม่พบรายชื่อนักศึกษาในกลุ่มพื้นที่ภาคสนามตามเงื่อนไขที่เลือก", "empty-state"));
    } else {
      let lastArea = null;
      list.forEach((s) => {
        if (!areaVal && s.area !== lastArea) {
          lastArea = s.area;
          const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area);
          const h = make("div", null, "area-group-header");
          h.append(
            make("h3", `${siteObj ? siteObj.id + ". " : ""}กลุ่มพื้นที่ ${s.area}${siteObj ? " (" + siteObj.hospital + " " + siteObj.province + " · " + siteObj.count + " คน)" : ""}`),
            make("p", `อาจารย์ที่ปรึกษา: ${s.advisor}${siteObj ? " · ห้อง " + siteObj.room + " · " + siteObj.datesTH : ""}`)
          );
          cardsEl.appendChild(h);
        }
        cardsEl.appendChild(renderStudentCardElement(s, "fieldwork"));
      });
    }

    syncRosterSuiteUI("fieldwork", {
      q,
      activeGroupVal: areaVal,
      areaSubVal: "",
      list
    });
  }

  /* ---------- Shared 1-Page A4 Auto-Fit Roster Printing ---------- */
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

  function fitPrintRoster(mode) {
    const targetMode = mode || (state.activeTab === "discussion" ? "discussion" : "fieldwork");
    const list = targetMode === "discussion" ? state.visibleDiscStudents : state.visibleFieldStudents;
    const layout = computePrintLayout((list && list.length) || 1);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--pc", String(layout.cols));
    rootStyle.setProperty("--pr", `${layout.height}mm`);
    rootStyle.setProperty("--pp", `${layout.photo}mm`);
    rootStyle.setProperty("--pt", `${layout.title}pt`);
    rootStyle.setProperty("--pb", `${layout.text}pt`);
  }

  async function printRosterOnePage(mode) {
    const targetMode = mode === "discussion" ? "discussion" : "fieldwork";
    const list = targetMode === "discussion" ? state.visibleDiscStudents : state.visibleFieldStudents;
    if (!list || !list.length) return;

    document.body.classList.add("print-students-mode");
    document.body.classList.toggle("print-disc-mode", targetMode === "discussion");

    const containerSelector = targetMode === "discussion" ? "#discCardsContainer" : "#fieldCardsContainer";
    if (state.showPhotos) {
      document.querySelectorAll(`${containerSelector} .student-portrait`).forEach((box) => {
        if (!box.querySelector("img") && (box.dataset.studentId || box.dataset.photoId)) mountStudentPhoto(box);
      });
    }
    fitPrintRoster(targetMode);
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    window.print();
  }

  /* ---------- Tab 4: Separated Submissions Hub & RAMED E-learning Backend Integration ---------- */
  const COURSE_DELIVERABLES = [
    {
      id: "srn1",
      code: "SRN 1",
      scopeBadge: "งานเดี่ยว · PDF ≤ 5 หน้า A4",
      title: "บันทึกการเรียนรู้สะท้อนคิด ครั้งที่ 1 (Self-Reflection Note 1)",
      dueTH: "วันพุธที่ 9 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-09T17:00:00+07:00",
      sessionId: "w3-d3-srn1",
      backendType: "ramed",
      backendLabel: ROLE === "faculty" ? "ตรวจ SRN 1 ในห้องวิชา id=398 ↗" : "ส่งในห้องวิชา RACM 303 (id=398) ↗",
      prereq: "เงื่อนไขก่อนส่ง: ต้องทำแบบประเมินการเรียนการสอนภาคทฤษฎี (Online) ให้เรียบร้อยก่อนอัปโหลดไฟล์ PDF · อาจารย์ที่ปรึกษาตรวจประเมินตามฟอร์ม 1A และให้ Feedback ระหว่างฝึกภาคสนาม",
      manualChapterId: "man-ch-11",
      manualBtnLabel: "เกณฑ์การเขียน SRN (บทที่ 11)",
      srnRound: "SRN1"
    },
    {
      id: "srn2",
      code: "SRN 2",
      scopeBadge: "งานเดี่ยว · PDF ≤ 5 หน้า A4",
      title: "บันทึกการเรียนรู้สะท้อนคิด ครั้งที่ 2 (Self-Reflection Note 2)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "ramed",
      backendLabel: ROLE === "faculty" ? "ตรวจ SRN 2 ในห้องวิชา id=398 ↗" : "ส่งในห้องวิชา RACM 303 (id=398) ↗",
      prereq: "เงื่อนไขก่อนส่ง: ทำแบบประเมินพฤติกรรมเพื่อนร่วมกลุ่ม (Peer Evaluation) และแบบประเมินรายวิชาออนไลน์ให้ครบถ้วนก่อนส่งงานในระบบ E-learning",
      manualChapterId: "man-ch-11",
      manualBtnLabel: "เกณฑ์ SRN & กำหนดส่ง (บทที่ 11)",
      srnRound: "SRN2"
    },
    {
      id: "field_slides",
      code: "SLIDES 3A & 4A",
      scopeBadge: "งานกลุ่ม · 9 พื้นที่ภาคสนาม",
      title: "ไฟล์สไลด์นำเสนอการเรียนรู้ภาคสนาม 2 เรื่อง (ระบบสุขภาพ ฟอร์ม 3A & ระบาดวิทยา ฟอร์ม 4A)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น. (ลงไฟล์หน้าห้อง 2C2-03 เวลา 08.00–08.30 น. วันนำเสนอ)",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "gform",
      backendLabel: "ส่งสไลด์ทาง Google Form ปี 2569 ↗",
      prereq: "อ. 29 ธ.ค. 69 นำเสนอระบบสุขภาพ (พูด ≤ 10 นาที + อภิปราย 20 นาที) · พ. 30 ธ.ค. 69 นำเสนอระบาดวิทยา (พูด ≤ 7 นาที + อภิปราย 18 นาที) ณ ห้อง 2C2-03",
      manualChapterId: "man-ch-16",
      manualBtnLabel: "เกณฑ์นำเสนอ 3A & 4A (บทที่ 16–17)",
      srnRound: null
    },
    {
      id: "health_survey",
      code: "HEALTH SURVEY",
      scopeBadge: "งานกลุ่ม · 9 พื้นที่ภาคสนาม",
      title: "แบบสอบถามและฐานข้อมูลการสำรวจปัญหาสุขภาพชุมชน (Health Survey)",
      dueTH: "วันพุธที่ 30 ธันวาคม 2569 · ภายในเวลา 17.00 น.",
      dueISO: "2026-12-30T17:00:00+07:00",
      sessionId: "w6-d3-srn2",
      backendType: "gform",
      backendLabel: "ส่ง Health Survey ทาง Google Form ↗",
      prereq: "รวบรวมไฟล์แบบสอบถาม (Questionnaire) และชุดข้อมูลจากการศึกษาเชิงปริมาณของกลุ่มพื้นที่ภาคสนาม ส่งพร้อมสไลด์นำเสนอภายในเวลา 17.00 น.",
      manualChapterId: "man-ch-17",
      manualBtnLabel: "แนวทางระบาดวิทยาภาคสนาม (บทที่ 17)",
      srnRound: null
    }
  ];

  function getActiveRamedTargetUrl() {
    return state.pinnedRamedUrl || RAMED_COURSE_URL;
  }

  function isValidRamedUrl(rawUrl) {
    try {
      const u = new URL(String(rawUrl || "").trim());
      return u.protocol === "https:" && u.hostname === "elearning.ra.mahidol.ac.th" && u.pathname.startsWith("/ramed/");
    } catch (_) {
      return false;
    }
  }

  function syncPinnedRamedCourseUI() {
    const pinnedBtn = $("openPinnedRamedCourseBtn");
    const clearBtn = $("clearRamedCustomUrlBtn");
    const input = $("ramedCustomCourseUrlInput");
    const feedback = $("ramedPinFeedback");

    const validPinned = isValidRamedUrl(state.pinnedRamedUrl) ? state.pinnedRamedUrl : "";
    state.pinnedRamedUrl = validPinned;

    if (input && document.activeElement !== input) {
      input.value = validPinned;
    }
    if (pinnedBtn) {
      pinnedBtn.hidden = !validPinned;
      pinnedBtn.href = validPinned || RAMED_COURSE_URL;
    }
    if (clearBtn) {
      clearBtn.hidden = !validPinned;
    }
    if (feedback && validPinned) {
      feedback.textContent = `✓ ปักหมุดลิงก์ย่อยเรียบร้อยแล้ว: ${validPinned}`;
    }
  }

  async function checkRamedBackendReachability() {
    const badge = $("ramedBackendStatusBadge");
    if (!badge || state.ramedPinged) return;
    state.ramedPinged = true;

    if (typeof fetch !== "function") {
      badge.className = "elearning-status-pill is-online";
      badge.textContent = "● ห้องเรียนออนไลน์ RACM 303 พร้อมใช้งาน";
      return;
    }

    badge.className = "elearning-status-pill is-checking";
    badge.textContent = "● กำลังตรวจสอบสถานะห้องเรียนออนไลน์…";

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 6500) : null;
    try {
      await fetch(RAMED_COURSE_URL, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined
      });
      if (timer) clearTimeout(timer);
      badge.className = "elearning-status-pill is-online";
      badge.textContent = "● เชื่อมต่อห้องเรียนออนไลน์ RACM 303 แล้ว";
    } catch (_) {
      if (timer) clearTimeout(timer);
      badge.className = "elearning-status-pill is-checking";
      badge.textContent = "● ห้องเรียนออนไลน์พร้อมเข้าสู่ระบบตามรหัสผู้ใช้";
    }
  }

  function sanitizeFilenamePart(str) {
    return String(str || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ");
  }

  function updateSrnFilename() {
    const round = ($("srnRoundSelect") && $("srnRoundSelect").value) || "SRN1";
    const area = sanitizeFilenamePart(($("srnAreaSelect") && $("srnAreaSelect").value) || "กุฉินารายณ์");
    const sid = sanitizeFilenamePart(($("srnStudentId") && $("srnStudentId").value) || "") || "6702xxx";
    const sname = sanitizeFilenamePart(($("srnStudentName") && $("srnStudentName").value) || "") || "ชื่อ-นามสกุล";
    const finalName = `${round}_${area}_${sid}_${sname}.pdf`;
    const preview = $("srnFilenamePreview");
    if (preview) preview.textContent = finalName;
    if ($("downloadRenamedPdfBtn") && state.inspectedPdfBytes) {
      setBtnLabel($("downloadRenamedPdfBtn"), `Export "${finalName}"`);
    }
    return finalName;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function inspectSrnPdfFile(file) {
    const resBox = $("srnPdfCheckResult");
    const dlBtn = $("downloadRenamedPdfBtn");
    if (!file || !resBox) return;

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const headAscii = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(1024, bytes.length)));

      if (!headAscii.includes("%PDF-")) {
        state.inspectedPdfBytes = null;
        state.inspectedPdfOrigName = "";
        if (dlBtn) dlBtn.hidden = true;
        resBox.hidden = false;
        resBox.className = "pdf-check-result is-error";
        resBox.innerHTML = `<strong>✗ ไฟล์ "${escapeHtml(file.name)}" ไม่ใช่ไฟล์ PDF มาตรฐาน</strong><br>กรุณาบันทึกหรือ Export เอกสารจาก Word / Google Docs / Goodnotes เป็นนามสกุล <code>.pdf</code> ก่อนส่งขึ้นระบบ RAMED E-learning`;
        return;
      }

      const fullLatin1 = new TextDecoder("latin1").decode(bytes);
      const pageMatches = fullLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
      const estPages = pageMatches ? pageMatches.length : null;
      const sizeStr = formatFileSize(bytes.length);
      const targetName = updateSrnFilename();

      state.inspectedPdfBytes = bytes;
      state.inspectedPdfOrigName = file.name;
      if (dlBtn) {
        dlBtn.hidden = false;
        setBtnLabel(dlBtn, `Export "${targetName}"`);
      }

      resBox.hidden = false;
      if (estPages && estPages > 5) {
        resBox.className = "pdf-check-result is-warn";
        resBox.innerHTML =
          `<strong>⚠ ตรวจพบความยาวประมาณ ${estPages} หน้า (ขนาด ${escapeHtml(sizeStr)})</strong><br>` +
          `คู่มือรายวิชากำหนดความยาว SRN <strong>ไม่เกิน 5 หน้ากระดาษ A4</strong> — แนะนำให้ปรับลดจำนวนหน้าก่อนอัปโหลด หรือกดปุ่มด้านบนเพื่อบันทึกเป็นชื่อ <code>${escapeHtml(targetName)}</code>`;
      } else {
        const pageInfo = estPages ? `จำนวน ${estPages} หน้า (ผ่านเกณฑ์ ≤ 5 หน้า A4)` : "รูปแบบ PDF มาตรฐาน";
        resBox.className = "pdf-check-result is-ok";
        resBox.innerHTML =
          `<strong>✓ ไฟล์ PDF พร้อมส่ง · ${escapeHtml(pageInfo)} · ขนาด ${escapeHtml(sizeStr)}</strong><br>` +
          `กดปุ่ม <strong>Export "${escapeHtml(targetName)}"</strong> เพื่อรับไฟล์ที่ตั้งชื่อถูกต้องครบถ้วน แล้วลากวางในหน้าต่าง RAMED E-learning ได้ทันที`;
      }
    } catch (_) {
      resBox.hidden = false;
      resBox.className = "pdf-check-result is-error";
      resBox.textContent = "ไม่สามารถอ่านไฟล์ที่เลือกได้ กรุณาลองเลือกไฟล์ .pdf อีกครั้ง";
    }
  }

  function openManualChapter(chapterId) {
    state.manualChapterId = chapterId || "ALL";
    if ($("manualSearchInput")) $("manualSearchInput").value = "";
    switchTab("manual");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function computeDeadlineCountdownBadge(dueISO, isSubmitted) {
    if (isSubmitted) {
      return { text: "✓ บันทึกว่าส่งเรียบร้อยแล้ว", cls: "badge cat-HS" };
    }
    const now = Date.now();
    const due = new Date(dueISO).getTime();
    if (!Number.isFinite(due)) return { text: "กำหนดส่งตามตาราง", cls: "badge" };
    const diffMs = due - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) {
      return { text: "ปิดรับตามกำหนดเวลาแล้ว", cls: "badge" };
    }
    if (diffDays <= 3) {
      return { text: `ด่วน · เหลืออีก ${Math.max(0, diffDays)} วัน`, cls: "badge cat-EXAM" };
    }
    return { text: `กำหนดส่งในอีก ${diffDays} วัน`, cls: "badge cat-SG" };
  }

  function renderDeliverablesCards() {
    const grid = $("deliverablesCardsGrid");
    if (!grid) return;
    grid.replaceChildren();

    COURSE_DELIVERABLES.forEach((d) => {
      const isDone = Boolean(state.submittedMap[d.id]);
      const card = make("article", null, `deliverable-card${isDone ? " is-submitted" : ""}`);

      const head = make("div", null, "deliverable-head");
      const badges = make("div", null, "session-badges");
      badges.append(
        make("span", d.code, `badge ${d.backendType === "ramed" ? "cat-EXAM" : "cat-SG"}`),
        make("span", d.scopeBadge, "badge")
      );
      const cd = computeDeadlineCountdownBadge(d.dueISO, isDone);
      head.append(badges, make("span", cd.text, cd.cls));
      card.appendChild(head);

      card.appendChild(make("h4", d.title, "deliverable-title"));
      card.appendChild(make("p", `กำหนดส่ง: ${d.dueTH}`, "deliverable-due"));
      card.appendChild(make("p", d.prereq, "deliverable-meta"));

      const actions = make("div", null, "header-actions");
      const backendLink = make("a", d.backendLabel, "btn sm primary");
      backendLink.href = d.backendType === "ramed" ? getActiveRamedTargetUrl() : GOOGLE_FORM_URL;
      backendLink.target = "_blank";
      backendLink.rel = "noopener";
      actions.appendChild(backendLink);

      if (d.srnRound) {
        const prepBtn = make("button", `ตั้งชื่อ & ตรวจไฟล์ ${d.code}`, "btn sm teal");
        prepBtn.type = "button";
        prepBtn.addEventListener("click", () => {
          if ($("srnRoundSelect")) {
            $("srnRoundSelect").value = d.srnRound;
            updateSrnFilename();
          }
          const box = $("srnGeneratorBox");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        actions.appendChild(prepBtn);
      }

      const rubricBtn = make("button", d.manualBtnLabel, "btn sm");
      rubricBtn.type = "button";
      rubricBtn.addEventListener("click", () => openManualChapter(d.manualChapterId));
      actions.appendChild(rubricBtn);

      const matchedSession = (SCHED.sessions || []).find((s) => s.id === d.sessionId);
      if (matchedSession) {
        const icsBtn = make("button", "+ เตือนในปฏิทิน (.ics)", "btn sm");
        icsBtn.type = "button";
        icsBtn.addEventListener("click", () => downloadSingleSessionIcs(matchedSession));
        actions.appendChild(icsBtn);
      }
      card.appendChild(actions);

      const foot = make("div", null, "deliverable-foot");
      const checkLabel = make("label", null, "deliverable-check-label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isDone;
      cb.addEventListener("change", () => {
        if (cb.checked) state.submittedMap[d.id] = new Date().toISOString();
        else delete state.submittedMap[d.id];
        localStorage.setItem("racm303_submitted_map", JSON.stringify(state.submittedMap));
        renderDeliverablesCards();
      });
      checkLabel.append(
        cb,
        make("span", ROLE === "faculty" ? "ทำเครื่องหมายตรวจ/ติดตามงานชิ้นนี้แล้ว" : "ทำเครื่องหมายว่าส่งงานชิ้นนี้เรียบร้อยแล้ว")
      );

      const channelSpan = make(
        "span",
        d.backendType === "ramed" ? "ช่องทางส่ง: ห้องเรียนออนไลน์ RACM 303" : "ช่องทางส่ง: แบบฟอร์มส่งงานกลุ่มประจำวิชา"
      );
      channelSpan.style.fontSize = "12px";
      channelSpan.style.color = "var(--muted)";
      foot.append(checkLabel, channelSpan);
      card.appendChild(foot);

      grid.appendChild(card);
    });
  }

  function initSubmissionsControls() {
    const srnAreaSel = $("srnAreaSelect");
    if (srnAreaSel) {
      (SCHED.fieldworkSites || []).forEach((s) => {
        srnAreaSel.add(new Option(s.shortName, s.shortName));
      });
    }

    ["srnRoundSelect", "srnAreaSelect", "srnStudentId", "srnStudentName"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", updateSrnFilename);
      el.addEventListener("change", updateSrnFilename);
    });

    if ($("copySrnFilenameBtn")) {
      $("copySrnFilenameBtn").addEventListener("click", () => {
        const text = updateSrnFilename();
        copyTextWithFeedback(text, $("copySrnFilenameBtn"), "คัดลอกชื่อไฟล์แล้ว ✓");
      });
    }

    if ($("copyAndLaunchRamedBtn")) {
      $("copyAndLaunchRamedBtn").addEventListener("click", () => {
        const text = updateSrnFilename();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
        window.open(getActiveRamedTargetUrl(), "_blank", "noopener");
      });
    }

    if ($("openRamedPopupWorkspaceBtn")) {
      $("openRamedPopupWorkspaceBtn").addEventListener("click", () => {
        window.open(
          getActiveRamedTargetUrl(),
          "ramedBackendWindow",
          "width=1120,height=840,menubar=no,toolbar=yes,location=yes,status=yes,resizable=yes,scrollbars=yes,noopener"
        );
      });
    }

    if ($("saveRamedCustomUrlBtn")) {
      $("saveRamedCustomUrlBtn").addEventListener("click", () => {
        const raw = (($("ramedCustomCourseUrlInput") && $("ramedCustomCourseUrlInput").value) || "").trim();
        const fb = $("ramedPinFeedback");
        if (!isValidRamedUrl(raw)) {
          if (fb) {
            fb.style.color = "var(--crimson)";
            fb.textContent = "กรุณาวางลิงก์ที่ขึ้นต้นด้วย https://elearning.ra.mahidol.ac.th/ramed/ เท่านั้น";
          }
          return;
        }
        state.pinnedRamedUrl = raw;
        localStorage.setItem("racm303_moodle_course_url", raw);
        if (fb) fb.style.color = "var(--teal-deep)";
        syncPinnedRamedCourseUI();
        renderDeliverablesCards();
      });
    }

    if ($("clearRamedCustomUrlBtn")) {
      $("clearRamedCustomUrlBtn").addEventListener("click", () => {
        state.pinnedRamedUrl = "";
        localStorage.removeItem("racm303_moodle_course_url");
        if ($("ramedCustomCourseUrlInput")) $("ramedCustomCourseUrlInput").value = "";
        if ($("ramedPinFeedback")) $("ramedPinFeedback").textContent = "กลับไปใช้หน้าหลักห้องวิชา 3/2569 RACM 303 (course/view.php?id=398) แล้ว";
        syncPinnedRamedCourseUI();
        renderDeliverablesCards();
      });
    }

    const pickPdfBtn = $("pickSrnPdfBtn");
    const pdfInput = $("srnPdfFileInput");
    const dropzone = $("srnPdfDropzone");
    const dlRenamedBtn = $("downloadRenamedPdfBtn");

    if (pickPdfBtn && pdfInput) {
      pickPdfBtn.addEventListener("click", () => pdfInput.click());
      pdfInput.addEventListener("change", () => {
        if (pdfInput.files && pdfInput.files[0]) {
          inspectSrnPdfFile(pdfInput.files[0]);
        }
      });
    }

    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("is-dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          inspectSrnPdfFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (dlRenamedBtn) {
      dlRenamedBtn.addEventListener("click", () => {
        if (!state.inspectedPdfBytes) return;
        const targetName = updateSrnFilename();
        triggerBlobDownload(state.inspectedPdfBytes, "application/pdf", targetName);
      });
    }

    window.addEventListener("beforeprint", () => {
      if (state.activeTab === "discussion" || state.activeTab === "fieldwork") {
        fitPrintRoster(state.activeTab);
      }
    });
    window.addEventListener("afterprint", () => {
      document.querySelectorAll(".student-card h3, .student-card p").forEach((el) => el.style.removeProperty("font-size"));
    });

    syncPinnedRamedCourseUI();
    ensureRamedPerUserIdentityUI();
    syncRamedPerUserIdentityUI();
    updateSrnFilename();
  }

  /* ---------- Per-User RAMED Course 398 Login & Role Separation (รหัสใคร รหัสมัน) ---------- */
  function buildRamedPerUserLoginUrl(uid) {
    const clean = String(uid || "").trim();
    if (!clean) return RAMED_LOGIN_URL;
    return `${RAMED_LOGIN_URL}?username=${encodeURIComponent(clean)}`;
  }

  function exportMoodleEnrolmentCsv() {
    const header = ["username", "firstname", "lastname", "idnumber", "course1", "role1", "group1", "group2"].join(",");
    const rows = [header];
    ROSTER.students.forEach((s) => {
      const rawParts = String(s.name || s.fullName || "").trim().split(/\s+/);
      const fname = rawParts[0] || s.fullName;
      const lname = rawParts.slice(1).join(" ") || "-";
      rows.push(
        [
          csvCell(s.id),
          csvCell(fname),
          csvCell(lname),
          csvCell(s.id),
          csvCell("RACM303"),
          csvCell("student"),
          csvCell(`Discussion_${s.disc}`),
          csvCell(`Fieldwork_${s.area}`)
        ].join(",")
      );
    });
    triggerBlobDownload(
      "\uFEFF" + rows.join("\r\n") + "\r\n",
      "text/csv;charset=utf-8",
      "RACM303_2569_Moodle_Course398_Students_169.csv"
    );
  }

  function ensureRamedPerUserIdentityUI() {
    const bridge = $("ramedBackendBridge");
    if (!bridge || $("ramedPerUserBar")) return;

    const bar = make("div", null, "ramed-per-user-bar");
    bar.id = "ramedPerUserBar";

    if (ROLE === "student") {
      bar.innerHTML = `
        <div class="rpu-top">
          <div class="rpu-input-col">
            <label for="ramedMyLoginIdInput">🔑 เข้าห้องเรียนออนไลน์ด้วยรหัสนักศึกษาของฉัน (รหัสใคร รหัสมัน):</label>
            <div class="rpu-input-row">
              <input id="ramedMyLoginIdInput" list="studentLookupList" type="search" placeholder="พิมพ์รหัสนักศึกษา 7 หลักของตัวเอง (เช่น 6702006)…">
              <a class="btn primary sm" id="ramedLaunchWithMyIdBtn" href="${escapeHtml(RAMED_LOGIN_URL)}" target="_blank" rel="noopener">ล็อกอินด้วยรหัสของฉัน ↗</a>
              <a class="btn sm" id="ramedSwitchAccountBtn" href="https://elearning.ra.mahidol.ac.th/ramed/login/logout.php" target="_blank" rel="noopener" title="กดเพื่อออกจากบัญชีเดิมหากเครื่องนี้ค้างรหัสอาจารย์หรือเพื่อนคนอื่นอยู่">🔄 สลับบัญชีผู้ใช้งาน</a>
            </div>
          </div>
          <div class="rpu-status-box" id="ramedMyIdentityStatus">ยังไม่ได้ระบุรหัสนักศึกษา · พิมพ์รหัส 7 หลักเพื่อให้ปุ่มเข้าห้องเรียนและชื่อไฟล์ SRN ผูกเป็นรหัสของคุณเอง</div>
        </div>
      `;
    } else {
      bar.innerHTML = `
        <div class="rpu-top">
          <div class="rpu-input-col">
            <label for="ramedMyLoginIdInput">🔑 เข้าจัดการห้องวิชาตามรหัสอาจารย์/บุคลากรแต่ละท่าน (รหัสใคร รหัสมัน — ไม่ผูกติดรหัสเดียว):</label>
            <div class="rpu-input-row">
              <input id="ramedMyLoginIdInput" type="search" placeholder="กรอกรหัสบุคลากร 6 หลัก / C-life ของอาจารย์แต่ละท่าน (เช่น 02xxxx)…">
              <select id="ramedTeacherPairSelect" class="rpu-teacher-select" aria-label="เลือกชื่ออาจารย์คู่กับรหัสบุคลากร">
                <option value="">— ผูกชื่ออาจารย์ผู้สอน —</option>
              </select>
              <a class="btn primary sm" id="ramedLaunchWithMyIdBtn" href="${escapeHtml(RAMED_LOGIN_URL)}" target="_blank" rel="noopener">ล็อกอินด้วยรหัสอาจารย์ ↗</a>
              <a class="btn sm" id="ramedSwitchAccountBtn" href="https://elearning.ra.mahidol.ac.th/ramed/login/logout.php" target="_blank" rel="noopener" title="ออกจากรหัสเดิมที่ค้างในเบราว์เซอร์ เพื่อล็อกอินด้วยรหัสของอาจารย์ท่านอื่น">🔄 สลับบัญชีในระบบ</a>
            </div>
          </div>
          <div class="rpu-status-box" id="ramedMyIdentityStatus">กรอกรหัสบุคลากร 6 หลัก / C-life ของท่านเองเพื่อเข้าโหมดอาจารย์ตามสิทธิ์จริงรายบุคคล</div>
        </div>
        <div class="rpu-faculty-checklist">
          <div>
            <strong>⚙ สำหรับผู้ประสานงานรายวิชา (เปิดสิทธิ์ให้ครบทุกรหัส &amp; เปิดหัวข้อเรียนที่ซ่อนอยู่):</strong>
            <span>1) เพิ่มรหัสอาจารย์ร่วมสอนเป็น <em>Teacher</em> และนำเข้ารหัสนักศึกษาทั้ง 169 คนเป็น <em>Student</em> ที่เมนู <a href="https://elearning.ra.mahidol.ac.th/ramed/user/index.php?id=398" target="_blank" rel="noopener">จัดการรายชื่อผู้เรียน ↗</a> · 2) หัวข้อที่ขึ้นป้าย <code>Hidden from students</code> ให้เปิดสวิตช์ <strong>Edit mode</strong> มุมขวาบนของหน้าวิชา แล้วกด <code>⋯ → Show topic</code> เมื่อพร้อมเปิดให้นักศึกษาเห็น</span>
          </div>
          <div class="header-actions">
            <button type="button" class="btn sm teal" id="exportMoodle169CsvBtn">⬇ CSV นักศึกษา 169 รหัส (นำเข้าระบบ)</button>
            <a class="btn sm" href="https://elearning.ra.mahidol.ac.th/ramed/course/switchrole.php?id=398&amp;switchrole=5" target="_blank" rel="noopener">👁 ทดสอบมุมมองนักศึกษา ↗</a>
          </div>
        </div>
      `;
    }

    const topHead = bridge.querySelector(".elearning-bridge-top");
    if (topHead && topHead.nextSibling) {
      bridge.insertBefore(bar, topHead.nextSibling);
    } else {
      bridge.prepend(bar);
    }

    const uidInp = $("ramedMyLoginIdInput");
    const tPairSel = $("ramedTeacherPairSelect");
    if (tPairSel) {
      getAllCourseTeachers().forEach((t) => tPairSel.add(new Option(t.label, t.key)));
      tPairSel.addEventListener("change", () => {
        selectActiveTeacher(tPairSel.value, true);
        syncRamedPerUserIdentityUI();
      });
    }

    if (uidInp) {
      const handleUidChange = () => {
        const raw = uidInp.value.trim();
        const m7 = raw.match(/^(\d{7})\b/);
        if (m7) {
          const stu = ROSTER.students.find((s) => s.id === m7[1]);
          if (stu) {
            state.calScope = "student";
            applyMyStudent(stu, true);
            return;
          }
        }
        const byQuery = ROLE === "student" ? findStudentByQuery(raw) : null;
        if (byQuery) {
          state.calScope = "student";
          applyMyStudent(byQuery, true);
          return;
        }
        const cleanUid = raw.split(/\s+/)[0] || "";
        state.ramedLoginId = cleanUid;
        if (cleanUid) localStorage.setItem("racm303_login_uid", cleanUid);
        else localStorage.removeItem("racm303_login_uid");
        syncRamedPerUserIdentityUI();
      };
      uidInp.addEventListener("input", handleUidChange);
      uidInp.addEventListener("change", handleUidChange);
    }

    const launchBtn = $("ramedLaunchWithMyIdBtn");
    if (launchBtn) {
      launchBtn.addEventListener("click", () => {
        const activeId = (state.myStudent && state.myStudent.id) || state.ramedLoginId || "";
        if (activeId && navigator.clipboard) {
          navigator.clipboard.writeText(activeId).catch(() => {});
        }
      });
    }

    if ($("exportMoodle169CsvBtn")) {
      $("exportMoodle169CsvBtn").addEventListener("click", exportMoodleEnrolmentCsv);
    }
  }

  function syncRamedPerUserIdentityUI() {
    ensureRamedPerUserIdentityUI();
    const uidInp = $("ramedMyLoginIdInput");
    const statusBox = $("ramedMyIdentityStatus");
    const launchBtn = $("ramedLaunchWithMyIdBtn");
    const primaryCourseBtn = $("openRamedLoginPrimaryBtn");
    const topNavRamedLink = $(ROLE === "faculty" ? "facRamedTopLink" : "studentElearningLink");
    const loginCardLink = $("ramedLinkLogin");
    const tPairSel = $("ramedTeacherPairSelect");

    if (tPairSel && tPairSel.value !== (state.myTeacherKey || "")) {
      tPairSel.value = state.myTeacherKey || "";
    }

    const activeStudent = state.myStudent;
    const rawUid = activeStudent ? activeStudent.id : (state.ramedLoginId || "");

    if (uidInp && document.activeElement !== uidInp) {
      const disp = activeStudent && ROLE === "student" ? `${activeStudent.id} — ${activeStudent.fullName}` : rawUid;
      if (uidInp.value !== disp) uidInp.value = disp;
    }

    const loginUrl = buildRamedPerUserLoginUrl(rawUid);
    if (launchBtn) {
      launchBtn.href = loginUrl;
      launchBtn.textContent = rawUid
        ? `🔑 ล็อกอินรหัส ${rawUid} ↗`
        : "🔑 ล็อกอินด้วยรหัสตัวเอง ↗";
    }
    if (loginCardLink) {
      loginCardLink.href = loginUrl;
    }

    if (ROLE === "student") {
      if (activeStudent) {
        if (statusBox) {
          statusBox.innerHTML =
            `<strong>✓ กำลังเข้าใช้งานฝั่งนักศึกษา รหัส <code>${escapeHtml(activeStudent.id)}</code> (${escapeHtml(activeStudent.fullName)})</strong> · ` +
            `กลุ่มพื้นที่ ${escapeHtml(activeStudent.area)} · Discussion ${activeStudent.disc} — กดปุ่มล็อกอินเพื่อส่งงาน SRN และดูคะแนนเฉพาะรหัสของคุณ`;
        }
        if (primaryCourseBtn) primaryCourseBtn.textContent = `เข้าห้องเรียน RACM 303 (รหัส ${activeStudent.id}) ↗`;
        if (topNavRamedLink) topNavRamedLink.textContent = `ห้องเรียน E-learning (${activeStudent.id}) ↗`;
      } else {
        if (statusBox) {
          statusBox.textContent =
            "ยังไม่ได้ระบุรหัสนักศึกษา · พิมพ์รหัส 7 หลักของตัวเองด้านซ้าย เพื่อเข้าห้องเรียนแบบรหัสใครรหัสมัน (ไม่ปะปนกับบัญชีผู้อื่น)";
        }
        if (primaryCourseBtn) primaryCourseBtn.textContent = "เข้าห้องเรียน RACM 303 ↗";
        if (topNavRamedLink) topNavRamedLink.textContent = "ห้องเรียน E-learning ↗";
      }
    } else {
      const tObj = getAllCourseTeachers().find((t) => t.key === state.myTeacherKey);
      const tShort = tObj ? tObj.label.replace(/\s*\([^)]*\)/g, "") : "";
      if (rawUid || tShort) {
        const whoParts = [rawUid ? `รหัส <code>${escapeHtml(rawUid)}</code>` : "", tShort ? escapeHtml(tShort) : ""].filter(Boolean).join(" · ");
        if (statusBox) {
          statusBox.innerHTML = `<strong>✓ กำลังเข้าใช้งานฝั่งอาจารย์/บุคลากร (${whoParts})</strong> — ลิงก์ Login ตั้งค่ารหัสของท่านไว้พร้อมเข้าจัดการห้องเรียนรายบุคคล`;
        }
        if (primaryCourseBtn) {
          primaryCourseBtn.textContent = `เข้าจัดการห้องเรียน (${rawUid || state.myTeacherKey}) ↗`;
        }
        if (topNavRamedLink) {
          topNavRamedLink.textContent = `ห้องเรียน E-learning (${rawUid || state.myTeacherKey}) ↗`;
        }
      } else {
        if (statusBox) {
          statusBox.textContent =
            "กรอกรหัสบุคลากร 6 หลัก / C-life ของอาจารย์แต่ละท่าน (ไม่ใช่รหัสใดรหัสหนึ่งตายตัว) เพื่อเข้าจัดการห้องวิชาตามสิทธิ์ของท่านเอง";
        }
        if (primaryCourseBtn) primaryCourseBtn.textContent = "เข้าจัดการห้องวิชา RACM 303 ↗";
        if (topNavRamedLink) topNavRamedLink.textContent = "ห้องเรียน E-learning ↗";
      }
    }
  }

  function renderSubmissionsView() {
    syncPinnedRamedCourseUI();
    syncRamedPerUserIdentityUI();
    updateSrnFilename();
    renderDeliverablesCards();
    checkRamedBackendReachability();
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

  /* ---------- Keynote-Style Slide Sorter, Slide Deck & Zoom In/Out Engine ---------- */
  const lbState = {
    gallery: [],
    index: 0,
    zoom: 100,
    panX: 0,
    panY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    wired: false
  };

  let activeDeckKeyHandler = null;

  function applyLightboxTransform() {
    const img = $("lightboxImg");
    if (!img) return;
    const scale = lbState.zoom / 100;
    img.style.transform = `translate(${lbState.panX}px, ${lbState.panY}px) scale(${scale})`;
    img.style.cursor = lbState.zoom > 100 ? (lbState.dragging ? "grabbing" : "grab") : "zoom-in";
    const pctBtn = $("lbZoomResetBtn");
    if (pctBtn) pctBtn.textContent = `${lbState.zoom}%`;
    const slider = $("lbZoomRange");
    if (slider) slider.value = String(lbState.zoom);
  }

  function setLightboxZoom(nextPct) {
    const clamped = Math.min(350, Math.max(50, Math.round(nextPct / 25) * 25));
    lbState.zoom = clamped;
    if (clamped <= 100) {
      lbState.panX = 0;
      lbState.panY = 0;
    }
    applyLightboxTransform();
  }

  function showLightboxAt(idx) {
    if (!lbState.gallery.length) return;
    const n = lbState.gallery.length;
    lbState.index = ((idx % n) + n) % n;
    const item = lbState.gallery[lbState.index];
    const img = $("lightboxImg");
    const cap = $("lightboxCaption");
    if (img) img.src = item.src;
    if (cap) cap.textContent = item.caption || "";
    lbState.zoom = 100;
    lbState.panX = 0;
    lbState.panY = 0;
    applyLightboxTransform();

    const counter = $("lbGalleryCounter");
    const prevBtn = $("lbPrevImgBtn");
    const nextBtn = $("lbNextImgBtn");
    const hasMulti = n > 1;
    if (counter) {
      counter.hidden = !hasMulti;
      counter.textContent = `ภาพ ${lbState.index + 1} / ${n}`;
    }
    if (prevBtn) prevBtn.hidden = !hasMulti;
    if (nextBtn) nextBtn.hidden = !hasMulti;
  }

  function ensureLightboxControls() {
    const lb = $("imageLightbox");
    if (!lb || lbState.wired) return;
    lbState.wired = true;

    const inner = lb.querySelector(".lightbox-inner");
    const img = $("lightboxImg");
    if (!inner || !img) return;

    let stage = inner.querySelector(".lightbox-stage");
    if (!stage) {
      stage = make("div", null, "lightbox-stage");
      img.replaceWith(stage);
      stage.appendChild(img);
    }

    const hud = make("div", null, "lightbox-hud");
    hud.innerHTML = `
      <div class="lb-nav-group">
        <button type="button" class="btn sm" id="lbPrevImgBtn" title="ภาพก่อนหน้า (←)">‹ ภาพก่อนหน้า</button>
        <span class="lb-counter-pill" id="lbGalleryCounter">ภาพ 1 / 1</span>
        <button type="button" class="btn sm" id="lbNextImgBtn" title="ภาพถัดไป (→)">ภาพถัดไป ›</button>
      </div>
      <div class="lb-zoom-group" role="group" aria-label="ซูมย่อ-ขยายภาพอินโฟกราฟิก">
        <button type="button" class="btn sm" id="lbZoomOutBtn" title="ซูมออก (−)">−</button>
        <input type="range" id="lbZoomRange" min="50" max="350" step="25" value="100" aria-label="แถบซูมภาพ">
        <button type="button" class="btn sm" id="lbZoomInBtn" title="ซูมเข้า (+)">+</button>
        <button type="button" class="btn sm" id="lbZoomResetBtn" title="คลิกเพื่อรีเซ็ตขนาด 100%">100%</button>
      </div>
    `;
    inner.insertBefore(hud, stage);

    $("lbPrevImgBtn")?.addEventListener("click", () => showLightboxAt(lbState.index - 1));
    $("lbNextImgBtn")?.addEventListener("click", () => showLightboxAt(lbState.index + 1));
    $("lbZoomOutBtn")?.addEventListener("click", () => setLightboxZoom(lbState.zoom - 25));
    $("lbZoomInBtn")?.addEventListener("click", () => setLightboxZoom(lbState.zoom + 25));
    $("lbZoomResetBtn")?.addEventListener("click", () => setLightboxZoom(100));
    $("lbZoomRange")?.addEventListener("input", (e) => setLightboxZoom(Number(e.target.value)));

    img.addEventListener("click", (e) => {
      e.stopPropagation();
      if (lbState.zoom === 100) setLightboxZoom(175);
      else if (lbState.zoom >= 175 && !lbState.dragging) setLightboxZoom(100);
    });

    stage.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        setLightboxZoom(lbState.zoom + (e.deltaY < 0 ? 25 : -25));
      },
      { passive: false }
    );

    stage.addEventListener("pointerdown", (e) => {
      if (lbState.zoom <= 100) return;
      lbState.dragging = true;
      lbState.startX = e.clientX - lbState.panX;
      lbState.startY = e.clientY - lbState.panY;
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      }
      applyLightboxTransform();
    });

    stage.addEventListener("pointermove", (e) => {
      if (!lbState.dragging) return;
      lbState.panX = e.clientX - lbState.startX;
      lbState.panY = e.clientY - lbState.startY;
      applyLightboxTransform();
    });

    const stopDrag = () => {
      if (!lbState.dragging) return;
      lbState.dragging = false;
      applyLightboxTransform();
    };
    stage.addEventListener("pointerup", stopDrag);
    stage.addEventListener("pointercancel", stopDrag);

    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "ArrowLeft" && lbState.gallery.length > 1) {
        e.preventDefault();
        showLightboxAt(lbState.index - 1);
      } else if (e.key === "ArrowRight" && lbState.gallery.length > 1) {
        e.preventDefault();
        showLightboxAt(lbState.index + 1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setLightboxZoom(lbState.zoom + 25);
      } else if (e.key === "-") {
        e.preventDefault();
        setLightboxZoom(lbState.zoom - 25);
      } else if (e.key === "0") {
        e.preventDefault();
        setLightboxZoom(100);
      }
    });
  }

  function openLightbox(src, caption, gallery) {
    const lb = $("imageLightbox");
    if (!lb) return;
    ensureLightboxControls();
    if (Array.isArray(gallery) && gallery.length) {
      lbState.gallery = gallery;
      const foundIdx = gallery.findIndex((g) => g.src === src);
      showLightboxAt(foundIdx >= 0 ? foundIdx : 0);
    } else {
      lbState.gallery = [{ src, caption }];
      showLightboxAt(0);
    }
    lb.hidden = false;
  }

  function wireInteractiveProseChildren(rootEl, gallery, onAnchorJump) {
    if (!rootEl) return;
    rootEl.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (link._anchorWired) return;
      link._anchorWired = true;
      link.addEventListener("click", (ev) => {
        const rawHref = link.getAttribute("href") || "";
        if (rawHref.length <= 1) return;
        const targetId = decodeURIComponent(rawHref.slice(1));
        if (typeof onAnchorJump === "function" && onAnchorJump(targetId)) {
          ev.preventDefault();
        }
      });
    });

    rootEl.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.classList.add("zoomable-img");
      if (img._lbWired) return;
      img._lbWired = true;
      const fig = img.closest ? img.closest("figure") : null;
      const figCap = fig && fig.querySelector ? fig.querySelector("figcaption") : null;
      const capText = (figCap && figCap.textContent && figCap.textContent.trim()) || img.alt || "";
      img.addEventListener("click", () => openLightbox(img.src, capText, gallery));
    });

    const isIOSDevice =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
        (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1));

    rootEl.querySelectorAll(".macos-pdf-card").forEach((card) => {
      if (card._pdfWired) return;
      card._pdfWired = true;

      const localUrl = card.dataset.pdfLocal || "";
      const driveId = card.dataset.pdfDriveId || "";
      const toggleBtn = card.querySelector("[data-pdf-toggle]");
      const closeBtn = card.querySelector("[data-pdf-close]");
      const viewerShell = card.querySelector("[data-pdf-viewer]");
      const frameWrap = card.querySelector("[data-pdf-frame-wrap]");
      const modeBtns = [...card.querySelectorAll("[data-pdf-mode]")];
      let activeMode = isIOSDevice && driveId ? "drive" : "local";

      const syncPdfFrame = () => {
        modeBtns.forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.pdfMode === activeMode ? "true" : "false");
        });
        if (!frameWrap || !viewerShell || viewerShell.hidden) return;
        const src =
          activeMode === "drive" && driveId
            ? `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`
            : `${localUrl}#view=FitH`;
        let iframe = frameWrap.querySelector("iframe");
        if (!iframe) {
          iframe = document.createElement("iframe");
          iframe.className = "macos-pdf-iframe";
          iframe.title = "ระเบียบการฝึกปฏิบัติงานนอกสถานที่ พ.ศ. 2561 (PDF)";
          iframe.loading = "lazy";
          iframe.setAttribute("allow", "autoplay");
          frameWrap.replaceChildren(iframe);
        }
        if (iframe.getAttribute("src") !== src) {
          iframe.setAttribute("src", src);
        }
      };

      const setViewerOpen = (open) => {
        if (!viewerShell || !toggleBtn) return;
        viewerShell.hidden = !open;
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.textContent = open ? "ซ่อนหน้าต่างดู PDF" : "เปิดดู PDF (View PDF)";
        if (open) syncPdfFrame();
      };

      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          setViewerOpen(viewerShell ? viewerShell.hidden : false);
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", () => setViewerOpen(false));
      }
      modeBtns.forEach((b) => {
        b.addEventListener("click", () => {
          activeMode = b.dataset.pdfMode || "local";
          syncPdfFrame();
        });
      });
    });

    if (window.RACMInteractiveQA) {
      window.RACMInteractiveQA.enhanceContainer(rootEl);
    }
  }

  function extractSlidesFromProse(proseContainer) {
    const blocks = [];
    const topChildren = [...(proseContainer.children || [])];
    if (!topChildren.length) return [];

    topChildren.forEach((child) => {
      const tag = String(child.tagName || "").toUpperCase();
      if (tag === "HR") return;
      if (tag === "SECTION" && child.children && child.children.length) {
        const secId = child.id || "";
        [...child.children].forEach((sub) => {
          if (String(sub.tagName || "").toUpperCase() === "HR") return;
          blocks.push({ node: sub, sectionId: secId });
        });
      } else {
        blocks.push({ node: child, sectionId: "" });
      }
    });

    if (!blocks.length) return [];

    const h2Count = blocks.filter((b) => String(b.node.tagName || "").toUpperCase() === "H2").length;
    const splitOnH3 = h2Count <= 22;

    const rawChunks = [];
    let currentH2Title = "";
    let cur = null;

    blocks.forEach(({ node, sectionId }) => {
      const tag = String(node.tagName || "").toUpperCase();
      if (tag === "H1" || tag === "H2") {
        currentH2Title = (node.textContent || "").trim();
        cur = {
          eyebrow: "",
          title: currentH2Title,
          headingId: node.id || sectionId || "",
          allIds: new Set([node.id, sectionId].filter(Boolean)),
          onlyH2Heading: true,
          nodes: [node]
        };
        rawChunks.push(cur);
      } else if (tag === "H3" && splitOnH3) {
        const h3Title = (node.textContent || "").trim();
        if (cur && cur.onlyH2Heading && cur.nodes.length === 1) {
          cur.eyebrow = currentH2Title;
          cur.title = h3Title;
          if (node.id) {
            cur.headingId = node.id;
            cur.allIds.add(node.id);
          }
          cur.onlyH2Heading = false;
          cur.nodes.push(node);
        } else {
          cur = {
            eyebrow: currentH2Title,
            title: h3Title,
            headingId: node.id || sectionId || "",
            allIds: new Set([node.id, sectionId].filter(Boolean)),
            onlyH2Heading: false,
            nodes: [node]
          };
          rawChunks.push(cur);
        }
      } else {
        if (!cur) {
          cur = {
            eyebrow: "",
            title: "บทนำและภาพรวมเอกสาร",
            headingId: node.id || sectionId || "",
            allIds: new Set([node.id, sectionId].filter(Boolean)),
            onlyH2Heading: false,
            nodes: []
          };
          rawChunks.push(cur);
        }
        if (node.id) cur.allIds.add(node.id);
        if (sectionId) cur.allIds.add(sectionId);
        cur.onlyH2Heading = false;
        cur.nodes.push(node);
      }
    });

    return rawChunks.map((ch, idx) => {
      let imgSrc = "";
      let imgAlt = "";
      let imgCount = 0;
      let tableCount = 0;
      let tableHeaders = [];
      let hasPdf = false;
      let takeaway = "";

      ch.nodes.forEach((n) => {
        if (!n.querySelectorAll) return;
        n.querySelectorAll("h2, h3, [id]").forEach((idEl) => {
          if (idEl.id) ch.allIds.add(idEl.id);
        });
        const imgs = String(n.tagName || "").toUpperCase() === "IMG" ? [n] : [...n.querySelectorAll("img")];
        imgCount += imgs.length;
        if (!imgSrc && imgs[0]) {
          imgSrc = imgs[0].getAttribute("src") || imgs[0].src || "";
          imgAlt = imgs[0].getAttribute("alt") || imgs[0].alt || "";
        }
        const tbls = String(n.tagName || "").toUpperCase() === "TABLE" ? [n] : [...n.querySelectorAll("table")];
        tableCount += tbls.length;
        if (!tableHeaders.length && tbls[0]) {
          tableHeaders = [...tbls[0].querySelectorAll("th")]
            .slice(0, 4)
            .map((th) => (th.textContent || "").trim())
            .filter(Boolean);
        }
        if (
          (n.classList && n.classList.contains("macos-pdf-card")) ||
          (n.querySelector && n.querySelector(".macos-pdf-card"))
        ) {
          hasPdf = true;
        }
        if (!takeaway) {
          const tag = String(n.tagName || "").toUpperCase();
          if (tag === "P" || tag === "BLOCKQUOTE" || tag === "UL" || tag === "OL") {
            const strong = n.querySelector ? n.querySelector("strong") : null;
            const rawTxt = ((strong && strong.textContent.length > 24 ? strong.textContent : n.textContent) || "")
              .replace(/\s+/g, " ")
              .trim();
            if (rawTxt.length > 14) {
              takeaway = rawTxt.length > 165 ? `${rawTxt.slice(0, 165)}…` : rawTxt;
            }
          }
        }
      });

      const html = ch.nodes.map((n) => n.outerHTML || "").join("\n");
      return {
        index: idx,
        numLabel: String(idx + 1).padStart(2, "0"),
        eyebrow: ch.eyebrow,
        title: ch.title || `ส่วนที่ ${idx + 1}`,
        headingId: ch.headingId,
        allIds: ch.allIds,
        html,
        imgSrc,
        imgAlt,
        imgCount,
        tableCount,
        tableHeaders,
        hasPdf,
        takeaway
      };
    });
  }

  function attachProseEnhancements(proseContainer, tocContainer) {
    if (!proseContainer) return;

    const headings = [...proseContainer.querySelectorAll("h2, h3")];
    headings.forEach((h, idx) => {
      if (!h.id) h.id = `sec-h-${idx}`;
    });

    // Build gallery list of all figures in this document for Lightbox Prev/Next
    const docGallery = [...proseContainer.querySelectorAll("img")].map((img) => {
      const fig = img.closest ? img.closest("figure") : null;
      const figCap = fig && fig.querySelector ? fig.querySelector("figcaption") : null;
      return {
        src: img.src || img.getAttribute("src") || "",
        caption: (figCap && figCap.textContent && figCap.textContent.trim()) || img.alt || ""
      };
    });

    const flashTargetEl = (el) => {
      if (!el || !el.classList) return;
      el.classList.remove("anchor-flash");
      void el.offsetWidth;
      el.classList.add("anchor-flash");
    };

    // Controller hook for TOC & internal section links across Scroll, Slide Deck, and Slide Sorter
    let jumpToIdHandler = (targetId) => {
      if (!targetId) return false;
      const escId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(targetId) : targetId;
      const targetEl = proseContainer.querySelector(`#${escId}`) || document.getElementById(targetId);
      if (!targetEl) return false;
      const parentDetails = targetEl.closest ? targetEl.closest("details") : null;
      if (parentDetails && !parentDetails.open) parentDetails.open = true;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      flashTargetEl(targetEl);
      return true;
    };

    wireInteractiveProseChildren(proseContainer, docGallery, (id) => jumpToIdHandler(id));

    const paper = proseContainer.parentElement;
    const toolbar = paper && paper.querySelector ? paper.querySelector(".reader-toolbar") : null;
    const slides = paper && paper.classList && paper.classList.contains("reader-paper")
      ? extractSlidesFromProse(proseContainer)
      : [];

    let jumpToHeadingHandler = (h) => {
      if (h && h.id) jumpToIdHandler(h.id);
      else if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (tocContainer) {
      tocContainer.replaceChildren();
      headings.forEach((h) => {
        const li = document.createElement("li");
        const a = make("a", h.textContent.trim(), `toc-link${h.tagName === "H3" ? " toc-sub" : ""}`);
        a.href = `#${h.id}`;
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          jumpToHeadingHandler(h);
        });
        li.appendChild(a);
        tocContainer.appendChild(li);
      });
    }

    if (!paper || !toolbar || !slides.length) return;

    // Ensure sibling Slide Sorter & Slide Deck stage containers exist inside .reader-paper
    let sorterStage = paper.querySelector(".reader-sorter-stage");
    if (!sorterStage) {
      sorterStage = make("div", null, "reader-sorter-stage");
      sorterStage.hidden = true;
      paper.appendChild(sorterStage);
    }
    let deckStage = paper.querySelector(".reader-deck-stage");
    if (!deckStage) {
      deckStage = make("div", null, "reader-deck-stage");
      deckStage.hidden = true;
      paper.appendChild(deckStage);
    }

    // Ensure toolbar has Segmented View Switcher + Slide Sorter / Canvas Zoom Bar
    let navSuite = toolbar.querySelector(".reader-nav-zoom-suite");
    if (!navSuite) {
      navSuite = make("div", null, "reader-nav-zoom-suite");
      navSuite.innerHTML = `
        <div class="cal-segmented reader-mode-seg" role="group" aria-label="มุมมองการอ่านและเลื่อนสไลด์">
          <button type="button" class="cal-seg-btn" data-rmode="scroll" aria-pressed="true" title="เลื่อนอ่านต่อเนื่องขึ้น-ลง">☰ เลื่อนอ่าน</button>
          <button type="button" class="cal-seg-btn" data-rmode="deck" aria-pressed="false" title="เลื่อนดูทีละสไลด์ซ้าย-ขวา (ปุ่มลูกศร ← / → หรือปัดนิ้ว)">▣ ทีละสไลด์</button>
          <button type="button" class="cal-seg-btn" data-rmode="sorter" aria-pressed="false" title="มุมมองตารางรวมทุกสไลด์พร้อมย่อ-ขยาย (Slide Sorter)">⊞ Slide Sorter</button>
        </div>
        <div class="reader-zoom-cluster" role="group" aria-label="ซูมย่อ-ขยายหน้ากระดาษและ Slide Sorter">
          <button type="button" class="reader-zoom-btn" data-rzoom-step="-1" title="ซูมออก (Zoom Out)">−</button>
          <input type="range" class="reader-zoom-slider" min="50" max="160" step="10" value="100" aria-label="ปรับระดับซูมย่อ-ขยาย">
          <button type="button" class="reader-zoom-btn" data-rzoom-step="1" title="ซูมเข้า (Zoom In)">+</button>
          <button type="button" class="reader-zoom-pct" data-rzoom-reset title="คลิกเพื่อรีเซ็ตระดับซูม 100%">100%</button>
        </div>
      `;
      const fontCtrl = toolbar.querySelector(".font-Controls");
      if (fontCtrl) toolbar.insertBefore(navSuite, fontCtrl);
      else toolbar.appendChild(navSuite);
    }

    let activeSlideIdx = 0;
    let sorterFilter = "all"; // all | img | table

    const modeBtns = [...navSuite.querySelectorAll("[data-rmode]")];
    const zoomSlider = navSuite.querySelector(".reader-zoom-slider");
    const zoomPctBtn = navSuite.querySelector("[data-rzoom-reset]");

    const getActiveZoom = () => (state.readerViewMode === "sorter" ? state.sorterZoomPct : state.canvasZoomPct);

    const applyZoomStyles = () => {
      const mode = state.readerViewMode;
      const pct = getActiveZoom();
      if (zoomSlider) {
        zoomSlider.min = mode === "sorter" ? "50" : "70";
        zoomSlider.max = mode === "sorter" ? "160" : "150";
        zoomSlider.value = String(pct);
      }
      if (zoomPctBtn) zoomPctBtn.textContent = `${pct}%`;

      if (mode === "sorter") {
        proseContainer.style.zoom = "";
        // Map 50%..160% -> 155px..495px column min-width (5-6 cols zoomed out -> 1-2 large cards zoomed in)
        const colPx = Math.round(155 + ((pct - 50) / 110) * 340);
        const fontScale = (0.80 + ((pct - 50) / 110) * 0.34).toFixed(3);
        sorterStage.style.setProperty("--sorter-col-min", `${colPx}px`);
        sorterStage.style.setProperty("--sorter-scale", fontScale);
        const colHint = sorterStage.querySelector("[data-sorter-zoom-hint]");
        if (colHint) {
          const densityLabel =
            pct <= 65 ? "ภาพรวมมุมสูง (5–6 คอลัมน์)" :
            pct <= 85 ? "ย่อกะทัดรัด (4 คอลัมน์)" :
            pct <= 115 ? "มาตรฐาน (3 คอลัมน์)" :
            pct <= 135 ? "การ์ดใหญ่ (2 คอลัมน์)" : "ขยายเต็มการ์ด (1–2 คอลัมน์)";
          colHint.textContent = `ระดับซูม ${pct}% · ${densityLabel}`;
        }
      } else if (mode === "deck") {
        proseContainer.style.zoom = "";
        const deckCanvas = deckStage.querySelector(".deck-slide-canvas");
        if (deckCanvas) deckCanvas.style.zoom = pct === 100 ? "" : String(pct / 100);
      } else {
        proseContainer.style.zoom = pct === 100 ? "" : String(pct / 100);
      }
    };

    const setZoomValue = (nextVal) => {
      if (state.readerViewMode === "sorter") {
        const clamped = Math.min(160, Math.max(50, Math.round(nextVal / 10) * 10));
        state.sorterZoomPct = clamped;
        localStorage.setItem("racm303_sorter_zoom", String(clamped));
      } else {
        const clamped = Math.min(150, Math.max(70, Math.round(nextVal / 10) * 10));
        state.canvasZoomPct = clamped;
        localStorage.setItem("racm303_canvas_zoom", String(clamped));
      }
      applyZoomStyles();
    };

    const renderSorterStage = () => {
      sorterStage.replaceChildren();

      const imgSlidesCount = slides.filter((s) => s.imgCount > 0).length;
      const tblSlidesCount = slides.filter((s) => s.tableCount > 0).length;

      const headBar = make("div", null, "sorter-head-bar");
      const filterRow = make("div", null, "sorter-filter-pills");

      const makeFilterPill = (key, label, count) => {
        const b = make("button", `${label} (${count})`, `sorter-filter-pill${sorterFilter === key ? " is-active" : ""}`);
        b.type = "button";
        b.addEventListener("click", () => {
          sorterFilter = key;
          renderSorterStage();
          applyZoomStyles();
        });
        return b;
      };

      filterRow.appendChild(makeFilterPill("all", "ทุกสไลด์", slides.length));
      if (imgSlidesCount > 0) filterRow.appendChild(makeFilterPill("img", "🖼 มีภาพอินโฟกราฟิก", imgSlidesCount));
      if (tblSlidesCount > 0) filterRow.appendChild(makeFilterPill("table", "📊 มีตารางสรุป", tblSlidesCount));

      const rightInfo = make("span", "", "sorter-zoom-hint");
      rightInfo.setAttribute("data-sorter-zoom-hint", "1");
      headBar.append(filterRow, rightInfo);
      sorterStage.appendChild(headBar);

      const visibleSlides = slides.filter((s) => {
        if (sorterFilter === "img") return s.imgCount > 0;
        if (sorterFilter === "table") return s.tableCount > 0;
        return true;
      });

      const grid = make("div", null, "sorter-cards-grid");
      visibleSlides.forEach((s) => {
        const card = make(
          "article",
          null,
          `sorter-slide-card${s.index === activeSlideIdx ? " is-current-slide" : ""}`
        );
        card.dataset.slideIdx = String(s.index);
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `เปิดสไลด์ที่ ${s.index + 1}: ${s.title}`);

        const topMeta = make("div", null, "sorter-card-top");
        const numPill = make("span", s.numLabel, "sorter-num-pill");
        const badgesWrap = make("div", null, "sorter-media-badges");
        if (s.imgCount > 0) badgesWrap.appendChild(make("span", `🖼 ${s.imgCount}`, "sorter-mini-badge is-img"));
        if (s.tableCount > 0) badgesWrap.appendChild(make("span", `📊 ${s.tableCount}`, "sorter-mini-badge is-tbl"));
        if (s.hasPdf) badgesWrap.appendChild(make("span", "PDF", "sorter-mini-badge is-pdf"));
        topMeta.append(numPill, badgesWrap);
        card.appendChild(topMeta);

        if (s.eyebrow && s.eyebrow !== s.title) {
          card.appendChild(make("div", s.eyebrow, "sorter-eyebrow"));
        }
        card.appendChild(make("h4", s.title, "sorter-card-title"));

        const bodyBox = make("div", null, "sorter-card-preview");
        if (s.imgSrc) {
          const thumbWrap = make("div", null, "sorter-thumb-wrap");
          const thumbImg = document.createElement("img");
          thumbImg.src = s.imgSrc;
          thumbImg.alt = s.imgAlt || s.title;
          thumbImg.loading = "lazy";
          const zoomImgBtn = make("button", "🔍 ขยายภาพ", "sorter-zoom-img-btn");
          zoomImgBtn.type = "button";
          zoomImgBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openLightbox(s.imgSrc, s.imgAlt || s.title, docGallery);
          });
          thumbWrap.append(thumbImg, zoomImgBtn);
          bodyBox.appendChild(thumbWrap);
          if (s.takeaway) {
            bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway compact"));
          }
        } else if (s.tableHeaders.length) {
          const tblStrip = make("div", null, "sorter-tbl-preview");
          s.tableHeaders.forEach((th) => tblStrip.appendChild(make("span", th, "sorter-th-chip")));
          bodyBox.appendChild(tblStrip);
          if (s.takeaway) bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway"));
        } else if (s.takeaway) {
          bodyBox.appendChild(make("p", s.takeaway, "sorter-takeaway"));
        }
        card.appendChild(bodyBox);

        const foot = make("div", null, "sorter-card-foot");
        const openDeckSpan = make("span", "▶ ซูมเข้าสไลด์นี้", "sorter-open-hint");
        const scrollJumpBtn = make("button", "¶ อ่านจุดนี้", "sorter-scroll-jump-btn");
        scrollJumpBtn.type = "button";
        scrollJumpBtn.title = "สลับไปโหมดเลื่อนอ่านต่อเนื่องตรงหัวข้อนี้";
        scrollJumpBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          activeSlideIdx = s.index;
          switchReaderMode("scroll");
          const targetEl = s.headingId ? document.getElementById(s.headingId) : null;
          if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        foot.append(openDeckSpan, scrollJumpBtn);
        card.appendChild(foot);

        const activateCard = () => {
          activeSlideIdx = s.index;
          switchReaderMode("deck");
          paper.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        card.addEventListener("click", activateCard);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            activateCard();
          }
        });

        grid.appendChild(card);
      });

      sorterStage.appendChild(grid);
    };

    const renderDeckSlide = (idx, direction = 0) => {
      if (!slides.length) return;
      activeSlideIdx = Math.min(slides.length - 1, Math.max(0, idx));
      const s = slides[activeSlideIdx];
      deckStage.replaceChildren();

      const buildDeckNavBar = (isBottom) => {
        const bar = make("div", null, `deck-nav-bar${isBottom ? " is-bottom" : ""}`);
        const prevBtn = make("button", "‹ สไลด์ก่อนหน้า", "btn sm");
        prevBtn.type = "button";
        prevBtn.disabled = activeSlideIdx === 0;
        prevBtn.addEventListener("click", () => {
          renderDeckSlide(activeSlideIdx - 1, -1);
          if (isBottom) deckStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        const jumpSel = document.createElement("select");
        jumpSel.className = "deck-slide-select";
        jumpSel.setAttribute("aria-label", "เลือกสไลด์ที่ต้องการเปิด");
        slides.forEach((sl) => {
          const mediaTag = sl.imgCount ? " 🖼" : sl.tableCount ? " 📊" : "";
          const opt = new Option(
            `สไลด์ ${sl.numLabel} / ${String(slides.length).padStart(2, "0")}${mediaTag} — ${sl.title.slice(0, 58)}`,
            String(sl.index)
          );
          if (sl.index === activeSlideIdx) opt.selected = true;
          jumpSel.add(opt);
        });
        jumpSel.addEventListener("change", () => {
          const next = Number(jumpSel.value);
          renderDeckSlide(next, next > activeSlideIdx ? 1 : -1);
        });

        const midGroup = make("div", null, "deck-mid-controls");
        const toSorterBtn = make("button", "⊞ ดูรวม Slide Sorter", "btn sm");
        toSorterBtn.type = "button";
        toSorterBtn.title = "ซูมออกเพื่อดูตารางรวมทุกสไลด์ (Slide Sorter)";
        toSorterBtn.addEventListener("click", () => {
          paper.classList.remove("is-deck-theater");
          switchReaderMode("sorter");
        });

        const isTheater = paper.classList.contains("is-deck-theater");
        const theaterBtn = make("button", isTheater ? "✕ ออกจากเต็มจอ" : "⛶ เต็มจอ", "btn sm");
        theaterBtn.type = "button";
        theaterBtn.addEventListener("click", () => {
          paper.classList.toggle("is-deck-theater");
          renderDeckSlide(activeSlideIdx, 0);
        });

        midGroup.append(jumpSel, toSorterBtn, theaterBtn);

        const nextBtn = make("button", "สไลด์ถัดไป ›", "btn sm primary");
        nextBtn.type = "button";
        nextBtn.disabled = activeSlideIdx === slides.length - 1;
        nextBtn.addEventListener("click", () => {
          renderDeckSlide(activeSlideIdx + 1, 1);
          if (isBottom) deckStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        bar.append(prevBtn, midGroup, nextBtn);
        return bar;
      };

      const progressTrack = make("div", null, "deck-progress-track");
      const progressFill = make("div", null, "deck-progress-fill");
      progressFill.style.width = `${((activeSlideIdx + 1) / slides.length) * 100}%`;
      progressTrack.appendChild(progressFill);

      const slideCard = make(
        "div",
        null,
        `deck-slide-card${direction > 0 ? " anim-next" : direction < 0 ? " anim-prev" : ""}`
      );
      if (s.eyebrow && s.eyebrow !== s.title) {
        const crumb = make("div", `${s.eyebrow}  ·  สไลด์ ${s.numLabel} / ${String(slides.length).padStart(2, "0")}`, "deck-slide-eyebrow");
        slideCard.appendChild(crumb);
      }
      const canvas = make("div", null, "editorial-prose deck-slide-canvas");
      canvas.innerHTML = s.html;
      wireInteractiveProseChildren(canvas, docGallery, (id) => jumpToIdHandler(id));
      slideCard.appendChild(canvas);

      // Swipe Left / Right support on touch devices (iPad / iPhone)
      let touchStartX = 0;
      let touchStartY = 0;
      slideCard.addEventListener(
        "touchstart",
        (ev) => {
          if (!ev.touches || !ev.touches[0]) return;
          touchStartX = ev.touches[0].clientX;
          touchStartY = ev.touches[0].clientY;
        },
        { passive: true }
      );
      slideCard.addEventListener(
        "touchend",
        (ev) => {
          if (!ev.changedTouches || !ev.changedTouches[0]) return;
          const dx = ev.changedTouches[0].clientX - touchStartX;
          const dy = ev.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0 && activeSlideIdx < slides.length - 1) renderDeckSlide(activeSlideIdx + 1, 1);
            else if (dx > 0 && activeSlideIdx > 0) renderDeckSlide(activeSlideIdx - 1, -1);
          }
        },
        { passive: true }
      );

      // Horizontal Filmstrip Scrubber
      const filmstrip = make("div", null, "deck-filmstrip");
      slides.forEach((sl) => {
        const chip = make(
          "button",
          `${sl.numLabel}${sl.imgCount ? " 🖼" : ""}`,
          `deck-film-chip${sl.index === activeSlideIdx ? " is-active" : ""}`
        );
        chip.type = "button";
        chip.title = sl.title;
        chip.addEventListener("click", () => {
          renderDeckSlide(sl.index, sl.index > activeSlideIdx ? 1 : -1);
        });
        filmstrip.appendChild(chip);
      });

      deckStage.append(buildDeckNavBar(false), progressTrack, slideCard, filmstrip, buildDeckNavBar(true));
      applyZoomStyles();

      // Highlight matching TOC item
      if (tocContainer) {
        tocContainer.querySelectorAll(".toc-link").forEach((a) => {
          const hid = (a.getAttribute("href") || "").replace(/^#/, "");
          a.classList.toggle("is-active-toc", s.allIds.has(hid));
        });
      }
    };

    const switchReaderMode = (nextMode) => {
      state.readerViewMode = nextMode;
      if (nextMode !== "deck") {
        paper.classList.remove("is-deck-theater");
      }
      modeBtns.forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.rmode === nextMode ? "true" : "false");
      });

      proseContainer.hidden = nextMode !== "scroll";
      deckStage.hidden = nextMode !== "deck";
      sorterStage.hidden = nextMode !== "sorter";

      if (nextMode === "sorter") {
        renderSorterStage();
        applyZoomStyles();
        const curCard = sorterStage.querySelector(`[data-slide-idx="${activeSlideIdx}"]`);
        if (curCard && curCard.scrollIntoView) {
          setTimeout(() => curCard.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
        }
      } else if (nextMode === "deck") {
        renderDeckSlide(activeSlideIdx, 0);
      } else {
        applyZoomStyles();
      }
    };

    // Re-bind toolbar events cleanly onto the latest document's slides closure
    navSuite._onModeClick = switchReaderMode;
    navSuite._onZoomStep = (dir) => {
      const curPct = getActiveZoom();
      if (state.readerViewMode === "sorter" && dir > 0 && curPct >= 160) {
        switchReaderMode("deck");
        return;
      }
      if (state.readerViewMode === "deck" && dir < 0 && curPct <= 70) {
        switchReaderMode("sorter");
        return;
      }
      setZoomValue(curPct + dir * 15);
    };
    navSuite._onZoomInput = (val) => setZoomValue(val);
    navSuite._onZoomReset = () => setZoomValue(100);

    if (!navSuite._eventsWired) {
      navSuite._eventsWired = true;
      modeBtns.forEach((b) => {
        b.addEventListener("click", () => navSuite._onModeClick && navSuite._onModeClick(b.dataset.rmode));
      });
      navSuite.querySelectorAll("[data-rzoom-step]").forEach((b) => {
        b.addEventListener("click", () => navSuite._onZoomStep && navSuite._onZoomStep(Number(b.dataset.rzoomStep)));
      });
      if (zoomSlider) {
        zoomSlider.addEventListener("input", (e) => navSuite._onZoomInput && navSuite._onZoomInput(Number(e.target.value)));
      }
      if (zoomPctBtn) {
        zoomPctBtn.addEventListener("click", () => navSuite._onZoomReset && navSuite._onZoomReset());
      }
      paper.addEventListener(
        "wheel",
        (e) => {
          if (!e.altKey) return;
          e.preventDefault();
          if (navSuite._onZoomStep) navSuite._onZoomStep(e.deltaY < 0 ? 1 : -1);
        },
        { passive: false }
      );
    }

    // Wire TOC sidebar & internal section links to respect active view mode
    jumpToIdHandler = (targetId) => {
      if (!targetId) return false;
      const escId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(targetId) : targetId;
      const matchedSlide = slides.find((sl) => sl.allIds.has(targetId));
      if (state.readerViewMode === "deck" && matchedSlide) {
        renderDeckSlide(matchedSlide.index, matchedSlide.index > activeSlideIdx ? 1 : matchedSlide.index < activeSlideIdx ? -1 : 0);
        const inDeckTarget = deckStage.querySelector(`#${escId}`);
        if (inDeckTarget) {
          const parentDetails = inDeckTarget.closest ? inDeckTarget.closest("details") : null;
          if (parentDetails && !parentDetails.open) parentDetails.open = true;
          inDeckTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          flashTargetEl(inDeckTarget);
        } else {
          paper.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return true;
      }
      if (state.readerViewMode === "sorter" && matchedSlide) {
        activeSlideIdx = matchedSlide.index;
        renderSorterStage();
        applyZoomStyles();
        const card = sorterStage.querySelector(`[data-slide-idx="${matchedSlide.index}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      const targetEl = proseContainer.querySelector(`#${escId}`) || document.getElementById(targetId);
      if (!targetEl) return false;
      const parentDetails = targetEl.closest ? targetEl.closest("details") : null;
      if (parentDetails && !parentDetails.open) parentDetails.open = true;
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      flashTargetEl(targetEl);
      return true;
    };

    jumpToHeadingHandler = (h) => {
      if (h && h.id) jumpToIdHandler(h.id);
    };

    // Global keyboard Left / Right arrow handler for active Slide Deck
    paper._deckKeyListener = (e) => {
      if (state.readerViewMode !== "deck" || deckStage.hidden) return;
      const panel = paper.closest ? paper.closest(".tab-panel") : null;
      if (panel && panel.hidden) return;
      if ($("imageLightbox") && !$("imageLightbox").hidden) return;
      const tag = String((e.target && e.target.tagName) || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowRight") {
        if (activeSlideIdx < slides.length - 1) {
          e.preventDefault();
          renderDeckSlide(activeSlideIdx + 1, 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (activeSlideIdx > 0) {
          e.preventDefault();
          renderDeckSlide(activeSlideIdx - 1, -1);
        }
      } else if (e.key === "Escape" && paper.classList.contains("is-deck-theater")) {
        e.preventDefault();
        paper.classList.remove("is-deck-theater");
        renderDeckSlide(activeSlideIdx, 0);
      }
    };

    if (!activeDeckKeyHandler) {
      activeDeckKeyHandler = (ev) => {
        document.querySelectorAll(".reader-paper").forEach((rp) => {
          if (rp._deckKeyListener) rp._deckKeyListener(ev);
        });
      };
      document.addEventListener("keydown", activeDeckKeyHandler);
    }

    switchReaderMode(state.readerViewMode || "scroll");
  }

  /* ---------- Tab 3: 2569 Course Manual ---------- */
  function initManualControls() {
    const search = $("manualSearchInput");
    if (search) search.addEventListener("input", renderManualReader);

    const isManualFiltered = () => {
      const q = (($("manualSearchInput") && $("manualSearchInput").value) || "").trim();
      return Boolean((state.manualChapterId && state.manualChapterId !== "ALL") || q);
    };

    if ($("exportManualPdfBtn")) {
      $("exportManualPdfBtn").addEventListener("click", (ev) => {
        if (!isManualFiltered()) return;
        ev.preventDefault();
        const ch = (MANUAL.chapters || []).find((c) => c.id === state.manualChapterId);
        const tag = ch ? ch.title : "เฉพาะหัวข้อที่ค้นหา";
        printWithCleanTitle(`คู่มือรายวิชา_RACM303_2569_${sanitizeFilenamePart(tag)}`);
      });
    }

    if ($("exportManualDocxBtn")) {
      $("exportManualDocxBtn").addEventListener("click", (ev) => {
        if (!isManualFiltered()) return;
        ev.preventDefault();
        const prose = $("manualProseContainer");
        if (!prose) return;
        const ch = (MANUAL.chapters || []).find((c) => c.id === state.manualChapterId);
        const tag = ch ? ch.title : "Filtered";
        downloadHtmlAsGenuineDocx(
          `คู่มือรายวิชา RACM 303 ปีการศึกษา 2569 — ${ch ? ch.title : "ผลการค้นหา"}`,
          "ภาควิชาเวชศาสตร์ชุมชน คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี มหาวิทยาลัยมหิดล",
          prose.innerHTML,
          `คู่มือรายวิชา_RACM303_2569_${sanitizeFilenamePart(tag)}.docx`
        );
      });
    }

    ["printManualBtn", "facPrintManualBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => printWithCleanTitle(""));
      }
    });
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

  /* ---------- Tab 4: HS1–HS6 Guided Learning Textbooks, Concise Summaries & Workbooks ---------- */
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
        const scope = (prose && prose.parentElement) || prose;
        if (!scope) return;
        const drawers = [...scope.querySelectorAll(".iq-feedback-drawer")];
        const detailsList = [...scope.querySelectorAll("details:not(.bulk-key-archive)")];
        const anyClosed = drawers.length ? drawers.some((d) => d.hidden) : detailsList.some((d) => !d.open);
        if (window.RACMInteractiveQA) {
          window.RACMInteractiveQA.toggleAllInlineAnswers(scope, anyClosed);
        }
        detailsList.forEach((d) => (d.open = anyClosed));
        expandAllBtn.textContent = anyClosed ? "ซ่อนแนวคำตอบทั้งหมด" : "เปิดแนวคำตอบทั้งหมด";
      });
    }
    ["printTextbookBtn", "fPrintTextbookBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", () => printWithCleanTitle(""));
      }
    });
  }

  function renderTextbookReader() {
    const picker = $("textbookDocList");
    const toc = $("textbookHeadingToc");
    const prose = $("textbookProseContainer");
    const metaTitle = $("activeTextbookMeta");
    const gdocBtn = $("activeTextbookGdocBtn");
    const pdfBtn = $("exportTextbookPdfBtn");
    const docxBtn = $("exportTextbookDocxBtn");
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
    const dlStem = `RACM303_${sanitizeFilenamePart(`${current.id}_${current.title}`).replace(/\s+/g, "_").slice(0, 72)}`;
    if (pdfBtn) {
      pdfBtn.href = `exports/pdf/${encodeURIComponent(current.id)}.pdf`;
      pdfBtn.setAttribute("download", `${dlStem}.pdf`);
    }
    if (docxBtn) {
      docxBtn.href = `exports/docx/${encodeURIComponent(current.id)}.docx`;
      docxBtn.setAttribute("download", `${dlStem}.docx`);
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

    const isPracticeFiltered = () => {
      const m = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
      const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim();
      return Boolean(m || q);
    };

    if ($("exportPracticePdfBtn")) {
      $("exportPracticePdfBtn").addEventListener("click", (ev) => {
        if (!isPracticeFiltered()) return;
        ev.preventDefault();
        const m = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "Filtered";
        printWithCleanTitle(`คลังทบทวน_${sanitizeFilenamePart(m)}_RACM303_2569`);
      });
    }

    if ($("exportPracticeDocxBtn")) {
      $("exportPracticeDocxBtn").addEventListener("click", (ev) => {
        if (!isPracticeFiltered()) return;
        ev.preventDefault();
        const mod = ($("practiceModuleFilter") && $("practiceModuleFilter").value) || "";
        const q = (($("practiceSearchInput") && $("practiceSearchInput").value) || "").trim().toLocaleLowerCase("th");
        let html = "";
        if (state.practiceSub === "rapid" && $("practiceRapidWrap")) {
          html = $("practiceRapidWrap").innerHTML;
        } else if (state.practiceSub === "flashcards") {
          const cards = (HS.glossary || []).filter(
            (g) => (!mod || g.module === mod) && (!q || `${g.termTH} ${g.termEN} ${g.definition}`.toLocaleLowerCase("th").includes(q))
          );
          html = `<table><thead><tr><th>บท</th><th>คำศัพท์</th><th>ความหมาย</th></tr></thead><tbody>${cards
            .map((g) => `<tr><td>${escapeHtml(g.module)}</td><td>${escapeHtml(g.termTH || g.termFull)} (${escapeHtml(g.termEN || "")})</td><td>${escapeHtml(g.definition)}</td></tr>`)
            .join("")}</tbody></table>`;
        } else {
          const items = (HS.selfCheck || []).filter(
            (it) => (!mod || it.module === mod) && (!q || `${it.question} ${it.answerHtml}`.toLocaleLowerCase("th").includes(q))
          );
          html = items.map((it) => `<h3>[${escapeHtml(it.module)} · ข้อ ${it.num}] ${escapeHtml(it.question)}</h3>${it.answerHtml}`).join("");
        }
        downloadHtmlAsGenuineDocx(
          `คลังทบทวนความรู้ RACM 303 (${mod || "ผลการค้นหา"})`,
          "วิทยาศาสตร์ระบบสุขภาพ (HS1–HS6) · ปีการศึกษา 2569",
          html,
          `คลังทบทวน_${sanitizeFilenamePart(mod || "Filtered")}_RACM303_2569.docx`
        );
      });
    }

    if ($("printPracticeBtn")) {
      $("printPracticeBtn").addEventListener("click", () => printWithCleanTitle(""));
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

      if (window.RACMInteractiveQA) {
        window.RACMInteractiveQA.enhancePracticeCard(card, item);
      } else {
        const scratch = make("textarea", null, "qa-scratch");
        scratch.placeholder = "ลองพิมพ์ร่างคำตอบด้วยตนเองสั้นๆ ก่อนเปิดดูแนวคำตอบ (Retrieval Practice)…";
        const ansBox = make("div", null, "qa-answer");
        ansBox.innerHTML = item.answerHtml;
        ansBox.hidden = true;
        const btn = make("button", "ดูแนวคำตอบ", "btn sm teal");
        btn.type = "button";
        btn.addEventListener("click", () => {
          ansBox.hidden = !ansBox.hidden;
          btn.textContent = ansBox.hidden ? "ดูแนวคำตอบ" : "ซ่อนแนวคำตอบ";
        });
        card.append(scratch, btn, ansBox);
      }
      wrap.appendChild(card);
    });
  }

  /* ---------- Tab: Discussion Health Systems (HS1–HS6 · Slide/Scroll · 6-Room Live · A4 Concise) ---------- */
  const LIVE = window.RACM_LIVE_CLASSROOM || null;
  const thWordSegmenter =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("th", { granularity: "word" })
      : null;

  function countConciseWords(text) {
    const clean = String(text || "").trim();
    if (!clean) return 0;
    if (thWordSegmenter) {
      let count = 0;
      for (const seg of thWordSegmenter.segment(clean)) {
        if (seg.isWordLike) count += 1;
      }
      return count;
    }
    // Fallback if Intl.Segmenter is unavailable
    let est = 0;
    clean.split(/\s+/).forEach((tok) => {
      if (!tok) return;
      const thChars = (tok.match(/[\u0E00-\u0E7F]/g) || []).length;
      est += thChars > 4 ? Math.ceil(thChars / 4.5) : 1;
    });
    return est;
  }

  function enforceA4ConciseText(rawVal, cell, isComposing) {
    let val = String(rawVal == null ? "" : rawVal);
    if (isComposing) return val;

    const maxLines = cell.maxLines || 4;
    const maxChars = cell.maxChars || 240;
    const maxWords = cell.maxWords || 45;

    // 1. Cap line breaks to fit A4 box height
    const lines = val.split(/\r?\n/);
    if (lines.length > maxLines) {
      val = lines.slice(0, maxLines - 1).concat([lines.slice(maxLines - 1).join(" ")]).join("\n");
    }

    // 2. Cap characters
    if (val.length > maxChars) {
      val = Array.from(val).slice(0, maxChars).join("");
    }

    // 3. Cap Thai/English word count to train concise A4 answers
    if (thWordSegmenter) {
      let wCount = 0;
      let cutIdx = val.length;
      for (const seg of thWordSegmenter.segment(val)) {
        if (seg.isWordLike) {
          wCount += 1;
          if (wCount > maxWords) {
            cutIdx = seg.index;
            break;
          }
        }
      }
      if (cutIdx < val.length) {
        val = val.slice(0, cutIdx).replace(/\s+$/, "");
      }
    }
    return val;
  }

  function getCaseInputIds(caseObj) {
    const ids = [];
    (caseObj.questions || []).forEach((q) => {
      const ws = q.worksheet;
      if (!ws || !ws.rows) return;
      ws.rows.forEach((r) => {
        (r.cells || []).forEach((c) => {
          if (c.inputId) ids.push(c.inputId);
        });
      });
    });
    return ids;
  }

  function collectQuestionCellsMap(qObj) {
    const out = {};
    const ws = qObj && qObj.worksheet;
    if (!ws || !ws.rows) return out;
    ws.rows.forEach((r) => {
      (r.cells || []).forEach((cell) => {
        if (cell.inputId) {
          const v = String(state.hsdDrafts[cell.inputId] || "");
          if (v.trim()) out[cell.inputId] = v;
        }
      });
    });
    return out;
  }

  function buildInputLabelMap(qObj) {
    const map = {};
    const ws = qObj && qObj.worksheet;
    if (!ws || !ws.rows) return map;
    ws.rows.forEach((r, rIdx) => {
      let rowPrefix = "";
      (r.cells || []).forEach((c) => {
        if (c.static && !rowPrefix) {
          rowPrefix = c.static.split("\n")[0].replace(/\s+/g, " ").slice(0, 28);
        }
      });
      if (!rowPrefix && ws.rows.length > 1) rowPrefix = `#${rIdx + 1}`;
      (r.cells || []).forEach((cell, cIdx) => {
        if (cell.inputId) {
          const colHdr = ((ws.headers && ws.headers[cIdx]) || "")
            .replace(/\s*\([^)]*\)/g, "")
            .trim()
            .slice(0, 26);
          map[cell.inputId] = rowPrefix ? `${rowPrefix} · ${colHdr}` : colHdr || cell.inputId;
        }
      });
    });
    return map;
  }

  function findQuestionContextById(questionId) {
    for (const c of HSD_DATA.cases || []) {
      const mod = (HSD_DATA.modules || []).find((m) => m.id === c.module) || { id: c.module, code: c.module, title: "" };
      for (const q of c.questions || []) {
        if (q.id === questionId) return { mod, caseObj: c, qObj: q };
      }
    }
    return null;
  }

  function countModuleDraftProgress(modId) {
    const cases = (HSD_DATA.cases || []).filter((c) => modId === "ALL" || c.module === modId);
    let total = 0;
    let filled = 0;
    cases.forEach((c) => {
      getCaseInputIds(c).forEach((id) => {
        total += 1;
        if (String(state.hsdDrafts[id] || "").trim().length > 0) filled += 1;
      });
    });
    return { filled, total, caseCount: cases.length };
  }

  function persistHsdDraft(inputId, val) {
    if (String(val || "").trim()) {
      state.hsdDrafts[inputId] = val;
    } else {
      delete state.hsdDrafts[inputId];
    }
    try {
      localStorage.setItem("racm303_hs_disc_drafts_v1", JSON.stringify(state.hsdDrafts));
    } catch (_) {}
    const ind = $("hsdSaveIndicator");
    if (ind) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      ind.textContent = `บันทึกแล้ว ${hh}:${mm}`;
    }
    refreshHsdModuleProgressBadges();
  }

  function refreshHsdModuleProgressBadges() {
    const grid = $("hsdModuleGrid");
    if (!grid) return;
    grid.querySelectorAll("[data-hsd-prog]").forEach((el) => {
      const modId = el.dataset.hsdProg;
      const p = countModuleDraftProgress(modId);
      el.textContent = p.filled > 0 ? `ตอบแล้ว ${p.filled}/${p.total}` : `${p.total} ช่อง`;
    });
  }

  function printSingleHsDiscussionCase(cardEl) {
    document.querySelectorAll(".hsd-case-card.is-print-target").forEach((el) => el.classList.remove("is-print-target"));
    cardEl.classList.add("is-print-target");
    document.body.classList.remove("print-students-mode", "print-disc-mode");
    document.body.classList.add("print-single-hsd-case");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-single-hsd-case");
      cardEl.classList.remove("is-print-target");
    }, 600);
  }

  function exportHsDiscussionStudentDocx() {
    const targetMod = state.hsdModule || "ALL";
    const mods = (HSD_DATA.modules || []).filter((m) => targetMod === "ALL" || m.id === targetMod);
    const subtitleParts = [];
    if (state.myStudent) {
      subtitleParts.push(
        `นักศึกษา: ${state.myStudent.id} ${state.myStudent.fullName} (Discussion กลุ่มที่ ${state.myStudent.disc} · พื้นที่ ${state.myStudent.area})`
      );
    }
    subtitleParts.push("รายวิชา RACM 303 เวชศาสตร์ชุมชนและวิทยาศาสตร์ระบบสุขภาพ ปีการศึกษา 2569");

    const blocks = [];
    mods.forEach((mod) => {
      blocks.push(`<h2>${escapeHtml(mod.code)}: ${escapeHtml(mod.title)}</h2>`);
      blocks.push(`<p>${escapeHtml(mod.scheduleDate)} · เวลา ${escapeHtml(mod.discTime)}</p>`);
      const modCases = (HSD_DATA.cases || []).filter((c) => c.module === mod.id);
      modCases.forEach((c) => {
        blocks.push(`<h3>${escapeHtml(c.title)}</h3>`);
        if (c.subtitle) blocks.push(`<p>${escapeHtml(c.subtitle)}</p>`);
        (c.questions || []).forEach((q) => {
          blocks.push(`<h4>${escapeHtml(q.label)}: ${escapeHtml(q.title)}</h4>`);
          blocks.push(`<p>${escapeHtml(q.prompt)}</p>`);
          const ws = q.worksheet;
          if (ws && ws.headers && ws.rows) {
            const ths = ws.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
            const trs = ws.rows
              .map((r) => {
                const tds = (r.cells || [])
                  .map((cell) => {
                    if (cell.static) return `<td>${escapeHtml(cell.static)}</td>`;
                    const ans = String(state.hsdDrafts[cell.inputId] || "").trim();
                    return `<td>${escapeHtml(ans || "-")}</td>`;
                  })
                  .join("");
                return `<tr>${tds}</tr>`;
              })
              .join("");
            blocks.push(`<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
          }
        });
      });
    });

    const suffix = targetMod === "ALL" ? "HS1-HS6" : targetMod;
    const sid = state.myStudent ? `_${state.myStudent.id}` : "";
    downloadHtmlAsGenuineDocx(
      "บันทึกการวิเคราะห์กรณีศึกษา Discussion ระบบสุขภาพ (HS1–HS6)",
      subtitleParts.join(" · "),
      blocks.join(""),
      `Discussion_${suffix}${sid}_RACM303_2569.docx`
    );
  }

  /* ---------- 6-Room Live Bar & Shared Countdown Timer UI ---------- */
  let liveSubscriptionsBound = false;

  function syncTimerWidgetDOM(snap) {
    const w = $("hsdTimerWidget");
    const clk = $("hsdTimerClock");
    const sub = $("hsdTimerSub");
    const bar = $("hsdTimerProgress");
    const ppBtn = $("hsdTimerPlayPauseBtn");
    if (!w || !clk) return;

    const s = snap || (LIVE ? LIVE.getTimerSnapshot() : { running: false, formatted: "05:00", pct: 100 });
    w.classList.toggle("is-running", Boolean(s.running));
    w.classList.toggle("is-warning", Boolean(s.isWarning));
    w.classList.toggle("is-urgent", Boolean(s.isUrgent));
    w.classList.toggle("is-timeup", Boolean(s.isTimeUp));
    clk.textContent = s.isTimeUp ? "00:00" : s.formatted;
    if (sub) {
      sub.textContent = s.isTimeUp
        ? "หมดเวลาอภิปราย!"
        : s.running
        ? "กำลังจับเวลาสด"
        : "นาฬิกาห้องกลุ่ม";
    }
    if (bar) {
      bar.style.width = `${s.pct}%`;
    }
    if (ppBtn) {
      ppBtn.textContent = s.running ? "⏸ พัก" : "▶ เริ่ม";
    }
  }

  function syncLiveConnectionAndPresenceDOM() {
    if (!LIVE) return;
    const conn = LIVE.getConnectionStatus();
    const pres = LIVE.getPresenceSummary();
    const dot = $("hsdConnDot");
    if (dot) {
      dot.classList.toggle("is-online", Boolean(conn.online));
      dot.classList.toggle("is-local", !conn.online && Boolean(conn.localReady));
      dot.title = conn.label;
    }
    const pill = $("hsdPresencePill");
    if (pill) {
      const rDef = LIVE.getRoomDef();
      pill.textContent = `${rDef.label} · ออนไลน์ ${Math.max(1, pres.total)} คน`;
      pill.title = conn.label;
    }
  }

  function renderHsLiveClassroomBar() {
    const bar = $("hsdLiveClassroomBar");
    if (!bar || !LIVE) return;
    bar.replaceChildren();

    const left = make("div", null, "hsd-live-left");
    const brand = make("div", null, "hsd-live-brand");
    const dot = make("span", null, "hsd-live-dot");
    dot.id = "hsdConnDot";
    brand.append(dot, make("span", "ห้อง Case Discussion สด:"));
    left.appendChild(brand);

    const roomPills = make("div", null, "hsd-room-pills");
    roomPills.setAttribute("role", "group");
    roomPills.setAttribute("aria-label", "เลือกห้องกลุ่มย่อย 1–6");
    const curRoom = LIVE.getRoomId();
    LIVE.rooms.forEach((rm) => {
      const rb = make("button", `กลุ่ม ${rm.id} (${rm.roomCode})`, "hsd-room-btn");
      rb.type = "button";
      rb.setAttribute("aria-pressed", rm.id === curRoom ? "true" : "false");
      rb.addEventListener("click", () => {
        LIVE.setRoom(rm.id, false);
        renderHsLiveClassroomBar();
        renderHsDiscussionContextBar();
        if (ROLE === "faculty" && typeof refreshAllVisibleLiveWalls === "function") {
          refreshAllVisibleLiveWalls();
        }
      });
      roomPills.appendChild(rb);
    });
    left.appendChild(roomPills);

    const presPill = make("span", "", "hsd-presence-pill");
    presPill.id = "hsdPresencePill";
    left.appendChild(presPill);

    if (ROLE === "student") {
      if (!state.myStudent) {
        const idWrap = make("div", null, "hsd-Identity-inline");
        const nameIn = document.createElement("input");
        nameIn.type = "text";
        nameIn.placeholder = "ชื่อเล่น/รหัส (แสดงบนจอ)…";
        nameIn.value = localStorage.getItem("racm303_live_name_v1") || "";
        nameIn.addEventListener("change", () => LIVE.setCustomDisplayName(nameIn.value));
        nameIn.addEventListener("blur", () => LIVE.setCustomDisplayName(nameIn.value));
        idWrap.appendChild(nameIn);
        left.appendChild(idWrap);
      }

      const followLbl = make("label", null, "hsd-follow-label");
      const followChk = document.createElement("input");
      followChk.type = "checkbox";
      followChk.checked = LIVE.getFollowTeacher();
      followChk.addEventListener("change", () => LIVE.setFollowTeacher(followChk.checked));
      followLbl.append(followChk, make("span", "ซิงค์ข้อตามอาจารย์"));
      left.appendChild(followLbl);
    }

    const right = make("div", null, "hsd-live-right");
    const timerW = make("div", null, "hsd-timer-widget");
    timerW.id = "hsdTimerWidget";
    const tSub = make("span", "นาฬิกาห้องกลุ่ม", "hsd-timer-sub");
    tSub.id = "hsdTimerSub";
    const tClk = make("span", "05:00", "hsd-timer-clock");
    tClk.id = "hsdTimerClock";
    const tProg = make("div", null, "hsd-timer-progress");
    tProg.id = "hsdTimerProgress";
    tProg.style.width = "100%";
    timerW.append(tSub, tClk, tProg);
    right.appendChild(timerW);

    if (ROLE === "faculty") {
      const ctrls = make("div", null, "hsd-timer-controls");
      [
        { label: "3 นาที", sec: 180 },
        { label: "5 นาที", sec: 300 },
        { label: "8 นาที", sec: 480 },
        { label: "12 นาที", sec: 720 }
      ].forEach((preset) => {
        const b = make("button", preset.label, "hsd-tbtn");
        b.type = "button";
        b.title = `เริ่มนับถอยหลัง ${preset.label} พร้อมกันทั้งห้อง`;
        b.addEventListener("click", () => LIVE.startTimer(preset.sec));
        ctrls.appendChild(b);
      });

      const ppBtn = make("button", "▶ เริ่ม", "hsd-tbtn primary");
      ppBtn.type = "button";
      ppBtn.id = "hsdTimerPlayPauseBtn";
      ppBtn.addEventListener("click", () => LIVE.togglePauseTimer());

      const plusBtn = make("button", "+1 นาที", "hsd-tbtn");
      plusBtn.type = "button";
      plusBtn.addEventListener("click", () => LIVE.addTimerSeconds(60));

      const rstBtn = make("button", "↺ รีเซ็ต", "hsd-tbtn");
      rstBtn.type = "button";
      rstBtn.addEventListener("click", () => LIVE.resetTimer(300));

      ctrls.append(ppBtn, plusBtn, rstBtn);
      right.appendChild(ctrls);
    }

    const muteBtn = make("button", LIVE.getSoundMuted() ? "🔕 ปิดเสียง" : "🔔 เสียงเตือน", "hsd-tbtn");
    muteBtn.type = "button";
    muteBtn.addEventListener("click", () => {
      LIVE.setSoundMuted(!LIVE.getSoundMuted());
      muteBtn.textContent = LIVE.getSoundMuted() ? "🔕 ปิดเสียง" : "🔔 เสียงเตือน";
    });
    right.appendChild(muteBtn);

    bar.append(left, right);
    syncLiveConnectionAndPresenceDOM();
    syncTimerWidgetDOM();

    if (!liveSubscriptionsBound) {
      liveSubscriptionsBound = true;
      LIVE.on("timer", (snap) => syncTimerWidgetDOM(snap));
      LIVE.on("presence", () => syncLiveConnectionAndPresenceDOM());
      LIVE.on("connection", () => syncLiveConnectionAndPresenceDOM());
      LIVE.on("responses", (ev) => {
        if (ROLE === "faculty" && typeof refreshLiveWallByQuestionId === "function") {
          refreshLiveWallByQuestionId(ev && ev.questionId ? ev.questionId : "*");
        }
      });
      LIVE.on("pointer", (ptr) => {
        if (ROLE !== "student" || !LIVE.getFollowTeacher() || !ptr || !ptr.questionId) return;
        if (state.activeTab !== "hs-discussion") return;
        // Avoid interrupting if student is actively typing right now
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList && activeEl.classList.contains("hsd-input")) return;
        jumpStudentToTeacherQuestion(ptr);
      });
    }
  }

  function jumpStudentToTeacherQuestion(ptr) {
    if (!ptr || !ptr.questionId) return;
    if (state.hsdModule !== "ALL" && ptr.module && state.hsdModule !== ptr.module) {
      state.hsdModule = ptr.module;
      if ($("hsdModuleSelect")) $("hsdModuleSelect").value = ptr.module;
    }
    if (state.hsdViewMode === "slide") {
      const slides = buildHsSlideDeckItems(getFilteredHsDiscussionCases());
      const idx = slides.findIndex((s) => s.kind === "question" && s.qObj.id === ptr.questionId);
      if (idx >= 0 && idx !== state.hsdSlideIdx) {
        state.hsdSlideIdx = idx;
        renderHsDiscussionView();
      }
    } else {
      const qEl = document.getElementById(`hsd-qblock-${ptr.questionId}`);
      if (qEl) qEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function syncViewModeButtonsUI() {
    document.querySelectorAll("[data-hsd-vmode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.hsdVmode === state.hsdViewMode ? "true" : "false");
    });
    const scenBtn = $("hsdToggleScenPaneBtn");
    if (scenBtn) {
      scenBtn.textContent = state.hsdHideScenario
        ? "◫ แสดงเนื้อหาโจทย์ซ้ายมือ"
        : "◫ ขยายช่องกรอกเต็มความกว้าง";
    }
    const thBtn = $("hsdToggleTheaterBtn");
    if (thBtn) {
      thBtn.hidden = state.hsdViewMode !== "slide";
      thBtn.textContent = state.hsdTheater ? "✕ ออกจากเต็มจอ (Esc)" : ROLE === "faculty" ? "⛶ ฉายเต็มจอ" : "⛶ เต็มจอ";
    }
    const panel = $("panel-hs-discussion");
    if (panel) {
      panel.classList.toggle("is-slide-mode", state.hsdViewMode === "slide");
    }
    document.body.classList.toggle("is-hsd-theater", state.hsdViewMode === "slide" && state.hsdTheater);
  }

  function initHsDiscussionControls() {
    const sel = $("hsdModuleSelect");
    if (sel) {
      (HSD_DATA.modules || []).forEach((m) => {
        const cnt = (HSD_DATA.cases || []).filter((c) => c.module === m.id).length;
        sel.add(new Option(`${m.code}: ${m.title} (${cnt} กรณี)`, m.id));
      });
      sel.value = state.hsdModule || "ALL";
      sel.addEventListener("change", () => {
        state.hsdModule = sel.value || "ALL";
        state.hsdSlideIdx = 0;
        const suffix = state.hsdModule !== "ALL" ? `-${state.hsdModule}` : "";
        history.replaceState(null, "", `#hs-discussion${suffix}`);
        renderHsDiscussionView();
      });
    }

    if ($("hsdSearchInput")) {
      $("hsdSearchInput").addEventListener("input", () => {
        state.hsdSlideIdx = 0;
        renderHsDiscussionView();
      });
    }

    if ($("hsdResetFilterBtn")) {
      $("hsdResetFilterBtn").addEventListener("click", () => {
        state.hsdModule = "ALL";
        state.hsdSlideIdx = 0;
        if (sel) sel.value = "ALL";
        if ($("hsdSearchInput")) $("hsdSearchInput").value = "";
        history.replaceState(null, "", "#hs-discussion");
        renderHsDiscussionView();
      });
    }

    if ($("hsdClearAllDraftsBtn")) {
      $("hsdClearAllDraftsBtn").addEventListener("click", () => {
        if (!window.confirm("ต้องการล้างร่างคำตอบที่คุณพิมพ์ไว้ในใบงาน Discussion ทั้งหมดหรือไม่?")) return;
        state.hsdDrafts = {};
        try {
          localStorage.removeItem("racm303_hs_disc_drafts_v1");
        } catch (_) {}
        if ($("hsdSaveIndicator")) $("hsdSaveIndicator").textContent = "ล้างคำตอบแล้ว";
        renderHsDiscussionView();
      });
    }

    const isHsdFiltered = () => {
      const q = (($("hsdSearchInput") && $("hsdSearchInput").value) || "").trim();
      return Boolean((state.hsdModule && state.hsdModule !== "ALL") || q);
    };

    ["hsdExportPdfBtn", "hsdExportKeyPdfBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", (ev) => {
          if (!isHsdFiltered()) return;
          ev.preventDefault();
          const modTag = state.hsdModule !== "ALL" ? state.hsdModule : "Filtered";
          const prefix = ROLE === "faculty" ? "Teacher_Key_Discussion" : "ใบงาน_Discussion";
          if (state.hsdViewMode === "slide") {
            state.hsdViewMode = "scroll";
            syncViewModeButtonsUI();
            renderHsDiscussionView();
          }
          printWithCleanTitle(`${prefix}_${sanitizeFilenamePart(modTag)}_RACM303_2569`);
        });
      }
    });

    ["hsdExportDocxBtn", "hsdExportKeyDocxBtn"].forEach((id) => {
      if ($(id)) {
        $(id).addEventListener("click", (ev) => {
          if (!isHsdFiltered()) return;
          ev.preventDefault();
          if (state.hsdViewMode === "slide") {
            state.hsdViewMode = "scroll";
            syncViewModeButtonsUI();
            renderHsDiscussionView();
          }
          const container = $("hsdCasesContainer");
          if (!container) return;
          const modTag = state.hsdModule !== "ALL" ? state.hsdModule : "Filtered";
          const title =
            ROLE === "faculty"
              ? `ชุดกรณีศึกษาและเฉลย Discussion ระบบสุขภาพ (${modTag})`
              : `กรณีศึกษาและใบงานอภิปรายกลุ่มย่อย ระบบสุขภาพ (${modTag})`;
          downloadHtmlAsGenuineDocx(
            title,
            "รายวิชา RACM 303 เวชศาสตร์ชุมชนและวิทยาศาสตร์ระบบสุขภาพ ปีการศึกษา 2569",
            container.innerHTML,
            `Discussion_${sanitizeFilenamePart(modTag)}_RACM303_2569.docx`
          );
        });
      }
    });

    if ($("hsdPrintAllBtn")) {
      $("hsdPrintAllBtn").addEventListener("click", () => {
        document.body.classList.remove("print-students-mode", "print-disc-mode", "print-single-hsd-case");
        if (state.hsdViewMode === "slide") {
          state.hsdViewMode = "scroll";
          syncViewModeButtonsUI();
          renderHsDiscussionView();
          setTimeout(() => printWithCleanTitle(""), 100);
          return;
        }
        printWithCleanTitle("");
      });
    }

    if ($("hsdExportMyAnswersBtn")) {
      $("hsdExportMyAnswersBtn").addEventListener("click", exportHsDiscussionStudentDocx);
    }

    document.querySelectorAll("[data-hsd-vmode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hsdViewMode = btn.dataset.hsdVmode === "scroll" ? "scroll" : "slide";
        if (state.hsdViewMode !== "slide") state.hsdTheater = false;
        try {
          localStorage.setItem("racm303_hsd_vmode", state.hsdViewMode);
        } catch (_) {}
        syncViewModeButtonsUI();
        renderHsDiscussionView();
      });
    });

    if ($("hsdToggleScenPaneBtn")) {
      $("hsdToggleScenPaneBtn").addEventListener("click", () => {
        state.hsdHideScenario = !state.hsdHideScenario;
        syncViewModeButtonsUI();
        document.querySelectorAll(".hsd-slide-stage").forEach((el) =>
          el.classList.toggle("is-full-right", state.hsdHideScenario)
        );
        document.querySelectorAll(".hsd-scroll-split").forEach((el) =>
          el.classList.toggle("is-scen-collapsed", state.hsdHideScenario)
        );
      });
    }

    if ($("hsdToggleTheaterBtn")) {
      $("hsdToggleTheaterBtn").addEventListener("click", () => {
        state.hsdViewMode = "slide";
        state.hsdTheater = !state.hsdTheater;
        syncViewModeButtonsUI();
        renderHsDiscussionView();
      });
    }

    document.querySelectorAll("[data-hsd-fmode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hsdFacultyMode = btn.dataset.hsdFmode || "teacher";
        state.hsdSlideIdx = 0;
        document.querySelectorAll("[data-hsd-fmode]").forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.hsdFmode === state.hsdFacultyMode ? "true" : "false")
        );
        renderHsDiscussionView();
      });
    });

    // Spotlight modal close handlers & Slide keyboard shortcuts (← / → / Esc)
    const spot = $("hsdSpotlightModal");
    if (spot) {
      spot.addEventListener("click", (e) => {
        if (e.target === spot) spot.hidden = true;
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (spot && !spot.hidden) {
          spot.hidden = true;
          return;
        }
        if (state.hsdTheater) {
          state.hsdTheater = false;
          syncViewModeButtonsUI();
          return;
        }
      }
      if (state.activeTab !== "hs-discussion" || state.hsdViewMode !== "slide") return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepHsSlide(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepHsSlide(-1);
      }
    });

    syncViewModeButtonsUI();
  }

  function renderHsDiscussionContextBar() {
    const bar = $("hsdContextBar");
    if (!bar) return;
    bar.replaceChildren();

    const left = make("div", null, "hsd-context-text");
    const right = make("div", null, "header-actions hsd-no-print");
    const roomNum = LIVE ? LIVE.getRoomId() : 1;
    const rot = (SCHED.hsRotation || []).find((r) => r.group === roomNum);
    const activeMod = state.hsdModule !== "ALL" ? state.hsdModule : "";
    const modInfo = activeMod && rot && rot[activeMod] ? rot[activeMod] : null;
    const modMeta = activeMod ? (HSD_DATA.modules || []).find((m) => m.id === activeMod) : null;

    if (state.myStudent) {
      const s = state.myStudent;
      if (modInfo && modMeta) {
        left.innerHTML = `<strong>นศพ. ${escapeHtml(s.fullName)} (กลุ่ม ${s.disc})</strong> · คาบ <strong>${escapeHtml(activeMod)}</strong> (${escapeHtml(modMeta.scheduleDate)} ${escapeHtml(modMeta.discTime)}) · ห้อง <strong>${escapeHtml(modInfo.room || (rot && rot.room) || "")}</strong> · อ.ประจำกลุ่ม: <strong>${escapeHtml(modInfo.instructor || "-")}</strong>`;
      } else {
        left.innerHTML = `<strong>นศพ. ${escapeHtml(s.fullName)} (กลุ่ม Discussion ที่ ${s.disc})</strong> · ห้องหลัก <strong>${escapeHtml(rot ? rot.room : "-")}</strong> · พิมพ์คำตอบกระชับตามกรอบ A4 ระบบส่งคำตอบขึ้นจอห้องกลุ่ม ${roomNum} อัตโนมัติ`;
      }
      const rosterBtn = make("button", `สมาชิกกลุ่ม ${s.disc} →`, "btn sm");
      rosterBtn.type = "button";
      rosterBtn.addEventListener("click", () => {
        if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
        switchTab("discussion");
      });
      right.appendChild(rosterBtn);
    } else if (ROLE === "faculty") {
      if (modInfo && modMeta) {
        left.innerHTML = `<strong>ห้องกลุ่มที่ ${roomNum} (${escapeHtml(modInfo.room || (rot && rot.room) || "")}) · คาบ ${escapeHtml(activeMod)}</strong> · อาจารย์ผู้นำอภิปราย: <strong>${escapeHtml(modInfo.instructor || "-")}</strong> · ดูคำตอบสดของ นศพ. และกด <em>“สไลด์ถัดไป →”</em> เพื่อเปิดเฉลย`;
      } else {
        left.innerHTML = `<strong>กำลังเปิดห้องกลุ่มอภิปรายที่ ${roomNum} (ห้อง ${escapeHtml(rot ? rot.room : "1C1-02")})</strong> · เลือกบท HS1–HS6 เพื่อดูชื่ออาจารย์ประจำกลุ่ม จับเวลาร่วมกับ นศพ. และตรวจคำตอบสดแบบ Mentimeter`;
      }
      const rosterBtn = make("button", `ใบรูปถ่ายกลุ่ม ${roomNum} →`, "btn sm");
      rosterBtn.type = "button";
      rosterBtn.addEventListener("click", () => {
        if ($("discGroupSelect")) $("discGroupSelect").value = String(roomNum);
        switchTab("discussion");
      });
      const fullGuideBtn = make("button", "คู่มือเฉลยรวม →", "btn sm teal");
      fullGuideBtn.type = "button";
      fullGuideBtn.addEventListener("click", () => {
        state.activeFacultyDocId = "hs-disc-teacher-key";
        state.facultySub = "guides";
        switchTab("faculty-docs");
      });
      right.append(rosterBtn, fullGuideBtn);
    } else {
      left.innerHTML = `<strong>กำลังอยู่ในห้องอภิปรายกลุ่มที่ ${roomNum} (${escapeHtml(rot ? rot.room : "1C1-02")})</strong> · พิมพ์รหัสนักศึกษา 7 หลักที่แถบค้นหาด้านบนสุดเพื่อผูกชื่อและกลุ่มอัตโนมัติ หรือพิมพ์ตอบในตารางด้านล่างได้ทันที`;
      const rosterBtn = make("button", "ดูรายชื่อกลุ่ม 1–6 →", "btn sm");
      rosterBtn.type = "button";
      rosterBtn.addEventListener("click", () => switchTab("discussion"));
      right.appendChild(rosterBtn);
    }

    bar.append(left, right);
  }

  function renderHsDiscussionModuleGrid() {
    const grid = $("hsdModuleGrid");
    if (!grid) return;
    grid.replaceChildren();

    const allProg = countModuleDraftProgress("ALL");
    const cardsMeta = [
      {
        id: "ALL",
        code: "HS1–HS6 รวมทุกบท",
        countText: `${allProg.caseCount} กรณี`,
        title: "ครบทั้ง 10 กรณีศึกษา (20 ข้อย่อย)",
        dateShort: "26 พ.ย.–4 ธ.ค."
      },
      ...(HSD_DATA.modules || []).map((m) => {
        const p = countModuleDraftProgress(m.id);
        return {
          id: m.id,
          code: `${m.code} (${m.examWeight})`,
          countText: `${p.caseCount} กรณี`,
          title: m.title,
          dateShort: m.scheduleDate.replace(/^วัน/, "")
        };
      })
    ];

    cardsMeta.forEach((item) => {
      const btn = make("button", null, "hsd-mod-card");
      btn.type = "button";
      btn.setAttribute("aria-pressed", state.hsdModule === item.id ? "true" : "false");

      const prog = countModuleDraftProgress(item.id);
      const progLabel = prog.filled > 0 ? `ตอบแล้ว ${prog.filled}/${prog.total}` : `${prog.total} ช่อง`;

      btn.innerHTML = `
        <div class="hsd-mod-top">
          <span class="hsd-mod-code">${escapeHtml(item.code)}</span>
          <span class="hsd-mod-count">${escapeHtml(item.countText)}</span>
        </div>
        <div class="hsd-mod-title">${escapeHtml(item.title)}</div>
        <div class="hsd-mod-meta">
          <span>${escapeHtml(item.dateShort)}</span>
          <span data-hsd-prog="${escapeHtml(item.id)}">${escapeHtml(progLabel)}</span>
        </div>
      `;

      btn.addEventListener("click", () => {
        state.hsdModule = item.id;
        state.hsdSlideIdx = 0;
        if ($("hsdModuleSelect")) $("hsdModuleSelect").value = item.id;
        const suffix = item.id !== "ALL" ? `-${item.id}` : "";
        history.replaceState(null, "", `#hs-discussion${suffix}`);
        renderHsDiscussionView();
      });

      grid.appendChild(btn);
    });
  }

  function renderScenarioBlock(blk) {
    if (blk.type === "p") {
      return make("p", blk.text);
    }
    if (blk.type === "subheading") {
      return make("h5", blk.text, "hsd-scenario-subhead");
    }
    if (blk.type === "dialogue") {
      const box = make("div", null, "hsd-dialogue-item");
      box.appendChild(make("span", blk.speaker, "hsd-dialogue-speaker"));
      box.appendChild(make("p", blk.text));
      return box;
    }
    if (blk.type === "callout") {
      const box = make("div", null, "hsd-callout-case");
      box.appendChild(make("h5", blk.title));
      box.appendChild(make("p", blk.text));
      return box;
    }
    if (blk.type === "bullets") {
      const ul = document.createElement("ul");
      ul.style.margin = "0 0 8px";
      ul.style.paddingLeft = "20px";
      (blk.items || []).forEach((it) => {
        const li = make("li", it);
        li.style.marginBottom = "4px";
        li.style.fontSize = "14px";
        ul.appendChild(li);
      });
      return ul;
    }
    if (blk.type === "table") {
      const wrap = make("div", null, "clean-table-wrap");
      wrap.style.marginBottom = "8px";
      const tbl = make("table", null, "clean-table");
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      (blk.headers || []).forEach((h) => hr.appendChild(make("th", h)));
      thead.appendChild(hr);
      const tbody = document.createElement("tbody");
      (blk.rows || []).forEach((r) => {
        const tr = document.createElement("tr");
        r.forEach((cellText) => {
          const td = document.createElement("td");
          td.innerHTML = escapeHtml(cellText).replace(/\n/g, "<br>");
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.append(thead, tbody);
      wrap.appendChild(tbl);
      return wrap;
    }
    if (blk.type === "image") {
      const fig = make("figure", null, "hsd-scenario-fig");
      const img = document.createElement("img");
      img.src = blk.src;
      img.alt = blk.alt || "";
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(blk.src, blk.caption || blk.alt || ""));
      const cap = make("figcaption", `${blk.caption || ""} (คลิกเพื่อขยาย)`);
      fig.append(img, cap);
      return fig;
    }
    return make("p", blk.text || "");
  }

  function buildScenarioPaneContent(caseObj) {
    const scenBox = make("div", null, "hsd-scenario-box");
    const hdr = make("div", null, "hsd-scenario-label");
    hdr.append(
      make("span", `${caseObj.module} · กรณีศึกษาที่ ${caseObj.caseNumber}`),
      make("span", `${(caseObj.questions || []).length} ข้อย่อย`)
    );
    scenBox.appendChild(hdr);
    scenBox.appendChild(make("h4", caseObj.title, "hsd-case-title"));
    if (caseObj.subtitle) {
      const sub = make("p", caseObj.subtitle, "hsd-case-sub");
      sub.style.marginBottom = "8px";
      scenBox.appendChild(sub);
    }
    (caseObj.scenarioBlocks || []).forEach((blk) => scenBox.appendChild(renderScenarioBlock(blk)));
    return scenBox;
  }

  function buildQuestionHeaderDOM(qObj) {
    const qHead = make("div", null, "hsd-q-head");
    const topRow = make("div", null, "hsd-q-head-top");
    topRow.append(
      make("span", qObj.label, "hsd-q-badge"),
      make("span", "จำกัดคำตามกรอบกระดาษ A4 · ตอบกระชับตรงประเด็น", "hsd-a4-rule-badge")
    );
    qHead.appendChild(topRow);
    qHead.appendChild(make("h5", qObj.title, "hsd-q-title"));
    qHead.appendChild(make("p", qObj.prompt, "hsd-q-prompt"));
    return qHead;
  }

  function buildWideWorksheetTableDOM(qObj) {
    const frag = document.createDocumentFragment();
    const ws = qObj.worksheet;
    if (!ws || ws.type !== "table") return frag;

    const wsWrap = make("div", null, "hsd-ws-wrap");
    const tbl = make("table", null, "hsd-ws-table");

    const colWidths = ws.colWidths || [];
    if (colWidths.length === (ws.headers || []).length) {
      const cg = document.createElement("colgroup");
      colWidths.forEach((w) => {
        const col = document.createElement("col");
        col.style.width = w;
        cg.appendChild(col);
      });
      tbl.appendChild(cg);
    }

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    (ws.headers || []).forEach((thText) => hr.appendChild(make("th", thText)));
    thead.appendChild(hr);

    const tbody = document.createElement("tbody");
    (ws.rows || []).forEach((r) => {
      const tr = document.createElement("tr");
      (r.cells || []).forEach((cell, colIdx) => {
        const td = document.createElement("td");
        const colHeader = (ws.headers && ws.headers[colIdx]) || "";
        if (colHeader) td.setAttribute("data-col-label", colHeader);

        if (cell.static) {
          td.className = "hsd-ws-static";
          td.innerHTML = escapeHtml(cell.static).replace(/\n/g, "<br>");
        } else if (cell.inputId) {
          const maxWords = cell.maxWords || 45;
          const maxChars = cell.maxChars || 240;
          const isCompact = Boolean(cell.compact);
          const minPx = isCompact ? 38 : 52;
          const savedVal = enforceA4ConciseText(state.hsdDrafts[cell.inputId] || "", cell, false);

          const ta = document.createElement("textarea");
          ta.className = `hsd-input${isCompact ? " is-compact" : ""}`;
          ta.id = `input_${cell.inputId}`;
          ta.maxLength = maxChars;
          ta.rows = isCompact ? 1 : 2;
          ta.placeholder = cell.placeholder || "พิมพ์คำตอบกระชับตรงประเด็น…";
          ta.value = savedVal;

          const foot = make("div", null, "hsd-cell-foot");
          const footRule = make("span", cell.a4BoxLabel || `≤${maxWords} คำ`);
          const footCount = make("span", "");
          foot.append(footRule, footCount);

          const mirror = make(
            "div",
            savedVal || "(พื้นที่เขียนคำตอบกระชับในกรอบ A4)",
            "hsd-print-mirror"
          );

          let composing = false;
          const refreshMetricsAndFit = () => {
            const wCnt = countConciseWords(ta.value);
            const cCnt = ta.value.length;
            const ratio = Math.max(wCnt / maxWords, cCnt / maxChars);
            foot.classList.toggle("is-near", ratio >= 0.85 && ratio < 1);
            foot.classList.toggle("is-limit", ratio >= 1);
            ta.classList.toggle("is-at-limit", ratio >= 1);
            footCount.textContent =
              ratio >= 1
                ? `${wCnt}/${maxWords} คำ · เต็มกรอบ A4`
                : `${wCnt}/${maxWords} คำ · ${cCnt}/${maxChars}`;
            ta.style.height = "auto";
            ta.style.height = `${Math.min(isCompact ? 86 : 170, Math.max(minPx, ta.scrollHeight))}px`;
          };

          ta.addEventListener("compositionstart", () => {
            composing = true;
          });
          ta.addEventListener("compositionend", () => {
            composing = false;
            const clamped = enforceA4ConciseText(ta.value, cell, false);
            if (clamped !== ta.value) ta.value = clamped;
            mirror.textContent = ta.value.trim() || "(พื้นที่เขียนคำตอบกระชับในกรอบ A4)";
            persistHsdDraft(cell.inputId, ta.value);
            refreshMetricsAndFit();
            if (LIVE && ROLE === "student") {
              LIVE.queueLiveTyping(qObj.id, collectQuestionCellsMap(qObj));
            }
          });
          ta.addEventListener("input", () => {
            if (!composing) {
              const clamped = enforceA4ConciseText(ta.value, cell, false);
              if (clamped !== ta.value) ta.value = clamped;
            }
            mirror.textContent = ta.value.trim() || "(พื้นที่เขียนคำตอบกระชับในกรอบ A4)";
            persistHsdDraft(cell.inputId, ta.value);
            refreshMetricsAndFit();
            if (LIVE && ROLE === "student") {
              LIVE.queueLiveTyping(qObj.id, collectQuestionCellsMap(qObj));
            }
          });
          ta.addEventListener("change", () => {
            if (LIVE && ROLE === "student" && typeof LIVE.flushLiveTyping === "function") {
              LIVE.flushLiveTyping(qObj.id, collectQuestionCellsMap(qObj));
            }
          });

          requestAnimationFrame(refreshMetricsAndFit);
          td.append(ta, foot, mirror);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    tbl.append(thead, tbody);
    wsWrap.appendChild(tbl);
    frag.appendChild(wsWrap);

    if (LIVE && ROLE === "student") {
      const subBar = make("div", null, "hsd-q-submit-bar hsd-no-print");
      const rNum = LIVE.getRoomId();
      const hint = make(
        "span",
        `● ซิงค์คำตอบสดเข้าห้องกลุ่มที่ ${rNum} อัตโนมัติขณะพิมพ์`,
        "hsd-live-sync-hint"
      );
      const sendBtn = make("button", `ส่งคำตอบข้อนี้ขึ้นจอห้องกลุ่ม ${rNum} ✓`, "btn sm teal");
      sendBtn.type = "button";
      sendBtn.addEventListener("click", () => {
        const map = collectQuestionCellsMap(qObj);
        if (!Object.keys(map).length) {
          hint.textContent = "กรุณาพิมพ์คำตอบอย่างน้อย 1 ช่องก่อนกดส่งขึ้นจอ";
          return;
        }
        LIVE.submitQuestionFinal(qObj.id, map);
        sendBtn.textContent = "✓ ส่งขึ้นจออาจารย์แล้ว!";
        hint.textContent = `ส่งคำตอบขึ้นจอห้องกลุ่มที่ ${LIVE.getRoomId()} เรียบร้อยแล้ว (แก้ไขเพิ่มเติมได้ตลอด)`;
        setTimeout(() => {
          sendBtn.textContent = `อัปเดตคำตอบขึ้นจอห้องกลุ่ม ${LIVE.getRoomId()} ✓`;
        }, 2000);
      });
      subBar.append(hint, sendBtn);
      frag.appendChild(subBar);
    }

    return frag;
  }

  function buildCaseSearchCorpus(c) {
    const parts = [c.module, c.title, c.subtitle, ...(c.frameworks || [])];
    (c.scenarioBlocks || []).forEach((b) => {
      if (b.text) parts.push(b.text);
      if (b.speaker) parts.push(b.speaker);
      if (b.title) parts.push(b.title);
      if (b.caption) parts.push(b.caption);
      if (b.items) parts.push(...b.items);
      if (b.rows) b.rows.forEach((r) => parts.push(...r));
    });
    (c.questions || []).forEach((q) => {
      parts.push(q.label, q.title, q.prompt);
      if (ROLE === "faculty" && typeof getFacultyKeySearchText === "function") {
        parts.push(getFacultyKeySearchText(q.id));
      }
    });
    return parts.join(" ").toLocaleLowerCase("th");
  }

  function getFilteredHsDiscussionCases() {
    const q = (($("hsdSearchInput") && $("hsdSearchInput").value) || "").trim().toLocaleLowerCase("th");
    const activeMod = state.hsdModule || "ALL";
    return (HSD_DATA.cases || []).filter((c) => {
      if (activeMod !== "ALL" && c.module !== activeMod) return false;
      if (q && !buildCaseSearchCorpus(c).includes(q)) return false;
      return true;
    });
  }

  function buildHsSlideDeckItems(matchedCases) {
    const items = [];
    matchedCases.forEach((c) => {
      const mod = (HSD_DATA.modules || []).find((m) => m.id === c.module) || {
        id: c.module,
        code: c.module,
        title: ""
      };
      (c.questions || []).forEach((qObj) => {
        items.push({ kind: "question", mod, caseObj: c, qObj });
        if (ROLE === "faculty" && state.hsdFacultyMode !== "student") {
          items.push({ kind: "key", mod, caseObj: c, qObj });
        }
      });
    });
    return items;
  }

  function stepHsSlide(delta) {
    const slides = buildHsSlideDeckItems(getFilteredHsDiscussionCases());
    if (!slides.length) return;
    const next = Math.max(0, Math.min(slides.length - 1, state.hsdSlideIdx + delta));
    if (next === state.hsdSlideIdx) return;
    state.hsdSlideIdx = next;
    renderHsDiscussionView();
  }

  function renderHsSlideDeckMode(container, matchedCases) {
    const slides = buildHsSlideDeckItems(matchedCases);
    if (!slides.length) return;
    if (state.hsdSlideIdx >= slides.length) state.hsdSlideIdx = slides.length - 1;
    if (state.hsdSlideIdx < 0) state.hsdSlideIdx = 0;

    const cur = slides[state.hsdSlideIdx];
    const nextSlide = slides[state.hsdSlideIdx + 1] || null;

    // Broadcast active question ID (student-safe) when Faculty changes slide
    if (LIVE && ROLE === "faculty") {
      LIVE.broadcastTeacherQuestionPointer(cur.mod.id, cur.caseObj.id, cur.qObj.id);
    }

    const shell = make("div", null, "hsd-slide-shell");
    const topbar = make("div", null, "hsd-slide-topbar hsd-no-print");

    const leftNav = make("div", null, "hsd-slide-nav-group");
    const prevBtn = make("button", "◀ สไลด์ก่อนหน้า", "btn sm");
    prevBtn.type = "button";
    prevBtn.disabled = state.hsdSlideIdx === 0;
    prevBtn.addEventListener("click", () => stepHsSlide(-1));

    const counter = make("span", `${state.hsdSlideIdx + 1} / ${slides.length}`, "hsd-slide-counter");

    const nextLabel =
      nextSlide && nextSlide.kind === "key"
        ? `สไลด์ถัดไป: เฉลย ${cur.qObj.label} ★ →`
        : "สไลด์ถัดไป ▶";
    const nextBtn = make(
      "button",
      nextLabel,
      nextSlide && nextSlide.kind === "key" ? "btn sm hsd-next-key-btn" : "btn sm primary"
    );
    nextBtn.type = "button";
    nextBtn.disabled = state.hsdSlideIdx >= slides.length - 1;
    nextBtn.addEventListener("click", () => stepHsSlide(1));

    const picker = document.createElement("select");
    picker.className = "hsd-slide-select";
    picker.setAttribute("aria-label", "เลือกสไลด์อย่างรวดเร็ว");
    slides.forEach((s, idx) => {
      const optLabel =
        s.kind === "key"
          ? `★ [เฉลยอาจารย์] ${s.mod.code} · ${s.qObj.label}: ${s.qObj.title}`
          : `${s.mod.code} · กรณีที่ ${s.caseObj.caseNumber} (${s.qObj.label}): ${s.qObj.title}`;
      picker.add(new Option(optLabel, String(idx), false, idx === state.hsdSlideIdx));
    });
    picker.addEventListener("change", () => {
      state.hsdSlideIdx = Number(picker.value) || 0;
      renderHsDiscussionView();
    });

    leftNav.append(prevBtn, counter, nextBtn, picker);

    const rightNav = make("div", null, "hsd-slide-nav-group");
    if (cur.mod && cur.mod.conciseDocId) {
      const docBtn = make("button", `บทเรียน ${cur.mod.code}`, "btn sm teal");
      docBtn.type = "button";
      docBtn.addEventListener("click", () => openTextbookDoc(cur.mod.conciseDocId));
      rightNav.appendChild(docBtn);
    }
    if (state.hsdTheater) {
      const exitBtn = make("button", "✕ ออกจากเต็มจอ", "btn sm");
      exitBtn.type = "button";
      exitBtn.addEventListener("click", () => {
        state.hsdTheater = false;
        syncViewModeButtonsUI();
      });
      rightNav.appendChild(exitBtn);
    }

    topbar.append(leftNav, rightNav);
    shell.appendChild(topbar);

    if (cur.kind === "key" && ROLE === "faculty" && typeof renderFacultyKeySlideStage === "function") {
      shell.appendChild(renderFacultyKeySlideStage(cur.qObj, cur.caseObj, cur.mod));
    } else {
      const stage = make(
        "div",
        null,
        `hsd-slide-stage${state.hsdHideScenario ? " is-full-right" : ""}`
      );
      const leftPane = make("div", null, "hsd-slide-left");
      leftPane.appendChild(buildScenarioPaneContent(cur.caseObj));

      const rightPane = make("div", null, "hsd-slide-right");
      rightPane.appendChild(buildQuestionHeaderDOM(cur.qObj));

      // On Faculty Portal: Show Live Student Response Wall right under Question Prompt!
      if (ROLE === "faculty" && typeof renderFacultyLiveWallForQuestion === "function") {
        rightPane.appendChild(renderFacultyLiveWallForQuestion(cur.qObj, cur.caseObj));
      }

      if (ROLE === "faculty") {
        const wsDetails = document.createElement("details");
        wsDetails.open = true;
        const sum = make(
          "summary",
          "ตารางใบงานฝั่งนักศึกษา (สำหรับสาธิตหน้าชั้น / ทดลองพิมพ์)",
          "sidebar-label"
        );
        sum.style.cursor = "pointer";
        sum.style.marginBottom = "4px";
        wsDetails.appendChild(sum);
        wsDetails.appendChild(buildWideWorksheetTableDOM(cur.qObj));
        rightPane.appendChild(wsDetails);
      } else {
        rightPane.appendChild(buildWideWorksheetTableDOM(cur.qObj));
      }

      stage.append(leftPane, rightPane);
      shell.appendChild(stage);
    }

    container.appendChild(shell);
  }

  function renderHsScrollMode(container, matchedCases) {
    const activeModules = (HSD_DATA.modules || []).filter((m) =>
      matchedCases.some((c) => c.module === m.id)
    );

    activeModules.forEach((mod) => {
      const modSec = make("section", null, "hsd-module-section");
      modSec.id = `hsd-sec-${mod.id}`;

      const banner = make("div", null, "hsd-module-banner");
      const bLeft = make("div");
      bLeft.append(
        make("h3", `${mod.code}: ${mod.title}`),
        make("p", `${mod.scheduleDate} · อภิปรายกลุ่มย่อย ${mod.discTime} (น้ำหนัก ${mod.examWeight}) — ${mod.summaryFocus}`)
      );

      const bRight = make("div", null, "header-actions hsd-no-print");
      if (mod.conciseDocId) {
        const bc = make("button", `ฉบับย่อ (${mod.code})`, "btn sm teal");
        bc.type = "button";
        bc.addEventListener("click", () => openTextbookDoc(mod.conciseDocId));
        bRight.appendChild(bc);
      }
      if (mod.docId) {
        const bd = make("button", `ฉบับเต็ม (${mod.code})`, "btn sm");
        bd.type = "button";
        bd.addEventListener("click", () => openTextbookDoc(mod.docId));
        bRight.appendChild(bd);
      }
      if (mod.wbDocId) {
        const bw = make("button", `Worksheet (${mod.code})`, "btn sm");
        bw.type = "button";
        bw.addEventListener("click", () => openTextbookDoc(mod.wbDocId));
        bRight.appendChild(bw);
      }
      banner.append(bLeft, bRight);
      modSec.appendChild(banner);

      if (ROLE === "faculty" && state.hsdFacultyMode === "teacher" && typeof appendFacultyFacilitationPlan === "function") {
        appendFacultyFacilitationPlan(modSec, mod.id);
      }

      const modCases = matchedCases.filter((c) => c.module === mod.id);
      modCases.forEach((c) => {
        const card = make("article", null, "hsd-case-card");
        card.id = `hsd-${c.id}`;

        const head = make("div", null, "hsd-case-head");
        const hLeft = make("div");
        const badgeRow = make("div", null, "session-badges");
        badgeRow.append(
          make("span", `${c.module} · Case ${c.caseNumber}`, "badge cat-HS"),
          make("span", `${(c.questions || []).length} ข้อย่อย`, "badge")
        );
        (c.frameworks || []).forEach((fw) => badgeRow.appendChild(make("span", fw, "hsd-fw-tag")));
        hLeft.appendChild(badgeRow);
        hLeft.appendChild(make("h4", c.title, "hsd-case-title"));

        const hRight = make("div", null, "header-actions hsd-no-print");
        const slideJumpBtn = make("button", "▣ เปิดเป็นสไลด์ข้อนี้", "btn sm teal");
        slideJumpBtn.type = "button";
        slideJumpBtn.addEventListener("click", () => {
          state.hsdViewMode = "slide";
          try {
            localStorage.setItem("racm303_hsd_vmode", "slide");
          } catch (_) {}
          const allSlides = buildHsSlideDeckItems(matchedCases);
          const foundIdx = allSlides.findIndex((s) => s.caseObj.id === c.id);
          state.hsdSlideIdx = foundIdx >= 0 ? foundIdx : 0;
          syncViewModeButtonsUI();
          renderHsDiscussionView();
        });

        const printCaseBtn = make("button", "พิมพ์กรณีนี้", "btn sm");
        printCaseBtn.type = "button";
        printCaseBtn.addEventListener("click", () => printSingleHsDiscussionCase(card));

        const clearCaseBtn = make("button", "ล้างข้อนี้", "btn sm");
        clearCaseBtn.type = "button";
        clearCaseBtn.addEventListener("click", () => {
          const ids = getCaseInputIds(c);
          const hasAny = ids.some((id) => String(state.hsdDrafts[id] || "").trim().length > 0);
          if (!hasAny) return;
          if (!window.confirm(`ต้องการล้างร่างคำตอบใน "${c.title}" หรือไม่?`)) return;
          ids.forEach((id) => delete state.hsdDrafts[id]);
          try {
            localStorage.setItem("racm303_hs_disc_drafts_v1", JSON.stringify(state.hsdDrafts));
          } catch (_) {}
          renderHsDiscussionView();
        });

        hRight.append(slideJumpBtn, printCaseBtn, clearCaseBtn);
        head.append(hLeft, hRight);
        card.appendChild(head);

        const body = make("div", null, "hsd-case-body");
        const split = make(
          "div",
          null,
          `hsd-scroll-split${state.hsdHideScenario ? " is-scen-collapsed" : ""}`
        );

        const scenSticky = make("div", null, "hsd-scroll-scen-sticky");
        scenSticky.appendChild(buildScenarioPaneContent(c));

        const qCol = make("div", null, "hsd-questions-col");
        (c.questions || []).forEach((qObj) => {
          const qBlock = make("div", null, "hsd-question-block");
          qBlock.id = `hsd-qblock-${qObj.id}`;
          qBlock.appendChild(buildQuestionHeaderDOM(qObj));

          if (ROLE === "faculty" && typeof renderFacultyLiveWallForQuestion === "function") {
            qBlock.appendChild(renderFacultyLiveWallForQuestion(qObj, c));
          }

          qBlock.appendChild(buildWideWorksheetTableDOM(qObj));

          if (ROLE === "faculty" && state.hsdFacultyMode !== "student" && typeof appendFacultyTeacherKey === "function") {
            appendFacultyTeacherKey(qBlock, qObj, c, mod);
          }

          qCol.appendChild(qBlock);
        });

        split.append(scenSticky, qCol);
        body.appendChild(split);
        card.appendChild(body);
        modSec.appendChild(card);
      });

      container.appendChild(modSec);
    });
  }

  function renderHsDiscussionView() {
    const container = $("hsdCasesContainer");
    if (!container) return;

    if (LIVE) {
      LIVE.startEngine();
      if (!$("hsdTimerWidget")) {
        renderHsLiveClassroomBar();
      }
    }

    if ($("hsdModuleSelect") && $("hsdModuleSelect").value !== state.hsdModule) {
      $("hsdModuleSelect").value = state.hsdModule;
    }

    syncViewModeButtonsUI();
    renderHsDiscussionContextBar();
    renderHsDiscussionModuleGrid();

    const matchedCases = getFilteredHsDiscussionCases();
    const totalSubQ = matchedCases.reduce((acc, c) => acc + (c.questions ? c.questions.length : 0), 0);
    if ($("hsdStatusText")) {
      $("hsdStatusText").textContent = `${matchedCases.length} กรณี (${totalSubQ} ข้อย่อย)`;
    }

    container.replaceChildren();
    if (!matchedCases.length) {
      container.appendChild(make("div", "ไม่พบกรณีศึกษาที่ตรงกับตัวกรองหรือคำค้นหา", "empty-state"));
      return;
    }

    if (state.hsdViewMode === "slide") {
      renderHsSlideDeckMode(container, matchedCases);
    } else {
      renderHsScrollMode(container, matchedCases);
    }
  }

  /* ---------- Role-Specific Question-Driven Concierge (My Day · My Rooms · My Groupmates / Students) ---------- */
  function getAllCourseTeachers() {
    const base = [...(ROSTER.courseTeachers || [])];
    if (!base.some((t) => t.key === "วิชัย")) {
      base.push({ key: "วิชัย", label: "ศ. นพ.วิชัย เอกพลากร" });
    }
    return base;
  }

  function getBangkokTodayISO() {
    try {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const bkk = new Date(utcMs + 7 * 3600000);
      const y = bkk.getFullYear();
      const m = String(bkk.getMonth() + 1).padStart(2, "0");
      const d = String(bkk.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch (_) {
      return "2026-11-25";
    }
  }

  function formatCourseDateOptionLabel(iso) {
    const dt = parseISODate(iso);
    const dowIdx = (dt.getUTCDay() + 6) % 7;
    const [y, m, d] = iso.split("-").map(Number);
    return `${TH_DOW_SHORT[dowIdx]} ${d} ${TH_MONTHS_SHORT[m]} ${y + 543}`;
  }

  function getCourseDistinctDates() {
    const set = new Set();
    (SCHED.sessions || []).forEach((s) => {
      if (ROLE === "student" && s.studentVisible === false) return;
      if (s.dateISO) set.add(s.dateISO);
    });
    return [...set].sort();
  }

  function sessionOccursOnDate(s, dateISO, ctx) {
    if (ROLE === "student" && s.studentVisible === false) return false;
    if (ctx && ctx.siteObj && s.allowedSites && !s.allowedSites.includes(ctx.siteObj.id)) {
      return false;
    }
    if (s.code === "TRAVEL" && ctx && ctx.siteObj && ctx.siteObj.departDateISO) {
      return ctx.siteObj.departDateISO === dateISO;
    }
    if (s.code === "RETURN" && ctx && ctx.siteObj && ctx.siteObj.returnDateISO) {
      return ctx.siteObj.returnDateISO === dateISO;
    }
    if (s.code === "FIELD") {
      const start = (ctx && ctx.siteObj && ctx.siteObj.startDateISO) || s.dateISO;
      const end = (ctx && ctx.siteObj && ctx.siteObj.endDateISO) || s.endDateISO || s.dateISO;
      return dateISO >= start && dateISO <= end;
    }
    return s.dateISO === dateISO;
  }

  function describeTeacherRoleForSession(session, teacherKey) {
    const assignments = getSessionAssignments(session);
    if (session.hsModule) {
      const matches = assignments.filter((a) => String(a.lecturer || "").includes(teacherKey));
      if (matches.length) {
        const m = matches[0];
        return {
          roleBadge: "🚪 คุมกลุ่ม Discussion",
          badgeCls: "cat-HS",
          roomText: `กลุ่มที่ ${m.shortGroup} · ห้อง ${m.room}${m.highlightRoom ? " (ย้ายห้องเฉพาะคาบนี้)" : ""}`,
          assignment: m
        };
      }
    }
    if (session.isFieldGroupSession) {
      const matches = assignments.filter((a) => String(a.lecturer || "").includes(teacherKey));
      if (matches.length) {
        const m = matches[0];
        return {
          roleBadge: "🏥 ที่ปรึกษากลุ่มพื้นที่",
          badgeCls: "cat-SG",
          roomText: `กลุ่ม${m.shortGroup} · ${m.room}`,
          assignment: m
        };
      }
    }
    if (session.category === "EXAM") {
      return { roleBadge: "📝 คุมสอบ / ประเมินผล", badgeCls: "cat-EXAM", roomText: session.room || "-", assignment: null };
    }
    if (session.category === "PANEL") {
      return { roleBadge: "🎙 เสวนา / ดำเนินการอภิปราย", badgeCls: "cat-PANEL", roomText: session.room || "-", assignment: null };
    }
    return { roleBadge: "🎤 สอนบรรยาย", badgeCls: session.category === "HS" ? "cat-HS" : "cat-EP", roomText: session.room || "-", assignment: null };
  }

  function selectActiveTeacher(teacherKey, jumpNearestDay = true) {
    state.myTeacherKey = teacherKey || "";
    if (state.myTeacherKey) {
      localStorage.setItem("racm303_my_teacher", state.myTeacherKey);
      state.myStudent = null;
      localStorage.removeItem("racm303_my_sid");
      ["personalStudentInput", "studioStudentInput", "subStudentQuickInput", "conciergeStudentInput"].forEach((id) => {
        if ($(id)) $(id).value = "";
      });
      if ($("schedAreaFilter")) $("schedAreaFilter").value = "";
      if ($("schedDiscFilter")) $("schedDiscFilter").value = "";
      state.calScope = "teacher";
    } else {
      localStorage.removeItem("racm303_my_teacher");
      if (!state.myStudent) state.calScope = "all";
    }

    ["schedTeacherFilter", "studioTeacherSelect", "personalTeacherSelect", "conciergeTeacherSelect"].forEach((id) => {
      if ($(id) && $(id).value !== state.myTeacherKey) $(id).value = state.myTeacherKey;
    });

    if (jumpNearestDay && state.myTeacherKey) {
      const dates = getCourseDistinctDates();
      const hasOnCur = (SCHED.sessions || []).some(
        (s) => sessionOccursOnDate(s, state.conciergeDateISO, {}) && sessionMatchesTeacher(s, state.myTeacherKey, getSessionAssignments(s))
      );
      if (!hasOnCur) {
        const bkk = getBangkokTodayISO();
        const nextMatch =
          dates.find(
            (d) => d >= bkk && (SCHED.sessions || []).some((s) => sessionOccursOnDate(s, d, {}) && sessionMatchesTeacher(s, state.myTeacherKey, getSessionAssignments(s)))
          ) ||
          dates.find((d) =>
            (SCHED.sessions || []).some((s) => sessionOccursOnDate(s, d, {}) && sessionMatchesTeacher(s, state.myTeacherKey, getSessionAssignments(s)))
          );
        if (nextMatch) state.conciergeDateISO = nextMatch;
      }
    }

    updatePersonalBanner();
    refreshCalendarStudioUI();
    if (state.activeTab === "schedule") renderScheduleCurrent();
  }

  function initRoleConcierge() {
    const mainEl = document.querySelector(".portal-main");
    if (!mainEl || $("roleConciergeShell")) return;

    const allDates = getCourseDistinctDates();
    const todayISO = getBangkokTodayISO();
    if (!state.conciergeDateISO) {
      const upcoming = allDates.find((d) => d >= todayISO);
      state.conciergeDateISO = upcoming || allDates[0] || "2026-11-25";
    }

    if (ROLE === "faculty") {
      const pBar = document.querySelector(".personal-bar");
      if (pBar && !$("personalTeacherSelect")) {
        const tWrap = make("div", null, "personal-teacher-wrap");
        const tLab = make("label", "อาจารย์ประจำตัว:");
        tLab.setAttribute("for", "personalTeacherSelect");
        const tSel = document.createElement("select");
        tSel.id = "personalTeacherSelect";
        tSel.className = "personal-teacher-select";
        tSel.add(new Option("— เลือกอาจารย์เพื่อดูคาบสอน & ห้องคุมกลุ่ม —", ""));
        getAllCourseTeachers().forEach((t) => tSel.add(new Option(t.label, t.key)));
        tSel.addEventListener("change", () => selectActiveTeacher(tSel.value, true));
        tWrap.append(tLab, tSel);
        pBar.insertBefore(tWrap, pBar.firstChild);
      }
      ["schedTeacherFilter", "studioTeacherSelect"].forEach((id) => {
        const sel = $(id);
        if (sel && ![...sel.options].some((o) => o.value === "วิชัย")) {
          sel.add(new Option("ศ. นพ.วิชัย เอกพลากร", "วิชัย"));
        }
      });
    }

    const shell = make("section", null, `concierge-shell is-compact-tabs role-${ROLE}${state.conciergeOpen ? " is-open" : ""}`);
    shell.id = "roleConciergeShell";
    shell.setAttribute("aria-label", ROLE === "faculty" ? "แถบเช็กด่วนอาจารย์" : "แถบเช็กด่วนนักศึกษา");

    const tabBar = make("div", null, "concierge-tabbar");

    // 1. Compact Identity Picker on Left
    const whoInline = make("div", null, "concierge-who-inline");
    whoInline.appendChild(make("span", "เช็กด่วน", "concierge-kicker"));

    if (ROLE === "faculty") {
      const tSel = document.createElement("select");
      tSel.id = "conciergeTeacherSelect";
      tSel.className = "concierge-select";
      tSel.setAttribute("aria-label", "เลือกชื่ออาจารย์");
      tSel.add(new Option("— เลือกอาจารย์ —", ""));
      getAllCourseTeachers().forEach((t) => tSel.add(new Option(t.label, t.key)));
      tSel.addEventListener("change", () => {
        selectActiveTeacher(tSel.value, true);
        if (tSel.value) {
          state.conciergeOpen = true;
          localStorage.setItem("racm303_concierge_tab_open", "1");
        }
        renderRoleConcierge();
      });
      whoInline.appendChild(tSel);
    } else {
      const sInput = document.createElement("input");
      sInput.type = "search";
      sInput.id = "conciergeStudentInput";
      sInput.className = "concierge-student-input";
      sInput.setAttribute("list", "studentLookupList");
      sInput.setAttribute("aria-label", "รหัสหรือชื่อนักศึกษา");
      sInput.placeholder = "รหัส 7 หลัก / ชื่อฉัน…";
      sInput.addEventListener("change", () => {
        const found = findStudentByQuery(sInput.value);
        if (found) {
          state.calScope = "student";
          applyMyStudent(found, true);
        }
      });
      sInput.addEventListener("input", () => {
        const val = sInput.value.trim();
        const m = val.match(/^(\d{7})\b/);
        if (m) {
          const found = ROSTER.students.find((st) => st.id === m[1]);
          if (found) {
            state.calScope = "student";
            applyMyStudent(found, true);
          }
        }
      });
      whoInline.appendChild(sInput);
    }

    // 2. Concise Clickable Tabs (Tab กด ชื่อแบบกระชับ)
    const tabsWrap = make("div", null, "concierge-tabs");
    tabsWrap.setAttribute("role", "tablist");
    const tabDefs =
      ROLE === "faculty"
        ? [
            { id: "today", label: "คาบสอน" },
            { id: "disc", label: "คุม Discussion" },
            { id: "field", label: "ที่ปรึกษา รพช." }
          ]
        : [
            { id: "today", label: "คาบเรียน" },
            { id: "disc", label: "ห้อง Discussion" },
            { id: "field", label: "กลุ่มพื้นที่" }
          ];

    tabDefs.forEach((td) => {
      const btn = make("button", null, "concierge-tab-btn");
      btn.type = "button";
      btn.dataset.ctab = td.id;
      btn.setAttribute("role", "tab");
      btn.innerHTML = `<span>${escapeHtml(td.label)}</span><span class="ctab-pill" data-ctab-pill="${td.id}"></span>`;
      btn.addEventListener("click", () => {
        if (state.conciergeOpen && state.conciergeTab === td.id) {
          state.conciergeOpen = false;
        } else {
          state.conciergeTab = td.id;
          state.conciergeOpen = true;
        }
        localStorage.setItem("racm303_concierge_tab_open", state.conciergeOpen ? "1" : "0");
        renderRoleConcierge();
      });
      tabsWrap.appendChild(btn);
    });

    // 3. Compact Right Actions
    const barRight = make("div", null, "concierge-bar-right");
    const spotTriggerBtn = make("button", "🔍 ⌘K", "btn sm");
    spotTriggerBtn.type = "button";
    spotTriggerBtn.title = "ค้นหาด่วนทุกอย่างในรายวิชา (⌘K / Ctrl+K)";
    spotTriggerBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openGlobalSpotlight();
    });

    const toggleOpenBtn = make("button", "ซ่อน ▴", "btn sm");
    toggleOpenBtn.id = "conciergeToggleOpenBtn";
    toggleOpenBtn.type = "button";
    toggleOpenBtn.hidden = !state.conciergeOpen;
    toggleOpenBtn.addEventListener("click", () => {
      state.conciergeOpen = false;
      localStorage.setItem("racm303_concierge_tab_open", "0");
      renderRoleConcierge();
    });

    barRight.append(spotTriggerBtn, toggleOpenBtn);
    tabBar.append(whoInline, tabsWrap, barRight);

    // Compact Drawer Body (renders only the 1 active tab when open)
    const bodyWrap = make("div", null, "concierge-body");
    bodyWrap.id = "conciergeBodyWrap";
    bodyWrap.hidden = !state.conciergeOpen;

    // Date bar (shown only inside "today" tab)
    const dayToolbar = make("div", null, "cq-compact-toolbar");
    dayToolbar.id = "conciergeDayToolbar";
    const dayWrap = make("div", null, "concierge-day-wrap");
    const prevDayBtn = make("button", "‹", "btn sm");
    prevDayBtn.type = "button";
    prevDayBtn.title = "วันก่อนหน้า";
    prevDayBtn.addEventListener("click", () => {
      const dates = getCourseDistinctDates();
      const curIdx = Math.max(0, dates.indexOf(state.conciergeDateISO));
      state.conciergeDateISO = dates[(curIdx - 1 + dates.length) % dates.length];
      state.conciergeTeacherAllDays = false;
      renderRoleConcierge();
    });

    const dateSel = document.createElement("select");
    dateSel.id = "conciergeDateSelect";
    dateSel.className = "concierge-date-select";
    dateSel.setAttribute("aria-label", "เลือกวันที่");
    dateSel.addEventListener("change", () => {
      state.conciergeDateISO = dateSel.value;
      state.conciergeTeacherAllDays = false;
      renderRoleConcierge();
    });

    const nextDayBtn = make("button", "›", "btn sm");
    nextDayBtn.type = "button";
    nextDayBtn.title = "วันถัดไป";
    nextDayBtn.addEventListener("click", () => {
      const dates = getCourseDistinctDates();
      const curIdx = Math.max(0, dates.indexOf(state.conciergeDateISO));
      state.conciergeDateISO = dates[(curIdx + 1) % dates.length];
      state.conciergeTeacherAllDays = false;
      renderRoleConcierge();
    });
    dayWrap.append(prevDayBtn, dateSel, nextDayBtn);

    if (ROLE === "faculty") {
      const allDaysBtn = make("button", "รวมทุกวัน", "btn sm");
      allDaysBtn.id = "conciergeToggleAllDaysBtn";
      allDaysBtn.type = "button";
      allDaysBtn.addEventListener("click", () => {
        state.conciergeTeacherAllDays = !state.conciergeTeacherAllDays;
        renderRoleConcierge();
      });
      dayWrap.appendChild(allDaysBtn);
    }

    const presetsRow = make("div", null, "concierge-presets-row");
    presetsRow.id = "conciergePresetsRow";
    dayToolbar.append(dayWrap, presetsRow);

    const cardsStage = make("div", null, "concierge-cards-stage");
    cardsStage.id = "conciergeCardsStage";

    bodyWrap.append(dayToolbar, cardsStage);
    shell.append(tabBar, bodyWrap);
    mainEl.insertBefore(shell, mainEl.firstChild);

    renderRoleConcierge();
  }

  function renderRoleConcierge() {
    const shell = $("roleConciergeShell");
    const bodyWrap = $("conciergeBodyWrap");
    const stage = $("conciergeCardsStage");
    const toggleBtn = $("conciergeToggleOpenBtn");
    const dateSel = $("conciergeDateSelect");
    const presetsRow = $("conciergePresetsRow");
    const dayToolbar = $("conciergeDayToolbar");
    if (!shell || !bodyWrap || !stage) return;

    const activeTab = state.conciergeTab || "today";
    shell.classList.toggle("is-open", Boolean(state.conciergeOpen));
    bodyWrap.hidden = !state.conciergeOpen;
    if (toggleBtn) toggleBtn.hidden = !state.conciergeOpen;
    if (dayToolbar) dayToolbar.hidden = activeTab !== "today";

    shell.querySelectorAll(".concierge-tab-btn").forEach((b) => {
      const sel = Boolean(state.conciergeOpen && b.dataset.ctab === activeTab);
      b.setAttribute("aria-selected", sel ? "true" : "false");
    });

    const allDates = getCourseDistinctDates();
    if (!state.conciergeDateISO || !allDates.includes(state.conciergeDateISO)) {
      const bkk = getBangkokTodayISO();
      state.conciergeDateISO = allDates.find((d) => d >= bkk) || allDates[0] || "2026-11-25";
    }
    const curDate = state.conciergeDateISO;
    const todayBkk = getBangkokTodayISO();

    if (dateSel) {
      const tKey = ROLE === "faculty" ? state.myTeacherKey : "";
      dateSel.replaceChildren();
      allDates.forEach((d) => {
        const sampleS = (SCHED.sessions || []).find((x) => x.dateISO === d);
        const shortTopic = sampleS ? sampleS.code : "";
        const teacherHas =
          tKey &&
          (SCHED.sessions || []).some((s) => sessionOccursOnDate(s, d, {}) && sessionMatchesTeacher(s, tKey, getSessionAssignments(s)));
        const prefix = d === todayBkk ? "📍 วันนี้ · " : teacherHas ? "★ " : "";
        dateSel.add(
          new Option(`${prefix}${formatCourseDateOptionLabel(d)}${shortTopic ? " (" + shortTopic + ")" : ""}`, d, d === curDate, d === curDate)
        );
      });
    }

    if (ROLE === "faculty") {
      renderFacultyConciergeStage(stage, presetsRow, activeTab, curDate, todayBkk);
    } else {
      renderStudentConciergeStage(stage, presetsRow, activeTab, curDate, todayBkk);
    }
  }

  function setConciergeTabPill(tabId, text) {
    const el = document.querySelector(`[data-ctab-pill="${tabId}"]`);
    if (el) el.textContent = text;
  }

  function renderStudentConciergeStage(stage, presetsRow, activeTab, curDate, todayBkk) {
    const s = state.myStudent;
    const sInput = $("conciergeStudentInput");
    const expectedVal = s ? `${s.id} — ${s.nickname || s.name}` : "";
    if (sInput && document.activeElement !== sInput && sInput.value !== expectedVal) {
      sInput.value = expectedVal;
    }

    const siteObj = s ? (SCHED.fieldworkSites || []).find((x) => x.shortName === s.area) || null : null;
    const siteId = s ? getSiteIdByAreaName(s.area) : 1;
    const rotObj = s ? (SCHED.hsRotation || []).find((r) => r.group === s.disc) || null : null;
    const personalCtx = {
      discVal: s ? String(s.disc) : "",
      areaVal: s ? s.area : "",
      teacherVal: "",
      siteObj
    };
    const daySessions = (SCHED.sessions || []).filter((sess) => sessionOccursOnDate(sess, curDate, personalCtx));

    // Always update concise tab pills on the 1-line bar
    setConciergeTabPill("today", `${daySessions.length} คาบ`);
    setConciergeTabPill("disc", s && rotObj ? `G${s.disc} · ${rotObj.room}` : "6 ห้อง");
    setConciergeTabPill("field", s ? `${siteId}.${s.area}` : "9 รพช.");

    if (!state.conciergeOpen) return;

    stage.replaceChildren();

    if (activeTab === "today") {
      if (presetsRow) {
        presetsRow.replaceChildren();
        [
          { iso: "2026-11-25", label: "25 พ.ย." },
          { iso: "2026-11-26", label: "26 พ.ย. (HS1)" },
          { iso: "2026-11-30", label: "30 พ.ย. (HS2–3)" },
          { iso: "2026-12-01", label: "1 ธ.ค. (HS4–5)" },
          { iso: "2026-12-04", label: "4 ธ.ค. (HS6)" },
          { iso: "2026-12-08", label: "8 ธ.ค. (สอบ EP)" },
          { iso: "2026-12-22", label: "22 ธ.ค. (สอบ HS)" }
        ].forEach((qd) => {
          const b = make("button", qd.label, `concierge-preset-chip${curDate === qd.iso ? " is-active" : ""}`);
          b.type = "button";
          b.addEventListener("click", () => {
            state.conciergeDateISO = qd.iso;
            renderRoleConcierge();
          });
          presetsRow.appendChild(b);
        });
      }

      if (!daySessions.length) {
        stage.appendChild(make("p", "ไม่มีคาบเรียนในวันที่เลือก", "cq-empty"));
        return;
      }
      const sessGrid = make("div", null, "cq-compact-sess-grid");
      daySessions.forEach((sess) => {
        const eff = resolveEffectiveSessionDetails(sess, personalCtx);
        const item = make("div", null, `cq-session-item cat-left-${sess.category}`);
        const roomShort = eff.room || sess.room || "-";
        const topLine = make("div", null, "cq-sess-top");
        topLine.innerHTML = `<span class="cq-time">${escapeHtml(sess.timeLabel || "ตลอดวัน")}</span><span class="cq-room-pill">📍 ${escapeHtml(roomShort)}</span>`;
        const titleEl = make("strong", eff.title, "cq-sess-title");
        const lecEl = make("span", `ผู้สอน: ${eff.lecturer || sess.lecturers || "-"}`, "cq-sess-lec");
        item.append(topLine, titleEl, lecEl);

        const actRow = make("div", null, "cq-mini-actions");
        if (sess.zoom && sess.zoom.url) {
          const zLink = make("a", "Zoom ↗", "cq-link-btn is-zoom");
          zLink.href = sess.zoom.url;
          zLink.target = "_blank";
          zLink.rel = "noopener";
          actRow.appendChild(zLink);
        }
        if (sess.conciseLink || sess.docLink) {
          const readBtn = make("button", `สรุป ${sess.code.replace("-DISC", "")} →`, "cq-link-btn");
          readBtn.type = "button";
          readBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openTextbookDoc(sess.conciseLink || sess.docLink);
          });
          actRow.appendChild(readBtn);
        }
        if (actRow.childElementCount) item.appendChild(actRow);
        item.addEventListener("click", () => openEventModal(sess));
        sessGrid.appendChild(item);
      });
      stage.appendChild(sessGrid);
      return;
    }

    if (activeTab === "disc") {
      if (s && rotObj) {
        const sumBar = make("div", null, "cq-compact-bar-summary");
        sumBar.innerHTML = `<div><strong>Discussion กลุ่มที่ ${s.disc} · ห้องหลัก ${escapeHtml(rotObj.room)}</strong> (${rotObj.count} คน)${s.disc === 6 ? " · <span style='color:#b45309'>HS4 เช้า 1 ธ.ค. ใช้ห้อง 2C2-03</span>" : ""}</div>`;
        const openBtn = make("button", `เปิดผังกลุ่ม G${s.disc} →`, "btn sm primary");
        openBtn.type = "button";
        openBtn.addEventListener("click", () => {
          if ($("discGroupSelect")) $("discGroupSelect").value = String(s.disc);
          state.discDeckIdx = Math.max(0, Number(s.disc) - 1);
          state.discViewMode = "formation";
          switchTab("discussion");
        });
        sumBar.appendChild(openBtn);
        stage.appendChild(sumBar);

        const slotGrid = make("div", null, "cq-compact-disc-grid");
        ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"].forEach((mod) => {
          const discSess = (SCHED.sessions || []).find((x) => x.hsModule === mod);
          const cell = rotObj[mod] || {};
          const row = make("div", null, `cq-slot-row${discSess && discSess.dateISO === curDate ? " is-today" : ""}`);
          row.innerHTML =
            `<span class="cq-slot-mod">${mod}</span>` +
            `<strong class="cq-slot-rm${cell.highlightRoom ? " is-changed" : ""}">ห้อง ${escapeHtml(cell.room || rotObj.room)}</strong>` +
            `<span class="cq-slot-inst">${escapeHtml(cell.instructor || "-")}</span>`;
          slotGrid.appendChild(row);
        });
        stage.appendChild(slotGrid);
      } else {
        const gPills = make("div", null, "cq-quick-pills");
        (SCHED.hsRotation || []).forEach((r, idx) => {
          const b = make("button", `G${r.group} · ${r.room} (${r.count})`, "btn sm");
          b.type = "button";
          b.addEventListener("click", () => {
            if ($("discGroupSelect")) $("discGroupSelect").value = String(r.group);
            state.discDeckIdx = idx;
            state.discViewMode = "formation";
            switchTab("discussion");
          });
          gPills.appendChild(b);
        });
        stage.appendChild(gPills);
      }
      return;
    }

    // activeTab === "field"
    if (s && siteObj) {
      const sumBar = make("div", null, "cq-compact-bar-summary");
      sumBar.innerHTML =
        `<div><span class="area-sub-pill area-site-${siteId}"><i class="area-dot"></i>${siteId}.${escapeHtml(s.area)}</span> ` +
        `<strong>${escapeHtml(siteObj.hospital)} (${escapeHtml(siteObj.province)})</strong> · ห้อง ${escapeHtml(siteObj.room)} · อ.${escapeHtml(s.advisor || siteObj.advisors)}</div>`;
      const openAreaBtn = make("button", `ดูผังทีม ${s.area} →`, "btn sm primary");
      openAreaBtn.type = "button";
      openAreaBtn.addEventListener("click", () => {
        if ($("fieldAreaSelect")) $("fieldAreaSelect").value = s.area;
        state.mapHoverSite = s.area;
        switchTab("fieldwork");
      });
      sumBar.appendChild(openAreaBtn);
      stage.appendChild(sumBar);

      const mates = ROSTER.students.filter((st) => st.area === s.area).sort((a, b) => compareTH(a.id, b.id));
      const mosaic = make("div", null, "gsorter-avatar-mosaic cq-teammates-mosaic");
      mates.forEach((m) => mosaic.appendChild(renderRosterMiniChip(m)));
      stage.appendChild(mosaic);
    } else {
      const sPills = make("div", null, "cq-quick-pills");
      (SCHED.fieldworkSites || []).forEach((st) => {
        const b = make("button", null, `area-sub-pill area-site-${st.id} is-btn`);
        b.type = "button";
        b.innerHTML = `<i class="area-dot"></i>${st.id}.${escapeHtml(st.shortName)} (${st.count})`;
        b.addEventListener("click", () => {
          if ($("fieldAreaSelect")) $("fieldAreaSelect").value = st.shortName;
          state.mapHoverSite = st.shortName;
          switchTab("fieldwork");
        });
        sPills.appendChild(b);
      });
      stage.appendChild(sPills);
    }
  }

  function renderFacultyConciergeStage(stage, presetsRow, activeTab, curDate, todayBkk) {
    const tKey = state.myTeacherKey || "";
    const allTeachers = getAllCourseTeachers();

    if ($("conciergeTeacherSelect") && $("conciergeTeacherSelect").value !== tKey) {
      $("conciergeTeacherSelect").value = tKey;
    }
    if ($("personalTeacherSelect") && $("personalTeacherSelect").value !== tKey) {
      $("personalTeacherSelect").value = tKey;
    }
    if ($("conciergeToggleAllDaysBtn")) {
      $("conciergeToggleAllDaysBtn").textContent = state.conciergeTeacherAllDays ? "รายวัน" : "รวมทุกวัน";
      $("conciergeToggleAllDaysBtn").classList.toggle("primary", state.conciergeTeacherAllDays);
    }

    const teacherAllSessions = tKey
      ? (SCHED.sessions || []).filter((s) => sessionMatchesTeacher(s, tKey, getSessionAssignments(s)))
      : [];
    const daySessions = (SCHED.sessions || []).filter((s) => {
      if (!sessionOccursOnDate(s, curDate, {})) return false;
      return tKey ? sessionMatchesTeacher(s, tKey, getSessionAssignments(s)) : true;
    });
    const advisedSites = tKey
      ? (SCHED.fieldworkSites || []).filter((st) => String(st.advisors || "").includes(tKey))
      : [];

    setConciergeTabPill(
      "today",
      `${state.conciergeTeacherAllDays && tKey ? teacherAllSessions.length : daySessions.length} คาบ`
    );
    setConciergeTabPill("disc", "HS1–HS6");
    setConciergeTabPill("field", advisedSites.length ? advisedSites.map((x) => x.shortName).join(",") : "9 รพช.");

    if (!state.conciergeOpen) return;

    stage.replaceChildren();

    if (activeTab === "today") {
      if (presetsRow) {
        presetsRow.replaceChildren();
        if (!tKey) {
          allTeachers.slice(0, 10).forEach((t) => {
            const chip = make("button", `อ.${t.key}`, "concierge-preset-chip");
            chip.type = "button";
            chip.addEventListener("click", () => selectActiveTeacher(t.key, true));
            presetsRow.appendChild(chip);
          });
        } else {
          const teachingDates = [...new Set(teacherAllSessions.map((s) => s.dateISO))].sort();
          teachingDates.forEach((d) => {
            const chip = make(
              "button",
              formatCourseDateOptionLabel(d).replace(" 2569", ""),
              `concierge-preset-chip${!state.conciergeTeacherAllDays && curDate === d ? " is-active" : ""}`
            );
            chip.type = "button";
            chip.addEventListener("click", () => {
              state.conciergeTeacherAllDays = false;
              state.conciergeDateISO = d;
              renderRoleConcierge();
            });
            presetsRow.appendChild(chip);
          });
          const clearTBtn = make("button", "✕ ล้าง", "concierge-preset-chip is-clear");
          clearTBtn.type = "button";
          clearTBtn.addEventListener("click", () => selectActiveTeacher("", false));
          presetsRow.appendChild(clearTBtn);
        }
      }

      const shownSessions = state.conciergeTeacherAllDays && tKey ? teacherAllSessions : daySessions;
      if (!shownSessions.length) {
        stage.appendChild(
          make(
            "p",
            tKey ? `ไม่มีคาบสอนของ อ.${tKey} ในวันที่ ${formatCourseDateOptionLabel(curDate)}` : "ไม่มีคาบในวันที่เลือก",
            "cq-empty"
          )
        );
        return;
      }

      const sessGrid = make("div", null, "cq-compact-sess-grid");
      shownSessions.forEach((sess) => {
        const roleInfo = tKey
          ? describeTeacherRoleForSession(sess, tKey)
          : { roleBadge: sess.code, badgeCls: `cat-${sess.category}`, roomText: sess.room || "-", assignment: null };
        const item = make("div", null, `cq-session-item cat-left-${sess.category}`);
        const datePrefix = state.conciergeTeacherAllDays ? `${formatCourseDateOptionLabel(sess.dateISO).replace(" 2569", "")} · ` : "";
        const topLine = make("div", null, "cq-sess-top");
        topLine.innerHTML = `<span class="cq-time">${escapeHtml(datePrefix + (sess.timeLabel || "ตลอดวัน"))}</span><span class="badge ${roleInfo.badgeCls}">${escapeHtml(roleInfo.roleBadge)}</span>`;
        const roomLine = make("div", `📍 ${roleInfo.roomText}`, "cq-room-line-strong");
        const titleEl = make("strong", sess.title, "cq-sess-title");
        item.append(topLine, roomLine, titleEl);

        const actRow = make("div", null, "cq-mini-actions");
        if (roleInfo.assignment) {
          const rosterBtn = make("button", "👥 ผังรูป นศ. ↗", "cq-link-btn is-primary");
          rosterBtn.type = "button";
          rosterBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            jumpToClassRoster(sess, roleInfo.assignment);
          });
          actRow.appendChild(rosterBtn);
        }
        if (sess.zoom && sess.zoom.url) {
          const zLink = make("a", "Zoom ↗", "cq-link-btn is-zoom");
          zLink.href = sess.zoom.url;
          zLink.target = "_blank";
          zLink.rel = "noopener";
          actRow.appendChild(zLink);
        }
        if (actRow.childElementCount) item.appendChild(actRow);
        item.addEventListener("click", () => openEventModal(sess));
        sessGrid.appendChild(item);
      });
      stage.appendChild(sessGrid);
      return;
    }

    if (activeTab === "disc") {
      if (tKey) {
        const slotGrid = make("div", null, "cq-compact-disc-grid");
        ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"].forEach((mod) => {
          const matchedRot = (SCHED.hsRotation || []).find((r) => r[mod] && String(r[mod].instructor || "").includes(tKey));
          const row = make("div", null, `cq-slot-row is-faculty${!matchedRot ? " is-off" : ""}`);
          if (matchedRot) {
            const cell = matchedRot[mod] || {};
            const rm = cell.room || matchedRot.room;
            row.innerHTML = `<span class="cq-slot-mod">${mod}</span><strong class="cq-slot-rm">G${matchedRot.group} · ${escapeHtml(rm)}</strong>`;
            row.style.cursor = "pointer";
            row.addEventListener("click", () => {
              if ($("discGroupSelect")) $("discGroupSelect").value = String(matchedRot.group);
              state.discDeckIdx = matchedRot.group - 1;
              state.discViewMode = "formation";
              switchTab("discussion");
            });
          } else {
            row.innerHTML = `<span class="cq-slot-mod">${mod}</span><span class="cq-slot-off-txt">—</span>`;
          }
          slotGrid.appendChild(row);
        });
        stage.appendChild(slotGrid);
      } else {
        const gPills = make("div", null, "cq-quick-pills");
        (SCHED.hsRotation || []).forEach((r, idx) => {
          const b = make("button", `G${r.group} · ${r.room}`, "btn sm");
          b.type = "button";
          b.addEventListener("click", () => {
            if ($("discGroupSelect")) $("discGroupSelect").value = String(r.group);
            state.discDeckIdx = idx;
            state.discViewMode = "formation";
            switchTab("discussion");
          });
          gPills.appendChild(b);
        });
        stage.appendChild(gPills);
      }
      return;
    }

    // activeTab === "field"
    const sPills = make("div", null, "cq-quick-pills");
    const targetSites = advisedSites.length ? advisedSites : SCHED.fieldworkSites || [];
    targetSites.forEach((st) => {
      const b = make("button", null, `area-sub-pill area-site-${st.id} is-btn`);
      b.type = "button";
      b.innerHTML = `<i class="area-dot"></i>${st.id}.${escapeHtml(st.shortName)} (${st.count})`;
      b.addEventListener("click", () => {
        if ($("fieldAreaSelect")) $("fieldAreaSelect").value = st.shortName;
        state.mapHoverSite = st.shortName;
        switchTab("fieldwork");
      });
      sPills.appendChild(b);
    });
    stage.appendChild(sPills);
  }

  /* ---------- Global Quick-Search & Navigation Spotlight (⌘K / Ctrl+K) + Floating Dock ---------- */
  let spotlightState = {
    cat: "all",
    selectedIdx: 0,
    results: []
  };

  function buildSpotlightEntries(rawQuery, catFilter) {
    const q = String(rawQuery || "").trim().toLocaleLowerCase("th");
    const items = [];

    const pushIfMatch = (entry) => {
      if (catFilter !== "all" && entry.cat !== catFilter) return;
      if (!q) {
        if (entry.defaultShow) items.push(entry);
        return;
      }
      if (entry.searchHay.includes(q)) items.push(entry);
    };

    // 1. Quick Navigation & Admin Views
    const navItems = [
      {
        title: "ปฏิทิน & ตารางสอน (Google Calendar / Apple iCal)",
        sub: "ดูตารางรายเดือน รายสัปดาห์ รายคาบ และตารางหมุนเวียน HS1–HS6",
        badge: "หน้าหลัก",
        defaultShow: true,
        run: () => switchTab("schedule")
      },
      {
        title: "กระดาน Group Sorter — รายชื่อกลุ่ม Discussion (6 กลุ่ม)",
        sub: "ซูมย่อ-ขยายเทียบสมาชิกและอาจารย์ครบทั้ง 6 ห้องเรียนพร้อมกัน",
        badge: "Group Sorter",
        defaultShow: true,
        run: () => {
          state.discViewMode = "sorter";
          switchTab("discussion");
        }
      },
      {
        title: "กระดาน Group Sorter — 9 พื้นที่ฝึกภาคสนาม (9 รพช.)",
        sub: "ซูมย่อ-ขยายเทียบสมาชิก อาจารย์ที่ปรึกษา และวันเดินทางทั้ง 9 พื้นที่",
        badge: "Group Sorter",
        defaultShow: true,
        run: () => {
          state.fieldViewMode = "sorter";
          switchTab("fieldwork");
        }
      },
      {
        title: "ตาราง Admin รวมรายชื่อนักศึกษา 169 คน (เรียงคอลัมน์ & ดาวน์โหลด CSV)",
        sub: "ค้นหา เรียงตามรหัส/ชื่อ/กลุ่ม/พื้นที่ คัดลอกลง Excel หรือส่งออก CSV",
        badge: "Admin Table",
        defaultShow: true,
        run: () => {
          if ($("fieldAreaSelect")) $("fieldAreaSelect").value = "";
          state.fieldViewMode = "table";
          switchTab("fieldwork");
        }
      },
      {
        title: "ศูนย์การส่งงาน SRN 1 / SRN 2 & ห้องเรียน E-learning (id=398)",
        sub: "ตั้งชื่อไฟล์ PDF อัตโนมัติ และลิงก์ตรงเข้า Moodle / Google Form",
        badge: "การส่งงาน",
        defaultShow: false,
        run: () => switchTab("submissions")
      }
    ];
    if (ROLE === "faculty") {
      navItems.push(
        {
          title: "ตรวจสอบตารางสอน & ซิงค์ฐานข้อมูล Google Apps Script",
          sub: "ประเด็นรอยืนยัน 6 จุด · ตารางเทียบ schedule-racm303-v1 & ดาวน์โหลด CSV v2",
          badge: "Admin ตรวจตาราง",
          defaultShow: true,
          run: () => switchTab("audit")
        },
        {
          title: "สารบัญลิงก์ต้นฉบับ Google Drive / Docs / ข้อสอบ",
          sub: "รวมลิงก์แก้ไขเอกสาร HS1–HS6 คู่มือผู้สอน และคลังข้อสอบสำหรับคณาจารย์",
          badge: "Admin ลิงก์ต้นฉบับ",
          defaultShow: true,
          run: () => {
            state.facultySub = "links";
            document.querySelectorAll("[data-fac-sub]").forEach((b) =>
              b.setAttribute("aria-pressed", b.dataset.facSub === "links" ? "true" : "false")
            );
            switchTab("faculty-docs");
          }
        }
      );
    }
    navItems.forEach((n) =>
      pushIfMatch({
        cat: "docs",
        icon: "⚡",
        title: n.title,
        sub: n.sub,
        badge: n.badge,
        defaultShow: n.defaultShow,
        searchHay: `${n.title} ${n.sub} admin table sorter csv`.toLocaleLowerCase("th"),
        run: n.run
      })
    );

    // 2. 6 Discussion Groups & 9 Fieldwork Sites
    (SCHED.hsRotation || []).forEach((r) => {
      const teachers = ["HS1", "HS2", "HS3", "HS4", "HS5", "HS6"].map((m) => (r[m] && r[m].instructor) || "").join(" · ");
      pushIfMatch({
        cat: "groups",
        icon: "🚪",
        title: `กลุ่มอภิปราย Discussion ที่ ${r.group} (ห้องหลัก ${r.room} · ${r.count} คน)`,
        sub: `อาจารย์หมุนเวียน: ${teachers}`,
        badge: `Discussion ${r.group}`,
        defaultShow: !q,
        searchHay: `discussion กลุ่มที่ ${r.group} g${r.group} ห้อง ${r.room} ${teachers}`.toLocaleLowerCase("th"),
        run: () => {
          if ($("discGroupSelect")) $("discGroupSelect").value = String(r.group);
          if (state.discViewMode === "deck") state.discDeckIdx = r.group - 1;
          switchTab("discussion");
        }
      });
    });

    (SCHED.fieldworkSites || []).forEach((st) => {
      const staffSearch = ROLE === "faculty" && st.staffRef ? st.staffRef : "";
      pushIfMatch({
        cat: "groups",
        icon: "🏥",
        title: `พื้นที่ ${st.id}. ${st.shortName} — ${st.hospital} (${st.province})`,
        sub: `${st.count} คน · ห้อง ${st.room} · อ.ที่ปรึกษา: ${st.advisors} · ${st.datesTH}`,
        badge: `พื้นที่ ${st.id}`,
        defaultShow: !q && st.id <= 4,
        searchHay: `พื้นที่ ${st.id} ${st.shortName} ${st.hospital} ${st.province} ${st.advisors} ${st.room} ${staffSearch}`.toLocaleLowerCase("th"),
        run: () => {
          if ($("fieldAreaSelect")) $("fieldAreaSelect").value = st.shortName;
          if (state.fieldViewMode === "deck") state.fieldDeckIdx = st.id - 1;
          switchTab("fieldwork");
        }
      });
    });

    // 3. Course Teachers (20)
    getAllCourseTeachers().forEach((t) => {
      pushIfMatch({
        cat: "teachers",
        icon: "👨‍⚕️",
        title: t.label,
        sub: ROLE === "faculty" ? "คลิกเพื่อตั้งเป็นอาจารย์ประจำตัว ดูคาบสอนและห้องคุม Discussion" : "คลิกเพื่อกรองดูคาบสอนของอาจารย์ในปฏิทิน",
        badge: "อาจารย์ผู้สอน",
        defaultShow: false,
        searchHay: `อาจารย์ ${t.key} ${t.label}`.toLocaleLowerCase("th"),
        run: () => {
          if (ROLE === "faculty") {
            selectActiveTeacher(t.key, true);
            state.conciergeOpen = true;
            renderRoleConcierge();
          } else {
            if ($("schedTeacherFilter")) $("schedTeacherFilter").value = t.key;
            refreshCalendarStudioUI();
            switchTab("schedule");
          }
        }
      });
    });

    // 4. Sessions / Lectures
    (SCHED.sessions || []).forEach((sess) => {
      if (ROLE === "student" && sess.studentVisible === false) return;
      pushIfMatch({
        cat: "teachers",
        icon: "📅",
        title: `[${sess.code}] ${sess.title}`,
        sub: `${sess.dateTH} · ${sess.timeLabel || "ตลอดวัน"} · ห้อง ${sess.room || "-"}`,
        badge: sess.code,
        defaultShow: false,
        searchHay: `${sess.code} ${sess.title} ${sess.dateTH} ${sess.room} ${sess.lecturers}`.toLocaleLowerCase("th"),
        run: () => {
          state.conciergeDateISO = sess.dateISO;
          renderRoleConcierge();
          switchTab("schedule");
          openEventModal(sess);
        }
      });
    });

    // 5. 169 Students
    ROSTER.students.forEach((s) => {
      const siteId = getSiteIdByAreaName(s.area);
      pushIfMatch({
        cat: "students",
        icon: "🎓",
        studentObj: s,
        title: `${s.id} — ${s.fullName}${s.nickname ? " (" + s.nickname + ")" : ""}`,
        sub: `Discussion กลุ่ม ${s.disc} · พื้นที่ ${siteId}. ${s.area} · อ.${s.advisor || "-"}`,
        badge: `G${s.disc} · ${s.area}`,
        defaultShow: false,
        searchHay: `${s.id} ${s.fullName} ${s.nickname || ""} ${s.program || ""} discussion ${s.disc} g${s.disc} ${s.area} ${s.advisor || ""}`.toLocaleLowerCase("th"),
        run: () => openStudentQuickModal(s)
      });
    });

    // 6. Textbooks & Manual Chapters (+ Faculty Docs/Links if Faculty)
    (HS.docs || []).forEach((d) => {
      pushIfMatch({
        cat: "docs",
        icon: "📘",
        title: `${d.badge} · ${d.title}`,
        sub: d.sessionInfo || d.subtitle || "เอกสารคำสอน / สรุปกระชับ / สมุดแบบฝึกหัด",
        badge: d.badge,
        defaultShow: false,
        searchHay: `${d.id} ${d.badge} ${d.title} ${d.subtitle || ""}`.toLocaleLowerCase("th"),
        run: () => openTextbookDoc(d.id)
      });
    });

    (MANUAL.chapters || []).forEach((ch) => {
      pushIfMatch({
        cat: "docs",
        icon: "📑",
        title: `คู่มือรายวิชา: ${ch.title}`,
        sub: "คลิกเพื่อเปิดอ่านบทนี้ในคู่มือการเรียนการสอน RACM 303 ปี 2569",
        badge: "คู่มือ 2569",
        defaultShow: false,
        searchHay: `คู่มือ ${ch.title}`.toLocaleLowerCase("th"),
        run: () => {
          state.manualChapterId = ch.id;
          switchTab("manual");
        }
      });
    });

    if (ROLE === "faculty" && typeof FACULTY !== "undefined" && FACULTY) {
      (FACULTY.docs || []).forEach((fd) => {
        pushIfMatch({
          cat: "docs",
          icon: "🔐",
          title: fd.title,
          sub: "คู่มือผู้สอนและบันทึกตรวจทานสำหรับคณาจารย์",
          badge: "Teacher Guide",
          defaultShow: false,
          searchHay: `${fd.id} ${fd.title} teacher guide คู่มือผู้สอน`.toLocaleLowerCase("th"),
          run: () => {
            state.facultySub = "guides";
            state.activeFacultyDocId = fd.id;
            switchTab("faculty-docs");
          }
        });
      });
      (FACULTY.links || []).forEach((fl) => {
        pushIfMatch({
          cat: "docs",
          icon: "🔗",
          title: fl.title,
          sub: `${fl.category || ""} · ${fl.note || ""}`,
          badge: "Drive / Docs ↗",
          defaultShow: false,
          searchHay: `${fl.title} ${fl.category || ""} ${fl.note || ""}`.toLocaleLowerCase("th"),
          run: () => window.open(fl.url, "_blank", "noopener")
        });
      });
    }

    return items.slice(0, 45);
  }

  function openGlobalSpotlight(initialCat) {
    let modal = $("globalSpotlightModal");
    if (!modal) {
      modal = make("div", null, "cal-modal-backdrop spotlight-backdrop");
      modal.id = "globalSpotlightModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "ค้นหาและนำทางด่วนทั่วพอร์ทัล");
      modal.hidden = true;

      const card = make("div", null, "spotlight-card");
      const top = make("div", null, "spotlight-input-row");
      const ico = make("span", "🔍", "spotlight-ico");
      const inp = document.createElement("input");
      inp.type = "search";
      inp.id = "globalSpotlightInput";
      inp.className = "spotlight-input";
      inp.placeholder =
        ROLE === "faculty"
          ? "ค้นหานักศึกษา 169 คน, ชื่ออาจารย์, ห้องคุม Discussion, รพช., คาบสอน, หรือลิงก์ต้นฉบับ…"
          : "ค้นหารหัสนักศึกษา, ชื่อเพื่อน, ห้องเรียน, กลุ่ม Discussion, รพช., อาจารย์, หรือบทเรียน HS…";
      const escBtn = make("button", "Esc", "spotlight-esc-btn");
      escBtn.type = "button";
      escBtn.addEventListener("click", () => {
        modal.hidden = true;
      });
      top.append(ico, inp, escBtn);

      const catsRow = make("div", null, "spotlight-cats-row");
      const cats = [
        { id: "all", label: "ทั้งหมด" },
        { id: "students", label: "นักศึกษา (169)" },
        { id: "groups", label: "กลุ่ม & รพช. (15)" },
        { id: "teachers", label: "อาจารย์ & คาบเรียน" },
        { id: "docs", label: ROLE === "faculty" ? "บทเรียน & Admin" : "บทเรียน & คู่มือ" }
      ];
      cats.forEach((c) => {
        const b = make("button", c.label, "spotlight-cat-pill");
        b.type = "button";
        b.dataset.spotCat = c.id;
        b.addEventListener("click", () => {
          spotlightState.cat = c.id;
          spotlightState.selectedIdx = 0;
          renderSpotlightResults();
          inp.focus();
        });
        catsRow.appendChild(b);
      });

      const listEl = make("div", null, "spotlight-results");
      listEl.id = "globalSpotlightResults";

      const foot = make("div", null, "spotlight-foot");
      foot.innerHTML = `<span><code>↑</code> <code>↓</code> เลือกรายการ · <code>Enter</code> เปิดทันที · <code>Esc</code> ปิดหน้าต่าง</span><span>กด <code>⌘K</code> หรือ <code>Ctrl+K</code> ได้จากทุกหน้า</span>`;

      card.append(top, catsRow, listEl, foot);
      modal.appendChild(card);
      document.body.appendChild(modal);

      modal.addEventListener("click", (ev) => {
        if (ev.target === modal) modal.hidden = true;
      });
      inp.addEventListener("input", () => {
        spotlightState.selectedIdx = 0;
        renderSpotlightResults();
      });
      inp.addEventListener("keydown", (ev) => {
        const len = spotlightState.results.length;
        if (ev.key === "ArrowDown" && len) {
          ev.preventDefault();
          spotlightState.selectedIdx = (spotlightState.selectedIdx + 1) % len;
          syncSpotlightSelection();
        } else if (ev.key === "ArrowUp" && len) {
          ev.preventDefault();
          spotlightState.selectedIdx = (spotlightState.selectedIdx - 1 + len) % len;
          syncSpotlightSelection();
        } else if (ev.key === "Enter" && len) {
          ev.preventDefault();
          const chosen = spotlightState.results[spotlightState.selectedIdx];
          if (chosen) {
            modal.hidden = true;
            chosen.run();
          }
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          modal.hidden = true;
        }
      });
    }

    if (initialCat) spotlightState.cat = initialCat;
    spotlightState.selectedIdx = 0;
    modal.hidden = false;
    renderSpotlightResults();
    const inp = $("globalSpotlightInput");
    if (inp) {
      inp.focus();
      inp.select();
    }
  }

  function syncSpotlightSelection() {
    const listEl = $("globalSpotlightResults");
    if (!listEl) return;
    listEl.querySelectorAll(".spotlight-item").forEach((el, i) => {
      const active = i === spotlightState.selectedIdx;
      el.classList.toggle("is-selected", active);
      if (active && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    });
  }

  function renderSpotlightResults() {
    const modal = $("globalSpotlightModal");
    const inp = $("globalSpotlightInput");
    const listEl = $("globalSpotlightResults");
    if (!modal || !listEl) return;

    modal.querySelectorAll("[data-spot-cat]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.spotCat === spotlightState.cat);
    });

    const entries = buildSpotlightEntries(inp ? inp.value : "", spotlightState.cat);
    spotlightState.results = entries;
    listEl.replaceChildren();

    if (!entries.length) {
      listEl.appendChild(make("div", "ไม่พบรายการที่ตรงกับคำค้นหา · ลองค้นด้วยรหัสนักศึกษา ชื่อเล่น ชื่อ รพช. หรือชื่ออาจารย์", "spotlight-empty"));
      return;
    }

    entries.forEach((entry, idx) => {
      const row = make("button", null, `spotlight-item${idx === spotlightState.selectedIdx ? " is-selected" : ""}`);
      row.type = "button";
      const left = make("div", null, "spotlight-item-left");
      if (entry.studentObj && state.showPhotos && entry.studentObj.id) {
        const av = make("span", null, "gsorter-chip-avatar");
        const img = document.createElement("img");
        img.src = `assets/photos/${encodeURIComponent(entry.studentObj.id)}.jpg`;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => {
          av.textContent = studentInitials(entry.studentObj);
        };
        av.appendChild(img);
        left.appendChild(av);
      } else {
        left.appendChild(make("span", entry.icon || "•", "spotlight-item-ico"));
      }
      const txtCol = make("div", null, "spotlight-item-txt");
      txtCol.append(make("strong", entry.title), make("span", entry.sub));
      left.appendChild(txtCol);

      const badge = make("span", entry.badge || "", "spotlight-item-badge");
      row.append(left, badge);
      row.addEventListener("mouseenter", () => {
        spotlightState.selectedIdx = idx;
        syncSpotlightSelection();
      });
      row.addEventListener("click", () => {
        modal.hidden = true;
        entry.run();
      });
      listEl.appendChild(row);
    });
  }

  function initGlobalSpotlightAndFab() {
    const headLinks = document.querySelector(".head-links");
    if (headLinks && !$("headSpotlightBtn")) {
      const btn = make("button", "🔍 ค้นหาด่วน (⌘K)", "ghost-link spotlight-head-btn");
      btn.id = "headSpotlightBtn";
      btn.type = "button";
      btn.addEventListener("click", () => openGlobalSpotlight());
      headLinks.insertBefore(btn, headLinks.firstChild);
    }

    if (!$("globalQuickNavFab")) {
      const fab = make("div", null, "global-quicknav-fab");
      fab.id = "globalQuickNavFab";

      const searchFabBtn = make("button", "🔍 ค้นหา & ข้ามหน้า (⌘K)", "fab-pill-btn is-primary");
      searchFabBtn.type = "button";
      searchFabBtn.addEventListener("click", () => openGlobalSpotlight());

      const myDayFabBtn = make("button", ROLE === "faculty" ? "คาบสอน & ห้องคุม" : "ห้องเรียน & กลุ่มฉัน", "fab-pill-btn");
      myDayFabBtn.type = "button";
      myDayFabBtn.addEventListener("click", () => {
        state.conciergeOpen = true;
        localStorage.setItem("racm303_concierge_tab_open", "1");
        renderRoleConcierge();
        const shell = $("roleConciergeShell");
        if (shell && shell.scrollIntoView) shell.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const topFabBtn = make("button", "↑", "fab-pill-btn is-icon");
      topFabBtn.type = "button";
      topFabBtn.title = "เลื่อนกลับขึ้นด้านบนสุด";
      topFabBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

      fab.append(searchFabBtn, myDayFabBtn, topFabBtn);
      document.body.appendChild(fab);
    }

    document.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && String(ev.key).toLowerCase() === "k") {
        ev.preventDefault();
        const modal = $("globalSpotlightModal");
        if (modal && !modal.hidden) modal.hidden = true;
        else openGlobalSpotlight();
        return;
      }
      if (ev.key === "/" && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        const tag = (ev.target && ev.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable)) return;
        ev.preventDefault();
        openGlobalSpotlight();
      }
    });
  }

  /* ---------- Live Cross-Tab Sync Channel (Shared across Student & Faculty Portals on smartwoo.github.io) ---------- */
  const LIVE_SYNC_CHANNEL = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("racm303_live_sync") : null;
  function broadcastPortalSync(kind, payload) {
    if (!LIVE_SYNC_CHANNEL) return;
    try {
      LIVE_SYNC_CHANNEL.postMessage({ kind, payload, ts: Date.now() });
    } catch (_) {}
  }

  /* ---------- Teaching Materials & Instructor Slide Upload Studio + Calendar Hover Popover ---------- */
  const SLIDES_STORAGE_KEY = "racm303_slides_registry_v1";
  const SLIDES_IDB_NAME = "racm303_slides_idb";
  const SLIDES_IDB_STORE = "slide_files";

  function loadSlidesRegistry() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SLIDES_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  let slidesRegistryCache = null;
  function getSlidesRegistry() {
    if (!slidesRegistryCache) slidesRegistryCache = loadSlidesRegistry();
    return slidesRegistryCache;
  }

  function persistSlidesRegistry(reg) {
    slidesRegistryCache = reg;
    try {
      localStorage.setItem(SLIDES_STORAGE_KEY, JSON.stringify(reg));
    } catch (_) {}
    broadcastPortalSync("slides_updated", {});
  }

  function openSlidesIdb() {
    return new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(SLIDES_IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(SLIDES_IDB_STORE)) {
            db.createObjectStore(SLIDES_IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function saveSlideBinaryToIdb(sessionId, fileObj) {
    const buf = await fileObj.arrayBuffer();
    const db = await openSlidesIdb();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(SLIDES_IDB_STORE, "readwrite");
        tx.objectStore(SLIDES_IDB_STORE).put(
          { bytes: buf, mime: fileObj.type || "application/octet-stream", name: fileObj.name },
          sessionId
        );
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
      return { storedInIdb: true, dataUrl: "" };
    }
    if (buf.byteLength <= 2.5 * 1024 * 1024) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return { storedInIdb: false, dataUrl: `data:${fileObj.type || "application/pdf"};base64,${b64}` };
    }
    return { storedInIdb: false, dataUrl: "" };
  }

  async function readSlideBinaryFromIdb(sessionId) {
    const db = await openSlidesIdb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SLIDES_IDB_STORE, "readonly");
        const req = tx.objectStore(SLIDES_IDB_STORE).get(sessionId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function deleteSlideBinaryFromIdb(sessionId) {
    const db = await openSlidesIdb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(SLIDES_IDB_STORE, "readwrite");
        tx.objectStore(SLIDES_IDB_STORE).delete(sessionId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  function getSessionSlideRecord(sessionId) {
    if (!sessionId) return null;
    const reg = getSlidesRegistry();
    if (reg[sessionId]) return reg[sessionId];
    const s = (SCHED.sessions || []).find((x) => x.id === sessionId);
    if (s && s.slideUrl) {
      return {
        sessionId,
        fileName: s.slideLabel || "Slide ประกอบการสอน",
        externalUrl: s.slideUrl,
        uploadedBy: s.lecturers || "คณาจารย์ผู้สอน",
        uploadedAt: "ประจำรายวิชา"
      };
    }
    return null;
  }

  function hasUploadedSessionSlide(sessionId) {
    return Boolean(getSessionSlideRecord(sessionId));
  }

  async function openSessionSlide(sessionId) {
    const rec = getSessionSlideRecord(sessionId);
    if (!rec) return;
    if (rec.externalUrl) {
      window.open(rec.externalUrl, "_blank", "noopener");
      return;
    }
    if (rec.dataUrl) {
      const a = document.createElement("a");
      a.href = rec.dataUrl;
      a.download = rec.fileName || `${sessionId}_slide.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const idbItem = await readSlideBinaryFromIdb(sessionId);
    if (idbItem && idbItem.bytes) {
      const mime = idbItem.mime || rec.mime || "application/pdf";
      const blob = new Blob([idbItem.bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      if (mime === "application/pdf") {
        window.open(blobUrl, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = idbItem.name || rec.fileName || `${sessionId}_slide`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    }
  }

  function resolveSessionTeachingDoc(session) {
    if (!session || session.category === "HOLIDAY") return null;
    if (session.docLink || session.conciseLink) {
      const primaryId = session.docLink || session.conciseLink;
      const modName = session.hsModule || session.docLink || "HS";
      return {
        kind: "hs",
        targetId: primaryId,
        conciseId: session.conciseLink || "",
        wbId: session.wbLink || "",
        shortLabel: `📘 เอกสารคำสอน (${modName})`,
        fullLabel: `📘 เอกสารคำสอน ${modName}`
      };
    }
    const id = String(session.id || "");
    const code = String(session.code || "");
    if (id.includes("st")) {
      return { kind: "hs", targetId: "HS2-CONCISE", conciseId: "HS2-CONCISE", wbId: "", shortLabel: "📘 เอกสารคำสอน (Systems)", fullLabel: "📘 เอกสารระบบสุขภาพ & Systems Thinking" };
    }
    if (session.category === "EP") {
      return { kind: "manual", targetId: "man-ch-8", shortLabel: "📘 เอกสาร/ขอบเขตเนื้อหา (EP)", fullLabel: "📘 ขอบเขตเนื้อหา EP (Table Spec)" };
    }
    if (code === "SRN 1" || code.includes("SRN 2")) {
      return { kind: "manual", targetId: "man-ch-11", shortLabel: "📘 เกณฑ์รายงาน & กำหนดส่ง", fullLabel: "📘 คู่มือบทที่ 11 (เกณฑ์การส่งงาน)" };
    }
    if (id.includes("pres-hs")) {
      return { kind: "manual", targetId: "man-ch-16", shortLabel: "📘 เกณฑ์นำเสนอระบบสุขภาพ", fullLabel: "📘 คู่มือบทที่ 16 (นำเสนอระบบสุขภาพ)" };
    }
    if (id.includes("pres-ep")) {
      return { kind: "manual", targetId: "man-ch-17", shortLabel: "📘 เกณฑ์นำเสนอระบาดวิทยา", fullLabel: "📘 คู่มือบทที่ 17 (นำเสนอระบาดวิทยา)" };
    }
    if (session.category === "EXAM") {
      return { kind: "manual", targetId: "man-ch-9", shortLabel: "📘 ระเบียบ & สัดส่วนข้อสอบ", fullLabel: "📘 คู่มือบทที่ 8–9 (ระเบียบการสอบ)" };
    }
    if (code === "FIELD" || code === "TRAVEL" || code === "RETURN") {
      return { kind: "manual", targetId: "man-ch-10", shortLabel: "📘 คู่มือปฏิบัติภาคสนาม", fullLabel: "📘 คู่มือบทที่ 10 (แนวปฏิบัติภาคสนาม)" };
    }
    if (session.category === "SG") {
      return { kind: "manual", targetId: "man-ch-6", shortLabel: "📘 คู่มือกลุ่มย่อยภาคสนาม", fullLabel: "📘 คู่มือบทที่ 6 & 10 (กลุ่มย่อยภาคสนาม)" };
    }
    if (id.includes("orient")) {
      return { kind: "manual", targetId: "man-ch-3", shortLabel: "📘 เอกสารแนะนำรายวิชา", fullLabel: "📘 คู่มือบทที่ 3–4 (เป้าหมายรายวิชา)" };
    }
    return { kind: "manual", targetId: "man-ch-7", shortLabel: "📘 คู่มือประจำคาบเรียน", fullLabel: "📘 คู่มือการเรียนการสอนประจำคาบ" };
  }

  function triggerSessionTeachingDoc(docInfo, closeModalFirst) {
    if (!docInfo) return;
    if (closeModalFirst) closeEventModal();
    hideCalendarHoverPopover();
    if (docInfo.kind === "hs") {
      openTextbookDoc(docInfo.targetId);
    } else {
      openManualChapter(docInfo.targetId);
    }
  }

  function appendSessionMaterialButtons(container, session, closeModalFirst) {
    if (!container || !session || session.category === "HOLIDAY") return;
    const docInfo = resolveSessionTeachingDoc(session);
    if (session.conciseLink && session.docLink) {
      const bConcise = make("button", `📘 ฉบับย่อ (${session.hsModule || session.docLink})`, "btn sm teal");
      bConcise.type = "button";
      bConcise.addEventListener("click", () => {
        if (closeModalFirst) closeEventModal();
        openTextbookDoc(session.conciseLink);
      });
      container.appendChild(bConcise);

      const bFull = make("button", `📘 เอกสารคำสอน ${session.docLink}`, "btn sm");
      bFull.type = "button";
      bFull.addEventListener("click", () => {
        if (closeModalFirst) closeEventModal();
        openTextbookDoc(session.docLink);
      });
      container.appendChild(bFull);

      if (session.wbLink) {
        const bWb = make("button", `Worksheet (${session.wbLink.replace("-WB", "")})`, "btn sm");
        bWb.type = "button";
        bWb.addEventListener("click", () => {
          if (closeModalFirst) closeEventModal();
          openTextbookDoc(session.wbLink);
        });
        container.appendChild(bWb);
      }
    } else if (docInfo) {
      const bDoc = make("button", docInfo.fullLabel, "btn sm teal");
      bDoc.type = "button";
      bDoc.addEventListener("click", () => triggerSessionTeachingDoc(docInfo, closeModalFirst));
      container.appendChild(bDoc);
    }

    const slideRec = getSessionSlideRecord(session.id);
    if (slideRec) {
      const bSlide = make("button", `📊 เปิด Slide · ${slideRec.fileName || "ดาวน์โหลด"}`, "btn sm slide-ready-btn");
      bSlide.type = "button";
      bSlide.addEventListener("click", () => openSessionSlide(session.id));
      container.appendChild(bSlide);
    } else {
      const bNoSlide = make("button", "📊 Slide ประกอบการสอน (ยังไม่อัปโหลด)", "btn sm cal-mat-btn is-disabled-slide");
      bNoSlide.type = "button";
      bNoSlide.disabled = true;
      bNoSlide.setAttribute("aria-disabled", "true");
      bNoSlide.title = "อาจารย์ผู้สอนยังไม่ได้อัปโหลด Slide สำหรับคาบเรียนนี้";
      container.appendChild(bNoSlide);
    }

    if (ROLE === "faculty") {
      const bUp = make("button", slideRec ? "🔄 เปลี่ยนไฟล์ Slide" : "⬆ อัปโหลด Slide", "btn sm slide-upload-mini-btn");
      bUp.type = "button";
      bUp.addEventListener("click", () => {
        if (closeModalFirst) closeEventModal();
        openFacultySlideStudioForSession(session.id);
      });
      container.appendChild(bUp);
    }
  }

  let calHoverHideTimer = null;
  function hideCalendarHoverPopover() {
    const pop = $("calendarSessionHoverPopover");
    if (pop) pop.hidden = true;
  }

  function ensureCalendarHoverPopover() {
    let pop = $("calendarSessionHoverPopover");
    if (pop) return pop;
    pop = make("div", null, "cal-session-hover-popover");
    pop.id = "calendarSessionHoverPopover";
    pop.hidden = true;
    document.body.appendChild(pop);

    pop.addEventListener("mouseenter", () => {
      if (calHoverHideTimer) {
        clearTimeout(calHoverHideTimer);
        calHoverHideTimer = null;
      }
    });
    pop.addEventListener("mouseleave", () => {
      calHoverHideTimer = setTimeout(hideCalendarHoverPopover, 180);
    });
    return pop;
  }

  function showCalendarHoverPopover(anchorEl, sessionId) {
    const session = (SCHED.sessions || []).find((s) => s.id === sessionId);
    if (!session || !anchorEl) return;
    if (calHoverHideTimer) {
      clearTimeout(calHoverHideTimer);
      calHoverHideTimer = null;
    }

    const pop = ensureCalendarHoverPopover();
    const ctx = getActivePersonalContext();
    const eff = resolveEffectiveSessionDetails(session, ctx);
    const isHol = session.category === "HOLIDAY";
    const docInfo = resolveSessionTeachingDoc(session);
    const slideRec = getSessionSlideRecord(session.id);

    pop.replaceChildren();

    const head = make("div", null, "cshp-head");
    const catPill = make("span", CAT_NAMES[session.category] || session.category, `badge cat-${session.category}`);
    const timeSpan = make("span", isHol ? "🏖 วันหยุดราชการ" : session.timeLabel, "cshp-time");
    head.append(catPill, timeSpan);
    pop.appendChild(head);

    pop.appendChild(make("div", eff.title, "cshp-title"));

    if (!isHol) {
      const meta = make("div", null, "cshp-meta");
      meta.innerHTML = `<span>📍 ${escapeHtml(eff.room || "—")}</span> · <span>👨‍⚕️ ${escapeHtml(eff.lecturer || "—")}</span>`;
      pop.appendChild(meta);
    } else {
      pop.appendChild(make("div", "งดการเรียนการสอนในชั้นเรียน", "cshp-meta"));
    }

    const matRow = make("div", null, "cshp-materials-grid");

    if (docInfo && !isHol) {
      const docBtn = make("button", docInfo.shortLabel, "cal-mat-btn is-doc-ready");
      docBtn.type = "button";
      docBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        triggerSessionTeachingDoc(docInfo, false);
      });
      matRow.appendChild(docBtn);
    } else {
      const docDisabled = make("button", "📘 เอกสารคำสอน (วันหยุด)", "cal-mat-btn is-disabled-slide");
      docDisabled.type = "button";
      docDisabled.disabled = true;
      docDisabled.setAttribute("aria-disabled", "true");
      matRow.appendChild(docDisabled);
    }

    if (slideRec && !isHol) {
      const slideBtn = make("button", `📊 Slide: ${slideRec.fileName || "เปิดดู"}`, "cal-mat-btn is-slide-ready");
      slideBtn.type = "button";
      slideBtn.title = `อัปโหลดโดย ${slideRec.uploadedBy || "อาจารย์"} (${slideRec.uploadedAt || ""})`;
      slideBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        hideCalendarHoverPopover();
        openSessionSlide(session.id);
      });
      matRow.appendChild(slideBtn);
    } else {
      const slideEmpty = make(
        "button",
        isHol ? "📊 Slide (งดคลาส)" : "📊 Slide (ยังไม่อัปโหลด)",
        "cal-mat-btn is-disabled-slide"
      );
      slideEmpty.type = "button";
      slideEmpty.disabled = true;
      slideEmpty.setAttribute("aria-disabled", "true");
      matRow.appendChild(slideEmpty);
    }

    pop.appendChild(matRow);

    const footRow = make("div", null, "cshp-foot");
    const detailBtn = make("button", "ดูรายละเอียดคาบเรียน →", "cshp-link-btn");
    detailBtn.type = "button";
    detailBtn.addEventListener("click", () => {
      hideCalendarHoverPopover();
      openEventModal(session);
    });
    footRow.appendChild(detailBtn);

    if (ROLE === "faculty" && !isHol) {
      const upQuickBtn = make("button", slideRec ? "🔄 อัปเดต Slide คาบนี้" : "⬆ อัปโหลด Slide คาบนี้", "cshp-upload-btn");
      upQuickBtn.type = "button";
      upQuickBtn.addEventListener("click", () => {
        hideCalendarHoverPopover();
        openFacultySlideStudioForSession(session.id);
      });
      footRow.appendChild(upQuickBtn);
    }

    pop.appendChild(footRow);
    pop.hidden = false;

    const rect = anchorEl.getBoundingClientRect();
    const popW = 340;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 820;
    let left = Math.max(12, Math.min(rect.left, vw - popW - 14));
    let top = rect.bottom + 8;
    if (top + 185 > vh && rect.top > 195) {
      top = Math.max(10, rect.top - 184);
    }
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }

  function getTeachableSlideSessions() {
    return (SCHED.sessions || []).filter(
      (s) => s.category !== "HOLIDAY" && s.code !== "TRAVEL" && s.code !== "RETURN"
    );
  }

  let pendingSlideFileObj = null;

  function openFacultySlideStudioForSession(sessionId) {
    if (ROLE !== "faculty") return;
    if (state.activeTab !== "schedule") {
      switchTab("schedule");
    }
    state.slideStudioOpen = true;
    renderFacultySlideUploadStudio(sessionId);
    const box = $("facultySlideStudioCard");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFacultySlideUploadStudio(preselectSessionId) {
    if (ROLE !== "faculty") return;
    const mount = $("facultySlideStudioMount");
    if (!mount) return;

    const toggleBtn = $("toggleSlideStudioBtn");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", state.slideStudioOpen ? "true" : "false");
    }

    if (!state.slideStudioOpen) {
      mount.replaceChildren();
      return;
    }

    const sessions = getTeachableSlideSessions();
    const reg = getSlidesRegistry();
    const uploadedCount = sessions.filter((s) => Boolean(reg[s.id] || s.slideUrl)).length;
    const selectedId =
      preselectSessionId ||
      (mount.querySelector("#slideTargetSessionSelect") && mount.querySelector("#slideTargetSessionSelect").value) ||
      (sessions[0] && sessions[0].id) ||
      "";

    const card = make("section", null, "slide-studio-card");
    card.id = "facultySlideStudioCard";

    const activeTeacherObj = getAllCourseTeachers().find((t) => t.key === state.myTeacherKey);
    const defaultUploader = activeTeacherObj ? activeTeacherObj.label : "";

    card.innerHTML = `
      <div class="slide-studio-head">
        <div>
          <h3>📊 สตูดิโออัปโหลด Slide ประกอบการสอนประจำคาบ (สำหรับคณาจารย์ผู้สอน)</h3>
          <p>เลือกคาบเรียนแล้วแนบไฟล์ Slide (<code>.pdf</code>, <code>.pptx</code>, <code>.key</code>) หรือวางลิงก์สไลด์ — เมื่อบันทึกแล้ว ปุ่ม Slide บนปฏิทิน (Hover) ทั้งฝั่งอาจารย์และนักศึกษาในเบราว์เซอร์จะเปลี่ยนจากสีเทาเป็นเปิดใช้งานทันที</p>
        </div>
        <div class="header-actions">
          <span class="badge cat-HS">อัปโหลดแล้ว ${uploadedCount} / ${sessions.length} คาบ</span>
          <button type="button" class="btn sm" id="closeSlideStudioBtn">ซ่อนแผงอัปโหลด ✕</button>
        </div>
      </div>
      <div class="slide-studio-grid">
        <div class="slide-form-pane">
          <div class="filter-field">
            <label for="slideTargetSessionSelect">1. เลือกคาบเรียนที่ต้องการอัปโหลด Slide</label>
            <select id="slideTargetSessionSelect"></select>
          </div>
          <div class="slide-dropzone" id="slideFileDropzone">
            <input type="file" id="slideFileInput" accept=".pdf,.ppt,.pptx,.key" hidden>
            <div><strong>📂 ลากไฟล์ Slide มาวางที่นี่</strong> หรือกดเลือกไฟล์จากเครื่อง (<code>.pdf</code>, <code>.pptx</code>, <code>.key</code>)</div>
            <button type="button" class="btn sm teal" id="pickSlideFileBtn">เลือกไฟล์ Slide จากเครื่อง…</button>
            <div id="slideSelectedFileBadge" class="slide-file-badge" hidden></div>
          </div>
          <div class="filter-field">
            <label for="slideExternalUrlInput">หรือวางลิงก์ Slide ออนไลน์ (Google Slides / Drive / Canva — ถ้ามี)</label>
            <input type="url" id="slideExternalUrlInput" placeholder="https://docs.google.com/presentation/d/... หรือลิงก์ไฟล์ PDF">
          </div>
          <div class="filter-field">
            <label for="slideUploaderInput">ชื่ออาจารย์ผู้อัปโหลด</label>
            <input type="text" id="slideUploaderInput" placeholder="เช่น อ.นพ.ฉัตรชัย อิ่มอารมย์" value="${escapeHtml(defaultUploader)}">
          </div>
          <div class="header-actions">
            <button type="button" class="btn primary" id="saveSessionSlideBtn">💾 บันทึก &amp; เปิดใช้งาน Slide ประจำคาบนี้</button>
          </div>
          <div id="slideStudioFeedback" class="slide-studio-feedback" hidden></div>
        </div>
        <div class="slide-status-pane">
          <div class="slide-status-toolbar">
            <strong>สถานะ Slide ประจำคาบเรียน (${sessions.length} คาบ)</strong>
            <input type="search" id="slideMatrixSearchInput" placeholder="กรองชื่อคาบ / รหัส HS, EP…">
          </div>
          <div class="slide-status-list" id="slideStatusMatrixList"></div>
        </div>
      </div>
    `;

    mount.replaceChildren(card);
    pendingSlideFileObj = null;

    const sel = $("slideTargetSessionSelect");
    sessions.forEach((s) => {
      const has = Boolean(getSessionSlideRecord(s.id));
      const opt = new Option(`${has ? "✓ " : "○ "}[${s.dateTH}] ${s.code}: ${s.title.slice(0, 58)}`, s.id);
      sel.add(opt);
    });
    if (selectedId) sel.value = selectedId;

    const syncSelectedSlideFields = () => {
      const rec = getSessionSlideRecord(sel.value);
      if ($("slideExternalUrlInput")) $("slideExternalUrlInput").value = (rec && rec.externalUrl) || "";
      if ($("slideUploaderInput") && rec && rec.uploadedBy) $("slideUploaderInput").value = rec.uploadedBy;
      pendingSlideFileObj = null;
      const fBadge = $("slideSelectedFileBadge");
      if (fBadge) {
        if (rec && rec.fileName && !rec.externalUrl) {
          fBadge.hidden = false;
          fBadge.textContent = `ไฟล์ปัจจุบัน: ${rec.fileName} (${rec.sizeLabel || "บันทึกแล้ว"})`;
        } else {
          fBadge.hidden = true;
        }
      }
    };
    sel.addEventListener("change", syncSelectedSlideFields);
    syncSelectedSlideFields();

    $("closeSlideStudioBtn").addEventListener("click", () => {
      state.slideStudioOpen = false;
      renderFacultySlideUploadStudio();
    });

    const fileInput = $("slideFileInput");
    const dropzone = $("slideFileDropzone");
    const handleChosenSlideFile = (f) => {
      if (!f) return;
      pendingSlideFileObj = f;
      const fBadge = $("slideSelectedFileBadge");
      if (fBadge) {
        fBadge.hidden = false;
        fBadge.textContent = `✓ เลือกไฟล์พร้อมอัปโหลด: ${f.name} (${formatFileSize(f.size)})`;
      }
    };
    $("pickSlideFileBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) handleChosenSlideFile(fileInput.files[0]);
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleChosenSlideFile(e.dataTransfer.files[0]);
      }
    });

    $("saveSessionSlideBtn").addEventListener("click", async () => {
      const targetSid = sel.value;
      const extUrl = (($("slideExternalUrlInput") && $("slideExternalUrlInput").value) || "").trim();
      const uploader = (($("slideUploaderInput") && $("slideUploaderInput").value) || "").trim() || "อาจารย์ผู้สอน";
      const fb = $("slideStudioFeedback");

      if (!pendingSlideFileObj && !extUrl) {
        if (fb) {
          fb.hidden = false;
          fb.className = "slide-studio-feedback is-error";
          fb.textContent = "กรุณาเลือกไฟล์ Slide (.pdf / .pptx) หรือวางลิงก์ Slide ออนไลน์อย่างน้อย 1 อย่าง";
        }
        return;
      }

      let storedMeta = {
        sessionId: targetSid,
        fileName: pendingSlideFileObj ? pendingSlideFileObj.name : "Slide ออนไลน์",
        mime: pendingSlideFileObj ? pendingSlideFileObj.type : "",
        sizeLabel: pendingSlideFileObj ? formatFileSize(pendingSlideFileObj.size) : "ลิงก์ออนไลน์",
        externalUrl: extUrl,
        dataUrl: "",
        uploadedBy: uploader,
        uploadedAt: new Date().toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
      };

      if (pendingSlideFileObj) {
        const binRes = await saveSlideBinaryToIdb(targetSid, pendingSlideFileObj);
        storedMeta.dataUrl = binRes.dataUrl || "";
      }

      const nextReg = Object.assign({}, getSlidesRegistry());
      nextReg[targetSid] = storedMeta;
      persistSlidesRegistry(nextReg);

      renderScheduleCurrent();
      renderFacultySlideUploadStudio(targetSid);
      const fbAfter = $("slideStudioFeedback");
      if (fbAfter) {
        fbAfter.hidden = false;
        fbAfter.className = "slide-studio-feedback is-ok";
        fbAfter.textContent = `✓ อัปโหลดและเปิดใช้งาน Slide "${storedMeta.fileName}" เรียบร้อยแล้ว! (Hover บนปฏิทินเพื่อทดสอบเปิดได้ทันที)`;
      }
    });

    const renderMatrixRows = () => {
      const listEl = $("slideStatusMatrixList");
      const q = (($("slideMatrixSearchInput") && $("slideMatrixSearchInput").value) || "").trim().toLocaleLowerCase("th");
      if (!listEl) return;
      listEl.replaceChildren();

      sessions
        .filter((s) => !q || `${s.code} ${s.title} ${s.dateTH} ${s.lecturers}`.toLocaleLowerCase("th").includes(q))
        .forEach((s) => {
          const rec = getSessionSlideRecord(s.id);
          const row = make("div", null, `slide-matrix-row${rec ? " is-uploaded" : " is-pending"}`);
          const info = make("div", null, "slide-matrix-info");
          info.innerHTML = `
            <strong>${escapeHtml(s.code)} · ${escapeHtml(s.title)}</strong>
            <small>${escapeHtml(s.dateTH)} (${escapeHtml(s.timeLabel)})${rec ? ` · ✓ ${escapeHtml(rec.fileName)} โดย ${escapeHtml(rec.uploadedBy || "")}` : " · ยังไม่ได้อัปโหลด Slide"}</small>
          `;
          const acts = make("div", null, "slide-matrix-acts");
          if (rec) {
            const openBtn = make("button", "📊 เปิดดู", "btn sm teal");
            openBtn.type = "button";
            openBtn.addEventListener("click", () => openSessionSlide(s.id));
            const delBtn = make("button", "ลบ", "btn sm");
            delBtn.type = "button";
            delBtn.addEventListener("click", async () => {
              const nr = Object.assign({}, getSlidesRegistry());
              delete nr[s.id];
              persistSlidesRegistry(nr);
              await deleteSlideBinaryFromIdb(s.id);
              renderScheduleCurrent();
              renderFacultySlideUploadStudio(s.id);
            });
            acts.append(openBtn, delBtn);
          } else {
            const pickThisBtn = make("button", "⬆ เลือกคาบนี้", "btn sm");
            pickThisBtn.type = "button";
            pickThisBtn.addEventListener("click", () => {
              sel.value = s.id;
              syncSelectedSlideFields();
              $("pickSlideFileBtn").click();
            });
            acts.appendChild(pickThisBtn);
          }
          row.append(info, acts);
          listEl.appendChild(row);
        });
    };

    $("slideMatrixSearchInput").addEventListener("input", renderMatrixRows);
    renderMatrixRows();
  }

  function initSlideStudioAndCalendarHover() {
    ensureCalendarHoverPopover();
    const schedPanel = $("panel-schedule");
    if (schedPanel) {
      schedPanel.addEventListener("mouseover", (ev) => {
        const chip = ev.target && ev.target.closest ? ev.target.closest("[data-cal-session-id]") : null;
        if (!chip) return;
        showCalendarHoverPopover(chip, chip.dataset.calSessionId);
      });
      schedPanel.addEventListener("mouseout", (ev) => {
        const chip = ev.target && ev.target.closest ? ev.target.closest("[data-cal-session-id]") : null;
        if (!chip) return;
        const related = ev.relatedTarget;
        if (related && (chip.contains(related) || (related.closest && related.closest("#calendarSessionHoverPopover")))) {
          return;
        }
        calHoverHideTimer = setTimeout(hideCalendarHoverPopover, 210);
      });
    }

    window.addEventListener(
      "scroll",
      () => {
        hideCalendarHoverPopover();
      },
      { passive: true }
    );

    if (ROLE === "faculty") {
      const toggleBtn = $("toggleSlideStudioBtn");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          state.slideStudioOpen = !state.slideStudioOpen;
          renderFacultySlideUploadStudio();
        });
      }
      const topQuickSlide = $("facQuickSlideTopBtn");
      if (topQuickSlide) {
        topQuickSlide.addEventListener("click", () => {
          openFacultySlideStudioForSession();
        });
      }
    }
  }

  /* ---------- Universal Top-Bar Omnibox Keyword Search (ค้นหาได้ทุกอย่างตาม Keyword) ---------- */
  function stripHtmlToPlain(htmlStr) {
    return String(htmlStr || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#>*_`~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractKeywordSnippet(plainText, qLower) {
    const lower = plainText.toLocaleLowerCase("th");
    const idx = lower.indexOf(qLower);
    if (idx < 0) return plainText.slice(0, 95);
    const start = Math.max(0, idx - 34);
    const end = Math.min(plainText.length, idx + qLower.length + 58);
    return (start > 0 ? "…" : "") + plainText.slice(start, end).trim() + (end < plainText.length ? "…" : "");
  }

  function highlightKeywordHtml(text, rawQuery) {
    const safe = escapeHtml(text || "");
    const q = String(rawQuery || "").trim();
    if (!q) return safe;
    try {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return safe.replace(new RegExp(`(${escapedQ})`, "ig"), "<mark>$1</mark>");
    } catch (_) {
      return safe;
    }
  }

  function collectUniversalKeywordMatches(rawQuery) {
    const q = String(rawQuery || "").trim().toLocaleLowerCase("th");
    if (!q) return [];
    const results = [];

    // 1. Quick Portal Actions (Leave Form, Slide Upload, SRN, Map)
    const quickTools = [
      {
        cat: "เครื่องมือด่วน & แบบฟอร์ม",
        icon: "📝",
        title: "แบบฟอร์มใบลากิจ / ใบลาป่วย นศพ. (กรอก · เซ็นลายเซ็น · Export PDF)",
        sub: "ยื่นใบลาพร้อมแจ้งเตือนอาจารย์ประจำกลุ่มและประธานรายวิชาอัตโนมัติ",
        hay: "ใบลา ลากิจ ลาป่วย ขาดเรียน เซ็นลายเซ็น ใบรับรองแพทย์ leave form pdf",
        run: () => switchTab("leave")
      },
      {
        cat: "เครื่องมือด่วน & แบบฟอร์ม",
        icon: "📤",
        title: "ศูนย์การส่งงาน SRN 1 · SRN 2 · สไลด์ภาคสนาม & Health Survey",
        sub: "ตรวจไฟล์ PDF ไม่เกิน 5 หน้า A4 และตั้งชื่อไฟล์มาตรฐานอัตโนมัติ",
        hay: "ส่งงาน srn self reflection note health survey สไลด์ e-learning moodle",
        run: () => switchTab("submissions")
      },
      {
        cat: "เครื่องมือด่วน & แบบฟอร์ม",
        icon: "🗺",
        title: "แผนที่ประเทศไทย 9 พื้นที่ภาคสนาม (Hover ดูข้อมูล รพช. & สมาชิก)",
        sub: "สำรวจตำแหน่งโรงพยาบาลชุมชนทั่วประเทศและอาจารย์ที่ปรึกษา",
        hay: "แผนที่ ประเทศไทย ภาคสนาม โรงพยาบาลชุมชน รพช map",
        run: () => {
          state.fieldOverviewStyle = "map";
          switchTab("fieldwork");
        }
      }
    ];
    if (ROLE === "faculty") {
      quickTools.unshift({
        cat: "เครื่องมือด่วน & แบบฟอร์ม",
        icon: "📊",
        title: "สตูดิโออัปโหลด Slide ประกอบการสอนประจำคาบ",
        sub: "แนบไฟล์ .pdf / .pptx หรือลิงก์สไลด์เพื่อให้แสดงบน Hover ปฏิทินทันที",
        hay: "slide สไลด์ อัปโหลด upload สื่อการสอน ppt pdf",
        run: () => openFacultySlideStudioForSession()
      });
    }
    quickTools.forEach((t) => {
      if (`${t.title} ${t.sub} ${t.hay}`.toLocaleLowerCase("th").includes(q)) {
        results.push(t);
      }
    });

    // 2. Students (169)
    let stuCount = 0;
    for (const s of ROSTER.students || []) {
      if (stuCount >= 6) break;
      const hay = `${s.id} ${s.fullName} ${s.nickname || ""} ${s.area} discussion ${s.disc}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        stuCount++;
        results.push({
          cat: "นักศึกษาแพทย์ (169 คน)",
          icon: "🎓",
          title: `${s.id} · ${s.fullName}${s.nickname ? ` (${s.nickname})` : ""}`,
          sub: `กลุ่มพื้นที่ ${s.area} · Discussion กลุ่ม ${s.disc} · อ.${s.advisor}`,
          studentObj: s,
          run: () => {
            state.calScope = "student";
            applyMyStudent(s, true);
          },
          secondaryLabel: "ดูโปรไฟล์",
          secondaryRun: () => openStudentQuickModal(s)
        });
      }
    }

    // 3. Fieldwork Sites (9) & Discussion Groups (6)
    (SCHED.fieldworkSites || []).forEach((site) => {
      const hay = `${site.shortName} ${site.hospital} ${site.province} ${site.advisors} ${site.room}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        results.push({
          cat: "กลุ่มพื้นที่ภาคสนาม & Discussion",
          icon: "🏥",
          title: `กลุ่มพื้นที่ ${site.shortName} (${site.hospital} ${site.province})`,
          sub: `สมาชิก ${site.count} คน · ห้องกลุ่มย่อย ${site.room.split(" ")[0]} · อ.ที่ปรึกษา: ${site.advisors}`,
          run: () => {
            if ($("fieldAreaSelect")) $("fieldAreaSelect").value = site.shortName;
            state.mapHoverSite = site.shortName;
            switchTab("fieldwork");
          }
        });
      }
    });
    (SCHED.hsGroups || []).forEach((g) => {
      const hay = `discussion กลุ่ม ${g.id} ${g.defaultRoom}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        results.push({
          cat: "กลุ่มพื้นที่ภาคสนาม & Discussion",
          icon: "💬",
          title: `กลุ่มอภิปราย Discussion ที่ ${g.id} (${g.count} คน)`,
          sub: `ห้องเรียนหลัก ${g.defaultRoom}`,
          run: () => {
            if ($("discGroupSelect")) $("discGroupSelect").value = String(g.id);
            switchTab("discussion");
          }
        });
      }
    });

    // 4. Course Teachers (20)
    let teachCount = 0;
    for (const t of getAllCourseTeachers()) {
      if (teachCount >= 4) break;
      if (`${t.label} ${t.key}`.toLocaleLowerCase("th").includes(q)) {
        teachCount++;
        results.push({
          cat: "คณาจารย์ผู้สอน",
          icon: "👨‍⚕️",
          title: t.label,
          sub: "คลิกเพื่อกรองตารางคาบสอนและห้องคุมกลุ่มย่อยของอาจารย์ท่านนี้",
          run: () => {
            selectActiveTeacher(t.key, true);
            switchTab("schedule");
          }
        });
      }
    }

    // 5. Schedule Sessions (Calendar / Topics / Rooms / Zoom)
    let sessCount = 0;
    for (const s of SCHED.sessions || []) {
      if (sessCount >= 6) break;
      if (ROLE === "student" && s.studentVisible === false) continue;
      const hay = `${s.code} ${s.title} ${s.objectives || ""} ${s.lecturers || ""} ${s.room || ""} ${s.dateTH} ${s.zoom ? "zoom " + s.zoom.id : ""}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        sessCount++;
        results.push({
          cat: "ปฏิทิน & คาบเรียน",
          icon: "📅",
          title: `[${s.code}] ${s.title}`,
          sub: `${s.dateTH} (${s.timeLabel}) · ห้อง ${s.room || "—"}`,
          run: () => {
            switchTab("schedule");
            openEventModal(s);
          }
        });
      }
    }

    // 6. Health Systems Study Materials (HS1-HS6 Full-Text Search!)
    let tbCount = 0;
    for (const doc of HS.docs || []) {
      if (tbCount >= 6) break;
      const plain = doc._plainCache || (doc._plainCache = stripHtmlToPlain(doc.html || doc.markdown || ""));
      const titleHay = `${doc.id} ${doc.code || ""} ${doc.title} ${doc.subtitle || ""}`.toLocaleLowerCase("th");
      const bodyLower = plain.toLocaleLowerCase("th");
      if (titleHay.includes(q) || bodyLower.includes(q)) {
        tbCount++;
        results.push({
          cat: "เอกสารประกอบการสอบ Health Systems (HS1–HS6)",
          icon: "📘",
          title: `${doc.id}: ${doc.title}`,
          sub: extractKeywordSnippet(plain, q),
          run: () => openTextbookDoc(doc.id)
        });
      }
    }

    // 7. Course Manual 2569 (Full-Text Search across 17 Chapters & Appendix!)
    let manCount = 0;
    for (const ch of MANUAL.chapters || []) {
      if (manCount >= 5) break;
      const plain = ch._plainCache || (ch._plainCache = stripHtmlToPlain(ch.html || ""));
      if (`${ch.title}`.toLocaleLowerCase("th").includes(q) || plain.toLocaleLowerCase("th").includes(q)) {
        manCount++;
        results.push({
          cat: "คู่มือรายวิชา 2569",
          icon: "📖",
          title: ch.title,
          sub: extractKeywordSnippet(plain, q),
          run: () => {
            state.manualChapterId = ch.id;
            if ($("manualSearchInput")) $("manualSearchInput").value = rawQuery.trim();
            switchTab("manual");
          }
        });
      }
    }

    // 8. Glossary (111 Terms), Rapid Review & Practice Self-Check Q&A (82 Items)
    let pracCount = 0;
    for (const g of HS.glossary || []) {
      if (pracCount >= 4) break;
      const hay = `${g.termFull || ""} ${g.termEN || ""} ${g.termTH || ""} ${g.definition || ""} ${g.module || ""}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        pracCount++;
        results.push({
          cat: "คำศัพท์สำคัญ & โจทย์ทบทวน",
          icon: "🧠",
          title: `${g.termFull || g.termEN || g.termTH} (${g.module || "HS"})`,
          sub: String(g.definition || "").slice(0, 98),
          run: () => {
            state.practiceSub = "flashcards";
            if ($("practiceModuleFilter")) $("practiceModuleFilter").value = "";
            if ($("practiceSearchInput")) $("practiceSearchInput").value = g.termEN || g.termTH || rawQuery.trim();
            switchTab("practice");
          }
        });
      }
    }
    for (const rr of HS.rapidReview || []) {
      if (pracCount >= 6) break;
      const plain = rr._plainCache || (rr._plainCache = stripHtmlToPlain(rr.html || ""));
      if (`${rr.module} ${rr.moduleTitle || ""}`.toLocaleLowerCase("th").includes(q) || plain.toLocaleLowerCase("th").includes(q)) {
        pracCount++;
        results.push({
          cat: "คำศัพท์สำคัญ & โจทย์ทบทวน",
          icon: "⚡",
          title: `[Rapid Review ${rr.module}] ${rr.moduleTitle || ""}`,
          sub: extractKeywordSnippet(plain, q),
          run: () => {
            state.practiceSub = "rapid";
            if ($("practiceModuleFilter")) $("practiceModuleFilter").value = rr.module || "";
            if ($("practiceSearchInput")) $("practiceSearchInput").value = rawQuery.trim();
            switchTab("practice");
          }
        });
      }
    }
    for (const qa of HS.selfCheck || []) {
      if (pracCount >= 9) break;
      const ansPlain = qa._plainCache || (qa._plainCache = stripHtmlToPlain(qa.answerHtml || qa.answer || ""));
      const hay = `${qa.question || ""} ${ansPlain} ${qa.module || ""}`.toLocaleLowerCase("th");
      if (hay.includes(q)) {
        pracCount++;
        results.push({
          cat: "คำศัพท์สำคัญ & โจทย์ทบทวน",
          icon: "❓",
          title: `[โจทย์ ${qa.module || "HS"}] ${String(qa.question || "").slice(0, 80)}`,
          sub: extractKeywordSnippet(ansPlain, q),
          run: () => {
            state.practiceSub = "qa";
            if ($("practiceModuleFilter")) $("practiceModuleFilter").value = "";
            if ($("practiceSearchInput")) $("practiceSearchInput").value = rawQuery.trim();
            switchTab("practice");
          }
        });
      }
    }

    // 9. Discussion Health Systems 10 Case Scenarios (HS1-HS6)
    let hsdCount = 0;
    for (const cs of HSD_DATA.cases || []) {
      if (hsdCount >= 4) break;
      const plain =
        cs._plainCache ||
        (cs._plainCache = stripHtmlToPlain(
          `${cs.title || ""} ${cs.subtitle || ""} ${(cs.frameworks || []).join(" ")} ${JSON.stringify(cs.scenarioBlocks || [])} ${JSON.stringify(cs.questions || [])}`
        ));
      if (plain.toLocaleLowerCase("th").includes(q)) {
        hsdCount++;
        results.push({
          cat: "กรณีศึกษา Discussion ระบบสุขภาพ (HS1–HS6)",
          icon: "🧩",
          title: `[${cs.module} · กรณีที่ ${cs.caseNumber}] ${cs.title}`,
          sub: extractKeywordSnippet(plain, q),
          run: () => {
            state.hsdModule = cs.module || "ALL";
            if ($("hsdModuleSelect")) $("hsdModuleSelect").value = state.hsdModule;
            if ($("hsdSearchInput")) $("hsdSearchInput").value = rawQuery.trim();
            switchTab("hs-discussion");
          }
        });
      }
    }

    return results;
  }

  function initUniversalOmniboxSearch() {
    const input = $("personalStudentInput");
    const dropdown = $("universalOmniboxDropdown");
    const wrap = $("universalOmniboxWrap");
    if (!input || !dropdown) return;

    let activeIdx = -1;
    let currentItems = [];

    const closeDropdown = () => {
      dropdown.hidden = true;
      activeIdx = -1;
    };

    const renderOmnibox = () => {
      const raw = input.value.trim();
      // Ignore formatted student banner value unless actively typing something else
      if (!raw || (state.myStudent && raw === `${state.myStudent.id} — ${state.myStudent.fullName}` && document.activeElement !== input)) {
        closeDropdown();
        return;
      }

      currentItems = collectUniversalKeywordMatches(raw);
      dropdown.replaceChildren();

      if (!currentItems.length) {
        const empty = make("div", `ไม่พบผลลัพธ์สำหรับ "${raw}" — ลองค้นหาด้วยคำสำคัญอื่น เช่น HS2, กุฉินารายณ์, Capitation, ใบลา, SRN`, "omnibox-empty");
        dropdown.appendChild(empty);
        dropdown.hidden = false;
        return;
      }

      let lastCat = "";
      currentItems.forEach((item, idx) => {
        if (item.cat !== lastCat) {
          lastCat = item.cat;
          dropdown.appendChild(make("div", item.cat, "omnibox-cat-header"));
        }
        const row = make("div", null, `omnibox-item${idx === activeIdx ? " is-active" : ""}`);
        row.dataset.omniIdx = String(idx);

        const mainBtn = make("button", null, "omnibox-main-btn");
        mainBtn.type = "button";
        mainBtn.innerHTML = `
          <span class="omni-icon">${item.icon || "🔎"}</span>
          <span class="omni-text">
            <strong>${highlightKeywordHtml(item.title, raw)}</strong>
            <small>${highlightKeywordHtml(item.sub, raw)}</small>
          </span>
        `;
        mainBtn.addEventListener("click", () => {
          closeDropdown();
          item.run();
        });
        row.appendChild(mainBtn);

        if (item.secondaryRun) {
          const secBtn = make("button", item.secondaryLabel || "ดูข้อมูล", "btn sm omnibox-sec-btn");
          secBtn.type = "button";
          secBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            closeDropdown();
            item.secondaryRun();
          });
          row.appendChild(secBtn);
        }

        dropdown.appendChild(row);
      });

      dropdown.hidden = false;
    };

    input.addEventListener("input", () => {
      activeIdx = 0;
      renderOmnibox();
    });

    input.addEventListener("focus", () => {
      if (input.value.trim() && !(state.myStudent && input.value.trim() === `${state.myStudent.id} — ${state.myStudent.fullName}`)) {
        renderOmnibox();
      }
    });

    input.addEventListener("keydown", (ev) => {
      if (dropdown.hidden || !currentItems.length) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        activeIdx = (activeIdx + 1) % currentItems.length;
        renderOmnibox();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        activeIdx = (activeIdx - 1 + currentItems.length) % currentItems.length;
        renderOmnibox();
      } else if (ev.key === "Enter") {
        if (activeIdx >= 0 && currentItems[activeIdx]) {
          ev.preventDefault();
          const chosen = currentItems[activeIdx];
          closeDropdown();
          chosen.run();
        }
      } else if (ev.key === "Escape") {
        closeDropdown();
      }
    });

    document.addEventListener("click", (ev) => {
      if (wrap && !wrap.contains(ev.target)) {
        closeDropdown();
      }
    });
  }

  /* ---------- Digital Leave Form, Drawing Signature Pad, Advisor/Course Director Notification & PDF Export ---------- */
  const LEAVE_STORAGE_KEY = "racm303_leave_requests_v1";
  const COURSE_DIRECTOR_NAME = "อ.นพ.ณัฐวุฒิ เอี่ยงธนรัตน์";
  const FACULTY_PORTAL_LEAVE_URL = "https://smartwoo.github.io/racm303-2569-faculty/#leave";

  function loadLeaveRequests() {
    try {
      const arr = JSON.parse(localStorage.getItem(LEAVE_STORAGE_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveLeaveRequests(list) {
    try {
      localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
    syncLeaveNotificationBadges();
    broadcastPortalSync("leave_updated", { count: list.length });
  }

  function ingestIncomingLeavePayloadFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("incoming_leave");
      if (!raw) return null;
      const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (decoded && decoded.refId) {
        const list = loadLeaveRequests();
        if (!list.some((x) => x.refId === decoded.refId)) {
          list.unshift(decoded);
          saveLeaveRequests(list);
        }
        return decoded;
      }
    } catch (_) {}
    return null;
  }

  function encodeLeavePayloadForCrossPortalUrl(rec) {
    try {
      const slim = Object.assign({}, rec, {
        // Keep signature data URL compact enough for cross-tab handoff if needed
        attachmentDataUrl: ""
      });
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
      return `https://smartwoo.github.io/racm303-2569-faculty/?incoming_leave=${encodeURIComponent(b64)}#leave`;
    } catch (_) {
      return FACULTY_PORTAL_LEAVE_URL;
    }
  }

  function syncLeaveNotificationBadges() {
    const list = loadLeaveRequests();
    const pending = list.filter((r) => r.status === "pending");
    const navBadge = $("leaveNavCountBadge");
    const topFacBadge = $("facTopLeaveBadge");

    if (ROLE === "faculty") {
      const relevant = state.myTeacherKey
        ? pending.filter(
            (r) =>
              String(r.groupAdvisors || "").includes(state.myTeacherKey) ||
              COURSE_DIRECTOR_NAME.includes(state.myTeacherKey)
          )
        : pending;
      if (navBadge) {
        navBadge.textContent = relevant.length > 0 ? `🔔 ${relevant.length} รออนุมัติ` : `${list.length} รายการ`;
      }
      if (topFacBadge) {
        topFacBadge.hidden = relevant.length === 0;
        topFacBadge.textContent = String(relevant.length);
      }
    } else {
      const mine = state.myStudent ? list.filter((r) => r.studentId === state.myStudent.id) : list;
      if (navBadge) {
        navBadge.textContent = mine.length > 0 ? `${mine.length} ใบลา` : "เซ็นออนไลน์";
      }
    }
  }

  function createSignaturePadController(canvas, opts = {}) {
    if (!canvas || !canvas.getContext) {
      return {
        isEmpty: () => false,
        clear: () => {},
        undo: () => {},
        setInk: () => {},
        toDataURL: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      };
    }
    const ctx2d = canvas.getContext("2d");
    const strokes = [];
    let currentStroke = null;
    let inkColor = opts.initialInk || "#1d4ed8";
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const logicalW = opts.width || 520;
    const logicalH = opts.height || 165;

    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    if (ctx2d && ctx2d.scale) ctx2d.scale(dpr, dpr);

    const redrawAll = () => {
      if (!ctx2d) return;
      ctx2d.clearRect(0, 0, logicalW, logicalH);
      // Subtle baseline guide
      ctx2d.save();
      ctx2d.strokeStyle = "rgba(148, 163, 184, 0.35)";
      ctx2d.setLineDash([4, 4]);
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(24, logicalH - 32);
      ctx2d.lineTo(logicalW - 24, logicalH - 32);
      ctx2d.stroke();
      ctx2d.restore();

      strokes.forEach((st) => {
        if (!st.points.length) return;
        ctx2d.save();
        ctx2d.strokeStyle = st.color;
        ctx2d.lineWidth = 2.4;
        ctx2d.lineCap = "round";
        ctx2d.lineJoin = "round";
        ctx2d.beginPath();
        ctx2d.moveTo(st.points[0].x, st.points[0].y);
        for (let i = 1; i < st.points.length; i++) {
          const prev = st.points[i - 1];
          const cur = st.points[i];
          const mx = (prev.x + cur.x) / 2;
          const my = (prev.y + cur.y) / 2;
          ctx2d.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        const last = st.points[st.points.length - 1];
        ctx2d.lineTo(last.x, last.y);
        ctx2d.stroke();
        ctx2d.restore();
      });
      if (typeof opts.onChange === "function") opts.onChange();
    };

    const getPoint = (ev) => {
      const r = canvas.getBoundingClientRect();
      const scaleX = r.width ? logicalW / r.width : 1;
      const scaleY = r.height ? logicalH / r.height : 1;
      const clientX = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
      return {
        x: (clientX - r.left) * scaleX,
        y: (clientY - r.top) * scaleY
      };
    };

    const startDraw = (ev) => {
      ev.preventDefault();
      if (canvas.setPointerCapture && ev.pointerId !== undefined) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
      }
      currentStroke = { color: inkColor, points: [getPoint(ev)] };
      strokes.push(currentStroke);
      redrawAll();
    };
    const moveDraw = (ev) => {
      if (!currentStroke) return;
      ev.preventDefault();
      currentStroke.points.push(getPoint(ev));
      redrawAll();
    };
    const endDraw = () => {
      if (!currentStroke) return;
      currentStroke = null;
      redrawAll();
    };

    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", moveDraw);
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    redrawAll();

    return {
      isEmpty: () => strokes.length === 0,
      clear: () => {
        strokes.length = 0;
        redrawAll();
      },
      undo: () => {
        strokes.pop();
        redrawAll();
      },
      setInk: (c) => {
        inkColor = c;
      },
      markSyntheticSignature: (pts) => {
        strokes.push({ color: inkColor, points: pts || [{ x: 60, y: 90 }, { x: 180, y: 75 }, { x: 260, y: 95 }] });
        redrawAll();
      },
      toDataURL: () => {
        if (!ctx2d || typeof canvas.toDataURL !== "function") return "";
        // Export clean transparent PNG without the dashed baseline!
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ex = exportCanvas.getContext("2d");
        if (ex) {
          if (ex.scale) ex.scale(dpr, dpr);
          strokes.forEach((st) => {
            if (!st.points.length) return;
            ex.strokeStyle = st.color;
            ex.lineWidth = 2.5;
            ex.lineCap = "round";
            ex.lineJoin = "round";
            ex.beginPath();
            ex.moveTo(st.points[0].x, st.points[0].y);
            for (let i = 1; i < st.points.length; i++) {
              const p0 = st.points[i - 1];
              const p1 = st.points[i];
              ex.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
            }
            ex.stroke();
          });
          return exportCanvas.toDataURL("image/png");
        }
        return canvas.toDataURL("image/png");
      }
    };
  }

  function buildAffectedSessionsBetween(startISO, endISO, areaShortName) {
    if (!startISO) return [];
    const sDate = startISO;
    const eDate = endISO && endISO >= startISO ? endISO : startISO;
    const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaShortName) || null;
    return (SCHED.sessions || []).filter((s) => {
      if (s.category === "HOLIDAY" || (ROLE === "student" && s.studentVisible === false)) return false;
      const d1 = s.dateISO;
      const d2 = s.endDateISO || s.dateISO;
      if (!d1) return false;
      if (d2 < sDate || d1 > eDate) return false;
      if (s.allowedSites && siteObj && !s.allowedSites.includes(siteObj.id)) return false;
      return true;
    });
  }

  function buildBinaryPdfFromJpegDataUrl(jpegDataUrl, fallbackTitle) {
    // Standards-compliant single-page A4 %PDF-1.4 wrapping a high-DPI rendered JPEG image (or clean text fallback in headless VM)
    const pageW = 595.28;
    const pageH = 841.89;
    const prefix = "data:image/jpeg;base64,";

    if (jpegDataUrl && jpegDataUrl.startsWith(prefix)) {
      const b64 = jpegDataUrl.slice(prefix.length);
      const binStr = atob(b64);
      const imgBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);

      // Parse JPEG SOF0/SOF2 dimensions or default to 1240x1754
      let imgW = 1240;
      let imgH = 1754;
      for (let i = 0; i < imgBytes.length - 9; i++) {
        if (imgBytes[i] === 0xff && (imgBytes[i + 1] === 0xc0 || imgBytes[i + 1] === 0xc2)) {
          imgH = (imgBytes[i + 5] << 8) | imgBytes[i + 6];
          imgW = (imgBytes[i + 7] << 8) | imgBytes[i + 8];
          break;
        }
      }

      const enc = new TextEncoder();
      const chunks = [];
      const offsets = [0];
      let byteLen = 0;
      const pushStr = (s) => {
        const b = enc.encode(s);
        chunks.push(b);
        byteLen += b.length;
      };
      const pushBin = (b) => {
        chunks.push(b);
        byteLen += b.length;
      };

      pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
      offsets.push(byteLen);
      pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
      offsets.push(byteLen);
      pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
      offsets.push(byteLen);
      pushStr(
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
      );
      offsets.push(byteLen);
      pushStr(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
      );
      pushBin(imgBytes);
      pushStr("\nendstream\nendobj\n");

      const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
      offsets.push(byteLen);
      pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

      const xrefStart = byteLen;
      pushStr("xref\n0 6\n0000000000 65535 f \n");
      for (let i = 1; i <= 5; i++) {
        pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
      }
      pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

      const out = new Uint8Array(byteLen);
      let pos = 0;
      chunks.forEach((c) => {
        out.set(c, pos);
        pos += c.length;
      });
      return out;
    }

    // Minimal valid %PDF-1.4 fallback when running in headless test environments
    const safeAscii = String(fallbackTitle || "RACM 303 Leave Form").replace(/[^\x20-\x7E]/g, " ");
    const stream = `BT /F1 14 Tf 50 780 Td (${safeAscii}) Tj ET`;
    const pdfTxt =
      "%PDF-1.4\n" +
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n" +
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n" +
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n` +
      "trailer << /Root 1 0 R >>\n%%EOF\n";
    return new TextEncoder().encode(pdfTxt);
  }

  async function renderLeaveRecordToA4Jpeg(rec) {
    const c = document.createElement("canvas");
    c.width = 1240;
    c.height = 1754;
    const g = c.getContext && c.getContext("2d");
    if (!g || typeof c.toDataURL !== "function") return "";

    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);

    // Outer formal border
    g.strokeStyle = "#1e3a5f";
    g.lineWidth = 3;
    g.strokeRect(56, 56, c.width - 112, c.height - 112);

    // Header band
    g.fillStyle = "#f0f5fb";
    g.fillRect(59, 59, c.width - 118, 146);
    g.fillStyle = "#0f2942";
    g.font = "bold 30px Sarabun, sans-serif";
    g.textAlign = "center";
    g.fillText("แบบฟอร์มใบลากิจ – ใบลาป่วย นักศึกษาแพทย์ชั้นปีที่ 3 (ปีการศึกษา 2569)", c.width / 2, 112);
    g.font = "600 22px Sarabun, sans-serif";
    g.fillStyle = "#1e4976";
    g.fillText("รายวิชา RACM 303 เวชศาสตร์ชุมชน 1 · ภาควิชาเวชศาสตร์ชุมชน คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี", c.width / 2, 152);
    g.font = "18px Sarabun, sans-serif";
    g.fillStyle = "#475569";
    g.fillText(`เลขที่อ้างอิง: ${rec.refId || "DRAFT"}   |   วันที่ยื่นใบลา: ${rec.submittedAtTH || "-"}`, c.width / 2, 186);

    g.textAlign = "left";
    let y = 256;
    const leftX = 96;
    const maxW = c.width - 192;

    const drawFieldLine = (label, val) => {
      g.font = "bold 21px Sarabun, sans-serif";
      g.fillStyle = "#0f2942";
      g.fillText(label, leftX, y);
      const lw = g.measureText(label).width + 12;
      g.font = "21px Sarabun, sans-serif";
      g.fillStyle = "#1e293b";
      g.fillText(String(val || "-"), leftX + lw, y);
      y += 42;
    };

    const drawWrappedParagraph = (label, text) => {
      g.font = "bold 21px Sarabun, sans-serif";
      g.fillStyle = "#0f2942";
      g.fillText(label, leftX, y);
      y += 34;
      g.font = "20px Sarabun, sans-serif";
      g.fillStyle = "#1e293b";
      const words = String(text || "-").split(/\s+/);
      let line = "";
      words.forEach((w) => {
        const test = line ? `${line} ${w}` : w;
        if (g.measureText(test).width > maxW && line) {
          g.fillText(line, leftX + 16, y);
          line = w;
          y += 32;
        } else {
          line = test;
        }
      });
      if (line) {
        g.fillText(line, leftX + 16, y);
        y += 38;
      }
    };

    drawFieldLine("เรียน:", `ประธานรายวิชา RACM 303 (${COURSE_DIRECTOR_NAME}) และอาจารย์ที่ปรึกษาประจำกลุ่ม (${rec.groupAdvisors || "-"})`);
    drawFieldLine("ข้าพเจ้า (นศพ.):", `${rec.studentName || "-"}   รหัสนักศึกษา: ${rec.studentId || "-"}`);
    drawFieldLine("สังกัดกลุ่มเรียน:", `กลุ่มพื้นที่ภาคสนาม: ${rec.areaGroup || "-"}   |   กลุ่มอภิปราย Discussion ที่ ${rec.discGroup || "-"}`);
    drawFieldLine(
      "มีความประสงค์ขออนุญาตลา:",
      `${rec.leaveTypeLabel || rec.leaveType}   (${rec.phaseLabel || ""})`
    );
    drawFieldLine(
      "ช่วงวันที่ขอลา:",
      `ตั้งแต่วันที่ ${rec.startDate || "-"} ถึงวันที่ ${rec.endDate || rec.startDate || "-"} (${rec.slotLabel || "เต็มวัน"} · รวม ${rec.totalDays || 1} วัน)`
    );
    drawWrappedParagraph("คาบเรียนที่ตรงกับวันลา:", rec.affectedSummary || "ตามตารางเรียน");
    drawWrappedParagraph("เนื่องจากสาเหตุ / รายละเอียด:", rec.reason || "-");
    drawFieldLine("เบอร์โทรศัพท์ติดต่อนักศึกษา:", `${rec.phone || "-"}${rec.emergencyPhone ? "   |   ติดต่อฉุกเฉิน: " + rec.emergencyPhone : ""}`);
    drawFieldLine("เอกสารแนบประกอบ (ใบรับรองแพทย์/หลักฐาน):", rec.attachmentName || "ไม่มีไฟล์แนบ");

    // Signatures Grid at bottom
    const sigTop = Math.max(y + 30, 1190);
    const boxW = 345;
    const boxH = 260;
    const gap = 36;
    const boxes = [
      {
        title: "1. ลงชื่อนักศึกษาแพทย์ผู้ขอลา",
        sigUrl: rec.studentSignatureDataUrl,
        signer: `(${rec.studentName || "........................................"})`,
        sub: `วันที่ ${rec.submittedAtTH || "....../....../......"}`
      },
      {
        title: "2. ความเห็นอาจารย์ประจำกลุ่ม",
        sigUrl: rec.advisorSignatureDataUrl || "",
        signer: `(${rec.advisorSignerName || rec.groupAdvisors || "อาจารย์ประจำกลุ่ม"})`,
        sub:
          rec.advisorDecision === "approved"
            ? "☑ เห็นสมควรอนุญาต"
            : rec.advisorDecision === "rejected"
              ? "☒ ไม่อนุมัติ"
              : "☐ เห็นสมควรอนุญาต  ☐ อื่นๆ (รอพิจารณา)"
      },
      {
        title: "3. คำสั่งประธานรายวิชา RACM 303",
        sigUrl: rec.directorSignatureDataUrl || "",
        signer: `(${COURSE_DIRECTOR_NAME})`,
        sub:
          rec.directorDecision === "approved"
            ? "☑ อนุญาตให้ลาได้"
            : rec.directorDecision === "rejected"
              ? "☒ ไม่อนุมัติ"
              : "☐ อนุญาต  ☐ ไม่อนุมัติ (รอพิจารณา)"
      }
    ];

    const loadImg = (url) =>
      new Promise((resolve) => {
        if (!url || typeof Image === "undefined") return resolve(null);
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = url;
      });

    for (let i = 0; i < boxes.length; i++) {
      const bx = leftX + i * (boxW + gap);
      const b = boxes[i];
      g.strokeStyle = "#94a3b8";
      g.lineWidth = 1.8;
      g.strokeRect(bx, sigTop, boxW, boxH);

      g.fillStyle = "#f8fafc";
      g.fillRect(bx + 1, sigTop + 1, boxW - 2, 42);
      g.fillStyle = "#0f2942";
      g.font = "bold 18px Sarabun, sans-serif";
      g.textAlign = "center";
      g.fillText(b.title, bx + boxW / 2, sigTop + 28);

      if (b.sigUrl) {
        const im = await loadImg(b.sigUrl);
        if (im) {
          g.drawImage(im, bx + 28, sigTop + 52, boxW - 56, 115);
        }
      }

      g.fillStyle = "#1e293b";
      g.font = "17px Sarabun, sans-serif";
      g.fillText(b.signer.slice(0, 38), bx + boxW / 2, sigTop + 202);
      g.fillStyle = "#475569";
      g.font = "16px Sarabun, sans-serif";
      g.fillText(b.sub, bx + boxW / 2, sigTop + 234);
    }

    g.textAlign = "center";
    g.fillStyle = "#64748b";
    g.font = "16px Sarabun, sans-serif";
    g.fillText(
      "หมายเหตุ: เกณฑ์เวลาเรียนต้องไม่น้อยกว่าร้อยละ 80 (ช่วงเรียนในคณะฯ ลาได้ไม่เกิน 3 วัน · ช่วงฝึกภาคสนาม ลาได้ไม่เกิน 1.5 วัน)",
      c.width / 2,
      1660
    );

    return c.toDataURL("image/jpeg", 0.92);
  }

  async function downloadLeaveRecordAsPdfFile(rec) {
    const jpegUrl = await renderLeaveRecordToA4Jpeg(rec);
    const pdfBytes = buildBinaryPdfFromJpegDataUrl(jpegUrl, `RACM303 Leave ${rec.refId || ""} ${rec.studentId || ""}`);
    const fname = `ใบลา_RACM303_2569_${sanitizeFilenamePart(rec.studentId || "6702xxx")}_${sanitizeFilenamePart(rec.studentName || "นักศึกษา")}.pdf`;
    triggerBlobDownload(pdfBytes, "application/pdf", fname);
  }

  function buildOfficialPaperHtml(rec) {
    const statusPill =
      rec.status === "approved"
        ? '<span class="badge cat-HS">✓ อนุมัติแล้ว</span>'
        : rec.status === "rejected"
          ? '<span class="badge cat-EXAM">✗ ไม่อนุมัติ</span>'
          : '<span class="badge cat-HOLIDAY">🔔 ส่งแจ้งเตือนแล้ว · รออาจารย์พิจารณา</span>';

    return `
      <div class="leave-a4-sheet">
        <div class="leave-a4-header">
          <div>
            <div class="leave-a4-dept">ภาควิชาเวชศาสตร์ชุมชน คณะแพทยศาสตร์โรงพยาบาลรามาธิบดี มหาวิทยาลัยมหิดล</div>
            <h4>แบบฟอร์มใบลากิจ – ใบลาป่วย นักศึกษาแพทย์ชั้นปีที่ 3 (ปีการศึกษา 2569)</h4>
            <div class="leave-a4-sub">รายวิชา RACM 303 เวชศาสตร์ชุมชน 1 · เลขที่อ้างอิง: <code>${escapeHtml(rec.refId || "ร่างใบลา")}</code> · วันที่ยื่น: ${escapeHtml(rec.submittedAtTH || "วันนี้")}</div>
          </div>
          <div>${statusPill}</div>
        </div>
        <div class="leave-a4-body">
          <p><strong>เรียน</strong> ประธานรายวิชา RACM 303 (<strong>${escapeHtml(COURSE_DIRECTOR_NAME)}</strong>) และอาจารย์ที่ปรึกษาประจำกลุ่มพื้นที่ <strong>${escapeHtml(rec.areaGroup || "—")}</strong> (<strong>${escapeHtml(rec.groupAdvisors || "—")}</strong>)</p>
          <p>ข้าพเจ้า <strong>${escapeHtml(rec.studentName || "................................................")}</strong> รหัสนักศึกษา <code>${escapeHtml(rec.studentId || "6702xxx")}</code> นักศึกษาแพทย์ชั้นปีที่ 3 สังกัดกลุ่มอภิปราย <strong>Discussion ที่ ${escapeHtml(rec.discGroup || "—")}</strong> และกลุ่มฝึกปฏิบัติงานภาคสนาม <strong>${escapeHtml(rec.areaGroup || "—")}</strong></p>
          <p>มีความประสงค์ขออนุญาต <strong>${escapeHtml(rec.leaveTypeLabel || "ลาป่วย / ลากิจ")}</strong> (${escapeHtml(rec.phaseLabel || "ช่วงเรียนในรายวิชา")}) ตั้งแต่วันที่ <strong>${escapeHtml(rec.startDate || "—")}</strong> ถึงวันที่ <strong>${escapeHtml(rec.endDate || rec.startDate || "—")}</strong> (${escapeHtml(rec.slotLabel || "เต็มวัน")} · รวม <strong>${escapeHtml(String(rec.totalDays || 1))} วัน</strong>)</p>
          <p><strong>คาบเรียนที่ตรงกับวันลา:</strong> ${escapeHtml(rec.affectedSummary || "—")}</p>
          <p><strong>เนื่องจากสาเหตุ / รายละเอียด:</strong> ${escapeHtml(rec.reason || "—")}</p>
          <p><strong>เบอร์โทรศัพท์ติดต่อนักศึกษา:</strong> ${escapeHtml(rec.phone || "—")}${rec.emergencyPhone ? ` · <strong>ติดต่อฉุกเฉิน:</strong> ${escapeHtml(rec.emergencyPhone)}` : ""} · <strong>เอกสารแนบ:</strong> ${escapeHtml(rec.attachmentName || "ไม่มีเอกสารแนบ")}</p>
        </div>
        <div class="leave-a4-sig-grid">
          <div class="leave-a4-sig-box">
            <div class="sig-box-head">1. ลงชื่อนักศึกษาแพทย์ผู้ขอลา</div>
            <div class="sig-img-frame">
              ${rec.studentSignatureDataUrl ? `<img src="${rec.studentSignatureDataUrl}" alt="ลายเซ็นนักศึกษา">` : '<span class="sig-placeholder">วาดลายเซ็นในช่องด้านซ้าย</span>'}
            </div>
            <div class="sig-signer">(${escapeHtml(rec.studentName || "........................................")})</div>
            <small>ผู้ขอลา · ${escapeHtml(rec.submittedAtTH || "")}</small>
          </div>
          <div class="leave-a4-sig-box">
            <div class="sig-box-head">2. ความเห็นอาจารย์ประจำกลุ่ม</div>
            <div class="sig-img-frame">
              ${rec.advisorSignatureDataUrl ? `<img src="${rec.advisorSignatureDataUrl}" alt="ลายเซ็นอาจารย์ประจำกลุ่ม">` : `<span class="sig-placeholder">${rec.advisorDecision === "approved" ? "✓ เห็นชอบอนุญาต" : "รออาจารย์ประจำกลุ่มลงนาม"}</span>`}
            </div>
            <div class="sig-signer">(${escapeHtml(rec.advisorSignerName || rec.groupAdvisors || "อาจารย์ที่ปรึกษาประจำกลุ่ม")})</div>
            <small>${rec.advisorComment ? escapeHtml(rec.advisorComment) : "อาจารย์ที่ปรึกษาประจำกลุ่มพื้นที่"}</small>
          </div>
          <div class="leave-a4-sig-box">
            <div class="sig-box-head">3. คำสั่งประธานรายวิชา RACM 303</div>
            <div class="sig-img-frame">
              ${rec.directorSignatureDataUrl ? `<img src="${rec.directorSignatureDataUrl}" alt="ลายเซ็นประธานรายวิชา">` : `<span class="sig-placeholder">${rec.directorDecision === "approved" ? "✓ อนุมัติแล้ว" : "รอประธานรายวิชาพิจารณา"}</span>`}
            </div>
            <div class="sig-signer">(${escapeHtml(COURSE_DIRECTOR_NAME)})</div>
            <small>${rec.directorComment ? escapeHtml(rec.directorComment) : "ประธานรายวิชา RACM 303"}</small>
          </div>
        </div>
      </div>
    `;
  }

  function printLeaveRecordAsA4(rec) {
    const printHost = $("leaveDedicatedPrintHost") || (() => {
      const d = make("div", null, "leave-dedicated-print-host");
      d.id = "leaveDedicatedPrintHost";
      document.body.appendChild(d);
      return d;
    })();
    printHost.innerHTML = buildOfficialPaperHtml(rec);
    document.body.classList.add("print-leave-form-mode");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("print-leave-form-mode");
    }, 800);
  }

  let activeLeaveFilterRoute = "all"; // all | advisor | director
  let facultyShowCreateLeaveForm = false;

  function navigateToAdvisorOrDirectorNotification(rec, targetRole, advisorName) {
    if (ROLE === "faculty") {
      activeLeaveFilterRoute = targetRole;
      if (advisorName) {
        const matchedT = getAllCourseTeachers().find((t) => advisorName.includes(t.key) || t.label.includes(advisorName));
        if (matchedT) selectActiveTeacher(matchedT.key, true);
      } else if (targetRole === "director") {
        selectActiveTeacher("ณัฐวุฒิ", true);
      }
      switchTab("leave");
      renderLeavePortalView(rec.refId);
      const inbox = $("facultyLeaveInboxSection");
      if (inbox) inbox.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // On Student Portal: navigate to notification tracker & offer 1-click launch to Faculty Notification Inbox with encoded payload
    const tracker = $("leaveNotificationTrackerCard");
    if (tracker) {
      tracker.dataset.highlightTarget = targetRole;
      tracker.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const crossUrl = encodeLeavePayloadForCrossPortalUrl(rec);
    window.open(crossUrl, "_blank", "noopener");
  }

  function renderLeavePortalView(highlightRefId) {
    const mount = $("leavePortalMount");
    if (!mount) return;
    syncLeaveNotificationBadges();

    const allRequests = loadLeaveRequests();
    const showComposer = ROLE === "student" || facultyShowCreateLeaveForm;

    mount.replaceChildren();

    // Header
    const header = make("div", null, "section-header");
    const hLeft = make("div");
    hLeft.innerHTML =
      ROLE === "faculty"
        ? `<h2>🔔 ระบบแจ้งเตือนและพิจารณาอนุมัติใบลานักศึกษาแพทย์ (ปีการศึกษา 2569)</h2>
           <p>รับการแจ้งเตือนใบลากิจ / ใบลาป่วยที่นักศึกษากรอกและเซ็นลายเซ็นออนไลน์ ส่งตรงถึง <strong>อาจารย์ที่ปรึกษาประจำกลุ่มพื้นที่</strong> และ <strong>ประธานรายวิชา (${escapeHtml(COURSE_DIRECTOR_NAME)})</strong> พร้อมลงนามอนุมัติและ Export PDF</p>`
        : `<h2>📝 แบบฟอร์มใบลากิจ – ใบลาป่วยออนไลน์ &amp; ลายเซ็นอิเล็กทรอนิกส์ (ปีการศึกษา 2569)</h2>
           <p>กรอกข้อมูล วาดลายเซ็น แนบใบรับรองแพทย์ แล้วกดยื่นเพื่อส่งแจ้งเตือนไปยัง <strong>อาจารย์ประจำกลุ่ม</strong> และ <strong>ประธานรายวิชา (${escapeHtml(COURSE_DIRECTOR_NAME)})</strong> พร้อมดาวน์โหลดเป็นไฟล์ <strong>PDF (1 หน้า A4)</strong> ได้ทันที</p>`;

    const hRight = make("div", null, "header-actions");
    if (ROLE === "faculty") {
      const toggleFormBtn = make(
        "button",
        facultyShowCreateLeaveForm ? "ซ่อนฟอร์มกรอกใบลา" : "➕ เปิดฟอร์มกรอกใบลาแทนนักศึกษา",
        "btn teal"
      );
      toggleFormBtn.type = "button";
      toggleFormBtn.addEventListener("click", () => {
        facultyShowCreateLeaveForm = !facultyShowCreateLeaveForm;
        renderLeavePortalView(highlightRefId);
      });
      hRight.appendChild(toggleFormBtn);
    }
    const ruleBtn = make("button", "ดูเกณฑ์เวลาเรียน 80% (บทที่ 14)", "btn");
    ruleBtn.type = "button";
    ruleBtn.addEventListener("click", () => openManualChapter("man-ch-14"));
    hRight.appendChild(ruleBtn);
    header.append(hLeft, hRight);
    mount.appendChild(header);

    // Faculty Notification Inbox Section (First on Faculty Portal!)
    if (ROLE === "faculty") {
      const inboxSec = make("section", null, "leave-inbox-card");
      inboxSec.id = "facultyLeaveInboxSection";

      const filterBar = make("div", null, "leave-inbox-toolbar");
      const routePills = [
        { id: "all", label: `ทั้งหมด (${allRequests.length})` },
        { id: "advisor", label: "👨‍⚕️ แจ้งเตือนถึงอาจารย์ประจำกลุ่ม" },
        { id: "director", label: `🏛 แจ้งเตือนถึงประธานรายวิชา (${COURSE_DIRECTOR_NAME})` }
      ];
      const pillGroup = make("div", null, "header-actions");
      routePills.forEach((rp) => {
        const b = make("button", rp.label, `btn sm${activeLeaveFilterRoute === rp.id ? " primary" : ""}`);
        b.type = "button";
        b.addEventListener("click", () => {
          activeLeaveFilterRoute = rp.id;
          renderLeavePortalView(highlightRefId);
        });
        pillGroup.appendChild(b);
      });
      filterBar.appendChild(pillGroup);
      inboxSec.appendChild(filterBar);

      const filteredReqs = allRequests.filter((r) => {
        if (activeLeaveFilterRoute === "advisor" && state.myTeacherKey) {
          return String(r.groupAdvisors || "").includes(state.myTeacherKey);
        }
        return true;
      });

      if (!filteredReqs.length) {
        inboxSec.appendChild(
          make(
            "div",
            "ยังไม่มีคำขอใบลานักศึกษาที่ส่งเข้ามาในขณะนี้ — เมื่อนักศึกษากรอกและเซ็นใบลา ระบบจะแจ้งเตือนอาจารย์ประจำกลุ่มและประธานรายวิชาที่นี่ทันที",
            "empty-state"
          )
        );
      } else {
        filteredReqs.forEach((rec) => {
          const itemCard = make(
            "article",
            null,
            `leave-notif-item${rec.refId === highlightRefId ? " is-highlighted" : ""}`
          );
          itemCard.innerHTML = `
            <div class="leave-notif-top">
              <div>
                <span class="badge ${rec.leaveType === "sick" ? "cat-EXAM" : "cat-SG"}">${escapeHtml(rec.leaveTypeLabel || rec.leaveType)}</span>
                <strong style="margin-left:8px;font-size:16px">${escapeHtml(rec.studentId)} · ${escapeHtml(rec.studentName)}</strong>
                <span class="room-pill" style="margin-left:8px">กลุ่มพื้นที่ ${escapeHtml(rec.areaGroup)} · Discussion ${escapeHtml(rec.discGroup)}</span>
              </div>
              <small>อ้างอิง <code>${escapeHtml(rec.refId)}</code> · ยื่นเมื่อ ${escapeHtml(rec.submittedAtTH || "")}</small>
            </div>
            <div class="leave-notif-routing-pills">
              <span class="notif-route-chip">🔔 อาจารย์ประจำกลุ่ม: <strong>${escapeHtml(rec.groupAdvisors || "—")}</strong> (${rec.advisorDecision === "approved" ? "✓ เห็นชอบแล้ว" : "รอลงนาม"})</span>
              <span class="notif-route-chip">🔔 ประธานรายวิชา: <strong>${escapeHtml(COURSE_DIRECTOR_NAME)}</strong> (${rec.directorDecision === "approved" ? "✓ อนุมัติแล้ว" : "รอพิจารณา"})</span>
            </div>
          `;

          const previewBox = make("div", null, "leave-inline-preview-wrap");
          previewBox.innerHTML = buildOfficialPaperHtml(rec);
          itemCard.appendChild(previewBox);

          // Faculty Countersignature & Decision Bar
          const signBox = make("div", null, "faculty-leave-sign-bar");
          signBox.innerHTML = `
            <div class="fac-sign-col">
              <label>✍ ลงลายมือชื่ออนุมัติ (อาจารย์ประจำกลุ่ม / ประธานรายวิชา):</label>
              <canvas class="leave-sig-canvas fac-mini-sig" width="380" height="110"></canvas>
              <div class="header-actions" style="margin-top:6px">
                <button type="button" class="btn sm fac-clear-sig-btn">ล้างลายเซ็น</button>
              </div>
            </div>
            <div class="fac-decision-col">
              <label>บันทึกความเห็นและสถานะการอนุมัติ:</label>
              <select class="fac-role-Approve-select">
                <option value="advisor">ลงนามในฐานะ: อาจารย์ที่ปรึกษาประจำกลุ่ม (${escapeHtml(rec.areaGroup)})</option>
                <option value="director">ลงนามในฐานะ: ประธานรายวิชา (${escapeHtml(COURSE_DIRECTOR_NAME)})</option>
              </select>
              <input type="text" class="fac-comment-input" placeholder="ความเห็นเพิ่มเติม เช่น อนุญาตให้ลาได้และให้ติดตามเนื้อหาคาบเรียน…" value="${escapeHtml(rec.advisorComment || "")}">
              <div class="header-actions" style="margin-top:8px">
                <button type="button" class="btn sm primary fac-approve-btn">✓ อนุมัติใบลา &amp; บันทึกลายเซ็น</button>
                <button type="button" class="btn sm fac-reject-btn">✗ ไม่อนุมัติ</button>
                <button type="button" class="btn sm pdf-red fac-dl-pdf-btn"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF</button>
                <button type="button" class="btn sm print-ink fac-print-pdf-btn"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print</button>
              </div>
            </div>
          `;
          itemCard.appendChild(signBox);

          const facCanvas = signBox.querySelector(".fac-mini-sig");
          const facPad = createSignaturePadController(facCanvas, { width: 380, height: 110 });
          signBox.querySelector(".fac-clear-sig-btn").addEventListener("click", () => facPad.clear());

          const applyDecision = (decision) => {
            const roleMode = signBox.querySelector(".fac-role-Approve-select").value;
            const commentVal = signBox.querySelector(".fac-comment-input").value.trim();
            const sigData = facPad.isEmpty() ? "" : facPad.toDataURL();
            const list = loadLeaveRequests();
            const target = list.find((x) => x.refId === rec.refId);
            if (!target) return;

            if (roleMode === "director") {
              target.directorDecision = decision;
              target.directorComment = commentVal;
              if (sigData) target.directorSignatureDataUrl = sigData;
              target.status = decision;
            } else {
              target.advisorDecision = decision;
              target.advisorComment = commentVal;
              const activeT = getAllCourseTeachers().find((t) => t.key === state.myTeacherKey);
              if (activeT) target.advisorSignerName = activeT.label;
              if (sigData) target.advisorSignatureDataUrl = sigData;
              if (decision === "rejected") target.status = "rejected";
              else if (target.directorDecision === "approved") target.status = "approved";
            }
            saveLeaveRequests(list);
            renderLeavePortalView(rec.refId);
          };

          signBox.querySelector(".fac-approve-btn").addEventListener("click", () => applyDecision("approved"));
          signBox.querySelector(".fac-reject-btn").addEventListener("click", () => applyDecision("rejected"));
          signBox.querySelector(".fac-dl-pdf-btn").addEventListener("click", () => downloadLeaveRecordAsPdfFile(rec));
          signBox.querySelector(".fac-print-pdf-btn").addEventListener("click", () => printLeaveRecordAsA4(rec));

          inboxSec.appendChild(itemCard);
        });
      }
      mount.appendChild(inboxSec);
    }

    // Composer Studio (Default on Student Portal, optional on Faculty Portal)
    if (showComposer) {
      const defStu = state.myStudent || null;
      const defSite = defStu
        ? (SCHED.fieldworkSites || []).find((x) => x.shortName === defStu.area)
        : (SCHED.fieldworkSites || [])[0];

      const workspace = make("div", null, "leave-composer-split");
      workspace.innerHTML = `
        <div class="leave-form-card">
          <h3>1. กรอกข้อมูลใบลากิจ / ใบลาป่วย และวาดลายเซ็น</h3>
          <div class="srn-form-grid">
            <div class="filter-field span-2">
              <label for="leaveStuLookupInput">ค้นหารหัสนักศึกษา 7 หลัก หรือชื่อ-นามสกุล (ดึงกลุ่มและอาจารย์ประจำกลุ่มอัตโนมัติ)</label>
              <input id="leaveStuLookupInput" list="studentLookupList" type="search" placeholder="พิมพ์รหัส 7 หลัก เช่น 6702006…" value="${defStu ? escapeHtml(`${defStu.id} — ${defStu.fullName}`) : ""}">
            </div>
            <div class="filter-field">
              <label for="leaveStudentIdInput">รหัสนักศึกษา</label>
              <input id="leaveStudentIdInput" type="text" placeholder="6702xxx" value="${defStu ? escapeHtml(defStu.id) : ""}">
            </div>
            <div class="filter-field">
              <label for="leaveStudentNameInput">ชื่อ-นามสกุล นักศึกษาแพทย์</label>
              <input id="leaveStudentNameInput" type="text" placeholder="นศพ.ชื่อ นามสกุล" value="${defStu ? escapeHtml(defStu.fullName) : ""}">
            </div>
            <div class="filter-field">
              <label for="leaveAreaGroupSelect">กลุ่มพื้นที่ภาคสนาม</label>
              <select id="leaveAreaGroupSelect"></select>
            </div>
            <div class="filter-field">
              <label for="leaveDiscGroupSelect">กลุ่มอภิปราย Discussion</label>
              <select id="leaveDiscGroupSelect">
                <option value="1">Discussion 1</option>
                <option value="2">Discussion 2</option>
                <option value="3">Discussion 3</option>
                <option value="4">Discussion 4</option>
                <option value="5">Discussion 5</option>
                <option value="6">Discussion 6</option>
              </select>
            </div>
            <div class="filter-field">
              <label for="leaveTypeSelect">ประเภทการลา</label>
              <select id="leaveTypeSelect">
                <option value="sick">🤒 ลาป่วย (แนบใบรับรองแพทย์ประกอบ)</option>
                <option value="personal">📋 ลากิจ (ยื่นขออนุญาตล่วงหน้า)</option>
                <option value="emergency">🚨 กรณีฉุกเฉิน / เหตุสุดวิสัย</option>
              </select>
            </div>
            <div class="filter-field">
              <label for="leavePhaseSelect">ช่วงของการเรียนการสอน</label>
              <select id="leavePhaseSelect">
                <option value="classroom">ช่วงเรียนในคณะฯ ก่อน/หลังภาคสนาม (ไม่เกิน 3 วัน)</option>
                <option value="fieldwork">ช่วงฝึกปฏิบัติงานภาคสนาม (ไม่เกิน 1.5 วัน)</option>
              </select>
            </div>
            <div class="filter-field">
              <label for="leaveStartDateInput">ตั้งแต่วันที่</label>
              <input id="leaveStartDateInput" type="date" value="2026-11-30" min="2026-11-25" max="2026-12-30">
            </div>
            <div class="filter-field">
              <label for="leaveEndDateInput">ถึงวันที่</label>
              <input id="leaveEndDateInput" type="date" value="2026-11-30" min="2026-11-25" max="2026-12-30">
            </div>
            <div class="filter-field">
              <label for="leaveSlotSelect">ช่วงเวลาที่ลา</label>
              <select id="leaveSlotSelect">
                <option value="full">เต็มวัน (08.30–16.30 น.)</option>
                <option value="am">ครึ่งวันเช้า (08.30–12.00 น. · 0.5 วัน)</option>
                <option value="pm">ครึ่งวันบ่าย (13.00–16.30 น. · 0.5 วัน)</option>
              </select>
            </div>
            <div class="filter-field">
              <label for="leavePhoneInput">เบอร์โทรศัพท์ติดต่อนักศึกษา</label>
              <input id="leavePhoneInput" type="tel" placeholder="08x-xxx-xxxx">
            </div>
            <div class="filter-field span-2">
              <label for="leaveReasonInput">เหตุผลการขอลาโดยละเอียด</label>
              <textarea id="leaveReasonInput" rows="3" placeholder="ระบุอาการป่วย หรือเหตุผลความจำเป็นในการขอลากิจอย่างชัดเจน…"></textarea>
            </div>
            <div class="filter-field span-2">
              <label for="leaveAttachmentInput">แนบใบรับรองแพทย์ / เอกสารประกอบ (.pdf, .jpg, .png)</label>
              <input id="leaveAttachmentInput" type="file" accept=".pdf,image/*">
              <div id="leaveQuotaStatusHint" class="leave-quota-hint"></div>
            </div>
          </div>

          <div class="leave-recipient-preview" id="leaveRecipientPreviewBox"></div>

          <div class="leave-signature-section">
            <div class="leave-sig-header">
              <label>✍ เซ็นลายมือชื่อนักศึกษาผู้ขอลา (วาดด้วยเมาส์ / ปากกา Stylus / นิ้วมือ):</label>
              <div class="header-actions">
                <button type="button" class="btn sm is-active" id="sigInkBlueBtn">หมึกน้ำเงิน</button>
                <button type="button" class="btn sm" id="sigInkBlackBtn">หมึกดำ</button>
                <button type="button" class="btn sm" id="sigUndoBtn">↶ ย้อนเส้น</button>
                <button type="button" class="btn sm" id="sigClearBtn">🗑 ล้างลายเซ็น</button>
              </div>
            </div>
            <div class="leave-sig-canvas-wrap">
              <canvas id="studentLeaveSigCanvas" class="leave-sig-canvas" width="520" height="165"></canvas>
            </div>
          </div>

          <div class="leave-submit-actions">
            <button type="button" class="btn primary" id="submitAndNotifyLeaveBtn">📤 ยื่นใบลา &amp; ส่งแจ้งเตือนอาจารย์ประจำกลุ่มและประธานรายวิชา</button>
            <button type="button" class="btn pdf-red" id="exportDraftLeavePdfBtn"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF</button>
            <button type="button" class="btn print-ink" id="printDraftLeaveA4Btn"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print (1 หน้า A4)</button>
          </div>
          <div id="leaveFormFeedbackBox" class="slide-studio-feedback" hidden></div>
        </div>

        <div class="leave-preview-column">
          <div id="leaveNotificationTrackerSlot"></div>
          <div class="leave-live-paper-head">
            <strong>📄 ตัวอย่างเอกสารใบลาราชการ (อัปเดตสดตามข้อมูลและลายเซ็นที่วาด · พร้อม Export PDF)</strong>
          </div>
          <div id="leaveOfficialPaperPreview"></div>
        </div>
      `;

      mount.appendChild(workspace);

      const areaSel = $("leaveAreaGroupSelect");
      (SCHED.fieldworkSites || []).forEach((s) => {
        areaSel.add(new Option(s.shortName, s.shortName));
      });
      if (defSite) areaSel.value = defSite.shortName;
      if (defStu) $("leaveDiscGroupSelect").value = String(defStu.disc);

      let attachedFileName = "";
      let sigPad = null;
      const sigCanvas = $("studentLeaveSigCanvas");
      sigPad = createSignaturePadController(sigCanvas, {
        width: 520,
        height: 165,
        onChange: () => refreshDraftPreview()
      });
      // Expose for automated verification if needed
      sigCanvas._sigPad = sigPad;

      $("sigInkBlueBtn").addEventListener("click", () => sigPad.setInk("#1d4ed8"));
      $("sigInkBlackBtn").addEventListener("click", () => sigPad.setInk("#0f172a"));
      $("sigUndoBtn").addEventListener("click", () => sigPad.undo());
      $("sigClearBtn").addEventListener("click", () => sigPad.clear());

      $("leaveAttachmentInput").addEventListener("change", (ev) => {
        const f = ev.target.files && ev.target.files[0];
        attachedFileName = f ? `${f.name} (${formatFileSize(f.size)})` : "";
        refreshDraftPreview();
      });

      function collectDraftRecord(existingRefId) {
        const sid = $("leaveStudentIdInput").value.trim();
        const sname = $("leaveStudentNameInput").value.trim();
        const areaVal = areaSel.value;
        const discVal = $("leaveDiscGroupSelect").value;
        const siteObj = (SCHED.fieldworkSites || []).find((x) => x.shortName === areaVal);
        const groupAdvisors = siteObj ? siteObj.advisors : "อาจารย์ประจำกลุ่ม";

        const leaveType = $("leaveTypeSelect").value;
        const leaveTypeMap = {
          sick: "ลาป่วย (Sick Leave)",
          personal: "ลากิจ (Personal Leave)",
          emergency: "ลาฉุกเฉิน / เหตุสุดวิสัย"
        };
        const phase = $("leavePhaseSelect").value;
        const phaseLabel =
          phase === "fieldwork"
            ? "ช่วงฝึกปฏิบัติงานภาคสนาม (เกณฑ์ไม่เกิน 1.5 วัน)"
            : "ช่วงเรียนในคณะฯ ก่อน/หลังภาคสนาม (เกณฑ์ไม่เกิน 3 วัน)";

        const startDate = $("leaveStartDateInput").value;
        const endDate = $("leaveEndDateInput").value || startDate;
        const slot = $("leaveSlotSelect").value;
        const slotMap = {
          full: "เต็มวัน (08.30–16.30 น.)",
          am: "ครึ่งวันเช้า (08.30–12.00 น.)",
          pm: "ครึ่งวันบ่าย (13.00–16.30 น.)"
        };

        let daySpan = 1;
        if (startDate && endDate && endDate >= startDate) {
          daySpan = Math.round((parseISODate(endDate) - parseISODate(startDate)) / 86400000) + 1;
        }
        const totalDays = slot === "full" ? daySpan : Math.max(0.5, daySpan - 0.5);

        const affected = buildAffectedSessionsBetween(startDate, endDate, areaVal);
        const affectedSummary = affected.length
          ? affected.map((s) => `${s.code} (${s.dateTH})`).join(", ")
          : "ตามตารางกิจกรรมการเรียนการสอน";

        return {
          refId: existingRefId || "",
          status: "pending",
          studentId: sid,
          studentName: sname,
          areaGroup: areaVal,
          discGroup: discVal,
          groupAdvisors,
          courseDirector: COURSE_DIRECTOR_NAME,
          leaveType,
          leaveTypeLabel: leaveTypeMap[leaveType] || leaveType,
          phase,
          phaseLabel,
          startDate,
          endDate,
          slot,
          slotLabel: slotMap[slot] || slot,
          totalDays,
          affectedSummary,
          reason: $("leaveReasonInput").value.trim(),
          phone: $("leavePhoneInput").value.trim(),
          attachmentName: attachedFileName,
          studentSignatureDataUrl: sigPad && !sigPad.isEmpty() ? sigPad.toDataURL() : "",
          submittedAtTH: new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
        };
      }

      function refreshDraftPreview() {
        const draft = collectDraftRecord();
        const recipBox = $("leaveRecipientPreviewBox");
        if (recipBox) {
          recipBox.innerHTML = `
            <div><strong>🔔 ผู้รับแจ้งเตือนอัตโนมัติเมื่อกดยื่นใบลา:</strong></div>
            <div class="leave-recip-chips">
              <span class="notif-route-chip">1) อาจารย์ประจำกลุ่มพื้นที่ (${escapeHtml(draft.areaGroup)}): <strong>${escapeHtml(draft.groupAdvisors)}</strong></span>
              <span class="notif-route-chip">2) ประธานรายวิชา RACM 303: <strong>${escapeHtml(COURSE_DIRECTOR_NAME)}</strong></span>
            </div>
          `;
        }

        const quotaHint = $("leaveQuotaStatusHint");
        if (quotaHint) {
          const limit = draft.phase === "fieldwork" ? 1.5 : 3;
          const over = draft.totalDays > limit;
          quotaHint.className = `leave-quota-hint${over ? " is-warn" : " is-ok"}`;
          quotaHint.textContent = over
            ? `⚠ จำนวนวันลาที่เลือก (${draft.totalDays} วัน) เกินเกณฑ์ปกติของ${draft.phase === "fieldwork" ? "ช่วงภาคสนาม (≤ 1.5 วัน)" : "ช่วงเรียนในคณะฯ (≤ 3 วัน)"} — ต้องได้รับการพิจารณาเป็นกรณีพิเศษจากประธานรายวิชา`
            : `✓ รวมจำนวนวันลา ${draft.totalDays} วัน (อยู่ในเกณฑ์เวลาเรียน ≥ 80% · คาบที่เกี่ยวข้อง ${buildAffectedSessionsBetween(draft.startDate, draft.endDate, draft.areaGroup).length} คาบ)`;
        }

        const paper = $("leaveOfficialPaperPreview");
        if (paper) {
          paper.innerHTML = buildOfficialPaperHtml(draft);
        }
      }

      const stuLookup = $("leaveStuLookupInput");
      stuLookup.addEventListener("input", () => {
        const found = findStudentByQuery(stuLookup.value);
        if (found) {
          $("leaveStudentIdInput").value = found.id;
          $("leaveStudentNameInput").value = found.fullName;
          areaSel.value = found.area;
          $("leaveDiscGroupSelect").value = String(found.disc);
          refreshDraftPreview();
        }
      });

      [
        "leaveStudentIdInput",
        "leaveStudentNameInput",
        "leaveAreaGroupSelect",
        "leaveDiscGroupSelect",
        "leaveTypeSelect",
        "leavePhaseSelect",
        "leaveStartDateInput",
        "leaveEndDateInput",
        "leaveSlotSelect",
        "leavePhoneInput",
        "leaveReasonInput"
      ].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", refreshDraftPreview);
        el.addEventListener("change", refreshDraftPreview);
      });

      $("exportDraftLeavePdfBtn").addEventListener("click", () => {
        const draft = collectDraftRecord("DRAFT-2569");
        downloadLeaveRecordAsPdfFile(draft);
      });
      $("printDraftLeaveA4Btn").addEventListener("click", () => {
        const draft = collectDraftRecord("DRAFT-2569");
        printLeaveRecordAsA4(draft);
      });

      const renderNotificationDispatchCard = (savedRec) => {
        const slot = $("leaveNotificationTrackerSlot");
        if (!slot) return;
        const card = make("div", null, "leave-dispatch-banner");
        card.id = "leaveNotificationTrackerCard";
        card.innerHTML = `
          <div class="dispatch-head">
            <span class="badge cat-HS">✓ บันทึกและส่งแจ้งเตือนใบลาแล้ว</span>
            <code>${escapeHtml(savedRec.refId)}</code>
          </div>
          <h4>🔔 แจ้งเตือนถูกส่งไปยังอาจารย์ประจำกลุ่มและประธานรายวิชาเรียบร้อยแล้ว</h4>
          <p>กดปุ่มด้านล่างเพื่อ <strong>Navigate ไปยังหน้าแจ้งเตือนของอาจารย์ประจำกลุ่ม</strong> หรือ <strong>ประธานรายวิชา</strong> หรือดาวน์โหลดไฟล์ PDF เก็บไว้เป็นหลักฐาน:</p>
          <div class="dispatch-nav-buttons">
            <button type="button" class="btn sm primary" id="navToGroupAdvisorNotifBtn">👨‍⚕️ ไปยังหน้าแจ้งเตือนอาจารย์ประจำกลุ่ม (${escapeHtml(savedRec.groupAdvisors)}) →</button>
            <button type="button" class="btn sm teal" id="navToCourseDirectorNotifBtn">🏛 ไปยังหน้าแจ้งเตือนประธานรายวิชา (${escapeHtml(COURSE_DIRECTOR_NAME)}) →</button>
            <button type="button" class="btn sm pdf-red" id="dlSubmittedLeavePdfBtn"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF</button>
            <button type="button" class="btn sm" id="copyLeaveNotifSummaryBtn">📋 คัดลอกข้อความแจ้งลา</button>
          </div>
        `;
        slot.replaceChildren(card);

        $("navToGroupAdvisorNotifBtn").addEventListener("click", () => {
          navigateToAdvisorOrDirectorNotification(savedRec, "advisor", savedRec.groupAdvisors);
        });
        $("navToCourseDirectorNotifBtn").addEventListener("click", () => {
          navigateToAdvisorOrDirectorNotification(savedRec, "director", COURSE_DIRECTOR_NAME);
        });
        $("dlSubmittedLeavePdfBtn").addEventListener("click", () => {
          downloadLeaveRecordAsPdfFile(savedRec);
        });
        $("copyLeaveNotifSummaryBtn").addEventListener("click", () => {
          const msg =
            `[แจ้งขออนุญาต${savedRec.leaveTypeLabel} · RACM 303]\n` +
            `อ้างอิง: ${savedRec.refId}\n` +
            `นศพ.: ${savedRec.studentName} (${savedRec.studentId}) · กลุ่มพื้นที่ ${savedRec.areaGroup} · Discussion ${savedRec.discGroup}\n` +
            `วันที่ลา: ${savedRec.startDate} ถึง ${savedRec.endDate} (${savedRec.totalDays} วัน)\n` +
            `เหตุผล: ${savedRec.reason}\n` +
            `เรียนแจ้ง: ${savedRec.groupAdvisors} และ ${COURSE_DIRECTOR_NAME}`;
          copyTextWithFeedback(msg, $("copyLeaveNotifSummaryBtn"), "คัดลอกข้อความแจ้งเตือนแล้ว ✓");
        });
      };

      $("submitAndNotifyLeaveBtn").addEventListener("click", () => {
        const fb = $("leaveFormFeedbackBox");
        const draft = collectDraftRecord();
        if (!draft.studentId || !draft.studentName) {
          fb.hidden = false;
          fb.className = "slide-studio-feedback is-error";
          fb.textContent = "กรุณาระบุรหัสนักศึกษา 7 หลัก และชื่อ-นามสกุลให้ครบถ้วน";
          return;
        }
        if (!draft.reason) {
          fb.hidden = false;
          fb.className = "slide-studio-feedback is-error";
          fb.textContent = "กรุณาระบุเหตุผลการขอลากิจหรืออาการป่วยโดยสังเขป";
          return;
        }
        if (sigPad.isEmpty()) {
          fb.hidden = false;
          fb.className = "slide-studio-feedback is-error";
          fb.textContent = "กรุณาวาดลายเซ็นนักศึกษาผู้ขอลาในกรอบลายเซ็นก่อนกดยื่นใบลา";
          return;
        }

        const list = loadLeaveRequests();
        const seq = String(list.length + 1).padStart(3, "0");
        draft.refId = `LEAVE-2569-${draft.studentId}-${seq}`;
        draft.submittedIso = new Date().toISOString();
        list.unshift(draft);
        saveLeaveRequests(list);

        fb.hidden = false;
        fb.className = "slide-studio-feedback is-ok";
        fb.textContent = `✓ ยื่นใบลาเลขที่ ${draft.refId} สำเร็จ! ระบบส่งแจ้งเตือนไปยังอาจารย์ประจำกลุ่ม (${draft.groupAdvisors}) และประธานรายวิชา (${COURSE_DIRECTOR_NAME}) แล้ว`;

        const paper = $("leaveOfficialPaperPreview");
        if (paper) paper.innerHTML = buildOfficialPaperHtml(draft);
        renderNotificationDispatchCard(draft);
        const slot = $("leaveNotificationTrackerSlot");
        if (slot) slot.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      // Show student's own submitted leave history below composer on Student Portal
      if (ROLE === "student" && allRequests.length > 0) {
        const histSec = make("div", null, "leave-history-card");
        histSec.innerHTML = `<h3>📋 ประวัติการยื่นใบลาและสถานะการแจ้งเตือน (${allRequests.length} รายการ)</h3>`;
        allRequests.slice(0, 5).forEach((r) => {
          const row = make("div", null, "slide-matrix-row is-uploaded");
          row.innerHTML = `
            <div class="slide-matrix-info">
              <strong><code>${escapeHtml(r.refId)}</code> · ${escapeHtml(r.studentName)} (${escapeHtml(r.leaveTypeLabel)})</strong>
              <small>วันที่ลา ${escapeHtml(r.startDate)} – ${escapeHtml(r.endDate)} (${r.totalDays} วัน) · แจ้งเตือนถึง: ${escapeHtml(r.groupAdvisors)} &amp; ${escapeHtml(COURSE_DIRECTOR_NAME)}</small>
            </div>
          `;
          const acts = make("div", null, "slide-matrix-acts");
          const navAdv = make("button", "🔔 แจ้งอาจารย์ประจำกลุ่ม ↗", "btn sm");
          navAdv.type = "button";
          navAdv.addEventListener("click", () => navigateToAdvisorOrDirectorNotification(r, "advisor", r.groupAdvisors));
          const dlPdf = make("button", null, "btn sm pdf-red");
          dlPdf.type = "button";
          dlPdf.innerHTML = `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9.5 15.5 2.5 2.5 2.5-2.5"/></svg>Export as PDF`;
          dlPdf.addEventListener("click", () => downloadLeaveRecordAsPdfFile(r));
          acts.append(navAdv, dlPdf);
          row.appendChild(acts);
          histSec.appendChild(row);
        });
        mount.appendChild(histSec);
      }

      refreshDraftPreview();
    }
  }

  function initLeavePortalStudio() {
    const incoming = ingestIncomingLeavePayloadFromUrl();
    syncLeaveNotificationBadges();

    if ($("studentQuickLeaveTopBtn")) {
      $("studentQuickLeaveTopBtn").addEventListener("click", () => switchTab("leave"));
    }
    if ($("facQuickLeaveTopBtn")) {
      $("facQuickLeaveTopBtn").addEventListener("click", () => switchTab("leave"));
    }

    if (LIVE_SYNC_CHANNEL) {
      LIVE_SYNC_CHANNEL.addEventListener("message", (ev) => {
        const data = ev.data || {};
        if (data.kind === "slides_updated") {
          slidesRegistryCache = loadSlidesRegistry();
          if (state.activeTab === "schedule") renderScheduleCurrent();
        } else if (data.kind === "leave_updated") {
          syncLeaveNotificationBadges();
          if (state.activeTab === "leave") renderLeavePortalView();
        } else if (data.kind === "nicknames_updated") {
          nicknameOverridesCache = loadJsonMapSafe(NICKNAME_OVERRIDES_KEY);
          (ROSTER.students || []).forEach((s) => {
            const eff = getEffectiveNickname(s);
            if (eff) s.nickname = eff;
          });
          if (state.activeTab === "discussion") renderDiscussionView();
          else if (state.activeTab === "fieldwork") renderFieldworkView();
          if (typeof renderRoleConcierge === "function") renderRoleConcierge();
        }
      });
    }

    if (incoming && ROLE === "faculty") {
      setTimeout(() => {
        switchTab("leave");
        renderLeavePortalView(incoming.refId);
      }, 50);
    }
  }

  /* ---------- Faculty-Only: Mentimeter Live Student Response Wall & Next-Slide Teacher Answer Key ---------- */
  function getFacultyKeySearchText(qId) {
    const tk = (HSD_KEY.keys || {})[qId];
    if (!tk) return "";
    const parts = [tk.scoreLabel || "", ...(tk.rubric || [])];
    if (tk.keyTable && tk.keyTable.rows) {
      tk.keyTable.rows.forEach((r) => parts.push(...r));
    }
    if (tk.hsBridge) {
      parts.push(tk.hsBridge.ref || "", ...(tk.hsBridge.insights || []));
    }
    return parts.join(" ");
  }

  function appendFacultyFacilitationPlan(modSec, modId) {
    const plan = (HSD_KEY.facilitationPlans || {})[modId];
    if (!plan) return;
    const box = make("div", null, "hsd-facilitation-box");
    box.appendChild(
      make("h4", `แผนการจัดสรรเวลาและแนวทางนำอภิปรายกลุ่มย่อยสำหรับอาจารย์ (${plan.duration})`)
    );
    const ul = document.createElement("ul");
    (plan.steps || []).forEach((st) => ul.appendChild(make("li", st)));
    box.appendChild(ul);
    modSec.appendChild(box);
  }

  function openStudentResponseSpotlight(rec, qObj, idxNum) {
    const modal = $("hsdSpotlightModal");
    const card = $("hsdSpotlightCard");
    if (!modal || !card) return;
    card.replaceChildren();

    const isAnon = LIVE && LIVE.getAnonymousWall();
    const author = isAnon
      ? `ผู้ร่วมอภิปราย #${idxNum + 1}`
      : `${rec.displayName || "นักศึกษา"}${rec.area ? " · พื้นที่ " + rec.area : ""}`;

    const top = make("div", null, "hsd-tk-header");
    top.append(
      make("h4", `คำตอบสดจากห้องกลุ่ม ${LIVE ? LIVE.getRoomId() : 1}: ${author}`, "hsd-tk-title"),
      make(
        "span",
        rec.status === "submitted" ? "✓ ส่งคำตอบแล้ว" : "✍ กำลังพิมพ์สด…",
        `hsd-resp-status ${rec.status === "submitted" ? "is-submitted" : "is-typing"}`
      )
    );
    card.appendChild(top);

    const qInfo = make("p", `${qObj.label}: ${qObj.title}`, "hsd-q-prompt");
    qInfo.style.fontWeight = "600";
    qInfo.style.marginBottom = "10px";
    card.appendChild(qInfo);

    const ws = qObj.worksheet;
    if (ws && ws.headers && ws.rows) {
      const tblWrap = make("div", null, "hsd-ws-wrap");
      const tbl = make("table", null, "hsd-ws-table");
      if (ws.colWidths && ws.colWidths.length === ws.headers.length) {
        const cg = document.createElement("colgroup");
        ws.colWidths.forEach((w) => {
          const c = document.createElement("col");
          c.style.width = w;
          cg.appendChild(c);
        });
        tbl.appendChild(cg);
      }
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      ws.headers.forEach((h) => hr.appendChild(make("th", h)));
      thead.appendChild(hr);
      const tbody = document.createElement("tbody");
      ws.rows.forEach((r) => {
        const tr = document.createElement("tr");
        (r.cells || []).forEach((cell) => {
          const td = document.createElement("td");
          if (cell.static) {
            td.className = "hsd-ws-static";
            td.innerHTML = escapeHtml(cell.static).replace(/\n/g, "<br>");
          } else if (cell.inputId) {
            const ans = (rec.cells && rec.cells[cell.inputId]) || "";
            td.innerHTML = ans
              ? escapeHtml(ans).replace(/\n/g, "<br>")
              : `<span style="color:var(--muted)">—</span>`;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.append(thead, tbody);
      tblWrap.appendChild(tbl);
      card.appendChild(tblWrap);
    }

    const closeRow = make("div", null, "header-actions");
    closeRow.style.justifyContent = "flex-end";
    closeRow.style.marginTop = "12px";
    const closeBtn = make("button", "ปิดหน้าต่างขยาย (Esc)", "btn sm primary");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
      modal.hidden = true;
    });
    closeRow.appendChild(closeBtn);
    card.appendChild(closeRow);
    modal.hidden = false;
  }

  function populateLiveWallBody(wallEl, qObj) {
    if (!wallEl || !LIVE) return;
    const countBadge = wallEl.querySelector("[data-live-count]");
    const grid = wallEl.querySelector("[data-live-grid]");
    const anonBtn = wallEl.querySelector("[data-live-anon-btn]");
    if (!grid) return;

    const list = LIVE.getQuestionResponses(qObj.id);
    const submittedCnt = list.filter((x) => x.status === "submitted").length;
    const typingCnt = list.length - submittedCnt;
    const roomNum = LIVE.getRoomId();

    if (countBadge) {
      countBadge.textContent = list.length
        ? `กลุ่ม ${roomNum}: ส่งแล้ว ${submittedCnt} · กำลังพิมพ์ ${typingCnt} คน`
        : `กลุ่ม ${roomNum}: รอคำตอบสด…`;
    }
    if (anonBtn) {
      anonBtn.textContent = LIVE.getAnonymousWall() ? "👁 แสดงชื่อ นศพ." : "🙈 ซ่อนชื่อ (Anonymous)";
    }

    grid.replaceChildren();
    if (!list.length) {
      grid.appendChild(
        make(
          "div",
          `เมื่อนักศึกษาในห้องกลุ่มที่ ${roomNum} เริ่มพิมพ์คำตอบในข้อนี้ ข้อความจะปรากฏขึ้นบนจอนี้แบบ Real-time ทันที`,
          "hsd-resp-empty"
        )
      );
      return;
    }

    const labelMap = buildInputLabelMap(qObj);
    const isAnon = LIVE.getAnonymousWall();

    list.forEach((rec, idx) => {
      const card = make(
        "div",
        null,
        `hsd-resp-card ${rec.status === "submitted" ? "is-submitted" : "is-typing"}`
      );
      card.title = "คลิกเพื่อขยายคำตอบนี้ขึ้นจอโปรเจกเตอร์";

      const top = make("div", null, "hsd-resp-top");
      const authorLabel = isAnon
        ? `ผู้เรียนนิรนาม #${idx + 1}`
        : rec.displayName || "นักศึกษาในห้อง";
      top.append(
        make("span", authorLabel, "hsd-resp-author"),
        make(
          "span",
          rec.status === "submitted" ? "✓ ส่งแล้ว" : "✍ กำลังพิมพ์…",
          `hsd-resp-status ${rec.status === "submitted" ? "is-submitted" : "is-typing"}`
        )
      );
      card.appendChild(top);

      const cellsWrap = make("div", null, "hsd-resp-cells");
      const entries = Object.entries(rec.cells || {});
      entries.slice(0, 6).forEach(([inputId, val]) => {
        const line = make("div", null, "hsd-resp-line");
        const lbl = labelMap[inputId] || inputId;
        line.innerHTML = `<strong>${escapeHtml(lbl)}:</strong> ${escapeHtml(val)}`;
        cellsWrap.appendChild(line);
      });
      if (entries.length > 6) {
        cellsWrap.appendChild(
          make("div", `…อีก ${entries.length - 6} ช่อง (คลิกเพื่อดูตารางเต็ม)`, "hsd-resp-line")
        );
      }
      card.appendChild(cellsWrap);
      card.addEventListener("click", () => openStudentResponseSpotlight(rec, qObj, idx));
      grid.appendChild(card);
    });
  }

  function renderFacultyLiveWallForQuestion(qObj) {
    const wall = make("div", null, "hsd-live-wall hsd-no-print");
    wall.dataset.liveWallQid = qObj.id;

    const head = make("div", null, "hsd-live-wall-head");
    const titleWrap = make("div", null, "hsd-live-wall-title");
    const badge = make("span", "", "hsd-live-count-badge");
    badge.setAttribute("data-live-count", "1");
    titleWrap.append(make("span", "📡 Live Responses (เห็นสดขณะเด็กพิมพ์)"), badge);

    const acts = make("div", null, "hsd-timer-controls");
    const anonBtn = make("button", "", "hsd-tbtn");
    anonBtn.type = "button";
    anonBtn.setAttribute("data-live-anon-btn", "1");
    anonBtn.addEventListener("click", () => {
      if (!LIVE) return;
      LIVE.setAnonymousWall(!LIVE.getAnonymousWall());
    });

    const clrBtn = make("button", "ล้างคำตอบบนจอข้อนี้", "hsd-tbtn");
    clrBtn.type = "button";
    clrBtn.addEventListener("click", () => {
      if (!LIVE) return;
      if (!window.confirm(`ต้องการล้างคำตอบสดบนจอของ "${qObj.label}" ในห้องกลุ่มที่ ${LIVE.getRoomId()} หรือไม่?`)) return;
      LIVE.clearQuestionResponses(qObj.id);
    });

    acts.append(anonBtn, clrBtn);
    head.append(titleWrap, acts);

    const grid = make("div", null, "hsd-resp-grid");
    grid.setAttribute("data-live-grid", "1");

    wall.append(head, grid);
    populateLiveWallBody(wall, qObj);
    return wall;
  }

  function refreshLiveWallByQuestionId(questionId) {
    document.querySelectorAll("[data-live-wall-qid]").forEach((wallEl) => {
      const qid = wallEl.dataset.liveWallQid;
      if (questionId === "*" || qid === questionId) {
        const ctx = findQuestionContextById(qid);
        if (ctx && ctx.qObj) populateLiveWallBody(wallEl, ctx.qObj);
      }
    });
  }

  function refreshAllVisibleLiveWalls() {
    refreshLiveWallByQuestionId("*");
  }

  function buildFacultyTeacherKeyPanelDOM(qObj, modObj) {
    const tk = (HSD_KEY.keys || {})[qObj.id];
    if (!tk) return make("div", "ไม่พบข้อมูลเฉลยสำหรับข้อย่อยนี้", "empty-state");

    const panel = make("div", null, "hsd-teacher-key-panel");
    const tkHead = make("div", null, "hsd-tk-header");
    tkHead.append(
      make("h6", `★ แนวคำตอบมาตรฐานสำหรับอาจารย์ (Teacher Answer Key · ${qObj.label})`, "hsd-tk-title"),
      make("span", tk.scoreLabel || "", "hsd-tk-score-pill")
    );
    panel.appendChild(tkHead);

    if (tk.keyTable && tk.keyTable.headers && tk.keyTable.rows) {
      const tblWrap = make("div", null, "clean-table-wrap");
      const tbl = make("table", null, "clean-table hsd-tk-table");
      if (tk.keyTable.colWidths && tk.keyTable.colWidths.length === tk.keyTable.headers.length) {
        const cg = document.createElement("colgroup");
        tk.keyTable.colWidths.forEach((w) => {
          const col = document.createElement("col");
          col.style.width = w;
          cg.appendChild(col);
        });
        tbl.appendChild(cg);
      }
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      tk.keyTable.headers.forEach((h) => hr.appendChild(make("th", h)));
      thead.appendChild(hr);
      const tbody = document.createElement("tbody");
      tk.keyTable.rows.forEach((r) => {
        const tr = document.createElement("tr");
        r.forEach((cellText, idx) => {
          const td = document.createElement("td");
          if (idx === 0 || (tk.keyTable.headers.length === 4 && idx === 1)) {
            td.style.fontWeight = "600";
          }
          td.innerHTML = escapeHtml(cellText).replace(/\n/g, "<br>");
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.append(thead, tbody);
      tblWrap.appendChild(tbl);
      panel.appendChild(tblWrap);
    }

    const grid = make("div", null, "hsd-tk-grid");
    if (tk.rubric && tk.rubric.length) {
      const rCard = make("div", null, "hsd-rubric-card");
      rCard.appendChild(make("h5", "เกณฑ์การให้คะแนนและการพิจารณาความสอดคล้อง (Scoring Rubric)"));
      const ul = document.createElement("ul");
      tk.rubric.forEach((it) => ul.appendChild(make("li", it)));
      rCard.appendChild(ul);
      grid.appendChild(rCard);
    }

    if (tk.hsBridge) {
      const bCard = make("div", null, "hsd-bridge-card");
      bCard.appendChild(make("h5", `เชื่อมโยงทฤษฎี ${tk.hsBridge.ref || modObj.code} & แนวทางนำอภิปรายต่อยอด`));
      const ul = document.createElement("ul");
      (tk.hsBridge.insights || []).forEach((it) => ul.appendChild(make("li", it)));
      bCard.appendChild(ul);
      if (modObj && modObj.docId) {
        const jumpBtn = make("button", `เปิดอ่านบทเรียน ${modObj.code} ฉบับเต็ม →`, "btn sm teal hsd-no-print");
        jumpBtn.type = "button";
        jumpBtn.style.marginTop = "6px";
        jumpBtn.addEventListener("click", () => openTextbookDoc(modObj.docId));
        bCard.appendChild(jumpBtn);
      }
      grid.appendChild(bCard);
    }

    panel.appendChild(grid);
    return panel;
  }

  function appendFacultyTeacherKey(qBlock, qObj, caseObj, modObj) {
    const tk = (HSD_KEY.keys || {})[qObj.id];
    if (!tk) return;

    const isProjector = state.hsdFacultyMode === "projector";
    const isRevealed = !isProjector || state.hsdRevealedKeys.has(qObj.id);
    const panel = buildFacultyTeacherKeyPanelDOM(qObj, modObj);
    panel.hidden = !isRevealed;

    if (isProjector) {
      const toggleRow = make("div", null, "hsd-projector-toggle-row hsd-no-print");
      const revBtn = make(
        "button",
        isRevealed
          ? `ซ่อนเฉลยอาจารย์ (${qObj.label}) ▴`
          : `เปิดเฉลยอาจารย์และเกณฑ์คะแนน (${qObj.label}) ▾`,
        isRevealed ? "btn sm" : "btn sm primary"
      );
      revBtn.type = "button";
      revBtn.addEventListener("click", () => {
        if (state.hsdRevealedKeys.has(qObj.id)) state.hsdRevealedKeys.delete(qObj.id);
        else state.hsdRevealedKeys.add(qObj.id);
        const openNow = state.hsdRevealedKeys.has(qObj.id);
        panel.hidden = !openNow;
        revBtn.textContent = openNow
          ? `ซ่อนเฉลยอาจารย์ (${qObj.label}) ▴`
          : `เปิดเฉลยอาจารย์และเกณฑ์คะแนน (${qObj.label}) ▾`;
        revBtn.className = openNow ? "btn sm" : "btn sm primary";
      });
      toggleRow.appendChild(revBtn);
      qBlock.appendChild(toggleRow);
    }

    qBlock.appendChild(panel);
  }

  function renderFacultyKeySlideStage(qObj, caseObj, modObj) {
    const stage = make("div", null, "hsd-key-slide-stage");

    // Repeat Question + Title right at the top so Question + Answer Key stay on the SAME slide!
    const recap = make("div", null, "hsd-key-question-recap");
    const topBadges = make("div", null, "hsd-q-head-top");
    topBadges.append(
      make("span", `${modObj.code} · กรณีที่ ${caseObj.caseNumber} · ${qObj.label}`, "hsd-q-badge"),
      make("span", "สไลด์เฉลยอาจารย์ (คำถามคู่แนวคำตอบหน้าเดียวกัน)", "hsd-tk-score-pill")
    );
    recap.appendChild(topBadges);
    recap.appendChild(make("h5", `${caseObj.title} — ${qObj.title}`, "hsd-q-title"));
    recap.appendChild(make("p", qObj.prompt, "hsd-q-prompt"));
    stage.appendChild(recap);

    // Full Teacher Answer Key + Rubric + HS Bridge
    stage.appendChild(buildFacultyTeacherKeyPanelDOM(qObj, modObj));

    // Collapsible Live Responses right below so Teacher can compare student answers vs Answer Key
    const cmpDetails = document.createElement("details");
    cmpDetails.open = true;
    const sum = make("summary", "เทียบกับคำตอบสดของนักศึกษาในห้องกลุ่มนี้ (Live Responses)", "sidebar-label");
    sum.style.cursor = "pointer";
    sum.style.marginBottom = "5px";
    cmpDetails.appendChild(sum);
    cmpDetails.appendChild(renderFacultyLiveWallForQuestion(qObj));
    stage.appendChild(cmpDetails);

    return stage;
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
    initUniversalOmniboxSearch();
    initScheduleControls();
    initSlideStudioAndCalendarHover();
    initDiscussionControls();
    initHsDiscussionControls();
    initFieldworkControls();
    initSubmissionsControls();
    initLeavePortalStudio();
    initManualControls();
    initTextbooksControls();
    initPracticeControls();
    if (ROLE === "faculty" && typeof initFacultyDocsControls === "function") {
      initFacultyDocsControls();
    }
    initRoleConcierge();
    initGlobalSpotlightAndFab();
    syncLiveNicknamesFromGoogleSheet();

    const params = new URLSearchParams(window.location.search);
    const moodleParam = params.get("moodle_url");
    if (moodleParam && isValidRamedUrl(moodleParam)) {
      state.pinnedRamedUrl = moodleParam.trim();
      localStorage.setItem("racm303_moodle_course_url", state.pinnedRamedUrl);
      syncPinnedRamedCourseUI();
    }

    // Restore saved student or teacher after all <select> dropdowns are populated
    const savedId = localStorage.getItem("racm303_my_sid");
    const savedTeacher = ROLE === "faculty" ? localStorage.getItem("racm303_my_teacher") : "";
    if (savedId) {
      const found = ROSTER.students.find((s) => s.id === savedId);
      if (found) {
        state.calScope = "student";
        applyMyStudent(found, true);
      }
    } else if (ROLE === "faculty" && savedTeacher) {
      selectActiveTeacher(savedTeacher, true);
    }
    syncLeaveNotificationBadges();

    if (params.get("page") === "hs-discussion") {
      const m = (params.get("module") || "").toUpperCase();
      if (/^HS[1-6]$/.test(m)) state.hsdModule = m;
      switchTab("hs-discussion", false);
      return;
    }

    if (params.get("page") === "students") {
      const t = params.get("type");
      const g = params.get("group") || "";
      if (t === "discussion") {
        if ($("discGroupSelect")) $("discGroupSelect").value = g;
        switchTab("discussion", false);
        return;
      }
      if ($("fieldAreaSelect")) $("fieldAreaSelect").value = g;
      switchTab("fieldwork", false);
      return;
    }

    if (params.get("page") === "submissions" || params.get("page") === "elearning") {
      switchTab("submissions", false);
      return;
    }

    if (params.get("page") === "leave" || params.get("incoming_leave")) {
      switchTab("leave", false);
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
