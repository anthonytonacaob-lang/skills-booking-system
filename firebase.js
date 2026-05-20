// ============================================================
// js/firebase.js — Firebase Firestore Database Layer
// Replace the config values below with your own Firebase project.
// ============================================================

// ------------------------------------------------------------
// FIREBASE CONFIGURATION
// Replace these values with your own from:
// Firebase Console → Project Settings → Your Apps → Firebase SDK snippet
// ------------------------------------------------------------
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ------------------------------------------------------------
// INITIALISE FIREBASE
// ------------------------------------------------------------
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

// ------------------------------------------------------------
// COLLECTION REFERENCES
// ------------------------------------------------------------
const BOOKINGS_COL = "bookings";   // confirmed bookings (Master Database)
const PENDING_COL  = "pending";    // pending public requests

// ============================================================
// READ HELPERS
// ============================================================

/**
 * Returns all bookings (confirmed + pending) for a given date.
 * Pending entries older than 20 minutes are treated as expired.
 *
 * @param  {string}   dateString  "yyyy-MM-dd"
 * @returns {Promise<Object[]>}
 */
async function getBookingsForDate(dateString) {
  const results = [];
  const now     = Date.now();
  const EXPIRY  = 20 * 60 * 1000; // 20 minutes in ms

  // --- Confirmed bookings ---
  const confirmedSnap = await db.collection(BOOKINGS_COL)
    .where("dateOfEvent", "array-contains", dateString)
    .get();

  confirmedSnap.forEach(doc => {
    const data = doc.data();
    data.dateOfEvent.forEach((date, i) => {
      if (date === dateString) {
        results.push({
          id:        doc.id,
          court:     data.court[i],
          sport:     data.sportType[i],
          startTime: data.timeStarted[i],
          endTime:   data.timeEnded[i],
          bookingID: data.bookingID,
          type:      "CONFIRMED",
        });
      }
    });
  });

  // --- Pending reservations (skip expired) ---
  const pendingSnap = await db.collection(PENDING_COL)
    .where("status", "==", "PENDING")
    .get();

  pendingSnap.forEach(doc => {
    const data = doc.data();
    const age  = now - (data.createdAt?.toMillis?.() ?? 0);
    if (age > EXPIRY) return; // treat as expired

    data.dateOfEvent.forEach((date, i) => {
      if (date === dateString) {
        results.push({
          id:        doc.id,
          court:     data.court[i],
          sport:     data.sportType[i],
          startTime: data.timeStarted[i],
          endTime:   data.timeEnded[i],
          bookingID: data.reqID,
          type:      "PENDING",
        });
      }
    });
  });

  return results;
}

/**
 * Returns all confirmed bookings (for the Master Database view).
 * @returns {Promise<Object[]>}
 */
async function getAllBookings() {
  const snap = await db.collection(BOOKINGS_COL)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Returns all currently PENDING requests (newest first, expired excluded).
 * @returns {Promise<Object[]>}
 */
async function getPendingRequests() {
  const now    = Date.now();
  const EXPIRY = 20 * 60 * 1000;

  const snap = await db.collection(PENDING_COL)
    .where("status", "==", "PENDING")
    .orderBy("createdAt", "desc")
    .get();

  const requests = [];
  snap.forEach(doc => {
    const data = doc.data();
    const age  = now - (data.createdAt?.toMillis?.() ?? 0);
    if (age > EXPIRY) {
      // Auto-expire in Firestore
      db.collection(PENDING_COL).doc(doc.id).update({ status: "EXPIRED" });
      return;
    }
    requests.push({ id: doc.id, ...data });
  });

  return requests;
}

/**
 * Returns aggregated analytics data from the bookings collection.
 * @returns {Promise<Object>}
 */
async function getAnalyticsData() {
  const snap = await db.collection(BOOKINGS_COL).get();

  let totalRevenue  = 0;
  let totalBookings = 0;
  let totalHours    = 0;

  const revenueBySport   = {};
  const courtUtilization = { "Court 1": 0, "Court 2": 0, "Court 3": 0, "Whole Gym": 0 };
  const peakDays = { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0, Sunday:0 };
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const TIME_LABELS = [
    "6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
    "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
    "6:00 PM","7:00 PM","8:00 PM","9:00 PM",
  ];
  const peakHours = {};
  TIME_LABELS.forEach(t => (peakHours[t] = 0));

  snap.forEach(doc => {
    const data = doc.data();
    const dates = data.dateOfEvent || [];

    dates.forEach((dateStr, i) => {
      totalBookings++;

      const court   = data.court?.[i]     || "";
      const sport   = data.sportType?.[i] || "";
      const hours   = parseFloat(data.totalHours?.[i])  || 0;
      const revenue = parseFloat(data.batchTotals?.[i]) || 0;

      totalHours   += hours;
      totalRevenue += revenue;

      courtUtilization[court] = (courtUtilization[court] ?? 0) + 1;
      revenueBySport[sport]   = (revenueBySport[sport]   ?? 0) + revenue;

      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) peakDays[DAY_NAMES[d.getDay()]]++;
      } catch (_) {}

      const startNum = parseTimeToNumber(data.timeStarted?.[i]);
      const endNum   = parseTimeToNumber(data.timeEnded?.[i]);
      if (startNum !== null && endNum !== null) {
        for (let h = Math.floor(startNum); h < Math.ceil(endNum); h++) {
          const ampm    = h >= 12 ? "PM" : "AM";
          const hr      = h > 12 ? h - 12 : h === 0 ? 12 : h;
          const timeStr = `${hr}:00 ${ampm}`;
          if (peakHours[timeStr] !== undefined) peakHours[timeStr]++;
        }
      }
    });
  });

  return { totalRevenue, totalBookings, totalHours, revenueBySport, courtUtilization, peakDays, peakHours };
}

