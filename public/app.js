/* ============================================================================
   OLOWO.APP × MITO.MONEY — FULL-SCREEN 7-STEP REMITTANCE FLOW CONTROLLER
   ============================================================================ */

const STATE = {
  currentView: 'register',
  // Step 1: Saved Sender / User Session
  senderId: 'SND-928C974B',
  sender: {
    senderId: 'SND-928C974B',
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
    provider: null,
    reason: null,
    sof: null,
    relationship: null
  },
  beneficiaryId: null,
  activeBeneficiary: null,
  savedBeneficiaries: [],

  // Step 5 & 6: Locked Rate & Hosted Transaction
  rateId: null,
  lockedRate: null,
  transactionId: null,
  paymentUrl: null,
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
  const pill6Pay = document.getElementById('flowPillStep6Pay');
  const pill7 = document.getElementById('flowPillStep7');
  const summaryStrip = document.getElementById('flowHighLevelSummaryStrip');

  if (isExistingFlow) {
    // Existing User Flow: Logs in -> Checks rate -> Locks rate -> Selects beneficiary & makes payment -> Sees status -> Returns to dashboard
    // Step 3 (MITO User Data & KYC QR Code) is completely hidden because KYC is PASSED and MITO does not send hosted KYC link!
    if (pill1) pill1.textContent = '1. Log In (Existing User)';
    if (pill2) pill2.textContent = '2. Check & Lock Rate';
    if (pill3Kyc) pill3Kyc.classList.add('hidden');
    if (pill4Ben) pill4Ben.textContent = '3. Select Beneficiary';
    if (pill6Pay) pill6Pay.textContent = '4. Make Payment';
    if (pill7) pill7.textContent = '5. See Status & Dashboard';
    if (summaryStrip) {
      summaryStrip.style.background = '#eff6ff';
      summaryStrip.style.color = '#1e3a8a';
      summaryStrip.innerHTML =
        `🔁 <strong>Active Flow 2 — Existing User (<code>${STATE.sender?.email || 'ahmed.diallo@mitonetwork.com'}</code> · KYC Passed):</strong> ` +
        `Logs in → Checks rate → Locks rate (<code>POST /Exchange/rates</code>) → <strong>[MITO User Data &amp; Hosted KYC QR Skipped — <code>requiredAction.kyc: null</code>]</strong> → Selects beneficiary &amp; makes payment → Sees status (<code>/remittances/callback</code>) → Returns to dashboard`;
    }
  } else {
    // New User Flow: Registers -> Checks rates -> Locks rate -> Enters remaining MITO data -> Passes KYC -> Adds beneficiary -> Makes payment -> Sees status -> Returns to dashboard
    const kycAlreadyPassed = STATE.sender && STATE.sender.kycStatus === 'PASSED';
    if (pill1) pill1.textContent = '1. Register (New User)';
    if (pill2) pill2.textContent = '2. Check & Lock Rate';
    if (pill3Kyc) {
      pill3Kyc.classList.remove('hidden');
      pill3Kyc.textContent = kycAlreadyPassed ? '3. MITO User Data & KYC (✓ Passed)' : '3. MITO User Data & Pass KYC';
    }
    if (pill4Ben) pill4Ben.textContent = '4. Add Beneficiary';
    if (pill6Pay) pill6Pay.textContent = '5. Make Payment';
    if (pill7) pill7.textContent = '6. See Status & Dashboard';
    if (summaryStrip) {
      summaryStrip.style.background = '#f0fdf4';
      summaryStrip.style.color = '#14532d';
      summaryStrip.innerHTML =
        `🆕 <strong>Active Flow 1 — New User Registration:</strong> ` +
        `Registers → Checks rates → Locks rate (<code>POST /Exchange/rates</code>) → Enters required/remaining data needed by MITO for user creation (<code>POST /Users</code>) → Passes KYC (Hosted KYC QR) → Adds beneficiary (<code>POST /Beneficiary</code>) → Makes payment → Sees status (<code>/remittances/callback</code>) → Returns to dashboard`;
    }
  }
}

