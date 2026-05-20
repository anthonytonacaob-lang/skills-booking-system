# SKILLS Inc. Facility Booking System
### GitHub Pages Edition — Firebase + EmailJS

A fully client-side gym booking system that runs entirely on **GitHub Pages** (free hosting).  
No server required. Data is stored in **Firebase Firestore**. Emails are sent via **EmailJS**.

---

## Live Pages

| URL | Description |
|---|---|
| `https://YOUR-USERNAME.github.io/skills-booking-system/` | Admin Dashboard |
| `https://YOUR-USERNAME.github.io/skills-booking-system/public.html` | Public Booking Form |

---

## Features

### Public Portal (`public.html`)
- Live court availability grid
- Multi-slot booking with sport/package selection
- Smart court filtering per sport type
- 3-hour advance booking rule enforced
- 20-minute countdown after reservation is submitted
- Estimated cost shown before confirming

### Admin Dashboard (`index.html`)
- **Live Schedule** — real-time color-coded court grid
- **Gate Schedule** — printable security pass (legal size)
- **Data Entry** — manual booking with multi-slot billing calculator
- **Pending Approvals** — review, quote, approve, or reject public requests
- **Master Database** — full table view of all confirmed bookings
- **Analytics** — KPI cards + 4 Chart.js charts
- 2-copy printable receipt with waiver of liability
- Automatic email confirmation and rejection notifications

---

## Tech Stack

| Layer | Tool | Cost |
|---|---|---|
| Hosting | GitHub Pages | Free |
| Database | Firebase Firestore | Free tier (50K reads/day) |
| Email | EmailJS | Free tier (200 emails/month) |
| Charts | Chart.js (CDN) | Free |

---

## File Structure

```
skills-booking-system/
├── index.html        # Admin dashboard
├── public.html       # Public booking form
├── css/
│   └── style.css     # Shared stylesheet
├── js/
│   ├── firebase.js   # Firestore database layer
│   ├── email.js      # EmailJS integration
│   ├── utils.js      # Shared utilities (time, billing, grid)
│   ├── admin.js      # Admin dashboard logic
│   └── public.js     # Public form logic
└── README.md
```

---

## Setup Guide

### Step 1 — Fork or Upload to GitHub

1. Create a new GitHub repository (e.g. `skills-booking-system`)
2. Upload all files maintaining the folder structure above
3. Go to **Settings → Pages → Branch: main → Save**
4. Your site will be live at `https://YOUR-USERNAME.github.io/skills-booking-system/`

---

### Step 2 — Set Up Firebase

1. Go to **[firebase.google.com](https://firebase.google.com)** → **Get Started** → **Create a project**
2. Name your project (e.g. `skills-booking`) → Continue through the setup
3. In the left sidebar, click **Firestore Database** → **Create database**
   - Choose **Production mode** → Select your region → Enable
4. Go to **Project Settings** (gear icon) → **Your Apps** → Click **</>** (Web)
   - Register your app → Copy the `firebaseConfig` object
5. Open `js/firebase.js` and replace the `FIREBASE_CONFIG` values:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "skills-booking.firebaseapp.com",
  projectId:         "skills-booking",
  storageBucket:     "skills-booking.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef",
};
```

6. Set Firestore **Security Rules** (Firestore → Rules tab):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Anyone can read (for live schedule)
    match /bookings/{doc}  { allow read: true; allow write: true; }
    match /pending/{doc}   { allow read: true; allow write: true; }
  }
}
```

> ⚠️ For production use, add proper authentication to restrict admin writes.

---

### Step 3 — Set Up EmailJS

