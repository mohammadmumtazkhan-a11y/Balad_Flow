/* ============================================================================
   OLOWO.APP × MITO.MONEY — FULL-SCREEN 7-STEP REMITTANCE FLOW CONTROLLER
   ============================================================================ */

const STATE = {
  currentView: 'register',
  // Step 1: Saved Sender / User Session (Populated dynamically on Step 1 Registration / Login — never hardcoded!)
  senderId: '',
  sender: {
    senderId: '',
    userId: '',
    mitoUserId: '',
    firstName: 'David',
    lastName: 'Beckham',
    screenName: 'David',
    email: 'mohammadmumtazkhan+24@example.com',
    phoneDialCode: '+44',
    phone: '7553039222',
    baseCurrency: 'GBP',
    dob: '',
    address: '',
    city: '',
    postcode: '',
    country: 'GB',
    kycStatus: 'NOT_STARTED',
    kycTier: 'NONE'
  },

  // Step 2: Rate Check & Noted Corridor
  corridorCode: 'GBP-NGN',
  sendCurrency: 'GBP',
  receiveCurrency: 'NGN',
  receiveCountryIso3: 'NGA',
  receiveCountryName: 'Nigeria',
  collectionMode: 'BANKACCOUNT', // 'BANKACCOUNT' | 'MOBILEMONEY'
  sendAmount: 1000.00,
  receiveAmount: 1823439.90,
  customerRate: 1823.4399,
  partnerRate: 1828.01,
  commission: 4.00,
  requiresExtendedKyc: false,

  // Step 3: Simulated KYC Outcome
  simulatedKycOutcome: 'PASSED', // 'PASSED' | 'UNDER_REVIEW' | 'FAILED'

  // Step 4: MITO Dynamic Metadata & Selected Droplist Values
  providers: [],
  reasons: [],
  sourceOfFunds: [],
  relationships: [],
  mandatoryFields: [],
  selectedDroplists: {
    dashProvider: null,
    dashSof: null,
    dashReason: null,
    provider: null,
    reason: null,
    sof: null,
    relationship: null
  },
  beneficiaryId: null,
  activeBeneficiary: null,
  savedBeneficiaries: [],

  // Step 3: Locked Rate & MITO Hosted Transaction
  rateId: null,
  lockedRate: null,
  transactionId: null,
  paymentUrl: null,
  paymentCheckoutUrl: null,
  beneficiaryHostedUrl: null,
  redirectUrl: `${window.location.origin || 'http://localhost:3000'}/remittances/callback`,
  selectedUkBank: 'Barclays',

  // Step 7: Completed Transactions History
  transactions: [],
  txFilter: 'ALL',
  apiLogs: []
};

const UK_BANKS = [
  { name: 'Barclays', tag: 'Instant Open Banking · UK' },
  { name: 'Revolut', tag: 'Instant Open Banking · UK' },
  { name: 'Monzo', tag: 'Instant Open Banking · UK' },
  { name: 'Lloyds Bank', tag: 'Instant Open Banking · UK' },
  { name: 'HSBC UK', tag: 'Instant Open Banking · UK' },
  { name: 'NatWest', tag: 'Instant Open Banking · UK' },
  { name: 'Santander UK', tag: 'Instant Open Banking · UK' },
  { name: 'Halifax', tag: 'Instant Open Banking · UK' },
  { name: 'Nationwide', tag: 'Instant Open Banking · UK' },
  { name: 'First Direct', tag: 'Instant Open Banking · UK' },
  { name: 'TSB Bank', tag: 'Instant Open Banking · UK' },
  { name: 'Chase UK (chase.co.uk)', tag: 'Instant Open Banking · UK' }
];

const CURRENCY_META = {
  GBP: { symbol: '£', flag: '🇬🇧' },
  EUR: { symbol: '€', flag: '🇪🇺' },
  NGN: { symbol: '₦', flag: '🇳🇬', countryIso3: 'NGA', countryName: 'Nigeria' },
  XOF_SEN: { symbol: 'CFA ', flag: '🇸🇳', countryIso3: 'SEN', countryName: 'Senegal' },
  XOF_MLI: { symbol: 'CFA ', flag: '🇲🇱', countryIso3: 'MLI', countryName: 'Mali' },
  KES: { symbol: 'KSh ', flag: '🇰🇪', countryIso3: 'KEN', countryName: 'Kenya' }
};

// ============================================================================
// API HELPER WITH LIVE TELEMETRY LOGGING
// ============================================================================
async function callApi(method, url, body = null) {
  const start = performance.now();
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  const durationMs = Math.round(performance.now() - start);

  STATE.apiLogs.unshift({
    id: Date.now() + Math.random(),
    timestamp: new Date().toLocaleTimeString(),
    method,
    url,
    status: res.status,
    durationMs,
    requestBody: body,
    responseBody: data
  });
  renderApiLogs();
  return { status: res.status, ok: res.ok, data };
}

function renderApiLogs() {
  const countEl = document.getElementById('apiLogCount');
  if (countEl) countEl.textContent = String(STATE.apiLogs.length);

  const container = document.getElementById('apiLogsContainer');
  if (!container) return;

  if (STATE.apiLogs.length === 0) {
    container.innerHTML = '<div class="no-transfers-empty">No API calls logged yet.</div>';
    return;
  }

  container.innerHTML = STATE.apiLogs
    .map(
      log => `
      <div class="api-log-entry">
        <div class="api-log-head">
          <span>[${log.timestamp}] ${log.method} ${log.url}</span>
          <span>HTTP ${log.status} (${log.durationMs}ms)</span>
        </div>
        ${log.requestBody ? `<pre>Req: ${ JSON.stringify(log.requestBody, null, 2) }</pre>` : ''}
        <pre>Res: ${ JSON.stringify(log.responseBody, null, 2) }</pre>
      </div>
    `
    )
    .join('');
}

function clearApiLogs() {
  STATE.apiLogs = [];
  renderApiLogs();
}

// ============================================================================
// HIGH-LEVEL 2-FLOW CONTROLLER (`NEW_USER` vs `EXISTING_USER`) & VIEW NAVIGATION
// ============================================================================
function updateTopFlowBarForUserState() {
  const isExistingFlow = STATE.flowMode === 'EXISTING_USER';

  const btnNew = document.getElementById('btnFlowModeNewUser');
  const btnExisting = document.getElementById('btnFlowModeExistingUser');
  if (btnNew && btnExisting) {
    if (isExistingFlow) {
      btnExisting.style.background = '#25610f';
      btnExisting.style.color = '#ffffff';
      btnExisting.style.borderColor = '#25610f';
      btnNew.style.background = '#ffffff';
      btnNew.style.color = '#1e293b';
      btnNew.style.borderColor = '#cbd5e1';
    } else {
      btnNew.style.background = '#25610f';
      btnNew.style.color = '#ffffff';
      btnNew.style.borderColor = '#25610f';
      btnExisting.style.background = '#ffffff';
      btnExisting.style.color = '#1e293b';
      btnExisting.style.borderColor = '#cbd5e1';
    }
  }

  const pill1 = document.getElementById('flowPillStep1Auth');
  const pill2 = document.getElementById('flowPillStep2Rate');
  const pill3Kyc = document.getElementById('flowPillStep3Kyc');
  const pill4Ben = document.getElementById('flowPillStep4Ben');
  const pill5Sum = document.getElementById('flowPillStep5Sum');
  const pill6Pay = document.getElementById('flowPillStep6Pay');
  const pill7 = document.getElementById('flowPillStep7');
  const summaryStrip = document.getElementById('flowHighLevelSummaryStrip');

  // Per User Rule: Don't show any KYC page, and select bank -> lock rate -> submit transaction -> MITO Hosted Page continues flow for beneficiary & payment!
  if (pill3Kyc) pill3Kyc.classList.add('hidden');
  if (pill4Ben) pill4Ben.classList.add('hidden');
  if (pill5Sum) pill5Sum.classList.add('hidden');

  if (isExistingFlow) {
    if (pill1) pill1.textContent = '1. Log In (Existing User)';
    if (pill2) pill2.textContent = '2. Corridors, Select Bank, Lock Rate & Submit';
    if (pill6Pay) pill6Pay.textContent = '3. MITO Hosted Page (Beneficiary & Payment)';
    if (pill7) pill7.textContent = '4. See Status & Dashboard';
    if (summaryStrip) {
      summaryStrip.style.background = '#eff6ff';
      summaryStrip.style.color = '#1e3a8a';
      summaryStrip.innerHTML =
        `🔁 <strong>Active Flow 2 — Existing User (<code>${STATE.sender?.email || 'ahmed.diallo@mitonetwork.com'}</code> · MITO <code>userId: ${STATE.sender?.mitoUserId || STATE.senderId}</code>):</strong> ` +
        `Logs in → Get Corridors &amp; Rates (<code>GET /Exchange/corridors</code> + <code>GET /Exchange/affiliateRates</code>) → Select Bank (<code>GET /Providers</code>) → Lock Rate (<code>POST /Exchange/rates</code>) → Submit Transaction (<code>POST /Transactions/InitiateHostedTransaction</code>) → MITO Hosted Page Continues Flow (Beneficiary &amp; Payment) → Redirect URL (<code>/remittances/callback</code>)`;
    }
  } else {
    if (pill1) pill1.textContent = '1. User Registration (1 Form)';
    if (pill2) pill2.textContent = '2. Corridors, Select Bank, Lock Rate & Submit';
    if (pill6Pay) pill6Pay.textContent = '3. MITO Hosted Page (Beneficiary & Payment)';
    if (pill7) pill7.textContent = '4. See Status & Dashboard';
    if (summaryStrip) {
      summaryStrip.style.background = '#f0fdf4';
      summaryStrip.style.color = '#14532d';
      summaryStrip.innerHTML =
        `🆕 <strong>Active Flow — Unified Registration &amp; Bank-First Hosted Checkout:</strong> ` +
        `User Registers (1 Form at Beginning: <code>POST /api/olowo/auth/register</code> + <code>POST /api/v1/mito/Users</code>) → Get Corridors &amp; Rates (<code>GET /Exchange/corridors</code> + <code>GET /Exchange/affiliateRates</code>) → Select Bank (<code>GET /Providers</code>) → Lock Rate (<code>POST /Exchange/rates</code>) → Submit Transaction (<code>POST /Transactions/InitiateHostedTransaction</code>) → MITO Hosted Page Continues Flow (Create Beneficiary &amp; Required Info + Payment) → Redirect URL (<code>/remittances/callback</code>)`;
    }
  }
}

function handleTopBarAuthClick() {
  const isExisting = STATE.flowMode === 'EXISTING_USER';
  jumpToView(isExisting ? 'login' : 'register');
}

function switchHighLevelFlowMode(mode) {
  STATE.flowMode = mode === 'EXISTING_USER' ? 'EXISTING_USER' : 'NEW_USER';
  STATE.forceAllowKycEdit = false;

  if (STATE.flowMode === 'EXISTING_USER') {
    fillRegistrationPreset('ahmed_complete');
    const loginEmailEl = document.getElementById('loginEmail');
    if (loginEmailEl) loginEmailEl.value = 'ahmed.diallo@mitonetwork.com';
    STATE.sender = {
      ...STATE.sender,
      senderId: '',
      userId: '',
      mitoUserId: '',
      firstName: 'Ahmed',
      lastName: 'Diallo',
      screenName: 'Ahmed',
      email: 'ahmed.diallo@mitonetwork.com',
      phoneDialCode: '+44',
      phone: '7700900456',
      dob: '1988-05-14',
      buildingNumber: '23',
      street: 'Holland Park',
      address: '23 Holland Park',
      city: 'London',
      postcode: 'W11 3TD',
      countryIso3: 'GBR',
      isSubmittedToMito: false,
      kycStatus: 'PASSED',
      kycTier: 'MINI_KYC'
    };
    STATE.senderId = '';
    updateTopFlowBarForUserState();
    jumpToView('login');
  } else {
    fillRegistrationPreset('david_incomplete');
    STATE.sender = {
      senderId: '',
      userId: '',
      mitoUserId: '',
      firstName: 'David',
      lastName: 'Beckham',
      screenName: 'David',
      email: 'mohammadmumtazkhan+24@example.com',
      phoneDialCode: '+44',
      phone: '7553039222',
      baseCurrency: 'GBP',
      dob: '1975-05-02',
      buildingNumber: '23',
      street: 'Holland Park',
      address: '23 Holland Park',
      city: 'London',
      postcode: 'W11 3TD',
      country: 'GB',
      countryIso3: 'GBR',
      birthCountryIso3: 'GBR',
      isSubmittedToMito: false,
      kycStatus: 'NOT_STARTED',
      kycTier: 'NONE'
    };
    STATE.senderId = '';
    updateTopFlowBarForUserState();
    jumpToView('register');
  }
}

function jumpToView(viewName) {
  // USER RULE: "don't show any KYC page" — never display view-kyc!
  if (viewName === 'kyc') {
    viewName = 'dashboard';
  }

  const allViews = ['login', 'register', 'dashboard', 'kyc', 'beneficiary', 'summary', 'payment', 'success'];
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
  });
  STATE.currentView = viewName;
  updateTopFlowBarForUserState();

  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (_) {
    window.scrollTo(0, 0);
  }

  // Highlight active pill in top helper bar
  document.querySelectorAll('.flow-pill').forEach(btn => {
    const target = btn.getAttribute('data-goto');
    const isAuth = (viewName === 'login' || viewName === 'register') && target === 'auth';
    const isActive = isAuth || target === viewName;
    btn.classList.toggle('active', isActive);
    if (!isActive && btn.id === 'flowPillStep7') {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });

  if (viewName === 'dashboard') {
    refreshDashboardHeader();
    discoverActiveCorridors().then(() => fetchQuoteLive());
    loadDashboardProvidersAndTypes();
    renderDashboardRetrievedBeneficiaries();
    renderTransactionsList();
  } else if (viewName === 'beneficiary') {
    loadStep4BeneficiaryMetadata();
  } else if (viewName === 'summary') {
    populateSummaryView();
  } else if (viewName === 'payment') {
    if (!STATE.paymentCheckoutUrl && !STATE.isInitiatingPayment) {
      handleConfirmSummaryAndInitiatePayment({ bankOnlyFlow: true });
    }
  } else if (viewName === 'success') {
    stopBeneficiaryStatusAutoPolling();
    stopPaymentStatusAutoPolling();
    if (rateCountdownInterval) {
      clearInterval(rateCountdownInterval);
      rateCountdownInterval = null;
    }
  }

  if (viewName !== 'success') {
    clearStatusPageAutoRedirectTimer();
  }

  // Show the side Rate Lock & Countdown Widget whenever a rate is locked and user is in active checkout steps
  const sideWidget = document.getElementById('rateLockSideWidget');
  if (sideWidget) {
    const showSideWidget = Boolean(STATE.lockedRate && STATE.rateRemainingSeconds > 0 && !['login', 'register', 'success'].includes(viewName));
    sideWidget.classList.toggle('hidden', !showSideWidget);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchAuthMode(mode) {
  if (mode === 'login') {
    switchHighLevelFlowMode('EXISTING_USER');
  } else {
    switchHighLevelFlowMode('NEW_USER');
  }
}

// ============================================================================
// STEP 1: UNIFIED USER / SENDER REGISTRATION FORM AT THE BEGINNING (`/register` & `/login`)
// ============================================================================
function syncRegFullNameFromParts() {
  const firstEl = document.getElementById('regFirstName');
  const lastEl = document.getElementById('regLastName');
  const fullEl = document.getElementById('regFullName');
  if (firstEl && lastEl && fullEl) {
    const combined = `${firstEl.value.trim()} ${lastEl.value.trim()}`.trim();
    if (combined) fullEl.value = combined;
  }
}

function fillRegistrationPreset(presetKey) {
  document.querySelectorAll('.preset-chip').forEach((btn, idx) => {
    btn.classList.toggle('active', (presetKey === 'david_incomplete' && idx === 0) || (presetKey === 'ahmed_complete' && idx === 1));
  });

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  if (presetKey === 'ahmed_complete') {
    setVal('regFirstName', 'Ahmed');
    setVal('regMiddleName', '');
    setVal('regLastName', 'Diallo');
    setVal('regFullName', 'Ahmed Diallo');
    setVal('regEmail', 'ahmed.diallo@mitonetwork.com');
    setVal('regDialCode', '+44');
    setVal('regPhone', '7700900456');
    setVal('regGender', 'M');
    setVal('regDob', '1988-05-14');
    setVal('regBaseCurrency', 'GBP');
    setVal('regEntityType', 'I');
    setVal('regBuildingNumber', '23');
    setVal('regSubStreet', '');
    setVal('regStreet', 'Holland Park');
    setVal('regCity', 'London');
    setVal('regPostcode', 'W11 3TD');
    setVal('regCountryIso3', 'GBR');
    setVal('regBirthCountryIso3', 'GBR');
    STATE.presetMode = 'ahmed_complete';
    STATE.flowMode = 'EXISTING_USER';
  } else {
    setVal('regFirstName', 'David');
    setVal('regMiddleName', '');
    setVal('regLastName', 'Beckham');
    setVal('regFullName', 'David Beckham');
    setVal('regEmail', 'mohammadmumtazkhan+24@example.com');
    setVal('regDialCode', '+44');
    setVal('regPhone', '7553039222');
    setVal('regGender', 'M');
    setVal('regDob', '1975-05-02');
    setVal('regBaseCurrency', 'GBP');
    setVal('regEntityType', 'I');
    setVal('regBuildingNumber', '23');
    setVal('regSubStreet', '');
    setVal('regStreet', 'Holland Park');
    setVal('regCity', 'London');
    setVal('regPostcode', 'W11 3TD');
    setVal('regCountryIso3', 'GBR');
    setVal('regBirthCountryIso3', 'GBR');
    STATE.presetMode = 'david_incomplete';
    STATE.flowMode = 'NEW_USER';
  }
}

async function handleRegisterSubmit(event) {
  if (event) event.preventDefault();

  const firstName = (document.getElementById('regFirstName')?.value || '').trim() || 'David';
  const middleName = (document.getElementById('regMiddleName')?.value || '').trim() || '';
  const lastName = (document.getElementById('regLastName')?.value || '').trim() || 'Beckham';
  const fullName = (document.getElementById('regFullName')?.value || '').trim() || `${firstName} ${lastName}`.trim();
  const email = (document.getElementById('regEmail')?.value || '').trim() || 'mohammadmumtazkhan+24@example.com';
  const phoneDialCode = document.getElementById('regDialCode')?.value || '+44';
  const rawPhone = (document.getElementById('regPhone')?.value || '').replace(/^\+44\s*/, '').trim() || '7553039222';
  const gender = document.getElementById('regGender')?.value || 'M';
  const dob = (document.getElementById('regDob')?.value || '').trim() || '1975-05-02';
  const baseCurrency = document.getElementById('regBaseCurrency')?.value || 'GBP';
  const legalEntityType = document.getElementById('regEntityType')?.value || 'I';
  const companyNumber = legalEntityType === 'B' ? (document.getElementById('regCompanyNumber')?.value || '').trim() : null;
  const businessName = legalEntityType === 'B' ? (document.getElementById('regBusinessName')?.value || '').trim() : null;
  const buildingNumber = (document.getElementById('regBuildingNumber')?.value || '').trim() || '23';
  const subStreet = (document.getElementById('regSubStreet')?.value || '').trim() || '';
  const street = (document.getElementById('regStreet')?.value || '').trim() || 'Holland Park';
  const city = (document.getElementById('regCity')?.value || '').trim() || 'London';
  const postcode = (document.getElementById('regPostcode')?.value || '').trim() || 'W11 3TD';
  const countryIso3 = document.getElementById('regCountryIso3')?.value || 'GBR';
  const birthCountryIso3 = document.getElementById('regBirthCountryIso3')?.value || 'GBR';
  const isAhmed = email.toLowerCase().includes('ahmed');

  // 1A. Create / update Olowo account with ALL unified registration fields in one form (`POST /api/olowo/auth/register`)
  const payload = {
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    phoneDialCode,
    phone: rawPhone,
    gender,
    dob,
    dateOfBirth: dob,
    baseCurrency,
    legalEntityType,
    companyNumber,
    businessName,
    buildingNumber,
    subStreet,
    street,
    address: `${buildingNumber} ${street}`.trim(),
    city,
    addressCity: city,
    postcode,
    addressPostcode: postcode,
    countryIso3,
    addressCountryIso3: countryIso3,
    birthCountryIso3,
    presetMode: isAhmed ? 'ahmed_complete' : (STATE.presetMode || 'david_incomplete'),
    forceResetKyc: false
  };

  const { ok, data } = await callApi('POST', '/api/olowo/auth/register', payload);
  if (ok && data.data) {
    STATE.sender = {
      ...data.data,
      screenName: data.data.firstName
    };
    STATE.senderId = data.data.senderId;
  }

  // 1B. Register user in MITO right at the beginning (`POST /api/v1/mito/Users`) using all fields from the unified registration form!
  const createUserRes = await callApi('POST', '/api/v1/mito/Users', {
    userId: STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId,
    senderId: STATE.senderId,
    olowoAccountId: STATE.sender.olowoAccountId || STATE.senderId,
    countryIso3,
    email,
    phoneNumber: `${phoneDialCode}${rawPhone}`,
    firstName,
    middleName,
    lastName,
    gender,
    legalEntityType,
    companyNumber,
    businessName,
    dateOfBirth: dob,
    buildingNumber,
    buildingName: '',
    subStreet,
    street,
    addressCity: city,
    addressPostcode: postcode,
    addressCountryIso3: countryIso3,
    birthCountryIso3
  });

  if (createUserRes.ok && createUserRes.data && createUserRes.data.data) {
    STATE.sender = {
      ...STATE.sender,
      ...createUserRes.data.data,
      screenName: createUserRes.data.data.firstName || firstName
    };
    STATE.senderId =
      createUserRes.data.data.userId ||
      createUserRes.data.data.mitoUserId ||
      createUserRes.data.data.senderId ||
      STATE.senderId;
  }

  STATE.flowMode = isAhmed ? 'EXISTING_USER' : 'NEW_USER';
  STATE.forceAllowKycEdit = false;
  updateTopFlowBarForUserState();

  // Navigate directly to Step 2: Dashboard (Get Corridors & Rates -> Select Bank -> Lock Rate -> Submit Transaction)
  jumpToView('dashboard');
  const alertEl = document.getElementById('dashAlertText');
  if (alertEl) {
    alertEl.innerHTML =
      `✅ <strong>Step 1 Complete — User Registered in 1 Form (MITO <code>userId: ${STATE.sender.mitoUserId || STATE.sender.userId || STATE.senderId}</code> · <code>${STATE.sender.email}</code>)</strong> · ` +
      `<strong>Step 2 Now Active:</strong> Check Corridors &amp; Rates → <strong>Select Recipient Bank (<code>GET /Providers</code>)</strong> → <strong>Lock Rate (<code>POST /Exchange/rates</code>)</strong> → <strong>Submit Transaction (<code>POST /Transactions/InitiateHostedTransaction</code>)</strong> (MITO Hosted Page continues flow for Beneficiary &amp; Payment)!`;
  }
  const weatherModal = document.getElementById('weatherModalOverlay');
  if (weatherModal) weatherModal.classList.add('hidden');
}

async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const email = (document.getElementById('loginEmail').value || 'ahmed.diallo@mitonetwork.com').trim();
  const isAhmed = email.toLowerCase().includes('ahmed');
  if (isAhmed) {
    fillRegistrationPreset('ahmed_complete');
  } else {
    fillRegistrationPreset('david_incomplete');
    document.getElementById('regEmail').value = email;
  }
  await handleRegisterSubmit(null);
}

function dismissWeatherModal(weatherText) {
  document.getElementById('weatherModalOverlay').classList.add('hidden');
  if (weatherText) {
    document.getElementById('dashWeatherText').textContent = weatherText;
  }
}

function openWeatherPrompt() {
  document.getElementById('weatherModalOverlay').classList.remove('hidden');
}

// ============================================================================
// STEP 2: OLOWO RATE CHECK DASHBOARD (`/remittances/create`)
// Editable amounts & currencies on London / Lagos sunset banners
// ============================================================================
function refreshDashboardHeader() {
  const first = STATE.sender.firstName || 'David';
  const last = STATE.sender.lastName || 'Beckham';
  const initials = (first[0] + (last[0] || 'A')).toUpperCase();
  document.getElementById('dashAvatar').textContent = initials;
  document.getElementById('dashUserName').textContent = first;
  const dynamicUserId =
    STATE.sender.mitoUserId || STATE.sender.userId || STATE.senderId || 'Pending Registration';
  document.getElementById('dashSenderIdBadge').textContent = `userId: ${dynamicUserId}`;
}

function setSendAmountQuick(amount) {
  document.getElementById('sendAmountInput').value = Number(amount).toFixed(2);
  document.querySelectorAll('.quick-amt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(`£${Number(amount).toLocaleString()}`));
  });
  handleSendAmountInput();
}

