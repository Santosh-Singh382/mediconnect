# MediConnect

Telemedicine and pharmacy platform connecting patients, doctors, pharmacies, and administrators in a single workflow: find a doctor, book an appointment, consult via chat or video, receive a prescription, manage medical records, and order prescribed medicines.

## Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | React, Vite, JavaScript, React Router, Tailwind CSS     |
| Backend    | Node.js, Express, MongoDB, Mongoose, JWT, Socket.IO     |
| Real-time  | Socket.IO (chat + WebRTC signaling)                     |
| Video      | WebRTC                                                  |

## Repository layout

```
MediConnect/
├── client/   # React single-page application
└── server/   # Express REST API + Socket.IO server
```

## Prerequisites

- Node.js 18+
- MongoDB (local installation, Docker, or MongoDB Atlas)

## Environment variables

Copy `server/.env.example` to `server/.env` and fill in values.

| Variable      | Required | Description                                                        |
| ------------- | -------- | ------------------------------------------------------------------ |
| `NODE_ENV`    | no       | Runtime mode (`development`, `test`, `production`).                |
| `PORT`        | no       | Port the API listens on. Defaults to `5000`.                       |
| `MONGODB_URI` | yes      | MongoDB connection string. Database name is `mediconnect`.         |
| `CLIENT_URL`  | no       | Comma-separated browser origins allowed by CORS/Socket.IO.          |
| `JWT_SECRET`  | yes      | JWT signing secret used to sign and verify access tokens.           |

`JWT_SECRET` must be a long random value and must never be committed. Generate one, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server fails to start with a clear message if `MONGODB_URI` or `JWT_SECRET` is not set.

## MongoDB setup

Local development against a MongoDB instance:

```bash
# Example: local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/mediconnect
```

For MongoDB Atlas, replace the URI with your Atlas connection string and database name `mediconnect`.

## Running the server

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
npm run dev            # or: npm start
```

On startup the server:

1. loads environment configuration,
2. connects to MongoDB,
3. starts the HTTP server and Socket.IO.

## Running the client

```bash
cd client
npm install
npm run dev
```

Vite proxies `/api` requests and the `/socket.io` WebSocket upgrade to the
backend on port `5000`.

## Verifying the database connection

```bash
curl http://localhost:5000/api/health
```

The health response includes a `database` field:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "mediconnect-api",
    "environment": "development",
    "database": "connected",
    "uptimeSeconds": 42,
    "timestamp": "2026-10-09T00:00:00.000Z"
  }
}
```

## Authentication

MediConnect uses JSON Web Tokens for authentication. Passwords are hashed with
bcrypt; plaintext passwords and password hashes are never returned by the API.

- Public registration is available for `PATIENT`, `DOCTOR`, and `PHARMACY` roles.
  `ADMIN` accounts cannot be self-registered.
- `POST /api/auth/register` creates an account and returns the safe user (201).
- `POST /api/auth/login` verifies credentials and returns `{ token, user }` (200).
- `GET /api/auth/me` returns the current user and requires a bearer token.
- Protected routes require an `Authorization: Bearer <token>` header.
- Role-based authorization rejects authenticated users with an insufficient role (403).

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "StrongPassword123",
  "role": "PATIENT"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123"
}
```

### Current user

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Tokens and storage

Access tokens expire after 7 days and are stored in `localStorage` by the client.
This is a reasonable trade-off for a college prototype: it keeps the frontend
simple and survives page reloads, but it is not equivalent to HttpOnly cookies,
which provide stronger protection against XSS. A cookie-based implementation
is a future enhancement.

## Patient module

Patients manage a health profile and see a personal dashboard. Appointments,
consultations, prescriptions, medical records, and pharmacy features build on
this foundation in later modules.

### Authentication and role requirement

All patient endpoints require:

- an `Authorization: Bearer <token>` header (`requireAuth`), and
- the `PATIENT` role (`requireRole('PATIENT')`).

`DOCTOR`, `PHARMACY`, and `ADMIN` accounts are rejected with `403 FORBIDDEN`;
unauthenticated requests receive `401 UNAUTHORIZED`.

### Ownership and security model

A patient profile is linked to the authenticated user only. The server always
derives ownership from the token (`req.user.id` → `PatientProfile.userId`);
a client-provided `userId` is never trusted. Patients can only read or modify
their own profile. The API never returns `passwordHash`, passwords, or tokens
from patient endpoints, and health information is not logged.

### Profile fields

| Field                          | Source of truth            | Notes                                        |
| ------------------------------ | -------------------------- | -------------------------------------------- |
| name, email, phone, role       | `User`                     | Not duplicated in `PatientProfile`           |
| dateOfBirth                    | `PatientProfile`           | Optional; may not be a future date           |
| gender                         | `PatientProfile`           | `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` |
| address                        | `PatientProfile`           | street, city, state, postalCode, country     |
| emergencyContact               | `PatientProfile`           | name, relationship, phone                    |
| bloodGroup                     | `PatientProfile`           | A+, A-, B+, B-, AB+, AB-, O+, O-             |
| allergies                      | `PatientProfile`           | Array of strings, optional                   |
| existingConditions             | `PatientProfile`           | Array of strings, optional                   |

`PatientProfile.userId` is unique, so a patient can never have duplicate
profiles. Health fields (allergies, existing conditions) are never used to
grade the quality of a profile.

### Profile completion

The server calculates a simple completeness indicator from five optional parts:
`dateOfBirth`, `gender`, `address`, `emergencyContact` (name + phone), and
`bloodGroup`. Each completed part contributes 20%, giving a value from 0 to
100. Allergies and existing conditions are intentionally excluded.

### API endpoints

#### Get patient profile

```http
GET /api/patient/profile
Authorization: Bearer <token>
```

Returns the authenticated user and the patient profile (or `null` profile for
a first-time patient):

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "661f2f5c9d1a1a1a1a1a1a1a",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "PATIENT"
    },
    "profile": {
      "dateOfBirth": "2004-05-20",
      "gender": "MALE",
      "address": {
        "street": "Example Street",
        "city": "Paralakhemundi",
        "state": "Odisha",
        "postalCode": "761200",
        "country": "India"
      },
      "emergencyContact": {
        "name": "Jane Doe",
        "relationship": "Parent",
        "phone": "9876543211"
      },
      "bloodGroup": "B+",
      "allergies": ["Example Allergy"],
      "existingConditions": ["Example Condition"]
    },
    "profileCompletion": 100
  }
}
```

#### Create or update patient profile

```http
PUT /api/patient/profile
Authorization: Bearer <token>
Content-Type: application/json
```

Creates the profile if it does not exist and updates it if it does. Every
field is optional; omitted fields keep their current value, and `null` or
empty strings clear a field. Malformed input is rejected with `400
VALIDATION_ERROR` and a `details` list of `{ field, message }`:

```json
{
  "dateOfBirth": "2004-05-20",
  "gender": "MALE",
  "address": {
    "street": "Example Street",
    "city": "Paralakhemundi",
    "state": "Odisha",
    "postalCode": "761200",
    "country": "India"
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Parent",
    "phone": "9876543211"
  },
  "bloodGroup": "B+",
  "allergies": ["Example Allergy"],
  "existingConditions": ["Example Condition"]
}
```

#### Patient dashboard

```http
GET /api/patient/dashboard
Authorization: Bearer <token>
```

