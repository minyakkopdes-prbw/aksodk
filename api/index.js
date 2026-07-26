const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🔥 Serve static files from 'public' folder (Vercel akan menemukannya)
app.use(express.static(path.join(__dirname, '../public')));

// 🔥 Handler untuk root path '/'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// CONSTANTS & HELPERS
// ============================================
const CLAUDE_API = 'https://claude.ai';
const userSessions = new Map();

function generateGermanIBAN() {
  const bankCode = '50010517';
  const accountNumber = String(Math.floor(Math.random() * 999999999)).padStart(10, '0');
  const checkDigits = String(Math.floor(Math.random() * 90) + 10);
  return `DE${checkDigits}${bankCode}${accountNumber}`;
}

function getHeadersWithSession(email) {
  const session = userSessions.get(email);
  return {
    'accept': '*/*',
    'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
    'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'cookie': session ? session.cookies : ''
  };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Login
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;
    const response = await axios.get(
      `${CLAUDE_API}/api/auth/login_methods?email=${encodeURIComponent(email)}&source=claude-ai`,
      {
        headers: {
          'accept': '*/*',
          'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
          'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Kirim magic link
app.post('/api/send-magic-link', async (req, res) => {
  try {
    const { email, utc_offset = -420, locale = 'id-ID' } = req.body;
    const response = await axios.post(
      `${CLAUDE_API}/api/auth/send_magic_link`,
      {
        utc_offset,
        email_address: email,
        login_intent: null,
        locale,
        return_to: null,
        source: 'claude'
      },
      {
        headers: {
          'accept': '*/*',
          'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
          'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Verifikasi magic link
app.post('/api/verify-magic-link', async (req, res) => {
  try {
    const { email, code, hcaptcha_token, arkose_session_token } = req.body;
    if (!hcaptcha_token) {
      return res.status(400).json({ error: 'hCaptcha token required' });
    }

    const payload = {
      credentials: {
        method: 'code',
        email_address: email,
        code: code
      },
      code: code,
      email_address: email,
      method: 'code',
      locale: 'id-ID',
      source: 'claude',
      hcaptcha_token: hcaptcha_token,
      arkose_session_token: arkose_session_token || '60318c5d5f754c454.6303992704|r=ap-southeast-1|meta=3|metabgclr=transparent|metaiconclr=%23757575|guitextcolor=%23000000|pk=EEA5F558-D6AC-4C03-B678-AABF639EE69A|at=40|sup=1|rid=23|ag=101|cdn_url=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc|surl=https%3A%2F%2Fa-cdn.claude.ai|smurl=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc%2Fassets%2Fstyle-manager'
    };

    const response = await axios.post(
      `${CLAUDE_API}/api/auth/verify_magic_link`,
      payload,
      {
        headers: {
          'accept': '*/*',
          'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
          'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const cookies = response.headers['set-cookie'];
    if (cookies) {
      userSessions.set(email, {
        cookies: cookies.join('; '),
        userData: response.data
      });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Verify error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// 4. Buat payment (simulasi)
app.post('/api/create-payment', async (req, res) => {
  try {
    const { email, organization_uuid, name } = req.body;
    const iban = generateGermanIBAN();

    const sessionData = {
      id: `cs_live_${Math.random().toString(36).substring(7)}`,
      client_reference_id: organization_uuid,
      customer: {
        email: email,
        name: name || 'Customer'
      },
      payment_method_types: ['card', 'sepa_debit'],
      currency: 'eur',
      mode: 'subscription'
    };

    res.json({
      success: true,
      session: sessionData,
      iban: iban,
      payment_intent_id: `pi_${Math.random().toString(36).substring(7)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Approve subscription (payload diperbaiki)
app.post('/api/approve-subscription', async (req, res) => {
  try {
    const { email, organization_uuid, checkout_session_id, hcaptcha_token } = req.body;

    if (!hcaptcha_token) {
      return res.status(400).json({ error: 'hCaptcha token required for approval' });
    }

    const headers = getHeadersWithSession(email);
    if (!headers.cookie) {
      return res.status(401).json({ error: 'No session found for this user. Please login again.' });
    }

    // 🔥 Perbaikan: hcaptcha_token di dalam client_attestation
    const payload = {
      client_attestation: {
        hcaptcha_token: hcaptcha_token
      }
    };

    console.log('Sending approve payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/subscription/checkout_session/${checkout_session_id}/approve`,
      payload,
      { headers }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Approve error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// 6. Cek Fable 5
app.post('/api/check-fable5', async (req, res) => {
  try {
    const { email, organization_uuid } = req.body;

    const headers = getHeadersWithSession(email);
    if (!headers.cookie) {
      return res.status(401).json({ error: 'No session found for this user. Please login again.' });
    }

    const response = await axios.patch(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/model_selector_state/chat`,
      { model: 'claude-fable-5' },
      { headers }
    );

    const hasFable5 = response.data.model === 'claude-fable-5';
    res.json({
      success: true,
      hasFable5: hasFable5,
      model: response.data.model,
      thinking: response.data.thinking
    });
  } catch (error) {
    console.error('Check fable5 error:', error.response?.data || error.message);
    res.json({
      success: false,
      hasFable5: false,
      error: error.response?.data || error.message
    });
  }
});

// 7. Logout
app.post('/api/logout', (req, res) => {
  const { email } = req.body;
  userSessions.delete(email);
  res.json({ success: true });
});

// ============================================
// EKSPOR UNTUK VERCEL (serverless)
// ============================================
export default app;
