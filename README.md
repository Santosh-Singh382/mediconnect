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

Returns the user, profile, profile completion, and a statistics block that is
kept at zero counts until appointments, consultations, prescriptions, medical
records, and orders are implemented in later modules:

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

## Running the backend tests

```bash
cd server
npm test
```

Tests run against a dedicated database (`mediconnect_test`) and cover
registration, login, JWT validation, role authorization, the patient, doctor,
doctor discovery, appointment, and real-time chat modules (REST and Socket.IO),
plus regression checks.

## Documentation

- `docs/` — architecture, API, and database documentation (added as modules land).