// ============================================================
// WRITE HELPERS
// ============================================================

/**
 * Saves a confirmed booking to Firestore after conflict checking.
 * If approving a pending request, marks it as APPROVED.
 *
 * @param  {Object} bookingData
 * @returns {Promise<string>}  "Success" or throws on conflict
 */
async function saveBookingToDatabase(bookingData) {
  const dates  = bookingData.dateOfEvent || [];
  const courts = bookingData.court       || [];

  // --- Conflict check ---
  for (let d = 0; d < dates.length; d++) {
    const existing = await getBookingsForDate(dates[d]);
    const newStart = parseTimeToNumber(bookingData.timeStarted[d]);
    const newEnd   = parseTimeToNumber(bookingData.timeEnded[d]);

    for (const b of existing) {
      const sameCourt = b.court === courts[d] || courts[d] === "Whole Gym" || b.court === "Whole Gym";
      if (!sameCourt) continue;

      const exStart = parseTimeToNumber(b.startTime);
      const exEnd   = parseTimeToNumber(b.endTime);

      if (newStart < exEnd && newEnd > exStart) {
        const approvingOwn = b.type === "PENDING"
          && bookingData.pendingReqId
          && b.bookingID === bookingData.pendingReqId;
        if (!approvingOwn) {
          throw new Error(
            `CONFLICT! ${b.court} is already booked on ${dates[d]} between ${b.startTime} and ${b.endTime}.`
          );
        }
      }
    }
  }

  // --- Write booking ---
  await db.collection(BOOKINGS_COL).add({
    ...bookingData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // --- Mark pending as APPROVED ---
  if (bookingData.pendingReqId) {
    const pendingSnap = await db.collection(PENDING_COL)
      .where("reqID", "==", bookingData.pendingReqId)
      .limit(1)
      .get();
    if (!pendingSnap.empty) {
      await pendingSnap.docs[0].ref.update({ status: "APPROVED" });
    }
  }

  return "Success";
}

/**
 * Saves a new public booking request to the pending collection.
 * @param  {Object} reqData
 * @returns {Promise<string>}  The generated REQ-XXXXX ID
 */
async function submitPublicRequest(reqData) {
  const reqID = "REQ-" + Math.floor(10000 + Math.random() * 90000);
  await db.collection(PENDING_COL).add({
    ...reqData,
    reqID,
    status:    "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return reqID;
}

/**
 * Marks a pending request as REJECTED in Firestore.
 * @param  {string} reqID
 * @returns {Promise<void>}
 */
async function rejectRequestInDB(reqID) {
  const snap = await db.collection(PENDING_COL)
    .where("reqID", "==", reqID)
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ status: "REJECTED" });
  }
}

// ============================================================
// SHARED UTILITY
// ============================================================

/**
 * Converts a 12-hour time string (e.g. "2:30 PM") to a decimal number.
 * Exported so other modules can use it.
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
