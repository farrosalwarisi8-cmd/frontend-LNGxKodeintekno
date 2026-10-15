export type Role =
  | "admin"
  | "dokter-oh"
  | "dokter-klinik"
  | "perawat"
  | "apoteker"
  | "lab"
  | "admin-klinik"
  | "hr"
  | "hse"
  | "manajemen"
  | "pekerja"

export type Gender = "Male" | "Female"

export type EmployeeStatus = "Active" | "Inactive" | "Mutated" | "Contract Ended"

export type LocationType = "office" | "onshore" | "offshore"

export type MCUStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Revision Required"
  | "Resubmitted"
  | "Approved"
  | "Rejected"
  | "Closed"

export type MCUType =
  | "Pre-Employment"
  | "Periodic"
  | "Return to Work"
  | "Special"

export type HealthStatus =
  | "Fit to Work"
  | "Fit with Restriction"
  | "Temporarily Unfit"
  | "Pending Further Evaluation"
  | "Unfit"

export type VisitStatus =
  | "Registered"
  | "In Queue"
  | "In Consultation"
  | "Awaiting Pharmacy"
  | "Completed"
  | "Referred"
  | "Locked"

export type CertificateStatus = "valid" | "revoked" | "expired"

export type MFAMethod = "totp" | "otp"

export interface User {
  id: string
  username: string
  password: string
  name: string
  role: Role
  title: string
  locationId?: string
  employeeId?: string
  mfaEnabled: boolean
  mfaMethod?: MFAMethod
  mfaSecret?: string
  preferredLanguage: "id" | "en" | "zh"
}

export interface Company {
  id: string
  name: string
}

export interface Department {
  id: string
  name: string
  companyId: string
}

export interface WorkLocation {
  id: string
  name: string
  type: LocationType
  companyId: string
}

export interface Employee {
  id: string
  employeeId: string
  mrn: string
  fullName: string
  nationalId: string
  dateOfBirth: string
  gender: Gender
  companyId: string
  departmentId: string
  jobTitle: string
  locationId: string
  startDate: string
  status: EmployeeStatus
  phone: string
  email: string
  employmentHistory: EmploymentHistory[]
  consentGiven: boolean
  consentDate?: string
  documents: EmployeeDocument[]
}

export interface EmploymentHistory {
  id: string
  departmentId: string
  locationId: string
  jobTitle: string
  from: string
  to?: string
  note: string
}

export interface EmployeeDocument {
  id: string
  employeeId: string
  name: string
  type: string
  uploadedAt: string
}

export interface MCUDocument {
  id: string
  mcuId: string
  name: string
  type: string
  uploadedAt: string
}

export interface MCUHistory {
  id: string
  status: MCUStatus
  note?: string
  by: string
  byName: string
  at: string
}

export interface MCUResult {
  bloodPressure: string
  heartRate: string
  heightCm: string
  weightKg: string
  vision: string
  hearing: string
  notes: string
}

export interface MCU {
  id: string
  mcuNumber: string
  employeeId: string
  type: MCUType
  examDate: string
  facility: string
  result: MCUResult
  documents: MCUDocument[]
  waiver?: string
  reviewerId?: string
  decision?: HealthStatus
  decisionNote?: string
  validFrom?: string
  validUntil?: string
  status: MCUStatus
  history: MCUHistory[]
  createdAt: string
  createdBy: string
}

export interface WorkHealthStatus {
  id: string
  employeeId: string
  mcuId: string
  status: HealthStatus
  decisionDate: string
  validFrom: string
  validUntil: string
  restriction?: string
  recommendation?: string
  reviewDate?: string
  doctorId: string
  doctorName: string
  createdAt: string
}

export interface ClinicVisit {
  id: string
  visitNumber: string
  queueNumber: number
  employeeId: string
  locationId: string
  date: string
  time: string
  chiefComplaint: string
  initialExam: string
  diagnosisIds: string[]
  diagnosisNote: string
  treatment: string
  doctorNote: string
  referralFacility?: string
  referralReason?: string
  status: VisitStatus
  createdAt: string
}

export interface Dispensing {
  id: string
  visitId: string
  medicineId: string
  batchId: string
  quantity: number
  dispensedAt: string
  by: string
}

export interface Diagnosis {
  id: string
  code: string
  description: string
  category: string
}

export interface Medicine {
  id: string
  code: string
  name: string
  category: string
  unit: string
  minStock: number
}

export interface StockBatch {
  id: string
  medicineId: string
  locationId: string
  batchNumber: string
  quantity: number
  receivedAt: string
  expiresAt: string
}

export interface StockTransaction {
  id: string
  type: "receive" | "dispense"
  medicineId: string
  batchId: string
  locationId: string
  quantity: number
  relatedVisitId?: string
  by: string
  at: string
}

export interface HealthCertificate {
  id: string
  certNumber: string
  employeeId: string
  mcuId: string
  healthStatus: HealthStatus
  restrictions?: string
  doctorId: string
  doctorName: string
  issuedAt: string
  validUntil: string
  qrToken: string
  status: CertificateStatus
}

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  objectType: string
  objectId: string
  before?: string
  after?: string
  reason?: string
  at: string
}

export interface SessionInfo {
  userId: string
  loginAt: string
  lastActivity: string
  mfaVerified: boolean
}

export interface OrgScope {
  companyId: string
  locationId: string
}
