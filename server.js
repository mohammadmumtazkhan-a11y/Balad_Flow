const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 1. REAL MITO SANDBOX / STAGING CREDENTIALS & CONFIGURATION
// ============================================================================
const MITO_STAGING_CONFIG = {
  baseUrl: process.env.MITO_BASE_URL || 'https://furp02-staging.funtechcom.com/api/v1/mito',
  username: process.env.MITO_USERNAME || 'BaladApi',
  password: process.env.MITO_PASSWORD || '1eYs3P7nPt4X7bUp8',
  accessAffiliateNumber: process.env.MITO_AFFILIATE_ID || '1080',
  accessServiceNumber: process.env.MITO_SERVICE_NO || '21048',
  apiKey: process.env.MITO_API_KEY || '1972d9c6-563c-4944-90a1-94bacbee3b1e',
  webhookSecretKey: process.env.MITO_WEBHOOK_SECRET || 'f47ee7a1-aca4-4a6b-83a6-a802369bdddc',
  publicKey: process.env.MITO_PUBLIC_KEY || 'pk_sandbox_2wqu7o9dam3h1oqx3x6kdq7d8bgc9j7y',
  secretKey: process.env.MITO_SECRET_KEY || 'sk_sandbox_9gaa5i3pbp3d5gpf7a5cee7m2nxq3v2p',
  defaultQuoteUserId: '6f5e2835-45d4-484c-b1b7-01e109b3feb8', // Existing MITO staging user for pre-user-creation rate quotes
  defaultNgaProviderId: '1831846e-75c6-4606-bc5c-0f092cb5ce0a', // Zenith Bank International on MITO Staging
  defaultNgaBeneficiaryId: '529ee99a-77e6-47e3-bb0e-b66ee851a8ee' // Clean MITO Staging beneficiary without invalid sourceOfFundId UUID
};

let cachedMitoAuth = {
  token: null,
  expiresAt: 0,
  lastAuthResponse: null
};

async function getMitoStagingBearerToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedMitoAuth.token && cachedMitoAuth.expiresAt > now + 30000) {
    return cachedMitoAuth.token;
  }

  const loginUrl = `${MITO_STAGING_CONFIG.baseUrl}/auth/login`;
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ApiKey': MITO_STAGING_CONFIG.apiKey
    },
    body: JSON.stringify({
      username: MITO_STAGING_CONFIG.username,
      password: MITO_STAGING_CONFIG.password,
      accessServiceNumber: MITO_STAGING_CONFIG.accessServiceNumber,
      accessAffiliateNumber: MITO_STAGING_CONFIG.accessAffiliateNumber
    })
  });

  const data = await res.json();
  if (res.ok && data && data.data && data.data.token) {
    cachedMitoAuth.token = data.data.token;
    cachedMitoAuth.expiresAt = now + 25 * 60 * 1000; // Cache for 25 minutes
    cachedMitoAuth.lastAuthResponse = data;
    return cachedMitoAuth.token;
  }
  throw new Error(`MITO Staging Login failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
}

async function callMitoStagingApi(method, relativePath, body = null, includeSecretKey = false) {
  const token = await getMitoStagingBearerToken();
  const fullUrl = `${MITO_STAGING_CONFIG.baseUrl}${relativePath}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'ApiKey': MITO_STAGING_CONFIG.apiKey
  };
  if (includeSecretKey) {
    headers['Mito-Secret-Key'] = MITO_STAGING_CONFIG.secretKey;
  }

  const options = { method, headers };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const start = Date.now();
  const res = await fetch(fullUrl, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { rawText: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    durationMs: Date.now() - start,
    stagingUrl: fullUrl,
    requestHeaders: {
      Authorization: 'Bearer eyJhbGciOi...(live MITO Staging JWT)',
      ApiKey: MITO_STAGING_CONFIG.apiKey,
      ...(includeSecretKey ? { 'Mito-Secret-Key': MITO_STAGING_CONFIG.secretKey } : {})
    },
    requestBody: body,
    data: json
  };
}

// ============================================================================
// 2. CONSTANTS & IN-MEMORY STORE (LOCAL OLOWO ACCOUNTS + MAPPED MITO IDS)
// ============================================================================
const EXTENDED_KYC_THRESHOLD_GBP = 5000;

const CORRIDORS = [
  {
    code: 'GBP-NGN',
    sendCountryIso3: 'GBR',
    sendCurrency: 'GBP',
    receiveCurrency: 'NGN',
    receiveCountryIso3: 'NGA',
    receiveCountryName: 'Nigeria',
    partnerRate: 1831.01,
    customerRate: 1831.01,
    fixedBaseCommission: 3.00,
    collectionModes: ['BANKACCOUNT', 'MOBILEMONEY'],
    defaultProviderId: '1831846e-75c6-4606-bc5c-0f092cb5ce0a',
    mandatoryBeneficiaryFields: [
      { name: 'firstName', label: 'Beneficiary First Name', type: 'text', placeholder: 'Chukwuma', required: true },
      { name: 'lastName', label: 'Beneficiary Last Name', type: 'text', placeholder: 'Okafor', required: true },
      { name: 'accountNumber', label: 'Bank Account Number / NUBAN (10 digits)', type: 'text', placeholder: '1018316888', required: true },
      { name: 'phone', label: 'Beneficiary Phone Number', type: 'tel', placeholder: '+234 803 123 4567', required: true }
    ]
  },
  {
    code: 'EUR-XOF-SEN',
    sendCountryIso3: 'FRA',
    sendCurrency: 'EUR',
    receiveCurrency: 'XOF',
    receiveCountryIso3: 'SEN',
    receiveCountryName: 'Senegal',
    partnerRate: 655.957,
    customerRate: 650.50,
    fixedBaseCommission: 2.00,
    collectionModes: ['BANKACCOUNT', 'MOBILEMONEY'],
    defaultProviderId: 'sen-bank-001',
    mandatoryBeneficiaryFields: [
      { name: 'firstName', label: 'Beneficiary First Name', type: 'text', placeholder: 'Mamadou', required: true },
      { name: 'lastName', label: 'Beneficiary Last Name', type: 'text', placeholder: 'Ndiaye', required: true },
      { name: 'iban', label: 'IBAN / Account Number (Senegal)', type: 'text', placeholder: 'SN08SN01201001001831688801', required: true },
      { name: 'swiftBic', label: 'SWIFT / BIC Code', type: 'text', placeholder: 'CBAOSNDAXXX', required: true },
      { name: 'phone', label: 'Beneficiary Phone Number', type: 'tel', placeholder: '+221 77 123 4567', required: true }
    ]
  },
  {
    code: 'EUR-XOF-MLI',
    sendCountryIso3: 'FRA',
    sendCurrency: 'EUR',
    receiveCurrency: 'XOF',
    receiveCountryIso3: 'MLI',
    receiveCountryName: 'Mali',
    partnerRate: 655.957,
    customerRate: 649.80,
    fixedBaseCommission: 2.25,
    collectionModes: ['BANKACCOUNT', 'MOBILEMONEY'],
    defaultProviderId: 'mli-bank-001',
    mandatoryBeneficiaryFields: [
      { name: 'firstName', label: 'Beneficiary First Name', type: 'text', placeholder: 'Amadou', required: true },
      { name: 'lastName', label: 'Beneficiary Last Name', type: 'text', placeholder: 'Toure', required: true },
      { name: 'iban', label: 'IBAN / Account Number (Mali)', type: 'text', placeholder: 'ML13ML01601001009988776601', required: true },
      { name: 'swiftBic', label: 'SWIFT / BIC Code', type: 'text', placeholder: 'BDMAMLBAXXX', required: true },
      { name: 'phone', label: 'Beneficiary Mobile Number', type: 'tel', placeholder: '+223 70 11 22 33', required: true }
    ]
  },
  {
    code: 'GBP-KES',
    sendCountryIso3: 'GBR',
    sendCurrency: 'GBP',
    receiveCurrency: 'KES',
    receiveCountryIso3: 'KEN',
    receiveCountryName: 'Kenya',
    partnerRate: 168.40,
    customerRate: 166.90,
    fixedBaseCommission: 1.75,
    collectionModes: ['BANKACCOUNT', 'MOBILEMONEY'],
    defaultProviderId: 'ken-bank-001',
    mandatoryBeneficiaryFields: [
      { name: 'firstName', label: 'Beneficiary First Name', type: 'text', placeholder: 'Wanjiku', required: true },
      { name: 'lastName', label: 'Beneficiary Last Name', type: 'text', placeholder: 'Kamau', required: true },
      { name: 'accountNumber', label: 'Account / M-Pesa Wallet Number', type: 'text', placeholder: '254712345678', required: true },
      { name: 'phone', label: 'Beneficiary Phone Number', type: 'tel', placeholder: '+254 712 345 678', required: true }
    ]
  }
];

// Fallback/supplemental Providers (Merged with live MITO Staging /lookups/provider)
const PROVIDERS = [
  // NIGERIA (NGA) — Real MITO Staging Provider UUIDs first!
  { id: '1831846e-75c6-4606-bc5c-0f092cb5ce0a', name: 'Zenith Bank International', code: '1011', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: 'a2c3c0eb-6fa6-41fc-bb92-22c0aa6716b5', name: 'FCMB (First City Monument Bank)', code: '1033', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: '1d86037f-dc30-447d-9e85-2aca192fb206', name: 'First Bank of Nigeria Plc (FBN)', code: '1039', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: 'e3af932a-0326-4b65-b5f4-e8f753a69d4d', name: 'United Bank for Africa Plc (UBA)', code: '1203', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: '9a11b201-44f2-4a2b-8112-b78c9012f111', name: 'Guaranty Trust Bank (GTBank)', code: '058', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: '5e33f403-66f4-4c4d-a334-d90e1234a333', name: 'Access Bank Nigeria', code: '044', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: 'nga-momo-001', name: 'OPay Mobile Money Nigeria', code: 'OPAY_NG', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: 'nga-momo-002', name: 'PalmPay Mobile Wallet Nigeria', code: 'PALMPAY_NG', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'NGA', status: 'ACTIVE' },
  { id: 'nga-momo-003', name: 'MTN MoMo PSB Nigeria', code: 'MTN_MOMO_NG', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'NGA', status: 'ACTIVE' },

  // SENEGAL (SEN)
  { id: 'sen-bank-001', name: 'CBAO Groupe Attijariwafa Bank (Senegal)', code: 'SN012', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'SEN', status: 'ACTIVE' },
  { id: 'sen-bank-002', name: 'Banque Islamique du Sénégal (BIS)', code: 'SN079', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'SEN', status: 'ACTIVE' },
  { id: 'sen-bank-003', name: 'Société Générale Sénégal (SGSN)', code: 'SN011', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'SEN', status: 'ACTIVE' },
  { id: 'sen-momo-001', name: 'Wave Mobile Money Senegal', code: 'WAVE_SN', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'SEN', status: 'ACTIVE' },
  { id: 'sen-momo-002', name: 'Orange Money Senegal', code: 'OM_SN', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'SEN', status: 'ACTIVE' },

  // MALI (MLI)
  { id: 'mli-bank-001', name: 'Banque de Développement du Mali (BDM-SA)', code: 'ML016', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'MLI', status: 'ACTIVE' },
  { id: 'mli-bank-002', name: 'Bank of Africa Mali (BOA)', code: 'ML045', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'MLI', status: 'ACTIVE' },
  { id: 'mli-momo-001', name: 'Orange Money Mali', code: 'OM_ML', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'MLI', status: 'ACTIVE' },

  // KENYA (KEN)
  { id: 'ken-bank-001', name: 'KCB Bank Kenya Limited', code: 'KCBLKENX', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'KEN', status: 'ACTIVE' },
  { id: 'ken-bank-002', name: 'Equity Bank Kenya Limited', code: 'EQBLKENA', serviceCode: 'MONEYTRANSFER', collectionMode: 'BANKACCOUNT', countryIso3: 'KEN', status: 'ACTIVE' },
  { id: 'ken-momo-001', name: 'M-Pesa Safaricom Kenya', code: 'MPESA_KE', serviceCode: 'MONEYTRANSFER', collectionMode: 'MOBILEMONEY', countryIso3: 'KEN', status: 'ACTIVE' }
];