Returns the user, profile, profile completion, and a statistics block. These
counters are currently reserved at zero and are not yet wired to their modules:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "661f2f5c9d1a1a1a1a1a1a1a",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "role": "PATIENT"
    },
    "profile": null,
    "profileCompletion": 0,
    "stats": {
      "upcomingAppointments": 0,
      "completedConsultations": 0,
      "prescriptions": 0,
      "medicalRecords": 0,
      "orders": 0
    }
  }
}
```

## Doctor module

Doctors manage a practice profile and see a personal dashboard with
verification status. Appointment booking, consultations, and prescription
tools build on this foundation in later modules.

### Authentication and role requirement

All doctor endpoints require:

- an `Authorization: Bearer <token>` header (`requireAuth`), and
- the `DOCTOR` role (`requireRole('DOCTOR')`).

`PATIENT`, `PHARMACY`, and `ADMIN` accounts are rejected with `403 FORBIDDEN`;
unauthenticated requests receive `401 UNAUTHORIZED`.

### Ownership and security model

A doctor profile is linked to the authenticated user only. The server always
derives ownership from the token (`req.user.id` → `DoctorProfile.userId`); a
client-provided `userId` is never trusted. Doctors can only read or modify
their own profile. The API never returns `passwordHash`, passwords, or tokens
from doctor endpoints.

### Profile fields

| Field              | Source of truth | Notes                                                  |
| ------------------ | --------------- | ------------------------------------------------------ |
| name, email, phone | `User`          | Not duplicated in `DoctorProfile`                      |
| specialization     | `DoctorProfile` | Required; created with the profile                     |
| qualification      | `DoctorProfile` | Required; created with the profile                     |
| experience         | `DoctorProfile` | Number of years, 0–80                                  |
| registrationNumber | `DoctorProfile` | Required; created with the profile                     |
| consultationFee    | `DoctorProfile` | In ₹, 0–100000                                         |
| bio                | `DoctorProfile` | Up to 1000 characters                                  |
| clinicName         | `DoctorProfile` | Up to 120 characters                                   |
| clinicAddress      | `DoctorProfile` | street, city, state, postalCode, country               |
| languages          | `DoctorProfile` | Array of strings, up to 20 items                       |
| availability       | `DoctorProfile` | Array of `{ dayOfWeek, enabled, startTime, endTime }`  |
| verificationStatus | `DoctorProfile` | `PENDING` by default; see below                        |

`DoctorProfile.userId` is unique, so a doctor can never have duplicate
profiles. Availability accepts the seven days (`MONDAY`–`SUNDAY`), each with a
24-hour `HH:mm` start and end time; start must be earlier than end, days must
not repeat, and at most 7 entries are allowed.

### Verification status

Profiles default to `PENDING`. Verification is managed by the platform only:
a doctor attempting to change `verificationStatus` receives `403 FORBIDDEN`.
There is no self-approval path.

### Profile completion

The server calculates a completeness indicator from ten parts, each worth 10%:
`specialization`, `qualification`, `experience`, `registrationNumber`,
`consultationFee`, `bio`, `clinicName`, `clinicAddress` (any subfield filled),
`languages` (at least one), and `availability` (at least one enabled day).

### API endpoints

#### Get doctor profile

```http
GET /api/doctor/profile
Authorization: Bearer <token>
```

Returns the authenticated user and the doctor profile (or `null` profile for a
first-time doctor):

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "661f2f5c9d1a1a1a1a1a1a1a",
      "name": "Dr. John Doe",
      "email": "doctor@example.com",
      "phone": "9876543210",
      "role": "DOCTOR"
    },
    "profile": {
      "specialization": "Cardiologist",
      "qualification": "MBBS, MD",
      "experience": 8,
      "registrationNumber": "MCI-12345",
      "consultationFee": 500,
      "bio": "Cardiologist with eight years of experience.",
      "clinicName": "Aarogya Clinic",
      "clinicAddress": {
        "street": "Main Road",
        "city": "Berhampur",
        "state": "Odisha",
        "postalCode": "760001",
        "country": "India"
      },
      "languages": ["English", "Hindi", "Odia"],
      "availability": [
        { "dayOfWeek": "MONDAY", "enabled": true, "startTime": "10:00", "endTime": "13:00" },
        { "dayOfWeek": "TUESDAY", "enabled": false, "startTime": null, "endTime": null }
      ],
      "verificationStatus": "PENDING"
    },
    "profileCompletion": 100
  }
}
```

#### Create or update doctor profile

```http
PUT /api/doctor/profile
Authorization: Bearer <token>
Content-Type: application/json
```

Creates the profile if it does not exist and updates it if it does. On
creation, `specialization`, `qualification`, and `registrationNumber` are
required. On update, omitted fields keep their current value, `null` or empty
strings clear a field, and required fields reject an explicit empty value.
Malformed input is rejected with `400 VALIDATION_ERROR` and a `details` list
of `{ field, message }`. Sending a different `verificationStatus` is rejected
with `403 FORBIDDEN`.

#### Doctor dashboard

```http
GET /api/doctor/dashboard
Authorization: Bearer <token>
```

Returns the user, profile, profile completion, verification status, and a
statistics block that is kept at zero counts until appointments,
consultations, and prescriptions are implemented in later modules:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "661f2f5c9d1a1a1a1a1a1a1a",
      "name": "Dr. John Doe",
      "email": "doctor@example.com",
      "phone": "9876543210",
      "role": "DOCTOR"
    },
    "profile": null,
    "profileCompletion": 0,
    "verificationStatus": "PENDING",
    "stats": {
      "upcomingAppointments": 0,
      "completedConsultations": 0,
      "prescriptionsCreated": 0
    }
  }
}
```

## Doctor discovery

Patients can search, filter, sort, and view approved doctors. The discovery
API is public and read-only; it is separate from `/api/doctor`, which is the
authenticated doctor's own profile endpoint.

### Approved-only visibility

Every discovery query is filtered at the database level with
`verificationStatus: 'APPROVED'`. `PENDING` and `REJECTED` doctors never
appear in lists and return `404 NOT_FOUND` when their profile ID is requested
directly, without revealing that the profile exists.

### Public information policy

Discovery responses expose only professional information needed to find and
evaluate a doctor: name (from `User`), specialization, qualification,
experience, consultation fee, languages, clinic, address, weekly availability,
and registration number. They never expose `email`, `phone`, `password`,
`passwordHash`, JWT tokens, `userId`, or verification internals. Doctor names
are joined from the `User` model with a safe projection; `passwordHash` is
never selected.

### List doctors

```http
GET /api/doctors
```

| Parameter       | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `q`             | Search by doctor name, specialization, qualification, clinic name (case-insensitive) |
| `specialization`| Exact specialization filter (case-insensitive)             |
| `minExperience` | Minimum experience in years (0–80)                         |
| `maxExperience` | Maximum experience in years (0–80)                         |
| `minFee`        | Minimum consultation fee in ₹ (0–100000)                   |
| `maxFee`        | Maximum consultation fee in ₹ (0–100000)                   |
| `language`      | Language filter (case-insensitive)                         |
| `day`           | Availability day: `MONDAY`–`SUNDAY` (case-insensitive)     |
| `sort`          | `name_asc` (default), `experience_asc`, `experience_desc`, `fee_asc`, `fee_desc` |
| `page`          | Page number, default `1`, minimum `1`                      |
| `limit`         | Per-page limit, default `12`, maximum `50`                 |

Examples:

```http
GET /api/doctors?q=cardio
GET /api/doctors?specialization=Cardiologist&minExperience=5&maxFee=1000
GET /api/doctors?language=Hindi&day=MONDAY&sort=fee_asc&page=2&limit=12
```

Invalid query values (non-numeric ranges, negative values, `min > max`,
unknown sort, unknown day, `page`/`limit` out of bounds) are rejected with
`400 VALIDATION_ERROR` and a `details` list. Sort uses a fixed whitelist and
query parameters are never passed raw into MongoDB.

```json
{
  "success": true,
  "data": {
    "doctors": [
      {
        "id": "661f2f5c9d1a1a1a1a1a1a1a",
        "name": "Dr. Aarvi Kumar",
        "specialization": "Cardiologist",
        "qualification": "MBBS, MD (Cardiology)",
        "experience": 12,
        "consultationFee": 800,
        "bio": "Cardiologist focused on preventive heart care.",
        "clinicName": "Aarogya Heart Clinic",
        "clinicAddress": {
          "street": "Main Road",
          "city": "Berhampur",
          "state": "Odisha",
          "postalCode": "760001",
          "country": "India"
        },
        "languages": ["English", "Hindi"],
        "availability": [
          { "dayOfWeek": "MONDAY", "startTime": "10:00", "endTime": "13:00" }
        ],
        "verificationStatus": "APPROVED"
      }
    ],
    "pagination": { "page": 1, "limit": 12, "total": 25, "totalPages": 3 }
  }
}
```

### Doctor details

```http
GET /api/doctors/:doctorId
```

`doctorId` is the `DoctorProfile` ID. Returns a single doctor with the
professional fields above plus `registrationNumber` and the full weekly
availability (including disabled days). An `APPROVED` doctor returns `200`; a
`PENDING`, `REJECTED`, or unknown doctor returns `404 NOT_FOUND`; a malformed
ID returns `400 VALIDATION_ERROR`.

### Database indexes

`DoctorProfile` keeps the unique `userId` index (one profile per doctor) and
adds single-field indexes on `verificationStatus`, `specialization`,
`experience`, and `consultationFee`:

- `verificationStatus` — every discovery query filters on
  `verificationStatus: 'APPROVED'`.
- `specialization` — the specialization filter and common search term.
- `experience` — the `$gte`/`$lte` experience filters and the
  `experience_asc`/`experience_desc` sorts.
- `consultationFee` — the fee filters and the `fee_asc`/`fee_desc` sorts.

Array fields (`languages`, `availability`) and `bio` are intentionally not
indexed: they are rarely selective on their own. A compound index such as
`{ verificationStatus, specialization }` is a reasonable future addition if
the dataset grows, but is over-indexing for the current scale.

## Appointment module

Patients book 30-minute appointment slots with approved doctors and doctors
confirm, reject, complete, or cancel those requests. There is no payment,
chat/video, notification, or prescription functionality in this module.

### Workflow

1. A patient finds a doctor through the discovery API and calls the public
   availability endpoint for a date.
2. The patient books a slot. The appointment is created with
   `status: PENDING` and reference numbers are capped at 500 characters.
3. The doctor reviews bookings and `CONFIRM`s or `REJECT`s pending requests,
   or `CANCEL`s them.
4. A confirmed appointment can be `COMPLETE`d by the doctor (after the
   consultation) or `CANCEL`led by either party.

Status transitions are centralized: `PENDING → CONFIRMED/REJECTED/CANCELLED`,
`CONFIRMED → COMPLETED/CANCELLED`. `COMPLETED`, `REJECTED`, and `CANCELLED`
are terminal. An invalid transition returns `409 CONFLICT`.

### Slots and availability

- `GET /api/appointments/availability/:doctorId?date=YYYY-MM-DD` is public and
  returns the enabled availability window for that weekday split into aligned
  30-minute slots (`slotMinutes: 30`), each marked `available` or not.
- Only `APPROVED` doctors are visible; `PENDING`/`REJECTED`/unknown return
  `404 NOT_FOUND` and a malformed ID returns `400 VALIDATION_ERROR`.
- Past dates and unaligned/out-of-window start times are rejected with `400`.

### Booking a slot

```http
POST /api/appointments
Authorization: Bearer <PATIENT token>
```

```json
{
  "doctorId": "661f2f5c9d1a1a1a1a1a1a1a",
  "appointmentDate": "2026-10-23",
  "startTime": "10:30",
  "type": "VIDEO",
  "reason": "Chest pain follow-up"
}
```

A successful booking returns `201` with the enriched appointment. Duplicate
bookings are blocked two ways: an application-level overlap check over
`PENDING`/`CONFIRMED` appointments and a partial unique database index on
`{ doctorId, appointmentDate, startTime }` that only applies while the status
is `PENDING` or `CONFIRMED`. Any conflict returns `409 CONFLICT`.

### Managing appointments

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/appointments/availability/:doctorId` | `GET` | Public | Slot availability for a date |
| `/api/appointments` | `POST` | Patient | Create a booking request |
| `/api/appointments/my` | `GET` | Patient | List own appointments (filter `status`, `date`; `page`/`limit`) |
| `/api/appointments/doctor` | `GET` | Doctor | List own appointments (same filters) |
| `/api/appointments/:appointmentId` | `GET` | Owner | Single appointment details |
| `/api/appointments/:appointmentId/confirm` | `PATCH` | Doctor | Confirm a pending request |
| `/api/appointments/:appointmentId/reject` | `PATCH` | Doctor | Reject a pending request |
| `/api/appointments/:appointmentId/complete` | `PATCH` | Doctor | Mark a confirmed appointment completed |
| `/api/appointments/:appointmentId/cancel` | `PATCH` | Owner | Cancel a pending/confirmed appointment |

