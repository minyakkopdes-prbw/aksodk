const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const CLAUDE_API = 'https://claude.ai';

// Session storage per user
const userSessions = new Map();

// Generate German IBAN
function generateGermanIBAN() {
  const bankCode = '50010517';
  const accountNumber = String(Math.floor(Math.random() * 999999999)).padStart(10, '0');
  const countryCode = 'DE';
  const checkDigits = String(Math.floor(Math.random() * 90) + 10);
  return `${countryCode}${checkDigits}${bankCode}${accountNumber}`;
}

// Get headers with session
function getHeadersWithSession(email) {
  const session = userSessions.get(email);
  return {
    'accept': '*/*',
    'anthropic-device-id': '73f229bb-98fd-497a-b3bb-53d453040a40',
    'anthropic-anonymous-id': 'claudeai.v1.b0bcfffe-c69f-4736-8157-89787477e014',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'cookie': session ? session.cookies : '',
    'origin': 'https://claude.ai',
    'referer': 'https://claude.ai/login?from=logout'
  };
}

// ==================== ENDPOINTS ====================

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

// 2. Send magic link
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

// 3. Verify magic link
app.post('/api/verify-magic-link', async (req, res) => {
  try {
    const { email, code, hcaptcha_token } = req.body;
    
    if (!hcaptcha_token) {
      return res.status(400).json({ error: 'hCaptcha token required' });
    }

    // Gunakan token dari request asli
    const defaultHcaptcha = "P1_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.haJwZACjZXhwzmpl-qyncGFzc2tlecUG6n-U39mTs1vW3_115k-gC8fZcBj8znw90dOZObIh8EvvFu5GQ3ju1bToOhvKk4zlI_FtYQs-TuT7YBKm4yif2sFvkgdXdzgeZbsJmSs600IkqUG3gEiZoXR6-hdEkhj3CB8sATEMm8GVjGoPIVrwL_IKjWrWxWsvlq-J8QjbONDokPZ8Pjqlq_h2sLiTU24ni8A0FNTW1zQxj4tstaezzHZufePAEYmU1NDf-kACfQotpzZJjIQ9evJ6Y5J2XiFJtuXs6J0sY17BqZXRxM1tTGoLPgXV1MEVGSgvfbePbcb3omWfK44wFGhsCeXeFE3kwsqh9gxkOvpmmrNigAIlu7TLcVDa-oSS6MfvtIMfkyeuIThs7lG7Es35CahPGuC-Rt0fhzewxsj1K0K_7FXqpqpNDONgqtHXEF9h-ytlZiidUGLRoRrGxDA1F8Wr4XlIUbBv1OyrtKDrjNg9JNptmbH9oMIxLT7EMf7M2DXdz5iWHqw0bre3q2oKfVW6I_RAm1K2a5vDFz-oS7I2ZyvCN4Uiu3BMonn67p-37ibApDyso6LdJTneea15ZZwiJ1dx-um0-C7JGdJYQB6ydDS1h4aarxDM8dW7M_z1WG6YmvW83Q5Cygy-YLhN0r5zl7JNcmIgt8pmGo3fccbqp1X9qm7f_QC-bR6RyCgosfJwozL7lV37smpz4xHQueQQ3RPyNBfPsY3_nG-bXZvtvanVCM818MHb6UW1PguZXYuK1eJ8ulL4man_vKOmeqWKleJhilFQeTTi1xaYWEUsC5H3HePOeD4o7l6m7ZQR6m6RZEhaEf6R50_ecR8xYb4-7GbUNiRSCBIFELdIUWN6mDF7GUw3SDIxEaCO6fPkWYavXHK33akaSWO9MPNPXU74fr4JBOKdN06g9ExunDfb9quKlulEApugtDEi-hcQ_iPilmQsseTd4UcUAvNokRYhZ3XRWHUyO3iKEqObi_YKpSkXsUChUAftBaZxJBtC65s0wQyZb0YUsbh2Gt6qxLUz-BrkYvir4VPtnt578kObzItMYoUt6r6sVcYv8LqSNgBOpiUMWM393tNq58cuoe-UjlUWgR7mGXU258Kq_btfVspq0qVBdUqqE_nu3HbOUXWXa2Tg9mqO2pjsZjmYYK8DM0Fk3dMbRlfavSGs2_Bgn73gYCMpMsUQ8thmBRZdIv1QDvsm_owmOYQQexKM107t_wcBIJF6lMQFx8EaB1javItUFmWUetyXmXBdPcCGvsB2G6xXnHkLEfe4JAlfWSjpANRfD4OiTdnqHxEyB1rX6WMqkfmPmY_WY0j0zgqks39f7B6neWc2sULt5k5Pqq26wR_qJIyy4EIdHYJVYWud2KbJPJlTuYCGrgZ0D6yV8ZmaeIO6mz8DzAWUucX4i0eV-zKD8vN64M5uMvtxbsbyhgiC2X1UoPbLyqN17KZ_qZlo4_3aJaL4erkQMnmVfTC8a-d0CjB_2HcB0cMSW8e76MiIVuUuH92KZjczVS-jc8z-lzTV5h9PHQAuYK27NhuwdI7OouaUmi3qLEUsfcN1An-lZjRhNoFQutVGZxblGF7M3s5twmunXTiO-FNMx_FEbEd8ndZLEJA33QvA85N1hFVUU-QGqJCyPPblWr-Du4Ayy2QvgVdRjRQaLI-fINlBqpcZ8z0WDtzXXqczOzyGRhUMXVN8-OvZDsXLXFvOmPsqg56a-6tBkSGU2n-oLFVHsiJiO7HjM5Pfdhtv4pmbciGZ910QuHIWJBGrrmTTJuiTX-jGSebD2RkYth0jiKUMjJWNPPAMO4T2G40g9cbWSRSEvySl5G3rx8q8Is6lSk9pjaPfxYWPz7SmRK_dgUT6hI7ClSlktCHbQmzJeN2dVNFXvN-6_-Z2GJl85f2usLZVXaFacQ7UGo5Vb8kqOvihHgV4b6IaU0FOmdTvMPScm2T7oFSX9QRdnk8t1KjwA15jH-jn1jsziTuYZTSR8k7el1-vmPSWRfV_Q8IIzUbCdXxmwufJdRi_rr37BDo_6XeSvYfrh3NlMok1b2myQscJ0YGe2_hJBg3naBQCcxTFQdbdvoyxHVh2-1-8a8vjza0ADHPK4ZkLsMl54QsAtnESFblGZ9ChymxFV7xAAi2WaAvtDnVjjAZg9F6WVcp-f7r94TGI6YxDUv4bHEJ-nj9DrPcI28Wy9IZE9ih7qqRVAAwLhHIbGT6DjzFWw6B0zaqhLlq07wnDQqzXQ67gRNo5fzQwH7Fgcccz2-Pg0CVlJqscS3nQJ1B1FEe3KwNLIiJNDydLySquF6W6pukWrTl_JpqJUlgRxYrrkQK6cNsB4ygkZqZsJzR5RtdKFgcWhDMml6wjo-uk2KNo4rpdtKJrcqgxZmVlYTQxOahzaGFyZF9pZM4Pcupv.7oJnnUD3pqDu15ncBHcPAJRnflnp7fdgSLnvQXErfHU";

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
      hcaptcha_token: hcaptcha_token || defaultHcaptcha,
      arkose_session_token: '60318c5d5f754c454.6303992704|r=ap-southeast-1|meta=3|metabgclr=transparent|metaiconclr=%23757575|guitextcolor=%23000000|pk=EEA5F558-D6AC-4C03-B678-AABF639EE69A|at=40|sup=1|rid=23|ag=101|cdn_url=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc|surl=https%3A%2F%2Fa-cdn.claude.ai|smurl=https%3A%2F%2Fa-cdn.claude.ai%2Fcdn%2Ffc%2Fassets%2Fstyle-manager'
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
    
    // Simpan cookies
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
    // Jika response HTML, kirim error JSON
    if (typeof error.response?.data === 'string' && error.response.data.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Invalid response from server. Please try again.' });
    }
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// 4. Create payment (simulasi)
app.post('/api/create-payment', async (req, res) => {
  try {
    const { email, organization_uuid, name } = req.body;
    const iban = generateGermanIBAN();
    
    res.json({ 
      success: true, 
      session: {
        id: `cs_live_${Math.random().toString(36).substring(7)}`,
        client_reference_id: organization_uuid
      },
      iban: iban,
      payment_intent_id: `pi_${Math.random().toString(36).substring(7)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Approve subscription
app.post('/api/approve-subscription', async (req, res) => {
  try {
    const { email, organization_uuid, checkout_session_id, hcaptcha_token } = req.body;
    
    if (!hcaptcha_token) {
      return res.status(400).json({ error: 'hCaptcha token required for approval' });
    }

    const headers = getHeadersWithSession(email);
    if (!headers.cookie) {
      return res.status(401).json({ error: 'No session found. Please login again.' });
    }

    const defaultHcaptcha = "P1_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.haJwZACjZXhwzmpl-56ncGFzc2tlecUH2pbCsnlA_zwXtCvZZUH2WcKD6ppojeI9VVIeTzDcP3LGLcPrmDd22KWtFs2pgCcx3UyqbIDYo7Y6NS801ac_JIad47iIlfTyxttBvS8z4LLbYOmhAMAg-VBErCofkKIKCk2FFhSehs7Nu9kz0XxMdZ4X1ureQ-I7LwiwfwaeR7Pa3LoDdzvT_I6nmt-DA4dt6dqqYzuf5t4SEs0Z6tgt2BL7N0MfcykrHTq37PZSITe1hncqlqsdi7Kx0D5AnwVIggb973mXhZHH_9mj_Dcktbh7BrnRZI15ZJyQ2JJoT6ArqPpXlJSP_jGUEEOecAhO7sfUNbJOqBqvkr4ew0aZcEqwSkDYz-RScS67IV_i1byx-p2AesyoZvwomqTi1yc7aty8hz-BwZrYapGPrE3RUbqjvoC2vasRWcVqA2JeU_71tu2WVju61jRd1a4xFaMKO3j54nYvBqSYPjEeoDIh-7dnIb1Q-h5N4cV7fZ_D-oZxM57Qvu3lyItoZESyZoOdBgIs2w56G1ZRNONQ25I_wg1PTmsjLZpI8FuH8m79opx1efPdbx9wk83VLCtLSG0d-5j92FkC90gFCk86y89KA0Bc6GTJdBp_bOVHSO0Zyl9VX-30SWMWK2d7jlVT_VZlIrEvxOFZ05S2IzwbLlYlCcnzk0JFX5Emlye9DV514iAqFZ0jq2K27Jxe99hWrhlU4JYIhaGjVTkyxiLaFHD1b5s0Ialr5UMU4sBbM36xquCwjY1xYGNO3Ic6S1imKBcuJlKyPXGLIw2QS8JqA6BxK2lj7aWLr81uD0W28dUQCP8qKmonxIBjsjkmSayzhKUN4ShN2KYdrd47Y4ftutsf5dspGSVOuRluK7maAbCt_Eno9hxFfqB4734gBsiHPfIbKNtqoS99YIvgjxPqICWMw7SyYfkPE5bC80ngvOnYZJrLw1eCqNOAE3_zH0rw2K3BnZRyQTroV7RNeeMkMcpmcYdNtBRWUVu-uT7D9buQK90K68yinKaq-ewtYgYmjMIubzrqp05kLfUGmqevC8_KyDKXHwC_I5mA_F0JA5xo3hwmCI0n6FfujZweoYkho-qkuGX579SeFVqQytWZfbpUPZMlCCvcA4NwrNxA_aJDHZkyZebzG6mUHlOZxKw_L17uquc44jkGVfiX5fVhlmkJ23HznZX3KGJkOwuLG9nr99YpF27oIZJNasIq4y1np0dyaR6QMkkZ6RE-P-eqseaHZvLvJ_XLYvr8_RmCqGXUmuORcVfYiSUZ6LpXiCmmg5WJZecYQacgu7Do_p1yimzGLWbg3KafB__CcWdNDSLdOCpq-8AI44rpt-xJQnmaoDy-m6HqIzP0yZXsat4dd5nhPcTI7YXSAklXDmXv3FAYFAImUTKWDnSsJDI6-7rSSZhaz6BlVNk7E1ymyMz6ctWA5Dl5WL8lmumWUAjeriCHZcMUzIyaR9S81e4d-u7f_xdlW0aEsj9WwlhzZ5Z9ZoDH8vILF40QJp27ShX2chMCc4yrz2Hew97yy7-VXzl-0bOiwgF6ZMVCNKcoolU-jSymm8xdyuII3kOy8WQVcn343TMq_3k8JDkOA0Ok2V_SEKoq8xQrveA0t9jM44ua1f-2ZOiZ7NAfbJa-e3GYxc-AON11BBmF-63mvBLJkowalrNQgysXSkK0jOe89btCP5ArXn_WJo8sPWfd-02w_eNgruTCO6wcCcS8y-vR3w9TY0pjOkk9L9-WpkUbDBD83UERNZqSefj6TvdVy14o6W6wX02d0NCLMOKMVzsTGw9ogIxskIT-PIN79VbMvHu2N9dRv6VijtSX2VPmpUTWeuNWzCmVC-MYJ3j42wrqMe84Tb5l_SdxcJ7UH6ljkzFm6FlPMvBcYrCWmbNnN5zC3Dj_ggKBdlR7j4P_qPHfXqkwTAc9lkB_kNnFitj1mcNb_6NeBQ50a8piDx6KVFRn68B94cYaQBJPvHszReyYoxhNdQ_5T5CiwfslI8LWddPGlLqDWUdt2qKjPjmDHOPf9KIMTS54J-JBAO56rB0slNeVGCeQmvKTcz-ED1kKe6Ds_Tp-HsjH9VUEnT9No9jpuufxa8rfHRq15rZlzzUFKHfccJV799br8NyhKzgcw25QdAdae1nZOu6v6M82pdtvJT6y8sNJHQQfSfHudwTMawz4SIzZQHcsDoLm7By7blA1FRIkfiejZ74WRnFPHeI1hjPmySgF100Ie5ne2o3V9insOG7akQcRBfb2ir5NAyjE500HuBoGgf1DIl0NvXu2oEe0DieoqlbrBsnyC5sjiY9w-H77bGKLbrqR--C8eEU0w0cpTow8emfx-ErIy_0RcBw8XPBjdbjAzhUudBBnBZZZPbH_dU3HWH1FmsYT5xkshKK9UH1vyZSc8HowxWaRuUq_absILO8YP1Hi9Yn2ZH5r9H0vnbtFbtp-0bBjO04xndyLFuJb_ZrgysGfrTmEBjDI82YdZqp6Yk55Tza6hgBKKyPrGN8gLsKWvlMZCMZYP6MP1PfceW1On_AUtv5rAT0P-ai2-2aLIkq5hUx9iYyfWz3-wiONvzl-X1kJ-iOpdekNeE3eE2mtrMb9fQUu8tqpZSpTnnaxDJc0PH-KLiNKNiFZ1FjGqqNeXhKqT8JTiktoxXa6c1YHXk1_k7zCwh4bHotdYCxRCU2jHwJ0hqJrcqgzMmFlMmFlZqhzaGFyZF9pZM4Pcupv.sxvO-quMjAJiQ6s45hKB3EPGhdRxFoWmfkODm3RMzho";

    const response = await axios.post(
      `${CLAUDE_API}/api/organizations/${organization_uuid}/subscription/checkout_session/${checkout_session_id}/approve`,
      {
        client_attestation: {},
        hcaptcha_token: hcaptcha_token || defaultHcaptcha
      },
      { headers }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Approve error:', error.response?.data || error.message);
    if (typeof error.response?.data === 'string' && error.response.data.includes('<!DOCTYPE')) {
      return res.status(500).json({ error: 'Invalid response from server. Please try again.' });
    }
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// 6. Check Fable 5
app.post('/api/check-fable5', async (req, res) => {
  try {
    const { email, organization_uuid } = req.body;
    
    const headers = getHeadersWithSession(email);
    if (!headers.cookie) {
      return res.status(401).json({ error: 'No session found. Please login again.' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
