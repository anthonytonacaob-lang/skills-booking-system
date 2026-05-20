// ============================================================
// js/email.js — EmailJS Integration
// Handles booking confirmations and rejection notifications.
//
// Setup:
//   1. Go to https://emailjs.com and create a free account
//   2. Create an Email Service (Gmail recommended)
//   3. Create two Email Templates (see README for template variables)
//   4. Replace the three config values below
// ============================================================

const EMAILJS_CONFIG = {
  publicKey:          "YOUR_EMAILJS_PUBLIC_KEY",   // Account → API Keys
  confirmTemplateId:  "YOUR_CONFIRM_TEMPLATE_ID",  // Email Templates
  rejectTemplateId:   "YOUR_REJECT_TEMPLATE_ID",   // Email Templates
};

// Initialise EmailJS with your public key
emailjs.init(EMAILJS_CONFIG.publicKey);

// ============================================================
// CONFIRMATION EMAIL
// ============================================================

/**
 * Sends a booking confirmation receipt to the client.
 *
 * Required EmailJS template variables:
 *   {{to_email}}        — recipient email
 *   {{to_name}}         — client full name
 *   {{booking_id}}      — booking reference
 *   {{organization}}    — org name
 *   {{id_type}}         — type of ID presented
 *   {{id_number}}       — ID number
 *   {{slots_summary}}   — formatted list of booked slots
 *   {{payment_mode}}    — Cash / Online Transfer
 *   {{transaction_ref}} — reference number (if online)
 *   {{base_amount}}     — total base in PHP
 *   {{additional}}      — additional charges label
 *   {{grand_total}}     — grand total in PHP
 *
 * @param  {Object}  data  Booking payload (same shape as saveBookingToDatabase)
 * @returns {Promise<void>}
 */
async function sendConfirmationEmail(data) {
  if (!data.emailAddress || data.emailAddress.trim() === "") return;

  // Build a readable slots summary
  const slotLines = data.dateOfEvent.map((date, i) =>
    `${date} | ${data.court[i]} (${data.sportType[i]}) | ${data.timeStarted[i]} – ${data.timeEnded[i]} (${data.totalHours[i]} hrs)`
  );

  const totalBase = (data.batchBases || []).reduce((a, b) => a + b, 0);
  const addLabel  = data.additionalChargesText && data.additionalChargesText !== "0"
    ? data.additionalChargesText
    : "None";

  const templateParams = {
    to_email:        data.emailAddress,
    to_name:         data.fullName,
    booking_id:      data.bookingID,
    organization:    data.organization || "N/A",
    id_type:         data.idType       || "N/A",
    id_number:       data.idNumber     || "N/A",
    slots_summary:   slotLines.join("\n"),
    payment_mode:    data.paymentMode,
    transaction_ref: data.transactionRef || "N/A",
    base_amount:     `PHP ${totalBase.toFixed(2)}`,
    additional:      `PHP ${(data.dailyAdd || 0).toFixed(2)} (${addLabel})`,
    grand_total:     `PHP ${(data.grandTotal || 0).toFixed(2)}`,
  };

  try {
    await emailjs.send("default_service", EMAILJS_CONFIG.confirmTemplateId, templateParams);
    console.log("Confirmation email sent to", data.emailAddress);
  } catch (err) {
    // Non-fatal — booking was already saved; just log the failure
    console.warn("Email send failed:", err);
  }
}

// ============================================================
// REJECTION EMAIL
// ============================================================

/**
 * Sends a rejection notification to the client.
 *
 * Required EmailJS template variables:
 *   {{to_email}}   — recipient email
 *   {{to_name}}    — client full name
 *   {{req_id}}     — request ID (e.g. REQ-48271)
 *   {{reason}}     — rejection reason from admin
 *
 * @param  {string}  email   Client email address
 * @param  {string}  name    Client full name
 * @param  {string}  reqID   Request ID
 * @param  {string}  reason  Rejection reason
 * @returns {Promise<void>}
 */
async function sendRejectionEmail(email, name, reqID, reason) {
  const templateParams = {
    to_email: email,
    to_name:  name,
    req_id:   reqID,
    reason:   reason,
  };

  try {
    await emailjs.send("default_service", EMAILJS_CONFIG.rejectTemplateId, templateParams);
    console.log("Rejection email sent to", email);
  } catch (err) {
    console.warn("Rejection email failed:", err);
  }
}
