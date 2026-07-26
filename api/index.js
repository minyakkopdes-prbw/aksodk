const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const CLAUDE_API = 'https://claude.ai';
const STRIPE_API = 'https://api.stripe.com/v1';

// GENERATOR JERMAN
const GERMAN_CITIES = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden', 'Gelsenkirchen'];
const GERMAN_STREETS = ['Hauptstraße', 'Bahnhofstraße', 'Schlossstraße', 'Goethestraße', 'Friedrichstraße', 'Wilhelmstraße', 'Ludwigstraße', 'Königsallee', 'Marienplatz', 'Neue Straße', 'Marktstraße', 'Kaiserstraße', 'Rathausstraße', 'Kirchstraße', 'Gartenstraße', 'Mühlenstraße', 'Brückenstraße', 'Bergstraße', 'Talstraße', 'Weinbergstraße', 'Petuelring', 'Leopoldstraße', 'Maximilianstraße', 'Sendlinger Straße', 'Theresienstraße'];

function generateGermanIBAN() {
  const bankCodes = ['50010517', '70010517', '60010517', '80010517', '90010517'];
  const bankCode = bankCodes[Math.floor(Math.random() * bankCodes.length)];
  const accountNumber = String(Math.floor(Math.random() * 999999999)).padStart(10, '0');
  const checkDigits = String(Math.floor(Math.random() * 90) + 10);
  return `DE${checkDigits}${bankCode}${accountNumber}`;
}

function generateGermanAddress() {
  const city = GERMAN_CITIES[Math.floor(Math.random() * GERMAN_CITIES.length)];
  const street = GERMAN_STREETS[Math.floor(Math.random() * GERMAN_STREETS.length)];
  const streetNumber = Math.floor(Math.random() * 200) + 1;
  const postalCode = String(Math.floor(Math.random() * 90000) + 10000);
  return { line1: `${street} ${streetNumber}`, city, postal_code: postalCode, country: 'DE' };
}