async function loadDashboardProvidersAndTypes() {
  const countryEl = document.getElementById('dashProviderCountryLabel');
  if (countryEl) countryEl.textContent = STATE.receiveCountryIso3 || 'NGA';

  const epBadge = document.getElementById('dashProviderEndpointBadge');
  if (epBadge) {
    epBadge.textContent = `GET /api/v1/mito/Providers?receiveCountryIso3=${STATE.receiveCountryIso3}&serviceCode=MONEYTRANSFER&collectionMode=${STATE.collectionMode}`;
  }

  // 1. Load Banks / Providers based on receive country & collection mode (DO NOT auto-select or hardcode a default bank — let the user select!)
  const provRes = await callApi(
    'GET',
    `/api/v1/mito/Providers?receiveCountryIso3=${encodeURIComponent(STATE.receiveCountryIso3)}&serviceCode=MONEYTRANSFER&collectionMode=${encodeURIComponent(STATE.collectionMode)}`
  );
  if (provRes.ok && Array.isArray(provRes.data?.data)) {
    STATE.providers = provRes.data.data;
    const existingSelected =
      STATE.selectedDroplists.dashProvider &&
      STATE.providers.find(p => p.id === STATE.selectedDroplists.dashProvider.id)
        ? STATE.providers.find(p => p.id === STATE.selectedDroplists.dashProvider.id)
        : null;
    populateDownwardDroplist('dashProvider', STATE.providers, existingSelected, true);
    populateDownwardDroplist('provider', STATE.providers, existingSelected, true);

    const noteBank = document.getElementById('noteSelectedBank');
    if (noteBank) {
      noteBank.textContent = existingSelected ? existingSelected.name : 'Select a bank below';
    }
    const rlwProv = document.getElementById('rlwProviderVal');
    if (rlwProv) {
      rlwProv.textContent = existingSelected ? existingSelected.name : 'Select a bank';
    }
    const pillEl = document.getElementById('dashLockedRateStatusPill');
    if (pillEl && !existingSelected) {
      pillEl.style.background = '#fefce8';
      pillEl.style.color = '#854d0e';
      pillEl.style.borderColor = '#fde047';
      pillEl.innerHTML = `👆 Select a Beneficiary Bank below to lock rate (<strong>${STATE.providers.length}</strong> banks available)`;
    }
  }

  // 2. Load Source of Funds & Transfer Reasons for InitiateHostedTransaction
  if (!STATE.sourceOfFunds.length || !STATE.reasons.length) {
    const typesRes = await callApi('GET', '/api/v1/mito/Lookups/types');
    if (typesRes.ok && typesRes.data?.data) {
      STATE.reasons = typesRes.data.data.reasons || typesRes.data.data.reason || [];
      STATE.sourceOfFunds = typesRes.data.data.sourceOfFunds || [];
      STATE.relationships = typesRes.data.data.relationships || [];
    }
  }

  if (STATE.sourceOfFunds.length) {
    const defaultSof =
      STATE.sourceOfFunds.find(s => s.code === 'SALARY') || STATE.sourceOfFunds[0];
    populateDownwardDroplist('dashSof', STATE.sourceOfFunds, STATE.selectedDroplists.dashSof || defaultSof);
    populateDownwardDroplist('sof', STATE.sourceOfFunds, STATE.selectedDroplists.sof || defaultSof);
  }
  if (STATE.reasons.length) {
    const defaultReason =
      STATE.reasons.find(r => r.code === 'FOROWNEXPENDITURES') || STATE.reasons[0];
    populateDownwardDroplist('dashReason', STATE.reasons, STATE.selectedDroplists.dashReason || defaultReason);
    populateDownwardDroplist('reason', STATE.reasons, STATE.selectedDroplists.reason || defaultReason);
  }
  if (STATE.relationships.length) {
    const defaultRel =
      STATE.relationships.find(r => r.code === 'FAMILY') || STATE.relationships[0];
    populateDownwardDroplist('relationship', STATE.relationships, STATE.selectedDroplists.relationship || defaultRel);
  }
}

function setCollectionMode(mode) {
  STATE.collectionMode = mode;
  const isBank = mode === 'BANKACCOUNT';

  ['pillBankMode', 'benModeBankBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', isBank);
  });
  ['pillMobileMode', 'benModeMobileBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !isBank);
  });

  const noteMode = document.getElementById('noteCollectionMode');
  if (noteMode) noteMode.textContent = mode;

  // Update labels in Step 4 if open
  const accLabel = document.getElementById('benAccountLabel');
  const provLabel = document.getElementById('benProviderLabel');
  if (accLabel) {
    accLabel.innerHTML = isBank
      ? 'Account number <span class="req-star">*</span>'
      : 'Mobile Money Wallet / Phone Number <span class="req-star">*</span>';
  }
  if (provLabel) {
    provLabel.innerHTML = isBank
      ? 'Bank <span class="req-star">*</span> <span class="api-tag">Searchable · Always Opens Downwards ↓</span>'
      : 'Mobile Network Provider <span class="req-star">*</span> <span class="api-tag">Searchable · Always Opens Downwards ↓</span>';
  }

  fetchQuoteLive();
  loadDashboardProvidersAndTypes();
  if (STATE.currentView === 'beneficiary') {
    loadStep4BeneficiaryMetadata();
  }
}

function handleCorridorOrCurrencyChange(source) {
  const sendSelect = document.getElementById('sendCurrencySelect');
  const recSelect = document.getElementById('receiveCorridorSelect');
  const selectedCorridorCode = recSelect.value;

  if (source === 'send') {
    const newSendCurr = sendSelect.value;
    if (newSendCurr === 'EUR' && selectedCorridorCode.startsWith('GBP')) {
      recSelect.value = 'EUR-XOF-SEN';
    } else if (newSendCurr === 'GBP' && selectedCorridorCode.startsWith('EUR')) {
      recSelect.value = 'GBP-NGN';
    }
  } else {
    if (selectedCorridorCode.startsWith('EUR')) {
      sendSelect.value = 'EUR';
    } else {
      sendSelect.value = 'GBP';
    }
  }

  const finalCode = recSelect.value;
  STATE.corridorCode = finalCode;

  if (finalCode === 'GBP-NGN') {
    STATE.sendCurrency = 'GBP';
    STATE.receiveCurrency = 'NGN';
    STATE.receiveCountryIso3 = 'NGA';
    STATE.receiveCountryName = 'Nigeria';
    document.getElementById('sendCurrFlag').textContent = '🇬🇧';
    document.getElementById('sendCurrSymbol').textContent = '£';
    document.getElementById('receiveCurrFlag').textContent = '🇳🇬';
    document.getElementById('receiveCurrSymbol').textContent = '₦';
  } else if (finalCode === 'EUR-XOF-SEN') {
    STATE.sendCurrency = 'EUR';
    STATE.receiveCurrency = 'XOF';
    STATE.receiveCountryIso3 = 'SEN';
    STATE.receiveCountryName = 'Senegal';
    document.getElementById('sendCurrFlag').textContent = '🇪🇺';
    document.getElementById('sendCurrSymbol').textContent = '€';
    document.getElementById('receiveCurrFlag').textContent = '🇸🇳';
    document.getElementById('receiveCurrSymbol').textContent = 'CFA ';
  } else if (finalCode === 'EUR-XOF-MLI') {
    STATE.sendCurrency = 'EUR';
    STATE.receiveCurrency = 'XOF';
    STATE.receiveCountryIso3 = 'MLI';
    STATE.receiveCountryName = 'Mali';
    document.getElementById('sendCurrFlag').textContent = '🇪🇺';
    document.getElementById('sendCurrSymbol').textContent = '€';
    document.getElementById('receiveCurrFlag').textContent = '🇲🇱';
    document.getElementById('receiveCurrSymbol').textContent = 'CFA ';
  } else if (finalCode === 'GBP-KES') {
    STATE.sendCurrency = 'GBP';
    STATE.receiveCurrency = 'KES';
    STATE.receiveCountryIso3 = 'KEN';
    STATE.receiveCountryName = 'Kenya';
    document.getElementById('sendCurrFlag').textContent = '🇬🇧';
    document.getElementById('sendCurrSymbol').textContent = '£';
    document.getElementById('receiveCurrFlag').textContent = '🇰🇪';
    document.getElementById('receiveCurrSymbol').textContent = 'KSh ';
  }

  fetchQuoteLive();
  loadDashboardProvidersAndTypes();
}

async function discoverActiveCorridors(serviceCode = 'MONEYTRANSFER') {
  const url = serviceCode
    ? `/api/v1/mito/Exchange/corridors?ServiceCode=${encodeURIComponent(serviceCode)}`
    : `/api/v1/mito/Exchange/corridors`;
  const { ok, data } = await callApi('GET', url);
  if (ok && Array.isArray(data.data)) {
    STATE.discoveredCorridors = data.data;
    const badge = document.getElementById('corridorsDiscoveredBadge');
    if (badge) {
      badge.textContent = `${data.data.length} Active Corridors Discovered (ServiceCode=${serviceCode || 'ALL'})`;
    }
    const preview = document.getElementById('corridorsResponsePreview');
    if (preview) {
      const sample = data.data.slice(0, 6);
      preview.innerHTML =
        `Discovered (${data.data.length} total): ` +
        sample
          .map(
            c =>
              `<code>${c.sendCurrency}→${c.receiveCurrency} (${c.sendCountryIso3}→${c.receiveCountryIso3})</code>`
          )
          .join(', ') +
        (data.data.length > 6 ? ` <span>+${data.data.length - 6} more</span>` : '');
    }
  }
}

async function fetchQuoteLive() {
  const rawSend = parseFloat(document.getElementById('sendAmountInput').value) || 5;
  STATE.sendAmount = rawSend;
  const fromCountry = STATE.sendCurrency === 'GBP' ? 'GBR' : 'FRA';
  const toCountry = STATE.receiveCountryIso3 || 'NGA';

  // Use the dynamic userId returned from Step 1 User Registration (`POST /api/v1/mito/Users`) or Login — NEVER hardcode userId!
  const dynamicUserId =
    (STATE.sender && (STATE.sender.mitoUserId || STATE.sender.userId || STATE.sender.senderId)) ||
    STATE.senderId ||
    '';

  const badgeCodeEl = document.getElementById('affiliateRatesBadgeCode');
  if (badgeCodeEl) {
    badgeCodeEl.textContent = `GET /api/v1/mito/Exchange/affiliateRates?userId=${dynamicUserId || '<userId>'}`;
  }

  const endpointTitle = document.getElementById('affiliateRateEndpointTitle');
  if (endpointTitle) {
    endpointTitle.textContent = `GET /api/v1/mito/Exchange/affiliateRates?userId=${dynamicUserId || '<userId>'}&FromCountry=${fromCountry}&ToCountry=${toCountry}&FromCurrency=${STATE.sendCurrency}&ToCurrency=${STATE.receiveCurrency}`;
  }

  const url = `/api/v1/mito/Exchange/affiliateRates?userId=${encodeURIComponent(dynamicUserId)}&FromCountry=${encodeURIComponent(fromCountry)}&ToCountry=${encodeURIComponent(toCountry)}&FromCurrency=${encodeURIComponent(STATE.sendCurrency)}&ToCurrency=${encodeURIComponent(STATE.receiveCurrency)}&sendAmount=${encodeURIComponent(rawSend)}&collectionMode=${encodeURIComponent(STATE.collectionMode)}`;
  const { ok, data } = await callApi('GET', url);
  const q = data && (data.calculatedQuote || data.quote);
  if (ok && q) {
    STATE.customerRate = q.rateMoneyTransfer || q.customer_rate;
    STATE.partnerRate = q.partnerRateMoneyTransfer || q.partner_rate;
    STATE.receiveAmount = q.receive_amount;
    STATE.commission = q.commission;
    STATE.requiresExtendedKyc = q.requires_extended_kyc;

    const resolvedUserId = q.userId || (data.query && data.query.userId) || dynamicUserId || 'Dynamic userId';
    const affPreview = document.getElementById('affiliateRateResponsePreview');
    if (affPreview) {
      affPreview.innerHTML =
        `Dynamic <code>userId</code> (not hardcoded): <strong>${resolvedUserId}</strong> &nbsp;·&nbsp; ` +
        `<code>rateMoneyTransfer</code> (Customer rate): <strong>${STATE.customerRate}</strong> &nbsp;·&nbsp; ` +
        `<code>partnerRateMoneyTransfer</code> (Partner rate): <strong>${STATE.partnerRate}</strong> &nbsp;·&nbsp; ` +
        `<code>rateExpiry</code>: <strong>${q.rateExpiry || 'Active'}</strong>`;
    }

    const recInput = document.getElementById('receiveAmountInput');
    if (document.activeElement !== recInput) {
      recInput.value = Number(q.receive_amount).toFixed(2);
    }

    const sendSym = STATE.sendCurrency === 'GBP' ? '£' : '€';
    const recSym = STATE.receiveCurrency === 'NGN' ? '₦' : STATE.receiveCurrency + ' ';
    document.getElementById('rateBadgeText').textContent =
      `${sendSym}1.00 to ${recSym}${Number(STATE.customerRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · affiliate commercial rate (userId: ${resolvedUserId})`;

    const selBankName =
      (STATE.selectedDroplists.dashProvider && STATE.selectedDroplists.dashProvider.name) ||
      (STATE.selectedDroplists.provider && STATE.selectedDroplists.provider.name) ||
      'Select a bank below';
    document.getElementById('corridorNotePill').innerHTML =
      `Corridor: <strong>${STATE.sendCurrency} → ${STATE.receiveCurrency} (${STATE.receiveCountryName})</strong> · Mode: <strong>${STATE.collectionMode}</strong> · Bank: <strong id="noteSelectedBank">${selBankName}</strong>`;
  }
}

function handleSendAmountInput() {
  fetchQuoteLive();
}

function handleReceiveAmountInput() {
  const recVal = parseFloat(document.getElementById('receiveAmountInput').value) || 0;
  if (STATE.customerRate > 0) {
    const calcSend = Number((recVal / STATE.customerRate).toFixed(2));
    document.getElementById('sendAmountInput').value = calcSend;
    STATE.sendAmount = calcSend;
    fetchQuoteLive();
  }
}

function swapCorridorDirection() {
  const order = ['GBP-NGN', 'EUR-XOF-SEN', 'EUR-XOF-MLI', 'GBP-KES'];
  const idx = order.indexOf(STATE.corridorCode);
  const next = order[(idx + 1) % order.length];
  document.getElementById('receiveCorridorSelect').value = next;
  handleCorridorOrCurrencyChange('receive');
}

// ============================================================================
// LOCK RATE (`POST /api/v1/mito/Exchange/rates`) WITH SELECTED BANK `providerId`
// & SUBMIT TRANSACTION (`POST /api/v1/mito/Transactions/InitiateHostedTransaction`)
// ============================================================================
let rateCountdownInterval = null;

async function lockExchangeRateAfterRateScreen() {
  const selectedProv =
    STATE.selectedDroplists.dashProvider ||
    STATE.selectedDroplists.provider ||
    null;

  if (!selectedProv) {
    const pillEl = document.getElementById('dashLockedRateStatusPill');
    if (pillEl) {
      pillEl.classList.remove('hidden');
      pillEl.style.background = '#fee2e2';
      pillEl.style.color = '#991b1b';
      pillEl.style.borderColor = '#fca5a5';
      pillEl.innerHTML =
        `⚠️ <strong>Please select the Beneficiary Bank / Provider from the dropdown below first!</strong> Once you select a bank, we will lock the exchange rate for that bank.`;
    }
    const alertBanner = document.getElementById('dashAlertBanner');
    const alertText = document.getElementById('dashAlertText');
    if (alertBanner && alertText) {
      alertBanner.style.background = '#fef2f2';
      alertBanner.style.borderColor = '#fca5a5';
      alertBanner.style.color = '#991b1b';
      alertText.innerHTML =
        `⚠️ <strong>Beneficiary Bank Not Selected:</strong> Please choose a <strong>Beneficiary Bank / Provider (<code>providerId</code>)</strong> from the dropdown below before locking the rate and submitting the transaction.`;
    }
    const dropWrap = document.getElementById('droplist-dashProvider');
    if (dropWrap) {
      dropWrap.classList.add('open');
      dropWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const searchInput = document.getElementById('droplistSearch-dashProvider');
      if (searchInput) {
        searchInput.value = '';
        filterDownwardDroplist('dashProvider', '');
        setTimeout(() => searchInput.focus(), 50);
      }
    }
    return false;
  }

  const dynamicUserId =
    (STATE.sender && (STATE.sender.mitoUserId || STATE.sender.userId || STATE.sender.senderId)) ||
    STATE.senderId ||
    null;

  const rateRes = await callApi('POST', '/api/v1/mito/Exchange/rates', {
    userId: dynamicUserId,
    senderId: STATE.senderId || dynamicUserId,
    beneficiaryId: STATE.beneficiaryId || null,
    providerId: selectedProv.id,
    providerName: selectedProv.name,
    sendCurrency: STATE.sendCurrency,
    receiveCurrency: STATE.receiveCurrency,
    receiveCountryIso3: STATE.receiveCountryIso3,
    sendAmount: STATE.sendAmount,
    serviceCode: 'MONEYTRANSFER',
    collectionMode: STATE.collectionMode
  });

  if (rateRes.ok && rateRes.data && rateRes.data.data) {
    STATE.lockedRate = rateRes.data.data;
    STATE.rateId = STATE.lockedRate.rateId;
    STATE.customerRate = STATE.lockedRate.exchangeRate;
    STATE.receiveAmount = STATE.lockedRate.receiveAmount;

    const pillEl = document.getElementById('dashLockedRateStatusPill');
    if (pillEl) {
      pillEl.classList.remove('hidden');
      pillEl.style.background = '#dcfce7';
      pillEl.style.color = '#14532d';
      pillEl.style.borderColor = '#86efac';
      pillEl.innerHTML =
        `🔒 <strong>Rate Locked!</strong> <code>rateId: ${STATE.rateId}</code> · ` +
        `Selected Bank: <strong>${selectedProv.name}</strong> (<code>providerId: ${selectedProv.id}</code>) · ` +
        `Rate: <strong>1 ${STATE.sendCurrency} = ${Number(STATE.lockedRate.exchangeRate).toLocaleString()} ${STATE.receiveCurrency}</strong> · Ready to Submit Transaction!`;
    }

    const rlwProv = document.getElementById('rlwProviderVal');
    if (rlwProv && selectedProv) {
      rlwProv.textContent = selectedProv.name;
    }

    const totalSec = STATE.lockedRate.rateExpirySeconds || 900;
    startRateCountdownTimer(totalSec);
    return true;
  }
  return false;
}

