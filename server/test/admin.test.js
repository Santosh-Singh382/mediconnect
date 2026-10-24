const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearDoctorProfiles,
  clearPharmacies,
  clearMedicines,
  clearCarts,
  clearOrders,
  clearNotifications,
  createUser,
  createDoctor,
  tokenForUser,
  request,
  User,
  DoctorProfile,
  Pharmacy,
  Medicine,
  Order,
  Notification,
} = require('./helpers')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

function pharmacyPayload(overrides = {}) {
  return {
    pharmacyName: 'Admin Test Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-ADMIN-2026-001',
    phone: '9876543210',
    email: 'admin-pharmacy@example.com',
    address: 'Market Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    verificationStatus: 'PENDING',
    isActive: true,
    ...overrides,
  }
}

function medicinePayload(pharmacyId, overrides = {}) {
  return {
    pharmacyId,
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    brandName: 'Mox',
    category: 'CAPSULE',
    dosageForm: 'Capsule',
    strength: '500 mg',
    packSize: '10 capsules',
    price: 45.5,
    stockQuantity: 20,
    prescriptionRequired: true,
    expiryDate: future,
    isActive: true,
    identityKey: 'admin-test-amoxicillin',
    ...overrides,
  }
}

function orderPayload({ patient, pharmacy, medicine, overrides = {} }) {
  return {
    patientId: patient._id,
    pharmacyId: pharmacy._id,
    pharmacySnapshot: {
      pharmacyName: pharmacy.pharmacyName,
      pharmacistName: pharmacy.pharmacistName,
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      pincode: pharmacy.pincode,
    },
    items: [
      {
        medicineId: medicine._id,
        nameSnapshot: medicine.name,
        genericNameSnapshot: medicine.genericName,
        brandNameSnapshot: medicine.brandName,
        dosageFormSnapshot: medicine.dosageForm,
        strengthSnapshot: medicine.strength,
        packSizeSnapshot: medicine.packSize,
        quantity: 2,
        unitPriceSnapshot: medicine.price,
        lineTotal: medicine.price * 2,
        prescriptionRequired: true,
        prescriptionId: new mongoose.Types.ObjectId(),
      },
    ],
    deliveryAddress: {
      fullName: 'Private Patient',
      phone: '9123456780',
      addressLine1: '12 Secret Lane',
      addressLine2: 'Near Private Park',
      city: 'Berhampur',
      state: 'Odisha',
      pincode: '760001',
      landmark: 'Private Landmark',
    },
    subtotal: medicine.price * 2,
    deliveryFee: 0,
    totalAmount: medicine.price * 2,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus: 'PLACED',
    statusHistory: [{ status: 'PLACED', timestamp: new Date() }],
    prescriptionStatus: 'VERIFIED',
    placedAt: new Date(),
    sourceCartId: new mongoose.Types.ObjectId(),
    ...overrides,
  }
}

