// ============================================================
// js/public.js — Public Booking Form Logic
// ============================================================

let timerInterval = null;

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Set date picker to today
  const checkDate = document.getElementById("checkDate");
  if (checkDate) {
    checkDate.value = todayISO();
    loadPublicSchedule();
  }

  // Render the first batch block
  addPublicBatchBlock();
});

// ============================================================
// LIVE SCHEDULE
// ============================================================

async function loadPublicSchedule() {
  const date = document.getElementById("checkDate")?.value;
  if (!date) return;

  const loadMsg = document.getElementById("loadingMsg");
  if (loadMsg) loadMsg.style.display = "block";

  try {
    const sessions = await getBookingsForDate(date);
    renderScheduleGrid(document.getElementById("grid"), sessions);
  } catch (err) {
    showToast("Could not load schedule. Please try again.", "error");
    console.error(err);
  }

  if (loadMsg) loadMsg.style.display = "none";
}

// ============================================================
// BATCH SLOT BLOCKS
// ============================================================

/** Appends a new booking slot block to the public form. */
function addPublicBatchBlock() {
  const wrapper = document.getElementById("batchBlocksWrapper");
  const isFirst = wrapper.children.length === 0;
  const div     = document.createElement("div");
  div.className = "batch-block";

  div.innerHTML = `
    ${!isFirst ? `<button type="button" class="remove-batch-btn" onclick="this.parentElement.remove();">✕ Remove</button>` : ""}
    <div class="form-group">
      <label class="form-label">Date of Event</label>
      <input type="date" class="form-control event-date" min="${todayISO()}">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Sport / Package</label>
        <select class="form-control event-sport" onchange="handleSportChange(this)">
          <option value="Basketball">Basketball</option>
          <option value="Volleyball">Volleyball</option>
          <option value="Badminton">Badminton</option>
          <option value="Pickleball">Pickleball</option>
          <option value="Package A">Package A</option>
          <option value="Package B">Package B</option>
          <option value="Package C">Package C</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">Facility</label>
        <select class="form-control event-court">
          <option value="Court 1">Court 1</option>
          <option value="Court 2">Court 2</option>
          <option value="Court 3">Court 3</option>
          <option value="Whole Gym">Whole Gym</option>
        </select>
      </div>
    </div>
    <div class="form-row" style="margin-bottom:0;">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Time Started</label>
        <select class="form-control event-start">
          <option value="" disabled selected>Select start…</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">Time Ended</label>
        <select class="form-control event-end">
          <option value="" disabled selected>Select end…</option>
        </select>
      </div>
    </div>`;

  wrapper.appendChild(div);
  populateTimeDropdowns(div);
  handleSportChange(div.querySelector(".event-sport"));
}

// ============================================================
// QUOTE MODAL
// ============================================================

/** Validates the form and shows the estimated cost summary modal. */
function showQuoteModal() {
  const fullName     = document.getElementById("fullName").value.trim();
  const emailAddress = document.getElementById("emailAddress").value.trim();

  if (!fullName || !emailAddress) {
    showPublicModal("Please provide your Full Name and Email Address before proceeding.", "Missing Info", "⚠️");
    return;
  }

  let totalBase  = 0;
  let hasValid   = false;
  let hasError   = false;
  let isTooSoon  = false;
  let slotsHtml  = "";
  const now      = new Date();

  document.querySelectorAll(".batch-block").forEach(block => {
    const dateVal  = block.querySelector(".event-date").value;
    const startStr = block.querySelector(".event-start").value;
    const endStr   = block.querySelector(".event-end").value;
    const sport    = block.querySelector(".event-sport").value;
    const court    = block.querySelector(".event-court").value;

    if (!dateVal || !startStr || !endStr) return;
    hasValid = true;

    const start = parseTimeToNumber(startStr);
    const end   = parseTimeToNumber(endStr);

    if (end <= start) { hasError = true; return; }

    // Enforce 3-hour advance booking rule
    const [year, month, day] = dateVal.split("-").map(Number);
    const startHour  = Math.floor(start);
    const startMin   = Math.round((start - startHour) * 60);
    const bookingDT  = new Date(year, month - 1, day, startHour, startMin, 0);
    const diffHours  = (bookingDT - now) / (1000 * 60 * 60);
    if (diffHours < 3) { isTooSoon = true; }

    const hours = end - start;
    const base  = calcSlotBase(sport, start, end);
    totalBase  += base;

    slotsHtml += `
      <div style="margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
        <strong>${dateVal}</strong> | ${court} (${sport})<br>
        <span style="color:var(--text-muted);">${startStr} to ${endStr} (${hours} hrs)</span><br>
        <span style="color:var(--primary-blue); font-weight:700;">PHP ${base.toFixed(2)}</span>
      </div>`;
  });

  if (!hasValid)   { showPublicModal("Please fill out at least one complete booking slot.", "Incomplete Slot", "⚠️"); return; }
  if (hasError)    { showPublicModal("Time Error: Start time must be before end time.", "Time Error", "⏰"); return; }
  if (isTooSoon)   { showPublicModal("You must book at least 3 hours in advance. Please select a later time or a different date.", "Too Soon", "⏳"); return; }

  document.getElementById("quoteDetails").innerHTML = slotsHtml || "<p>No slots added.</p>";
  document.getElementById("quoteTotal").innerText   = totalBase.toFixed(2);
  document.getElementById("quoteModal").style.display = "flex";
}

