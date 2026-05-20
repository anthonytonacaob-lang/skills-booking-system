// ============================================================
// js/utils.js — Shared utilities for both admin and public pages
// ============================================================

const TIMES = [
  "6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
  "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
  "6:00 PM","7:00 PM","8:00 PM","9:00 PM",
];

// ============================================================
// TIME UTILITIES
// ============================================================

/**
 * Converts "h:mm AM/PM" to a decimal hour number.
 * e.g. "2:30 PM" → 14.5
 *
 * @param  {string} timeStr
 * @returns {number|null}
 */
function parseTimeToNumber(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(" ");
  if (parts.length < 2) return null;
  const tp   = parts[0].split(":");
  let hours  = parseInt(tp[0]) || 0;
  const ampm = parts[1].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours  = 0;
  return hours + (parseInt(tp[1]) || 0) / 60;
}

/**
 * Generates a unique booking ID. e.g. "BKG-250519-4823"
 * @returns {string}
 */
function generateBookingID() {
  const d   = new Date();
  const y   = d.getFullYear().toString().slice(-2);
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `BKG-${y}${m}${day}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Returns today's date as "yyyy-MM-dd".
 * @returns {string}
 */
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ============================================================
// BILLING CALCULATOR
// ============================================================

const RATES = {
  day:   { regular: 450,  pkgA: 1500, pkgB: 600,  pkgC: 550  },
  night: { regular: 550,  pkgA: 2500, pkgB: 700,  pkgC: 650  },
};

/**
 * Calculates the base cost for a single slot.
 *
 * @param  {string} sport      Sport/package name
 * @param  {number} startNum   Decimal start hour
 * @param  {number} endNum     Decimal end hour
 * @returns {number}           Base amount in PHP
 */
function calcSlotBase(sport, startNum, endNum) {
  const dayH   = Math.max(0, Math.min(endNum, 17) - Math.max(startNum, 6));
  const nightH = Math.max(0, Math.min(endNum, 22) - Math.max(startNum, 17));

  let dayRate   = RATES.day.regular;
  let nightRate = RATES.night.regular;

  if (sport === "Package A") { dayRate = RATES.day.pkgA;   nightRate = RATES.night.pkgA; }
  else if (sport === "Package B") { dayRate = RATES.day.pkgB; nightRate = RATES.night.pkgB; }
  else if (sport === "Package C") { dayRate = RATES.day.pkgC; nightRate = RATES.night.pkgC; }

  return dayH * dayRate + nightH * nightRate;
}

// ============================================================
// COURT RESTRICTION LOGIC
// ============================================================

/**
 * Returns the allowed courts for a given sport/package.
 * @param  {string} sport
 * @returns {string[]}
 */
function getAllowedCourts(sport) {
  if (sport === "Volleyball") return ["Court 1", "Court 3"];
  if (sport === "Badminton")  return ["Court 2"];
  if (sport === "Package A")  return ["Whole Gym"];
  return ["Court 1", "Court 2", "Court 3"];
}

/**
 * Updates a court <select> based on the chosen sport.
 * Disables it and selects the default when only one option exists.
 *
 * @param {HTMLSelectElement} sportSel  The sport dropdown
 */
function handleSportChange(sportSel) {
  if (!sportSel) return;
  const block    = sportSel.closest(".batch-block");
  const courtSel = block.querySelector(".event-court");
  const remarks  = block.querySelector(".event-remarks");
  const sport    = sportSel.value;
  const prev     = courtSel.value;
  const allowed  = getAllowedCourts(sport);

  courtSel.innerHTML  = "";
  allowed.forEach(c => courtSel.appendChild(new Option(c, c)));
  courtSel.value    = allowed.includes(prev) ? prev : allowed[0];
  courtSel.disabled = false;

  if (sport === "Package A") {
    courtSel.disabled = true;
    if (remarks) remarks.value = "Pkg A: Whole Gym (3 courts), Bleachers, Fan, Lights.";
  } else if (sport === "Package B") {
    courtSel.value    = "Court 1";
    courtSel.disabled = true;
    if (remarks) remarks.value = "Pkg B: Exclusive use of Bleachers, Fan, Lights (Max 80).";
  } else if (sport === "Package C") {
    if (remarks) remarks.value = "Pkg C: Fan and Lights (Max 50).";
  } else {
    if (remarks) remarks.value = "Regular Game (Max 20).";
  }
}

/**
 * Populates start/end time dropdowns for a batch block.
 * @param {HTMLElement} block
 */
function populateTimeDropdowns(block) {
  const startSel = block.querySelector(".event-start");
  const endSel   = block.querySelector(".event-end");
  TIMES.forEach(t => {
    startSel.appendChild(new Option(t, t));
    endSel.appendChild(new Option(t, t));
  });
  endSel.appendChild(new Option("10:00 PM", "10:00 PM"));
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

let toastTimer;

/**
 * Shows a brief toast notification at the bottom-right of the screen.
 *
 * @param {string} message
 * @param {"success"|"error"} [type="success"]
 */
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent  = message;
  toast.className    = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = ""; }, 3500);
}

// ============================================================
// MODAL HELPERS
// ============================================================

/**
 * Opens the shared modal with configurable content.
 *
 * @param {Object} opts
 * @param {string}   opts.title
 * @param {string}   opts.message
 * @param {boolean}  [opts.isError]
 * @param {string}   [opts.confirmText]   Label for confirm button (omit to hide)
 * @param {string}   [opts.cancelText]    Label for cancel button  (omit to hide)
 * @param {Function} [opts.onConfirm]
 * @param {Function} [opts.onCancel]
 * @param {boolean}  [opts.showInput]     Show the reject-reason input
 */
function openModal({
  title, message, isError = false,
  confirmText, cancelText,
  onConfirm, onCancel,
  showInput = false,
} = {}) {
  const overlay     = document.getElementById("customAlert");
  const card        = document.getElementById("alertCard");
  const titleEl     = document.getElementById("alertTitle");
  const messageEl   = document.getElementById("alertMessage");
  const inputArea   = document.getElementById("rejectInputArea");
  const confirmBtn  = document.getElementById("alertBtnAction");
  const cancelBtn   = document.getElementById("alertBtnClose");

  titleEl.innerText   = title   || "Notice";
  messageEl.innerText = message || "";
  card.classList.toggle("error", isError);
  inputArea.style.display = showInput ? "block" : "none";
  if (showInput) document.getElementById("rejectReason").value = "";

  if (confirmText) {
    confirmBtn.style.display = "inline-block";
    confirmBtn.innerText     = confirmText;
    confirmBtn.onclick       = onConfirm || closeModal;
  } else {
    confirmBtn.style.display = "none";
  }

  if (cancelText) {
    cancelBtn.style.display = "inline-block";
    cancelBtn.innerText     = cancelText;
    cancelBtn.onclick       = onCancel || closeModal;
  } else {
    cancelBtn.style.display = "none";
  }

  overlay.classList.add("active");
}

function closeModal() {
  const overlay = document.getElementById("customAlert");
  if (overlay) overlay.classList.remove("active");
}

// ============================================================
// SCHEDULE GRID RENDERER (shared by admin + public)
// ============================================================

/**
 * Renders the court availability grid into a target element.
 *
 * @param {HTMLElement} gridEl       Target element
 * @param {Object[]}    sessions     Bookings from getBookingsForDate()
 * @param {Object}      [opts]
 * @param {boolean}     [opts.confirmedOnly]  Only show CONFIRMED bookings (Gate view)
 * @param {boolean}     [opts.showIDs]        Show short booking IDs on booked cells
 */
function renderScheduleGrid(gridEl, sessions, opts = {}) {
  const { confirmedOnly = false, showIDs = false } = opts;

  let html = `
    <div></div>
    <div class="header-cell">COURT 1</div>
    <div class="header-cell">COURT 2</div>
    <div class="header-cell">COURT 3</div>`;

  TIMES.forEach((time, idx) => {
    const slotNum  = parseTimeToNumber(time);
    const nextTime = TIMES[idx + 1] || "10:00 PM";
    html += `<div class="time-cell">${time} to ${nextTime}</div>`;

    ["Court 1", "Court 2", "Court 3"].forEach(court => {
      let status = "AVAILABLE";
      let label  = "";

      for (const s of (sessions || [])) {
        if (s.court !== court && s.court !== "Whole Gym") continue;
        if (confirmedOnly && s.type !== "CONFIRMED") continue;

        const sN = parseTimeToNumber(s.startTime);
        const eN = parseTimeToNumber(s.endTime);
        if (sN === null || eN === null) continue;

        if (slotNum >= sN && slotNum < eN) {
          status = s.type === "PENDING" ? "RESERVED" : "BOOKED";

          if (showIDs && s.type === "CONFIRMED") {
            const parts = s.bookingID?.includes("-") ? s.bookingID.split("-") : null;
            const shortID = parts ? `#${parts[parts.length - 1]}` : "BOOKED";
            const sport   = s.sport ? `<br><span style="font-size:0.75em;font-weight:600;">(${s.sport})</span>` : "";
            label = shortID + sport;
          } else {
            const sport = s.sport ? `<br><span style="font-size:0.85em;font-weight:500;">(${s.sport})</span>` : "";
            label = (status === "BOOKED" ? "TAKEN" : "RESERVED") + sport;
          }
          break;
        }
      }

      if      (status === "BOOKED")    html += `<div class="status-btn booked">${label}</div>`;
      else if (status === "RESERVED")  html += `<div class="status-btn reserved">${label}</div>`;
      else                             html += `<div class="status-btn available">OPEN</div>`;
    });
  });

  gridEl.innerHTML = html;
}