1. Go to **[emailjs.com](https://emailjs.com)** → Sign up free
2. **Email Services** → **Add New Service** → Connect your Gmail account → Copy the **Service ID**
3. **Email Templates** → **Create New Template**

   **Template 1 — Booking Confirmation** (`confirm_template`)
   ```
   Subject: SKILLS Inc. Booking Confirmation - {{booking_id}}

   Dear {{to_name}},

   Your booking has been confirmed!

   Booking Ref: {{booking_id}}
   Organization: {{organization}}
   ID: {{id_type}} - {{id_number}}

   Reserved Slots:
   {{slots_summary}}

   Payment: {{payment_mode}}
   Transaction Ref: {{transaction_ref}}
   Base Amount: {{base_amount}}
   Additional: {{additional}}
   GRAND TOTAL: {{grand_total}}

   Thank you for booking with SKILLS Inc.
   ```

   **Template 2 — Rejection Notice** (`reject_template`)
   ```
   Subject: SKILLS Inc. Booking Request Update - {{req_id}}

   Dear {{to_name}},

   We regret that your booking request {{req_id}} could not be accommodated.

   Reason: {{reason}}

   Please submit a new request for alternative dates.

   Thank you,
   SKILLS Inc. Admin
   ```

4. Go to **Account → API Keys** → Copy your **Public Key**
5. Open `js/email.js` and fill in:

```js
const EMAILJS_CONFIG = {
  publicKey:         "YOUR_PUBLIC_KEY",
  confirmTemplateId: "confirm_template",   // your template ID
  rejectTemplateId:  "reject_template",    // your template ID
};
```

> Note: The **Service ID** in EmailJS defaults to `"default_service"` when you set it as your default. If you named it differently, update the `emailjs.send("default_service", ...)` calls in `js/email.js`.

---

### Step 4 — Deploy Updates

Whenever you edit a file:
1. Go to your GitHub repo
2. Click the file → ✏️ Edit → make changes → **Commit changes**
3. GitHub Pages auto-deploys within ~1 minute

---

## Pricing Logic

| Package | Day Rate (6 AM – 5 PM) | Night Rate (5 PM – 10 PM) |
|---|---|---|
| Regular (Basketball, etc.) | PHP 450/hr | PHP 550/hr |
| Package A (Whole Gym) | PHP 1,500/hr | PHP 2,500/hr |
| Package B (Court 1 + Bleachers) | PHP 600/hr | PHP 700/hr |
| Package C (Standard + Extra Pax) | PHP 550/hr | PHP 650/hr |

---

## Firestore Collections

### `bookings` — Confirmed reservations
| Field | Type | Description |
|---|---|---|
| `bookingID` | string | e.g. `BKG-250519-4823` |
| `fullName` | string | Client name |
| `organization` | string | |
| `emailAddress` | string | |
| `address` | string | |
| `idType` | string | |
| `idNumber` | string | |
| `dateOfEvent` | string[] | Array of `yyyy-MM-dd` dates |
| `court` | string[] | Per-slot court |
| `sportType` | string[] | Per-slot sport/package |
| `timeStarted` | string[] | Per-slot start time |
| `timeEnded` | string[] | Per-slot end time |
| `totalHours` | number[] | Per-slot hours |
| `batchBases` | number[] | Per-slot base amount |
| `batchTotals` | number[] | Per-slot total (with split charges) |
| `dailyAdd` | number | Total additional charges |
| `additionalChargesText` | string | Charges description |
| `grandTotal` | number | Grand total paid |
| `paymentMode` | string | Cash / Online Transfer |
| `transactionRef` | string | Online ref # |
| `pendingReqId` | string | Linked REQ ID if approved from pending |
| `createdAt` | timestamp | Server timestamp |

### `pending` — Public booking requests
| Field | Type | Description |
|---|---|---|
| `reqID` | string | e.g. `REQ-48271` |
| `status` | string | `PENDING` / `APPROVED` / `REJECTED` / `EXPIRED` |
| `fullName` | string | |
| `emailAddress` | string | |
| `dateOfEvent` | string[] | |
| `court` | string[] | |
| `sportType` | string[] | |
| `timeStarted` | string[] | |
| `timeEnded` | string[] | |
| `createdAt` | timestamp | Used for 20-min expiry |

---

## Notes

- **Pending requests** expire after 20 minutes (checked on every schedule load)
- **Whole Gym** bookings block all 3 courts automatically
- **Gate Schedule** is sized for legal (8.5" × 14") paper in portrait
- **Receipt** prints 2 copies on one legal-size page, separated by a cut line
- The public form enforces a **3-hour advance booking** rule
- For real production use, add Firebase Authentication to protect the admin dashboard