`doctorId` sent by the client is the `DoctorProfile` ID (as returned by
discovery); the stored appointment references the doctor's `User` ID.
`patientId` is always taken from the authenticated token, never from the
request body. Ownership is enforced (a non-owner gets `403 FORBIDDEN`).

### Appointment response

Appointments are enriched with safe profile details. Nothing sensitive is
leaked: `passwordHash`, `email`, and `phone` are only included for the patient
owner's own records (`name`/`phone`), and doctor entries only carry name,
specialization, and consultation fee.

```json
{
  "id": "661f2f5c9d1a1a1a1a1a1a1a",
  "patientId": "661f2f5c9d1a1a1a1a1a1a1a",
  "doctorId": "662a1b1c1d1a1a1a1a1a1a1a",
  "patient": { "id": "…", "name": "Patient Alpha", "phone": "9876543210" },
  "doctor": { "id": "…", "profileId": "…", "name": "Dr. Aarvi Kumar", "specialization": "Cardiologist", "consultationFee": 800 },
  "appointmentDate": "2026-10-23",
  "startTime": "10:30",
  "endTime": "11:00",
  "type": "VIDEO",
  "status": "PENDING",
  "reason": "Chest pain follow-up",
  "notes": null
}
```

### Database indexes

In addition to the standard `patientId`/`doctorId` indexes:

- `{ doctorId: 1, appointmentDate: -1, startTime: 1 }` — doctor list ordering.
- `{ patientId: 1, appointmentDate: -1, startTime: 1 }` — patient list
  ordering.
- `{ doctorId: 1, status: 1, startTime: 1 }` — doctor status filtering.
- Partial unique `{ doctorId: 1, appointmentDate: 1, startTime: 1 }` where
  `status ∈ [PENDING, CONFIRMED]` — the double-booking guard.

## Video consultation module

A confirmed appointment can be turned into a **one-to-one WebRTC video
consultation** between its patient and doctor. WebRTC carries the audio/video
peer-to-peer; the existing Socket.IO server is used only to exchange signaling
(offers, answers, and ICE candidates). No paid video provider is used.

### Access rules

Access is derived from the stored appointment, never from the client, and only
the two participants may join. A consultation can only be **started for a
`CONFIRMED` appointment**; `PENDING`, `REJECTED`, `CANCELLED`, and `COMPLETED`
appointments cannot start a new call.

### Signaling events

Signaling uses a dedicated `video:<appointmentId>` room, separate from the chat
room. Sockets authenticate with the same JWT (`handshake.auth.token`).

| Event | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `video:join` | client → server | `{ appointmentId }` | Authorize, enforce 2-participant limit, join room (ack returns the negotiation role) |
| `video:ready` | server → peer | `{ appointmentId, initiator, peerUserId }` | Sent to the participant who was already waiting when the peer arrives |
| `video:offer` | client → server → peer | `{ appointmentId, sdp }` | Relay the SDP offer to the other participant only |
| `video:answer` | client → server → peer | `{ appointmentId, sdp }` | Relay the SDP answer to the other participant only |
| `video:ice-candidate` | client → server → peer | `{ appointmentId, candidate }` | Relay an ICE candidate to the other participant only |
| `video:leave` | client → server → peer | `{ appointmentId }` | Notify the peer that the participant left |
| `video:end` | client → server → peer | `{ appointmentId }` | Notify the peer that the call ended |