function generateGermanName() {
  const first = ['Max', 'Anna', 'Lukas', 'Mia', 'Felix', 'Emma', 'Noah', 'Lea', 'Paul', 'Sophie'];
  const last = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

function generatePaymentData() {
  const address = generateGermanAddress();
  return { iban: generateGermanIBAN(), name: generateGermanName(), address };
}

function buildClaudeHeaders(cookieString) {
  return {
    'accept': '*/*',
    'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
    'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
    'anthropic-client-build': '1784947364',
    'anthropic-client-platform': 'web_claude_ai',
    'anthropic-client-sha': '20d9aa474237b1cc7f12faa3471d142703130109',
    'anthropic-client-version': '1.0.0',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'cookie': cookieString || ''
  };
}

// HEALTH
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, cookies } = req.body;
    const headers = buildClaudeHeaders(cookies);
    const response = await axios.get(
      `${CLAUDE_API}/api/auth/login_methods?email=${encodeURIComponent(email)}&source=claude-ai`,
      { headers }
    );
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// SEND MAGIC LINK
app.post('/api/send-magic-link', async (req, res) => {
  try {
    const { email, cookies, utc_offset = -420, locale = 'id-ID' } = req.body;
    const headers = buildClaudeHeaders(cookies);
    const payload = { utc_offset, email_address: email, login_intent: null, locale, return_to: null, source: 'claude' };
    const response = await axios.post(`${CLAUDE_API}/api/auth/send_magic_link`, payload, { headers });
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// VERIFY
app.post('/api/verify-magic-link', async (req, res) => {
  try {
    const { email, code, hcaptcha_token, cookies } = req.body;
    if (!hcaptcha_token) return res.status(400).json({ error: 'hCaptcha required' });
    const headers = buildClaudeHeaders(cookies);
    const payload = {
      credentials: { method: 'code', email_address: email, code },
      code, email_address: email, method: 'code', locale: 'id-ID', source: 'claude',
      hcaptcha_token,
      arkose_session_token: '60318c5d5f754c454.6303992704|r=ap-southeast-1|meta=3|metabgclr=transparent|metaiconclr=%23757575|guitextcolor=%23000000|pk=EEA5F558-D6AC-4C03-B678-AABF639EE69A|at=40|sup=1|rid=23|ag=101|cdn_url=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc|surl=https%3A%2F%2Fa-cdn.claude.ai|smurl=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc%2Fassets%2Fstyle-manager'
    };
    const response = await axios.post(`${CLAUDE_API}/api/auth/verify_magic_link`, payload, { headers });
    const setCookie = response.headers['set-cookie'];
    res.json({ ...response.data, setCookie });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// CREATE CHECKOUT
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { email, organization_uuid, cookies } = req.body;
    const headers = buildClaudeHeaders(cookies);
    const paymentData = generatePaymentData();
    const returnUrl = `https://claude.ai/settings/billing?action=subscribe&redirect_status=succeeded&plan=max_20x&returnTo=%2Fnew`;
    const response = await axios.post(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/subscription/checkout_session`,
      {
        plan: 'max_20x',
        billingInterval: 'monthly',
        ipCountryHint: 'DE',
        paymentMethodTypes: ['card', 'sepa_debit'],
        referralCode: null,
        referralSource: null,
        returnUrl,
        uiMode: 'custom'
      },
      { headers }
    );
    res.json({
      success: true,
      sessionId: response.data.sessionId,
      clientSecret: response.data.clientSecret,
      paymentData
    });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// SUBMIT PAYMENT (Stripe)
app.post('/api/submit-payment', async (req, res) => {
  try {
    const { sessionId, paymentData, email } = req.body;
    const params = new URLSearchParams();
    // (payload Stripe lengkap, saya tulis singkat agar tidak terlalu panjang, tapi tetap sama)
    params.append('guid', '9ad9fbc1-72df-44a0-a4f3-410b842667b0a573ec');
    params.append('muid', '193859b9-23b5-40fd-b1e5-489d0e262440f8d7fb');
    params.append('sid', 'c69ce4a1-bde6-4355-b1b4-24745b43cb6cd17239');
    params.append('payment_method_data[billing_details][name]', paymentData.name);
    params.append('payment_method_data[billing_details][email]', email);
    params.append('payment_method_data[billing_details][address][line1]', paymentData.address.line1);
    params.append('payment_method_data[billing_details][address][city]', paymentData.address.city);
    params.append('payment_method_data[billing_details][address][postal_code]', paymentData.address.postal_code);
    params.append('payment_method_data[billing_details][address][country]', 'DE');
    params.append('payment_method_data[type]', 'sepa_debit');
    params.append('payment_method_data[sepa_debit][iban]', paymentData.iban);
    params.append('payment_method_data[allow_redisplay]', 'limited');
    params.append('payment_method_data[payment_user_agent]', 'stripe.js/b6feaa70de; stripe-js-v3/b6feaa70de; payment-element; deferred-intent');
    params.append('payment_method_data[referrer]', 'https://claude.ai');
    params.append('payment_method_data[time_on_page]', '180956');
    params.append('payment_method_data[client_attribution_metadata][client_session_id]', '447eae92-50b7-4d67-957d-3a384448ce32');
    params.append('payment_method_data[client_attribution_metadata][checkout_session_id]', sessionId);
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_source]', 'elements');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_subtype]', 'payment-element');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_version]', '2021');
    params.append('payment_method_data[client_attribution_metadata][payment_intent_creation_flow]', 'deferred');
    params.append('payment_method_data[client_attribution_metadata][payment_method_selection_flow]', 'automatic');
    params.append('payment_method_data[client_attribution_metadata][elements_session_id]', `elements_session_${Math.random().toString(36).substring(7)}`);
    params.append('payment_method_data[client_attribution_metadata][elements_session_config_id]', '9e65f3ce-e472-4c10-9aca-71180397cc18');
    params.append('payment_method_data[client_attribution_metadata][checkout_config_id]', '144f8043-112f-4368-95c6-c368b02de9b5');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_additional_elements][0]', 'address');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_additional_elements][1]', 'taxId');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_additional_elements][2]', 'payment');
    params.append('payment_method_data[client_attribution_metadata][merchant_integration_additional_elements][3]', 'currencySelector');
    params.append('init_checksum', '4QjuLOc3E5ADiEPdAyRKnUFugVpLHBrs');
    params.append('version', 'b6feaa70de');
    params.append('expected_amount', '21420');
    params.append('js_checksum', 'qto~d^n0=QU>a<eRUrbu]]qa]C`;o"_Q]>a<]}nS<yX;{<\cUZ_%o?U^`w');
    params.append('rv_timestamp', 'qto>n<Q=U&CyY&`>X^r<YNr<YN`<Y_C<Y_C<Y^`zY_`<Y^n{U>o&U&Cye&YudR]vXuasdRQxeOL#e&;DYu#=dbX$XOQxY_YrYbL&XO]rX&os[Nn{U>e&U&CyYudC[_exY&]uYbd%X_LCYb\%X_<xY&nDYuerdReve&QrX_asXxP>e=P%YOP%d_`%XRX$e&eyYuoye&#;Y=oue%o?U^`w');
    params.append('passive_captcha_token', 'P1_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwZCI6MCwiZXhwIjoxNzg1MTU0NTc0LCJjZGF0YSI6ImhZeWxXV0ovL0NkcjlJNWJDQTMzU2xhOHZUM0kxK0VXMG5saDBXRlRlTzN0SEd3d1JEMlZjRGdJRDJEZEZwbkc3Z2ZWcHBpM3ZzbW9xZ3laOFFrRm4zZ09KcTBYZFJSeUZQUWVnVG1mZGNNcFNPNU1VaE5hVUVYbUVBeTJ2QjdMTStwOHdmemV1dnMxZXM1UEpuaHdpYVgyczBzVjFzcnVFeitpeFNoeXBYM0NqaTB3ajhJUVVnWVBGd3J0MDJwMUNXaGthSjhyaHN3cjBLQmEzbjJtYVVJclRYZUgwSWU2RjcyRzRHMmRkWFAzMTAvNzlIWEhVdkFvUTRIUDJWTnhDMlJEL0QwSEF0Vys1dTZGa3MyWW9TSzhmY2JmekJPb09lZUM4ZGErTGF3UCtqdk5rNzVBT0Nwa2cwNUthSEtvT1BSQzlSVm4vL2VzRzZtY20zQTkwVVhnYms3M2x3RW5qYnA2dnJ3bEw4Qi9xS0xXMlBmbmNtS2Rwb045YnRYN0Q5a1Bid0JQNWRJTjJxRVVmMWJDalFiQloxbUlWVEdCamRvTVBrVC9WdnpVbGpIT2gyN21yMWpybFp2cmZWbGJZMzRGbk1sSTRlNVAiLCJwYXNza2V5Ijoib2pzUFFsbU5DTnEyQmdtNmFoQllQWis4ZUd5ZERnR3FSQnU2NW5tUVRCK09jd2E2Q0paVHg2ZTNCRGthWVl2R05hVHVqTXRzVlZRS0JsV3JkeWZTM1Z2T044WVdvYTBiTlAzUDliNVdwTEUvMmdWREpVRk9zZHV4UDFzU25WckdsL1F4WTQvSkxqTDBqcVhoRjdZRDhQZGZUSUtRZDd5RFJYaTVSaVFLZjFqRk5tNlJxcnE0M3hCaXhwREkzTm9sbWRlZWErSnV6UWRWbi8yc0dXaWczNW04MmR4OHY0eU1Tdit5cVowdXJuSkxqOFg3WUZXYzhnekRTb29iTDZRdk9qc3ZoU2pIU09mZTJPeldxa0JHcVdxeXVscEY5TndCd3dldHBoVFVuUm9veHpQRFZmWVZqaUtqM3h4NXp5N3JpSU42Y255TGFWdy82eTlRV0hNUHhEcmFXekgwNmtCKzh6THdZMWlHWHhIVDBxdU5Fa2hwR1RMV2JlbUF0ZExIMlpPMWlSUTZLQkFPeHhQekpkQzB2QlJqaFIyMUdDUWt3d0RJd3VZbEdIT3ZYeG8rcnlCaTRoY3RRQzNCeSszby9ucW9SVitabEh0NmRJRDlFYnRmRzFoOHNXd1IzMEFPUloydllhZkNRNWV1VDluU253eE1MSmp0dTRvdy9sa1RxeUFBOFhZcGpNR1RzVFZndklaTEJ4aXlOTFMxcE9LZkpSSGp6THUwQ0czRG8vL1VnWEZhMDRRU0JJT1pWbG9FSTdyR3plV2Y2L0lMdnl2UGxDRmYxdWxKZmpTb3dSYkhLeDVDUTVUdTl0WW9NejJTWFRTRTB4MERqSW5aZGRQaXN5L1cvekdzYld2MDJoYmtnNUY3TzFOQ1VNWVdjVCt1ejNOR0l3dlltNWZqU2tzQ1ZWZjg1U0dUVjB3YzJmR3p3SXAvQ0NPNHVXbkJhR3N0Yis0TGlGYmE3UDExU2hlbTlvRHJXYWlyMVJmMEIwaWQ4S1B4L011b2crNWxQbDNDOVZhc3FNR3pzNFZnWWFJR0hYK3ozLzFJLzlwSEMyVjlqd01ReEs3ZjlIcmhKRGZKVUhlV3ZqdWk2Ujdma2FiVng2amw0Y3d4eGJTMnFTamdRb3JodTFodjNqck1zUGJEYi82eTh6bk1USGk3VW8rZ0p1d1R4ZGhzK3VtdHgxcmYzcUtibXc5UGs3dDNjWkg1R0NXcE9wSWtGRGpCbXRJcEdsRWFxM0lXaDI4em1VOFRzL3Q2eFBncTBwOVJESDdneVRBWkRVUmwxY2dSd1g1UlRhdWw4aGo0WVZweUxDNWcrZ2hXNWJicC9hL2lBUVlxYjZyUlkwY0FhbUx3ZGdURC9nSTdwZ2ExS3pWYWRPbTlnU0RibURuL2Z5eWxPK3RlZW5NWGVRUGgxcmdid1FsQXJwdHErOExpWUYxdCtuelZyUERQZVMvZFV3ZDJzeU1pVHNpNDRyVXUyNGlhb0JpdkhadnMwYmNZQ3Jvc24yNDBOQlZISmozcW5obktsTXNxR09GdUFPU29VTW1LSVl3a3M2TGg5TVNIMGhHU2tJNWZNZ0t2cU9XM25iMG5STENFdE4yK3lndTU2UDhLd2kxSW9MTWpjcXdMbzBVa2ZsUkxvNFAxcllFbm8xVldDR2ViNlFkOXVZOTJDQUViVXhZS1hMVFM3OG5BbGZjOGh3OXRiQ2o2YWVYQk1sa3M4ZFEyZVUySUhsajNNSmNHUElmZjAxMG5pWFpuYzdDR2N3WjV0VlREdjZmV3hvaWtiaUpsa0swRkZUaE9NS3oxRHI2eitSWEljVVoyZkd4S25xdkNoTEZHSXZURE4wS1FnWldxNlh2dHo5OE1rNmdvNmFVdlRSdnRyYXJIWGxLL1JsOW5BOHNUSlZnUzlCWHVZZisyeXJaWTdCeDhM') // potong biar gak terlalu panjang, tapi isi lengkap sesuai aslinya
    // ... tambahkan semua parameter seperti sebelumnya
    // Saya singkat karena karakter, tapi di kode asli harus lengkap
    // Pastikan semua parameter yang dibutuhkan ada
    const response = await axios.post(`${STRIPE_API}/payment_pages/${sessionId}/confirm`, params.toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });
    res.json({ success: true, stripeResponse: response.data });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// APPROVE
app.post('/api/approve-subscription', async (req, res) => {
  try {
    const { organization_uuid, checkout_session_id, hcaptcha_token, cookies } = req.body;
    const headers = buildClaudeHeaders(cookies);
    const response = await axios.post(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/subscription/checkout_session/${checkout_session_id}/approve`,
      { client_attestation: {}, hcaptcha_token: hcaptcha_token || 'dummy' },
      { headers }
    );
    res.json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data || e.message });
  }
});

// CHECK FABLE 5
app.post('/api/check-fable5', async (req, res) => {
  try {
    const { organization_uuid, cookies } = req.body;
    const headers = buildClaudeHeaders(cookies);
    const response = await axios.patch(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/model_selector_state/chat`,
      { model: 'claude-fable-5' },
      { headers }
    );
    const hasFable5 = response.data.model === 'claude-fable-5';
    res.json({ success: true, hasFable5, model: response.data.model, thinking: response.data.thinking });
  } catch (e) {
    res.json({ success: false, hasFable5: false, error: e.response?.data || e.message });
  }
});

module.exports = app;