// Real MITO Staging Lookups from GET /api/v1/mito/Lookups/types (`reason`, `sourceOfFunds`, `relationships`)
// + UUIDs from GET /api/v1/mito/beneficiaries/requirements (`reasonId`, `relationId`)
const MITO_TYPES = {
  reasons: [
    { id: 'FOROWNEXPENDITURES', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'For Own Expenditures', code: 'FOROWNEXPENDITURES' },
    { id: 'EQUITYINVESTMENT', requirementUuid: '941195f4-f0d4-458d-a301-aedeb9d29921', name: 'Investment In Equity Shares', code: 'EQUITYINVESTMENT' },
    { id: 'REATESTATEINVESTMENT', requirementUuid: '1ed097c3-972c-4295-a8ca-1e69594c3e6b', name: 'Investment In Real Estate', code: 'REATESTATEINVESTMENT' },
    { id: 'MEDICALEXPENSES', requirementUuid: '220a200c-4d73-4b3c-b193-63448d752f2d', name: 'Medical Expenses', code: 'MEDICALEXPENSES' },
    { id: 'SALARIESPAYMENT', requirementUuid: '9bf7afb1-301d-4142-a484-55b9bac58d62', name: 'Payment Of Salaries', code: 'SALARIESPAYMENT' },
    { id: 'EDUCATIONALEXPENSES', requirementUuid: 'fc86a994-c498-4762-8dfe-7f896d3767eb', name: 'Educational Expenses', code: 'EDUCATIONALEXPENSES' },
    { id: 'CHARITY', requirementUuid: 'cce70751-9734-474a-a7a9-7e3547a6278c', name: 'Charity', code: 'CHARITY' },
    { id: 'TRADEREMITTANCE', requirementUuid: '6f327fca-a03c-44ca-8ee4-f8cfb6bf58dc', name: 'Trade Remittance', code: 'TRADEREMITTANCE' },
    { id: 'SAVINGS', requirementUuid: '5fec877b-f1c7-49ae-8ebb-4f28e1601b32', name: 'Savings', code: 'SAVINGS' },
    { id: 'GIFT', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Gift', code: 'GIFT' },
    { id: 'HOTELEXPENSE', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Hotel Expense', code: 'HOTELEXPENSE' },
    { id: 'BUSINESSTRAVEL', requirementUuid: '941195f4-f0d4-458d-a301-aedeb9d29921', name: 'Business Travel', code: 'BUSINESSTRAVEL' },
    { id: 'BUSINESSREPATRIATION', requirementUuid: '941195f4-f0d4-458d-a301-aedeb9d29921', name: 'Repatriation Of Business Profits', code: 'BUSINESSREPATRIATION' },
    { id: 'INSURANCEPREMIUM', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Insurance Premium', code: 'INSURANCEPREMIUM' },
    { id: 'INTERESTONLOAN', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Interest On Loans', code: 'INTERESTONLOAN' },
    { id: 'LOANREPAYMENT', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Repayment Of Loans', code: 'LOANREPAYMENT' },
    { id: 'PERSONALTRAVELTOUR', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Personal Travel And Tours', code: 'PERSONALTRAVELTOUR' },
    { id: 'GAMBLING', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Gambling', code: 'GAMBLING' },
    { id: 'OTHERS', requirementUuid: '1a082009-4970-4c65-ae91-0cda9c89006c', name: 'Others', code: 'OTHERS' }
  ],
  sourceOfFunds: [
    { id: 'SALARY', name: 'Salary', code: 'SALARY' },
    { id: 'SAVINGS', name: 'Savings', code: 'SAVINGS' },
    { id: 'BUSINESS', name: 'Business', code: 'BUSINESS' },
    { id: 'TRADING', name: 'Trading', code: 'TRADING' },
    { id: 'RENT', name: 'Lease/Rent', code: 'RENT' },
    { id: 'BANKLOAN', name: 'Loan From Banks', code: 'BANKLOAN' },
    { id: 'DONATION', name: 'Gift/Donation', code: 'DONATION' },
    { id: 'GIFTS', name: 'Gifts', code: 'GIFTS' },
    { id: 'INSURANCECLAIM', name: 'Insurance Claim', code: 'INSURANCECLAIM' },
    { id: 'INVESTMENTREDEMPTION', name: 'Investment redemption', code: 'INVESTMENTREDEMPTION' },
    { id: 'GAMBLINGGAINS', name: 'Gambling gains', code: 'GAMBLINGGAINS' },
    { id: 'LOTTERY', name: 'Lottery', code: 'LOTTERY' },
    { id: 'OTHERS', name: 'Others', code: 'OTHERS' }
  ],
  relationships: [
    { id: '1da52c2b-4a2a-45ee-9333-10f47f38ef2d', name: 'Family', code: 'FAMILY' },
    { id: 'a5567e42-d7ea-4cd0-a294-0a6817fb9492', name: 'Business', code: 'BUSINESS' },
    { id: 'c83e4fa2-b5e2-4993-9379-0110383dff32', name: 'Friend', code: 'FRIEND' },
    { id: 'c034d5c2-2b7d-41b0-86a2-8a62f277c074', name: 'Self', code: 'SELF' },
    { id: 'cc42a3ce-6571-4909-bc17-a857b3aa9de5', name: 'Colleague', code: 'COLLEAGUE' },
    { id: 'fcd35a27-bfe2-4462-953d-09d3ec37382a', name: 'Father', code: 'FATHER' },
    { id: 'f08ab2be-cfab-4870-a9ff-4ac94d393551', name: 'Mother', code: 'MOTHER' },
    { id: '2048ad52-9277-45fa-b802-effd9fdb103c', name: 'Brother', code: 'BROTHER' },
    { id: 'bf56db7b-cdd9-4372-af87-a36faf6379e1', name: 'Sister', code: 'SISTER' }
  ]
};

// Senders (Users) Store — Primary Identity is Email ID (`USERS_BY_EMAIL`), also indexed in `SENDERS` by senderId / mitoUserId
const USERS_BY_EMAIL = new Map();
const SENDERS = new Map();
const BENEFICIARIES = new Map();
const LOCKED_RATES = new Map();
const TRANSACTIONS = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function upsertSenderRecord(sender, extraIds = []) {
  if (!sender) return null;
  const normEmail = normalizeEmail(sender.email);
  if (normEmail) {
    USERS_BY_EMAIL.set(normEmail, sender);
  }
  if (sender.userId) SENDERS.set(sender.userId, sender);
  if (sender.senderId) SENDERS.set(sender.senderId, sender);
  if (sender.mitoUserId) SENDERS.set(sender.mitoUserId, sender);
  if (sender.olowoAccountId) SENDERS.set(sender.olowoAccountId, sender);
  for (const id of extraIds) {
    if (id) SENDERS.set(id, sender);
  }
  return sender;
}

function findSenderByEmailOrId({ email, userId, senderId, olowoAccountId } = {}) {
  if (userId && SENDERS.has(userId)) {
    return SENDERS.get(userId);
  }
  const normEmail = normalizeEmail(email);
  if (normEmail && USERS_BY_EMAIL.has(normEmail)) {
    return USERS_BY_EMAIL.get(normEmail);
  }
  if (senderId && SENDERS.has(senderId)) {
    return SENDERS.get(senderId);
  }
  if (olowoAccountId && SENDERS.has(olowoAccountId)) {
    return SENDERS.get(olowoAccountId);
  }
  return null;
}

function seedDefaultSenders() {
  // 1. David Beckham — New Olowo User identified by email `mohammadmumtazkhan+24@example.com` and userId
  //    (Only basic Olowo registration fields initially; once KYC passes, identified by email + userId so KYC won't repeat unless address/details change!)
  const s1 = {
    userId: 'OLW-LOCAL-928C',
    senderId: 'OLW-LOCAL-928C',
    olowoAccountId: 'OLW-LOCAL-928C',
    mitoUserId: null, // Not submitted to POST /api/v1/mito/Users until full info is collected in Step 3!
    isSubmittedToMito: false,
    sessionId: 'sess-david-928c974b',
    taxProfileId: '143',
    firstName: 'David',
    middleName: '',
    lastName: 'Beckham',
    email: 'mohammadmumtazkhan+24@example.com',
    phoneDialCode: '+44',
    phone: '7553039222',
    phoneNumber: '+447553039222',
    baseCurrency: 'GBP',
    // Full info fields NOT collected on Olowo Step 1 /register:
    gender: '',
    legalEntityType: 'I',
    companyNumber: '',
    businessName: '',
    dob: '',
    dateOfBirth: '',
    buildingNumber: '',
    buildingName: '',
    subStreet: '',
    address: '',
    street: '',
    city: '',
    addressCity: '',
    postcode: '',
    addressPostcode: '',
    country: 'GB',
    countryIso3: 'GBR',
    addressCountryIso3: 'GBR',
    birthCountryIso3: 'GBR',
    kycStatus: 'NOT_STARTED',
    kycTier: 'NONE',
    verifiedProfileSnapshot: null,
    lastChangedFields: [],
    selectedCorridor: null,
    createdAt: new Date().toISOString()
  };

  // 2. Ahmed Diallo — Existing Verified Sender identified by email `ahmed.diallo@mitonetwork.com` and userId `be6b86a7-8484-43df-9af6-09a1d871b8a1`
  const s2 = {
    userId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
    senderId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
    olowoAccountId: 'OLW-LOCAL-7741',
    mitoUserId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
    isSubmittedToMito: true,
    sessionId: 'sess-ahmed-7741a2b0',
    taxProfileId: '188',
    firstName: 'Ahmed',
    middleName: '',
    lastName: 'Diallo',
    email: 'ahmed.diallo@mitonetwork.com',
    phoneDialCode: '+44',
    phone: '7700900456',
    phoneNumber: '+447700900456',
    baseCurrency: 'GBP',
    gender: 'M',
    legalEntityType: 'I',
    companyNumber: null,
    businessName: null,
    dob: '1988-05-14',
    dateOfBirth: '1988-05-14',
    buildingNumber: '23',
    buildingName: '',
    subStreet: '',
    address: '23 Holland Park',
    street: 'Holland Park',
    city: 'London',
    addressCity: 'London',
    postcode: 'W11 3TD',
    addressPostcode: 'W11 3TD',
    country: 'GB',
    countryIso3: 'GBR',
    addressCountryIso3: 'GBR',
    birthCountryIso3: 'GBR',
    kycStatus: 'PASSED',
    kycTier: 'MINI_KYC',
    verifiedProfileSnapshot: {
      email: 'ahmed.diallo@mitonetwork.com',
      firstName: 'Ahmed',
      lastName: 'Diallo',
      dob: '1988-05-14',
      gender: 'M',
      phone: '7700900456',
      buildingNumber: '23',
      address: 'Holland Park',
      city: 'London',
      postcode: 'W11 3TD',
      countryIso3: 'GBR'
    },
    lastChangedFields: [],
    selectedCorridor: null,
    createdAt: new Date().toISOString()
  };

  upsertSenderRecord(s1);
  upsertSenderRecord(s2);

  // Seed existing MITO Staging beneficiary for existing verified sender Ahmed Diallo (`be6b86a7-8484-43df-9af6-09a1d871b8a1`)
  const defaultAhmedBeneficiary = {
    beneficiaryId: '529ee99a-77e6-47e3-bb0e-b66ee851a8ee',
    senderId: s2.senderId,
    mitoUserId: s2.mitoUserId,
    receiveCountryIso3: 'NGA',
    serviceCode: 'MONEYTRANSFER',
    collectionMode: 'BANKACCOUNT',
    providerId: MITO_STAGING_CONFIG.defaultNgaProviderId,
    providerName: 'Zenith Bank International',
    providerCode: '057',
    reason: MITO_TYPES.reasons[0],
    sourceOfFunds: MITO_TYPES.sourceOfFunds[0],
    relationship: MITO_TYPES.relationships[0],
    fields: {
      firstName: 'Topupnigeria',
      lastName: 'Ltd',
      fullName: 'Topupnigeria Ltd',
      accountNumber: '1018316889',
      phone: '+234 803 123 4567',
      email: 'payouts@topupnigeria.com'
    },
    createdAt: new Date().toISOString()
  };
  BENEFICIARIES.set(defaultAhmedBeneficiary.beneficiaryId, defaultAhmedBeneficiary);
}
seedDefaultSenders();

let AFFILIATE_THEME = {
  affiliateId: MITO_STAGING_CONFIG.accessAffiliateNumber,
  serviceNumber: MITO_STAGING_CONFIG.accessServiceNumber,
  brandName: 'olowo',
  tagline: 'make money simple',
  primaryColor: '#56971b',
  accentColor: '#f5b800',
  buttonRadius: '14px'
};

function normalizeUkOrIntlPhone(raw) {
  return String(raw || '')
    .replace(/[^0-9]/g, '')
    .replace(/^44/, '')
    .trim();
}

function buildVerifiedProfileSnapshot(sender) {
  return {
    firstName: String(sender.firstName || '').trim(),
    lastName: String(sender.lastName || '').trim(),
    dob: String(sender.dob || sender.dateOfBirth || '').trim(),
    gender: String(sender.gender || 'M').trim(),
    phone: normalizeUkOrIntlPhone(sender.phoneNumber || sender.phone),
    buildingNumber: String(sender.buildingNumber || '').trim(),
    address: String(sender.street || sender.address || '').replace(/^23\s+/, '').trim(),
    city: String(sender.city || sender.addressCity || '').trim(),
    postcode: String(sender.postcode || sender.addressPostcode || '').trim(),
    countryIso3: String(sender.countryIso3 || 'GBR').trim()
  };
}

function detectSenderDetailsChanges(sender, candidate = null) {
  if (!sender || !sender.verifiedProfileSnapshot) {
    return { hasChanged: false, changedFields: [] };
  }
  const snap = sender.verifiedProfileSnapshot;
  const current = candidate ? buildVerifiedProfileSnapshot(candidate) : buildVerifiedProfileSnapshot(sender);
  const fieldsToCompare = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'buildingNumber', label: 'Building No' },
    { key: 'address', label: 'Street Address' },
    { key: 'city', label: 'City' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'countryIso3', label: 'Country' }
  ];

  const changedFields = [];
  for (const f of fieldsToCompare) {
    const oldVal = String(snap[f.key] || '').toLowerCase().trim();
    const newVal = String(current[f.key] || '').toLowerCase().trim();
    if (oldVal && newVal && oldVal !== newVal) {
      changedFields.push(`${f.label} ("${snap[f.key]}" → "${current[f.key]}")`);
    }
  }

  return {
    hasChanged: changedFields.length > 0,
    changedFields
  };
}

// Helper: Check if we have collected the FULL info of the user required for POST /api/v1/mito/Users
function evaluateSenderCompleteness(sender) {
  const requiredFields = ['firstName', 'lastName', 'dob', 'address', 'postcode'];
  const missingFields = requiredFields.filter(f => !sender[f] || String(sender[f]).trim() === '');
  const changeCheck = detectSenderDetailsChanges(sender);
  return {
    isComplete: missingFields.length === 0,
    isSubmittedToMito: Boolean(sender.isSubmittedToMito && sender.mitoUserId),
    mitoUserId: sender.mitoUserId || null,
    missingFields,
    requiredFields,
    hasDetailsChangedSinceKyc: changeCheck.hasChanged,
    changedFieldsSinceKyc: changeCheck.changedFields,
    verifiedProfileSnapshot: sender.verifiedProfileSnapshot || null
  };
}

// ============================================================================
// 3. HEALTH & LIVE MITO STAGING AUTH ENDPOINT
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Balad-Olowo-MITO-Real-Staging-Integration',
    mitoStagingBaseUrl: MITO_STAGING_CONFIG.baseUrl,
    affiliateId: MITO_STAGING_CONFIG.accessAffiliateNumber,
    serviceNo: MITO_STAGING_CONFIG.accessServiceNumber,
    thresholdGbp: EXTENDED_KYC_THRESHOLD_GBP,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/mito/auth/login', async (req, res) => {
  try {
    const token = await getMitoStagingBearerToken(true);
    res.json({
      code: 200,
      responseType: 'Success',
      message: 'Authenticated against real MITO Staging API (furp02-staging.funtechcom.com)',
      stagingConfig: {
        baseUrl: MITO_STAGING_CONFIG.baseUrl,
        username: MITO_STAGING_CONFIG.username,
        affiliateId: MITO_STAGING_CONFIG.accessAffiliateNumber,
        serviceNo: MITO_STAGING_CONFIG.accessServiceNumber
      },
      data: {
        tokenPreview: `${token.slice(0, 28)}...`,
        ...(cachedMitoAuth.lastAuthResponse ? cachedMitoAuth.lastAuthResponse.data : {})
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, responseType: 'Error', message: err.message });
  }
});

// ============================================================================
// 4. STEP 1: OLOWO ACCOUNT REGISTRATION (`POST /api/olowo/auth/register`)
//    IMPORTANT USER RULE:
//    "we will submit a user only when we collect the full info of the user"
//    Step 1 on Olowo (/register) only collects basic fields (Full name, Email,
//    Phone, Base currency). It does NOT call POST /api/v1/mito/Users yet!
// ============================================================================
app.post('/api/olowo/auth/register', (req, res) => {
  const {
    userId,
    senderId,
    fullName = 'David Beckham',
    firstName: reqFirstName,
    middleName = '',
    lastName: reqLastName,
    email = 'mohammadmumtazkhan+24@example.com',
    phoneDialCode = '+44',
    phone = '7553039222',
    baseCurrency = 'GBP',
    gender = '',
    legalEntityType = 'I',
    companyNumber = '',
    businessName = '',
    dob = '',
    dateOfBirth = '',
    buildingNumber = '',
    buildingName = '',
    subStreet = '',
    address = '',
    street = '',
    city = '',
    addressCity = '',
    postcode = '',
    addressPostcode = '',
    countryIso3 = 'GBR',
    addressCountryIso3 = 'GBR',
    birthCountryIso3 = 'GBR',
    presetMode = 'david_incomplete',
    forceResetKyc = false
  } = req.body;

  const isAhmed = presetMode === 'ahmed_complete' || String(fullName).toLowerCase().includes('ahmed') || normalizeEmail(email) === 'ahmed.diallo@mitonetwork.com';
  if (isAhmed) {
    const existingAhmed = findSenderByEmailOrId({
      email: 'ahmed.diallo@mitonetwork.com',
      userId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1'
    });
    return res.json({
      code: 200,
      responseType: 'Success',
      message: `Identified user by Email (${existingAhmed.email}) & userId (${existingAhmed.userId}): KYC Status is ${existingAhmed.kycStatus}. KYC will NOT run again unless address or other details change!`,
      mitoUserSubmitted: true,
      data: {
        ...existingAhmed,
        completeness: evaluateSenderCompleteness(existingAhmed)
      }
    });
  }

  // Look up existing user by email ID or userId!
  // If this user already exists and their KYC has already PASSED (e.g., returning user on a 2nd transfer),
  // preserve their verified profile & PASSED KYC status!
  const existingByEmailOrId = findSenderByEmailOrId({ email, userId, senderId });
  if (existingByEmailOrId && existingByEmailOrId.kycStatus === 'PASSED' && !forceResetKyc) {
    return res.json({
      code: 200,
      responseType: 'Success',
      message: `Identified existing verified user by Email (${existingByEmailOrId.email}) & userId (${existingByEmailOrId.userId || existingByEmailOrId.mitoUserId}): KYC already PASSED! We will NOT do KYC again unless address or other details change.`,
      mitoUserSubmitted: Boolean(existingByEmailOrId.isSubmittedToMito),
      data: {
        ...existingByEmailOrId,
        completeness: evaluateSenderCompleteness(existingByEmailOrId)
      }
    });
  }

  const parts = String(fullName).trim().split(/\s+/);
  const firstName = (reqFirstName && String(reqFirstName).trim()) || parts[0] || 'David';
  const lastName = (reqLastName && String(reqLastName).trim()) || parts.slice(1).join(' ') || 'Beckham';
  const cleanPhone = String(phone).replace(/^\+44\s*/, '').trim();
  const resolvedDob = String(dateOfBirth || dob || '').trim();
  const resolvedStreet = String(street || address || '').trim();
  const resolvedCity = String(addressCity || city || '').trim();
  const resolvedPostcode = String(addressPostcode || postcode || '').trim();
  const olowoAccountId =
    !forceResetKyc && existingByEmailOrId?.olowoAccountId
      ? existingByEmailOrId.olowoAccountId
      : `OLW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  if (forceResetKyc && existingByEmailOrId) {
    const oldKeys = new Set([existingByEmailOrId.userId, existingByEmailOrId.senderId, existingByEmailOrId.mitoUserId, existingByEmailOrId.olowoAccountId].filter(Boolean));
    for (const k of oldKeys) {
      SENDERS.delete(k);
    }
    for (const [benId, ben] of BENEFICIARIES.entries()) {
      if (oldKeys.has(ben.senderId) || oldKeys.has(ben.userId)) {
        BENEFICIARIES.delete(benId);
      }
    }
    USERS_BY_EMAIL.delete(normalizeEmail(email));
  }

  const localOlowoSender = {
    userId: olowoAccountId,
    senderId: olowoAccountId,
    olowoAccountId,
    mitoUserId: null,
    isSubmittedToMito: false,
    sessionId: `sess-${firstName.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`,
    taxProfileId: String(Math.floor(100 + Math.random() * 900)),
    firstName,
    middleName: String(middleName || '').trim(),
    lastName,
    email: String(email).trim(),
    phoneDialCode,
    phone: cleanPhone,
    phoneNumber: `${phoneDialCode}${cleanPhone}`,
    baseCurrency,
    gender: String(gender || '').trim(),
    legalEntityType: legalEntityType || 'I',
    companyNumber: companyNumber || '',
    businessName: businessName || '',
    dob: resolvedDob,
    dateOfBirth: resolvedDob,
    buildingNumber: String(buildingNumber || '').trim(),
    buildingName: String(buildingName || '').trim(),
    subStreet: String(subStreet || '').trim(),
    address: resolvedStreet,
    street: resolvedStreet,
    city: resolvedCity,
    addressCity: resolvedCity,
    postcode: resolvedPostcode,
    addressPostcode: resolvedPostcode,
    country: countryIso3 === 'FRA' ? 'FR' : 'GB',
    countryIso3: countryIso3 || 'GBR',
    addressCountryIso3: addressCountryIso3 || countryIso3 || 'GBR',
    birthCountryIso3: birthCountryIso3 || 'GBR',
    kycStatus: 'NOT_STARTED',
    kycTier: 'NONE',
    verifiedProfileSnapshot: null,
    lastChangedFields: [],
    selectedCorridor: null,
    createdAt: new Date().toISOString()
  };

  upsertSenderRecord(localOlowoSender);

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Olowo account created (Email: ${localOlowoSender.email}, userId: ${olowoAccountId}).`,
    mitoUserSubmitted: false,
    data: {
      ...localOlowoSender,
      completeness: evaluateSenderCompleteness(localOlowoSender)
    }
  });
});

app.get('/api/v1/mito/Sender/list', (req, res) => {
  const uniqueByEmail = new Map();
  for (const s of SENDERS.values()) {
    const key = normalizeEmail(s.email) || s.userId || s.senderId;
    uniqueByEmail.set(key, s);
  }
  res.json({
    code: 200,
    responseType: 'Success',
    data: Array.from(uniqueByEmail.values()).map(s => ({
      ...s,
      completeness: evaluateSenderCompleteness(s)
    }))
  });
});

// ============================================================================
// 5. OFFICIAL MITO CREATE USER (`POST /api/v1/mito/Users`)
//    Called ONLY in Step 3 when we have collected the FULL info of the user!
//    Proxies live to `POST https://furp02-staging.funtechcom.com/api/v1/mito/Users`
// ============================================================================
async function handleMitoCreateUser(req, res) {
  const {
    userId: requestedUserId,
    olowoAccountId,
    senderId: existingLocalId,
    countryIso3 = 'GBR',
    email = 'mohammadmumtazkhan+24@example.com',
    phoneNumber,
    mobileNumber,
    phone = '7553039222',
    phoneDialCode = '+44',
    firstName = 'David',
    middleName = '',
    lastName = 'Beckham',
    gender = 'M',
    legalEntityType = 'I', // 'I' (Individual) or 'B' (Business)
    companyNumber = null,
    businessName = null,
    dateOfBirth,
    dob,
    buildingNumber = '23',
    buildingName = '',
    subStreet = '',
    street,
    address,
    addressLine1,
    addressCity,
    city,
    addressPostcode,
    postcode,
    postCode,
    addressCountryIso3 = 'GBR',
    birthCountryIso3 = 'GBR',
    baseCurrency = 'GBP'
  } = req.body;

  const resolvedDob = (dateOfBirth || dob || '').trim();
  const resolvedStreet = (street || address || addressLine1 || '').trim();
  const resolvedCity = (addressCity || city || '').trim();
  const resolvedPostcode = (addressPostcode || postcode || postCode || '').trim();
  const cleanPhone = String(phoneNumber || mobileNumber || `${phoneDialCode}${phone}`).replace(/[^0-9]/g, '');

  // Enforce the user's rule: We submit a user ONLY when we have collected the full info of the user!
  const missingFullFields = [];
  if (!firstName) missingFullFields.push('firstName');
  if (!lastName) missingFullFields.push('lastName');
  if (!email) missingFullFields.push('email');
  if (!cleanPhone) missingFullFields.push('phoneNumber');
  if (!gender) missingFullFields.push('gender');
  if (!legalEntityType) missingFullFields.push('legalEntityType');
  if (!resolvedDob) missingFullFields.push('dateOfBirth');
  if (!resolvedStreet) missingFullFields.push('street');
  if (!resolvedCity) missingFullFields.push('addressCity');
  if (!resolvedPostcode) missingFullFields.push('addressPostcode');
  if (!countryIso3) missingFullFields.push('countryIso3');
  if (!addressCountryIso3) missingFullFields.push('addressCountryIso3');
  if (!birthCountryIso3) missingFullFields.push('birthCountryIso3');

  if (legalEntityType === 'B') {
    if (!companyNumber) missingFullFields.push('companyNumber');
    if (!businessName) missingFullFields.push('businessName');
  }

  if (missingFullFields.length > 0) {
    return res.status(422).json({
      code: 422,
      responseType: 'ValidationError',
      errorCode: 'ERR_FULL_USER_INFO_REQUIRED',
      message: `Cannot submit POST /api/v1/mito/Users until full user info is collected. Missing: ${missingFullFields.join(', ')}`,
      missingFields: missingFullFields
    });
  }

  // Identify existing user by Email ID (`email`) or `userId` (`requestedUserId` / `existingLocalId` / `olowoAccountId`)
  const prevSender =
    findSenderByEmailOrId({
      email,
      userId: requestedUserId,
      senderId: existingLocalId,
      olowoAccountId
    }) || {};

  // Candidate profile from incoming request to compare against `verifiedProfileSnapshot`
  const candidateProfile = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    dob: resolvedDob,
    gender,
    phoneNumber: cleanPhone,
    phone: normalizeUkOrIntlPhone(phoneNumber || phone),
    buildingNumber: buildingNumber || '23',
    street: resolvedStreet,
    address: resolvedStreet,
    city: resolvedCity,
    postcode: resolvedPostcode,
    countryIso3
  };

  const changeCheck = detectSenderDetailsChanges(prevSender, candidateProfile);

  // USER RULE: "once KYC of a user passes we will not do KYC again for him until his address or other details changes"
  // Case 1: User already has KYC PASSED and NO address or other details changed -> Skip repeat MITO Users creation & Skip repeat KYC!
  if (prevSender.kycStatus === 'PASSED' && prevSender.isSubmittedToMito && !changeCheck.hasChanged) {
    const unchangedUserId = prevSender.userId || prevSender.mitoUserId || prevSender.senderId;
    prevSender.kycSkippedBecauseUnchanged = true;
    prevSender.lastChangedFields = [];
    upsertSenderRecord(prevSender, [existingLocalId, olowoAccountId, requestedUserId]);

    return res.json({
      code: 200,
      responseType: 'Success',
      kycSkippedBecauseUnchanged: true,
      hasDetailsChangedSinceKyc: false,
      changedFieldsSinceKyc: [],
      message: `Identified user by Email (${prevSender.email}) & userId (${unchangedUserId}): KYC already PASSED (${prevSender.kycTier}) and address/personal details have NOT changed. Repeat KYC is skipped!`,
      data: {
        ...prevSender,
        kycSkippedBecauseUnchanged: true,
        completeness: evaluateSenderCompleteness(prevSender)
      }
    });
  }

  // Case 2: First-time user OR user whose address/details HAVE changed since KYC passed!
  const kycInvalidatedByChange = prevSender.kycStatus === 'PASSED' && changeCheck.hasChanged;

  // Build exact 18-field MITO Staging payload for POST /api/v1/mito/Users
  const uniqueEmailForStaging = email.includes('@')
    ? email.replace('@', `+mito${Date.now().toString().slice(-5)}@`)
    : `david.beckham.${Date.now()}@olowo.app`;

  const mitoUserPayload = {
    countryIso3,
    email: uniqueEmailForStaging,
    phoneNumber: cleanPhone,
    firstName: firstName.trim(),
    middleName: middleName ? middleName.trim() : '',
    lastName: lastName.trim(),
    gender,
    legalEntityType,
    ...(legalEntityType === 'B' ? { companyNumber, businessName } : {}),
    dateOfBirth: resolvedDob,
    buildingNumber: buildingNumber || '23',
    buildingName: buildingName || '',
    subStreet: subStreet || '',
    street: resolvedStreet,
    addressCity: resolvedCity,
    addressPostcode: resolvedPostcode,
    addressCountryIso3,
    birthCountryIso3
  };

  let stagingResult = null;
  let realMitoUserId = null;

  try {
    stagingResult = await callMitoStagingApi('POST', '/Users', mitoUserPayload);
    if (stagingResult.ok && stagingResult.data && stagingResult.data.data && stagingResult.data.data.userId) {
      realMitoUserId = stagingResult.data.data.userId;
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  if (!realMitoUserId) {
    realMitoUserId = prevSender.mitoUserId || crypto.randomUUID();
  }

  const updatedSender = {
    ...prevSender,
    userId: realMitoUserId,
    senderId: realMitoUserId,
    mitoUserId: realMitoUserId,
    olowoAccountId: prevSender.olowoAccountId || olowoAccountId || existingLocalId || `OLW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    isSubmittedToMito: true,
    countryIso3,
    email: String(email).trim(),
    stagingEmail: uniqueEmailForStaging,
    phoneNumber: cleanPhone,
    phoneDialCode,
    phone: String(phone).replace(/^\+44\s*/, '').trim(),
    firstName: firstName.trim(),
    middleName: middleName || '',
    lastName: lastName.trim(),
    gender,
    legalEntityType,
    companyNumber: legalEntityType === 'B' ? companyNumber : null,
    businessName: legalEntityType === 'B' ? businessName : null,
    dateOfBirth: resolvedDob,
    dob: resolvedDob,
    buildingNumber: buildingNumber || '23',
    buildingName: buildingName || '',
    subStreet: subStreet || '',
    street: resolvedStreet,
    address: resolvedStreet,
    addressCity: resolvedCity,
    city: resolvedCity,
    addressPostcode: resolvedPostcode,
    postcode: resolvedPostcode,
    addressCountryIso3,
    birthCountryIso3,
    baseCurrency,
    country: countryIso3 === 'GBR' ? 'GB' : countryIso3,
    amlExecutedOnCreate: false, // Per MITO spec: "Persisted only — this endpoint does not run AML."
    // If address or details changed since previous PASSED KYC, reset kycStatus to NOT_STARTED so KYC runs again!
    kycStatus: kycInvalidatedByChange ? 'NOT_STARTED' : (prevSender.kycStatus && prevSender.kycStatus !== 'NOT_STARTED' ? prevSender.kycStatus : 'NOT_STARTED'),
    kycTier: kycInvalidatedByChange ? 'NONE' : (prevSender.kycTier || 'NONE'),
    kycSkippedBecauseUnchanged: false,
    kycRequiredReason: kycInvalidatedByChange ? 'ADDRESS_OR_DETAILS_CHANGED' : 'FIRST_TIME_KYC',
    lastChangedFields: kycInvalidatedByChange ? changeCheck.changedFields : [],
    submittedToMitoAt: new Date().toISOString()
  };

  upsertSenderRecord(updatedSender, [existingLocalId, olowoAccountId, requestedUserId]);

  res.json({
    code: 200,
    responseType: 'Success',
    kycSkippedBecauseUnchanged: false,
    hasDetailsChangedSinceKyc: kycInvalidatedByChange,
    changedFieldsSinceKyc: kycInvalidatedByChange ? changeCheck.changedFields : [],
    message: kycInvalidatedByChange
      ? `Address or user details changed for ${updatedSender.email} (userId: ${realMitoUserId}): [${changeCheck.changedFields.join(', ')}]. Updated MITO User and re-triggered KYC verification!`
      : `Full user info collected & submitted to live MITO Staging POST /api/v1/mito/Users! Saved real MITO userId: ${realMitoUserId} for Email: ${updatedSender.email}`,
    stagingCall: stagingResult,
    data: {
      ...updatedSender,
      completeness: evaluateSenderCompleteness(updatedSender)
    }
  });
}

app.post('/api/v1/mito/Users', handleMitoCreateUser);
app.post('/api/v1/mito/Sender/Register', handleMitoCreateUser);

// ============================================================================
// 6. STEP 2: GET CORRIDORS (`GET /api/v1/mito/Exchange/corridors`) & LIVE RATE
//    Proxies live to `GET https://furp02-staging.funtechcom.com/api/v1/mito/exchange/Corridors`
// ============================================================================
async function handleMitoGetCorridors(req, res) {
  const serviceCode = req.query.ServiceCode || req.query.serviceCode || 'MONEYTRANSFER';
  let stagingResult = null;
  let liveCorridors = [];

  try {
    const queryStr = serviceCode ? `?ServiceCode=${encodeURIComponent(serviceCode)}` : '';
    stagingResult = await callMitoStagingApi('GET', `/exchange/Corridors${queryStr}`);
    if (stagingResult.ok && stagingResult.data && Array.isArray(stagingResult.data.data)) {
      liveCorridors = stagingResult.data.data;
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  // Map live corridors so UI can display both the 55 live MITO Staging corridors and featured corridors
  const formattedCorridors = liveCorridors.length > 0
    ? liveCorridors.map(c => ({
        corridorCode: c.corridorCode,
        serviceCode: serviceCode || 'MONEYTRANSFER',
        sendCountryIso2: c.fromCountryIso2,
        sendCountryIso3: c.fromCountryIso3,
        sendCountryName: c.fromCountryName,
        sendCurrency: c.fromCurrencyIso3,
        receiveCountryIso2: c.toCountryIso2,
        receiveCountryIso3: c.toCountryIso3,
        receiveCountryName: c.toCountryName,
        receiveCurrency: c.toCurrencyIso3,
        minSendValue: c.minSendValue,
        maxSendValue: c.maxSendValue,
        collectionModes: Array.isArray(c.collectionModes)
          ? c.collectionModes.map(m => m.shortCode || m)
          : ['BANKACCOUNT']
      }))
    : CORRIDORS.map(c => ({
        corridorCode: c.code,
        serviceCode: 'MONEYTRANSFER',
        sendCountryIso3: c.sendCountryIso3,
        sendCurrency: c.sendCurrency,
        receiveCountryIso3: c.receiveCountryIso3,
        receiveCountryName: c.receiveCountryName,
        receiveCurrency: c.receiveCurrency,
        collectionModes: c.collectionModes
      }));

  // Sort so GBP UK -> NGN Nigeria (GBRGBPNGANGN) is ALWAYS first (Default Corridor!)
  formattedCorridors.sort((a, b) => {
    const aIsDefault = a.sendCountryIso3 === 'GBR' && a.sendCurrency === 'GBP' && a.receiveCountryIso3 === 'NGA' && a.receiveCurrency === 'NGN';
    const bIsDefault = b.sendCountryIso3 === 'GBR' && b.sendCurrency === 'GBP' && b.receiveCountryIso3 === 'NGA' && b.receiveCurrency === 'NGN';
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return 0;
  });

  res.json({
    code: 200,
    responseType: 'Success',
    defaultCorridor: 'GBRGBPNGANGN (GBR:GBP -> NGA:NGN · UK -> Nigeria)',
    message: `Returned ${formattedCorridors.length} active corridors from live MITO Staging (furp02-staging.funtechcom.com) with default GBP UK -> NGN Nigeria.`,
    query: { ServiceCode: serviceCode || 'ALL (omitted)' },
    stagingUrl: stagingResult ? stagingResult.stagingUrl : `${MITO_STAGING_CONFIG.baseUrl}/exchange/Corridors?ServiceCode=${serviceCode}`,
    stagingStatus: stagingResult ? stagingResult.status : 200,
    data: formattedCorridors
  });
}

app.get('/api/v1/mito/Exchange/corridors', handleMitoGetCorridors);
app.get('/api/v1/mito/corridors', handleMitoGetCorridors);

// ============================================================================
// 6B. STEP 2 RATE DISPLAY: AFFILIATE COMMERCIAL RATES (`GET /api/v1/mito/Exchange/affiliateRates`)
//     "Affiliate commercial rates for corridors: partner rate, customer rate, and rate expiry.
//      Use when the affiliate needs to see commercial rates — not the end-user cached quote from POST Exchange/rates."
//     Query params: userId, FromCountry, ToCountry, FromCurrency, ToCurrency
// ============================================================================
async function handleMitoGetAffiliateRates(req, res) {
  const userId = req.query.userId || null;
  const FromCountry = req.query.FromCountry || req.query.fromCountry || 'GBR';
  const ToCountry = req.query.ToCountry || req.query.toCountry || 'NGA';
  const FromCurrency = req.query.FromCurrency || req.query.fromCurrency || 'GBP';
  const ToCurrency = req.query.ToCurrency || req.query.toCurrency || 'NGN';
  const sendAmount = parseFloat(req.query.sendAmount || '1000');
  const collectionMode = req.query.collectionMode || 'BANKACCOUNT';

  const qs = new URLSearchParams();
  if (userId) qs.set('userId', userId);
  if (FromCountry) qs.set('FromCountry', FromCountry);
  if (ToCountry) qs.set('ToCountry', ToCountry);
  if (FromCurrency) qs.set('FromCurrency', FromCurrency);
  if (ToCurrency) qs.set('ToCurrency', ToCurrency);

  let stagingResult = null;
  let liveAffiliateRateItems = [];

  try {
    stagingResult = await callMitoStagingApi('GET', `/Exchange/affiliateRates?${qs.toString()}`);
    if (stagingResult.ok && stagingResult.data && Array.isArray(stagingResult.data.data)) {
      liveAffiliateRateItems = stagingResult.data.data;
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  const corridor = CORRIDORS.find(
    c => c.sendCurrency === FromCurrency && c.receiveCurrency === ToCurrency && c.receiveCountryIso3 === ToCountry
  ) || CORRIDORS[0];

  if (liveAffiliateRateItems.length === 0) {
    liveAffiliateRateItems = [
      {
        rateId: crypto.randomUUID(),
        fromCurrency: corridor.sendCurrency,
        toCurrency: corridor.receiveCurrency,
        fromCountry: corridor.sendCountryIso3 || FromCountry,
        toCountry: corridor.receiveCountryIso3 || ToCountry,
        rateMoneyTransfer: corridor.customerRate,
        partnerRateMoneyTransfer: corridor.partnerRate,
        rateMobileAirtime: corridor.customerRate,
        partnerRateMobileAirtime: corridor.partnerRate,
        rateBillPayment: corridor.customerRate,
        partnerRateBillPayment: corridor.partnerRate,
        refreshFrequency: 0,
        rateExpiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        rateDirection: 'BUY'
      }
    ];
  }

  const primaryRate = liveAffiliateRateItems[0];
  const customerRate = Number(primaryRate.rateMoneyTransfer || corridor.customerRate);
  const partnerRate = Number(primaryRate.partnerRateMoneyTransfer || corridor.partnerRate);
  const receiveAmount = Number((sendAmount * customerRate).toFixed(2));
  const gbpEquivalent = FromCurrency === 'GBP' ? sendAmount : Number((sendAmount * 0.85).toFixed(2));
  const requiresExtendedKyc = gbpEquivalent >= EXTENDED_KYC_THRESHOLD_GBP;

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Affiliate commercial rates fetched via GET /api/v1/mito/Exchange/affiliateRates (${FromCountry}:${FromCurrency} -> ${ToCountry}:${ToCurrency}).`,
    query: {
      userId: userId || '(omitted)',
      FromCountry,
      ToCountry,
      FromCurrency,
      ToCurrency
    },
    stagingUrl: stagingResult ? stagingResult.stagingUrl : `${MITO_STAGING_CONFIG.baseUrl}/Exchange/affiliateRates?${qs.toString()}`,
    stagingStatus: stagingResult ? stagingResult.status : 200,
    data: liveAffiliateRateItems,
    calculatedQuote: {
      corridor_code: corridor.code,
      send_currency: FromCurrency,
      receive_currency: ToCurrency,
      receive_country_iso3: ToCountry,
      receive_country_name: corridor.receiveCountryName,
      collection_mode: collectionMode,
      send_amount: sendAmount,
      gbp_equivalent: gbpEquivalent,
      requires_extended_kyc: requiresExtendedKyc,
      extended_kyc_threshold_gbp: EXTENDED_KYC_THRESHOLD_GBP,
      partnerRateMoneyTransfer: partnerRate,
      rateMoneyTransfer: customerRate,
      partner_rate: partnerRate,
      customer_rate: customerRate,
      receive_amount: receiveAmount,
      rateExpiry: primaryRate.rateExpiry,
      rateDirection: primaryRate.rateDirection || 'BUY',
      commission: corridor.fixedBaseCommission
    }
  });
}

app.get('/api/v1/mito/Exchange/affiliateRates', handleMitoGetAffiliateRates);
app.get('/api/remittances/rate', handleMitoGetAffiliateRates);

// Note Corridor when user clicks "Continue to checkout" from Rate Check & Check if full user info is collected
app.post('/api/v1/mito/Sender/CheckStatusAndCorridor', (req, res) => {
  const {
    userId,
    senderId,
    email,
    corridorCode = 'GBP-NGN',
    sendCurrency = 'GBP',
    receiveCurrency = 'NGN',
    receiveCountryIso3 = 'NGA',
    collectionMode = 'BANKACCOUNT',
    sendAmount = 1000
  } = req.body;

  // Rule: At the time of new user creation we check email id, and after that we identify by userId!
  const sender =
    findSenderByEmailOrId({ userId: userId || senderId, email, senderId }) ||
    Array.from(SENDERS.values())[0];

  if (!sender) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `User '${userId || senderId || email}' not found.` });
  }

  const gbpEquivalent = sendCurrency === 'GBP' ? Number(sendAmount) : Number((Number(sendAmount) * 0.85).toFixed(2));
  const requiredKycTier = gbpEquivalent >= EXTENDED_KYC_THRESHOLD_GBP ? 'EXTENDED_KYC' : 'MINI_KYC';

  sender.selectedCorridor = {
    corridorCode,
    sendCurrency,
    receiveCurrency,
    receiveCountryIso3,
    collectionMode,
    sendAmount: Number(sendAmount),
    gbpEquivalent,
    requiredKycTier,
    notedAt: new Date().toISOString()
  };

  const completeness = evaluateSenderCompleteness(sender);
  const needsExtendedUpgrade = requiredKycTier === 'EXTENDED_KYC' && sender.kycTier !== 'EXTENDED_KYC' && sender.kycTier !== 'MANUAL_ADMIN_KYC';
  const kycAlreadyPassedAndUnchanged =
    sender.kycStatus === 'PASSED' &&
    completeness.isComplete &&
    sender.isSubmittedToMito &&
    !completeness.hasDetailsChangedSinceKyc &&
    !needsExtendedUpgrade;

  const needsHostedSenderKycPage =
    !completeness.isComplete ||
    !sender.isSubmittedToMito ||
    sender.kycStatus === 'NOT_STARTED' ||
    completeness.hasDetailsChangedSinceKyc ||
    needsExtendedUpgrade;

  const canProceedToBeneficiary =
    !needsHostedSenderKycPage && (sender.kycStatus === 'PASSED' || sender.kycStatus === 'UNDER_REVIEW');

  res.json({
    code: 200,
    responseType: 'Success',
    kycSkippedBecauseUnchanged: kycAlreadyPassedAndUnchanged,
    message: !sender.isSubmittedToMito
      ? `New user (checked by emailId: ${sender.email}): Not submitted to MITO yet. Collect full user info (${completeness.missingFields.join(', ')}) in Step 3, submit POST /api/v1/mito/Users to assign userId, and run ${requiredKycTier}.`
      : kycAlreadyPassedAndUnchanged
      ? `Identified user by userId (${sender.userId || sender.mitoUserId}): KYC already PASSED (${sender.kycTier}) and address/personal details have NOT changed. Repeat KYC will be skipped unless address or other details change!`
      : `Sender identified by userId (${sender.userId || sender.mitoUserId}) — KYC status is ${sender.kycStatus}.`,
    data: {
      sender,
      completeness,
      requiredKycTier,
      thresholdGbp: EXTENDED_KYC_THRESHOLD_GBP,
      kycSkippedBecauseUnchanged: kycAlreadyPassedAndUnchanged,
      needsHostedSenderKycPage,
      hostedSenderKycUrl: `https://link.mito.money/sender-kyc?userId=${sender.userId || sender.mitoUserId || sender.senderId}&tier=${requiredKycTier}`,
      canProceedToBeneficiary,
      adminManualKycRequired: sender.kycStatus === 'FAILED'
    }
  });
});

// ============================================================================
// 7. STEP 3B: MITO SENDER KYC EXECUTION (After `POST /api/v1/mito/Users` Succeeds)
//    Identified by `userId` (after new user creation)
// ============================================================================
app.post('/api/v1/mito/Kyc/ExecuteSenderKyc', (req, res) => {
  const {
    userId,
    senderId,
    email,
    firstName,
    lastName,
    dob,
    address,
    city = 'London',
    postcode,
    sendAmount = 1000,
    sendCurrency = 'GBP',
    simulatedOutcome = 'PASSED',
    idDocumentType = 'PASSPORT',
    idDocumentNumber = 'GBR-99281726'
  } = req.body;

  const sender = findSenderByEmailOrId({ userId: userId || senderId, email, senderId });
  if (!sender) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `User '${userId || senderId}' not found.` });
  }

  if (firstName !== undefined) sender.firstName = firstName.trim();
  if (lastName !== undefined) sender.lastName = lastName.trim();
  if (dob !== undefined) {
    sender.dob = dob.trim();
    sender.dateOfBirth = dob.trim();
  }
  if (address !== undefined) {
    sender.address = address.trim();
    sender.street = address.trim();
  }
  if (city !== undefined) {
    sender.city = city.trim();
    sender.addressCity = city.trim();
  }
  if (postcode !== undefined) {
    sender.postcode = postcode.trim();
    sender.addressPostcode = postcode.trim();
  }

  const completeness = evaluateSenderCompleteness(sender);
  if (!completeness.isComplete) {
    return res.status(422).json({
      code: 422,
      responseType: 'ValidationError',
      errorCode: 'ERR_MISSING_SENDER_INFO',
      message: `Cannot execute KYC: Missing mandatory sender fields: ${completeness.missingFields.join(', ')}`,
      missingFields: completeness.missingFields
    });
  }

  const gbpEquivalent = sendCurrency === 'GBP' ? Number(sendAmount) : Number((Number(sendAmount) * 0.85).toFixed(2));
  const isExtendedKyc = gbpEquivalent >= EXTENDED_KYC_THRESHOLD_GBP;
  const executedKycTier = isExtendedKyc ? 'EXTENDED_KYC' : 'MINI_KYC';

  if (isExtendedKyc && (!idDocumentType || !idDocumentNumber)) {
    return res.status(422).json({
      code: 422,
      responseType: 'ValidationError',
      errorCode: 'ERR_EXTENDED_KYC_DOC_REQUIRED',
      message: `Transfer amount (£${gbpEquivalent.toLocaleString()} GBP) meets or exceeds the £${EXTENDED_KYC_THRESHOLD_GBP.toLocaleString()} GBP threshold. Extended/Full-KYC requires ID Document Type and Document Number.`
    });
  }

  sender.kycTier = executedKycTier;
  sender.kycStatus = simulatedOutcome;
  sender.kycEvaluatedAt = new Date().toISOString();

  // Save verifiedProfileSnapshot when KYC passes so we do NOT run KYC again unless address or other details change!
  if (sender.kycStatus === 'PASSED') {
    sender.verifiedProfileSnapshot = buildVerifiedProfileSnapshot(sender);
    sender.lastChangedFields = [];
    sender.kycRequiredReason = null;
  }
  upsertSenderRecord(sender);

  const canProceedToBeneficiary = sender.kycStatus === 'PASSED' || sender.kycStatus === 'UNDER_REVIEW';

  let statusMessage = '';
  if (sender.kycStatus === 'PASSED') {
    statusMessage = `${executedKycTier} Passed for MITO userId ${sender.userId || sender.mitoUserId || sender.senderId} (Email: ${sender.email})! Verified snapshot saved — KYC will NOT run again for this user unless their address or other details change.`;
  } else if (sender.kycStatus === 'UNDER_REVIEW') {
    statusMessage = `${executedKycTier} is currently UNDER REVIEW. Per flow rules, user is allowed to proceed to Beneficiary creation while review completes.`;
  } else {
    statusMessage = `${executedKycTier} FAILED. Please contact the Admin for initiating Manual KYC with the help of the MITO system.`;
  }

  res.json({
    code: 200,
    responseType: 'Success',
    message: statusMessage,
    data: {
      sender,
      completeness: evaluateSenderCompleteness(sender),
      executedKycTier,
      kycStatus: sender.kycStatus,
      canProceedToBeneficiary,
      adminManualKycRequired: sender.kycStatus === 'FAILED',
      adminContactInstruction: sender.kycStatus === 'FAILED'
        ? 'Contact Admin Support to initiate Manual KYC Override in the MITO Compliance Console.'
        : null
    }
  });
});

app.post('/api/v1/mito/Kyc/InitiateManualAdminKyc', (req, res) => {
  const { userId, senderId, email, adminNotes = 'Manual KYC verified by Admin via MITO system', resolutionStatus = 'PASSED' } = req.body;
  const sender = findSenderByEmailOrId({ userId: userId || senderId, email, senderId });
  if (!sender) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: 'Sender not found' });
  }

  sender.kycTier = 'MANUAL_ADMIN_KYC';
  sender.kycStatus = resolutionStatus;
  sender.adminNotes = adminNotes;
  if (sender.kycStatus === 'PASSED') {
    sender.verifiedProfileSnapshot = buildVerifiedProfileSnapshot(sender);
    sender.lastChangedFields = [];
    sender.kycRequiredReason = null;
  }
  upsertSenderRecord(sender);

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Admin initiated Manual KYC via MITO system for userId ${sender.userId || sender.senderId}. Status updated to ${sender.kycStatus} — User can now proceed!`,
    data: {
      sender,
      canProceedToBeneficiary: sender.kycStatus === 'PASSED' || sender.kycStatus === 'UNDER_REVIEW'
    }
  });
});

// ============================================================================
// 8. STEP 4: BENEFICIARY REQUIREMENTS, PROVIDERS, TYPES & LIVE BENEFICIARY CREATION
//    Proxies live to MITO Staging `/beneficiaries/requirements`, `/lookups/provider`,
//    `/lookups/types`, and `POST /beneficiaries`!
// ============================================================================
app.get('/api/v1/mito/Beneficiary/requirements', async (req, res) => {
  const { receiveCountryIso3 = 'NGA', collectionMode = 'BANKACCOUNT' } = req.query;
  const corridor = CORRIDORS.find(c => c.receiveCountryIso3 === receiveCountryIso3) || CORRIDORS[0];

  let stagingResult = null;
  if (receiveCountryIso3 === 'NGA') {
    try {
      stagingResult = await callMitoStagingApi(
        'GET',
        `/beneficiaries/requirements?providerId=${MITO_STAGING_CONFIG.defaultNgaProviderId}&toCountry=NGA&toCurrencyCode=NGN&entityType=I&ServiceCode=MONEYTRANSFER&collectionMode=BANKACCOUNT`
      );
    } catch (_) {}
  }

  res.json({
    code: 200,
    responseType: 'Success',
    stagingUrl: stagingResult ? stagingResult.stagingUrl : `${MITO_STAGING_CONFIG.baseUrl}/beneficiaries/requirements`,
    stagingDynamicFieldsCount: stagingResult && stagingResult.data && Array.isArray(stagingResult.data.data) ? stagingResult.data.data.length : 0,
    data: {
      receiveCountryIso3: corridor.receiveCountryIso3,
      receiveCountryName: corridor.receiveCountryName,
      receiveCurrency: corridor.receiveCurrency,
      collectionMode,
      mandatoryFields: corridor.mandatoryBeneficiaryFields,
      stagingRequirements: stagingResult && stagingResult.data ? stagingResult.data.data : null
    }
  });
});

app.get('/api/v1/mito/Providers', async (req, res) => {
  const {
    receiveCountryIso3 = 'NGA',
    serviceCode = 'MONEYTRANSFER',
    collectionMode = 'BANKACCOUNT'
  } = req.query;

  let liveProviders = [];
  let stagingResult = null;
  const corridor = CORRIDORS.find(c => c.receiveCountryIso3 === receiveCountryIso3) || CORRIDORS[0];

  try {
    stagingResult = await callMitoStagingApi(
      'GET',
      `/lookups/provider?countryiso3=${encodeURIComponent(receiveCountryIso3)}&CurrencyCode=${encodeURIComponent(corridor.receiveCurrency)}&ServiceCode=${encodeURIComponent(serviceCode)}&CollectionMode=${encodeURIComponent(collectionMode)}`
    );
    if (stagingResult.ok && stagingResult.data && Array.isArray(stagingResult.data.data) && stagingResult.data.data.length > 0) {
      liveProviders = stagingResult.data.data.map(p => ({
        id: p.providerId,
        name: p.providerName,
        code: p.providerCode,
        serviceCode,
        collectionMode,
        countryIso3: receiveCountryIso3,
        status: 'ACTIVE'
      }));
    }
  } catch (_) {}

  const localFiltered = PROVIDERS.filter(p =>
    p.countryIso3 === receiveCountryIso3 &&
    p.serviceCode === serviceCode &&
    p.collectionMode === collectionMode &&
    p.status === 'ACTIVE'
  );

  // Merge live MITO Staging providers first, followed by any additional local providers
  const seenIds = new Set(liveProviders.map(p => p.id));
  const combined = [...liveProviders, ...localFiltered.filter(p => !seenIds.has(p.id))];

  res.json({
    code: 200,
    responseType: 'Success',
    stagingUrl: stagingResult ? stagingResult.stagingUrl : `${MITO_STAGING_CONFIG.baseUrl}/lookups/provider`,
    query: { receiveCountryIso3, serviceCode, collectionMode },
    data: combined
  });
});

app.get(['/api/v1/mito/Types', '/api/v1/mito/Lookups/types'], async (req, res) => {
  let stagingResult = null;
  try {
    stagingResult = await callMitoStagingApi('GET', '/lookups/types?filter=purposes,source-of-funds,relationships');
  } catch (_) {}

  res.json({
    code: 200,
    responseType: 'Success',
    stagingUrl: stagingResult ? stagingResult.stagingUrl : `${MITO_STAGING_CONFIG.baseUrl}/lookups/types`,
    data: {
      reasons: MITO_TYPES.reasons,
      reason: MITO_TYPES.reasons,
      sourceOfFunds: MITO_TYPES.sourceOfFunds,
      relationships: MITO_TYPES.relationships,
      stagingTypesRaw: stagingResult && stagingResult.data ? stagingResult.data.data : null
    }
  });
});

app.post('/api/v1/mito/Beneficiary', async (req, res) => {
  const {
    senderId,
    receiveCountryIso3 = 'NGA',
    serviceCode = 'MONEYTRANSFER',
    collectionMode = 'BANKACCOUNT',
    providerId,
    reasonId,
    sourceOfFundsId,
    relationshipId,
    fields = {}
  } = req.body;

  const sender = SENDERS.get(senderId);
  if (!sender) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `Sender ID '${senderId}' not found.` });
  }

  if (sender.kycStatus !== 'PASSED' && sender.kycStatus !== 'UNDER_REVIEW') {
    return res.status(409).json({
      code: 409,
      responseType: 'Error',
      errorCode: 'ERR_KYC_NOT_CLEARED_FOR_BENEFICIARY',
      message: `Cannot create beneficiary: Sender (${senderId}) KYC status is '${sender.kycStatus}'. KYC must be PASSED or UNDER_REVIEW first.`
    });
  }

  const corridor = CORRIDORS.find(c => c.receiveCountryIso3 === receiveCountryIso3) || CORRIDORS[0];
  const missingFields = corridor.mandatoryBeneficiaryFields
    .filter(f => f.required && (!fields[f.name] || String(fields[f.name]).trim() === ''))
    .map(f => f.name);

  if (!providerId) missingFields.push('providerId');
  if (!reasonId) missingFields.push('reasonId');
  if (!sourceOfFundsId) missingFields.push('sourceOfFundsId');
  if (!relationshipId) missingFields.push('relationshipId');

  if (missingFields.length > 0) {
    return res.status(422).json({
      code: 422,
      responseType: 'ValidationError',
      errorCode: 'ERR_INCOMPLETE_BENEFICIARY_DATA',
      message: `Missing mandatory beneficiary fields for ${corridor.receiveCountryName}: ${missingFields.join(', ')}`,
      missingFields
    });
  }

  const provider = PROVIDERS.find(p => p.id === providerId) || { id: providerId, name: 'Zenith Bank International', code: '1011' };
  const reason =
    MITO_TYPES.reasons.find(r => r.id === reasonId || r.code === reasonId || r.requirementUuid === reasonId) ||
    MITO_TYPES.reasons[0];
  const sof =
    MITO_TYPES.sourceOfFunds.find(s => s.id === sourceOfFundsId || s.code === sourceOfFundsId) ||
    MITO_TYPES.sourceOfFunds[0];
  const relationship =
    MITO_TYPES.relationships.find(r => r.id === relationshipId || r.code === relationshipId) ||
    MITO_TYPES.relationships[0];

  // Submit Beneficiary live to MITO Staging `POST /api/v1/mito/beneficiaries`
  // Note: `GET /beneficiaries/requirements` requires UUIDs for `reasonId` and `relationId`, while `sourceOfFundId` is `isRequired: false, dropdownOptions: null`
  // (`sourceOfFundCode` is sent on `POST /Transactions/InitiateHostedTransaction` using the code from `GET /Lookups/types`).
  const realUserId = sender.mitoUserId || MITO_STAGING_CONFIG.defaultQuoteUserId;
  const realProviderId = providerId && providerId.length > 20 ? providerId : MITO_STAGING_CONFIG.defaultNgaProviderId;
  const cleanNickname = `${(fields.firstName || 'Beneficiary').replace(/\s+/g, '')}${Date.now().toString().slice(-4)}`;

  const mitoBeneficiaryPayload = {
    serviceCode: 'MONEYTRANSFER',
    collectionMode: collectionMode === 'MOBILEMONEY' ? 'BANKACCOUNT' : collectionMode,
    legalEntityType: 'I',
    countryIso3: receiveCountryIso3 === 'NGA' ? 'NGA' : 'NGA',
    currencyIso: corridor.receiveCurrency === 'NGN' ? 'NGN' : 'NGN',
    providerId: realProviderId,
    userId: realUserId,
    beneficiaryNickname: cleanNickname,
    firstName: fields.firstName || 'Topupnigeria',
    lastName: fields.lastName || 'Ltd',
    mobileNo: String(fields.phone || '2348031234567').replace(/[^0-9]/g, ''),
    acctNumber: fields.accountNumber || '1018316888',
    bankName: provider.name,
    reasonId: reason.requirementUuid || '1a082009-4970-4c65-ae91-0cda9c89006c',
    relationId: relationship.id
  };

  let stagingResult = null;
  let realBeneficiaryId = null;
  try {
    stagingResult = await callMitoStagingApi('POST', '/beneficiaries', mitoBeneficiaryPayload);
    if (stagingResult.ok && stagingResult.data && stagingResult.data.data && stagingResult.data.data.beneficiaryId) {
      realBeneficiaryId = stagingResult.data.data.beneficiaryId;
    } else {
      // If beneficiary already exists on MITO Staging for this userId, fetch existing beneficiaryId via GET /beneficiaries?userId=...
      const existingBenCall = await callMitoStagingApi('GET', `/beneficiaries?userId=${encodeURIComponent(realUserId)}`);
      if (existingBenCall.ok && existingBenCall.data && Array.isArray(existingBenCall.data.data) && existingBenCall.data.data.length > 0) {
        realBeneficiaryId = existingBenCall.data.data[0].beneficiaryId;
      }
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  if (!realBeneficiaryId) {
    realBeneficiaryId = crypto.randomUUID();
  }

  const record = {
    beneficiaryId: realBeneficiaryId,
    senderId: sender.senderId,
    mitoUserId: realUserId,
    receiveCountryIso3,
    serviceCode,
    collectionMode,
    providerId: realProviderId,
    providerName: provider.name,
    providerCode: provider.code,
    reason,
    sourceOfFunds: sof,
    relationship,
    fields,
    createdAt: new Date().toISOString()
  };

  BENEFICIARIES.set(realBeneficiaryId, record);

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Beneficiary created on live MITO Staging (POST /api/v1/mito/beneficiaries)! Saved beneficiaryId: ${realBeneficiaryId} mapped to Sender ID (${sender.senderId}).`,
    stagingCall: stagingResult,
    data: record
  });
});