The first participant to join waits; when the second joins, the server tells the
waiting participant to initiate. This deterministic flow prevents simultaneous
offers (glare). A third participant is rejected with `ROOM_FULL`. Signaling is
only ever relayed to the other member of the sender's own room and is never
stored in the database or logged. The audio consultation exposes the identical
`audio:*` events on an `audio:<appointmentId>` room (see
[Consultation type enforcement](#consultation-type-enforcement)).

### Before joining, the server

1. authenticates the socket,
2. loads the appointment and verifies the user is its patient or doctor,
3. verifies the appointment is `CONFIRMED`,
4. joins the `video:<appointmentId>` room, and
5. reports whether the other participant is already present. The room is capped
   at two participants.

### WebRTC lifecycle

`getUserMedia` → the waiting participant creates an offer → the peer answers →
both exchange ICE candidates → `RTCPeerConnection` connects → media flows
peer-to-peer. Muting and camera on/off only toggle the existing track's
`enabled` flag (the device is not reacquired). Ending a call stops all local
tracks, closes the peer connection, leaves the room, and notifies the peer; the
same cleanup runs on disconnect, refresh, and tab close, and is idempotent.

### ICE / STUN / TURN

- ICE servers are configurable in the browser through `VITE_ICE_SERVERS` (a JSON
  array), see `client/.env.example`.
- By default the client uses a **public STUN server** (`stun.l.google.com`).
  This is suitable for local development and demos only.
- WebRTC is peer-to-peer and free. STUN/TURN infrastructure affects
  reliability. A public STUN server does **not** guarantee connectivity on every
  NAT/firewall; symmetric NATs and restrictive corporate networks require a
  TURN relay. **If no TURN server is configured, calls can fail to connect on
  such networks** — this is a known deployment limitation. Add a TURN server
  (for example self-hosted coturn) via `VITE_ICE_SERVERS` for production. Never
  commit private TURN credentials.

### Frontend

`/appointments/:appointmentId/video` is a single protected page (roles
`PATIENT` and `DOCTOR`). It shows the remote video, a local preview, and
microphone / camera / end-call controls with clear states (requesting media,
waiting, connecting, connected, reconnecting, participant disconnected, call
ended, and specific permission/device errors). The "Start Video Consultation"
action appears on the patient and doctor appointment lists for `CONFIRMED`
appointments **booked as `VIDEO`** only.

## Consultation type enforcement

The consultation method is chosen when the appointment is booked
(`appointment.type ∈ VIDEO / AUDIO / CHAT`) and is the **single source of
truth**. Exactly one method is available for an appointment, enforced
independently on the frontend and the backend; a client-supplied type is never
trusted. The server always reads the type from the stored appointment.

| Booked type | Action shown (CONFIRMED) | Route |
| --- | --- | --- |
| `VIDEO` | Start Video Consultation | `/appointments/:appointmentId/video` |
| `AUDIO` | Start Audio Consultation | `/appointments/:appointmentId/audio` |
| `CHAT` | Open Chat | `/appointments/:appointmentId/chat` |

- The patient and doctor appointment lists render **only** the action that
  matches the appointment type (for `CONFIRMED` appointments). `COMPLETED`
  `CHAT` appointments keep a read-only "View Chat" entry point.
- Opening the wrong method (for example the video route for an `AUDIO`
  appointment) is blocked before any media is acquired: `getUserMedia` and
  `RTCPeerConnection` are never called, and the page shows
  "This appointment was booked as…". The backend rejects the same request with
  `403 CONSULTATION_TYPE_MISMATCH`, so the rule holds even if the UI is
  bypassed.
- A consultation can only be started for a `CONFIRMED` appointment;
  `PENDING`, `REJECTED`, `CANCELLED`, and `COMPLETED` appointments are refused
  (`VIDEO_NOT_AVAILABLE` / `AUDIO_NOT_AVAILABLE`).

### Audio consultation

The audio consultation reuses the exact same signaling protocol as video, on a
separate `audio:<appointmentId>` channel and room, so video and audio traffic
never mix. The client requests `getUserMedia({ audio: true, video: false })` and
plays the remote stream through an `<audio>` element. The only controls are
**Mute / Unmute** and **End call** — there is no camera control. This keeps a
single `useConsultationCall` hook (parameterized by `mediaType: 'video' | 'audio'`)
behind both pages. If no microphone is available, the page explains how to
recover ("No microphone was found on this device…") and offers retry / end.

## Real-time chat module

A confirmed appointment booked as `CHAT` opens a private chat channel between
the patient and the doctor for that appointment. Messages are persisted in
MongoDB and delivered in real time over Socket.IO. There is no video calling,
file/image/audio sharing, typing indicator, or presence feature in this module.

### Access rules

Chat access is derived from the stored appointment, never from the client. The
server loads the appointment and derives the two participants (`patientId`,
`doctorId`) from it; a client-provided receiver is never trusted.

- **Chat is only available for appointments booked as `CHAT`.** A `VIDEO` or
  `AUDIO` appointment is rejected with `403 CONSULTATION_TYPE_MISMATCH`.
- The two participants on the appointment are the only users who may read or
  send messages. Everyone else gets `403 FORBIDDEN`.
- **History** (`GET`) is allowed while the appointment is `CONFIRMED` or
  `COMPLETED`.
- **Sending** is allowed only while the appointment is `CONFIRMED`. `PENDING`,
  `CANCELLED`, `REJECTED`, and `COMPLETED` appointments are read-only.

### Message rules

- Messages are plain text (`type: TEXT`), trimmed before storage.
- Empty or whitespace-only messages are rejected (`400`/`ok:false`).
- A message is capped at **2000 characters** (`MAX_MESSAGE_LENGTH`); longer
  messages are rejected.
- The receiver of every message is derived from the appointment, so a message
  can only ever go to the other participant.
- A message is saved to the database before it is emitted, so a delivered
  message is always persisted.

### REST endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/chat/:appointmentId/messages` | `GET` | Participant | Paginated history, oldest→newest (`page`, `limit`) |
| `/api/chat/:appointmentId/messages` | `POST` | Participant (CONFIRMED) | Send a text message |
| `/api/chat/:appointmentId/read` | `PATCH` | Participant | Mark the other side's messages as read |

All chat endpoints require an `Authorization: Bearer <token>` header. Errors
follow the shared convention: `400 VALIDATION_ERROR` for a malformed ID or
message, `404 NOT_FOUND` for an unknown appointment, `403 FORBIDDEN` for a
non-participant or a read-only status.

### Socket.IO events

Sockets authenticate with the same JWT, passed as `handshake.auth.token`; an
invalid or missing token is rejected during the handshake, and inactive users
are refused. After connecting, the client joins the appointment room
(`appointment:<appointmentId>`) and then exchanges messages.

| Event | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `chat:join` | client → server | `{ appointmentId }` | Join an authorized appointment room (ack) |
| `chat:send` | client → server | `{ appointmentId, message }` | Send a message (ack returns the persisted message) |
| `chat:read` | client → server | `{ appointmentId }` | Mark received messages read (ack) |
| `chat:message` | server → room | message object | Broadcast a newly persisted message |
| `chat:messagesRead` | server → room | `{ appointmentId, byUserId, readAt }` | Notify the peer that messages were read |

### Frontend

`/appointments/:appointmentId/chat` is a single protected page (roles
`PATIENT` and `DOCTOR`) that shows the message history, sends messages, marks
incoming messages read, and reconnects automatically. Entry points are the
"Open Chat"/"View Chat" links on the patient and doctor appointment lists.
When the appointment is `COMPLETED`, the composer is disabled and the page is
read-only. The client shares one Socket.IO connection (`client/src/lib/socket.js`)
and falls back to the REST history endpoint so a page refresh reloads prior
messages.

### Database indexes

`Message` adds indexes to support the chat queries:

- `{ appointmentId: 1, createdAt: 1 }` — loading a conversation in order.
- `{ receiverId: 1, isRead: 1 }` — unread counts and mark-as-read.
- `{ senderId: 1, createdAt: -1 }` — a sender's recent messages.

## Prescription module

After a consultation is completed the doctor can issue a **structured**
prescription for that appointment, and the patient can view it. The structure is
intentional: each medicine is stored as discrete fields so a future Pharmacy
module can build orders without re-parsing free text. This module does **not**
implement pharmacy orders, inventory, PDF export, OCR, or AI features.

### Workflow

Patient books → doctor confirms → consultation completed → doctor creates the
prescription → patient views it. A prescription can be created only for an
appointment whose stored status is `COMPLETED`; every other status is rejected
with `409 CONFLICT`.

### Authorization and ownership model

- **Creation is doctor-only** (`requireRole('DOCTOR')`). Patients, pharmacy, and
  admin roles are rejected with `403`.
- The doctor and patient are **derived from the stored appointment** — a
  client-supplied `doctorId` / `patientId` is never trusted or stored. A doctor
  can only prescribe for their own appointment (`403 FORBIDDEN` otherwise).
- Reading a prescription is limited to the two participants on the underlying
  appointment; unrelated users get `403` and unknown IDs `404`.
- One consultation has at most one prescription. A unique index on
  `appointmentId` is the database backstop, and a pre-check returns a clean
  `409 CONFLICT` (also under concurrent/duplicate submissions).

### Data model

`Prescription` stores `appointmentId`, `patientId`, `doctorId`, `diagnosis`,
`medicines[]`, `instructions`, `followUpDate`, and `status`
(`ACTIVE` / `CANCELLED`). Each medicine stores `medicineName`, `dosage`,
`frequency`, `duration`, `route`, `timing`, `quantity` (positive whole number),
and `instructions`. `route` and `timing` are constrained enums
(`MEDICINE_ROUTES`, `MEDICINE_TIMINGS`). No personal data is duplicated into the
prescription; names/specialization are joined at read time.

### Privacy

Responses never include `passwordHash`, tokens, emails, or phone numbers.
Participants are serialized minimally: `patient: { id, name }` and
`doctor: { id, name, specialization }`.

### REST endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/prescriptions` | `POST` | `DOCTOR` | Create a prescription for a `COMPLETED` appointment |
| `/api/prescriptions` | `GET` | `PATIENT` | The patient's own prescriptions |
| `/api/prescriptions/doctor` | `GET` | `DOCTOR` | The doctor's authored prescriptions |
| `/api/prescriptions/:prescriptionId` | `GET` | Participant | A single prescription |

All endpoints require an `Authorization: Bearer <token>` header. Errors follow
the shared convention: `400 VALIDATION_ERROR` (malformed ID or body),
`401` unauthenticated, `403` wrong role/non-participant, `404` not found,
`409` duplicate or non-completed appointment.

### Frontend

- `/prescriptions` (`MyPrescriptionsPage`) — role-aware list (patient: received,
  doctor: issued) with diagnosis, medicines, follow-up, and status.
- `/prescriptions/:prescriptionId` (`PrescriptionDetailsPage`) — full detail
  view with the medicine list.
- `/doctor/appointments/:appointmentId/prescription` (`CreatePrescriptionPage`)
  — doctor-only form with add/remove medicine rows, required-field validation,
  double-submit protection, and a success state.
- The appointment lists integrate the flow: a `COMPLETED` appointment shows
  **Create Prescription** when none exists and **View Prescription** once one
  does. The appointment payload now includes `prescriptionId` so the UI never
  shows a button for a prescription that does not exist.

### Database indexes

`Prescription` adds:

- `{ appointmentId: 1 }` unique — at most one prescription per consultation.
- `{ patientId: 1, createdAt: -1 }` — patient history.
- `{ doctorId: 1, createdAt: -1 }` — doctor's authored list.

## Medical records module

After a consultation is completed the doctor can attach **medical records** to
that appointment, and the patient can read them. A record is the durable clinical
document behind a visit (consultation note, diagnosis, lab report, linked
prescription, other), whereas the prescription is the medicine list. This module
does **not** implement versioning, OCR, or AI features.

### Medical document upload (patient)

- Patients can upload their own medical documents (lab reports, scans, prescriptions, discharge summaries, certificates, consultation documents, or other files) from `/medical-records`.
- Supported file types: PDF, JPG, JPEG, PNG. Maximum file size: 10 MB per file.
- Uploads are stored locally in `server/uploads/medical-documents/`. **Do not serve these files publicly.** Download/preview use an authenticated API that reads the file on demand.
- Privacy: documents are private by default. Patients can list/view/download/delete their own uploads. Doctors may only access documents linked to a MedicalRecord they created. Admin has no unrestricted access.
- Local storage only: for a free college/demo deployment use this local storage. Production should use private cloud object storage with signed access URLs.
- Document can optionally be linked to an existing medical record belonging to the patient; unlinked documents remain patient-private.
- Security: safe generated filenames, path traversal protection, MIME + magic-byte validation, Content-Disposition with safe filename, no token in URLs, no `passwordHash`/tokens/emails/phone/physical paths returned.

### Workflow

Patient books → doctor confirms → consultation completed → doctor creates one or
more medical records → the patient reads them. Unlike prescriptions, **multiple
records are allowed for the same consultation** (for example a consultation note
plus a lab report), so `appointmentId` is indexed but deliberately **not** unique.
A record can be created only when the appointment's stored status is `COMPLETED`;
every other status is rejected with `409 CONFLICT`.

### Authorization and ownership model

- **Creation is doctor-only** (`requireRole('DOCTOR')`). Patients, pharmacy, and
  admin roles are rejected with `403`.
- The doctor and patient are **derived from the stored appointment** — a
  client-supplied `doctorId` / `patientId` is never trusted or stored. A doctor
  can only create records for their own appointment (`403 FORBIDDEN` otherwise).
- **Visibility is scoped by role.** A patient can only list and read records about
  themselves. A doctor can only list and read records **they created**. A record
  belonging to another patient or another doctor returns `403`; unknown IDs return
  `404`, and malformed IDs return `400`.

### Data model

`MedicalRecord` stores `patientId`, `doctorId`, `appointmentId`, optional
`prescriptionId`, `recordType` (enum: `CONSULTATION`, `DIAGNOSIS`, `LAB_REPORT`,
`PRESCRIPTION`, `OTHER`), `title`, optional `diagnosis`, `summary`, optional
`notes`, and `recordDate`. No personal data is duplicated into the record;
names/specialization are joined at read time.

When `prescriptionId` is supplied it must exist **and** belong to the same
patient, doctor, and appointment; anything else is rejected with
`400 VALIDATION_ERROR`.

### Privacy

Responses never include `passwordHash`, tokens, emails, or phone numbers.
Participants are serialized minimally: `patient: { id, name }` and
`doctor: { id, name, specialization }`. The appointment block exposes only
`id`, `appointmentDate`, `startTime`, `endTime`, and `type`.

### REST endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/medical-records` | `POST` | `DOCTOR` | Create a record for a `COMPLETED` appointment |
| `/api/medical-records` | `GET` | `PATIENT` / `DOCTOR` | Records about the patient / created by the doctor |
| `/api/medical-records/:recordId` | `GET` | Owner | A single record (patient-owned or doctor-created) |

The list endpoint supports pagination (`page`, `limit`, max `50`) and optional
whitelisted filters (`recordType`, `from` / `to` date range). Unknown query
parameters are ignored, and invalid filters return `400 VALIDATION_ERROR`; no
raw MongoDB operators are ever accepted.

All endpoints require an `Authorization: Bearer <token>` header. Errors follow
the shared convention: `400 VALIDATION_ERROR` (malformed ID, body, or filter),
`401` unauthenticated, `403` wrong role/not the owner, `404` not found, `409`
non-completed appointment.

### Frontend

- `/medical-records` (`MyMedicalRecordsPage`) — role-aware list with a record
  type filter, pagination, loading/empty/error states, and a link per record.
- `/medical-records/:recordId` (`MedicalRecordDetailsPage`) — full detail view
  with parties, consultation, diagnosis, summary, notes, and a link to the
  linked prescription when present.
- `/appointments/:appointmentId/medical-record/new` (`CreateMedicalRecordPage`)
  — doctor-only form with a read-only consultation summary, required-field
  validation, double-submit protection, an optional "link the related
  prescription" control, a guard for appointments that are not `COMPLETED`, and
  a success state.
- The doctor appointment list shows **Create Medical Record** on every
  `COMPLETED` appointment it owns. The patient dashboard quick action and both
  role navs link to `/medical-records`.

### Database indexes

`MedicalRecord` adds:

- `{ patientId: 1, recordDate: -1 }` — patient record timeline.
- `{ doctorId: 1, recordDate: -1 }` — doctor's created records.
- `{ appointmentId: 1 }` — records for a consultation (**not** unique, so a
  consultation can produce several records).

## Pharmacy foundation

A `PHARMACY` account owns a single pharmacy profile. The verified profile owns
the pharmacy's medicine inventory, and patients or visitors can search the
public catalogue. Patients can save medicines in separate pharmacy carts and
place Cash on Delivery orders; online payments, pharmacy order fulfilment, and
delivery tracking are not implemented yet.

### Profile fields

| Field              | Notes                                                        |
| ------------------ | ------------------------------------------------------------ |
| pharmacyName       | Required, up to 120 characters                               |
| pharmacistName     | Required, up to 100 characters                               |
| licenseNumber      | Required and unique, up to 60 characters                     |
| phone              | Required; validated with the shared phone format             |
| email              | Optional business contact email                              |
| address, city, state | Required location details                                  |
| pincode            | Required 6-digit Indian pincode                              |
| description        | Optional, up to 1000 characters                              |
| openingTime, closingTime | Optional `HH:mm` values; must be supplied together and opening must be earlier than closing |
| verificationStatus | `PENDING`, `APPROVED`, or `REJECTED`; platform-managed        |
| isActive           | Defaults to `true`; not writable by the pharmacy             |

`userId` is unique, so one account can never own more than one pharmacy profile.
The owning user is always derived from the JWT; a client-supplied `userId` is
ignored.

### Verification

Every new profile starts as `PENDING`. Pharmacies can read their own status but
cannot approve or reject themselves: sending a different `verificationStatus` on
create or update returns `403 FORBIDDEN`. There is no admin verification UI in
this phase.

### API endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/pharmacy/profile` | `GET` | `PHARMACY` | Read the authenticated pharmacy's profile (or `null`) |
| `/api/pharmacy/profile` | `POST` | `PHARMACY` | Create the profile |
| `/api/pharmacy/profile` | `PUT` | `PHARMACY` | Update the profile |
| `/api/pharmacies/:pharmacyId` | `GET` | Public | Approved, active pharmacy details |

Owner endpoints require a bearer token and the `PHARMACY` role. They never
expose `passwordHash`, tokens, the owning `userId`, or raw Mongo fields. The
public endpoint intentionally exposes business contact details but only for
`APPROVED` and active pharmacies; `PENDING`, `REJECTED`, inactive, and unknown
profiles return `404`.

### Frontend

- `/pharmacy/dashboard` — pharmacy summary, verification state, and quick
  actions for inventory and the profile.
- `/pharmacy/profile` — create, view, and edit the profile; verification status
  is read-only.
- Pharmacy navigation appears only for `PHARMACY` accounts. Patients and doctors
  are rejected by the existing `ProtectedRoute` role checks.

### Database indexes

`Pharmacy` keeps the unique `userId` index (one profile per account), a unique
`licenseNumber` index, and an index on `verificationStatus` for the approved-only
public lookup.

### Medicine inventory

Medicines belong to the authenticated pharmacy's profile. The owning pharmacy is
always derived from the JWT; a client-supplied `pharmacyId` is ignored. A pharmacy
without a profile gets `404 PROFILE_REQUIRED`, and another pharmacy's medicine
also returns `404` so its existence is not disclosed.

| Field                | Notes |
| -------------------- | --- |
| name                 | Required, up to 200 characters |
| genericName          | Optional, up to 200 characters |
| brandName            | Optional, up to 200 characters |
| category             | Required: `TABLET`, `CAPSULE`, `SYRUP`, `INJECTION`, `CREAM`, `OINTMENT`, `DROPS`, `INHALER`, `POWDER`, or `OTHER` |
| description          | Optional, up to 1000 characters |
| dosageForm           | Optional, up to 100 characters |
| strength             | Optional, up to 100 characters |
| packSize             | Optional, up to 100 characters |
| price                | Required number from 0 to 1,000,000 with at most 2 decimals |
| stockQuantity        | Required integer from 0 to 1,000,000 |
| prescriptionRequired | Boolean, defaults to `true` |
| expiryDate           | Required `YYYY-MM-DD`; stored at UTC midnight and returned date-only |
| isActive             | System-managed; changed only through the activate/deactivate endpoints |

Each pharmacy can have only one medicine with the same normalized name,
strength, and dosage form. Repeating that combination returns
`409 DUPLICATE_MEDICINE`; the same medicine may exist in another pharmacy.

Inventory management is allowed while the pharmacy is `PENDING` or `APPROVED`.
A `REJECTED` pharmacy receives `403 PHARMACY_REJECTED` and an inactive pharmacy
receives `403 PHARMACY_INACTIVE`. Medicines are never hard-deleted. Expired
medicines stay visible with a computed `isExpired` flag and can be deactivated.

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/medicines` | `GET` | `PHARMACY` | List own medicines |
| `/api/medicines` | `POST` | `PHARMACY` | Add a medicine |
| `/api/medicines/:medicineId` | `GET` | `PHARMACY` | Read one own medicine |
| `/api/medicines/:medicineId` | `PUT` | `PHARMACY` | Update an own medicine |
| `/api/medicines/:medicineId/deactivate` | `PATCH` | `PHARMACY` | Mark inactive |
| `/api/medicines/:medicineId/activate` | `PATCH` | `PHARMACY` | Mark active |

The list supports `q` (name, generic name, brand), `category`, `isActive`,
`page`, `limit` (default 20, maximum 50), and a whitelisted `sort`
(`name`, `price`, `stock`, or `expiry`, each `_asc` or `_desc`). Responses use
`{ medicines, pagination }` and expose no owner or verification internals.

Frontend routes:

- `/pharmacy/inventory` — searchable, filterable, paginated inventory with
  expiry warnings and activate/deactivate actions.
- `/pharmacy/inventory/new` — add a medicine.
- `/pharmacy/inventory/:medicineId/edit` — edit an own medicine.

The `Medicine` collection keeps a unique compound index on
`{ pharmacyId, identityKey }` as the duplicate backstop, plus indexes for
inventory listing and name search.

### Public medicine search

Public medicine discovery is read-only and requires no authentication. A result
is visible only when the medicine is active and not expired **and** its pharmacy
profile exists, is `APPROVED`, and is active. Pending, rejected, inactive,
expired, and orphaned records are hidden; a hidden medicine's detail request
returns `404` without revealing that it exists privately.

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/public/medicines` | `GET` | Public | Search available medicines |
| `/api/public/medicines/:medicineId` | `GET` | Public | Read a visible medicine |

The list supports `q` (name, generic name, brand, strength), `category`,
`pharmacyId`, `minPrice`, `maxPrice`, `prescriptionRequired`, `inStock`, `page`,
and `limit`. Pagination defaults to 20 with a maximum of 50. Sorting is limited
to `name_asc`, `name_desc`, `price_asc`, `price_desc`, `expiry_asc`,
`expiry_desc`, `stock_desc`, and `newest`.

Results include only public medicine fields plus a safe pharmacy summary
(pharmacy name, pharmacist name, address, city, state, and pincode). Customer
responses expose `inStock` and the current stock count but never internal
ownership, duplicate identity, authentication data, or pharmacy verification
internals. An out-of-stock medicine remains visible unless `inStock=true` is
requested.

Frontend routes:

- `/medicines` — public search with category, price, prescription, and
  availability filters, sorting, pagination, and shareable URL state.
- `/medicines/:medicineId` — public medicine details with the selling pharmacy.

### Pharmacy cart

The cart is available only to authenticated `PATIENT` accounts. The patient is
always derived from the JWT. A patient has at most one cart per pharmacy, while
multiple pharmacy carts may coexist; medicines from different pharmacies are
never combined into one cart.

Every item stores a server-derived snapshot of the medicine name, generic name,
strength, dosage form, pack size, prescription requirement, and unit price.
Client-supplied `patientId`, `pharmacyId`, prices, stock, and medicine names are
ignored. Cart totals use the recorded snapshot, and the response separately
reports the current price and whether it has changed.

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/cart` | `GET` | `PATIENT` | Read all carts and the overall summary |
| `/api/cart/items` | `POST` | `PATIENT` | Add a quantity to the pharmacy cart |
| `/api/cart/items/:medicineId` | `PATCH` | `PATIENT` | Set an item quantity |
| `/api/cart/items/:medicineId` | `DELETE` | `PATIENT` | Remove one item |
| `/api/cart/:cartId` | `DELETE` | `PATIENT` | Clear a pharmacy cart |

`POST` adds to an existing quantity, while `PATCH` sets the absolute quantity.
An item cannot exceed 100 units or the medicine's current stock. Adding a
medicine requires an active, unexpired medicine with stock greater than zero
from an approved, active pharmacy. Failures use specific conflict codes such as
`MEDICINE_OUT_OF_STOCK`, `MEDICINE_EXPIRED`, `PHARMACY_UNAVAILABLE`,
`CART_QUANTITY_EXCEEDS_STOCK`, and `CART_QUANTITY_LIMIT_EXCEEDED`.

`GET /api/cart` returns `{ carts, summary }`. Each item includes the current
stock, subtotal, snapshot and current price, price-change flag, and an
availability status: `available`, `lowStock` (5 units or fewer),
`quantityExceeded`, `outOfStock`, `expired`, `pharmacyUnavailable`, or
`unavailable`. Removing the last item from a cart leaves an empty record that is
hidden from reads; clearing a cart deletes it. Empty state is `{ carts: [],
summary }`, not `404`.

Frontend integration:

- `/cart` — protected patient route with pharmacy-grouped items, quantity
  controls, availability and price-change notices, per-cart clear actions, and
  an overall summary.
- The patient navigation and public header show a cart badge. Add-to-cart
  controls appear on medicine search and detail pages only for patient accounts.
- Each pharmacy cart links to checkout and the patient's order history.
- Online payments, delivery tracking, and notifications are intentionally not
  implemented in this phase.

The `Cart` collection has a unique compound index on
`{ patientId, pharmacyId }`. Atomic updates re-check stock and quantity limits
so concurrent add requests cannot create duplicate rows or exceed availability.

## Pharmacy orders and COD checkout

An authenticated `PATIENT` can turn one pharmacy cart into a Cash on Delivery
order. Checkout is server-authoritative: the API reloads the cart, pharmacy,
medicines, stock, prices, and prescriptions. Client-supplied ownership, medicine
metadata, prices, totals, payment status, and order status are ignored.

### Checkout rules

- The cart must belong to the patient and contain at least one item.
- The pharmacy must still be `APPROVED` and active.
- Every medicine must still belong to that pharmacy, be active, be unexpired,
  and have enough stock for the requested quantity.
- A changed cart price snapshot is rejected with `409 PRICE_CHANGED`; checkout
  never silently charges a different price.
- Quantities must be whole numbers from 1 to 100 and cannot exceed current
  stock.
- Each prescription-required medicine needs a `prescriptionSelections` entry.
  The prescription must belong to the patient, be `ACTIVE`, and contain a
  normalized exact match on the medicine name or generic name.
- Only `COD` is accepted. New orders use `paymentStatus: PENDING`,
  `orderStatus: PLACED`, `deliveryFee: 0`, and `prescriptionStatus: VERIFIED`
  or `NOT_REQUIRED`. Online payments are not exposed; pharmacy order status
  management is described below.
- The server recalculates the subtotal and total from validated snapshots.
- The source cart is deleted after a successful order, so ordered items cannot
  be submitted again.

Checkout failures use specific `409` codes: `CART_EMPTY`,
`PHARMACY_UNAVAILABLE`, `MEDICINE_NOT_FOUND`, `MEDICINE_UNAVAILABLE`,
`MEDICINE_EXPIRED`, `PRICE_CHANGED`, `INSUFFICIENT_STOCK`,
`PRESCRIPTION_REQUIRED`, `INVALID_PRESCRIPTION`, and `CHECKOUT_CONFLICT`.
Malformed input returns `400 VALIDATION_ERROR`; unauthenticated requests return
`401`, and wrong roles return `403`.

### API endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/orders/checkout` | `POST` | `PATIENT` | Create one COD order from a pharmacy cart |
| `/api/orders` | `GET` | `PATIENT` | List the authenticated patient's orders |
| `/api/orders/:orderId` | `GET` | `PATIENT` | Read one owned order |

Checkout request:

```json
{
  "cartId": "661f2f5c9d1a1a1a1a1a1a1a",
  "deliveryAddress": {
    "fullName": "John Doe",
    "phone": "9876543210",
    "addressLine1": "12 Example Street",
    "addressLine2": "Near City Market",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001",
    "landmark": "Opposite the park"
  },
  "paymentMethod": "COD",
  "prescriptionSelections": [
    {
      "medicineId": "661f2f5c9d1a1a1a1a1a1a1b",
      "prescriptionId": "661f2f5c9d1a1a1a1a1a1a1c"
    }
  ]
}
```

`fullName`, `phone`, `addressLine1`, `city`, `state`, and a valid 6-digit Indian
`pincode` are required. `addressLine2` and `landmark` are optional.

An optional `Idempotency-Key` header, up to 128 characters after trimming,
makes retries safe. Keys are scoped to the patient; a replay returns `200` with
the existing order, while a new order returns `201`. A hidden unique
`sourceCartId` index is the database backstop against double submission even
without a key.

Order history accepts `status`, `page`, `limit` (default 10, maximum 50), and
`sort` (`newest`, `oldest`, `total_asc`, or `total_desc`). `GET /api/orders`
returns `{ orders, pagination }`, and all reads are scoped to the authenticated
patient. Unknown or another patient's order returns `404 ORDER_NOT_FOUND`.

Responses contain safe medicine and pharmacy snapshots plus the delivery
address, totals, payment method/status, order status, prescription status, and
placed date. They never expose `patientId`, `sourceCartId`, the idempotency key,
pharmacy license details, authentication data, or raw Mongo internals.

### Stock consistency

Because local development may run MongoDB as a standalone server without
transactions, stock is reserved with conditional atomic decrements that require
the medicine to still be active, current, and sufficiently stocked. If a later
line or the order insert fails, already-reserved quantities are compensated
(restored). Concurrent checkouts therefore cannot oversell stock, and the unique
order indexes resolve duplicate requests to one stored order.

### Frontend

- `/checkout/:cartId` — protected patient checkout with delivery address,
  prefilled account name/phone, prescription selection, COD summary, validation,
  double-submit protection, and idempotent retries.
- `/orders/:orderId/success` — order confirmation with safe fetch fallback.
- `/orders` — order history with status filtering, sorting, pagination, and
  empty/error states.
- `/orders/:orderId` — owned order details with medicines, prescription links,
  delivery address, pharmacy, payment, statuses, and totals.
- `/cart` exposes a checkout action per pharmacy and explains blocked checkout
  conditions. `My Orders` appears in patient navigation and dashboard actions.

### Database indexes

`Order` adds:

- `{ sourceCartId: 1 }` — unique; one cart can produce at most one order.
- `{ patientId: 1, idempotencyKey: 1 }` — unique partial index for non-null keys.
- `{ patientId: 1, placedAt: -1, _id: -1 }` — newest-first patient history.
- `{ patientId: 1, orderStatus: 1, placedAt: -1 }` — status-filtered history.

## Pharmacy order management

An authenticated `PHARMACY` account can review and fulfil orders belonging to
its own pharmacy. The API resolves the pharmacy from the JWT user and never
accepts a client-supplied pharmacy identifier or ownership field.

### Profile eligibility and isolation

- A pharmacy profile must exist, be `APPROVED`, and be active.
- A missing profile returns `404 PROFILE_REQUIRED`.
- `PENDING` profiles return `403 PHARMACY_NOT_APPROVED`; `REJECTED` profiles
  return `403 PHARMACY_REJECTED`; inactive profiles return
  `403 PHARMACY_INACTIVE`.
- Every list, detail, summary, and status query is scoped to the authenticated
  pharmacy. Another pharmacy's order returns `404 ORDER_NOT_FOUND` without
  revealing whether it exists.
- Verification remains platform-controlled; pharmacies cannot approve
  themselves.

### API endpoints

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/pharmacy/orders` | `GET` | `PHARMACY` | List pharmacy-owned orders |
| `/api/pharmacy/orders/summary` | `GET` | `PHARMACY` | Return dashboard status counts |
| `/api/pharmacy/orders/:orderId` | `GET` | `PHARMACY` | Read one owned order |
| `/api/pharmacy/orders/:orderId/status` | `PATCH` | `PHARMACY` | Move an owned order to the next valid status |

Order list query parameters:

- `q` — searches case-insensitively by complete order ID, delivery customer
  name, medicine name, generic name, or brand name. Maximum 100 characters.
- `status` — one of the supported order statuses.
- `page` — positive integer, default `1`.
- `limit` — positive integer, default `20`, maximum `50`.
- `sort` — `newest`, `oldest`, `total_asc`, or `total_desc`.

The list returns `{ orders, pagination }`. The summary returns
`{ placed, confirmed, processing, ready, outForDelivery, delivered, cancelled }`,
all counted only for the authenticated pharmacy.

Status updates accept exactly one field:

```json
{
  "status": "CONFIRMED"
}
```

Unexpected fields such as `paymentStatus`, `totalAmount`, `items`,
`deliveryAddress`, `pharmacyId`, or `orderStatus` are rejected with
`400 VALIDATION_ERROR`.

### Status transition rules

| Current status | Allowed next statuses |
| --- | --- |
| `PLACED` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `READY` |
| `READY` | `OUT_FOR_DELIVERY` |
| `OUT_FOR_DELIVERY` | `DELIVERED` |
| `DELIVERED` | Terminal |
| `CANCELLED` | Terminal |

Any other transition, including setting the same status again, returns
`409 INVALID_STATUS_TRANSITION` with the current status, requested status, and
allowed next statuses. Updates use an atomic status check so concurrent requests
cannot apply two conflicting transitions.

Status changes update only `orderStatus`. They do not deduct or restore stock,
change totals or item snapshots, edit the delivery address, or modify
`paymentStatus`. A delivered COD order therefore remains `PENDING`; no payment
capture or refund is implemented.

### Privacy

Pharmacy order responses contain order details, item snapshots, delivery
information, prescription status, and pricing. Customer information is limited
to the delivery `fullName` and `phone`. Responses never expose patient account
email, password hashes, JWTs, internal user IDs, medical records, appointments,
consultation notes, diagnoses, chat messages, unrelated prescriptions,
`sourceCartId`, `idempotencyKey`, pharmacy verification internals, or raw Mongo
fields.

### Frontend

- `/pharmacy/orders` — responsive search, status filtering, sorting, pagination,
  desktop table, mobile cards, and loading/empty/error states.
- `/pharmacy/orders/:orderId` — items, customer, delivery address, payment,
  totals, available status actions, and confirmation dialogs. Cancellation has
  a stronger warning that no refund is processed.
- `/pharmacy/dashboard` — real pharmacy-scoped counts for New Orders, Confirmed,
  Processing, Ready, Out for Delivery, Delivered, and Cancelled, with links into
  filtered order views.
- Pharmacy navigation is Dashboard, Orders, Inventory, and Profile. Patient-only
  navigation is never shown to pharmacy accounts, and patients cannot access
  pharmacy order routes.

### Database indexes

`Order` adds:

- `{ pharmacyId: 1, placedAt: -1, _id: -1 }` — newest-first pharmacy order list.
- `{ pharmacyId: 1, orderStatus: 1, placedAt: -1 }` — filtered pharmacy orders
  and summary status grouping.

### Explicit limitations

Pharmacy order management does not implement delivery or courier tracking,
notifications, email/SMS, online payments, refunds, admin order management,
customer ratings, pharmacy-patient chat, multiple pharmacies per order,
prescription approval beyond the Phase 13.5 verification workflow, AI features,
or Phase 13.9+ functionality.

## Phase 13.7 — Patient Order Status & Tracking

Tracking currently means order-status tracking only.

An authenticated `PATIENT` can view a read-only status timeline for an owned order on
`/orders/:orderId`. The timeline is rendered from real `statusHistory` data returned by
the existing patient and pharmacy order APIs. The `Order` document remains the source of
truth; no tracking, courier, ETA, GPS, live location, map, Socket.IO, notification, or
Phase 13.9+ functionality is implemented.

### Data model

`Order.statusHistory` is an embedded array of `{ status, timestamp }` entries:

- Entries use `_id: false`.
- `status` is constrained to the order status enum.
- `timestamp` is required.
- The default is an empty array.
- No `changedByRole` field, separate history collection, or `statusHistory` index is
  added.
- New checkout creates exactly one `PLACED` entry with the same timestamp as `placedAt`.
- Legacy orders without history serialize as `statusHistory: []`. The UI shows the current
  status badge and `Detailed status history is not available for this order.` It does not
  invent historical transitions.
- Malformed legacy entries are filtered safely by the serializer and never crash the API.

### Lifecycle

The status lifecycle is unchanged from Phase 13.6:

`PLACED -> CONFIRMED -> PROCESSING -> READY -> OUT_FOR_DELIVERY -> DELIVERED`

Cancellation path:

`PLACED -> CANCELLED`

Only authorized pharmacy transitions may append history. Patients are read-only and cannot
modify order status or history. Client-supplied `statusHistory`, `orderStatus`, `patientId`,
or `pharmacyId` values are ignored.

### API

No new endpoint is added. Existing endpoints return `statusHistory`:

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/orders/:orderId` | `GET` | `PATIENT` | Read one owned order, including status history |
| `/api/pharmacy/orders/:orderId` | `GET` | `PHARMACY` | Read one owned order, including status history |

Pharmacy status updates append one entry atomically with the status change. The response
contains only `status` and ISO timestamp values; it never exposes account internals,
tokens, passwords, user IDs, or raw Mongo fields.

### Atomic transition behavior

`PATCH /api/pharmacy/orders/:orderId/status` first validates the transition, then performs
one conditional `findOneAndUpdate` with `$set: { orderStatus }` and `$push: { statusHistory }`.
Concurrent conflicting updates resolve to one successful transition and one `409` response.
Invalid or repeated transitions append no history entry.

Status updates remain limited to `orderStatus`. They do not deduct or restore stock, change
totals or item snapshots, edit the delivery address, or modify `paymentStatus`.

### Frontend

- `/orders/:orderId` shows an `Order status` section near the top of the page.
- `OrderStatusTimeline` renders `Completed`, `Current`, and `Pending` text states with
  accessible markers and timestamps.
- A delivered order marks every lifecycle step as completed.
- A cancelled order renders only `PLACED` and `CANCELLED`, followed by `Order cancelled`.
- Legacy or incomplete history uses the safe fallback instead of fabricated dates.
- `My Orders` continues to show status, date, total, pharmacy, and a detail link.
- The patient dashboard does not add fake order statistics.

### Privacy and security

- Patients can read only their own order history and status history.
- Patients cannot modify status or history through any route.
- Pharmacies can read and transition only their own orders.
- History entries contain only `status` and `timestamp`.
- Status updates do not expose or alter stock, payment, totals, items, or delivery data.
- No GPS, ETA, maps, courier, driver, live location, Socket.IO, notifications, or
  later-phase tracking behavior is implemented.

### Explicit limitations

Phase 13.7 does not implement delivery/courier tracking, ETAs, maps, live location,
real-time status updates, notifications, email/SMS, refunds, online payments, admin order
management, customer ratings, pharmacy-patient chat, multiple pharmacies per order, or
Phase 13.9+ functionality.

### Database indexes

No new index is added for `statusHistory`. Existing `Order` indexes remain unchanged.

## Phase 13.8 — COD / Payment Foundation

Cash on Delivery is the only supported payment method. Online payment is not implemented in the current college-project version.

### Server behavior

- `PAYMENT_METHODS` contains only `COD`; `DEMO` and all online methods are rejected.
- Supported payment statuses are `PENDING`, `PAID`, `FAILED`, and `CANCELLED`.
  New orders always start at `PENDING`.
- Checkout accepts `COD` case-insensitively, trims surrounding whitespace, and
  normalizes it to `COD`. A missing, `null`, or empty method defaults to `COD`.
  Non-string and unsupported values return `400 VALIDATION_ERROR` with a
  `paymentMethod` detail.
- Client-supplied `paymentStatus`, totals, fees, item snapshots, stock, and
  timestamps are ignored. The server reloads the cart, medicine prices, stock,
  and prescriptions before creating an order.
- No endpoint can mark an order as paid. Pharmacy status updates accept only
  `status` and reject `paymentStatus`; patient order routes are read-only.
- COD orders remain `PENDING` through `DELIVERED` and `CANCELLED`. No payment
  capture, refund, gateway callback, or fake payment-success flow exists.
- Legacy orders with missing or unsupported payment values are serialized as
  `null` rather than exposing raw database values. The UI displays a safe
  fallback.

### Frontend

- Checkout shows a Cash on Delivery card, the pending payment status, and
  “Online payment is not currently available.” No card, UPI, or wallet fields
  are rendered or submitted.
- The success page states that the order was placed and payment will be
  collected on delivery. It never claims that payment succeeded.
- Order details show Payment method, Payment status, Amount, and prescription
  status in a section separate from order-status tracking.
- My Orders and pharmacy order views show a compact payment-status badge.
- `PaymentStatusBadge` is presentation-only and cannot change payment state.

### Explicit limitations

Phase 13.8 does not implement online payments, payment gateways, webhooks,
payment verification, refunds, COD collection confirmation, admin finance
tools, or Phase 13.9/13.10 functionality. No card number, CVV, UPI ID, or
gateway secret is stored or logged.

### Database indexes

No index is added for `paymentStatus`. Existing `Order` indexes remain unchanged.

## Phase 13.9 — Notifications

Notifications are currently in-app only. Email, SMS, browser push, and external notification providers are not implemented.

Order notifications are generated only after successful order creation or successful order-status transitions.

### Server behavior

- `Notification` records store `userId`, `type`, `title`, `message`,
  `referenceId`, `referenceType`, `eventKey`, `isRead`, and timestamps.
- Supported types are `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_PROCESSING`,
  `ORDER_READY`, `ORDER_OUT_FOR_DELIVERY`, `ORDER_DELIVERED`,
  `ORDER_CANCELLED`, and `NEW_ORDER`.
- Checkout creates `ORDER_PLACED` for the patient and `NEW_ORDER` for the
  pharmacy owner only after the order has been created successfully.
- A successful pharmacy status transition creates the matching patient
  notification. Invalid or repeated transitions and failed checkouts create no
  notification.
- Event keys such as `ORDER_PLACED:<orderId>` and
  `NEW_ORDER:<orderId>` prevent duplicate notifications on retries.
- Notification serializers expose only `id`, `type`, `title`, `message`,
  `referenceId`, `referenceType`, `isRead`, and `createdAt`.

### API

- `GET /api/notifications` supports `page`, `limit` (default 20, maximum 50),
  and `unreadOnly`, and returns `notifications`, `pagination`, and
  `unreadCount`.
- `GET /api/notifications/unread-count` returns the authenticated user's
  unread count.
- `PATCH /api/notifications/:notificationId/read` marks one notification as
  read and returns the updated notification and unread count.
- `PATCH /api/notifications/read-all` marks all of the authenticated user's
  notifications as read.
- All notification endpoints require authentication. One user cannot read or
  mark another user's notifications.

### Real-time delivery

- The existing authenticated Socket.IO server adds each user to the private
  room `notifications:<userId>`.
- Newly persisted notifications are emitted as `notification:new` with the
  safe notification payload.
- Delivery is best-effort; persistence remains the source of truth and
  notifications remain available through the API when a socket is unavailable.
- Existing chat, video, and audio socket rooms and events are unchanged.

### Frontend

- A notification bell in authenticated navigation shows the unread badge,
  recent notifications, and a link to the notifications page.
- `/notifications` lists all notifications with unread-only filtering,
  pagination, per-notification mark-as-read, and mark-all-as-read.
- Authenticated patient, doctor, pharmacy, and fallback/admin navigation
  includes a Notifications link. Opening a notification marks it as read and
  routes patient or pharmacy users to the related order.
- Notification state and the shared socket connection are cleared when the
  user signs out or switches accounts.

### Database indexes

- `{ userId: 1, createdAt: -1 }`
- `{ userId: 1, isRead: 1, createdAt: -1 }`
- `{ userId: 1, eventKey: 1 }` (unique)

### Explicit limitations

Phase 13.9 does not implement email, SMS, browser push, Firebase, OneSignal,
external notification providers, admin notification management, user
notification preferences, marketing notifications, or bulk notifications.
Notifications cannot be deleted and no Phase 13.10 functionality is included.

## Phase 13.10 — Admin Verification & Management

### Overview
Admin verification and management UI for approving/rejecting doctors, pharmacies, and users. Includes admin dashboard, medicine/orders/user lists, and verification action modals.

### UI components introduced
- Admin layout with protected routes (`roles={['ADMIN']}`)
- Admin pages: Medicines, Orders, Order Details, Users, Doctors, Pharmacies
- Shared component library: Button, Input, Card, StatCard, Select, Textarea, Badge, StatusBadge, Table, Pagination, Modal, Dropdown, Alert, EmptyState, ErrorState, LoadingState, Avatar, PageHeader, SectionHeader
- Notification format updates for DOCTOR_APPROVED, DOCTOR_REJECTED, PHARMACY_APPROVED, PHARMACY_REJECTED

### Admin backend (unchanged)
- `server/src/services/admin.service.js`, `admin.controller.js`, `admin.routes.js` — existing APIs preserved
- Admin test suite: 21/21 passing
- Full backend test suite: 926/926 passing

### Limitations
- No backend API changes; admin pages consume existing admin endpoints
- No new authentication flows; admin access requires `ADMIN` role via `ProtectedRoute`
- Verification status transitions remain platform‑controlled; admins can view and trigger actions but server-side approval logic is unchanged
- No order‑payment integration, no delivery/courier tracking, no email/SMS notifications beyond in‑app
- Front‑end only; no database schema changes, no new MongoDB collections or indexes
- No admin‑user creation or password reset flows
- No role‑based data‑scoping beyond what existing APIs provide

### E2E verification
- Phase 13.10 script (`phase13.10‑e2e.cjs`): 31/31 checks pass
- Phase 13.5‑13.9 regression suite: all checks pass

## Running the backend tests

```bash
cd server
npm test
```

Tests run against a dedicated database (`mediconnect_test`) and cover
registration, login, JWT validation, role authorization, the patient, doctor,
doctor discovery, appointment, real-time chat (REST and Socket.IO), consultation
type enforcement, prescription, medical records, pharmacy profile, medicine
inventory, public medicine discovery, pharmacy cart, COD order creation, pharmacy
order management, patient order status history, COD payment foundation, in-app
notifications (REST and Socket.IO), plus regression checks.

## Documentation

- `docs/` — architecture, API, and database documentation (added as modules land).