function handleTopBarAuthClick() {
  const isExisting =
    STATE.flowMode === 'EXISTING_USER' ||
    Boolean(STATE.sender && STATE.sender.isSubmittedToMito && STATE.sender.kycStatus === 'PASSED');
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
      senderId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
      userId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
      mitoUserId: 'be6b86a7-8484-43df-9af6-09a1d871b8a1',
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
      isSubmittedToMito: true,
      kycStatus: 'PASSED',
      kycTier: 'MINI_KYC'
    };
    STATE.senderId = 'be6b86a7-8484-43df-9af6-09a1d871b8a1';
    updateTopFlowBarForUserState();
    jumpToView('login');
  } else {
    fillRegistrationPreset('david_incomplete');
    STATE.sender = {
      senderId: 'SND-928C974B',
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
      isSubmittedToMito: false,
      kycStatus: 'NOT_STARTED',
      kycTier: 'NONE'
    };
    STATE.senderId = 'SND-928C974B';
    updateTopFlowBarForUserState();
    jumpToView('register');
  }
}

function jumpToView(viewName) {
  // USER RULE: "if KYC is passed then we will not show the user QR code. Mito will not send the hosted KYC link to balad, this page will skip"
  if (
    viewName === 'kyc' &&
    STATE.sender &&
    STATE.sender.kycStatus === 'PASSED' &&
    !STATE.forceAllowKycEdit
  ) {
    viewName = 'beneficiary';
  }

  const allViews = ['login', 'register', 'dashboard', 'kyc', 'beneficiary', 'summary', 'payment', 'success'];
  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
  });
  STATE.currentView = viewName;
  updateTopFlowBarForUserState();

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
    renderTransactionsList();
  } else if (viewName === 'kyc') {
    refreshKycCompletenessBanner();
  } else if (viewName === 'beneficiary') {
    loadStep4BeneficiaryMetadata();
  } else if (viewName === 'summary') {
    populateSummaryView();
  } else if (viewName === 'payment') {
    if (!STATE.paymentCheckoutUrl && !STATE.isInitiatingPayment) {
      handleConfirmSummaryAndInitiatePayment();
    }
  } else if (viewName === 'success') {
    if (rateCountdownInterval) {
      clearInterval(rateCountdownInterval);
      rateCountdownInterval = null;
    }
  }

  // Show the side Rate Lock & Countdown Widget whenever a rate is locked and user is in active checkout steps (2..6)
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
// STEP 1: USER REGISTRATION & SIGN IN (`/register` & `/login`)
// ============================================================================
function fillRegistrationPreset(presetKey) {
  document.querySelectorAll('.preset-chip').forEach((btn, idx) => {
    btn.classList.toggle('active', (presetKey === 'david_incomplete' && idx === 0) || (presetKey === 'ahmed_complete' && idx === 1));
  });

  if (presetKey === 'ahmed_complete') {
    document.getElementById('regFullName').value = 'Ahmed Diallo';
    document.getElementById('regEmail').value = 'ahmed.diallo@mitonetwork.com';
    document.getElementById('regPhone').value = '+44 7700900456';
    STATE.presetMode = 'ahmed_complete';
    STATE.flowMode = 'EXISTING_USER';
  } else {
    document.getElementById('regFullName').value = 'David Beckham';
    document.getElementById('regEmail').value = 'mohammadmumtazkhan+24@example.com';
    document.getElementById('regPhone').value = '+44 7553039222';
    STATE.presetMode = 'david_incomplete';
    STATE.flowMode = 'NEW_USER';
  }
}