function closeQuoteModal() {
  document.getElementById("quoteModal").style.display = "none";
}

// ============================================================
// FORM SUBMISSION
// ============================================================

/** Collects form data and submits a pending reservation to Firestore. */
async function submitRequest() {
  const btn = document.getElementById("payCashierBtn");
  btn.innerHTML = `<span class="spinner"></span> Submitting…`;
  btn.disabled  = true;

  const dates=[], courts=[], sports=[], starts=[], ends=[];

  document.querySelectorAll(".batch-block").forEach(block => {
    const dateVal  = block.querySelector(".event-date").value;
    const startStr = block.querySelector(".event-start").value;
    const endStr   = block.querySelector(".event-end").value;
    if (!dateVal || !startStr || !endStr) return;

    dates.push(dateVal);
    courts.push(block.querySelector(".event-court").value);
    sports.push(block.querySelector(".event-sport").value);
    starts.push(startStr);
    ends.push(endStr);
  });

  const payload = {
    fullName:     document.getElementById("fullName").value.trim(),
    organization: document.getElementById("orgName").value.trim(),
    emailAddress: document.getElementById("emailAddress").value.trim(),
    address:      document.getElementById("address").value.trim(),
    idType:       document.getElementById("idType").value,
    idNumber:     document.getElementById("idNumber").value.trim(),
    dateOfEvent:  dates,
    court:        courts,
    sportType:    sports,
    timeStarted:  starts,
    timeEnded:    ends,
    paymentMode:  "Cash",
    transactionRef: "",
  };

  try {
    const reqID = await submitPublicRequest(payload);
    closeQuoteModal();
    showSuccessScreen(reqID);
  } catch (err) {
    showPublicModal("Error: " + err.message, "Submission Failed", "❌");
    btn.innerHTML = "Pay at the Cashier (Reserve Slot)";
    btn.disabled  = false;
  }
}

// ============================================================
// SUCCESS SCREEN + COUNTDOWN
// ============================================================

/** Hides the form and shows the success screen with countdown timer. */
function showSuccessScreen(reqID) {
  document.getElementById("formCard").style.display   = "none";
  document.getElementById("reqIdLabel").innerText     = reqID;
  document.getElementById("successBox").style.display = "block";
  startCountdown();
}

/** Starts a 20-minute countdown timer. Reloads the page on expiry. */
function startCountdown() {
  let time      = 20 * 60; // seconds
  const display = document.getElementById("countdownTimer");

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const minutes = String(Math.floor(time / 60)).padStart(2, "0");
    const seconds = String(time % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;

    if (--time < 0) {
      clearInterval(timerInterval);
      display.textContent = "EXPIRED";
      display.style.color = "#ef4444";
      showPublicModal(
        "Your 20-minute reservation window has expired. Please submit a new request if you still wish to book.",
        "Session Expired",
        "⏱️",
        () => window.location.reload()
      );
    }
  }, 1000);
}

// ============================================================
// PUBLIC MODAL HELPER
// ============================================================

/**
 * Shows the simple single-button modal used on the public page.
 * @param {string}   message
 * @param {string}   [title]
 * @param {string}   [icon]
 * @param {Function} [onClose]
 */
function showPublicModal(message, title = "Notice", icon = "⚠️", onClose = null) {
  document.getElementById("alertTitle").innerText   = title;
  document.getElementById("alertMessage").innerText = message;
  document.getElementById("alertIcon").innerText    = icon;
  document.getElementById("customAlert").style.display = "flex";

  document.getElementById("alertOkBtn").onclick = () => {
    document.getElementById("customAlert").style.display = "none";
    if (onClose) onClose();
  };
}