// ============================================================
// RECEIPT FILL HELPERS
// ============================================================

/** Sets innerText on all elements matching a class name. */
function fillText(cls, text)    { document.querySelectorAll("." + cls).forEach(el => (el.innerText  = text)); }
/** Sets innerHTML on all elements matching a class name. */
function fillHTML(cls, html)    { document.querySelectorAll("." + cls).forEach(el => (el.innerHTML  = html)); }
/** Sets display style on all elements matching a class name. */
function fillDisplay(cls, disp) { document.querySelectorAll("." + cls).forEach(el => (el.style.display = disp)); }

/**
 * Populates the printable receipt with booking payload data.
 * @param {Object} payload  Booking payload
 */
function populateReceipt(payload) {
  fillText("r_currentDate", new Date().toLocaleString());
  fillText("r_bookingID",   payload.bookingID);
  fillText("r_name",        payload.fullName);
  fillText("r_org",         payload.organization || "N/A");
  fillText("r_address",     payload.address      || "N/A");
  fillText("r_email",       payload.emailAddress || "N/A");
  fillText("r_idType",      payload.idType       || "N/A");
  fillText("r_idNumber",    payload.idNumber     || "N/A");
  fillText("r_payment",     payload.paymentMode);

  if (payload.paymentMode === "Online Transfer") {
    fillDisplay("r_transactionRefRow", "flex");
    fillText("r_transactionRef", payload.transactionRef || "N/A");
  } else {
    fillDisplay("r_transactionRefRow", "none");
  }

  let batchHTML = "";
  for (let i = 0; i < payload.dateOfEvent.length; i++) {
    batchHTML += `
      <div class="batch-item">
        <strong style="color:#0f172a;">${payload.dateOfEvent[i]}</strong> — ${payload.court[i]} (${payload.sportType[i]})<br>
        <span style="color:#64748b;">${payload.timeStarted[i]} to ${payload.timeEnded[i]} | ${payload.totalHours[i]} hrs</span>
      </div>`;
  }
  fillHTML("r_batchList", batchHTML);

  const totalBase = (payload.batchBases || []).reduce((a, b) => a + b, 0);
  fillText("r_base", totalBase.toFixed(2));

  const addLabel = payload.additionalChargesText && payload.additionalChargesText !== "0"
    ? payload.additionalChargesText : "None";
  fillText("r_add", `PHP ${(payload.dailyAdd || 0).toFixed(2)} (${addLabel})`);
  fillText("r_total", (payload.grandTotal || 0).toFixed(2));

  // Waiver fields
  fillText("w_name",      payload.fullName);
  fillText("w_org",       payload.organization || "N/A");
  fillText("w_address",   payload.address || "_______________________");
  fillText("w_date_fill", new Date().toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" }));
}