async function handleLockRateOnlyOnDashboard() {
  await lockExchangeRateAfterRateScreen();
}

function startRateCountdownTimer(totalSeconds = 900) {
  if (rateCountdownInterval) {
    clearInterval(rateCountdownInterval);
  }
  STATE.rateTotalSeconds = totalSeconds;
  STATE.rateRemainingSeconds = totalSeconds;

  const widget = document.getElementById('rateLockSideWidget');
  if (widget) {
    widget.classList.remove('hidden', 'warning', 'danger');
  }

  updateRateCountdownUi();

  rateCountdownInterval = setInterval(() => {
    STATE.rateRemainingSeconds -= 1;
    if (STATE.rateRemainingSeconds <= 0) {
      clearInterval(rateCountdownInterval);
      rateCountdownInterval = null;
      handleRateExpiredRedirect();
      return;
    }
    updateRateCountdownUi();
  }, 1000);
}

function updateRateCountdownUi() {
  const widget = document.getElementById('rateLockSideWidget');
  if (!widget || !STATE.lockedRate) return;

  const rem = Math.max(0, STATE.rateRemainingSeconds || 0);
  const total = STATE.rateTotalSeconds || 900;
  const mins = String(Math.floor(rem / 60)).padStart(2, '0');
  const secs = String(rem % 60).padStart(2, '0');

  const clockEl = document.getElementById('rlwCountdownClock');
  if (clockEl) clockEl.textContent = `${mins}:${secs}`;

  const barEl = document.getElementById('rlwCountdownBar');
  if (barEl) {
    const pct = Math.max(0, Math.min(100, (rem / total) * 100));
    barEl.style.width = `${pct}%`;
  }

  widget.classList.toggle('warning', rem <= 60 && rem > 15);
  widget.classList.toggle('danger', rem <= 15);

  const badgeEl = document.getElementById('rlwStatusBadge');
  if (badgeEl) {
    badgeEl.textContent = rem <= 15 ? '⚠️ EXPIRING SOON!' : '🔒 RATE LOCKED';
  }

  const sendFlag = STATE.sendCurrency === 'GBP' ? '🇬🇧' : '🇪🇺';
  const recFlag = STATE.receiveCountryIso3 === 'NGA' ? '🇳🇬' : STATE.receiveCountryIso3 === 'SEN' ? '🇸🇳' : STATE.receiveCountryIso3 === 'MLI' ? '🇲🇱' : '🇰🇪';
  const sendSym = STATE.sendCurrency === 'GBP' ? '£' : '€';
  const recSym = STATE.receiveCurrency === 'NGN' ? '₦' : STATE.receiveCurrency + ' ';

  const corrEl = document.getElementById('rlwCorridorLabel');
  if (corrEl) corrEl.textContent = `${sendFlag} ${STATE.sendCurrency} → ${recFlag} ${STATE.receiveCurrency}`;

  const rateValEl = document.getElementById('rlwRateVal');
  if (rateValEl) {
    rateValEl.textContent = `${sendSym}1.00 = ${recSym}${Number(STATE.lockedRate.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const sendValEl = document.getElementById('rlwSendVal');
  if (sendValEl) {
    sendValEl.textContent = `${sendSym}${Number(STATE.lockedRate.sendAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${STATE.sendCurrency}`;
  }

  const recValEl = document.getElementById('rlwReceiveVal');
  if (recValEl) {
    recValEl.textContent = `${recSym}${Number(STATE.lockedRate.receiveAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${STATE.receiveCurrency}`;
  }

  const rateIdEl = document.getElementById('rlwRateIdVal');
  if (rateIdEl) {
    rateIdEl.textContent = STATE.rateId || 'Locked';
    rateIdEl.title = STATE.rateId || '';
  }

  const rlwProv = document.getElementById('rlwProviderVal');
  const selProv = STATE.selectedDroplists.dashProvider || STATE.selectedDroplists.provider;
  if (rlwProv && selProv) {
    rlwProv.textContent = selProv.name;
  }
}

function simulateRateExpiryIn3Seconds() {
  if (!STATE.lockedRate) return;
  STATE.rateTotalSeconds = 15;
  STATE.rateRemainingSeconds = 3;
  updateRateCountdownUi();
}

function handleRateExpiredRedirect() {
  const expiredRateId = STATE.rateId;
  STATE.rateId = null;
  STATE.lockedRate = null;
  STATE.rateRemainingSeconds = 0;

  const widget = document.getElementById('rateLockSideWidget');
  if (widget) {
    widget.classList.add('hidden');
  }

  // Per User Rule: "once rate expire redirect to rate and corridor screen"
  jumpToView('dashboard');

  const alertBanner = document.getElementById('dashAlertBanner');
  const alertText = document.getElementById('dashAlertText');
  if (alertBanner && alertText) {
    alertBanner.style.background = '#fee2e2';
    alertBanner.style.borderColor = '#fca5a5';
    alertBanner.style.color = '#991b1b';
    alertText.innerHTML =
      `⏰ <strong>Locked Exchange Rate Expired (<code>${expiredRateId || 'rateId'}</code> reached 00:00)!</strong> ` +
      `You have been redirected to the <strong>Rate &amp; Corridor screen</strong>. Fresh commercial rates have been loaded — select your bank and click <strong>"Lock Rate &amp; Submit Transaction"</strong> to lock a new rate.`;
  }
}

async function handleContinueToCheckout() {
  // Restore green alert styling if previously expired
  const alertBanner = document.getElementById('dashAlertBanner');
  if (alertBanner) {
    alertBanner.style.background = '';
    alertBanner.style.borderColor = '';
    alertBanner.style.color = '';
  }

  // Per User Rule:
  // "user registers ---> Get corridors for showing rates to the user ---> let the user select the bank (get Providers based on the receive country/currency) ---> Lock rates ---> submit Transaction"
  // "select bank only, then lock rate and submit Transaction ---> Mito will send a hosted page in response that will continue flow for creating beneficiary and any required info if needed."
  STATE.beneficiaryId = null;
  STATE.activeBeneficiary = null;

  const lockedOk = await lockExchangeRateAfterRateScreen();
  if (!lockedOk) return;

  await handleConfirmSummaryAndInitiatePayment({ bankOnlyFlow: true });
}

function openSenderFormForAddressChange() {
  jumpToView('register');
}

function handleBackFromBeneficiary() {
  jumpToView('dashboard');
}

// ============================================================================
// STEP 3: FULL-SCREEN SENDER INFO & MITO HOSTED KYC (`view-kyc`)
// ============================================================================
function getCandidateSenderFieldsFromDom() {
  return {
    email: (document.getElementById('senderEmailInput')?.value || STATE.sender.email || '').trim(),
    phone: (document.getElementById('senderPhoneFullInput')?.value || STATE.sender.phone || '').replace(/[^0-9]/g, '').replace(/^44/, '').trim(),
    firstName: (document.getElementById('senderFirstNameInput')?.value || STATE.sender.firstName || '').trim(),
    lastName: (document.getElementById('senderLastNameInput')?.value || STATE.sender.lastName || '').trim(),
    gender: (document.getElementById('senderGenderInput')?.value || STATE.sender.gender || 'M').trim(),
    dob: (document.getElementById('senderDobInput')?.value || STATE.sender.dob || '').trim(),
    buildingNumber: (document.getElementById('senderBuildingNumberInput')?.value || STATE.sender.buildingNumber || '23').trim(),
    address: (document.getElementById('senderAddress1Input')?.value || STATE.sender.street || STATE.sender.address || '').replace(/^23\s+/, '').trim(),
    city: (document.getElementById('senderCityInput')?.value || STATE.sender.city || '').trim(),
    postcode: (document.getElementById('senderPostcodeInput')?.value || STATE.sender.postcode || '').trim(),
    countryIso3: (document.getElementById('senderCountryInput')?.value || STATE.sender.countryIso3 || 'GBR').trim()
  };
}

function compareCandidateAgainstVerifiedSnapshot() {
  const snap = STATE.sender?.verifiedProfileSnapshot;
  if (!snap || STATE.sender?.kycStatus !== 'PASSED') {
    return { hasPassedKyc: false, hasChanged: false, changedFields: [] };
  }
  const cand = getCandidateSenderFieldsFromDom();
  const fields = [
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
  for (const f of fields) {
    const oldVal = String(snap[f.key] || '').toLowerCase().trim();
    const newVal = String(cand[f.key] || '').toLowerCase().trim();
    if (oldVal && newVal && oldVal !== newVal) {
      changedFields.push(`${f.label} ("${snap[f.key]}" → "${cand[f.key]}")`);
    }
  }
  return {
    hasPassedKyc: true,
    hasChanged: changedFields.length > 0,
    changedFields
  };
}

function checkSenderDetailsChangedLive() {
  const guardBox = document.getElementById('senderRepeatKycGuardBox');
  const nextBtn = document.getElementById('btnSubmitSenderInfoNext');
  if (!guardBox) return;

  const cmp = compareCandidateAgainstVerifiedSnapshot();
  const gbpEq = STATE.sendCurrency === 'GBP' ? STATE.sendAmount : Number((STATE.sendAmount * 0.85).toFixed(2));
  const needsExtendedUpgrade = gbpEq >= 5000 && STATE.sender.kycTier !== 'EXTENDED_KYC' && STATE.sender.kycTier !== 'MANUAL_ADMIN_KYC';
  const userIdDisplay = STATE.sender.mitoUserId || STATE.sender.userId || STATE.senderId;
  const emailDisplay = document.getElementById('senderEmailInput')?.value || STATE.sender.email;

  if (!cmp.hasPassedKyc) {
    guardBox.style.background = '#f8fafc';
    guardBox.style.borderColor = '#cbd5e1';
    guardBox.style.color = '#1e293b';
    guardBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <strong>🆕 New User Creation Check — Checked by Email ID (<code>${emailDisplay}</code>)</strong>
        <span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:700;">KYC Status: ${STATE.sender.kycStatus || 'NOT_STARTED'}</span>
      </div>
      <div style="margin-top:5px;font-size:12.5px;color:#475569;">
        At new user creation we check <code>email</code> (<code>${emailDisplay}</code>), submit full info via <code>POST /api/v1/mito/Users</code> to obtain MITO <code>userId</code>, and run first-time KYC. Once KYC passes, we will <strong>never run KYC again</strong> for this <code>userId</code> unless their address or other details change!
      </div>
    `;
    if (nextBtn) {
      nextBtn.innerHTML = `Submit Full User Info to MITO (<code>POST /api/v1/mito/Users</code>) &amp; Verify KYC &nbsp;→`;
    }
  } else if (!cmp.hasChanged && !needsExtendedUpgrade) {
    guardBox.style.background = '#dcfce7';
    guardBox.style.borderColor = '#22c55e';
    guardBox.style.color = '#14532d';
    guardBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <strong>✅ Existing Verified User — Identified by <code>userId: ${userIdDisplay}</code> (Email: <code>${emailDisplay}</code>)</strong>
        <span style="background:#16a34a;color:#fff;padding:2px 9px;border-radius:6px;font-size:11.5px;font-weight:800;">KYC PASSED (${STATE.sender.kycTier}) · NO REPEAT KYC</span>
      </div>
      <div style="margin-top:5px;font-size:12.5px;color:#166534;">
        <strong>Rule Active:</strong> Once KYC of a user passes, we do <strong>NOT</strong> do KYC again until their address or other details change. Because your verified address (<code>${STATE.sender.verifiedProfileSnapshot.buildingNumber} ${STATE.sender.verifiedProfileSnapshot.address}, ${STATE.sender.verifiedProfileSnapshot.city}, ${STATE.sender.verifiedProfileSnapshot.postcode}</code>) and personal details are <strong>unchanged</strong>, clicking below skips Step 3C (MITO KYC) and goes straight to <strong>Step 4: Beneficiary Details</strong>!
      </div>
    `;
    if (nextBtn) {
      nextBtn.innerHTML = `✅ Address &amp; Details Unchanged — Skip Repeat KYC &amp; Proceed to Beneficiary (Step 4) &nbsp;→`;
    }
  } else {
    guardBox.style.background = '#fef3c7';
    guardBox.style.borderColor = '#f59e0b';
    guardBox.style.color = '#78350f';
    const reasonText = cmp.hasChanged
      ? `Modified fields detected: <strong>${cmp.changedFields.join(' · ')}</strong>`
      : `Transfer amount (≥ £5,000 GBP) requires Extended-KYC upgrade`;
    guardBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <strong>⚠️ Address or Personal Details Changed for <code>userId: ${userIdDisplay}</code>!</strong>
        <span style="background:#d97706;color:#fff;padding:2px 9px;border-radius:6px;font-size:11.5px;font-weight:800;">RE-KYC REQUIRED</span>
      </div>
      <div style="margin-top:5px;font-size:12.5px;color:#92400e;">
        ${reasonText}.<br/>
        Per rule (<em>"once KYC of a user passes we will not do KYC again for him until his address or other details changes"</em>), clicking below will update the user in MITO and <strong>re-run MITO Sender KYC Check (Step 3C)</strong>!
      </div>
    `;
    if (nextBtn) {
      nextBtn.innerHTML = `🔄 Address/Details Changed — Update MITO User &amp; Re-Run KYC Verification &nbsp;→`;
    }
  }
}

function restoreVerifiedSenderSnapshot() {
  const snap = STATE.sender?.verifiedProfileSnapshot || {
    firstName: STATE.sender.firstName || 'Ahmed',
    lastName: STATE.sender.lastName || 'Diallo',
    dob: STATE.sender.dob || '1988-05-14',
    gender: STATE.sender.gender || 'M',
    phone: STATE.sender.phone || '7700900456',
    buildingNumber: '23',
    address: 'Holland Park',
    city: 'London',
    postcode: 'W11 3TD',
    countryIso3: 'GBR'
  };
  document.getElementById('senderFirstNameInput').value = snap.firstName;
  document.getElementById('senderLastNameInput').value = snap.lastName;
  document.getElementById('senderDobInput').value = snap.dob;
  document.getElementById('senderGenderInput').value = snap.gender;
  document.getElementById('senderPhoneFullInput').value = `+44${snap.phone}`;
  document.getElementById('senderBuildingNumberInput').value = snap.buildingNumber;
  document.getElementById('senderAddress1Input').value = snap.address;
  document.getElementById('senderCityInput').value = snap.city;
  document.getElementById('senderPostcodeInput').value = snap.postcode;
  document.getElementById('senderCountryInput').value = snap.countryIso3;
  checkSenderDetailsChangedLive();
}

function simulateSenderAddressChange() {
  document.getElementById('senderBuildingNumberInput').value = '10';
  document.getElementById('senderAddress1Input').value = 'Downing Street';
  document.getElementById('senderCityInput').value = 'London';
  document.getElementById('senderPostcodeInput').value = 'SW1A 2AA';
  checkSenderDetailsChangedLive();
}

function refreshKycCompletenessBanner() {
  const required = [
    { key: 'firstName', label: 'First Name', val: STATE.sender.firstName },
    { key: 'lastName', label: 'Last Name', val: STATE.sender.lastName },
    { key: 'dob', label: 'DOB', val: STATE.sender.dob },
    { key: 'address', label: 'Address', val: STATE.sender.address },
    { key: 'postcode', label: 'Post-code/Zip-code', val: STATE.sender.postcode }
  ];
  const missing = required.filter(r => !r.val || String(r.val).trim() === '');

  const gbpEq = STATE.sendCurrency === 'GBP' ? STATE.sendAmount : Number((STATE.sendAmount * 0.85).toFixed(2));
  const isExtended = gbpEq >= 5000;
  const tierName = isExtended ? 'Extended-KYC / Full-KYC (≥ £5,000 GBP Threshold)' : 'Mini-KYC (< £5,000 GBP)';

  const extBox = document.getElementById('extendedKycDocBox');
  if (extBox) extBox.classList.toggle('hidden', !isExtended);

  const mobTierEl = document.getElementById('mobKycTierLabel');
  if (mobTierEl) mobTierEl.textContent = isExtended ? 'EXTENDED_KYC (≥ £5,000 GBP)' : 'MINI_KYC (< £5,000 GBP)';

  const banner = document.getElementById('senderCompletenessBanner');
  if (!banner) return;

  const chipsHtml = required
    .map(r => {
      const ok = r.val && String(r.val).trim() !== '';
      return `<span style="display:inline-block;margin:2px 4px;padding:3px 9px;border-radius:6px;font-weight:700;font-size:11.5px;background:${ok ? '#dcfce7' : '#fee2e2'};color:${ok ? '#166534' : '#991b1b'};">
        ${ok ? '✓' : '✗'} ${r.label}${ok ? `: ${r.val}` : ' (Missing)'}
      </span>`;
    })
    .join('');

  const identityLabel = STATE.sender.isSubmittedToMito
    ? `Identified by <code>userId: ${STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId}</code> (Email: <code>${STATE.sender.email}</code>)`
    : `New User Creation Check by <code>email: ${STATE.sender.email}</code>`;

  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
      <strong>MITO Sender Check — ${identityLabel}:</strong>
      <span style="font-weight:800;color:${isExtended ? '#b45309' : '#25610f'};">Required Tier: ${tierName} · Current KYC Status: <code>${STATE.sender.kycStatus}</code></span>
    </div>
    <div>${chipsHtml}</div>
    <div style="margin-top:6px;font-size:12px;color:#57534e;">
      ${
        missing.length > 0
          ? `⚠️ MITO is missing <strong>${missing.map(m => m.label).join(', ')}</strong>. Collect remaining sender info below and execute <strong>${tierName}</strong>.`
          : STATE.sender.kycStatus === 'PASSED'
          ? `✅ KYC already <strong>PASSED (${STATE.sender.kycTier})</strong> for <code>userId: ${STATE.sender.userId || STATE.sender.mitoUserId}</code>! We will <strong>NOT</strong> run KYC again unless you change the address or other details.`
          : `✅ MITO has all 5 mandatory Sender fields (First Name, Last Name, DOB, Address, Postcode). Ready for <strong>${tierName}</strong> verification.`
      }
    </div>
  `;
  checkSenderDetailsChangedLive();
}

function switchSenderKycSubTab(tabName) {
  const tabs = ['profile', 'address', 'mito_verify'];
  tabs.forEach(t => {
    const el = document.getElementById(`kycSubTab-${t}`);
    if (el) el.classList.toggle('hidden', t !== tabName);
  });

  // Update New User Step 3 circle stepper visuals (Circle 1: MITO User Data -> Circle 2: Pass MITO KYC)
  const c2 = document.getElementById('kycStepCircle2');
  const c3 = document.getElementById('kycStepCircle3');
  const l2 = document.getElementById('kycStepperLine2');

  if (tabName === 'address' || tabName === 'profile') {
    if (c2) {
      c2.className = 'stepper-item active';
      c2.querySelector('.step-circle').textContent = '1';
    }
    if (c3) {
      c3.className = 'stepper-item';
      c3.querySelector('.step-circle').textContent = '2';
    }
    if (l2) l2.classList.remove('done');
  } else {
    if (c2) {
      c2.className = 'stepper-item done';
      c2.querySelector('.step-circle').textContent = '✓';
    }
    if (c3) {
      c3.className = 'stepper-item active';
      c3.querySelector('.step-circle').textContent = '2';
    }
    if (l2) l2.classList.add('done');
  }

  refreshKycCompletenessBanner();
}

function toggleProfileMode(mode) {
  document.getElementById('segBtnSelectedProfile').classList.toggle('active', mode === 'selected');
  document.getElementById('segBtnCreateProfile').classList.toggle('active', mode === 'create');
  if (mode === 'create') {
    document.getElementById('linkedProfileEditForm').classList.remove('hidden');
  }
}

function toggleLinkedProfileEdit() {
  const form = document.getElementById('linkedProfileEditForm');
  const chevron = document.getElementById('linkedExpandChevron');
  const isHidden = form.classList.toggle('hidden');
  chevron.textContent = isHidden ? '⌄' : '⌃';
}

function saveLinkedProfileChanges() {
  const legal = document.getElementById('profLegalName').value.trim() || 'David Beckham';
  const screen = document.getElementById('profScreenName').value.trim() || 'David';
  const dial = document.getElementById('profDialCode').value || '+44';
  const phone = document.getElementById('profPhone').value.trim() || '7553039222';

  const parts = legal.split(/\s+/);
  STATE.sender.firstName = parts[0] || 'David';
  STATE.sender.lastName = parts.slice(1).join(' ') || 'Beckham';
  STATE.sender.screenName = screen;
  STATE.sender.phoneDialCode = dial;
  STATE.sender.phone = phone;

  document.getElementById('linkedDisplayScreenName').textContent = screen;
  document.getElementById('linkedDisplayLegalName').textContent = legal;
  document.getElementById('linkedDisplayPhone').textContent = `${dial} ${phone}`;
  document.getElementById('senderFirstNameInput').value = STATE.sender.firstName;
  document.getElementById('senderLastNameInput').value = STATE.sender.lastName;
  document.getElementById('senderPhoneFullInput').value = `${dial}${phone}`;

  document.getElementById('linkedProfileEditForm').classList.add('hidden');
  document.getElementById('linkedExpandChevron').textContent = '⌄';
  refreshKycCompletenessBanner();
}

async function saveSenderAddressAndOpenMitoKyc() {
  const email = document.getElementById('senderEmailInput').value.trim() || STATE.sender.email || 'mohammadmumtazkhan+24@example.com';
  const phoneEl = document.getElementById('senderPhoneFullInput');
  const phoneNumber = (phoneEl && phoneEl.value.trim()) || `${STATE.sender.phoneDialCode || '+44'}${STATE.sender.phone || '7553039222'}`;
  const firstName = document.getElementById('senderFirstNameInput').value.trim() || 'David';
  const middleEl = document.getElementById('senderMiddleNameInput');
  const middleName = (middleEl && middleEl.value.trim()) || '';
  const lastName = document.getElementById('senderLastNameInput').value.trim() || 'Beckham';
  const genderEl = document.getElementById('senderGenderInput');
  const gender = (genderEl && genderEl.value) || 'M';
  const entityEl = document.getElementById('senderEntityTypeInput');
  const legalEntityType = (entityEl && entityEl.value) || 'I';
  const compNoEl = document.getElementById('senderCompanyNumberInput');
  const busNameEl = document.getElementById('senderBusinessNameInput');
  const companyNumber = legalEntityType === 'B' && compNoEl ? compNoEl.value.trim() : null;
  const businessName = legalEntityType === 'B' && busNameEl ? busNameEl.value.trim() : null;
  const dateOfBirth = document.getElementById('senderDobInput').value.trim() || '1975-05-02';
  const bldgNoEl = document.getElementById('senderBuildingNumberInput');
  const buildingNumber = (bldgNoEl && bldgNoEl.value.trim()) || '23';
  const subStreet = document.getElementById('senderAddress2Input').value.trim() || '';
  const street = document.getElementById('senderAddress1Input').value.trim() || 'Holland Park';
  const addressCity = document.getElementById('senderCityInput').value.trim() || 'London';
  const addressPostcode = document.getElementById('senderPostcodeInput').value.trim() || 'W11 3TD';
  const countryIso3 = document.getElementById('senderCountryInput').value || 'GBR';
  const birthCountryEl = document.getElementById('senderBirthCountryInput');
  const birthCountryIso3 = (birthCountryEl && birthCountryEl.value) || 'GBR';

  // Submit or verify the user via POST /api/v1/mito/Users
  // Backend checks `email` (at creation) and `userId` (after creation) + compares against `verifiedProfileSnapshot`!
  const createUserRes = await callApi('POST', '/api/v1/mito/Users', {
    userId: STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId,
    senderId: STATE.senderId,
    olowoAccountId: STATE.sender.olowoAccountId || STATE.senderId,
    countryIso3,
    email,
    phoneNumber,
    firstName,
    middleName,
    lastName,
    gender,
    legalEntityType,
    companyNumber,
    businessName,
    dateOfBirth,
    buildingNumber,
    buildingName: '',
    subStreet,
    street,
    addressCity,
    addressPostcode,
    addressCountryIso3: countryIso3,
    birthCountryIso3
  });

  if (createUserRes.ok && createUserRes.data && createUserRes.data.data) {
    STATE.sender = {
      ...STATE.sender,
      ...createUserRes.data.data
    };
    STATE.senderId = createUserRes.data.data.userId || createUserRes.data.data.mitoUserId || createUserRes.data.data.senderId;
    refreshDashboardHeader();

    const statusBadge = document.getElementById('mitoCreateUserStatusBadge');
    if (statusBadge) {
      statusBadge.innerHTML = createUserRes.data.kycSkippedBecauseUnchanged
        ? `✅ Verified <code>userId: ${STATE.senderId}</code> — Address &amp; Details Unchanged (Repeat KYC Skipped!)`
        : `✅ Submitted to MITO Staging! Saved <code>userId: ${STATE.senderId}</code>`;
    }

    const gbpEq = STATE.sendCurrency === 'GBP' ? STATE.sendAmount : Number((STATE.sendAmount * 0.85).toFixed(2));
    const needsExtendedUpgrade = gbpEq >= 5000 && STATE.sender.kycTier !== 'EXTENDED_KYC' && STATE.sender.kycTier !== 'MANUAL_ADMIN_KYC';

    // USER RULE: "once KYC of a user passes we will not do KYC again for him until his address or other details changes"
    if (createUserRes.data.kycSkippedBecauseUnchanged && !needsExtendedUpgrade) {
      const skipBanner = document.getElementById('kycSkippedNoticeBanner');
      if (skipBanner) {
        skipBanner.classList.remove('hidden');
        skipBanner.innerHTML =
          `✅ <strong>Repeat KYC Skipped for <code>userId: ${STATE.senderId}</code> (Email: <code>${STATE.sender.email}</code>)!</strong> ` +
          `Because this user's KYC already <strong>PASSED (${STATE.sender.kycTier})</strong> and their address (<code>${buildingNumber} ${street}, ${addressCity}, ${addressPostcode}</code>) and personal details have <strong>not changed</strong>, Step 3C (MITO Sender KYC Check) was skipped automatically.`;
      }
      jumpToView('beneficiary');
      return;
    }
  }

  const skipBanner = document.getElementById('kycSkippedNoticeBanner');
  if (skipBanner) skipBanner.classList.add('hidden');

  switchSenderKycSubTab('mito_verify');
  await executeMitoKycNow();
}

function setSimulatedKycOutcome(outcome) {
  STATE.simulatedKycOutcome = outcome;
  document.getElementById('btnSimKycPassed').className = 'branch-pill' + (outcome === 'PASSED' ? ' active-pass' : '');
  document.getElementById('btnSimKycReview').className = 'branch-pill' + (outcome === 'UNDER_REVIEW' ? ' active-review' : '');
  document.getElementById('btnSimKycFailed').className = 'branch-pill' + (outcome === 'FAILED' ? ' active-fail' : '');

  // If QR already scanned, re-run executeMitoKycNow so user immediately sees the outcome branch!
  if (!document.getElementById('mitoKycQrScannedBox').classList.contains('hidden')) {
    executeMitoKycNow();
  }
}

function simulateMobileKycQrScan() {
  document.getElementById('mitoKycQrPendingBox').classList.add('hidden');
  document.getElementById('mitoKycQrScannedBox').classList.remove('hidden');
  executeMitoKycNow();
}

function resetKycQrScan() {
  document.getElementById('mitoKycQrPendingBox').classList.remove('hidden');
  document.getElementById('mitoKycQrScannedBox').classList.add('hidden');
}

async function executeMitoKycNow() {
  const payload = {
    senderId: STATE.senderId,
    firstName: document.getElementById('senderFirstNameInput').value.trim() || STATE.sender.firstName || 'David',
    lastName: document.getElementById('senderLastNameInput').value.trim() || STATE.sender.lastName || 'Beckham',
    dob: document.getElementById('senderDobInput').value.trim() || STATE.sender.dob || '1975-05-02',
    address: document.getElementById('senderAddress1Input').value.trim() || STATE.sender.address || '23 Holland Park',
    city: document.getElementById('senderCityInput').value.trim() || STATE.sender.city || 'London',
    postcode: document.getElementById('senderPostcodeInput').value.trim() || STATE.sender.postcode || 'W11 3TD',
    sendAmount: STATE.sendAmount,
    sendCurrency: STATE.sendCurrency,
    simulatedOutcome: STATE.simulatedKycOutcome,
    idDocumentType: document.getElementById('senderIdDocType').value || 'PASSPORT',
    idDocumentNumber: document.getElementById('senderIdDocNumber').value || 'GBR-99281726'
  };

  const { ok, data } = await callApi('POST', '/api/v1/mito/Kyc/ExecuteSenderKyc', payload);
  if (!ok || !data.data) return;

  const resData = data.data;
  STATE.sender = { ...STATE.sender, ...resData.sender };
  refreshKycCompletenessBanner();

  const progBar = document.getElementById('mitoKycProgressBar');
  const mobResultHeader = document.getElementById('mobResultHeader');
  const mobResultBody = document.getElementById('mobResultBody');
  const evalBox = document.getElementById('kycEvaluationResultBox');
  const btnProceed = document.getElementById('btnProceedToBeneficiary');
  const btnProceedTop = document.getElementById('btnProceedToBeneficiaryTop');

  evalBox.classList.remove('hidden');
  evalBox.className = `kyc-eval-result-box ${resData.kycStatus}`;

  if (resData.kycStatus === 'PASSED') {
    progBar.style.width = '100%';
    mobResultHeader.textContent = 'Verification complete';
    mobResultBody.innerHTML = `
      <div style="width:52px;height:52px;border-radius:50%;border:3px solid #4f46e5;color:#4f46e5;font-size:26px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px;">✓</div>
      <span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;margin-bottom:6px;">Successful</span>
      <h4>Successfully verified</h4>
      <p>Your details were verified successfully (${resData.executedKycTier}). Continuing...</p>
      <button type="button" class="mob-btn-orange full-w mt-12" style="background:#4f46e5;" onclick="proceedFromKycToBeneficiary()">Finish &amp; Proceed to Beneficiary Details →</button>
    `;
    evalBox.innerHTML = `
      <strong>✅ ${resData.executedKycTier} Passed!</strong>
      <p style="margin-top:4px;font-size:13px;">${data.message}</p>
    `;
    if (btnProceed) btnProceed.disabled = false;
    if (btnProceedTop) btnProceedTop.disabled = false;
  } else if (resData.kycStatus === 'UNDER_REVIEW') {
    progBar.style.width = '78%';
    mobResultHeader.textContent = 'Verification Under Review';
    mobResultBody.innerHTML = `
      <div style="width:52px;height:52px;border-radius:50%;border:3px solid #d97706;color:#d97706;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px;">⏳</div>
      <span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;margin-bottom:6px;">Under Review</span>
      <h4>KYC Under Review</h4>
      <p>Per flow rules, when KYC is Under Review you are allowed to proceed to Beneficiary creation.</p>
      <button type="button" class="mob-btn-orange full-w mt-12" onclick="proceedFromKycToBeneficiary()">Proceed to Beneficiary Details →</button>
    `;
    evalBox.innerHTML = `
      <strong>⏳ ${resData.executedKycTier} is Under Review — User Allowed to Proceed!</strong>
      <p style="margin-top:4px;font-size:13px;">${data.message}</p>
    `;
    if (btnProceed) btnProceed.disabled = false;
    if (btnProceedTop) btnProceedTop.disabled = false;
  } else {
    progBar.style.width = '100%';
    mobResultHeader.textContent = 'Verification Failed';
    mobResultBody.innerHTML = `
      <div style="width:52px;height:52px;border-radius:50%;border:3px solid #dc2626;color:#dc2626;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:10px;">✕</div>
      <span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;margin-bottom:6px;">Failed</span>
      <h4>Verification could not be completed</h4>
      <p>Please contact the Admin for Initiating Manual KYC with the help of the MITO system.</p>
    `;
    evalBox.innerHTML = `
      <strong>❌ ${resData.executedKycTier} FAILED — Progression Blocked!</strong>
      <p style="margin-top:4px;font-size:13px;">${data.message}</p>
      <div style="margin-top:10px;">
        <button type="button" class="olowo-btn-brown" onclick="handleInitiateAdminManualKyc()">
          🛠️ Contact Admin: Initiate Manual KYC via MITO System
        </button>
      </div>
    `;
    if (btnProceed) btnProceed.disabled = true;
    if (btnProceedTop) btnProceedTop.disabled = true;
  }
}

async function handleInitiateAdminManualKyc() {
  const { ok, data } = await callApi('POST', '/api/v1/mito/Kyc/InitiateManualAdminKyc', {
    senderId: STATE.senderId,
    adminNotes: 'Manual KYC verified by Admin with the help of MITO system',
    resolutionStatus: 'PASSED'
  });
  if (ok && data.data) {
    STATE.sender = { ...STATE.sender, ...data.data.sender };
    STATE.simulatedKycOutcome = 'PASSED';
    setSimulatedKycOutcome('PASSED');
  }
}

async function proceedFromKycToBeneficiary() {
  // If KYC hasn't been executed yet, execute it first with current form fields
  if (STATE.sender.kycStatus === 'NOT_STARTED') {
    await executeMitoKycNow();
  }
  if (STATE.sender.kycStatus === 'FAILED') {
    return;
  }
  STATE.forceAllowKycEdit = false;
  updateTopFlowBarForUserState();
  jumpToView('beneficiary');
}

// ============================================================================
// STEP 4: FULL-SCREEN BENEFICIARY CREATION & DOWNWARD SEARCHABLE DROPLISTS
// ============================================================================
async function loadStep4BeneficiaryMetadata() {
  document.getElementById('benCorridorBadge').textContent =
    `${STATE.sendCurrency} → ${STATE.receiveCurrency} · ${STATE.collectionMode}`;
  document.getElementById('benReqCountryLabel').textContent = STATE.receiveCountryIso3;
  document.getElementById('benProviderModeLabel').textContent = STATE.collectionMode;

  // 4A. GET Beneficiary Requirements for Receive Country
  const reqRes = await callApi(
    'GET',
    `/api/v1/mito/Beneficiary/requirements?receiveCountryIso3=${encodeURIComponent(STATE.receiveCountryIso3)}&collectionMode=${encodeURIComponent(STATE.collectionMode)}`
  );
  if (reqRes.ok && reqRes.data.data) {
    STATE.mandatoryFields = reqRes.data.data.mandatoryFields || [];
    renderExtraCountryBeneficiaryFields();
  }

  // 4B. GET Providers / Banks / Mobile Networks (serviceCode=MONEYTRANSFER & collectionMode=BANKACCOUNT|MOBILEMONEY)
  const provRes = await callApi(
    'GET',
    `/api/v1/mito/Providers?receiveCountryIso3=${encodeURIComponent(STATE.receiveCountryIso3)}&serviceCode=MONEYTRANSFER&collectionMode=${encodeURIComponent(STATE.collectionMode)}`
  );
  if (provRes.ok && provRes.data.data) {
    STATE.providers = provRes.data.data;
    populateDownwardDroplist('provider', STATE.providers, STATE.providers[0]);
  }

  // 4C. GET Lookups/types (sourceOfFunds, reason, relationships)
  const typesRes = await callApi('GET', '/api/v1/mito/Lookups/types');
  if (typesRes.ok && typesRes.data.data) {
    STATE.reasons = typesRes.data.data.reasons || typesRes.data.data.reason || [];
    STATE.sourceOfFunds = typesRes.data.data.sourceOfFunds || [];
    STATE.relationships = typesRes.data.data.relationships || [];

    const defaultRel = STATE.relationships.find(r => r.code === 'FAMILY') || STATE.relationships[0];
    const defaultReason = STATE.reasons.find(r => r.code === 'FOROWNEXPENDITURES') || STATE.reasons[0];
    const defaultSof = STATE.sourceOfFunds.find(s => s.code === 'SALARY') || STATE.sourceOfFunds[0];

    populateDownwardDroplist('relationship', STATE.relationships, defaultRel);
    populateDownwardDroplist('reason', STATE.reasons, defaultReason);
    populateDownwardDroplist('sof', STATE.sourceOfFunds, defaultSof);
  }

  // Load Saved Beneficiaries for this Sender ID
  await refreshSavedBeneficiariesList();

  // Adapt Step 4 Beneficiary header & stepper for Flow 1 (New User) vs Flow 2 (Existing User)
  const isExistingFlow = STATE.flowMode === 'EXISTING_USER';
  const topBadge = document.getElementById('benTopStepBadge');
  const cardTitle = document.getElementById('benCardTitle');
  const kycLine = document.getElementById('benStepKycLine');
  const kycCircle = document.getElementById('benStepKycCircle');
  const activeNum = document.getElementById('benStepActiveNum');
  const activeLabel = document.getElementById('benStepActiveLabel');
  const nextNum = document.getElementById('benStepNextNum');

  if (isExistingFlow) {
    if (topBadge) topBadge.textContent = 'Flow 2 (Existing User) · Step 3: Select Saved Beneficiary';
    if (cardTitle) cardTitle.textContent = 'Select Saved Beneficiary & Make Payment';
    if (kycLine) kycLine.classList.add('hidden');
    if (kycCircle) kycCircle.classList.add('hidden');
    if (activeNum) activeNum.textContent = '2';
    if (activeLabel) activeLabel.innerHTML = 'Select<br/>Beneficiary';
    if (nextNum) nextNum.textContent = '3';
  } else {
    if (topBadge) topBadge.textContent = 'Flow 1 (New User) · Step 4: Add Beneficiary Details';
    if (cardTitle) cardTitle.textContent = 'Add details — New Beneficiary Details';
    if (kycLine) kycLine.classList.remove('hidden');
    if (kycCircle) kycCircle.classList.remove('hidden');
    if (activeNum) activeNum.textContent = '3';
    if (activeLabel) activeLabel.innerHTML = 'Add<br/>Beneficiary';
    if (nextNum) nextNum.textContent = '4';
  }

  // USER RULE: "Forms will only show for new user/beneficiary only"
  // If sender already has saved beneficiaries, show Saved Beneficiaries list by default (hide the New Beneficiary form unless they click "Create new beneficiary +")!
  if (STATE.savedBeneficiaries && STATE.savedBeneficiaries.length > 0) {
    switchBeneficiaryMode('saved');
  } else {
    switchBeneficiaryMode('create');
  }
}

function renderExtraCountryBeneficiaryFields() {
  const extraBox = document.getElementById('benExtraCountryFields');
  if (!extraBox) return;

  const needsIban = STATE.mandatoryFields.some(f => f.name === 'iban');
  if (needsIban) {
    extraBox.classList.remove('hidden');
    extraBox.innerHTML = `
      <div class="olowo-field">
        <label>IBAN / Account Number (${STATE.receiveCountryName}) <span class="req-star">*</span></label>
        <input type="text" id="benIbanInput" class="olowo-input" value="SN08SN01201001001831688801" />
      </div>
      <div class="olowo-field">
        <label>SWIFT / BIC Code <span class="req-star">*</span></label>
        <input type="text" id="benSwiftInput" class="olowo-input" value="CBAOSNDAXXX" />
      </div>
    `;
  } else {
    extraBox.classList.add('hidden');
    extraBox.innerHTML = '';
  }
}

// ============================================================================
// CUSTOM SEARCHABLE DROPLIST ENGINE (ALWAYS OPENS DOWNWARDS!)
// ============================================================================
function populateDownwardDroplist(key, items, defaultItem, allowUnselected = false) {
  if (allowUnselected && !defaultItem) {
    STATE.selectedDroplists[key] = null;
    const labelEl = document.getElementById(`droplistSelected-${key}`);
    if (labelEl) {
      labelEl.textContent = `-- Select Beneficiary Bank / Provider (${items.length} available) --`;
      labelEl.style.color = '#64748b';
    }
    renderDroplistOptions(key, items, '');
    return;
  }
  STATE.selectedDroplists[key] = defaultItem || items[0] || null;
  const labelEl = document.getElementById(`droplistSelected-${key}`);
  if (labelEl && STATE.selectedDroplists[key]) {
    labelEl.textContent = STATE.selectedDroplists[key].name;
    labelEl.style.color = '';
  }
  renderDroplistOptions(key, items, '');
}

function renderDroplistOptions(key, items, query) {
  const ul = document.getElementById(`droplistOptions-${key}`);
  if (!ul) return;

  const q = String(query || '').toLowerCase().trim();
  const filtered = items.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      (item.code && item.code.toLowerCase().includes(q))
  );

  if (filtered.length === 0) {
    ul.innerHTML = `<li style="color:#9ca3af;cursor:default;">No matching options for "${query}"</li>`;
    return;
  }

  const currentId = STATE.selectedDroplists[key] ? STATE.selectedDroplists[key].id : null;
  ul.innerHTML = filtered
    .map(
      item => `
      <li class="${item.id === currentId ? 'selected' : ''}" onclick="selectDownwardDroplistItem('${key}', '${item.id}')">
        <span>${item.name}</span>
        ${item.code ? `<span class="mono-pill">${item.code}</span>` : ''}
      </li>
    `
    )
    .join('');
}