async function handleRegisterSubmit(event) {
  if (event) event.preventDefault();

  const fullName = document.getElementById('regFullName').value.trim() || 'David Beckham';
  const email = document.getElementById('regEmail').value.trim() || 'mohammadmumtazkhan+24@example.com';
  const phoneDialCode = document.getElementById('regDialCode').value || '+44';
  const rawPhone = document.getElementById('regPhone').value.replace(/^\+44\s*/, '').trim() || '7553039222';
  const baseCurrency = document.getElementById('regBaseCurrency').value || 'GBP';
  const isAhmed = email.toLowerCase().includes('ahmed');

  // Step 1 creates the local Olowo account ONLY (`POST /api/olowo/auth/register`).
  // Per rule: "we will submit a user only when we collect the full info of the user" (in Step 3 for New Users!).
  const payload = {
    fullName,
    email,
    phoneDialCode,
    phone: rawPhone,
    baseCurrency,
    presetMode: isAhmed ? 'ahmed_complete' : (STATE.presetMode || 'david_incomplete'),
    forceResetKyc: !isAhmed
  };

  const { ok, data } = await callApi('POST', '/api/olowo/auth/register', payload);
  if (ok && data.data) {
    STATE.sender = {
      ...data.data,
      screenName: data.data.firstName
    };
    STATE.senderId = data.data.senderId;
    STATE.flowMode = (STATE.sender.isSubmittedToMito && STATE.sender.kycStatus === 'PASSED') ? 'EXISTING_USER' : 'NEW_USER';
    STATE.forceAllowKycEdit = false;
    updateTopFlowBarForUserState();

    // Pre-fill Step 3 inputs with the Olowo / MITO user info
    document.getElementById('profLegalName').value = `${STATE.sender.firstName} ${STATE.sender.lastName}`;
    document.getElementById('profScreenName').value = STATE.sender.firstName;
    document.getElementById('profPhone').value = STATE.sender.phone;
    document.getElementById('linkedDisplayScreenName').textContent = STATE.sender.firstName;
    document.getElementById('linkedDisplayLegalName').textContent = `${STATE.sender.firstName} ${STATE.sender.lastName}`;
    document.getElementById('linkedDisplayPhone').textContent = `${phoneDialCode} ${STATE.sender.phone}`;
    document.getElementById('senderEmailInput').value = STATE.sender.email;
    const fullPhoneEl = document.getElementById('senderPhoneFullInput');
    if (fullPhoneEl) fullPhoneEl.value = `${phoneDialCode}${rawPhone}`;
    document.getElementById('senderFirstNameInput').value = STATE.sender.firstName;
    document.getElementById('senderLastNameInput').value = STATE.sender.lastName;
    if (STATE.sender.dob) document.getElementById('senderDobInput').value = STATE.sender.dob;
    if (STATE.sender.buildingNumber) document.getElementById('senderBuildingNumberInput').value = STATE.sender.buildingNumber;
    if (STATE.sender.street || STATE.sender.address) {
      document.getElementById('senderAddress1Input').value = String(STATE.sender.street || STATE.sender.address).replace(/^23\s+/, '');
    }
    if (STATE.sender.city) document.getElementById('senderCityInput').value = STATE.sender.city;
    if (STATE.sender.postcode) document.getElementById('senderPostcodeInput').value = STATE.sender.postcode;
    checkSenderDetailsChangedLive();
  }

  // Navigate directly to Dashboard (Rate Check & Lock Rate) without auto-blocking with the Weather Modal
  jumpToView('dashboard');
  const alertEl = document.getElementById('dashAlertText');
  if (alertEl) {
    if (STATE.sender.isSubmittedToMito && STATE.sender.kycStatus === 'PASSED') {
      alertEl.innerHTML =
        `🔁 <strong>Flow 2 (Existing User Signed In)</strong> · MITO <code>userId: ${STATE.sender.mitoUserId || STATE.senderId}</code> · ` +
        `<strong>KYC Status: PASSED</strong> (MITO will NOT send Hosted KYC Link / QR — clicking Lock Rate &amp; Continue skips directly to Select Beneficiary!)`;
    } else {
      alertEl.innerHTML =
        `🆕 <strong>Flow 1 (New User Registered)</strong> · Olowo ID: <code>${STATE.senderId}</code> · ` +
        `<strong>Next: Check rate → Lock rate → Enter remaining data for MITO User Creation (<code>POST /Users</code>) → Pass KYC → Add Beneficiary → Make Payment</strong>`;
    }
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
  document.getElementById('dashSenderIdBadge').textContent = STATE.senderId;
}

function setSendAmountQuick(amount) {
  document.getElementById('sendAmountInput').value = Number(amount).toFixed(2);
  document.querySelectorAll('.quick-amt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(`£${Number(amount).toLocaleString()}`));
  });
  handleSendAmountInput();
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

  const endpointTitle = document.getElementById('affiliateRateEndpointTitle');
  if (endpointTitle) {
    endpointTitle.textContent = `GET /api/v1/mito/Exchange/affiliateRates?FromCountry=${fromCountry}&ToCountry=${toCountry}&FromCurrency=${STATE.sendCurrency}&ToCurrency=${STATE.receiveCurrency}`;
  }

  const url = `/api/v1/mito/Exchange/affiliateRates?FromCountry=${encodeURIComponent(fromCountry)}&ToCountry=${encodeURIComponent(toCountry)}&FromCurrency=${encodeURIComponent(STATE.sendCurrency)}&ToCurrency=${encodeURIComponent(STATE.receiveCurrency)}&sendAmount=${encodeURIComponent(rawSend)}&collectionMode=${encodeURIComponent(STATE.collectionMode)}`;
  const { ok, data } = await callApi('GET', url);
  const q = data && (data.calculatedQuote || data.quote);
  if (ok && q) {
    STATE.customerRate = q.rateMoneyTransfer || q.customer_rate;
    STATE.partnerRate = q.partnerRateMoneyTransfer || q.partner_rate;
    STATE.receiveAmount = q.receive_amount;
    STATE.commission = q.commission;
    STATE.requiresExtendedKyc = q.requires_extended_kyc;

    const affPreview = document.getElementById('affiliateRateResponsePreview');
    if (affPreview) {
      affPreview.innerHTML =
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
      `${sendSym}1.00 to ${recSym}${Number(STATE.customerRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · affiliate commercial rate`;

    const tierText = q.requires_extended_kyc
      ? 'Extended-KYC / Full-KYC (≥ £5,000 GBP)'
      : 'Mini-KYC (< £5,000 GBP)';
    document.getElementById('corridorNotePill').innerHTML =
      `Corridor: <strong>${STATE.sendCurrency} → ${STATE.receiveCurrency} (${STATE.receiveCountryName})</strong> · Mode: <strong>${STATE.collectionMode}</strong> · KYC Tier: <strong>${tierText}</strong>`;
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
// CLICKING "CONTINUE TO CHECKOUT" -> IMMEDIATELY LOCKS RATE (`POST /api/v1/mito/Exchange/rates`),
// STARTS LIVE EXPIRY COUNTDOWN ON THE SIDE, & PROCEEDS TO STEP 3
// ============================================================================
let rateCountdownInterval = null;

async function lockExchangeRateAfterRateScreen() {
  const rateRes = await callApi('POST', '/api/v1/mito/Exchange/rates', {
    senderId: STATE.senderId,
    beneficiaryId: STATE.beneficiaryId || null,
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

    const totalSec = STATE.lockedRate.rateExpirySeconds || 900;
    startRateCountdownTimer(totalSec);
    return true;
  }
  return false;
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
      `You have been redirected to the <strong>Rate &amp; Corridor screen</strong>. Fresh commercial rates have been loaded — click <strong>"Lock Rate &amp; Continue to checkout"</strong> to lock a new rate.`;
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

  // 1. Lock the exchange rate immediately after the Rate & Corridor screen!
  await lockExchangeRateAfterRateScreen();

  // 2. Check sender completeness & note corridor (Rule: at new user creation check emailId, after that check userId!)
  const payload = {
    userId: STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId,
    senderId: STATE.senderId,
    email: STATE.sender.email,
    corridorCode: STATE.corridorCode,
    sendCurrency: STATE.sendCurrency,
    receiveCurrency: STATE.receiveCurrency,
    receiveCountryIso3: STATE.receiveCountryIso3,
    collectionMode: STATE.collectionMode,
    sendAmount: STATE.sendAmount
  };

  const { ok, data } = await callApi('POST', '/api/v1/mito/Sender/CheckStatusAndCorridor', payload);
  if (ok && data.data) {
    STATE.sender = { ...STATE.sender, ...data.data.sender };
    STATE.senderId = STATE.sender.userId || STATE.sender.mitoUserId || STATE.sender.senderId || STATE.senderId;
    const check = data.data;

    document.getElementById('kycCorridorBadge').textContent =
      `${STATE.sendCurrency} → ${STATE.receiveCurrency} · ${STATE.sendCurrency} ${Number(STATE.sendAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} · Locked Rate: ${STATE.rateId ? STATE.rateId.slice(0, 8) + '...' : ''}`;

    // USER RULE:
    // "for an existing sender don't show the sender selection or forms. Forms will only show for new user/beneficiary only"
    // "once KYC of a user passes we will not do KYC again for him until his address or other details changes"
    if (check.kycSkippedBecauseUnchanged && check.canProceedToBeneficiary) {
      const skipBanner = document.getElementById('kycSkippedNoticeBanner');
      if (skipBanner) {
        skipBanner.classList.remove('hidden');
        skipBanner.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              ✅ <strong>Flow 2 — Existing Verified User (<code>userId: ${STATE.senderId}</code> · <code>${STATE.sender.email}</code>) — KYC Passed &amp; Hosted KYC QR Skipped!</strong><br/>
              <span style="font-size:12px;">Because KYC is already <strong>PASSED</strong>, MITO does <strong>not</strong> send the hosted KYC link (<code>requiredAction.kyc: null</code>) and this page skipped Step 3 completely. Select a saved beneficiary below and click <strong>"Select Beneficiary &amp; Make Payment →"</strong>!</span>
            </div>
            <button type="button" class="olowo-btn-cancel" style="padding:6px 12px;font-size:12px;background:#fff;" onclick="openSenderFormForAddressChange()">
              ✏️ Change Sender Address / Details (Triggers Re-KYC)
            </button>
          </div>
        `;
      }
      // Jump straight from Screen 2 (Rate & Lock Rate) to Step 4 (Beneficiary)!
      jumpToView('beneficiary');
      return;
    }

    const skipBanner = document.getElementById('kycSkippedNoticeBanner');
    if (skipBanner) skipBanner.classList.add('hidden');

    // New user (or user needing Extended-KYC upgrade): Show Step 3 directly on the New User Sender Form (`address`), skipping sender profile selection!
    STATE.forceAllowKycEdit = true;
    jumpToView('kyc');
    switchSenderKycSubTab('address');
    checkSenderDetailsChangedLive();
  }
}

function openSenderFormForAddressChange() {
  STATE.forceAllowKycEdit = true;
  const pill3Kyc = document.getElementById('flowPillStep3Kyc');
  if (pill3Kyc) pill3Kyc.classList.remove('hidden');
  jumpToView('kyc');
  switchSenderKycSubTab('address');
  checkSenderDetailsChangedLive();
}

function handleBackFromBeneficiary() {
  // If existing verified sender skipped Step 3, Back goes directly to Screen 2 (Rate & Lock Rate)
  if (STATE.sender && STATE.sender.isSubmittedToMito && STATE.sender.kycStatus === 'PASSED') {
    jumpToView('dashboard');
  } else {
    STATE.forceAllowKycEdit = true;
    jumpToView('kyc');
    switchSenderKycSubTab('address');
  }
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
  const dateOfBirth = document.getElementById('senderDobInput').value.trim() || '1985-05-02';
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
    dob: document.getElementById('senderDobInput').value.trim() || STATE.sender.dob || '1985-05-02',
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
function populateDownwardDroplist(key, items, defaultItem) {
  STATE.selectedDroplists[key] = defaultItem || items[0] || null;
  const labelEl = document.getElementById(`droplistSelected-${key}`);
  if (labelEl && STATE.selectedDroplists[key]) {
    labelEl.textContent = STATE.selectedDroplists[key].name;
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
  const keys = ['provider', 'relationship', 'reason', 'sof'];
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
    provider: STATE.providers,
    relationship: STATE.relationships,
    reason: STATE.reasons,
    sof: STATE.sourceOfFunds
  };
  renderDroplistOptions(key, map[key] || [], query);
}

function selectDownwardDroplistItem(key, itemId) {
  const map = {
    provider: STATE.providers,
    relationship: STATE.relationships,
    reason: STATE.reasons,
    sof: STATE.sourceOfFunds
  };
  const found = (map[key] || []).find(i => i.id === itemId);
  if (found) {
    STATE.selectedDroplists[key] = found;
    const labelEl = document.getElementById(`droplistSelected-${key}`);
    if (labelEl) labelEl.textContent = found.name;
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
async function handleConfirmSummaryAndInitiatePayment() {
  if (STATE.isInitiatingPayment) return;
  STATE.isInitiatingPayment = true;
  try {
    // Ensure beneficiary exists in MITO if user jumped directly to Summary
    if (!STATE.beneficiaryId) {
      const savedRes = await callApi('GET', `/api/v1/mito/Beneficiary?senderId=${encodeURIComponent(STATE.senderId)}`);
      if (savedRes.ok && Array.isArray(savedRes.data?.data) && savedRes.data.data.length > 0) {
        const firstBen = savedRes.data.data[0];
        STATE.beneficiaryId = firstBen.beneficiaryId;
        STATE.beneficiary = firstBen;
      } else {
        await handleCreateAndSaveBeneficiary();
      }
    }

    // Use the rateId locked right after Screen 2 (Rate & Corridor screen); if not locked yet or expired, lock now
    if (!STATE.rateId || !STATE.lockedRate || (STATE.rateRemainingSeconds || 0) <= 0) {
      const lockedOk = await lockExchangeRateAfterRateScreen();
      if (!lockedOk) return;
    }

    const customRedirectUrl =
      document.getElementById('sumRedirectUrlInput')?.value.trim() ||
      `${window.location.origin || 'http://localhost:3000'}/remittances/callback`;
    const partnerRef =
      document.getElementById('sumPartnerRefInput')?.value.trim() ||
      `OLW-REF-${Date.now()}`;
    const narration =
      document.getElementById('benPaymentNarration')?.value.trim() ||
      document.getElementById('sumNarrationInput')?.value.trim() ||
      'Remittance transfer via Olowo / Balad';
    const selectedSofCode =
      (STATE.selectedDroplists.sof && STATE.selectedDroplists.sof.code) ||
      (STATE.activeBeneficiary && STATE.activeBeneficiary.sourceOfFunds && STATE.activeBeneficiary.sourceOfFunds.code) ||
      'SALARY';
    const selectedReasonCode =
      (STATE.selectedDroplists.reason && STATE.selectedDroplists.reason.code) ||
      (STATE.activeBeneficiary && STATE.activeBeneficiary.reason && STATE.activeBeneficiary.reason.code) ||
      'FOROWNEXPENDITURES';

    // Step 6: Initiate transaction submission using the locked rateId via POST /api/v1/mito/Transactions/InitiateHostedTransaction
    // Backend calls MITO Staging POST /Transactions/InitiateHostedTransaction and extracts ONLY requiredAction.payment.link!
    const txRes = await callApi('POST', '/api/v1/mito/Transactions/InitiateHostedTransaction', {
      userId: STATE.sender.userId || STATE.sender.mitoUserId || STATE.senderId,
      senderId: STATE.senderId,
      beneficiaryId: STATE.beneficiaryId,
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
    // Load ONLY requiredAction.payment.link from the response!
    const paymentOnly = txData.requiredActionPayment || {};
    const jCode = paymentOnly.journeyCode || txData.journeyCode || '';
    STATE.journeyCode = jCode;
    STATE.paymentUrl = paymentOnly.link || txData.paymentUrl;
    STATE.paymentCheckoutUrl =
      txData.paymentCheckoutUrl ||
      paymentOnly.directCheckoutLink ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/transaction?journeyCode=${encodeURIComponent(jCode)}`;
    STATE.redirectUrl = txData.redirectUrl || customRedirectUrl;

    // Update Payment Screen Badges with requiredAction.payment.link and redirectUrl
    document.getElementById('payRateIdBadge').textContent = `${STATE.rateId} · ${STATE.transactionId}`;
    document.getElementById('stripRateId').textContent = STATE.rateId;
    document.getElementById('stripTxId').textContent = STATE.transactionId;
    const refEl = document.getElementById('stripMitoRef');
    if (refEl) refEl.textContent = txData.reference || '';
    const jnyEl = document.getElementById('stripJourneyCode');
    if (jnyEl) jnyEl.textContent = jCode;
    document.getElementById('stripPaymentUrl').textContent = STATE.paymentUrl;
    const payLinkEl = document.getElementById('stripPaymentUrlLink');
    if (payLinkEl) payLinkEl.href = STATE.paymentCheckoutUrl || STATE.paymentUrl;
    const openBtnEl = document.getElementById('btnOpenLiveMitoPaymentLink');
    if (openBtnEl) openBtnEl.href = STATE.paymentCheckoutUrl || STATE.paymentUrl;
    const redirEl = document.getElementById('stripRedirectUrl');
    if (redirEl) redirEl.textContent = STATE.redirectUrl;

    // Load the REAL live MITO Hosted Payment Link Page directly inside #mitoLivePaymentIframe!
    loadMitoLivePaymentIframe(STATE.paymentCheckoutUrl, 'checkout');

    // Step 6: Open the MITO Hosted Payment Screen
    jumpToView('payment');
  } finally {
    STATE.isInitiatingPayment = false;
  }
}

function loadMitoLivePaymentIframe(targetUrl, mode = 'checkout') {
  const iframe = document.getElementById('mitoLivePaymentIframe');
  const urlBar = document.getElementById('mitoLiveIframeUrlBar');
  const btnCheckout = document.getElementById('btnMitoFrameModeCheckout');
  const btnQr = document.getElementById('btnMitoFrameModeQr');
  if (iframe && targetUrl) {
    iframe.src = targetUrl;
  }
  if (urlBar && targetUrl) {
    urlBar.textContent = `🔒 ${targetUrl}`;
  }
  if (btnCheckout && btnQr) {
    if (mode === 'checkout') {
      btnCheckout.className = 'olowo-btn-green sm';
      btnCheckout.style.cssText = 'font-size:11.5px;padding:5px 10px;';
      btnQr.className = 'olowo-btn-outline-green sm';
      btnQr.style.cssText = 'font-size:11.5px;padding:5px 10px;background:#1e293b;color:#e2e8f0;border-color:#475569;';
    } else {
      btnQr.className = 'olowo-btn-green sm';
      btnQr.style.cssText = 'font-size:11.5px;padding:5px 10px;';
      btnCheckout.className = 'olowo-btn-outline-green sm';
      btnCheckout.style.cssText = 'font-size:11.5px;padding:5px 10px;background:#1e293b;color:#e2e8f0;border-color:#475569;';
    }
  }
  STATE.mitoFrameMode = mode;
}

function switchMitoLivePaymentFrameMode(mode) {
  if (mode === 'qr') {
    const qrUrl =
      STATE.paymentUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com?journeyCode=${encodeURIComponent(STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(qrUrl, 'qr');
  } else {
    const checkoutUrl =
      STATE.paymentCheckoutUrl ||
      `https://mito-checkout-1cca8e18297e.herokuapp.com/transaction?journeyCode=${encodeURIComponent(STATE.journeyCode || '')}`;
    loadMitoLivePaymentIframe(checkoutUrl, 'checkout');
  }
}

function reloadMitoLivePaymentIframe() {
  switchMitoLivePaymentFrameMode(STATE.mitoFrameMode || 'checkout');
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
      primaryCtaBtn.textContent = '🔄 Reopen MITO Payment Checkout (Step 6) →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('payment');
    }
  } else if (paymentCase === 'EXPIRED') {
    heroIcon.textContent = '⌛';
    heroIcon.style.background = '#dc2626';
    statusPill.textContent = `Payment Session Expired (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    mainTitle.textContent = 'Payment session expired';
    subtitle.textContent = `The MITO payment session for transaction ${tx.transactionId} timed out before payment was completed. No funds were debited — please lock a fresh rate and try again.`;

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
      topPill7El.textContent = '7. Session Expired';
      topPill7El.style.background = '#dc2626';
      topPill7El.style.borderColor = '#dc2626';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = '🔒 Lock Fresh Rate & Restart Transfer (Step 2) →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('dashboard');
    }
  } else {
    heroIcon.textContent = '✕';
    heroIcon.style.background = '#dc2626';
    statusPill.textContent = `Payment Failed or Declined (${rawMitoOrderStatus})`;
    statusPill.style.background = '#fee2e2';
    statusPill.style.color = '#991b1b';
    mainTitle.textContent = 'Payment was not completed';
    subtitle.textContent = `No funds were debited for transaction ${tx.transactionId}. You can retry payment or choose a different payment method anytime.`;

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
      topPill7El.textContent = '7. Payment Failed';
      topPill7El.style.background = '#dc2626';
      topPill7El.style.borderColor = '#dc2626';
      topPill7El.style.color = '#ffffff';
    }
    if (primaryCtaBtn) {
      primaryCtaBtn.textContent = '🔄 Retry Payment on MITO Checkout (Step 6) →';
      primaryCtaBtn.style.background = '#dc2626';
      primaryCtaBtn.onclick = () => jumpToView('payment');
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

  // Navigate to the Result Page!
  jumpToView('success');
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

// Listen for postMessage events from the live embedded MITO Hosted Payment Link iframe (`mito-checkout-1cca8e18297e.herokuapp.com`)
window.addEventListener('message', event => {
  try {
    const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'MITO_LINK_SUCCESS') {
      const rawSt = String(payload.payload?.status || payload.metadata?.status || 'READYTOPROCESS').toUpperCase();
      const orderNo = payload.payload?.transactionReference || payload.metadata?.transactionReference || '';
      completePaymentAndRedirect(rawSt, { orderNo });
    } else if (payload.type === 'MITO_LINK_EXIT') {
      const reason = String(payload.error?.reason || payload.metadata?.reason || '').toUpperCase();
      const rawSt = String(
        payload.error?.status ||
          payload.metadata?.status ||
          (reason === 'CANCELLED' || reason === 'USER_CLOSED' ? 'CANCELLED' : reason === 'EXPIRED' || reason === 'RESTART' ? 'EXPIRED' : 'FAILED')
      ).toUpperCase();
      const orderNo = payload.metadata?.transactionReference || '';
      completePaymentAndRedirect(rawSt, { orderNo });
    }
  } catch (_) {}
});

// Initialize on DOMContentLoaded — If arriving via /remittances/callback redirect URL (?mito_callback=1), open Step 7 Result Page; otherwise start from Step 1
window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mito_callback') === '1' && params.get('transactionId')) {
    // If /remittances/callback loaded inside the embedded MITO payment iframe, break out to the top-level window automatically!
    if (window.top && window.top !== window.self) {
      window.top.location.href = window.location.href;
      return;
    }
    refreshDashboardHeader();
    fetchQuoteLive();
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
      renderStep7TransactionResult(tx, orderStatus, tx.paymentMethod || 'MITO Hosted Payment', callbackUrl, {
        paymentCase,
        rawMitoOrderStatus: orderStatus,
        orderNo
      });
      return;
    }
  }

  refreshDashboardHeader();
  fetchQuoteLive();
  jumpToView('register');
});
