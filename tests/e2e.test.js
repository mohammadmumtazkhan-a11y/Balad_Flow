const assert = require('assert');
const http = require('http');
const app = require('../server');

async function runE2ETests() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`\n🚀 Starting Balad × MITO E2E Test Suite on ${baseUrl}...\n`);

  try {
    // =========================================================================
    // TEST 1: GET /api/v1/mito/Lookups/types (Source of Funds, Reasons, Relationships)
    // =========================================================================
    console.log('1️⃣  Testing GET /api/v1/mito/Lookups/types (Source of Funds & Transfer Reasons)...');
    const typesRes = await fetch(`${baseUrl}/api/v1/mito/Lookups/types`).then(r => r.json());
    assert.strictEqual(typesRes.code, 200, 'Expected HTTP 200 from /api/v1/mito/Lookups/types');
    assert.ok(Array.isArray(typesRes.data.sourceOfFunds), 'Expected sourceOfFunds array');
    assert.strictEqual(typesRes.data.sourceOfFunds.length, 13, 'Expected all 13 MITO sourceOfFunds lookup items');
    const sofCodes = typesRes.data.sourceOfFunds.map(s => s.code);
    for (const expectedSof of ['SALARY', 'SAVINGS', 'BUSINESS', 'TRADING', 'RENT', 'BANKLOAN', 'DONATION', 'OTHERS']) {
      assert.ok(sofCodes.includes(expectedSof), `Missing sourceOfFundCode: ${expectedSof}`);
    }
    assert.ok(Array.isArray(typesRes.data.reasons), 'Expected reasons array');
    assert.strictEqual(typesRes.data.reasons.length, 19, 'Expected all 19 MITO transfer reason lookup items');
    console.log('   ✅ Passed: 13 Source of Funds codes & 19 Transfer Reason codes verified.\n');

    // =========================================================================
    // TEST 2: FLOW 1 — NEW USER END-TO-END
    // Register -> Check Rate -> Lock Rate -> Submit MITO User Data (POST /Users)
    // -> Pass KYC -> Add Beneficiary -> Provide Source of Funds & Make Payment
    // =========================================================================
    console.log('2️⃣  Testing Flow 1 (New User): Register -> Check/Lock Rate -> MITO User & KYC -> Add Beneficiary -> Payment...');

    // 2A. Register fresh New User (POST /api/olowo/auth/register with forceResetKyc: true)
    const regRes = await fetch(`${baseUrl}/api/olowo/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetMode: 'david_incomplete',
        forceResetKyc: true,
        fullName: 'David Beckham',
        email: 'mohammadmumtazkhan+24@example.com',
        phoneDialCode: '+44',
        phone: '7553039222',
        baseCurrency: 'GBP'
      })
    }).then(r => r.json());

    assert.strictEqual(regRes.code, 200);
    const newUser = regRes.data;
    assert.strictEqual(newUser.kycStatus, 'NOT_STARTED', 'New user must start with kycStatus === NOT_STARTED');
    assert.strictEqual(newUser.isSubmittedToMito, false, 'New user must not be submitted to MITO before Step 3');

    // 2B. Check Rates & Lock Rate (Step 2)
    const corridorsRes = await fetch(`${baseUrl}/api/v1/mito/Exchange/corridors`).then(r => r.json());
    assert.strictEqual(corridorsRes.code, 200);
    assert.ok(corridorsRes.data.length > 0, 'Expected active corridors');

    const lockRateRes = await fetch(`${baseUrl}/api/v1/mito/Exchange/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: newUser.senderId,
        sendCurrency: 'GBP',
        receiveCurrency: 'NGN',
        receiveCountryIso3: 'NGA',
        sendAmount: 250,
        serviceCode: 'MONEYTRANSFER',
        collectionMode: 'BANKACCOUNT'
      })
    }).then(r => r.json());

    assert.strictEqual(lockRateRes.code, 200);
    assert.ok(lockRateRes.data.rateId, 'Expected locked rateId');
    assert.ok(lockRateRes.data.rateExpirySeconds > 0, 'Expected positive rateExpirySeconds');

    // 2C. Submit remaining MITO user data (POST /api/v1/mito/Users)
    const createMitoUserRes = await fetch(`${baseUrl}/api/v1/mito/Users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: newUser.senderId,
        firstName: 'David',
        lastName: 'Beckham',
        email: 'mohammadmumtazkhan+24@example.com',
        phone: '7553039222',
        phoneDialCode: '+44',
        gender: 'M',
        legalEntityType: 'I',
        dob: '1975-05-02',
        birthCountryIso3: 'GBR',
        countryIso3: 'GBR',
        buildingNumber: '23',
        street: 'Holland Park',
        addressCity: 'London',
        addressPostcode: 'W11 3TD',
        addressCountryIso3: 'GBR'
      })
    }).then(r => r.json());

    assert.strictEqual(createMitoUserRes.code, 200);
    assert.strictEqual(createMitoUserRes.data.isSubmittedToMito, true, 'New user must now be submitted to MITO');
    assert.strictEqual(createMitoUserRes.data.kycStatus, 'NOT_STARTED', 'New user KYC status before Step 3B is NOT_STARTED');

    // 2D. Pass KYC (POST /api/v1/mito/Kyc/ExecuteSenderKyc)
    const kycExecRes = await fetch(`${baseUrl}/api/v1/mito/Kyc/ExecuteSenderKyc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: createMitoUserRes.data.senderId,
        simulatedOutcome: 'PASSED',
        sendAmount: 250
      })
    }).then(r => r.json());

    assert.strictEqual(kycExecRes.code, 200);
    assert.strictEqual(kycExecRes.data.kycStatus, 'PASSED');
    assert.strictEqual(kycExecRes.data.canProceedToBeneficiary, true);

    // 2E. Add New Beneficiary & Provide Source of Funds / Transfer Reason
    const createBenRes = await fetch(`${baseUrl}/api/v1/mito/Beneficiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: createMitoUserRes.data.senderId,
        receiveCountryIso3: 'NGA',
        serviceCode: 'MONEYTRANSFER',
        collectionMode: 'BANKACCOUNT',
        providerId: '1831846e-75c6-4606-bc5c-0f092cb5ce0a',
        reasonId: 'FOROWNEXPENDITURES',
        sourceOfFundsId: 'SALARY',
        relationshipId: '1da52c2b-4a2a-45ee-9333-10f47f38ef2d',
        fields: {
          firstName: 'Topupnigeria',
          lastName: 'Ltd',
          fullName: 'Topupnigeria Ltd',
          accountNumber: '1018316889',
          phone: '+2348031234567',
          email: 'payouts@topupnigeria.com'
        }
      })
    }).then(r => r.json());

    assert.strictEqual(createBenRes.code, 200);
    assert.ok(createBenRes.data.beneficiaryId, 'Expected saved beneficiaryId');

    // 2F. Initiate Hosted Transaction with user-provided sourceOfFundCode & reasonCode
    const initNewUserTxRes = await fetch(`${baseUrl}/api/v1/mito/Transactions/InitiateHostedTransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: createMitoUserRes.data.senderId,
        senderId: createMitoUserRes.data.senderId,
        beneficiaryId: createBenRes.data.beneficiaryId,
        rateId: lockRateRes.data.rateId,
        sourceOfFundCode: 'SALARY',
        reasonCode: 'FOROWNEXPENDITURES',
        paymentNarration: 'Flow 1 New User transfer with SALARY sourceOfFundCode'
      })
    }).then(r => r.json());

    assert.strictEqual(initNewUserTxRes.code, 200);
    assert.strictEqual(initNewUserTxRes.data.transaction.sourceOfFundCode, 'SALARY');
    assert.strictEqual(initNewUserTxRes.data.transaction.reasonCode, 'FOROWNEXPENDITURES');
    assert.strictEqual(initNewUserTxRes.data.transaction.rawRequiredAction.kyc, null, 'Once KYC is PASSED, requiredAction.kyc must be null');
    assert.ok(initNewUserTxRes.data.paymentCheckoutUrl.includes('journeyCode='), 'Expected live MITO paymentCheckoutUrl with journeyCode');
    console.log(`   ✅ Passed: Flow 1 (New User) completed with live payment link: ${initNewUserTxRes.data.paymentCheckoutUrl}\n`);

    // =========================================================================
    // TEST 3: FLOW 2 — EXISTING USER END-TO-END
    // Sign In -> Check Rate -> Lock Rate -> [Skips KYC QR completely]
    // -> Select Saved Beneficiary + Provide Source of Funds from Form -> Make Payment -> Redirect Callback
    // =========================================================================
    console.log('3️⃣  Testing Flow 2 (Existing User): Sign In -> Check/Lock Rate -> Skip KYC -> Saved Beneficiary + SOF -> Payment...');

    const loginExistingRes = await fetch(`${baseUrl}/api/olowo/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetMode: 'ahmed_complete',
        email: 'ahmed.diallo@mitonetwork.com'
      })
    }).then(r => r.json());

    assert.strictEqual(loginExistingRes.code, 200);
    const existingUser = loginExistingRes.data;
    assert.strictEqual(existingUser.kycStatus, 'PASSED', 'Existing user Ahmed Diallo must have kycStatus === PASSED');

    // Lock rate for Existing User
    const existingRateRes = await fetch(`${baseUrl}/api/v1/mito/Exchange/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: existingUser.senderId,
        sendCurrency: 'GBP',
        receiveCurrency: 'NGN',
        receiveCountryIso3: 'NGA',
        sendAmount: 500,
        serviceCode: 'MONEYTRANSFER',
        collectionMode: 'BANKACCOUNT'
      })
    }).then(r => r.json());

    assert.strictEqual(existingRateRes.code, 200);

    // Fetch saved beneficiaries for Existing User
    const savedBenRes = await fetch(`${baseUrl}/api/v1/mito/Beneficiary?senderId=${encodeURIComponent(existingUser.senderId)}`).then(r => r.json());
    assert.strictEqual(savedBenRes.code, 200);
    assert.ok(savedBenRes.data.length > 0, 'Existing user must have saved beneficiaries');
    const savedBen = savedBenRes.data[0];

    // Initiate Hosted Transaction for Existing User with user-selected sourceOfFundCode: 'BUSINESS' & reasonCode: 'EQUITYINVESTMENT'
    const initExistingTxRes = await fetch(`${baseUrl}/api/v1/mito/Transactions/InitiateHostedTransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: existingUser.senderId,
        senderId: existingUser.senderId,
        beneficiaryId: savedBen.beneficiaryId,
        rateId: existingRateRes.data.rateId,
        sourceOfFundCode: 'BUSINESS',
        reasonCode: 'EQUITYINVESTMENT',
        paymentNarration: 'Flow 2 Existing User transfer with BUSINESS sourceOfFundCode'
      })
    }).then(r => r.json());

    assert.strictEqual(initExistingTxRes.code, 200);
    assert.strictEqual(initExistingTxRes.data.transaction.sourceOfFundCode, 'BUSINESS');
    assert.strictEqual(initExistingTxRes.data.transaction.reasonCode, 'EQUITYINVESTMENT');
    assert.strictEqual(initExistingTxRes.data.transaction.rawRequiredAction.kyc, null, 'Existing user with PASSED KYC must have requiredAction.kyc === null');
    assert.ok(initExistingTxRes.data.paymentCheckoutUrl.includes('journeyCode='), 'Expected live MITO paymentCheckoutUrl');
    console.log(`   ✅ Passed: Flow 2 (Existing User) skipped KYC QR and initiated live payment: ${initExistingTxRes.data.paymentCheckoutUrl}\n`);

    // =========================================================================
    // TEST 4: REDIRECT URL PAYMENT CASES (`GET /remittances/callback`)
    // =========================================================================
    console.log('4️⃣  Testing Redirect URL (`GET /remittances/callback`) Payment Cases...');
    for (const testCase of [
      { orderStatus: 'Order Paid', expectedStatus: 'SUCCESS', expectedCase: 'SUCCESS' },
      { orderStatus: 'In Process', expectedStatus: 'PENDING', expectedCase: 'IN_REVIEW' },
      { orderStatus: 'Awaiting Payment', expectedStatus: 'PENDING', expectedCase: 'AWAITING_PAYMENT' },
      { orderStatus: 'Failed', expectedStatus: 'FAILED', expectedCase: 'FAILED' },
      { orderStatus: 'Expired', expectedStatus: 'FAILED', expectedCase: 'EXPIRED' },
      { orderStatus: 'Cancelled', expectedStatus: 'FAILED', expectedCase: 'CANCELLED' }
    ]) {
      const cbRes = await fetch(
        `${baseUrl}/remittances/callback?transactionId=${encodeURIComponent(initExistingTxRes.data.transactionId)}&orderStatus=${encodeURIComponent(testCase.orderStatus)}`,
        { redirect: 'manual' }
      );
      assert.strictEqual(cbRes.status, 302, `Expected 302 redirect from /remittances/callback for ${testCase.orderStatus}`);
      const location = cbRes.headers.get('location') || '';
      assert.ok(
        location.includes(`status=${testCase.expectedStatus}`) && location.includes(`paymentCase=${testCase.expectedCase}`),
        `Expected redirect location '${location}' to include status=${testCase.expectedStatus} & paymentCase=${testCase.expectedCase}`
      );
    }
    console.log('   ✅ Passed: All 6 Redirect URL callback payment cases verified.\n');

    // =========================================================================
    // TEST 5: DYNAMIC USERID IN AFFILIATE RATES, UPDATE BENEFICIARY BANK TO UBA,
    //         SELECT EXISTING BENEFICIARY (SKIP BENEFICIARY STEP), AND DELETE BENEFICIARY
    // =========================================================================
    console.log('5️⃣  Testing Dynamic userId Affiliate Rates, UpdateBeneficiary (UBA), Existing Beneficiary Selection & DeleteBeneficiary...');

    // 5A. Dynamic userId in GET /api/v1/mito/Exchange/affiliateRates
    const affRateRes = await fetch(
      `${baseUrl}/api/v1/mito/Exchange/affiliateRates?userId=${encodeURIComponent(existingUser.userId)}&FromCountry=GBR&ToCountry=NGA&FromCurrency=GBP&ToCurrency=NGN`
    ).then(r => r.json());
    assert.strictEqual(affRateRes.code, 200);
    assert.strictEqual(affRateRes.calculatedQuote.userId, existingUser.userId, 'affiliateRates must use the dynamic userId');
    assert.strictEqual(affRateRes.query.userId, existingUser.userId, 'affiliateRates query must record the dynamic userId');

    // 5B. Update Topupnigeria Ltd (529ee99a-77e6-47e3-bb0e-b66ee851a8ee) bank to United Bank for Africa Plc (UBA) & update beneficiary info
    const ubaProviderId = 'e3af932a-0326-4b65-b5f4-e8f753a69d4d';
    const ubaBankName = 'United Bank for Africa Plc (UBA)';
    const updBenRes = await fetch(`${baseUrl}/api/v1/mito/Beneficiaries/UpdateBeneficiary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiaryId: '529ee99a-77e6-47e3-bb0e-b66ee851a8ee',
        userId: existingUser.userId,
        firstName: 'Topupnigeria',
        lastName: 'Ltd',
        accountNumber: '1018316889',
        mobileNo: '2348031234568',
        providerId: ubaProviderId,
        providerName: ubaBankName,
        bankName: ubaBankName
      })
    }).then(r => r.json());
    assert.strictEqual(updBenRes.code, 200);
    assert.strictEqual(updBenRes.data.providerId, ubaProviderId);
    assert.strictEqual(updBenRes.data.providerName, ubaBankName);
    assert.strictEqual(updBenRes.data.fields.firstName, 'Topupnigeria');
    assert.strictEqual(updBenRes.data.fields.accountNumber, '1018316889');

    // 5C. InitiateHostedTransaction with existing beneficiaryId skips Beneficiary step and loads Payment link directly
    assert.strictEqual(initExistingTxRes.data.skipBeneficiaryHostedStep, true, 'Selecting existing beneficiary must set skipBeneficiaryHostedStep: true');

    // 5D. Delete temporary beneficiary created in Test 2E
    if (createBenRes.data.beneficiaryId && createBenRes.data.beneficiaryId !== '529ee99a-77e6-47e3-bb0e-b66ee851a8ee') {
      const delBenRes = await fetch(
        `${baseUrl}/api/v1/mito/Beneficiary/${encodeURIComponent(createBenRes.data.beneficiaryId)}`,
        { method: 'DELETE' }
      ).then(r => r.json());
      assert.strictEqual(delBenRes.code, 200);
      assert.strictEqual(delBenRes.data.deleted, true);
    }
    console.log('   ✅ Passed: Dynamic userId rates, UpdateBeneficiary (UBA), Existing Beneficiary Selection & DeleteBeneficiary verified.\n');

    console.log('🎉 ALL BALAD × MITO E2E TESTS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runE2ETests().catch(err => {
  console.error('❌ E2E Test Suite Failed:', err);
  process.exit(1);
});