function toggleDownwardDroplist(key) {
  const keys = ['dashProvider', 'dashSof', 'dashReason', 'provider', 'relationship', 'reason', 'sof'];
  keys.forEach(k => {
    const wrap = document.getElementById(`droplist-${k}`);
    if (!wrap) return;
    if (k === key) {
      const isNowOpen = wrap.classList.toggle('open');
      if (isNowOpen) {
        const searchInput = document.getElementById(`droplistSearch-${k}`);
        if (searchInput) {
          searchInput.value = '';
          filterDownwardDroplist(k, '');
          setTimeout(() => searchInput.focus(), 30);
        }
      }
    } else {
      wrap.classList.remove('open');
    }
  });
}

function filterDownwardDroplist(key, query) {
  const map = {
    dashProvider: STATE.providers,
    dashSof: STATE.sourceOfFunds,
    dashReason: STATE.reasons,
    provider: STATE.providers,
    relationship: STATE.relationships,
    reason: STATE.reasons,
    sof: STATE.sourceOfFunds
  };
  renderDroplistOptions(key, map[key] || [], query);
}

function selectDownwardDroplistItem(key, itemId) {
  const map = {
    dashProvider: STATE.providers,
    dashSof: STATE.sourceOfFunds,
    dashReason: STATE.reasons,
    provider: STATE.providers,
    relationship: STATE.relationships,
    reason: STATE.reasons,
    sof: STATE.sourceOfFunds
  };
  const found = (map[key] || []).find(i => i.id === itemId);
  if (found) {
    STATE.selectedDroplists[key] = found;
    const labelEl = document.getElementById(`droplistSelected-${key}`);
    if (labelEl) {
      labelEl.textContent = found.name;
      labelEl.style.color = '';
    }

    if (key === 'dashProvider') {
      STATE.selectedDroplists.provider = found;
      const benLabel = document.getElementById('droplistSelected-provider');
      if (benLabel) {
        benLabel.textContent = found.name;
        benLabel.style.color = '';
      }
      const noteBankEl = document.getElementById('noteSelectedBank');
      if (noteBankEl) noteBankEl.textContent = found.name;
      const rlwProvEl = document.getElementById('rlwProviderVal');
      if (rlwProvEl) rlwProvEl.textContent = found.name;
      // Restore green alert banner if previously warning about unselected bank
      const alertBanner = document.getElementById('dashAlertBanner');
      if (alertBanner) {
        alertBanner.style.background = '';
        alertBanner.style.borderColor = '';
        alertBanner.style.color = '';
      }
      // Automatically lock rate for the user's newly selected bank!
      lockExchangeRateAfterRateScreen();
    } else if (key === 'provider') {
      STATE.selectedDroplists.dashProvider = found;
      const dashLabel = document.getElementById('droplistSelected-dashProvider');
      if (dashLabel) {
        dashLabel.textContent = found.name;
        dashLabel.style.color = '';
      }
      const noteBankEl = document.getElementById('noteSelectedBank');
      if (noteBankEl) noteBankEl.textContent = found.name;
      const rlwProvEl = document.getElementById('rlwProviderVal');
      if (rlwProvEl) rlwProvEl.textContent = found.name;
    } else if (key === 'dashSof') {
      STATE.selectedDroplists.sof = found;
    } else if (key === 'dashReason') {
      STATE.selectedDroplists.reason = found;
    }

    if (STATE.savedBeneficiaries && STATE.savedBeneficiaries.length > 0 && (key === 'sof' || key === 'reason' || key === 'relationship')) {
      renderSavedBeneficiariesCards();
    }
  }
  const wrap = document.getElementById(`droplist-${key}`);
  if (wrap) wrap.classList.remove('open');
}

