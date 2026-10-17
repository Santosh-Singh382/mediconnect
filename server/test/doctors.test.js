const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  clearDoctorProfiles,
  createUser,
  createDoctor,
  loginAndGetToken,
  request,
  PatientProfile,
  DoctorProfile,
} = require('./helpers')

describe('Doctor discovery module', () => {
  let doctorA
  let doctorB
  let doctorC
  let doctorD
  let patientToken

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearUsers()
    await clearPatientProfiles()
    await clearDoctorProfiles()

    const a = await createDoctor({
      email: 'discovery-a@example.com',
      name: 'Dr. Aarvi Kumar',
      verificationStatus: 'APPROVED',
      profile: {
        specialization: 'Cardiologist',
        qualification: 'MBBS, MD (Cardiology)',
        experience: 12,
        registrationNumber: 'MC-AAAA1',
        consultationFee: 800,
        bio: 'Cardiologist focused on preventive heart care.',
        clinicName: 'Aarogya Heart Clinic',
        languages: ['English', 'Hindi'],
        availability: [
          { dayOfWeek: 'MONDAY', enabled: true, startTime: '10:00', endTime: '13:00' },
          { dayOfWeek: 'WEDNESDAY', enabled: true, startTime: '15:00', endTime: '17:00' },
        ],
      },
    })
    doctorA = a.profile

    const b = await createDoctor({
      email: 'discovery-b@example.com',
      name: 'Dr. Bhaskar Naik',
      verificationStatus: 'APPROVED',
      profile: {
        specialization: 'Dermatologist',
        qualification: 'MBBS',
        experience: 4,
        registrationNumber: 'MC-BBBB2',
        consultationFee: 300,
        bio: 'Skin and hair specialist.',
        clinicName: 'Sunny Skin Clinic',
        languages: ['Odia', 'English'],
        availability: [
          { dayOfWeek: 'FRIDAY', enabled: true, startTime: '11:00', endTime: '14:00' },
        ],
      },
    })
    doctorB = b.profile

    const c = await createDoctor({
      email: 'discovery-c@example.com',
      name: 'Dr. Chandan Pradhan',
      verificationStatus: 'PENDING',
      profile: {
        specialization: 'General Physician',
        qualification: 'MBBS',
        experience: 6,
        registrationNumber: 'MC-CCCC3',
        consultationFee: 400,
        clinicName: 'Pradhan Clinic',
        languages: ['Odia'],
      },
    })
    doctorC = c.profile

    const d = await createDoctor({
      email: 'discovery-d@example.com',
      name: 'Dr. Divya Sharma',
      verificationStatus: 'REJECTED',
      profile: {
        specialization: 'Orthopedic',
        qualification: 'MBBS, MS',
        experience: 9,
        registrationNumber: 'MC-DDDD4',
        consultationFee: 600,
        clinicName: 'Sharma Ortho Clinic',
        languages: ['Hindi'],
      },
    })
    doctorD = d.profile

    await createUser({ email: 'discovery-patient@example.com' })
    patientToken = await loginAndGetToken('discovery-patient@example.com')
  })

  describe('Listing', () => {
    it('lists only APPROVED doctors', async () => {
      const response = await request('/api/doctors')

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.doctors.length, 2)
      for (const doctor of response.body.data.doctors) {
        assert.equal(doctor.verificationStatus, 'APPROVED')
      }
      const names = response.body.data.doctors.map((d) => d.name)
      assert.ok(names.includes('Dr. Aarvi Kumar'))
      assert.ok(names.includes('Dr. Bhaskar Naik'))
    })

    it('never includes PENDING or REJECTED doctors', async () => {
      const response = await request('/api/doctors')

      const names = response.body.data.doctors.map((d) => d.name)
      assert.ok(!names.includes('Dr. Chandan Pradhan'))
      assert.ok(!names.includes('Dr. Divya Sharma'))
      assert.ok(!names.includes(doctorC.name))
      assert.ok(!names.includes(doctorD.name))
    })

    it('paginates results with page navigation', async () => {
      const pageOne = await request('/api/doctors?limit=1&page=1')
      assert.equal(pageOne.status, 200)
      assert.equal(pageOne.body.data.doctors.length, 1)
      assert.deepEqual(pageOne.body.data.pagination, {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      })

      const pageTwo = await request('/api/doctors?limit=1&page=2')
      assert.equal(pageTwo.body.data.doctors.length, 1)
      assert.equal(pageTwo.body.data.pagination.page, 2)
      assert.notEqual(
        pageTwo.body.data.doctors[0].id,
        pageOne.body.data.doctors[0].id,
      )
    })

    it('defaults page to 1', async () => {
      const response = await request('/api/doctors')
      assert.equal(response.body.data.pagination.page, 1)
    })

    it('defaults limit to 12', async () => {
      const response = await request('/api/doctors')
      assert.equal(response.body.data.pagination.limit, 12)
    })

    it('enforces the maximum limit of 50', async () => {
      const ok = await request('/api/doctors?limit=50')
      assert.equal(ok.status, 200)
      assert.equal(ok.body.data.pagination.limit, 50)

      const rejected = await request('/api/doctors?limit=51')
      assert.equal(rejected.status, 400)
      assert.equal(rejected.body.code, 'VALIDATION_ERROR')
    })
  })

  describe('Search', () => {
    it('searches by doctor name', async () => {
      const response = await request('/api/doctors?q=Bhaskar')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.doctors.length, 1)
      assert.equal(response.body.data.doctors[0].name, 'Dr. Bhaskar Naik')
    })

    it('searches by specialization', async () => {
      const response = await request('/api/doctors?q=cardio')
      assert.equal(response.body.data.doctors.length, 1)
      assert.equal(response.body.data.doctors[0].specialization, 'Cardiologist')
    })

    it('searches by qualification', async () => {
      const response = await request('/api/doctors?q=Cardiology')
      assert.equal(response.body.data.doctors.length, 1)
      assert.equal(response.body.data.doctors[0].name, 'Dr. Aarvi Kumar')
    })

    it('searches by clinic name', async () => {
      const heart = await request('/api/doctors?q=Heart')
      assert.equal(heart.body.data.doctors.length, 1)
      assert.equal(heart.body.data.doctors[0].clinicName, 'Aarogya Heart Clinic')

      const skin = await request('/api/doctors?q=Skin')
      assert.equal(skin.body.data.doctors.length, 1)
      assert.equal(skin.body.data.doctors[0].clinicName, 'Sunny Skin Clinic')
    })

    it('is case-insensitive', async () => {
      const response = await request('/api/doctors?q=AARVI')
      assert.equal(response.body.data.doctors.length, 1)
      assert.equal(response.body.data.doctors[0].name, 'Dr. Aarvi Kumar')
    })
  })

  describe('Filters', () => {
    it('filters by specialization case-insensitively', async () => {
      const exact = await request('/api/doctors?specialization=Cardiologist')
      assert.equal(exact.body.data.doctors.length, 1)
      assert.equal(exact.body.data.doctors[0].name, 'Dr. Aarvi Kumar')

      const mixed = await request('/api/doctors?specialization=cardioLoGist')
      assert.equal(mixed.body.data.doctors.length, 1)
      assert.equal(mixed.body.data.doctors[0].id, exact.body.data.doctors[0].id)
    })

    it('filters by experience range', async () => {
      const senior = await request('/api/doctors?minExperience=10')
      assert.equal(senior.body.data.doctors.length, 1)
      assert.equal(senior.body.data.doctors[0].name, 'Dr. Aarvi Kumar')

      const junior = await request('/api/doctors?minExperience=0&maxExperience=6')
      assert.equal(junior.body.data.doctors.length, 1)
      assert.equal(junior.body.data.doctors[0].name, 'Dr. Bhaskar Naik')
    })

    it('filters by consultation fee range', async () => {
      const premium = await request('/api/doctors?minFee=500')
      assert.equal(premium.body.data.doctors.length, 1)
      assert.equal(premium.body.data.doctors[0].name, 'Dr. Aarvi Kumar')

      const budget = await request('/api/doctors?minFee=200&maxFee=400')
      assert.equal(budget.body.data.doctors.length, 1)
      assert.equal(budget.body.data.doctors[0].name, 'Dr. Bhaskar Naik')
    })

    it('filters by language case-insensitively', async () => {
      const exact = await request('/api/doctors?language=Hindi')
      assert.equal(exact.body.data.doctors.length, 1)
      assert.equal(exact.body.data.doctors[0].name, 'Dr. Aarvi Kumar')

      const mixed = await request('/api/doctors?language=hindi')
      assert.equal(mixed.body.data.doctors.length, 1)
    })

    it('filters by availability day', async () => {
      const monday = await request('/api/doctors?day=MONDAY')
      assert.equal(monday.body.data.doctors.length, 1)
      assert.equal(monday.body.data.doctors[0].name, 'Dr. Aarvi Kumar')

      const friday = await request('/api/doctors?day=FRIDAY')
      assert.equal(friday.body.data.doctors.length, 1)
      assert.equal(friday.body.data.doctors[0].name, 'Dr. Bhaskar Naik')

      const closed = await request('/api/doctors?day=TUESDAY')
      assert.equal(closed.body.data.doctors.length, 0)
    })
  })

  describe('Sorting', () => {
    it('sorts by name ascending by default', async () => {
      const response = await request('/api/doctors')
      assert.equal(response.body.data.doctors[0].name, 'Dr. Aarvi Kumar')
    })

    it('sorts by experience ascending', async () => {
      const response = await request('/api/doctors?sort=experience_asc')
      assert.equal(response.body.data.doctors[0].name, 'Dr. Bhaskar Naik')
    })

    it('sorts by experience descending', async () => {
      const response = await request('/api/doctors?sort=experience_desc')
      assert.equal(response.body.data.doctors[0].name, 'Dr. Aarvi Kumar')
    })

    it('sorts by fee ascending', async () => {
      const response = await request('/api/doctors?sort=fee_asc')
      assert.equal(response.body.data.doctors[0].name, 'Dr. Bhaskar Naik')
    })

    it('sorts by fee descending', async () => {
      const response = await request('/api/doctors?sort=fee_desc')
      assert.equal(response.body.data.doctors[0].name, 'Dr. Aarvi Kumar')
    })
  })

  describe('Query validation', () => {
    it('rejects invalid page values', async () => {
      const zero = await request('/api/doctors?page=0')
      assert.equal(zero.status, 400)
      assert.equal(zero.body.code, 'VALIDATION_ERROR')

      const text = await request('/api/doctors?page=abc')
      assert.equal(text.status, 400)
    })

    it('rejects invalid limit values', async () => {
      const zero = await request('/api/doctors?limit=0')
      assert.equal(zero.status, 400)
      const negative = await request('/api/doctors?limit=-1')
      assert.equal(negative.status, 400)
      const text = await request('/api/doctors?limit=abc')
      assert.equal(text.status, 400)
    })

    it('rejects an invalid sort option', async () => {
      const response = await request('/api/doctors?sort=random')
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'sort'))
    })

    it('rejects an invalid day', async () => {
      const response = await request('/api/doctors?day=FUNDAY')
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'day'))
    })

    it('accepts a lowercase day', async () => {
      const response = await request('/api/doctors?day=monday')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.doctors.length, 1)
    })

    it('rejects invalid numeric filters', async () => {
      const experience = await request('/api/doctors?minExperience=abc')
      assert.equal(experience.status, 400)
      assert.ok(experience.body.details.some((d) => d.field === 'minExperience'))

      const negativeFee = await request('/api/doctors?minFee=-5')
      assert.equal(negativeFee.status, 400)

      const tooLarge = await request('/api/doctors?maxExperience=999')
      assert.equal(tooLarge.status, 400)
    })

    it('rejects inverted ranges', async () => {
      const experience = await request(
        '/api/doctors?minExperience=20&maxExperience=5',
      )
      assert.equal(experience.status, 400)
      assert.ok(experience.body.details.some((d) => d.field === 'minExperience'))

      const fee = await request('/api/doctors?minFee=1000&maxFee=100')
      assert.equal(fee.status, 400)
    })
  })

  describe('Doctor details', () => {
    it('returns approved doctor details', async () => {
      const response = await request(`/api/doctors/${doctorA._id}`)

      assert.equal(response.status, 200)
      assert.equal(response.body.data.doctor.name, 'Dr. Aarvi Kumar')
      assert.equal(response.body.data.doctor.specialization, 'Cardiologist')
      assert.equal(response.body.data.doctor.qualification, 'MBBS, MD (Cardiology)')
      assert.equal(response.body.data.doctor.experience, 12)
      assert.equal(response.body.data.doctor.consultationFee, 800)
      assert.equal(response.body.data.doctor.registrationNumber, 'MC-AAAA1')
      assert.equal(response.body.data.doctor.clinicAddress.city, 'Berhampur')
      assert.deepEqual(response.body.data.doctor.languages, ['English', 'Hindi'])
      assert.equal(response.body.data.doctor.verificationStatus, 'APPROVED')
      const monday = response.body.data.doctor.availability.find(
        (d) => d.dayOfWeek === 'MONDAY',
      )
      assert.equal(monday.enabled, true)
      assert.equal(monday.startTime, '10:00')
    })

    it('returns 404 for a PENDING doctor', async () => {
      const response = await request(`/api/doctors/${doctorC._id}`)
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('returns 404 for a REJECTED doctor', async () => {
      const response = await request(`/api/doctors/${doctorD._id}`)
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('returns 404 for an unknown doctor ID', async () => {
      const response = await request(
        `/api/doctors/${new mongoose.Types.ObjectId()}`,
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('returns 400 for an invalid doctor ID', async () => {
      const response = await request('/api/doctors/not-an-id')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })
  })

  describe('Privacy', () => {
    it('never exposes passwordHash in discovery responses', async () => {
      const list = await request('/api/doctors')
      assert.equal(JSON.stringify(list.body).includes('passwordHash'), false)

      const detail = await request(`/api/doctors/${doctorA._id}`)
      assert.equal(JSON.stringify(detail.body).includes('passwordHash'), false)
    })

    it('never exposes passwords in discovery responses', async () => {
      const list = await request('/api/doctors')
      assert.equal(JSON.stringify(list.body).includes('"password"'), false)
      assert.equal(JSON.stringify(list.body).includes('Password123'), false)

      const detail = await request(`/api/doctors/${doctorA._id}`)
      assert.equal(JSON.stringify(detail.body).includes('"password"'), false)
    })

    it('never exposes JWT tokens in discovery responses', async () => {
      const list = await request('/api/doctors')
      assert.equal(JSON.stringify(list.body).includes('"token"'), false)

      const detail = await request(`/api/doctors/${doctorA._id}`)
      assert.equal(JSON.stringify(detail.body).includes('"token"'), false)
    })

    it('never exposes private email or phone in discovery responses', async () => {
      const list = await request('/api/doctors')
      for (const doctor of list.body.data.doctors) {
        assert.equal(doctor.email, undefined)
        assert.equal(doctor.phone, undefined)
        assert.equal(doctor.userId, undefined)
      }
      assert.equal(JSON.stringify(list.body).includes('@example.com'), false)

      const detail = await request(`/api/doctors/${doctorA._id}`)
      assert.equal(detail.body.data.doctor.email, undefined)
      assert.equal(detail.body.data.doctor.phone, undefined)
      assert.equal(JSON.stringify(detail.body).includes('@example.com'), false)
    })
  })

  describe('Regression', () => {
    it('keeps patient profile APIs working', async () => {
      const created = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: { gender: 'FEMALE' },
      })
      assert.equal(created.status, 200)
      assert.equal(created.body.data.profile.gender, 'FEMALE')
      assert.equal(await PatientProfile.countDocuments(), 1)
    })

    it('keeps doctor profile APIs working (authenticated, own profile)', async () => {
      const doctorLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'discovery-a@example.com', password: 'Password123' },
      })
      const token = doctorLogin.body.data.token

      const response = await request('/api/doctor/profile', { token })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.specialization, 'Cardiologist')
    })

    it('keeps authentication working', async () => {
      const response = await request('/api/auth/me', { token: patientToken })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.role, 'PATIENT')
    })

    it('keeps dashboards working', async () => {
      const response = await request('/api/patient/dashboard', {
        token: patientToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.role, 'PATIENT')
    })

    it('keeps /api/health working', async () => {
      const response = await request('/api/health')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.status, 'ok')
    })

    it('keeps the 404 contract for unknown routes', async () => {
      const response = await request('/api/nope')
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ROUTE_NOT_FOUND')
    })
  })

  describe('Database indexes', () => {
    it('keeps the unique userId index and adds discovery indexes without duplicates', async () => {
      const indexes = await DoctorProfile.collection.listIndexes().toArray()
      const byName = Object.fromEntries(indexes.map((index) => [index.name, index]))
      const names = indexes.map((index) => index.name).sort()

      assert.ok(names.includes('userId_1'))
      assert.equal(byName.userId_1.unique, true)

      assert.ok(names.includes('verificationStatus_1'))
      assert.ok(names.includes('specialization_1'))
      assert.ok(names.includes('experience_1'))
      assert.ok(names.includes('consultationFee_1'))

      assert.equal(new Set(names).size, names.length)
      assert.equal(names.length, 6)
    })
  })
})