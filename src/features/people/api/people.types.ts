export type DemoRole =
  | "ADMIN_CLINIC"
  | "HR_PIC"
  | "SYSTEM_ADMIN"
  | "PUBLIC_WORKER";

export type IdentifierType = "NIK" | "PASSPORT" | "KITAS";

export type ConsentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "DELIVERY_FAILED";

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type Sex = "MALE" | "FEMALE";

export type TamperCheckStatus = "PASSED" | "WARNING" | "HOLD";

export type ConsentEventType =
  | "CREATED"
  | "SENT"
  | "OPENED"
  | "APPROVED"
  | "REJECTED"
  | "RESENT"
  | "EXPIRED"
  | "DELIVERY_FAILED";

export type TokenState =
  | "VALID"
  | "EXPIRED"
  | "USED"
  | "REVOKED"
  | "INVALID"
  | "DELIVERY_FAILED";

export interface Organization {
  id: string;
  name: string;
}

export interface OrgUnit {
  id: string;
  organizationId: string;
  name: string;
}

export interface Site {
  id: string;
  orgUnitId: string;
  name: string;
  type: "OFFICE" | "ONSHORE" | "OFFSHORE";
}

export interface JobTask {
  id: string;
  name: string;
}

export interface PersonDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  tamperCheck: TamperCheckStatus;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface ConsentEvent {
  id: string;
  type: ConsentEventType;
  label: string;
  occurredAt: string;
  actorLabel: string;
  metadata: Record<string, string>;
}

export interface Consent {
  id: string;
  personId: string;
  type: string;
  version: string;
  status: ConsentStatus;
  token: string;
  createdAt: string;
  sentAt?: string;
  decidedAt?: string;
  expiresAt: string;
  events: ConsentEvent[];
}

export interface Person {
  id: string;
  fullName: string;
  mrn: string;
  employeeNo: string;
  identifierType: IdentifierType;
  identifierValue: string;
  birthDate: string;
  sex: Sex;
  organizationId: string;
  organizationName: string;
  orgUnitId: string;
  orgUnitName: string;
  siteId: string;
  siteName: string;
  jobTaskId?: string;
  jobTaskName?: string;
  employmentStatus: EmploymentStatus;
  joinDate: string;
  email: string;
  phone: string;
  emergencyContact: EmergencyContact;
  documents: PersonDocument[];
  consent?: Consent;
  createdAt: string;
  updatedAt: string;
}

export interface PersonListItem {
  id: string;
  fullName: string;
  mrn: string;
  employeeNo: string;
  organizationName: string;
  unitName: string;
  siteName: string;
  emailMasked: string;
  employmentStatus: EmploymentStatus;
  consentStatus: ConsentStatus;
  updatedAt: string;
}

export interface CreatePersonDraft {
  fullName: string;
  identifierType: IdentifierType;
  identifierValue: string;
  birthDate: string;
  sex: Sex;
  employeeNo: string;
  organizationId: string;
  orgUnitId: string;
  siteId: string;
  jobTaskId?: string;
  employmentStatus: "ACTIVE" | "INACTIVE";
  joinDate: string;
  email: string;
  phone: string;
  emergencyContact: EmergencyContact;
  documentIds: string[];
  consentType: string;
  consentVersion: string;
}

export interface CreatedPersonResult {
  patientId: string;
  employeeId: string;
  mrn: string;
  consentId: string;
  consentStatus: ConsentStatus;
  consentLink: string;
  deliveryStatus: "SIMULATED_SENT" | "SIMULATED_FAILED";
}

export interface DuplicateCheckInput {
  identifierType: IdentifierType;
  identifierValue: string;
  fullName: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  severity: "NONE" | "WARNING" | "BLOCK";
  message: string;
  existingPerson?: {
    id: string;
    fullName: string;
    mrn: string;
    employeeNo: string;
    employmentStatus: EmploymentStatus;
  };
}

export interface MockDocumentUploadResult {
  documentId: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  tamperCheck: TamperCheckStatus;
}

export interface MockDeliveryResult {
  success: boolean;
  status: "SIMULATED_SENT" | "SIMULATED_FAILED";
  message: string;
}

export interface PublicConsentView {
  token: string;
  state: TokenState;
  personName: string;
  personInitials: string;
  consentType: string;
  consentVersion: string;
  consentText: string;
  expiresAt: string;
  createdAt: string;
}

export interface ListPeopleParams {
  search?: string;
  organizationId?: string;
  orgUnitId?: string;
  siteId?: string;
  employmentStatus?: EmploymentStatus;
  consentStatus?: ConsentStatus;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PeopleMockService {
  listPeople(params: ListPeopleParams): Promise<Paginated<PersonListItem>>;
  getPerson(patientId: string): Promise<Person>;
  duplicateCheck(input: DuplicateCheckInput): Promise<DuplicateCheckResult>;
  createPerson(input: CreatePersonDraft): Promise<CreatedPersonResult>;
  uploadDocument(file: File): Promise<MockDocumentUploadResult>;
  resendConsent(consentId: string): Promise<MockDeliveryResult>;
  getConsentByToken(token: string): Promise<PublicConsentView>;
  decideConsent(
    token: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<{ success: boolean; status: ConsentStatus }>;
  getConsentEvents(consentId: string): Promise<ConsentEvent[]>;
  resetDemoData(): Promise<void>;
  setConfig(config: Partial<MockConfig>): void;
  getConfig(): MockConfig;
}

export interface MockConfig {
  simulateFailure: boolean;
  simulateOffline: boolean;
  duplicateScenario: boolean;
  emailFailure: boolean;
}