// Close downward droplists when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.downward-droplist')) {
    document.querySelectorAll('.downward-droplist.open').forEach(el => el.classList.remove('open'));
  }
});

function toggleUploadDemo(type) {
  if (type === 'doc') {
    const box = document.getElementById('uploadDocBox');
    const attached = box.classList.toggle('attached');
    document.getElementById('uploadDocTitle').textContent = attached ? '✓ Invoice_TopupNigeria_2026.pdf' : 'Upload documents';
    document.getElementById('uploadDocSub').textContent = attached ? 'Attached (248 KB) · Click to remove' : 'Invoice, purchase order, etc.';
  } else {
    const box = document.getElementById('uploadPhotoBox');
    const attached = box.classList.toggle('attached');
    document.getElementById('uploadPhotoTitle').textContent = attached ? '✓ Receipt_Photo_01.jpg' : 'Add photos';
    document.getElementById('uploadPhotoSub').textContent = attached ? 'Attached (412 KB) · Click to remove' : 'Product images, receipts, etc.';
  }
}

function switchBeneficiaryMode(mode) {
  document.getElementById('segBenCreateNew').classList.toggle('active', mode === 'create');
  document.getElementById('segBenSelectSaved').classList.toggle('active', mode === 'saved');
  document.getElementById('createBeneficiaryPanel').classList.toggle('hidden', mode !== 'create');
  const footerPanel = document.getElementById('createBeneficiaryFooterPanel');
  if (footerPanel) footerPanel.classList.toggle('hidden', mode !== 'create');
  document.getElementById('savedBeneficiariesPanel').classList.toggle('hidden', mode !== 'saved');
}

async function refreshSavedBeneficiariesList() {
  const res = await callApi('GET', `/api/v1/mito/Beneficiary?senderId=${encodeURIComponent(STATE.senderId)}`);
  if (res.ok && res.data.data) {
    STATE.savedBeneficiaries = res.data.data;
    document.getElementById('savedBeneficiariesCount').textContent = String(STATE.savedBeneficiaries.length);
    renderSavedBeneficiariesCards();
  }
}