describe('Admin module', () => {
  let admin
  let adminToken
  let patient
  let patientToken
  let doctor
  let doctorToken
  let pharmacyOwner
  let pharmacy
  let pharmacyToken
  let medicine
  let order

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearNotifications()
    await clearOrders()
    await clearCarts()
    await clearMedicines()
    await clearPharmacies()
    await clearDoctorProfiles()
    await clearUsers()

    admin = await createUser({
      name: 'Platform Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    })
    adminToken = tokenForUser(admin)

    patient = await createUser({
      name: 'Admin Test Patient',
      email: 'admin-patient@example.com',
      phone: '9123456780',
      role: 'PATIENT',
    })
    patientToken = tokenForUser(patient)

    doctor = await createDoctor({
      name: 'Dr Admin Test',
      email: 'admin-doctor@example.com',
    })
    doctorToken = tokenForUser(doctor.user)

    pharmacyOwner = await createUser({
      name: 'Pharmacy Owner',
      email: 'admin-pharmacy-owner@example.com',
      phone: '9876543210',
      role: 'PHARMACY',
    })
    pharmacyToken = tokenForUser(pharmacyOwner)
    pharmacy = await Pharmacy.create({
      ...pharmacyPayload(),
      userId: pharmacyOwner._id,
    })
    medicine = await Medicine.create(medicinePayload(pharmacy._id))
    order = await Order.create(
      orderPayload({ patient, pharmacy, medicine }),
    )
  })

  it('requires authentication and the ADMIN role for every admin endpoint', async () => {
    const endpoints = [
      ['GET', '/api/admin/dashboard'],
      ['GET', '/api/admin/doctors'],
      ['PATCH', `/api/admin/doctors/${doctor.profile._id}/verification`],
      ['GET', '/api/admin/pharmacies'],
      ['PATCH', `/api/admin/pharmacies/${pharmacy._id}/verification`],
      ['GET', '/api/admin/users'],
      ['PATCH', `/api/admin/users/${patient._id}/status`],
      ['GET', '/api/admin/medicines'],
      ['GET', '/api/admin/orders'],
      ['GET', `/api/admin/orders/${order._id}`],
    ]

    for (const [method, path] of endpoints) {
      const anonymous = await request(path, {
        method,
        body: method === 'PATCH' ? { status: 'APPROVED', isActive: false } : undefined,
      })
      assert.equal(anonymous.status, 401, `${method} ${path} should require auth`)

      const patientResponse = await request(path, {
        method,
        token: patientToken,
        body: method === 'PATCH' ? { status: 'APPROVED', isActive: false } : undefined,
      })
      assert.equal(patientResponse.status, 403, `${method} ${path} should reject patients`)

      const doctorResponse = await request(path, {
        method,
        token: doctorToken,
        body: method === 'PATCH' ? { status: 'APPROVED', isActive: false } : undefined,
      })
      assert.equal(doctorResponse.status, 403, `${method} ${path} should reject doctors`)
    }
  })

  it('returns live dashboard counts', async () => {
    const response = await request('/api/admin/dashboard', {
      token: adminToken,
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.metrics, {
      totalUsers: 4,
      totalDoctors: 1,
      pendingDoctorVerifications: 1,
      totalPharmacies: 1,
      pendingPharmacyVerifications: 1,
      totalMedicines: 1,
      totalOrders: 1,
    })
  })

  it('lists doctors with safe profile and account fields', async () => {
    const response = await request('/api/admin/doctors', {
      token: adminToken,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.pagination.total, 1)
    const item = response.body.data.doctors[0]
    assert.equal(item.id, doctor.profile._id.toString())
    assert.equal(item.name, 'Dr Admin Test')
    assert.equal(item.email, 'admin-doctor@example.com')
    assert.equal(item.verificationStatus, 'PENDING')
    assert.equal(item.verificationReason, null)
    assert.equal(Object.hasOwn(item, 'passwordHash'), false)
  })

  it('filters and paginates doctors by verification status and search', async () => {
    await createDoctor({
      name: 'Dr Pending Second',
      email: 'admin-doctor-second@example.com',
      profile: {
        specialization: 'Dermatology',
        registrationNumber: 'MC-ADMIN-002',
      },
    })
    await createDoctor({
      name: 'Dr Approved Third',
      email: 'admin-doctor-third@example.com',
      verificationStatus: 'APPROVED',
      profile: {
        specialization: 'Cardiology',
        registrationNumber: 'MC-ADMIN-003',
      },
    })

    const pending = await request(
      '/api/admin/doctors?status=PENDING&q=Dermatology&page=1&limit=1',
      { token: adminToken },
    )
    assert.equal(pending.status, 200)
    assert.equal(pending.body.data.pagination.total, 1)
    assert.equal(pending.body.data.doctors[0].name, 'Dr Pending Second')
    assert.equal(pending.body.data.pagination.limit, 1)

    const approved = await request(
      '/api/admin/doctors?status=APPROVED&sort=name_desc',
      { token: adminToken },
    )
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.pagination.total, 1)
    assert.equal(approved.body.data.doctors[0].name, 'Dr Approved Third')
  })

  it('approves a doctor, stores no reason, and notifies the doctor once', async () => {
    const response = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.data.doctor.verificationStatus, 'APPROVED')
    assert.equal(response.body.data.doctor.verificationReason, null)

    const stored = await DoctorProfile.findById(doctor.profile._id).lean()
    assert.equal(stored.verificationStatus, 'APPROVED')

    const notifications = await Notification.find({
      userId: doctor.user._id,
    }).lean()
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].type, 'DOCTOR_APPROVED')
    assert.equal(notifications[0].referenceType, 'DOCTOR_PROFILE')
    assert.equal(
      notifications[0].referenceId.toString(),
      doctor.profile._id.toString(),
    )
    assert.match(notifications[0].eventKey, /^DOCTOR_APPROVED:/)

    const repeated = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )
    assert.equal(repeated.status, 409)
    assert.equal(repeated.body.code, 'VERIFICATION_UNCHANGED')
    assert.equal(
      await Notification.countDocuments({ userId: doctor.user._id }),
      1,
    )
  })

  it('rejects a doctor with a trimmed reason and clears it on approval', async () => {
    const rejected = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'REJECTED',
          reason: '  Registration document is unreadable.  ',
        },
      },
    )

    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.data.doctor.verificationStatus, 'REJECTED')
    assert.equal(
      rejected.body.data.doctor.verificationReason,
      'Registration document is unreadable.',
    )

    const notification = await Notification.findOne({
      userId: doctor.user._id,
      type: 'DOCTOR_REJECTED',
    }).lean()
    assert.ok(notification)

    const approved = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED', reason: 'ignored on approval' },
      },
    )
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.doctor.verificationReason, null)
    assert.equal(
      await Notification.countDocuments({
        userId: doctor.user._id,
        type: 'DOCTOR_APPROVED',
      }),
      1,
    )
  })

  it('validates doctor verification payloads and identifiers', async () => {
    const invalidStatus = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'PENDING' },
      },
    )
    assert.equal(invalidStatus.status, 400)
    assert.equal(invalidStatus.body.code, 'VALIDATION_ERROR')

    const tooLongReason = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'REJECTED', reason: 'x'.repeat(501) },
      },
    )
    assert.equal(tooLongReason.status, 400)

    const extraField = await request(
      `/api/admin/doctors/${doctor.profile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED', userId: admin._id.toString() },
      },
    )
    assert.equal(extraField.status, 400)

    const invalidId = await request('/api/admin/doctors/not-an-id/verification', {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    })
    assert.equal(invalidId.status, 400)

    const missing = await request(
      `/api/admin/doctors/${new mongoose.Types.ObjectId()}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )
    assert.equal(missing.status, 404)

    assert.equal(await Notification.countDocuments({}), 0)
  })

  it('prevents an administrator from verifying a profile they own', async () => {
    const ownProfile = await DoctorProfile.create({
      userId: admin._id,
      specialization: 'General Physician',
      qualification: 'MBBS',
      experience: 5,
      registrationNumber: 'ADMIN-SELF-001',
      verificationStatus: 'PENDING',
    })

    const response = await request(
      `/api/admin/doctors/${ownProfile._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )

    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'SELF_VERIFICATION_FORBIDDEN')
    assert.equal(await Notification.countDocuments({}), 0)
  })

  it('lists and filters pharmacies by status and search', async () => {
    await Pharmacy.create({
      ...pharmacyPayload({
        pharmacyName: 'Second Approved Pharmacy',
        licenseNumber: 'OD-ADMIN-2026-002',
        email: 'second-pharmacy@example.com',
        city: 'Cuttack',
        verificationStatus: 'APPROVED',
      }),
      userId: (
        await createUser({
          name: 'Second Pharmacy Owner',
          email: 'second-pharmacy-owner@example.com',
          role: 'PHARMACY',
        })
      )._id,
    })

    const pending = await request(
      '/api/admin/pharmacies?status=PENDING&q=Market',
      { token: adminToken },
    )
    assert.equal(pending.status, 200)
    assert.equal(pending.body.data.pagination.total, 1)
    assert.equal(pending.body.data.pharmacies[0].id, pharmacy._id.toString())
    assert.equal(
      Object.hasOwn(pending.body.data.pharmacies[0], 'passwordHash'),
      false,
    )

    const approved = await request(
      '/api/admin/pharmacies?status=APPROVED&q=Cuttack',
      { token: adminToken },
    )
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.pagination.total, 1)
    assert.equal(
      approved.body.data.pharmacies[0].pharmacyName,
      'Second Approved Pharmacy',
    )
  })

  it('approves and rejects a pharmacy while creating verification notifications', async () => {
    const approved = await request(
      `/api/admin/pharmacies/${pharmacy._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.pharmacy.verificationStatus, 'APPROVED')
    assert.equal(approved.body.data.pharmacy.verificationReason, null)

    const approvedNotification = await Notification.findOne({
      userId: pharmacyOwner._id,
      type: 'PHARMACY_APPROVED',
    }).lean()
    assert.ok(approvedNotification)
    assert.equal(approvedNotification.referenceType, 'PHARMACY_PROFILE')

    const rejected = await request(
      `/api/admin/pharmacies/${pharmacy._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'REJECTED', reason: 'Licence expired.' },
      },
    )
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.data.pharmacy.verificationStatus, 'REJECTED')
    assert.equal(rejected.body.data.pharmacy.verificationReason, 'Licence expired.')

    const notifications = await Notification.find({
      userId: pharmacyOwner._id,
    }).sort({ createdAt: 1 }).lean()
    assert.equal(notifications.length, 2)
    assert.deepEqual(
      notifications.map((item) => item.type),
      ['PHARMACY_APPROVED', 'PHARMACY_REJECTED'],
    )
    assert.notEqual(notifications[0].eventKey, notifications[1].eventKey)
  })

  it('validates pharmacy verification actions and identifiers', async () => {
    const invalid = await request(
      `/api/admin/pharmacies/${pharmacy._id}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'SUSPENDED' },
      },
    )
    assert.equal(invalid.status, 400)

    const invalidId = await request(
      '/api/admin/pharmacies/not-an-id/verification',
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )
    assert.equal(invalidId.status, 400)

    const missing = await request(
      `/api/admin/pharmacies/${new mongoose.Types.ObjectId()}/verification`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      },
    )
    assert.equal(missing.status, 404)
  })

  it('lists users with search, role, status, and verification filters', async () => {
    await createUser({
      name: 'Inactive Patient',
      email: 'inactive-admin-patient@example.com',
      role: 'PATIENT',
      isActive: false,
    })

    const patients = await request(
      '/api/admin/users?role=PATIENT&q=Admin%20Test&isActive=true&isVerified=false',
      { token: adminToken },
    )
    assert.equal(patients.status, 200)
    assert.equal(patients.body.data.pagination.total, 1)
    assert.equal(patients.body.data.users[0].id, patient._id.toString())
    assert.equal(patients.body.data.users[0].role, 'PATIENT')
    assert.equal(patients.body.data.users[0].isActive, true)
    assert.equal(patients.body.data.users[0].isVerified, false)
    assert.equal(
      Object.hasOwn(patients.body.data.users[0], 'passwordHash'),
      false,
    )

    const inactive = await request(
      '/api/admin/users?isActive=false&q=inactive',
      { token: adminToken },
    )
    assert.equal(inactive.status, 200)
    assert.equal(inactive.body.data.pagination.total, 1)
    assert.equal(inactive.body.data.users[0].email, 'inactive-admin-patient@example.com')

    const roles = await request('/api/admin/users?role=ADMIN', {
      token: adminToken,
    })
    assert.equal(roles.status, 200)
    assert.equal(roles.body.data.pagination.total, 1)
  })

  it('deactivates and reactivates users without changing role or verification', async () => {
    const deactivated = await request(
      `/api/admin/users/${patient._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: false },
      },
    )
    assert.equal(deactivated.status, 200)
    assert.equal(deactivated.body.data.user.isActive, false)
    assert.equal(deactivated.body.data.user.role, 'PATIENT')
    assert.equal(deactivated.body.data.user.isVerified, false)

    const blocked = await request('/api/patient/profile', {
      token: patientToken,
    })
    assert.equal(blocked.status, 401)
    assert.equal(blocked.body.code, 'ACCOUNT_DISABLED')

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: patient.email, password: 'Password123' },
    })
    assert.equal(login.status, 401)
    assert.equal(login.body.code, 'INVALID_CREDENTIALS')

    const reactivated = await request(
      `/api/admin/users/${patient._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: true },
      },
    )
    assert.equal(reactivated.status, 200)
    assert.equal(reactivated.body.data.user.isActive, true)

    const stored = await User.findById(patient._id).lean()
    assert.equal(stored.role, 'PATIENT')
    assert.equal(stored.isVerified, false)
  })

  it('prevents an administrator from deactivating their own account', async () => {
    const response = await request(
      `/api/admin/users/${admin._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: false },
      },
    )

    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'SELF_DEACTIVATION_FORBIDDEN')

    const stored = await User.findById(admin._id).lean()
    assert.equal(stored.isActive, true)
  })

  it('rejects role, verification, and invalid status changes in user updates', async () => {
    const roleChange = await request(
      `/api/admin/users/${patient._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: false, role: 'ADMIN' },
      },
    )
    assert.equal(roleChange.status, 400)

    const verificationChange = await request(
      `/api/admin/users/${patient._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: false, isVerified: true },
      },
    )
    assert.equal(verificationChange.status, 400)

    const invalidStatus = await request(
      `/api/admin/users/${patient._id}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: 'false' },
      },
    )
    assert.equal(invalidStatus.status, 400)

    const invalidId = await request('/api/admin/users/not-an-id/status', {
      method: 'PATCH',
      token: adminToken,
      body: { isActive: false },
    })
    assert.equal(invalidId.status, 400)

    const missing = await request(
      `/api/admin/users/${new mongoose.Types.ObjectId()}/status`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { isActive: false },
      },
    )
    assert.equal(missing.status, 404)
  })

  it('lists medicines with search, category, pharmacy, active, expiry, and stock filters', async () => {
    await Medicine.create(
      medicinePayload(pharmacy._id, {
        name: 'Expired Syrup',
        genericName: 'Dextromethorphan',
        brandName: 'CoughRelief',
        category: 'SYRUP',
        stockQuantity: 0,
        expiryDate: past,
        isActive: false,
        identityKey: 'admin-test-expired-syrup',
      }),
    )

    const searched = await request(
      '/api/admin/medicines?q=Amoxicillin&category=CAPSULE&inStock=true',
      { token: adminToken },
    )
    assert.equal(searched.status, 200)
    assert.equal(searched.body.data.pagination.total, 1)
    const item = searched.body.data.medicines[0]
    assert.equal(item.name, 'Amoxicillin')
    assert.equal(item.inStock, true)
    assert.equal(item.isExpired, false)
    assert.equal(item.pharmacy.id, pharmacy._id.toString())
    assert.equal(Object.hasOwn(item, 'identityKey'), false)

    const expired = await request(
      `/api/admin/medicines?expired=true&inStock=false&isActive=false`,
      { token: adminToken },
    )
    assert.equal(expired.status, 200)
    assert.equal(expired.body.data.pagination.total, 1)
    assert.equal(expired.body.data.medicines[0].name, 'Expired Syrup')
    assert.equal(expired.body.data.medicines[0].isExpired, true)

    const byPharmacy = await request(
      `/api/admin/medicines?pharmacyId=${pharmacy._id}`,
      { token: adminToken },
    )
    assert.equal(byPharmacy.status, 200)
    assert.equal(byPharmacy.body.data.pagination.total, 2)
  })

  it('lists orders with safe search and filters', async () => {
    const byOrderId = await request(
      `/api/admin/orders?q=${order._id}`,
      { token: adminToken },
    )
    assert.equal(byOrderId.status, 200)
    assert.equal(byOrderId.body.data.pagination.total, 1)
    assert.equal(byOrderId.body.data.orders[0].orderId, order._id.toString())
    assert.equal(Object.hasOwn(byOrderId.body.data.orders[0], 'deliveryAddress'), false)
    assert.equal(Object.hasOwn(byOrderId.body.data.orders[0], 'customerPhone'), false)

    const byMedicine = await request(
      '/api/admin/orders?q=Amoxicillin&status=PLACED&paymentStatus=PENDING',
      { token: adminToken },
    )
    assert.equal(byMedicine.status, 200)
    assert.equal(byMedicine.body.data.pagination.total, 1)
    assert.equal(byMedicine.body.data.orders[0].items[0].name, 'Amoxicillin')

    const byPharmacy = await request(
      `/api/admin/orders?pharmacyId=${pharmacy._id}&q=Admin%20Test%20Pharmacy`,
      { token: adminToken },
    )
    assert.equal(byPharmacy.status, 200)
    assert.equal(byPharmacy.body.data.pagination.total, 1)

    const noMatch = await request(
      '/api/admin/orders?status=DELIVERED',
      { token: adminToken },
    )
    assert.equal(noMatch.status, 200)
    assert.equal(noMatch.body.data.pagination.total, 0)
  })

  it('returns minimized order details without full address or medical identifiers', async () => {
    const response = await request(`/api/admin/orders/${order._id}`, {
      token: adminToken,
    })

    assert.equal(response.status, 200)
    const detail = response.body.data.order
    assert.equal(detail.orderId, order._id.toString())
    assert.equal(detail.items.length, 1)
    assert.equal(detail.items[0].name, 'Amoxicillin')
    assert.equal(detail.customer.name, 'Private Patient')
    assert.equal(detail.customer.city, 'Berhampur')
    assert.equal(Object.hasOwn(detail, 'deliveryAddress'), false)
    assert.equal(Object.hasOwn(detail.customer, 'phone'), false)
    assert.equal(Object.hasOwn(detail.items[0], 'prescriptionId'), false)

    const serialized = JSON.stringify(detail)
    assert.equal(serialized.includes('12 Secret Lane'), false)
    assert.equal(serialized.includes('Near Private Park'), false)
    assert.equal(serialized.includes('9123456780'), false)
    assert.equal(serialized.includes('Private Landmark'), false)
  })

  it('validates order identifiers, statuses, and detail lookups', async () => {
    const invalidId = await request('/api/admin/orders/not-an-id', {
      token: adminToken,
    })
    assert.equal(invalidId.status, 400)

    const missing = await request(
      `/api/admin/orders/${new mongoose.Types.ObjectId()}`,
      { token: adminToken },
    )
    assert.equal(missing.status, 404)

    const invalidStatus = await request('/api/admin/orders?status=UNKNOWN', {
      token: adminToken,
    })
    assert.equal(invalidStatus.status, 400)

    const invalidPayment = await request(
      '/api/admin/orders?paymentStatus=UNKNOWN',
      { token: adminToken },
    )
    assert.equal(invalidPayment.status, 400)
  })

  it('rejects invalid pagination and unsupported query values', async () => {
    const cases = [
      '/api/admin/doctors?page=0',
      '/api/admin/doctors?limit=51',
      '/api/admin/doctors?status=SUSPENDED',
      '/api/admin/pharmacies?status=UNKNOWN',
      '/api/admin/users?role=SUPERADMIN',
      '/api/admin/users?isActive=yes',
      '/api/admin/medicines?category=UNKNOWN',
      '/api/admin/medicines?pharmacyId=bad-id',
      '/api/admin/medicines?expired=maybe',
      '/api/admin/orders?pharmacyId=bad-id',
    ]

    for (const path of cases) {
      const response = await request(path, { token: adminToken })
      assert.equal(response.status, 400, `${path} should be rejected`)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    }
  })

  it('escapes search input instead of interpreting regular expressions', async () => {
    const response = await request('/api/admin/doctors?q=%5B%5Ea-z%5D', {
      token: adminToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.pagination.total, 0)
  })
})
