// ============================================================
// js/admin.js — Admin Dashboard Logic
// ============================================================

// Chart instances (stored so we can destroy before re-rendering)
let courtChartInst, sportChartInst, peakHoursChartInst, peakDaysChartInst;

// All pending requests (cached for re-use in review/reject flows)
let globalPendingData = [];

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Set date pickers to today
  const today = todayISO();
  const dateFilter    = document.getElementById("dateFilter");
  const gateDateFilter = document.getElementById("gateDateFilter");
  if (dateFilter)     dateFilter.value     = today;
  if (gateDateFilter) gateDateFilter.value = today;

  // Render the first batch block
  addBatchBlock(today);

  // Load initial data
  loadDashboardData();
  loadPendingRequests();
});

// ============================================================
// NAVIGATION
// ============================================================

function switchView(viewId, btn) {
  document.querySelectorAll(".view-section").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  btn.classList.add("active");

  // Close mobile sidebar
  document.querySelector(".sidebar")?.classList.remove("open");

  // Lazy-load data on first view switch
  if (viewId === "dashboardView")    loadDashboardData();
  if (viewId === "gateScheduleView") loadGateScheduleData();
  if (viewId === "databaseView")     loadDatabaseData();
  if (viewId === "analyticsView")    loadAnalyticsData();
  if (viewId === "pendingView")      loadPendingRequests();
}

function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}

// ============================================================
// DASHBOARD — LIVE SCHEDULE
// ============================================================

async function loadDashboardData() {
  const date = document.getElementById("dateFilter")?.value;
  if (!date) return;
  setLoading("loadingMsg", true);
  try {
    const sessions = await getBookingsForDate(date);
    renderScheduleGrid(document.getElementById("grid"), sessions, { showIDs: false });
  } catch (err) {
    showToast("Failed to load schedule.", "error");
    console.error(err);
  }
  setLoading("loadingMsg", false);
}

// ============================================================
// GATE SCHEDULE
// ============================================================