function renderSavedBeneficiariesCards() {
  const listEl = document.getElementById('savedBeneficiariesList');
  if (!listEl) return;
  if (!STATE.savedBeneficiaries || STATE.savedBeneficiaries.length === 0) {
    listEl.innerHTML = `<div class="no-transfers-empty">No saved beneficiaries mapped to <code>${STATE.senderId}</code> yet. Create one in the tab above!</div>`;
    return;
  }

  const activeSof = STATE.selectedDroplists.sof;
  const activeReason = STATE.selectedDroplists.reason;
  const activeRel = STATE.selectedDroplists.relationship;

  listEl.innerHTML = STATE.savedBeneficiaries
    .map(b => {
      const sofObj = activeSof || b.sourceOfFunds || { name: 'Salary', code: 'SALARY' };
      const reasonObj = activeReason || b.reason || { name: 'For Own Expenditures', code: 'FOROWNEXPENDITURES' };
      const relObj = activeRel || b.relationship || { name: 'Family', code: 'FAMILY' };
      return `
        <div class="saved-ben-card">
          <div>
            <strong>${b.fields.firstName || ''} ${b.fields.lastName || ''}</strong>
            <span class="mono-pill">${b.beneficiaryId}</span>
            <div style="font-size:12.5px;color:#57534e;margin-top:4px;">
              ${b.providerName} · ${b.collectionMode} · Account: •••• ${String(b.fields.accountNumber || b.fields.iban || '6889').slice(-4)}
            </div>
            <div style="font-size:11.5px;color:#15803d;font-weight:600;margin-top:3px;">
              SOF: ${sofObj.name} (<code>${sofObj.code || sofObj.id}</code>) · Reason: ${reasonObj.name} (<code>${reasonObj.code || reasonObj.id}</code>) · Relationship: ${relObj.name}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="olowo-btn-outline-green sm" onclick="selectExistingSavedBeneficiary('${b.beneficiaryId}', false)">
              Review Summary
            </button>
            <button type="button" class="olowo-btn-green" onclick="selectExistingSavedBeneficiary('${b.beneficiaryId}', true)">
              Select Beneficiary &amp; Make Payment →
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function selectExistingSavedBeneficiary(beneficiaryId, goDirectToPayment = true) {
  const found = STATE.savedBeneficiaries.find(b => b.beneficiaryId === beneficiaryId);
  if (found) {
    // Apply the user's form-selected Source of Funds, Transfer Reason, and Relationship
    if (STATE.selectedDroplists.sof) found.sourceOfFunds = STATE.selectedDroplists.sof;
    if (STATE.selectedDroplists.reason) found.reason = STATE.selectedDroplists.reason;
    if (STATE.selectedDroplists.relationship) found.relationship = STATE.selectedDroplists.relationship;
    STATE.beneficiaryId = found.beneficiaryId;
    STATE.activeBeneficiary = found;
    populateSummaryView();
    if (goDirectToPayment) {
      await handleConfirmSummaryAndInitiatePayment();
    } else {
      jumpToView('summary');
    }
  }
}

// POST to MITO for Creating a Beneficiary -> Save Beneficiary ID Mapped to Sender ID -> Make Payment
async function handleCreateAndSaveBeneficiary(goDirectToPayment = true) {
  const fullName = document.getElementById('benFullName').value.trim() || 'Topupnigeria.com nig Ltd';
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || 'Topupnigeria.com';
  const lastName = parts.slice(1).join(' ') || 'nig Ltd';
  const accountNumber = document.getElementById('benAccountNumber').value.trim() || '1018316888';
  const phone = document.getElementById('benPhone').value.trim() || '+234 803 123 4567';
  const email = document.getElementById('benEmail').value.trim() || '';
  const ibanEl = document.getElementById('benIbanInput');
  const swiftEl = document.getElementById('benSwiftInput');

  const payload = {
    senderId: STATE.senderId,
    receiveCountryIso3: STATE.receiveCountryIso3,
    serviceCode: 'MONEYTRANSFER',
    collectionMode: STATE.collectionMode,
    providerId: STATE.selectedDroplists.provider ? STATE.selectedDroplists.provider.id : (STATE.providers[0] && STATE.providers[0].id),
    reasonId: STATE.selectedDroplists.reason ? STATE.selectedDroplists.reason.id : (STATE.reasons[0] && STATE.reasons[0].id),
    sourceOfFundsId: STATE.selectedDroplists.sof ? STATE.selectedDroplists.sof.id : (STATE.sourceOfFunds[0] && STATE.sourceOfFunds[0].id),
    relationshipId: STATE.selectedDroplists.relationship ? STATE.selectedDroplists.relationship.id : (STATE.relationships[0] && STATE.relationships[0].id),
    fields: {
      firstName,
      lastName,
      fullName,
      accountNumber,
      phone,
      email,
      iban: ibanEl ? ibanEl.value.trim() : accountNumber,
      swiftBic: swiftEl ? swiftEl.value.trim() : 'UBAINGLAXXX'
    }
  };

  const { ok, data } = await callApi('POST', '/api/v1/mito/Beneficiary', payload);
  if (ok && data.data) {
    STATE.beneficiaryId = data.data.beneficiaryId;
    STATE.activeBeneficiary = data.data;
    await refreshSavedBeneficiariesList();
    populateSummaryView();
    if (goDirectToPayment) {
      await handleConfirmSummaryAndInitiatePayment();
    } else {
      jumpToView('summary');
    }
  }
}

// ============================================================================
// STEP 5: FULL-SCREEN SUMMARY VIEW (`view-summary`)
// ============================================================================
function populateSummaryView() {
  const ben = STATE.activeBeneficiary || {
    beneficiaryId: 'BNF-PENDING',
    providerName: STATE.selectedDroplists.provider ? STATE.selectedDroplists.provider.name : 'United Bank for Africa Plc (UBA)',
    fields: {
      fullName: document.getElementById('benFullName').value || 'Topupnigeria.com nig Ltd',
      accountNumber: document.getElementById('benAccountNumber').value || '1018316888'
    },
    relationship: STATE.selectedDroplists.relationship || { name: 'Business Partner / Vendor' },
    reason: STATE.selectedDroplists.reason || { name: 'Investment / Business Capital' },
    sourceOfFunds: STATE.selectedDroplists.sof || { name: 'Employment Salary / Wages' }
  };

  document.getElementById('sumBeneficiaryBadge').textContent = ben.beneficiaryId;
  document.getElementById('sumYouSend').textContent =
    `${STATE.sendCurrency} ${Number(STATE.sendAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('sumTheyReceive').textContent =
    `${STATE.receiveCurrency} ${Number(STATE.receiveAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sendSym = STATE.sendCurrency === 'GBP' ? '£' : '€';
  const recSym = STATE.receiveCurrency === 'NGN' ? '₦' : STATE.receiveCurrency + ' ';
  document.getElementById('sumExchangeRate').textContent =
    `${sendSym}1.00 to ${recSym}${Number(STATE.customerRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · estimated`;
  document.getElementById('sumCollectionMode').textContent = STATE.collectionMode;

  document.getElementById('sumSenderName').textContent = `${STATE.sender.firstName} ${STATE.sender.lastName}`;
  document.getElementById('sumSenderId').textContent = STATE.senderId;
  document.getElementById('sumSenderKyc').textContent = `${STATE.sender.kycStatus} (${STATE.sender.kycTier || 'MINI_KYC'})`;
  document.getElementById('sumSenderEmail').textContent = STATE.sender.email;
  document.getElementById('sumSenderPhone').textContent = `${STATE.sender.phoneDialCode || '+44'} ${STATE.sender.phone}`;
  document.getElementById('sumSenderAddress').textContent =
    `${STATE.sender.address || '23 Holland Park'}, ${STATE.sender.city || 'London'}, ${STATE.sender.postcode || 'W11 3TD'}, United Kingdom`;

  const accStr = String((ben.fields && (ben.fields.accountNumber || ben.fields.iban)) || '1018316888');
  document.getElementById('sumBenName').textContent =
    (ben.fields && (ben.fields.fullName || `${ben.fields.firstName || ''} ${ben.fields.lastName || ''}`.trim())) || 'Topupnigeria.com nig Ltd';
  document.getElementById('sumBenId').textContent = ben.beneficiaryId;
  document.getElementById('sumBenBank').textContent = ben.providerName;
  document.getElementById('sumBenAccount').textContent = `•••• ${accStr.slice(-4)}`;
  document.getElementById('sumBenRelationship').textContent = ben.relationship ? ben.relationship.name : 'Business';
  document.getElementById('sumBenReason').textContent = ben.reason ? ben.reason.name : 'Investment';
  document.getElementById('sumBenSof').textContent = ben.sourceOfFunds ? ben.sourceOfFunds.name : 'Salary';

  const partnerRefInput = document.getElementById('sumPartnerRefInput');
  if (partnerRefInput) partnerRefInput.value = `OLW-REF-${Date.now()}`;
  const redirectInput = document.getElementById('sumRedirectUrlInput');
  if (redirectInput && !redirectInput.value) {
    redirectInput.value = `${window.location.origin || 'http://localhost:3000'}/remittances/callback`;
  }
}

// ============================================================================
// STEPS 5, 6 & 7: LOCK EXCHANGE RATE -> INITIATE TRANSACTION -> LOAD PAYMENT URL
// ============================================================================
async function handleConfirmSummaryAndInitiatePayment(options = {}) {
  if (STATE.isInitiatingPayment) return;
  STATE.isInitiatingPayment = true;
  try {
    // Bank-First Hosted Flow: Do NOT create a local beneficiary in our UI; MITO Hosted Page handles creating/selecting the beneficiary (`isBeneficiaryRequired: true`)!
    const isBankOnlyFlow = Boolean(options && options.bankOnlyFlow);
    if (!isBankOnlyFlow && !STATE.beneficiaryId) {
      // Even if called without options, we no longer force local beneficiary creation
      STATE.beneficiaryId = null;
    }

    const selectedProvider =
      STATE.selectedDroplists.dashProvider ||
      STATE.selectedDroplists.provider ||
      null;
    if (!selectedProvider) {
      await lockExchangeRateAfterRateScreen();
      return;
    }

    // Use the rateId locked on Screen 2 for the selected bank; if not locked yet, expired, or locked for a different bank, lock now
    if (
      !STATE.rateId ||
      !STATE.lockedRate ||
      (STATE.rateRemainingSeconds || 0) <= 0 ||
      STATE.lockedRate.providerId !== selectedProvider.id
    ) {
      const lockedOk = await lockExchangeRateAfterRateScreen();
      if (!lockedOk) return;
    }

    const providerId = selectedProvider.id;
    const providerName = selectedProvider.name;

    const customRedirectUrl =
      document.getElementById('sumRedirectUrlInput')?.value.trim() ||
      `${window.location.origin || 'http://localhost:3000'}/remittances/callback`;
    // Always generate a unique PartnerReferenceNumber for every transaction so MITO never returns a cached/expired journey!
    const partnerRef = `OLW-REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const partnerRefInput = document.getElementById('sumPartnerRefInput');
    if (partnerRefInput) partnerRefInput.value = partnerRef;
    const narration =
      document.getElementById('dashPaymentNarration')?.value.trim() ||
      document.getElementById('benPaymentNarration')?.value.trim() ||
      document.getElementById('sumNarrationInput')?.value.trim() ||
      'Remittance transfer via Olowo / Balad';
    const selectedSofCode =
      (STATE.selectedDroplists.dashSof && STATE.selectedDroplists.dashSof.code) ||
      (STATE.selectedDroplists.sof && STATE.selectedDroplists.sof.code) ||
      (STATE.activeBeneficiary && STATE.activeBeneficiary.sourceOfFunds && STATE.activeBeneficiary.sourceOfFunds.code) ||
      'SALARY';
    const selectedReasonCode =
      (STATE.selectedDroplists.dashReason && STATE.selectedDroplists.dashReason.code) ||
      (STATE.selectedDroplists.reason && STATE.selectedDroplists.reason.code) ||
      (STATE.activeBeneficiary && STATE.activeBeneficiary.reason && STATE.activeBeneficiary.reason.code) ||
      'FOROWNEXPENDITURES';

    // Submit Transaction using the locked rateId + selected bank (providerId) via POST /api/v1/mito/Transactions/InitiateHostedTransaction
    // OMIT `beneficiary` / `beneficiaryId` key completely -> MITO returns the `requiredAction.beneficiary` object with a new link (`requiredAction.beneficiary.link`)!
    const txRes = await callApi('POST', '/api/v1/mito/Transactions/InitiateHostedTransaction', {
      userId: STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId,
      senderId: STATE.senderId,
      providerId,
      providerName,
      rateId: STATE.rateId,
      redirectUrl: customRedirectUrl,
      PartnerReferenceNumber: partnerRef,
      sourceOfFundCode: selectedSofCode,
      reasonCode: selectedReasonCode,
      paymentNarration: narration,
      webhookUrl: `${window.location.origin || 'http://localhost:3000'}/api/webhooks/mito`
    });

    if (!txRes.ok || !txRes.data.data) return;
    const txData = txRes.data.data;
    STATE.transactionId = txData.transactionId;
    const paymentOnly = txData.requiredActionPayment || (txData.requiredAction && txData.requiredAction.payment) || {};
    const benAction = txData.requiredActionBeneficiary || (txData.requiredAction && txData.requiredAction.beneficiary) || {};
    STATE.requiredActionPayment = paymentOnly;
    STATE.requiredActionBeneficiary = benAction;

    const benJourneyCode = benAction.journeyCode || txData.beneficiaryJourneyCode || txData.journeyCode || '';
    const payJourneyCode = paymentOnly.journeyCode || txData.paymentJourneyCode || benJourneyCode;
    STATE.journeyCode = benJourneyCode;
    STATE.beneficiaryJourneyCode = benJourneyCode;
    STATE.paymentJourneyCode = payJourneyCode;
    STATE.hostedStage = 'beneficiary';

    // Extract the new link from the `requiredAction.beneficiary` object and normalize to `/?journeyCode=...` so the QR code renders immediately!
    STATE.beneficiaryRawLink =
      benAction.link ||
      txData.beneficiaryRawLink ||
      txData.beneficiaryLink ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction?journeyCode=${encodeURIComponent(benJourneyCode)}`;
    STATE.beneficiaryQrUrl =
      benAction.qrCodeLink ||
      txData.beneficiaryQrUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(benJourneyCode)}`;
    STATE.beneficiaryHostedUrl = STATE.beneficiaryQrUrl;
    STATE.beneficiaryDirectUrl =
      benAction.directBeneficiaryLink ||
      txData.beneficiaryDirectUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(benJourneyCode)}`;

    STATE.paymentRawLink =
      paymentOnly.link ||
      txData.paymentRawLink ||
      txData.paymentUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction?journeyCode=${encodeURIComponent(payJourneyCode)}`;
    STATE.paymentQrUrl =
      paymentOnly.qrCodeLink ||
      txData.paymentQrUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(payJourneyCode)}`;
    STATE.paymentDirectUrl =
      paymentOnly.directCheckoutLink ||
      txData.paymentDirectUrl ||
      txData.paymentCheckoutUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(payJourneyCode)}`;
    STATE.paymentUrl = STATE.paymentRawLink;
    STATE.paymentCheckoutUrl = STATE.paymentDirectUrl;
    STATE.redirectUrl = txData.redirectUrl || customRedirectUrl;

    // Update Payment Screen Badges with requiredAction.beneficiary.link, requiredAction.payment.link, and redirectUrl
    document.getElementById('payRateIdBadge').textContent = `${STATE.rateId} · ${STATE.transactionId}`;
    document.getElementById('stripRateId').textContent = STATE.rateId;
    document.getElementById('stripTxId').textContent = STATE.transactionId;
    const provNameEl = document.getElementById('stripProviderName');
    if (provNameEl) provNameEl.textContent = txData.providerName || providerName;
    const refEl = document.getElementById('stripMitoRef');
    if (refEl) refEl.textContent = txData.reference || '';
    const jnyEl = document.getElementById('stripJourneyCode');
    if (jnyEl) jnyEl.textContent = benJourneyCode;
    const benHostEl = document.getElementById('stripBeneficiaryHostedUrl');
    if (benHostEl) benHostEl.textContent = STATE.beneficiaryRawLink;
    const benUrlLinkEl = document.getElementById('stripBeneficiaryUrlLink');
    if (benUrlLinkEl) benUrlLinkEl.href = STATE.beneficiaryQrUrl;
    document.getElementById('stripPaymentUrl').textContent = STATE.paymentRawLink;
    const payLinkEl = document.getElementById('stripPaymentUrlLink');
    if (payLinkEl) payLinkEl.href = STATE.paymentQrUrl;
    const openBtnEl = document.getElementById('btnOpenLiveMitoPaymentLink');
    if (openBtnEl) openBtnEl.href = STATE.beneficiaryQrUrl;
    const redirEl = document.getElementById('stripRedirectUrl');
    if (redirEl) redirEl.textContent = STATE.redirectUrl;

    // Ensure Fallback Page is hidden and Iframe Shell is visible on new transaction start
    hideBeneficiaryFallbackPage();
    updateBeneficiaryStageBanner('beneficiary_pending');

    // Load the working QR Code view (`/?journeyCode=...`) for the `requiredAction.beneficiary` journey directly inside #mitoLivePaymentIframe!
    loadMitoLivePaymentIframe(STATE.beneficiaryQrUrl, 'beneficiary');

    // Start live auto-polling of `GET /api/v1/mito/Transactions/:id/beneficiary-status` so once Beneficiary is completed, we automatically load the Payment Link!
    startBeneficiaryStatusAutoPolling();

    // Open the MITO Hosted Page Screen
    jumpToView('payment');
  } finally {
    STATE.isInitiatingPayment = false;
  }
}

function updateBeneficiaryStageBanner(stageState, extraText = '') {
  const bar = document.getElementById('beneficiaryStageControlBar');
  const badge = document.getElementById('beneficiaryStageStatusBadge');
  const topBadge = document.getElementById('payTopStepBadge');
  if (!badge) return;

  if (stageState === 'beneficiary_completed') {
    if (bar) {
      bar.style.background = '#dcfce7';
      bar.style.borderColor = '#86efac';
    }
    badge.style.color = '#166534';
    badge.innerHTML = `✅ <strong>Beneficiary Completed!</strong> Automatically loaded <strong>Payment Link (<code>requiredAction.payment.link</code> · Journey: <code>${STATE.paymentJourneyCode || ''}</code>)</strong>`;
    if (topBadge) {
      topBadge.textContent = `Step 3B · MITO Hosted Payment Link Loaded (Journey: ${STATE.paymentJourneyCode || ''})`;
    }
  } else if (stageState === 'beneficiary_failed') {
    if (bar) {
      bar.style.background = '#fee2e2';
      bar.style.borderColor = '#fca5a5';
    }
    badge.style.color = '#991b1b';
    badge.innerHTML = `❌ <strong>Beneficiary Step Failed:</strong> ${extraText || 'Showing Fallback Page below (Retry or Abort to Dashboard).'}`;
    if (topBadge) {
      topBadge.textContent = 'Step 3A · Beneficiary Fallback Page (Retry Beneficiary Details or Abort Transaction)';
    }
  } else {
    if (bar) {
      bar.style.background = '#eff6ff';
      bar.style.borderColor = '#bfdbfe';
    }
    badge.style.color = '#1e40af';
    badge.innerHTML = `⏳ <strong>Stage 3A Active (Beneficiary Journey <code>${STATE.beneficiaryJourneyCode || ''}</code>):</strong> Waiting for Beneficiary completion → Will automatically load Payment Link (<code>${STATE.paymentJourneyCode || ''}</code>)`;
    if (topBadge) {
      topBadge.textContent = `Step 3A · MITO Hosted Beneficiary Link (${STATE.beneficiaryJourneyCode || ''}) → Payment Link`;
    }
  }
}

function hideBeneficiaryFallbackPage() {
  const fallbackEl = document.getElementById('beneficiaryFallbackPage');
  const iframeShell = document.getElementById('mitoLiveIframeShell');
  if (fallbackEl) fallbackEl.classList.add('hidden');
  if (iframeShell) iframeShell.classList.remove('hidden');
}

// Once Beneficiary is completed -> Automatically load the Payment page already sent in the API response in the `payment` object (`requiredAction.payment`)!
async function handleBeneficiaryCompletedLoadPaymentLink(skipApiCall = false, paymentObjOverride = null) {
  stopBeneficiaryStatusAutoPolling();
  if (STATE.hostedStage === 'payment') return;
  STATE.hostedStage = 'payment';

  if (paymentObjOverride && typeof paymentObjOverride === 'object') {
    STATE.requiredActionPayment = { ...(STATE.requiredActionPayment || {}), ...paymentObjOverride };
  }

  if (!skipApiCall && STATE.transactionId) {
    await callApi('POST', '/api/v1/mito/Transactions/BeneficiaryOutcome', {
      transactionId: STATE.transactionId,
      outcome: 'COMPLETED'
    });
  }

  const paymentObj = STATE.requiredActionPayment || {};
  const resolvedPayJourneyCode = paymentObj.journeyCode || STATE.paymentJourneyCode || STATE.journeyCode || '';
  if (resolvedPayJourneyCode) {
    STATE.paymentJourneyCode = resolvedPayJourneyCode;
  }

  hideBeneficiaryFallbackPage();
  updateBeneficiaryStageBanner('beneficiary_completed');

  const jnyEl = document.getElementById('stripJourneyCode');
  if (jnyEl && STATE.paymentJourneyCode) jnyEl.textContent = STATE.paymentJourneyCode;

  // Use the Payment page link from the `payment` object (`requiredAction.payment`) already sent in the InitiateHostedTransaction API response!
  const rawPaymentLinkFromApi =
    paymentObj.link ||
    STATE.paymentRawLink ||
    STATE.paymentUrl ||
    `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction?journeyCode=${encodeURIComponent(STATE.paymentJourneyCode)}`;
  const normalizedPaymentQrUrl =
    paymentObj.qrCodeLink ||
    STATE.paymentQrUrl ||
    (STATE.paymentJourneyCode
      ? `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(STATE.paymentJourneyCode)}`
      : rawPaymentLinkFromApi);

  STATE.paymentRawLink = rawPaymentLinkFromApi;
  STATE.paymentQrUrl = normalizedPaymentQrUrl;
  STATE.paymentUrl = rawPaymentLinkFromApi;

  const stripPayUrlEl = document.getElementById('stripPaymentUrl');
  if (stripPayUrlEl) stripPayUrlEl.textContent = rawPaymentLinkFromApi;
  const stripPayLinkEl = document.getElementById('stripPaymentUrlLink');
  if (stripPayLinkEl) stripPayLinkEl.href = normalizedPaymentQrUrl;
  const openBtnEl = document.getElementById('btnOpenLiveMitoPaymentLink');
  if (openBtnEl) {
    openBtnEl.href = normalizedPaymentQrUrl;
    openBtnEl.innerHTML = '🔗 Open Payment Link (<code>requiredAction.payment.link</code>) ↗';
  }

  loadMitoLivePaymentIframe(normalizedPaymentQrUrl, 'paymentQr');
  startPaymentStatusAutoPolling();
}

// In case Beneficiary fails -> Show Fallback Page & Message, and if allowed, allow user to add details again OR abort transaction & land on Dashboard
async function handleBeneficiaryFailedShowFallback(isRetryAllowed = true, customMessage = '', skipApiCall = false) {
  stopBeneficiaryStatusAutoPolling();
  STATE.hostedStage = 'beneficiary_failed';
  STATE.isBeneficiaryRetryAllowed = Boolean(isRetryAllowed);

  let resolvedMessage = customMessage;
  if (!skipApiCall && STATE.transactionId) {
    const res = await callApi('POST', '/api/v1/mito/Transactions/BeneficiaryOutcome', {
      transactionId: STATE.transactionId,
      outcome: isRetryAllowed ? 'FAILED_RETRY_ALLOWED' : 'FAILED_NO_RETRY',
      failureReason: customMessage
    });
    if (res.ok && res.data && res.data.data && res.data.data.failureReason) {
      resolvedMessage = res.data.data.failureReason;
    }
  }

  if (!resolvedMessage) {
    resolvedMessage = isRetryAllowed
      ? 'We could not verify or complete the recipient banking details on the MITO Hosted Page. Since retry is permitted for this transaction, you may click "Add Beneficiary Details Again" to re-enter the recipient details, or click "Abort Transaction & Return to Dashboard".'
      : 'Beneficiary verification failed compliance / screening checks and retry is not permitted for this transaction. Please abort the transaction to return to the Dashboard.';
  }

  updateBeneficiaryStageBanner('beneficiary_failed', isRetryAllowed ? 'Retry Allowed' : 'Retry Not Allowed');

  const fallbackEl = document.getElementById('beneficiaryFallbackPage');
  const iframeShell = document.getElementById('mitoLiveIframeShell');
  if (iframeShell) iframeShell.classList.add('hidden');
  if (fallbackEl) fallbackEl.classList.remove('hidden');

  const retryPill = document.getElementById('beneficiaryFallbackRetryPill');
  if (retryPill) {
    retryPill.textContent = isRetryAllowed ? 'RETRY ALLOWED' : 'RETRY NOT ALLOWED';
    retryPill.style.background = isRetryAllowed ? '#dcfce7' : '#fee2e2';
    retryPill.style.color = isRetryAllowed ? '#166534' : '#991b1b';
    retryPill.style.borderColor = isRetryAllowed ? '#86efac' : '#fca5a5';
  }

  const titleEl = document.getElementById('beneficiaryFallbackTitle');
  if (titleEl) {
    titleEl.textContent = isRetryAllowed
      ? 'Beneficiary Step Could Not Be Completed — Add Details Again or Abort'
      : 'Beneficiary Verification Rejected — Transaction Must Be Aborted';
  }

  const msgEl = document.getElementById('beneficiaryFallbackMessage');
  if (msgEl) msgEl.textContent = resolvedMessage;

  const fbTxId = document.getElementById('fallbackTxId');
  if (fbTxId) fbTxId.textContent = STATE.transactionId || 'TXN-...';
  const fbJc = document.getElementById('fallbackBenJourneyCode');
  if (fbJc) fbJc.textContent = STATE.beneficiaryJourneyCode || STATE.journeyCode || 'JNY-...';
  const fbBank = document.getElementById('fallbackBankName');
  const selProv = STATE.selectedDroplists.dashProvider || STATE.selectedDroplists.provider;
  if (fbBank) fbBank.textContent = selProv ? selProv.name : 'Selected Beneficiary Bank';
  const fbAmt = document.getElementById('fallbackAmountSummary');
  if (fbAmt) {
    fbAmt.textContent = `${STATE.sendCurrency} ${Number(STATE.sendAmount).toFixed(2)} → ${STATE.receiveCurrency} ${Number(STATE.receiveAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const retryBtn = document.getElementById('btnRetryBeneficiaryDetails');
  if (retryBtn) {
    retryBtn.classList.toggle('hidden', !isRetryAllowed);
  }
}

// Allow user to add the beneficiary details again (when retry is allowed)
async function handleRetryBeneficiaryDetails() {
  if (STATE.transactionId) {
    await callApi('POST', '/api/v1/mito/Transactions/BeneficiaryOutcome', {
      transactionId: STATE.transactionId,
      outcome: 'RETRY_BENEFICIARY'
    });
  }
  STATE.hostedStage = 'beneficiary';
  hideBeneficiaryFallbackPage();
  updateBeneficiaryStageBanner('beneficiary_pending');

  // Open the Direct Beneficiary Form (`/retail-transaction/flow?journeyCode=...`) so the user can immediately re-enter the beneficiary details!
  const retryUrl =
    STATE.beneficiaryDirectUrl ||
    STATE.beneficiaryQrUrl ||
    `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(STATE.beneficiaryJourneyCode || STATE.journeyCode || '')}`;
  loadMitoLivePaymentIframe(retryUrl, 'beneficiaryForm');
  startBeneficiaryStatusAutoPolling();
}

// Abort the transaction, show Aborted Status on Dashboard & Transactions list, and smoothly return to Dashboard
async function handleAbortTransactionAndReturnToDashboard() {
  stopBeneficiaryStatusAutoPolling();
  stopPaymentStatusAutoPolling();

  let abortedTx = null;
  if (STATE.transactionId) {
    const res = await callApi('POST', '/api/v1/mito/Transactions/Abort', {
      transactionId: STATE.transactionId,
      reason: 'Aborted by user from Beneficiary Fallback Page'
    });
    if (res.ok && res.data && res.data.data && res.data.data.transaction) {
      abortedTx = res.data.data.transaction;
    }
  }

  const selProv = STATE.selectedDroplists.dashProvider || STATE.selectedDroplists.provider;
  const record = {
    transactionId: (abortedTx && abortedTx.transactionId) || STATE.transactionId || `TXN-${Date.now()}`,
    reference: (abortedTx && abortedTx.reference) || '',
    beneficiaryName: (abortedTx && abortedTx.beneficiaryName) || 'Beneficiary Aborted',
    beneficiaryId: (abortedTx && abortedTx.beneficiaryId) || 'ABORTED',
    providerName: (abortedTx && abortedTx.providerName) || (selProv ? selProv.name : 'Selected Beneficiary Bank'),
    collectionMode: STATE.collectionMode || 'BANKACCOUNT',
    rateId: STATE.rateId || '—',
    exchangeRate: STATE.customerRate || 1831.01,
    senderName: `${STATE.sender.firstName || 'David'} ${STATE.sender.lastName || 'Beckham'}`.trim(),
    senderId: STATE.sender.mitoUserId || STATE.sender.userId || STATE.senderId || '—',
    senderKycStatus: STATE.sender.kycStatus || 'PASSED',
    senderKycTier: STATE.sender.kycTier || 'MINI_KYC',
    sendCurrency: STATE.sendCurrency,
    sendAmount: STATE.sendAmount,
    receiveCurrency: STATE.receiveCurrency,
    receiveAmount: STATE.receiveAmount,
    paymentStatus: 'FAILED',
    paymentCase: 'CANCELLED',
    rawMitoOrderStatus: 'ABORTED',
    completedAt: new Date().toISOString(),
    createdAt: new Date().toLocaleTimeString()
  };

  const existingIdx = STATE.transactions.findIndex(t => t.transactionId === record.transactionId);
  if (existingIdx >= 0) {
    STATE.transactions[existingIdx] = record;
  } else {
    STATE.transactions.unshift(record);
  }
  renderTransactionsList();
  hideBeneficiaryFallbackPage();

  const alertBanner = document.getElementById('dashAlertBanner');
  const alertText = document.getElementById('dashAlertText');
  if (alertBanner && alertText) {
    alertBanner.style.background = '#fee2e2';
    alertBanner.style.borderColor = '#fca5a5';
    alertBanner.style.color = '#991b1b';
    alertText.innerHTML =
      `🚫 <strong>Transaction Aborted (<code>${record.transactionId}</code>):</strong> ` +
      `Beneficiary step was aborted and no funds were debited. You are back on the <strong>Dashboard</strong> and can start a new transfer anytime.`;
  }

  jumpToView('dashboard');
}

function startBeneficiaryStatusAutoPolling() {
  stopBeneficiaryStatusAutoPolling();
  if (!STATE.transactionId) return;

  const checkStatusOnce = async () => {
    if (STATE.currentView !== 'payment' || STATE.hostedStage !== 'beneficiary' || !STATE.transactionId) {
      return;
    }
    try {
      const r = await fetch(`/api/v1/mito/Transactions/${encodeURIComponent(STATE.transactionId)}/beneficiary-status`);
      if (!r.ok) return;
      const json = await r.json();
      const d = json && json.data ? json.data : null;
      if (!d || STATE.hostedStage !== 'beneficiary') return;
      if (d.isCompleted) {
        await handleBeneficiaryCompletedLoadPaymentLink(true, d.requiredActionPayment || null);
      } else if (d.isFailed) {
        await handleBeneficiaryFailedShowFallback(d.isRetryAllowed !== false, d.failureReason || '', true);
      }
    } catch (_) {}
  };

  STATE.beneficiaryPollTimerId = setInterval(checkStatusOnce, 1200);
}

function stopBeneficiaryStatusAutoPolling() {
  if (STATE.beneficiaryPollTimerId) {
    clearInterval(STATE.beneficiaryPollTimerId);
    STATE.beneficiaryPollTimerId = null;
  }
}

function startPaymentStatusAutoPolling() {
  stopPaymentStatusAutoPolling();
  if (!STATE.transactionId) return;

  const checkPaymentOnce = async () => {
    if (STATE.currentView !== 'payment' || STATE.hostedStage !== 'payment' || !STATE.transactionId) {
      return;
    }
    try {
      const r = await fetch(`/api/v1/mito/Transactions/${encodeURIComponent(STATE.transactionId)}/payment-status`);
      if (!r.ok) return;
      const json = await r.json();
      const d = json && json.data ? json.data : null;
      if (!d || STATE.hostedStage !== 'payment') return;
      if (d.isCompleted) {
        stopPaymentStatusAutoPolling();
        STATE.hostedStage = 'payment_completed';
        await completePaymentAndRedirect(d.orderStatus || 'READYTOPROCESS', {
          paymentMethod: d.paymentMethod || 'MITO Hosted Payment',
          orderNo: d.orderNo || '',
          autoRedirectToDashboard: true
        });
      } else if (d.isFailed) {
        stopPaymentStatusAutoPolling();
        STATE.hostedStage = 'payment_failed';
        await completePaymentAndRedirect(d.orderStatus || 'FAILED', {
          paymentMethod: d.paymentMethod || 'MITO Hosted Payment',
          orderNo: d.orderNo || '',
          autoRedirectToDashboard: true
        });
      }
    } catch (_) {}
  };

  STATE.paymentPollTimerId = setInterval(checkPaymentOnce, 1200);
}

function stopPaymentStatusAutoPolling() {
  if (STATE.paymentPollTimerId) {
    clearInterval(STATE.paymentPollTimerId);
    STATE.paymentPollTimerId = null;
  }
}

// Listen for postMessage events from the MITO Hosted iframe (`BALAD_BENEFICIARY_CALLBACK`, `MITO_LINK_SUCCESS`, `MITO_LINK_EXIT`)
// Note: MITO's hosted page sends `JSON.stringify({ type: 'MITO_LINK_SUCCESS', ... })` as a string, so we parse string messages as well!
window.addEventListener('message', e => {
  let msg = e && e.data ? e.data : null;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch (_) {
      return;
    }
  }
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'BALAD_BENEFICIARY_CALLBACK') {
    if (msg.status === 'COMPLETED') {
      handleBeneficiaryCompletedLoadPaymentLink(true, msg.requiredActionPayment || null);
    } else if (msg.status === 'FAILED') {
      handleBeneficiaryFailedShowFallback(msg.isRetryAllowed !== false, msg.failureReason || '', true);
    }
  } else if (msg.type === 'MITO_LINK_SUCCESS') {
    if (STATE.hostedStage === 'beneficiary') {
      handleBeneficiaryCompletedLoadPaymentLink(false, STATE.requiredActionPayment || null);
    } else if (STATE.hostedStage === 'payment') {
      stopPaymentStatusAutoPolling();
      STATE.hostedStage = 'payment_completed';
      const orderStatus =
        (msg.payload && msg.payload.status) ||
        (msg.metadata && msg.metadata.status) ||
        'READYTOPROCESS';
      const orderNo =
        (msg.payload && msg.payload.transactionReference) ||
        (msg.metadata && msg.metadata.transactionReference) ||
        '';
      completePaymentAndRedirect(
        orderStatus === 'Completed' || orderStatus === 'BENEFICIARYCOMPLETED' ? 'READYTOPROCESS' : orderStatus,
        { orderNo, autoRedirectToDashboard: true }
      );
    }
  } else if (msg.type === 'MITO_LINK_EXIT') {
    const reason =
      (msg.error && (msg.error.status || msg.error.reason)) ||
      (msg.payload && (msg.payload.status || msg.payload.reason)) ||
      (msg.metadata && (msg.metadata.status || msg.metadata.reason)) ||
      'FAILED';
    if (STATE.hostedStage === 'beneficiary') {
      handleBeneficiaryFailedShowFallback(
        true,
        `MITO Hosted Page exited (${reason}). You can add the beneficiary details again or abort the transaction.`,
        false
      );
    } else if (STATE.hostedStage === 'payment') {
      stopPaymentStatusAutoPolling();
      STATE.hostedStage = 'payment_failed';
      const upperReason = String(reason || 'FAILED').toUpperCase();
      const mappedFailStatus = upperReason.includes('CANCEL') || upperReason.includes('CLOSE')
        ? 'CANCELLED'
        : upperReason.includes('EXPIR') || upperReason.includes('RESTART')
        ? 'EXPIRED'
        : 'FAILED';
      completePaymentAndRedirect(mappedFailStatus, { autoRedirectToDashboard: true });
    }
  }
});

let iframeOverlayHideTimeout = null;

function loadMitoLivePaymentIframe(targetUrl, mode = 'beneficiary') {
  const iframe = document.getElementById('mitoLivePaymentIframe');
  const urlBar = document.getElementById('mitoLiveIframeUrlBar');
  const overlay = document.getElementById('mitoIframeLoadingOverlay');
  const overlayText = document.getElementById('mitoIframeLoadingText');
  const btnBeneficiary = document.getElementById('btnMitoFrameModeBeneficiary');
  const btnBeneficiaryForm = document.getElementById('btnMitoFrameModeBeneficiaryForm');
  const btnPaymentQr = document.getElementById('btnMitoFrameModePaymentQr');
  const btnCheckout = document.getElementById('btnMitoFrameModeCheckout');

  if (overlay && overlayText) {
    if (iframeOverlayHideTimeout) clearTimeout(iframeOverlayHideTimeout);
    overlayText.innerHTML =
      mode === 'paymentQr' || mode === 'checkout'
        ? `✅ <strong>Beneficiary Completed!</strong><br/>Automatically loading MITO Payment Hosted Link (<code>requiredAction.payment.link</code>)...`
        : `🔄 Automatically loading MITO Beneficiary Hosted Link (<code>requiredAction.beneficiary.link</code>)...`;
    overlay.classList.remove('hidden');
    iframeOverlayHideTimeout = setTimeout(() => {
      overlay.classList.add('hidden');
    }, 900);
  }

  // Append `mitoEmbed=1` and stage cache-buster when embedding MITO's public Heroku page inside the iframe
  // so MITO uses `postMessage` and the browser always triggers a fresh automatic load when transitioning Beneficiary -> Payment!
  let iframeSrcUrl = targetUrl;
  if (iframeSrcUrl && iframeSrcUrl.includes('mito-checkout')) {
    if (!iframeSrcUrl.includes('mitoEmbed=')) {
      iframeSrcUrl += (iframeSrcUrl.includes('?') ? '&' : '?') + 'mitoEmbed=1';
    }
    iframeSrcUrl += `&stage=${encodeURIComponent(mode)}&_t=${Date.now()}`;
  }

  if (iframe && iframeSrcUrl) {
    iframe.onload = () => {
      if (overlay) overlay.classList.add('hidden');
    };
    iframe.src = iframeSrcUrl;
  }
  if (urlBar && targetUrl) {
    urlBar.textContent = `🔒 ${targetUrl}`;
  }
  const buttons = [
    { el: btnBeneficiary, key: 'beneficiary' },
    { el: btnBeneficiaryForm, key: 'beneficiaryForm' },
    { el: btnPaymentQr, key: 'paymentQr' },
    { el: btnCheckout, key: 'checkout' }
  ];
  buttons.forEach(({ el, key }) => {
    if (!el) return;
    if (key === mode) {
      el.className = 'olowo-btn-green sm';
      el.style.cssText = 'font-size:11.5px;padding:5px 10px;';
    } else {
      el.className = 'olowo-btn-outline-green sm';
      el.style.cssText = 'font-size:11.5px;padding:5px 10px;background:#1e293b;color:#e2e8f0;border-color:#475569;';
    }
  });
  STATE.mitoFrameMode = mode;
}

function switchMitoLivePaymentFrameMode(mode) {
  hideBeneficiaryFallbackPage();
  if (mode === 'beneficiary') {
    STATE.hostedStage = 'beneficiary';
    const benQrUrl =
      STATE.beneficiaryQrUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(STATE.beneficiaryJourneyCode || STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(benQrUrl, 'beneficiary');
    startBeneficiaryStatusAutoPolling();
  } else if (mode === 'beneficiaryForm') {
    STATE.hostedStage = 'beneficiary';
    const benFormUrl =
      STATE.beneficiaryDirectUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(STATE.beneficiaryJourneyCode || STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(benFormUrl, 'beneficiaryForm');
    startBeneficiaryStatusAutoPolling();
  } else if (mode === 'paymentQr') {
    STATE.hostedStage = 'payment';
    const payQrUrl =
      STATE.paymentQrUrl ||
      STATE.paymentUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/?journeyCode=${encodeURIComponent(STATE.paymentJourneyCode || STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(payQrUrl, 'paymentQr');
    startPaymentStatusAutoPolling();
  } else {
    STATE.hostedStage = 'payment';
    const checkoutUrl =
      STATE.paymentDirectUrl ||
      STATE.paymentCheckoutUrl ||
      STATE.paymentUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/retail-transaction/flow?journeyCode=${encodeURIComponent(STATE.paymentJourneyCode || STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(checkoutUrl, 'checkout');
    startPaymentStatusAutoPolling();
  }
}

function reloadMitoLivePaymentIframe() {
  switchMitoLivePaymentFrameMode(STATE.mitoFrameMode || 'beneficiary');
}

function simulateMobilePaymentQrScan() {
  document.getElementById('mitoPayQrPendingBox').classList.add('hidden');
  document.getElementById('mitoPayQrScannedBox').classList.remove('hidden');
  showMitoPaymentScreen('P1');
}

function showMitoPaymentScreen(stepCode) {
  const allSteps = ['P1', 'P2', 'P3', 'P4', 'P6'];
  allSteps.forEach(s => {
    const el = document.getElementById(`mitoPayScreen-${s}`);
    if (el) el.classList.toggle('hidden', s !== stepCode);
  });

  document.querySelectorAll('.p-step-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pstep') === stepCode);
  });

  const prog = document.getElementById('mitoPayProgressBar');
  const statusTxt = document.getElementById('mitoPayMirrorStatusText');
  if (stepCode === 'P1') {
    prog.style.width = '45%';
    statusTxt.textContent = 'QR code scanned! Processing transaction (P1: Payment details)...';
  } else if (stepCode === 'P2') {
    prog.style.width = '60%';
    statusTxt.textContent = 'Confirming payment amount (P2: Transaction Confirm)...';
  } else if (stepCode === 'P3') {
    prog.style.width = '75%';
    statusTxt.textContent = 'Selecting Open Banking UK institution (P3: Select your bank)...';
  } else if (stepCode === 'P4') {
    prog.style.width = '88%';
    statusTxt.textContent = `Authorising transfer with ${STATE.selectedUkBank} (P4: Confirm payment details)...`;
  } else if (stepCode === 'P6') {
    prog.style.width = '100%';
    statusTxt.textContent = 'Payment successful (Status: Paid)! Ready to redirect to Olowo...';
  }
}

function renderUkBankList(query) {
  const box = document.getElementById('ukBankListBox');
  if (!box) return;
  const q = String(query || '').toLowerCase().trim();
  const filtered = UK_BANKS.filter(b => b.name.toLowerCase().includes(q));
  box.innerHTML = filtered
    .map(
      b => `
      <div class="uk-bank-item" onclick="selectUkBankForPayment('${b.name}')">
        <span>🏦 ${b.name}</span>
        <span style="font-size:11.5px;color:#64748b;">${b.tag} →</span>
      </div>
    `
    )
    .join('');
}

function filterUkBanks(query) {
  renderUkBankList(query);
}

function selectUkBankForPayment(bankName) {
  STATE.selectedUkBank = bankName;
  document.getElementById('p4BankName').textContent = bankName;
  document.getElementById('p4BankBtnLabel').textContent = bankName;
  showMitoPaymentScreen('P4');
}

// ============================================================================
// STEP 7 COMPLETION -> CAPTURE RESULT & HANDLE ALL 6 MITO REDIRECT URL CASES
// ============================================================================
function resolveClientPaymentCase(rawInput = 'READYTOPROCESS') {
  const s = String(rawInput || 'READYTOPROCESS').trim().toUpperCase();
  if (['READYTOPROCESS', 'PROCESSED', 'AWAITINGAFFILIATEUPDATE', 'COMPSUCCESS', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'PAID', 'COMPLETED', 'APPROVED'].includes(s)) {
    return { normalizedStatus: 'SUCCESS', paymentCase: 'SUCCESS', rawMitoOrderStatus: s === 'SUCCESS' ? 'READYTOPROCESS' : s };
  }
  if (['AWAITINGPAYMENT', 'AWAITING_PAYMENT', 'AWAITING', 'NEW'].includes(s)) {
    return { normalizedStatus: 'PENDING', paymentCase: 'AWAITING_PAYMENT', rawMitoOrderStatus: 'AWAITINGPAYMENT' };
  }
  if (['INREVIEW', 'IN_REVIEW', 'MANUALREVIEW', 'MANUAL_REVIEW', 'PENDING', 'PROCESSING', 'IN_PROCESS', 'INPROGRESS', 'WAITING'].includes(s)) {
    return { normalizedStatus: 'PENDING', paymentCase: 'IN_REVIEW', rawMitoOrderStatus: s === 'PENDING' ? 'INREVIEW' : s };
  }
  if (['CANCELLED', 'CANCELED', 'CLOSED', 'ABORTED', 'USER_CLOSED'].includes(s)) {
    return { normalizedStatus: 'FAILED', paymentCase: 'CANCELLED', rawMitoOrderStatus: s };
  }
  if (['EXPIRED', 'TIMEOUT'].includes(s)) {
    return { normalizedStatus: 'FAILED', paymentCase: 'EXPIRED', rawMitoOrderStatus: s };
  }
  return { normalizedStatus: 'FAILED', paymentCase: 'FAILED', rawMitoOrderStatus: s || 'FAILED' };
}

async function completePaymentAndRedirect(simulatedResult = 'READYTOPROCESS', extra = {}) {
  // Ensure a live transaction exists if user clicked directly to Step 7
  if (!STATE.transactionId) {
    await handleConfirmSummaryAndInitiatePayment();
  }

  const { paymentCase, rawMitoOrderStatus } = resolveClientPaymentCase(simulatedResult);
  const paymentMethod =
    extra.paymentMethod ||
    (paymentCase === 'AWAITING_PAYMENT'
      ? 'Bank Transfer (BANKPAYMENT)'
      : 'MITO Hosted Payment (Plaid / Bank / Card)');
  const orderNo = extra.orderNo || '';

  // Hit both CompleteHostedPayment AND our live Redirect URL route (/remittances/callback)
  const { ok, data } = await callApi('POST', '/api/v1/mito/Transactions/CompleteHostedPayment', {
    transactionId: STATE.transactionId,
    paymentMethod,
    simulatedResult: rawMitoOrderStatus,
    orderNo
  });

  if (!ok || !data.data) return;

  // Call our live GET /remittances/callback route with exact MITO query params (orderStatus & orderNo)
  const resolvedOrderNo = data.data.orderNo || data.data.reference || '';
  const callbackRes = await callApi(
    'GET',
    `/remittances/callback?format=json&transactionId=${encodeURIComponent(STATE.transactionId)}&orderStatus=${encodeURIComponent(rawMitoOrderStatus)}&orderNo=${encodeURIComponent(resolvedOrderNo)}&paymentMethod=${encodeURIComponent(paymentMethod)}`
  );

  const txResult = data.data;
  const cbData = (callbackRes.ok && callbackRes.data?.data) || {};
  const tx = cbData.transaction || txResult.transaction;
  const capturedRedirectUrl = cbData.redirectUrlHit || txResult.redirectUrl;

  renderStep7TransactionResult(tx, rawMitoOrderStatus, paymentMethod, capturedRedirectUrl, {
    paymentCase: cbData.paymentCase || txResult.paymentCase || paymentCase,
    rawMitoOrderStatus: cbData.rawMitoOrderStatus || txResult.rawMitoOrderStatus || rawMitoOrderStatus,
    orderNo: cbData.orderNo || resolvedOrderNo
  });
}

function renderStep7TransactionResult(tx, simulatedResult, paymentMethod, capturedRedirectUrl, extraMeta = {}) {
  const resolved = resolveClientPaymentCase(extraMeta.paymentCase || extraMeta.rawMitoOrderStatus || tx.paymentCase || tx.rawMitoOrderStatus || simulatedResult);
  const paymentCase = extraMeta.paymentCase || tx.paymentCase || resolved.paymentCase;
  const rawMitoOrderStatus = extraMeta.rawMitoOrderStatus || tx.rawMitoOrderStatus || resolved.rawMitoOrderStatus;
  const normalizedStatus = resolved.normalizedStatus;
  const orderNo = extraMeta.orderNo || tx.orderNo || tx.reference || '—';

  tx.paymentStatus = normalizedStatus;
  tx.paymentCase = paymentCase;
  tx.rawMitoOrderStatus = rawMitoOrderStatus;

  // Save or update in Olowo Transactions History
  const existingIdx = STATE.transactions.findIndex(t => t.transactionId === tx.transactionId);
  if (existingIdx >= 0) {
    STATE.transactions[existingIdx] = tx;
  } else {
    STATE.transactions.unshift(tx);
  }

  // Populate the Dedicated Olowo Redirect URL Page (`view-success`)
  document.getElementById('succTxBadge').textContent = `${tx.transactionId} · ${rawMitoOrderStatus}`;
  document.getElementById('succRedirectUrlText').textContent = capturedRedirectUrl || tx.finalRedirectUrlWithParams || tx.redirectUrl;

  const heroIcon = document.getElementById('succHeroIcon');
  const statusPill = document.getElementById('succStatusPill');
  const mainTitle = document.getElementById('succMainTitle');
  const subtitle = document.getElementById('succSubtitle');
  const amountBanner = document.getElementById('succAmountBanner');
  const leftLabel = document.getElementById('succLeftLabel');
  const rightLabel = document.getElementById('succRightLabel');
  const amtArrow = document.getElementById('succAmtArrow');
  const youPaidEl = document.getElementById('succYouPaid');
  const theyReceiveEl = document.getElementById('succTheyReceive');
  const detailStatusEl = document.getElementById('succDetailStatus');
  const detailOrderStatusEl = document.getElementById('succDetailOrderStatus');
  const detailOrderNoEl = document.getElementById('succDetailOrderNo');
  const timeLabelEl = document.getElementById('succTimeLabel');
  const stepBadgeEl = document.getElementById('succStepBadge');
  const topPill7El = document.getElementById('flowPillStep7');
  const primaryCtaBtn = document.getElementById('succPrimaryCtaBtn');
  const txBadgeEl = document.getElementById('succTxBadge');

  if (detailOrderStatusEl) detailOrderStatusEl.textContent = rawMitoOrderStatus;
  if (detailOrderNoEl) detailOrderNoEl.textContent = orderNo;

  const sendSym = tx.sendCurrency === 'GBP' ? '£' : '€';
  const recSym = tx.receiveCurrency === 'NGN' ? '₦' : tx.receiveCurrency + ' ';
  const formattedSend = `${sendSym}${Number(tx.sendAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${tx.sendCurrency}`;
  const formattedRec = `${recSym}${Number(tx.receiveAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${tx.receiveCurrency}`;

  if (paymentCase === 'SUCCESS') {
    heroIcon.textContent = '✓';
    heroIcon.style.background = '#56971b';
    statusPill.textContent = `Transfer Successful · Paid (${rawMitoOrderStatus})`;
    statusPill.style.background = '#dcfce7';
    statusPill.style.color = '#166534';
    mainTitle.textContent = 'Your money is on its way!';
    subtitle.textContent = `MITO Money confirmed your payment (${tx.transactionId} · Ref ${orderNo}) and initiated payout to ${tx.beneficiaryName}.`;

    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #254d12, #56971b)';
    if (leftLabel) leftLabel.textContent = 'You paid';
    if (youPaidEl) youPaidEl.textContent = formattedSend;
    if (amtArrow) amtArrow.textContent = '→';
    if (rightLabel) rightLabel.textContent = 'Recipient receives';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = formattedRec;
      theyReceiveEl.style.color = '#bbf7d0';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `SUCCESS (Paid · ${rawMitoOrderStatus})`;
      detailStatusEl.style.color = '#15803d';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Completed At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Payment Successful (`redirectUrl`)';
      stepBadgeEl.style.background = '#e8f5dd';
      stepBadgeEl.style.color = '#2c6e12';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#166534';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '7. Success Page';
      topPill7El.style.background = '#56971b';
      topPill7El.style.borderColor = '#56971b';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'View in Olowo Dashboard & Send Another →';
      primaryCtaBtn.style.background = '#56971b';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else if (paymentCase === 'AWAITING_PAYMENT') {
    heroIcon.textContent = '🏦';
    heroIcon.style.background = '#d97706';
    statusPill.textContent = `Awaiting Bank Transfer (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fef3c7';
    statusPill.style.color = '#92400e';
    mainTitle.textContent = 'Awaiting your bank transfer';
    subtitle.textContent = `Your bank transfer order (${tx.transactionId} · Ref ${orderNo}) is registered. Once your bank transfer settles with MITO, funds will be disbursed to ${tx.beneficiaryName}.`;

    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #78350f, #d97706)';
    if (leftLabel) leftLabel.textContent = 'Amount awaiting bank transfer';
    if (youPaidEl) youPaidEl.textContent = formattedSend;
    if (amtArrow) amtArrow.textContent = '⏳';
    if (rightLabel) rightLabel.textContent = 'Estimated payout (Once transfer settles)';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = formattedRec;
      theyReceiveEl.style.color = '#fde68a';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `IN PROCESS (Awaiting Bank Transfer · ${rawMitoOrderStatus})`;
      detailStatusEl.style.color = '#b45309';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Initiated At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Awaiting Bank Transfer (`redirectUrl`)';
      stepBadgeEl.style.background = '#fef3c7';
      stepBadgeEl.style.color = '#92400e';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#b45309';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '7. Awaiting Transfer';
      topPill7El.style.background = '#d97706';
      topPill7El.style.borderColor = '#d97706';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'Track Bank Transfer in Olowo Dashboard →';
      primaryCtaBtn.style.background = '#d97706';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else if (paymentCase === 'IN_REVIEW') {
    heroIcon.textContent = '⏳';
    heroIcon.style.background = '#d97706';
    statusPill.textContent = `Transfer In Process · Under Review (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fef3c7';
    statusPill.style.color = '#92400e';
    mainTitle.textContent = 'Payment is being processed';
    subtitle.textContent = `Your payment (${tx.transactionId} · Ref ${orderNo}) is in process and awaiting settlement/compliance clearance from MITO.`;

    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #78350f, #d97706)';
    if (leftLabel) leftLabel.textContent = 'Amount in process (Awaiting bank settlement)';
    if (youPaidEl) youPaidEl.textContent = formattedSend;
    if (amtArrow) amtArrow.textContent = '⏳';
    if (rightLabel) rightLabel.textContent = 'Estimated payout (Upon settlement)';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = formattedRec;
      theyReceiveEl.style.color = '#fde68a';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `IN PROCESS (Pending Settlement · ${rawMitoOrderStatus})`;
      detailStatusEl.style.color = '#b45309';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Submitted At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Payment In Process (`redirectUrl`)';
      stepBadgeEl.style.background = '#fef3c7';
      stepBadgeEl.style.color = '#92400e';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#b45309';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '7. In Process';
      topPill7El.style.background = '#d97706';
      topPill7El.style.borderColor = '#d97706';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'Track Transfer Status in Olowo Dashboard →';
      primaryCtaBtn.style.background = '#d97706';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else if (paymentCase === 'CANCELLED') {
    heroIcon.textContent = '🚫';
    heroIcon.style.background = '#dc2626';
    statusPill.textContent = `Payment Cancelled by User (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    mainTitle.textContent = 'Payment was cancelled';
    subtitle.textContent = `You cancelled or closed the MITO payment checkout for transaction ${tx.transactionId}. No funds were debited.`;

    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #7f1d1d, #dc2626)';
    if (leftLabel) leftLabel.textContent = 'Payment status (No funds debited)';
    if (youPaidEl) youPaidEl.textContent = `${sendSym}0.00 charged (Attempted: ${formattedSend})`;
    if (amtArrow) amtArrow.textContent = '✕';
    if (rightLabel) rightLabel.textContent = 'Payout status';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = 'Transfer cancelled (Payment did not happen)';
      theyReceiveEl.style.color = '#fecaca';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `CANCELLED (${rawMitoOrderStatus} — ${sendSym}0.00 Debited)`;
      detailStatusEl.style.color = '#dc2626';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Cancelled At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Payment Cancelled (`redirectUrl`)';
      stepBadgeEl.style.background = '#fee2e2';
      stepBadgeEl.style.color = '#991b1b';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#991b1b';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '7. Payment Cancelled';
      topPill7El.style.background = '#dc2626';
      topPill7El.style.borderColor = '#dc2626';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'Return to Olowo Dashboard →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else if (paymentCase === 'EXPIRED') {
    heroIcon.textContent = '⌛';
    heroIcon.style.background = '#dc2626';
    statusPill.textContent = `Payment Session Expired (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    mainTitle.textContent = 'Payment session expired';
    subtitle.textContent = `The MITO payment session for transaction ${tx.transactionId} timed out before payment was completed. No funds were debited — returning to Dashboard.`;

    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #7f1d1d, #dc2626)';
    if (leftLabel) leftLabel.textContent = 'Payment status (No funds debited)';
    if (youPaidEl) youPaidEl.textContent = `${sendSym}0.00 charged (Attempted: ${formattedSend})`;
    if (amtArrow) amtArrow.textContent = '✕';
    if (rightLabel) rightLabel.textContent = 'Payout status';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = 'Session expired (Payment did not happen)';
      theyReceiveEl.style.color = '#fecaca';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `EXPIRED (${rawMitoOrderStatus} — ${sendSym}0.00 Debited)`;
      detailStatusEl.style.color = '#dc2626';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Expired At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Payment Session Expired (`redirectUrl`)';
      stepBadgeEl.style.background = '#fee2e2';
      stepBadgeEl.style.color = '#991b1b';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#991b1b';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '4. Session Expired';
      topPill7El.style.background = '#dc2626';
      topPill7El.style.borderColor = '#dc2626';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'Return to Olowo Dashboard →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else {
    heroIcon.textContent = '✕';
    heroIcon.style.background = '#dc2626';
    statusPill.textContent = `Payment Failed or Declined (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    mainTitle.textContent = 'Payment failed — was not completed';
    subtitle.textContent = `No funds were debited for transaction ${tx.transactionId}. Showing failed payment status before redirecting you to the Dashboard.`;

    // Payment did NOT happen — do NOT say "You paid" or "Recipient receives", and use Red colour!
    if (amountBanner) amountBanner.style.background = 'linear-gradient(135deg, #7f1d1d, #dc2626)';
    if (leftLabel) leftLabel.textContent = 'Payment status (No funds debited)';
    if (youPaidEl) youPaidEl.textContent = `${sendSym}0.00 charged (Attempted: ${formattedSend})`;
    if (amtArrow) amtArrow.textContent = '✕';
    if (rightLabel) rightLabel.textContent = 'Payout status';
    if (theyReceiveEl) {
      theyReceiveEl.textContent = 'Transfer not sent (Payment did not happen)';
      theyReceiveEl.style.color = '#fecaca';
    }
    if (detailStatusEl) {
      detailStatusEl.textContent = `FAILED (${rawMitoOrderStatus} — ${sendSym}0.00 Debited)`;
      detailStatusEl.style.color = '#dc2626';
    }
    if (timeLabelEl) timeLabelEl.textContent = 'Attempted At';
    if (stepBadgeEl) {
      stepBadgeEl.textContent = 'Step 7 of 7 · Payment Failed / Not Completed (`redirectUrl`)';
      stepBadgeEl.style.background = '#fee2e2';
      stepBadgeEl.style.color = '#991b1b';
    }
    if (txBadgeEl) {
      txBadgeEl.style.background = '#991b1b';
      txBadgeEl.style.color = '#ffffff';
    }
    if (topPill7El) {
      topPill7El.textContent = '4. Payment Failed';
      topPill7El.style.background = '#dc2626';
      topPill7El.style.borderColor = '#dc2626';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = 'Return to Olowo Dashboard →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  }

  document.getElementById('succDetailTxId').textContent = tx.transactionId;
  document.getElementById('succDetailRateId').textContent = tx.rateId;
  document.getElementById('succDetailRate').textContent = `${sendSym}1.00 = ${recSym}${Number(tx.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  document.getElementById('succDetailMethod').textContent = paymentMethod;
  document.getElementById('succDetailTime').textContent = new Date(tx.completedAt || Date.now()).toLocaleString();

  document.getElementById('succSenderName').textContent = tx.senderName;
  document.getElementById('succSenderId').textContent = tx.senderId;
  document.getElementById('succSenderKyc').textContent = `${tx.senderKycStatus} (${tx.senderKycTier})`;

  document.getElementById('succBenName').textContent = tx.beneficiaryName;
  document.getElementById('succBenId').textContent = tx.beneficiaryId;
  document.getElementById('succBenBank').textContent = tx.providerName;
  document.getElementById('succBenMode').textContent = tx.collectionMode;

  // Also update the Redirect Result Banner on the main Dashboard with matching status colour and copy
  const dashCard = document.getElementById('redirectResultCard');
  if (dashCard) {
    dashCard.classList.remove('hidden');
    const isSucc = normalizedStatus === 'SUCCESS';
    const isPend = normalizedStatus === 'PENDING';
    dashCard.style.background = isSucc ? '#f0fdf4' : isPend ? '#fffbeb' : '#fef2f2';
    dashCard.style.borderColor = isSucc ? '#86efac' : isPend ? '#fcd34d' : '#fca5a5';
    const headColor = isSucc ? '#166534' : isPend ? '#92400e' : '#991b1b';
    const btnBg = isSucc ? '#56971b' : isPend ? '#d97706' : '#dc2626';
    const descHtml = isSucc
      ? `Paid <strong>${formattedSend}</strong> → Recipient receives <strong>${formattedRec}</strong> (${tx.beneficiaryName} · ${tx.providerName})`
      : isPend
      ? `In Process (${rawMitoOrderStatus}): <strong>${formattedSend}</strong> awaiting bank settlement → Est. payout <strong>${formattedRec}</strong> (${tx.beneficiaryName})`
      : `Payment not completed (${rawMitoOrderStatus} · <strong>${sendSym}0.00 debited</strong> · Attempted ${formattedSend}) — Transfer to <strong>${tx.beneficiaryName}</strong> was not sent`;

    dashCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <strong style="color:${headColor};">${isSucc ? '✅' : isPend ? '⏳' : '❌'} Latest Redirect Result Captured (<code>${tx.transactionId}</code> — ${rawMitoOrderStatus})</strong>
          <div style="font-size:12.5px;color:#57534e;margin-top:3px;">
            ${descHtml} · Locked Rate ID: <code>${tx.rateId}</code>
          </div>
        </div>
        <button type="button" class="olowo-btn-green sm" style="background:${btnBg};" onclick="jumpToView('success')">View Details →</button>
      </div>
    `;
  }

  // Navigate to the Payment Status Page (`view-success`) first, then automatically redirect to Dashboard (`view-dashboard`)!
  jumpToView('success');
  startStatusPageToDashboardCountdown(4, normalizedStatus, rawMitoOrderStatus);

  // After successful payment (or pending settlement), automatically retrieve the added beneficiaries via GET /api/v1/mito/Beneficiary!
  if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'PENDING') {
    retrieveAddedBeneficiariesAfterPayment(tx);
  } else {
    const benCard = document.getElementById('succRetrievedBeneficiariesCard');
    if (benCard) benCard.classList.add('hidden');
  }
}

async function retrieveAddedBeneficiariesAfterPayment(tx = null) {
  const activeTx = tx || (STATE.transactions && STATE.transactions[0]) || null;
  const senderId = (activeTx && activeTx.senderId) || STATE.senderId || '';
  const userId =
    (activeTx && (activeTx.mitoUserId || activeTx.userId)) ||
    STATE.sender.mitoUserId ||
    STATE.sender.userId ||
    STATE.senderId ||
    '';
  const txId = (activeTx && activeTx.transactionId) || STATE.transactionId || '';

  const endpointUrl = `/api/v1/mito/Beneficiary?senderId=${encodeURIComponent(senderId)}&userId=${encodeURIComponent(userId)}&transactionId=${encodeURIComponent(txId)}`;
  const res = await callApi('GET', endpointUrl);
  if (!res.ok || !Array.isArray(res.data?.data)) return;

  const list = res.data.data;
  STATE.savedBeneficiaries = list;

  // Update the Step 4 saved beneficiaries counter/list if present
  const savedCountEl = document.getElementById('savedBeneficiariesCount');
  if (savedCountEl) savedCountEl.textContent = String(list.length);
  renderSavedBeneficiariesCards();

  // Update the Payment Status page (`view-success`) with the retrieved added beneficiaries
  const benCard = document.getElementById('succRetrievedBeneficiariesCard');
  const benListEl = document.getElementById('succRetrievedBeneficiariesList');
  const benCountBadge = document.getElementById('succRetrievedBenCountBadge');
  const benEpEl = document.getElementById('succRetrievedBenEndpoint');

  if (benEpEl) {
    benEpEl.textContent = `GET /api/v1/mito/Beneficiary?userId=${userId}`;
  }
  if (benCountBadge) {
    benCountBadge.textContent = `${list.length} Added ${list.length === 1 ? 'Beneficiary' : 'Beneficiaries'} Retrieved`;
  }

  if (list.length > 0) {
    const latestBen = list[list.length - 1];
    const fullName =
      (latestBen.fields && (latestBen.fields.fullName || `${latestBen.fields.firstName || ''} ${latestBen.fields.lastName || ''}`.trim())) ||
      'Retrieved Beneficiary';
    const bankName = latestBen.providerName || (activeTx && activeTx.providerName) || 'Selected Beneficiary Bank';

    // Update the main receipt Beneficiary fields on `view-success`
    const succBenNameEl = document.getElementById('succBenName');
    const succBenIdEl = document.getElementById('succBenId');
    const succBenBankEl = document.getElementById('succBenBank');
    if (succBenNameEl) succBenNameEl.textContent = fullName;
    if (succBenIdEl) succBenIdEl.textContent = latestBen.beneficiaryId;
    if (succBenBankEl) succBenBankEl.textContent = bankName;

    // Also update the active transaction record in STATE.transactions
    if (activeTx) {
      activeTx.beneficiaryId = latestBen.beneficiaryId;
      activeTx.beneficiaryName = fullName;
      activeTx.providerName = bankName;
      renderTransactionsList();
    }

    if (benCard && benListEl) {
      benCard.classList.remove('hidden');
      benListEl.innerHTML = list
        .map(b => {
          const bName =
            (b.fields && (b.fields.fullName || `${b.fields.firstName || ''} ${b.fields.lastName || ''}`.trim())) ||
            'Beneficiary';
          const acc = String((b.fields && (b.fields.accountNumber || b.fields.iban)) || '0123456789');
          return `
            <div style="background:#ffffff;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <strong style="color:#14532d;font-size:13.5px;">👤 ${bName}</strong>
                <span class="mono-pill" style="margin-left:6px;">${b.beneficiaryId}</span>
                <div style="font-size:12px;color:#475569;margin-top:3px;">
                  🏦 <strong>${b.providerName || 'Bank'}</strong> (${b.collectionMode || 'BANKACCOUNT'}) · Account: <code>•••• ${acc.slice(-4)}</code> · Country: <strong>${b.receiveCountryIso3 || 'NGA'} (${b.receiveCurrency || 'NGN'})</strong>
                </div>
              </div>
              <span class="mono-pill" style="background:#dcfce7;color:#166534;border:1px solid #86efac;">✓ Retrieved from MITO</span>
            </div>
          `;
        })
        .join('');
    }
  }

  // Also render the Retrieved Added Beneficiaries box on the Dashboard (`view-dashboard`)
  renderDashboardRetrievedBeneficiaries();
}

function renderDashboardRetrievedBeneficiaries() {
  const dashBox = document.getElementById('dashboardBeneficiariesListBox');
  if (!dashBox) return;
  const list = STATE.savedBeneficiaries || [];
  if (list.length === 0) {
    dashBox.innerHTML =
      '<div class="no-transfers-empty">No beneficiaries retrieved yet. Complete a payment to automatically retrieve added beneficiaries from MITO.</div>';
    return;
  }

  dashBox.innerHTML = list
    .map(b => {
      const bName =
        (b.fields && (b.fields.fullName || `${b.fields.firstName || ''} ${b.fields.lastName || ''}`.trim())) ||
        'Beneficiary';
      const acc = String((b.fields && (b.fields.accountNumber || b.fields.iban)) || '0123456789');
      return `
        <div class="tx-history-row" style="border-color:#bbf7d0;background:#f0fdf4;">
          <div>
            <strong style="color:#14532d;">👤 ${bName}</strong> <span class="mono-pill">${b.beneficiaryId}</span>
            <div style="font-size:12px;color:#334155;margin-top:3px;">
              🏦 <strong>${b.providerName || 'Selected Bank'}</strong> (${b.collectionMode || 'BANKACCOUNT'}) · Account: <code>•••• ${acc.slice(-4)}</code> · ${b.receiveCountryIso3 || 'NGA'} (${b.receiveCurrency || 'NGN'})
            </div>
          </div>
          <div style="text-align:right;">
            <span class="tx-status-tag SUCCESS">✓ Retrieved Beneficiary</span>
          </div>
        </div>
      `;
    })
    .join('');
}

let statusPageRedirectInterval = null;

function clearStatusPageAutoRedirectTimer() {
  if (statusPageRedirectInterval) {
    clearInterval(statusPageRedirectInterval);
    statusPageRedirectInterval = null;
  }
}

function cancelStatusPageAutoRedirect() {
  clearStatusPageAutoRedirectTimer();
  const txtEl = document.getElementById('succAutoRedirectText');
  if (txtEl) {
    txtEl.innerHTML = `⏸ Auto-redirect paused — You can review this Payment Status page and click <strong>"Go to Dashboard Now →"</strong> whenever ready.`;
  }
}

function redirectFromStatusPageToDashboardNow() {
  clearStatusPageAutoRedirectTimer();
  jumpToView('dashboard');
}

function startStatusPageToDashboardCountdown(seconds = 4, normalizedStatus = 'SUCCESS', rawMitoOrderStatus = 'READYTOPROCESS') {
  clearStatusPageAutoRedirectTimer();
  const totalSec = Math.max(1, seconds);
  let rem = totalSec;
  const banner = document.getElementById('succAutoRedirectBanner');
  const txtEl = document.getElementById('succAutoRedirectText');
  const progBar = document.getElementById('succAutoRedirectProgressBar');
  const isSucc = normalizedStatus === 'SUCCESS';
  const isPend = normalizedStatus === 'PENDING';
  if (banner) {
    banner.classList.remove('hidden');
    banner.style.background = isSucc ? '#f0fdf4' : isPend ? '#fffbeb' : '#fef2f2';
    banner.style.borderColor = isSucc ? '#86efac' : isPend ? '#fcd34d' : '#fca5a5';
    banner.style.color = isSucc ? '#14532d' : isPend ? '#92400e' : '#991b1b';
  }
  if (progBar) {
    progBar.style.background = isSucc ? '#16a34a' : isPend ? '#d97706' : '#dc2626';
    progBar.style.width = '100%';
  }
  const updateBannerText = () => {
    if (txtEl) {
      const statusLabel =
        normalizedStatus === 'SUCCESS'
          ? `✅ Payment Successful (${rawMitoOrderStatus})`
          : normalizedStatus === 'PENDING'
          ? `⏳ Payment In Process (${rawMitoOrderStatus})`
          : `❌ Payment Failed / Not Completed (${rawMitoOrderStatus})`;
      txtEl.innerHTML = `${statusLabel} — Showing Payment Status page and redirecting to <strong>Dashboard</strong> in <strong>${rem}s</strong>...`;
    }
    if (progBar) {
      const pct = Math.max(0, Math.min(100, ((rem - 0.5) / totalSec) * 100));
      progBar.style.width = `${pct}%`;
    }
  };
  updateBannerText();

  statusPageRedirectInterval = setInterval(() => {
    rem -= 1;
    if (rem <= 0) {
      if (progBar) progBar.style.width = '0%';
      clearStatusPageAutoRedirectTimer();
      if (STATE.currentView === 'success') {
        jumpToView('dashboard');
      }
      return;
    }
    updateBannerText();
  }, 1000);
}

// ============================================================================
// TRANSACTIONS HISTORY ON DASHBOARD
// ============================================================================
function filterTransactions(statusFilter, btnEl) {
  STATE.txFilter = statusFilter;
  if (btnEl) {
    document.querySelectorAll('.tx-pill').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
  renderTransactionsList();
}

function renderTransactionsList() {
  const box = document.getElementById('transactionsListBox');
  if (!box) return;

  const list = STATE.transactions.filter(tx => STATE.txFilter === 'ALL' || tx.paymentStatus === STATE.txFilter);
  if (list.length === 0) {
    box.innerHTML = '<div class="no-transfers-empty">No transfers yet.</div>';
    return;
  }

  box.innerHTML = list
    .map(
      tx => `
      <div class="tx-history-row">
        <div>
          <strong>${tx.beneficiaryName}</strong> <span class="mono-pill">${tx.transactionId}</span>
          <div style="font-size:12px;color:#78716c;margin-top:2px;">
            ${tx.providerName} (${tx.collectionMode}) · Rate ID: <code>${tx.rateId}</code>
          </div>
        </div>
        <div style="text-align:right;">
          <div><strong>${tx.sendCurrency} ${Number(tx.sendAmount).toLocaleString()} → ${tx.receiveCurrency} ${Number(tx.receiveAmount).toLocaleString()}</strong></div>
          <span class="tx-status-tag ${tx.paymentStatus}">${tx.paymentStatus}</span>
        </div>
      </div>
    `
    )
    .join('');
}

// ============================================================================
// INSPECTOR MODAL (API LOGS & WIREFRAMES)
// ============================================================================
function openInspectorModal(tab) {
  document.getElementById('inspectorModalBackdrop').classList.remove('hidden');
  switchInspectorTab(tab || 'logs');
}

function closeInspectorModal() {
  document.getElementById('inspectorModalBackdrop').classList.add('hidden');
}

function switchInspectorTab(tab) {
  document.getElementById('tabBtnLogs').classList.toggle('active', tab === 'logs');
  document.getElementById('tabBtnWireframes').classList.toggle('active', tab === 'wireframes');
  document.getElementById('inspPanelLogs').classList.toggle('hidden', tab !== 'logs');
  document.getElementById('inspPanelWireframes').classList.toggle('hidden', tab !== 'wireframes');
}

// Initialize on DOMContentLoaded — If arriving via /remittances/callback redirect URL (?mito_callback=1), open Step 7 Result Page; otherwise start from Step 1
window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mito_callback') === '1' && params.get('transactionId')) {
    // If /remittances/callback loaded inside the embedded MITO payment iframe, break out to the top-level window automatically!
    if (window.top && window.top !== window.self) {
      window.top.location.href = window.location.href;
      return;
    }
    const txId = params.get('transactionId');
    const status = (params.get('status') || 'SUCCESS').toUpperCase();
    const paymentCase = params.get('paymentCase') || '';
    const orderStatus = params.get('orderStatus') || status;
    const orderNo = params.get('orderNo') || '';
    const callbackUrl = params.get('callbackUrl') || window.location.href;
    const txRes = await callApi('GET', `/api/v1/mito/Transactions/${encodeURIComponent(txId)}`);
    if (txRes.ok && txRes.data && txRes.data.data) {
      const tx = txRes.data.data;
      STATE.transactionId = tx.transactionId;
      if (tx.userId || tx.mitoUserId || tx.senderId) {
        STATE.senderId = tx.userId || tx.mitoUserId || tx.senderId;
        STATE.sender.senderId = STATE.senderId;
        STATE.sender.userId = tx.userId || tx.mitoUserId || STATE.senderId;
        STATE.sender.mitoUserId = tx.mitoUserId || tx.userId || STATE.senderId;
      }
      refreshDashboardHeader();
      fetchQuoteLive();
      renderStep7TransactionResult(tx, orderStatus, tx.paymentMethod || 'MITO Hosted Payment', callbackUrl, {
        paymentCase,
        rawMitoOrderStatus: orderStatus,
        orderNo
      });
      return;
    }
  }

  refreshDashboardHeader();
  jumpToView('register');
});