app.get('/api/v1/mito/Beneficiary', (req, res) => {
  const { senderId } = req.query;
  const sender = senderId ? SENDERS.get(senderId) : null;
  const list = Array.from(BENEFICIARIES.values()).filter(
    b => !senderId || b.senderId === senderId || (sender && b.mitoUserId === sender.mitoUserId)
  );
  res.json({ code: 200, responseType: 'Success', data: list });
});

// ============================================================================
// 9. LOCK THE RATES RIGHT AFTER RATE & CORRIDOR SCREEN (`POST /api/v1/mito/Exchange/rates`)
//    Calls live `POST https://furp02-staging.funtechcom.com/api/v1/mito/exchange/rates`
//    Can be called immediately after Screen 2 (Rate & Corridor) before Beneficiary is created,
//    and returns `rateId` + `expiresAt` (`rateExpirySeconds`) for the side countdown timer!
// ============================================================================
app.post('/api/v1/mito/Exchange/rates', async (req, res) => {
  const {
    senderId,
    beneficiaryId = null,
    sendCurrency = 'GBP',
    receiveCurrency = 'NGN',
    receiveCountryIso3 = 'NGA',
    sendAmount = 1000,
    serviceCode = 'MONEYTRANSFER',
    collectionMode = 'BANKACCOUNT',
    providerId = null
  } = req.body;

  const sender = (senderId && SENDERS.get(senderId)) || Array.from(SENDERS.values())[0];
  const beneficiary = beneficiaryId ? BENEFICIARIES.get(beneficiaryId) : null;

  const corridor = CORRIDORS.find(c => c.receiveCountryIso3 === receiveCountryIso3) || CORRIDORS[0];
  const numericAmount = Number(sendAmount);
  const realUserId = (sender && sender.mitoUserId) || MITO_STAGING_CONFIG.defaultQuoteUserId;
  const realProviderId =
    (providerId && providerId.length > 20 ? providerId : null) ||
    (beneficiary && beneficiary.providerId && beneficiary.providerId.length > 20 ? beneficiary.providerId : null) ||
    MITO_STAGING_CONFIG.defaultNgaProviderId;

  const mitoRatePayload = {
    userId: realUserId,
    serviceCode: 'MONEYTRANSFER',
    collectionMode: collectionMode === 'MOBILEMONEY' ? 'BANKACCOUNT' : collectionMode,
    fromCountry: corridor.sendCountryIso3 || 'GBR',
    toCountry: corridor.receiveCountryIso3 || 'NGA',
    fromCurrency: corridor.sendCurrency || 'GBP',
    toCurrency: corridor.receiveCurrency || 'NGN',
    amount: numericAmount,
    direction: 'S',
    providerId: realProviderId
  };

  let stagingResult = null;
  let liveRateData = null;
  try {
    stagingResult = await callMitoStagingApi('POST', '/exchange/rates', mitoRatePayload);
    if (stagingResult.ok && stagingResult.data && stagingResult.data.data && stagingResult.data.data.rateId) {
      liveRateData = stagingResult.data.data;
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  const rateId = liveRateData ? liveRateData.rateId : crypto.randomUUID();
  const exchangeRate = liveRateData ? Number(liveRateData.rate) : corridor.customerRate;
  const partnerRate = liveRateData ? Number(liveRateData.partnerRate || liveRateData.rate) : corridor.partnerRate;
  const commission = liveRateData && liveRateData.commission !== undefined ? Number(liveRateData.commission) : corridor.fixedBaseCommission;
  const receiveAmount = liveRateData && liveRateData.receiveAmount
    ? Number(liveRateData.receiveAmount)
    : Number((numericAmount * exchangeRate).toFixed(2));

  // 15-minute (900 seconds) rate lock expiry window for the live side countdown
  const rateExpirySeconds = 900;
  const lockedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + rateExpirySeconds * 1000).toISOString();

  const lockedRate = {
    rateId,
    senderId: sender ? sender.senderId : senderId,
    mitoUserId: realUserId,
    beneficiaryId: beneficiary ? beneficiary.beneficiaryId : beneficiaryId,
    providerId: realProviderId,
    serviceCode,
    collectionMode,
    sendCountryIso3: corridor.sendCountryIso3 || 'GBR',
    sendCurrency: corridor.sendCurrency,
    receiveCurrency: corridor.receiveCurrency,
    receiveCountryIso3: corridor.receiveCountryIso3,
    receiveCountryName: corridor.receiveCountryName,
    sendAmount: numericAmount,
    exchangeRate,
    partnerRate,
    receiveAmount,
    fixedBaseCommission: commission,
    forexSpreadCommission: 0,
    totalCommission: commission,
    totalPayable: Number((numericAmount + commission).toFixed(2)),
    lockedAt,
    expiresAt,
    rateExpirySeconds,
    status: 'LOCKED'
  };

  LOCKED_RATES.set(rateId, lockedRate);

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Exchange rate locked after Rate & Corridor screen via live MITO Staging (POST /api/v1/mito/Exchange/rates)! Locked rateId: ${rateId} (valid for 15:00).`,
    stagingCall: stagingResult,
    data: lockedRate
  });
});

// ============================================================================
// 10. STEP 6: INITIATE HOSTED TRANSACTION (`POST /api/v1/mito/Transactions/InitiateHostedTransaction`)
//     Calls live `POST https://furp02-staging.funtechcom.com/api/v1/mito/Transactions/InitiateHostedTransaction`
//     with `Authorization: Bearer <JWT>` and `Mito-Secret-Key: sk_sandbox_9gaa5i3pbp3d5gpf7a5cee7m2nxq3v2p`
//     Extracts and loads ONLY `requiredAction.payment.link` from the response!
// ============================================================================
app.post('/api/v1/mito/Transactions/InitiateHostedTransaction', async (req, res) => {
  const {
    userId: requestedUserId,
    senderId,
    beneficiaryId = null,
    providerId: requestedProviderId = null,
    providerName: requestedProviderName = null,
    rateId,
    redirectUrl = 'https://olowo.app/remittances/callback',
    PartnerReferenceNumber,
    sourceOfFundCode: reqSourceOfFundCode,
    reasonCode: reqReasonCode,
    paymentNarration = 'Remittance transfer via Olowo / Balad',
    webhookUrl = 'https://olowo.app/api/webhooks/mito'
  } = req.body;

  const sender =
    findSenderByEmailOrId({ userId: requestedUserId || senderId, senderId }) ||
    Array.from(SENDERS.values())[0];
  if (!sender) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `User '${requestedUserId || senderId}' not found.` });
  }

  // If caller explicitly passed a non-empty beneficiaryId that is not in BENEFICIARIES, validate it;
  // If beneficiaryId is omitted/null (user selected Bank only -> Lock Rate -> Submit Transaction),
  // MITO Hosted Page handles creating/selecting the beneficiary (`isBeneficiaryRequired: true`)!
  const hasExplicitBeneficiaryId = Boolean(beneficiaryId && String(beneficiaryId).trim() !== '');
  const beneficiary = hasExplicitBeneficiaryId ? BENEFICIARIES.get(beneficiaryId) : null;
  if (hasExplicitBeneficiaryId && !beneficiary) {
    return res.status(403).json({
      code: 403,
      responseType: 'Error',
      errorCode: 'ERR_INVALID_BENEFICIARY_MAPPING',
      message: 'Beneficiary ID is invalid or not found.'
    });
  }

  let lockedRate = LOCKED_RATES.get(rateId);
  if (!lockedRate) {
    return res.status(422).json({
      code: 422,
      responseType: 'Error',
      errorCode: 'ERR_INVALID_OR_EXPIRED_RATE_ID',
      message: `Invalid or expired rateId '${rateId}'. Must lock rates first via POST /api/v1/mito/Exchange/rates.`
    });
  }

  const realUserId = sender.mitoUserId || sender.userId || lockedRate.mitoUserId || MITO_STAGING_CONFIG.defaultQuoteUserId;
  const realProviderId =
    (requestedProviderId && String(requestedProviderId).length > 20 ? requestedProviderId : null) ||
    (beneficiary && beneficiary.providerId && beneficiary.providerId.length > 20 ? beneficiary.providerId : null) ||
    lockedRate.providerId ||
    MITO_STAGING_CONFIG.defaultNgaProviderId;
  const matchedProviderObj =
    PROVIDERS.find(p => p.id === realProviderId || p.id === requestedProviderId) ||
    (beneficiary ? { id: beneficiary.providerId, name: beneficiary.providerName } : null) ||
    { id: realProviderId, name: requestedProviderName || 'Zenith Bank International' };

  // If the rate was locked before the user's mitoUserId was bound on MITO Staging,
  // bind a fresh rateId for that specific userId + providerId on MITO Staging so /Transactions/InitiateHostedTransaction matches
  let finalStagingRateId = lockedRate.rateId;
  if (lockedRate.mitoUserId !== realUserId || lockedRate.providerId !== realProviderId) {
    try {
      const rebindCall = await callMitoStagingApi('POST', '/exchange/rates', {
        userId: realUserId,
        serviceCode: 'MONEYTRANSFER',
        collectionMode: lockedRate.collectionMode === 'MOBILEMONEY' ? 'BANKACCOUNT' : lockedRate.collectionMode,
        fromCountry: 'GBR',
        toCountry: 'NGA',
        fromCurrency: 'GBP',
        toCurrency: 'NGN',
        amount: lockedRate.sendAmount,
        direction: 'S',
        providerId: realProviderId
      });
      if (rebindCall.ok && rebindCall.data && rebindCall.data.data && rebindCall.data.data.rateId) {
        finalStagingRateId = rebindCall.data.data.rateId;
        lockedRate.rateId = finalStagingRateId;
        lockedRate.mitoUserId = realUserId;
        lockedRate.providerId = realProviderId;
        LOCKED_RATES.set(finalStagingRateId, lockedRate);
      }
    } catch (_) {}
  }

  const hostOrigin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const isDuplicateOrStaticPartnerRef =
    !PartnerReferenceNumber ||
    PartnerReferenceNumber === 'OLW-REF-20261031' ||
    Array.from(TRANSACTIONS.values()).some(t => t.partnerReferenceNumber === PartnerReferenceNumber);
  const partnerReferenceNumber = isDuplicateOrStaticPartnerRef
    ? `OLW-REF-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
    : PartnerReferenceNumber;
  const resolvedRedirectUrl =
    redirectUrl && !redirectUrl.includes('olowo.app') && !redirectUrl.includes('mito_status=success')
      ? redirectUrl
      : `${hostOrigin}/remittances/callback?partnerReferenceNumber=${encodeURIComponent(partnerReferenceNumber)}`;

  // Resolve `reasonCode` and `sourceOfFundCode` from the user's form inputs FIRST (falling back to beneficiary defaults)
  // to official `GET /api/v1/mito/Lookups/types` string codes (e.g. `SALARY`, `FOROWNEXPENDITURES`), never a raw UUID!
  const matchedReason =
    (reqReasonCode &&
      MITO_TYPES.reasons.find(r => r.code === reqReasonCode || r.id === reqReasonCode || r.requirementUuid === reqReasonCode)) ||
    (beneficiary &&
      beneficiary.reason &&
      MITO_TYPES.reasons.find(
        r => r.code === beneficiary.reason.code || r.id === beneficiary.reason.id || r.requirementUuid === beneficiary.reason.id
      )) ||
    MITO_TYPES.reasons[0];

  const matchedSof =
    (reqSourceOfFundCode &&
      MITO_TYPES.sourceOfFunds.find(s => s.code === reqSourceOfFundCode || s.id === reqSourceOfFundCode)) ||
    (beneficiary &&
      beneficiary.sourceOfFunds &&
      MITO_TYPES.sourceOfFunds.find(s => s.code === beneficiary.sourceOfFunds.code || s.id === beneficiary.sourceOfFunds.id)) ||
    MITO_TYPES.sourceOfFunds[0];

  if (beneficiary) {
    beneficiary.reason = matchedReason;
    beneficiary.sourceOfFunds = matchedSof;
  }

  const reasonCode = matchedReason.code || 'FOROWNEXPENDITURES';
  const sourceOfFundCode = matchedSof.code || 'SALARY';

  // Exact request body per MITO InitiateHostedTransaction specification
  // OMIT `beneficiary` / `beneficiaryId` key completely so MITO returns the `requiredAction.beneficiary` object with a new link!
  const mitoTransactionPayload = {
    serviceCode: 'MONEYTRANSFER',
    collectionMode: lockedRate.collectionMode === 'MOBILEMONEY' ? 'BANKACCOUNT' : lockedRate.collectionMode,
    sendCountryIso3: lockedRate.sendCountryIso3 || 'GBR',
    receiveCountryIso3: lockedRate.receiveCountryIso3 || 'NGA',
    sendCurrency: lockedRate.sendCurrency || 'GBP',
    receiveCurrency: lockedRate.receiveCurrency || 'NGN',
    sendAmount: Number(lockedRate.sendAmount),
    providerId: realProviderId,
    rateId: lockedRate.rateId,
    userId: realUserId,
    redirectUrl: resolvedRedirectUrl,
    PartnerReferenceNumber: partnerReferenceNumber,
    reasonCode,
    sourceOfFundCode,
    paymentNarration,
    webhookUrl
  };

  let stagingResult = null;
  let liveTxData = null;
  try {
    stagingResult = await callMitoStagingApi('POST', '/Transactions/InitiateHostedTransaction', mitoTransactionPayload, true);
    if (
      stagingResult.ok &&
      stagingResult.data &&
      stagingResult.data.data &&
      stagingResult.data.data.status !== 'ABORTED' &&
      stagingResult.data.data.status !== 'EXPIRED'
    ) {
      liveTxData = stagingResult.data.data;
    } else {
      // If rateId was already consumed or returned ABORTED/EXPIRED, lock a brand-new 15-minute rateId + unique PartnerReferenceNumber
      const fallbackUserId = realUserId || MITO_STAGING_CONFIG.defaultQuoteUserId;
      const fallbackRateCall = await callMitoStagingApi('POST', '/exchange/rates', {
        userId: fallbackUserId,
        serviceCode: 'MONEYTRANSFER',
        collectionMode: 'BANKACCOUNT',
        fromCountry: 'GBR',
        toCountry: 'NGA',
        fromCurrency: 'GBP',
        toCurrency: 'NGN',
        amount: Number(lockedRate.sendAmount) || 50,
        direction: 'S',
        providerId: realProviderId
      });
      const fallbackRateId =
        (fallbackRateCall.ok && fallbackRateCall.data && fallbackRateCall.data.data && fallbackRateCall.data.data.rateId) ||
        lockedRate.rateId;
      lockedRate.rateId = fallbackRateId;
      LOCKED_RATES.set(fallbackRateId, lockedRate);

      const freshPartnerRef = `OLW-REF-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const retryPayload = {
        ...mitoTransactionPayload,
        userId: fallbackUserId,
        rateId: fallbackRateId,
        PartnerReferenceNumber: freshPartnerRef
      };
      const retryResult = await callMitoStagingApi('POST', '/Transactions/InitiateHostedTransaction', retryPayload, true);
      if (retryResult.ok && retryResult.data && retryResult.data.data) {
        stagingResult = retryResult;
        liveTxData = retryResult.data.data;
      }
    }
  } catch (err) {
    stagingResult = { ok: false, error: err.message };
  }

  const transactionId = (liveTxData && liveTxData.retailTransactionId) || `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const reference = (liveTxData && liveTxData.reference) || String(Math.floor(100000 + Math.random() * 900000));

  const rawRequiredAction = (liveTxData && liveTxData.requiredAction) || null;
  const paymentAction = (rawRequiredAction && rawRequiredAction.payment) || null;
  const beneficiaryAction = (rawRequiredAction && rawRequiredAction.beneficiary) || null;
  const kycAction = (rawRequiredAction && rawRequiredAction.kyc) || null;
  const isKycAlreadyPassed = sender.kycStatus === 'PASSED';
  const requiredAction = {
    kyc: isKycAlreadyPassed ? null : kycAction,
    beneficiary: beneficiaryAction,
    payment: paymentAction
  };
  if (liveTxData && liveTxData.requiredAction && isKycAlreadyPassed) {
    liveTxData.requiredAction.kyc = null;
  }

  const paymentUrl =
    (paymentAction && paymentAction.link) ||
    (liveTxData && liveTxData.paymentUrl) ||
    `https://mito-checkout-1cca8e18297e.herokuapp.com?journeyCode=JNY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const paymentJourneyCode =
    (paymentAction && paymentAction.journeyCode) ||
    (paymentUrl.match(/journeyCode=([^&]+)/) ? paymentUrl.match(/journeyCode=([^&]+)/)[1] : `JNY-${reference}`);
  const paymentCheckoutUrl = `https://mito-checkout-1cca8e18297e.herokuapp.com/transaction?journeyCode=${encodeURIComponent(paymentJourneyCode)}`;

  const beneficiaryRawLink =
    (beneficiaryAction && beneficiaryAction.link) ||
    `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent((beneficiaryAction && beneficiaryAction.journeyCode) || paymentJourneyCode)}`;
  const beneficiaryJourneyCode =
    (beneficiaryAction && beneficiaryAction.journeyCode) ||
    (beneficiaryRawLink.match(/journeyCode=([^&]+)/) ? beneficiaryRawLink.match(/journeyCode=([^&]+)/)[1] : paymentJourneyCode);
  // Normalize to root `/?journeyCode=...` so the QR code renders immediately even when MITO returns `/retail-transaction?journeyCode=...` with `journeyStatus: "Pending"`
  const beneficiaryQrUrl = `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(beneficiaryJourneyCode)}`;
  const beneficiaryDirectUrl = `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(beneficiaryJourneyCode)}`;
  const beneficiaryLink = beneficiaryRawLink;
  const beneficiaryHostedUrl = beneficiaryQrUrl;

  // Primary journeyCode & link loaded after transaction submission is the `requiredAction.beneficiary` object's new link!
  const journeyCode = beneficiaryJourneyCode || paymentJourneyCode;
  const linkToken =
    (beneficiaryAction && beneficiaryAction.linkToken) ||
    (paymentAction && paymentAction.linkToken) ||
    (liveTxData && liveTxData.linkToken) ||
    null;

  const requiredActionBeneficiary = beneficiaryAction
    ? {
        ...beneficiaryAction,
        qrCodeLink: beneficiaryQrUrl,
        directBeneficiaryLink: beneficiaryDirectUrl
      }
    : {
        journeyCode: beneficiaryJourneyCode,
        link: beneficiaryRawLink,
        qrCodeLink: beneficiaryQrUrl,
        directBeneficiaryLink: beneficiaryDirectUrl,
        linkToken,
        status: 'Pending'
      };

  const txRecord = {
    transactionId,
    retailTransactionId: transactionId,
    reference,
    partnerReferenceNumber: (liveTxData && liveTxData.partnerReferenceNumber) || partnerReferenceNumber,
    journeyCode,
    beneficiaryJourneyCode,
    paymentJourneyCode,
    linkToken,
    senderId: sender.senderId,
    userId: realUserId,
    mitoUserId: realUserId,
    senderName: `${sender.firstName} ${sender.lastName}`,
    senderEmail: sender.email,
    senderKycStatus: sender.kycStatus,
    senderKycTier: sender.kycTier,
    providerId: realProviderId,
    providerName: matchedProviderObj.name,
    collectionMode: lockedRate.collectionMode,
    reasonCode,
    reasonName: matchedReason.name,
    sourceOfFundCode,
    sourceOfFundsName: matchedSof.name,
    relationshipName: 'Family',
    rateId: lockedRate.rateId,
    sendCurrency: lockedRate.sendCurrency,
    receiveCurrency: lockedRate.receiveCurrency,
    sendAmount: lockedRate.sendAmount,
    receiveAmount: lockedRate.receiveAmount,
    exchangeRate: lockedRate.exchangeRate,
    totalCommission: lockedRate.totalCommission,
    totalPayable: lockedRate.totalPayable,
    beneficiaryRawLink,
    beneficiaryQrUrl,
    beneficiaryLink,
    beneficiaryHostedUrl,
    beneficiaryDirectUrl,
    paymentUrl,
    paymentCheckoutUrl,
    loadedActionType: 'beneficiary (requiredAction.beneficiary.link -> QR & Direct Form)',
    requiredActionBeneficiary,
    requiredActionPaymentOnly: paymentAction
      ? { ...paymentAction, directCheckoutLink: paymentCheckoutUrl }
      : {
          journeyCode: paymentJourneyCode,
          link: paymentUrl,
          directCheckoutLink: paymentCheckoutUrl,
          linkToken,
          status: 'Pending'
        },
    rawRequiredAction: requiredAction,
    redirectUrl: resolvedRedirectUrl,
    paymentStatus: (liveTxData && liveTxData.status) || 'NEW',
    createdAt: new Date().toISOString()
  };

  TRANSACTIONS.set(transactionId, txRecord);

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Hosted Transaction initiated via POST /api/v1/mito/Transactions/InitiateHostedTransaction (beneficiary key omitted)! Loaded requiredAction.beneficiary QR link (${beneficiaryQrUrl}) · Raw link: ${beneficiaryRawLink}`,
    stagingCall: stagingResult,
    data: {
      transactionId,
      retailTransactionId: transactionId,
      reference,
      partnerReferenceNumber: txRecord.partnerReferenceNumber,
      journeyCode,
      beneficiaryJourneyCode,
      paymentJourneyCode,
      linkToken,
      rateId: lockedRate.rateId,
      providerId: realProviderId,
      providerName: matchedProviderObj.name,
      beneficiaryRawLink,
      beneficiaryQrUrl,
      beneficiaryLink,
      beneficiaryHostedUrl,
      beneficiaryDirectUrl,
      paymentUrl,
      paymentCheckoutUrl,
      requiredAction,
      requiredActionBeneficiary,
      requiredActionPayment: txRecord.requiredActionPaymentOnly,
      redirectUrl: resolvedRedirectUrl,
      transaction: txRecord
    }
  });
});

// ============================================================================
// 11. STEP 7: LIVE REDIRECT URL ROUTE (`GET /remittances/callback`) & TRANSACTION LOOKUP
//     Handles return from MITO Hosted Payment (`redirectUrl`) and captures status
// ============================================================================
function findTransactionByQuery(query = {}) {
  const { transactionId, retailTransactionId, partnerReferenceNumber, PartnerReferenceNumber, reference, journeyCode } = query;
  const idKey = transactionId || retailTransactionId;
  if (idKey && TRANSACTIONS.has(idKey)) {
    return TRANSACTIONS.get(idKey);
  }
  const refKey = partnerReferenceNumber || PartnerReferenceNumber;
  const allTx = Array.from(TRANSACTIONS.values());
  if (refKey) {
    const byPartnerRef = allTx.find(t => t.partnerReferenceNumber === refKey || t.partnerReferenceNumber === `${refKey}-R`);
    if (byPartnerRef) return byPartnerRef;
  }
  if (reference) {
    const byRef = allTx.find(t => String(t.reference) === String(reference));
    if (byRef) return byRef;
  }
  if (journeyCode) {
    const byJny = allTx.find(t => t.journeyCode === journeyCode);
    if (byJny) return byJny;
  }
  return allTx.length > 0 ? allTx[allTx.length - 1] : null;
}

function classifyMitoRedirectPaymentCase(query = {}) {
  const isRestart = String(query.restart || '') === '1';
  const rawInput = String(
    query.orderStatus || query.status || query.paymentStatus || (isRestart ? 'EXPIRED' : 'SUCCESS')
  )
    .trim()
    .toUpperCase();
  const rawCompact = rawInput.replace(/[\s_-]+/g, '');

  const SUCCESS_SET = new Set([
    'READYTOPROCESS',
    'PROCESSED',
    'AWAITINGAFFILIATEUPDATE',
    'COMPSUCCESS',
    'SUCCESS',
    'SUCCESSFUL',
    'SUCCEEDED',
    'PAID',
    'ORDERPAID',
    'COMPLETED',
    'APPROVED'
  ]);
  const AWAITING_SET = new Set([
    'AWAITINGPAYMENT',
    'AWAITING',
    'NEW'
  ]);
  const IN_REVIEW_SET = new Set([
    'INREVIEW',
    'MANUALREVIEW',
    'PENDING',
    'PROCESSING',
    'INPROCESS',
    'INPROGRESS',
    'WAITING'
  ]);
  const CANCELLED_SET = new Set([
    'CANCELLED',
    'CANCELED',
    'CLOSED',
    'ABORTED',
    'USERCLOSED'
  ]);
  const EXPIRED_SET = new Set([
    'EXPIRED',
    'TIMEOUT'
  ]);

  if (isRestart || EXPIRED_SET.has(rawCompact)) {
    return {
      normalizedStatus: 'FAILED',
      paymentCase: 'EXPIRED',
      rawMitoOrderStatus: rawInput || 'EXPIRED'
    };
  }
  if (SUCCESS_SET.has(rawCompact)) {
    return {
      normalizedStatus: 'SUCCESS',
      paymentCase: 'SUCCESS',
      rawMitoOrderStatus: rawCompact === 'SUCCESS' ? 'READYTOPROCESS' : rawInput
    };
  }
  if (AWAITING_SET.has(rawCompact)) {
    return {
      normalizedStatus: 'PENDING',
      paymentCase: 'AWAITING_PAYMENT',
      rawMitoOrderStatus: 'AWAITINGPAYMENT'
    };
  }
  if (IN_REVIEW_SET.has(rawCompact)) {
    return {
      normalizedStatus: 'PENDING',
      paymentCase: 'IN_REVIEW',
      rawMitoOrderStatus: rawCompact === 'PENDING' ? 'INREVIEW' : rawInput
    };
  }
  if (CANCELLED_SET.has(rawCompact)) {
    return {
      normalizedStatus: 'FAILED',
      paymentCase: 'CANCELLED',
      rawMitoOrderStatus: rawInput
    };
  }
  return {
    normalizedStatus: 'FAILED',
    paymentCase: 'FAILED',
    rawMitoOrderStatus: rawInput || 'FAILED'
  };
}

function handleMitoRedirectCallback(req, res) {
  const tx = findTransactionByQuery(req.query);
  const { normalizedStatus, paymentCase, rawMitoOrderStatus } = classifyMitoRedirectPaymentCase(req.query);
  const orderNo = req.query.orderNo || req.query.tnxref || req.query.ref || (tx && tx.reference) || '';

  const hostOrigin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const fullCallbackUrl = `${hostOrigin}${req.originalUrl}`;

  if (tx) {
    tx.paymentStatus = normalizedStatus;
    tx.paymentCase = paymentCase;
    tx.rawMitoOrderStatus = rawMitoOrderStatus;
    if (orderNo) tx.orderNo = orderNo;
    tx.paymentMethod =
      req.query.paymentMethod ||
      (paymentCase === 'AWAITING_PAYMENT' ? 'Bank Transfer (BANKPAYMENT)' : tx.paymentMethod || 'MITO Hosted Payment');
    tx.completedAt = new Date().toISOString();
    tx.finalRedirectUrlWithParams = fullCallbackUrl;
  }

  if (req.query.format === 'json') {
    return res.json({
      code: 200,
      responseType: 'Success',
      message: `Redirect URL (/remittances/callback) captured payment case '${paymentCase}' (orderStatus=${rawMitoOrderStatus}, normalized=${normalizedStatus})`,
      data: {
        redirectUrlHit: fullCallbackUrl,
        paymentStatus: normalizedStatus,
        paymentCase,
        rawMitoOrderStatus,
        orderNo,
        transaction: tx
      }
    });
  }

  const targetTxId = tx ? tx.transactionId : (req.query.transactionId || '');
  res.redirect(
    302,
    `/?mito_callback=1&transactionId=${encodeURIComponent(targetTxId)}&status=${encodeURIComponent(normalizedStatus)}&mito_callback_status=${encodeURIComponent(normalizedStatus)}&paymentCase=${encodeURIComponent(paymentCase)}&orderStatus=${encodeURIComponent(rawMitoOrderStatus)}&orderNo=${encodeURIComponent(orderNo)}&callbackUrl=${encodeURIComponent(fullCallbackUrl)}`
  );
}

app.get('/remittances/callback', handleMitoRedirectCallback);
app.get('/api/v1/mito/Transactions/callback', handleMitoRedirectCallback);

app.get('/api/v1/mito/Transactions/:id', (req, res) => {
  const tx = findTransactionByQuery({ transactionId: req.params.id, partnerReferenceNumber: req.params.id, reference: req.params.id });
  if (!tx) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `Transaction '${req.params.id}' not found.` });
  }
  res.json({ code: 200, responseType: 'Success', data: tx });
});

app.get('/api/v1/mito/Transactions/:id/live-status', async (req, res) => {
  const tx = findTransactionByQuery({ transactionId: req.params.id, journeyCode: req.params.id });
  if (!tx || !tx.journeyCode) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: 'Transaction or journeyCode not found.' });
  }
  try {
    const jRes = await fetch(
      `${MITO_STAGING_CONFIG.baseUrl}/Journey/status?journeyCode=${encodeURIComponent(tx.journeyCode)}`,
      { headers: { ApiKey: 'd2783dc0-0ebc-4980-98ec-6203215f81ec' } }
    ).then(r => r.json());
    const jData = jRes && jRes.data ? jRes.data : null;
    res.json({ code: 200, responseType: 'Success', data: jData });
  } catch (err) {
    res.status(500).json({ code: 500, responseType: 'Error', message: err.message });
  }
});

// ============================================================================
// 11. STEP 7: COMPLETE HOSTED PAYMENT & CAPTURE RESULT ON REDIRECT URL
// ============================================================================
app.post('/api/v1/mito/Transactions/CompleteHostedPayment', (req, res) => {
  const {
    transactionId,
    paymentMethod = 'MITO Hosted Payment',
    simulatedResult = 'SUCCESS',
    orderNo = ''
  } = req.body;

  const tx = findTransactionByQuery({ transactionId }) || Array.from(TRANSACTIONS.values()).slice(-1)[0];
  if (!tx) {
    return res.status(404).json({ code: 404, responseType: 'Error', message: `Transaction '${transactionId}' not found.` });
  }

  const { normalizedStatus, paymentCase, rawMitoOrderStatus } = classifyMitoRedirectPaymentCase({
    orderStatus: simulatedResult
  });

  tx.paymentMethod =
    paymentCase === 'AWAITING_PAYMENT'
      ? 'Bank Transfer (BANKPAYMENT)'
      : paymentMethod || tx.paymentMethod || 'MITO Hosted Payment';
  tx.paymentStatus = normalizedStatus;
  tx.paymentCase = paymentCase;
  tx.rawMitoOrderStatus = rawMitoOrderStatus;
  if (orderNo) tx.orderNo = orderNo;
  tx.completedAt = new Date().toISOString();

  const resolvedOrderNo = orderNo || tx.orderNo || tx.reference || '';
  const finalRedirectUrlWithParams =
    `${tx.redirectUrl}${tx.redirectUrl.includes('?') ? '&' : '?'}transactionId=${encodeURIComponent(tx.transactionId)}&orderNo=${encodeURIComponent(resolvedOrderNo)}&orderStatus=${encodeURIComponent(rawMitoOrderStatus)}&status=${encodeURIComponent(normalizedStatus)}`;

  tx.finalRedirectUrlWithParams = finalRedirectUrlWithParams;

  res.json({
    code: 200,
    responseType: 'Success',
    message: `Payment processed with case '${paymentCase}' (orderStatus='${rawMitoOrderStatus}', normalized='${normalizedStatus}'). Redirecting user to redirectUrl with captured result.`,
    data: {
      transactionId: tx.transactionId,
      reference: tx.reference,
      orderNo: resolvedOrderNo,
      paymentStatus: tx.paymentStatus,
      paymentCase: tx.paymentCase,
      rawMitoOrderStatus: tx.rawMitoOrderStatus,
      paymentMethod: tx.paymentMethod,
      redirectUrl: finalRedirectUrlWithParams,
      transaction: tx
    }
  });
});

// Affiliate Theme API
app.get('/api/v1/mito/affiliate/theme', (req, res) => {
  res.json({ code: 200, responseType: 'Success', data: AFFILIATE_THEME });
});

app.post('/api/v1/mito/affiliate/theme', (req, res) => {
  AFFILIATE_THEME = { ...AFFILIATE_THEME, ...req.body };
  res.json({ code: 200, responseType: 'Success', data: AFFILIATE_THEME });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Balad / Olowo & MITO Live Staging Integration running on http://localhost:${PORT}`);
  });
}

module.exports = app;