async function loadGateScheduleData() {
  const date = document.getElementById("gateDateFilter")?.value;
  if (!date) return;
  setLoading("gateLoadingMsg", true);
  try {
    const sessions = await getBookingsForDate(date);
    renderScheduleGrid(document.getElementById("gateGrid"),      sessions, { confirmedOnly: true, showIDs: true });
    renderScheduleGrid(document.getElementById("printGateGrid"), sessions, { confirmedOnly: true, showIDs: true });

    const dateObj = new Date(date);
    document.getElementById("printScheduleDate").innerText =
      "Schedule for: " + dateObj.toLocaleDateString("en-PH", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  } catch (err) {
    showToast("Failed to load gate schedule.", "error");
  }
  setLoading("gateLoadingMsg", false);
}

function printGateSchedule() {
  const date = document.getElementById("gateDateFilter")?.value;
  if (!date) { alert("Please select a date first."); return; }
  triggerPrint("schedulePrintContainer");
}

// ============================================================
// DATA ENTRY FORM
// ============================================================

/**
 * Appends a new booking slot block to the form.
 * Pre-fills values when called from the "Review Request" flow.
 */
function addBatchBlock(dateVal="", courtVal="Court 1", sportVal="Basketball", startVal="", endVal="") {
  const div = document.createElement("div");
  div.className = "batch-block";
  div.innerHTML = `
    <button type="button" class="remove-batch-btn" onclick="this.parentElement.remove(); calculateBilling();">Remove Slot</button>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date of Event</label>
        <input type="date" class="form-control event-date" value="${dateVal}" onchange="calculateBilling()">
      </div>
      <div class="form-group">
        <label class="form-label">Sport / Package</label>
        <select class="form-control event-sport" onchange="handleSportChange(this); calculateBilling();">
          <option value="Basketball">Basketball</option>
          <option value="Volleyball">Volleyball</option>
          <option value="Badminton">Badminton</option>
          <option value="Pickleball">Pickleball</option>
          <option value="Package A">Package A</option>
          <option value="Package B">Package B</option>
          <option value="Package C">Package C</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Facility</label>
        <select class="form-control event-court">
          <option value="Court 1">Court 1</option>
          <option value="Court 2">Court 2</option>
          <option value="Court 3">Court 3</option>
          <option value="Whole Gym">Whole Gym</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:20px;">
      <label class="form-label">Remarks &amp; Inclusions</label>
      <input type="text" class="form-control event-remarks" readonly style="color:var(--primary-blue); background:var(--readonly-bg);">
    </div>
    <div class="form-row" style="margin-bottom:0;">
      <div class="form-group">
        <label class="form-label">Time Started</label>
        <select class="form-control event-start" onchange="calculateBilling()">
          <option value="" disabled selected>Select start…</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Time Ended</label>
        <select class="form-control event-end" onchange="calculateBilling()">
          <option value="" disabled selected>Select end…</option>
        </select>
      </div>
    </div>`;

  document.getElementById("batchBlocksWrapper").appendChild(div);
  populateTimeDropdowns(div);

  if (sportVal) div.querySelector(".event-sport").value = sportVal;
  handleSportChange(div.querySelector(".event-sport"));

  if (courtVal) {
    const cs = div.querySelector(".event-court");
    for (const opt of cs.options) { if (opt.value === courtVal) cs.value = courtVal; }
  }
  if (startVal) div.querySelector(".event-start").value = startVal;
  if (endVal)   div.querySelector(".event-end").value   = endVal;
}

function addChargeField() {
  const div = document.createElement("div");
  div.className = "form-row";
  div.style.marginBottom = "10px";
  div.innerHTML = `
    <div class="form-group" style="flex:2;">
      <input type="text" class="form-control charge-remark" placeholder="Remark (e.g. Scoreboard)">
    </div>
    <div class="form-group" style="flex:1;">
      <input type="number" class="form-control charge-amount" placeholder="Amount" value="0" min="0" oninput="calculateBilling()">
    </div>
    <button type="button" class="btn btn-danger" style="margin-top:0; padding:10px 14px; align-self:flex-end;" onclick="this.closest('.form-row').remove(); calculateBilling();">−</button>`;
  document.getElementById("chargesWrapper").appendChild(div);
}

function toggleRefField() {
  const isOnline = document.getElementById("paymentMode").value === "Online Transfer";
  document.getElementById("refNumberGroup").style.display = isOnline ? "block" : "none";
  if (!isOnline) document.getElementById("transactionRef").value = "";
}

function calculateBilling() {
  const btn = document.getElementById("saveBtn");
  let totalBase  = 0;
  let totalHours = 0;
  let totalAdd   = 0;
  let hasError   = false;

  document.querySelectorAll(".charge-amount").forEach(el => { totalAdd += parseFloat(el.value) || 0; });

  document.querySelectorAll(".batch-block").forEach(block => {
    const startStr = block.querySelector(".event-start").value;
    const endStr   = block.querySelector(".event-end").value;
    const sport    = block.querySelector(".event-sport").value;
    const dateVal  = block.querySelector(".event-date").value;
    if (!dateVal || !startStr || !endStr) return;

    const start = parseTimeToNumber(startStr);
    const end   = parseTimeToNumber(endStr);
    if (end <= start) { hasError = true; return; }

    totalHours += end - start;
    totalBase  += calcSlotBase(sport, start, end);
  });

  if (hasError) {
    document.getElementById("totalHoursGlobal").value   = "Time Error";
    document.getElementById("baseAmountGlobal").value   = "0.00";
    document.getElementById("totalPayableGlobal").value = "0.00";
    btn.disabled = true;
  } else {
    document.getElementById("totalHoursGlobal").value   = totalHours;
    document.getElementById("baseAmountGlobal").value   = totalBase.toFixed(2);
    document.getElementById("totalPayableGlobal").value = (totalBase + totalAdd).toFixed(2);
    btn.disabled = false;
  }
}

async function submitForm() {
  const btn = document.getElementById("saveBtn");
  btn.innerHTML = `<span class="spinner"></span> Saving…`; btn.disabled = true;

  // Collect charges
  let chargesArr = [], totalAdd = 0;
  document.querySelectorAll("#chargesWrapper .form-row").forEach(row => {
    const rem = row.querySelector(".charge-remark")?.value || "Misc";
    const amt = parseFloat(row.querySelector(".charge-amount")?.value) || 0;
    if (amt > 0) { chargesArr.push(`${rem}: PHP ${amt}`); totalAdd += amt; }
  });
  const chargesText = chargesArr.length > 0 ? chargesArr.join(" | ") : "0";

  // Collect slots
  let dates=[], courts=[], sports=[], starts=[], ends=[], hoursArr=[], bases=[], totals=[];

  document.querySelectorAll(".batch-block").forEach(block => {
    const dateVal  = block.querySelector(".event-date").value;
    const startStr = block.querySelector(".event-start").value;
    const endStr   = block.querySelector(".event-end").value;
    if (!dateVal || !startStr || !endStr) return;

    const sport = block.querySelector(".event-sport").value;
    const start = parseTimeToNumber(startStr);
    const end   = parseTimeToNumber(endStr);
    const base  = calcSlotBase(sport, start, end);

    dates.push(dateVal);  courts.push(block.querySelector(".event-court").value);
    sports.push(sport);   starts.push(startStr); ends.push(endStr);
    hoursArr.push(end - start); bases.push(base);
  });

  if (dates.length === 0) {
    openModal({ title:"Incomplete Form", message:"Please complete at least one booking slot.", isError:true, confirmText:"OK", onConfirm:closeModal });
    btn.innerHTML = "Save Complete Booking"; btn.disabled = false; return;
  }

  const fullName = document.getElementById("fullName").value;
  if (!fullName) {
    openModal({ title:"Missing Info", message:"Please provide the Client's Full Name.", isError:true, confirmText:"OK", onConfirm:closeModal });
    btn.innerHTML = "Save Complete Booking"; btn.disabled = false; return;
  }

  const splitAdd = totalAdd / dates.length;
  dates.forEach((_, i) => totals.push(bases[i] + splitAdd));

  const payload = {
    fullName,
    organization:          document.getElementById("orgName").value,
    emailAddress:          document.getElementById("emailAddress").value,
    address:               document.getElementById("address").value,
    idType:                document.getElementById("idType").value,
    idNumber:              document.getElementById("idNumber").value,
    dateOfEvent:           dates, court: courts, sportType: sports,
    timeStarted:           starts, timeEnded: ends, totalHours: hoursArr,
    paymentMode:           document.getElementById("paymentMode").value,
    transactionRef:        document.getElementById("transactionRef").value,
    bookingID:             generateBookingID(),
    pendingReqId:          document.getElementById("pendingReqId").value,
    batchBases:            bases, dailyAdd: totalAdd,
    additionalChargesText: chargesText, batchTotals: totals,
    grandTotal:            parseFloat(document.getElementById("totalPayableGlobal").value),
  };

  try {
    await saveBookingToDatabase(payload);
    if (payload.emailAddress) await sendConfirmationEmail(payload);

    btn.innerHTML = "Save Complete Booking"; btn.disabled = false;
    showSuccessModal(payload);
  } catch (err) {
    openModal({ title:"Booking Failed", message: err.message, isError:true, confirmText:"Select Other Slot", onConfirm:closeModal });
    btn.innerHTML = "Save Complete Booking"; btn.disabled = false;
  }
}

function showSuccessModal(payload) {
  populateReceipt(payload);
  let msg = "Booking saved to the database.";
  if (payload.emailAddress) msg += `\n\nReceipt emailed to: ${payload.emailAddress}`;
  msg += "\n\nWould you like to print the receipt?";

  openModal({
    title:       "Booking Saved! ✅",
    message:     msg,
    confirmText: "🖨️ Print Receipt",
    cancelText:  "Skip & Next",
    onConfirm:   () => { closeModal(); printReceipt(); },
    onCancel:    clearFormAndReturn,
  });
}

function printReceipt() {
  triggerPrint("receiptContainer", clearFormAndReturn);
}

function clearFormAndReturn() {
  ["fullName","orgName","emailAddress","address","idNumber","transactionRef"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("pendingReqId").value = "";
  document.getElementById("idType").value       = "National ID";
  document.getElementById("paymentMode").value  = "Cash";
  toggleRefField();
  document.getElementById("batchBlocksWrapper").innerHTML = "";
  addBatchBlock(todayISO());
  document.getElementById("chargesWrapper").innerHTML     = "";
  ["totalHoursGlobal","baseAmountGlobal","totalPayableGlobal"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  closeModal();
  document.getElementById("formHeader").innerText = "New Booking Entry";
  switchView("dataEntryView", document.getElementById("navDataEntry"));
  loadPendingRequests();
}

// ============================================================
// PENDING APPROVALS
// ============================================================

async function loadPendingRequests() {
  setLoading("pendingLoadingMsg", true);
  try {
    globalPendingData = await getPendingRequests();
    renderPendingQueue(globalPendingData);
  } catch (err) {
    showToast("Failed to load pending requests.", "error");
  }
  setLoading("pendingLoadingMsg", false);
}

function filterPendingRequests() {
  const q = document.getElementById("pendingSearch").value.toLowerCase();
  document.querySelectorAll(".req-card").forEach(card => {
    card.style.display = card.innerText.toLowerCase().includes(q) ? "block" : "none";
  });
}

function renderPendingQueue(requests) {
  const badge   = document.getElementById("pendingBadge");
  const wrapper = document.getElementById("pendingListWrapper");

  if (requests.length > 0) { badge.style.display = "inline-block"; badge.innerText = requests.length; }
  else badge.style.display = "none";

  if (requests.length === 0) {
    wrapper.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted); background:white; border-radius:12px; border:1px dashed #cbd5e1;">No pending requests at the moment.</div>`;
    return;
  }

  wrapper.innerHTML = requests.map((req, idx) => {
    const dates  = req.dateOfEvent  || [];
    const courts = req.court        || [];
    const sports = req.sportType    || [];
    const starts = req.timeStarted  || [];
    const ends   = req.timeEnded    || [];

    const slotsHtml = dates.map((d, i) =>
      `<div class="req-slot-row"><strong>${d}</strong>: ${courts[i]} (${sports[i]}) — ${starts[i]} to ${ends[i]}</div>`
    ).join("");

    return `
      <div class="req-card">
        <div class="req-header">
          <h3 class="req-title">${req.reqID}</h3>
          <span class="req-tag">Needs Review</span>
        </div>
        <div class="req-info">
          <span><strong>Client:</strong> ${req.fullName}</span>
          <span><strong>Email:</strong> ${req.emailAddress}</span>
        </div>
        <div class="req-slots">${slotsHtml}</div>
        <div class="req-actions">
          <button class="btn btn-danger"  onclick="promptReject(${idx})">Reject</button>
          <button class="btn btn-primary" onclick="reviewRequest(${idx})">Review &amp; Quote</button>
        </div>
      </div>`;
  }).join("");
}

function reviewRequest(idx) {
  const req = globalPendingData[idx];
  document.getElementById("formHeader").innerText  = `Reviewing: ${req.reqID}`;
  document.getElementById("fullName").value        = req.fullName;
  document.getElementById("orgName").value         = req.organization  || "";
  document.getElementById("emailAddress").value    = req.emailAddress  || "";
  document.getElementById("address").value         = req.address       || "";
  document.getElementById("idType").value          = req.idType        || "National ID";
  document.getElementById("idNumber").value        = req.idNumber      || "";
  document.getElementById("pendingReqId").value    = req.reqID;
  document.getElementById("paymentMode").value     = "Cash";
  toggleRefField();

  document.getElementById("batchBlocksWrapper").innerHTML = "";
  const dates  = req.dateOfEvent  || [];
  const courts = req.court        || [];
  const sports = req.sportType    || [];
  const starts = req.timeStarted  || [];
  const ends   = req.timeEnded    || [];
  for (let i = 0; i < dates.length; i++) addBatchBlock(dates[i], courts[i], sports[i], starts[i], ends[i]);

  calculateBilling();
  switchView("dataEntryView", document.getElementById("navDataEntry"));
}

function promptReject(idx) {
  const req = globalPendingData[idx];
  openModal({
    title:      "Reject Request",
    message:    `Reject ${req.reqID} for ${req.fullName}?\nPlease provide a reason — this will be emailed to the client.`,
    isError:    true,
    confirmText:"Reject Booking",
    cancelText: "Cancel",
    showInput:  true,
    onCancel:   closeModal,
    onConfirm: async () => {
      const reason = document.getElementById("rejectReason").value.trim();
      if (!reason) { showToast("Please enter a reason.", "error"); return; }

      const btn = document.getElementById("alertBtnAction");
      btn.innerHTML = `<span class="spinner"></span> Sending…`; btn.disabled = true;

      try {
        await rejectRequestInDB(req.reqID);
        await sendRejectionEmail(req.emailAddress, req.fullName, req.reqID, reason);
        closeModal();
        showToast("Request rejected and client notified.");
        loadPendingRequests();
      } catch (err) {
        showToast("Failed to reject request.", "error");
        btn.innerHTML = "Reject Booking"; btn.disabled = false;
      }
    },
  });
}

// ============================================================
// MASTER DATABASE TABLE
// ============================================================

async function loadDatabaseData() {
  setLoading("dbLoadingMsg", true);
  const table = document.getElementById("dataTable");
  try {
    const bookings = await getAllBookings();
    if (bookings.length === 0) {
      table.innerHTML = `<tr><td style="text-align:center;padding:30px;color:var(--text-muted);">No records found.</td></tr>`;
    } else {
      const headers = ["Booking ID","Client","Organization","Date(s)","Court(s)","Sport(s)","Start","End","Hours","Payment","Base","Charges","Total"];
      let html = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>`;
      bookings.forEach(b => {
        const row = [
          b.bookingID,
          b.fullName,
          b.organization || "—",
          (b.dateOfEvent  || []).join(", "),
          (b.court        || []).join(", "),
          (b.sportType    || []).join(", "),
          (b.timeStarted  || []).join(", "),
          (b.timeEnded    || []).join(", "),
          (b.totalHours   || []).join(", "),
          b.paymentMode   || "—",
          "PHP " + (b.batchBases  || []).reduce((a,c)=>a+c,0).toFixed(2),
          b.additionalChargesText || "—",
          "PHP " + (b.grandTotal  || 0).toFixed(2),
        ];
        html += `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`;
      });
      table.innerHTML = html + "</tbody>";
    }
  } catch (err) {
    table.innerHTML = `<tr><td style="text-align:center;padding:30px;color:#ef4444;">Failed to load data.</td></tr>`;
  }
  setLoading("dbLoadingMsg", false);
}

// ============================================================
// ANALYTICS
// ============================================================

async function loadAnalyticsData() {
  setLoading("analyticsLoadingMsg", true);
  try {
    const data = await getAnalyticsData();
    renderAnalytics(data);
  } catch (err) {
    showToast("Failed to load analytics.", "error");
  }
  setLoading("analyticsLoadingMsg", false);
}

function renderAnalytics(data) {
  document.getElementById("kpiRevenue").innerText  = data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits:2 });
  document.getElementById("kpiBookings").innerText = data.totalBookings;
  document.getElementById("kpiHours").innerText    = data.totalHours;

  Chart.defaults.font.family = "system-ui, -apple-system, sans-serif";
  Chart.defaults.color       = "#64748b";
  const destroy = i => { if (i) i.destroy(); };

  destroy(peakHoursChartInst);
  peakHoursChartInst = new Chart(document.getElementById("peakHoursChart"), {
    type: "line",
    data: { labels: Object.keys(data.peakHours), datasets: [{ label:"Hours", data: Object.values(data.peakHours), borderColor:"#3b82f6", backgroundColor:"rgba(59,130,246,0.1)", borderWidth:3, fill:true, tension:0.4 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false } } } },
  });

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  destroy(peakDaysChartInst);
  peakDaysChartInst = new Chart(document.getElementById("peakDaysChart"), {
    type: "bar",
    data: { labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], datasets:[{ label:"Bookings", data: DAYS.map(d => data.peakDays[d]||0), backgroundColor:"#10b981", borderRadius:6 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false } } } },
  });

  destroy(courtChartInst);
  courtChartInst = new Chart(document.getElementById("courtChart"), {
    type: "bar",
    data: { labels: Object.keys(data.courtUtilization), datasets:[{ label:"Bookings", data: Object.values(data.courtUtilization), backgroundColor:"#8b5cf6", borderRadius:6 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 }, grid:{ color:"#f1f5f9" } }, x:{ grid:{ display:false } } } },
  });

  const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];
  destroy(sportChartInst);
  sportChartInst = new Chart(document.getElementById("sportChart"), {
    type: "doughnut",
    data: { labels: Object.keys(data.revenueBySport), datasets:[{ data: Object.values(data.revenueBySport), backgroundColor: COLORS.slice(0, Object.keys(data.revenueBySport).length), borderWidth:0 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:"65%", plugins:{ legend:{ position:"right", labels:{ usePointStyle:true, padding:20 } } } },
  });
}

// ============================================================
// PRINT HELPERS
// ============================================================

/**
 * Hides the app, shows a print container, triggers print, then restores.
 * @param {string}    containerId   ID of the element to show for printing
 * @param {Function}  [afterPrint]  Optional callback after print dialog closes
 */
function triggerPrint(containerId, afterPrint) {
  const app       = document.getElementById("appContainer");
  const mobileBar = document.querySelector(".mobile-header");
  const target    = document.getElementById(containerId);

  app.style.display    = "none";
  if (mobileBar) mobileBar.style.display = "none";
  target.style.display = "block";

  window.print();

  setTimeout(() => {
    target.style.display = "none";
    app.style.display    = "flex";
    if (mobileBar && window.innerWidth <= 768) mobileBar.style.display = "flex";
    if (afterPrint) afterPrint();
  }, 500);
}

// ============================================================
// LOADING STATE HELPER
// ============================================================

function setLoading(msgId, state) {
  const el = document.getElementById(msgId);
  if (el) el.style.display = state ? "inline" : "none";
}
