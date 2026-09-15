// /api/analyze-photo.js
// Vercel Serverless Function — Gemini API 키를 서버 환경변수에서만 읽고,
// 브라우저에는 절대 노출하지 않습니다.
//
// 설정 방법:
// 1) Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
// 2) Key: GEMINI_API_KEY, Value: (Google AI Studio에서 발급받은 키) 등록 → Save
// 3) Production/Preview 둘 다 체크한 뒤 재배포(Redeploy)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const { base64, mimeType, catLabel, dimText } = req.body || {};

  if (!GEMINI_API_KEY) {
    // 서버에 키가 아직 등록되지 않은 경우: 판단 없이 통과 처리 (기존 클라이언트 동작과 동일)
    return res.status(200).json({ tier: 0, matches: true, note: 'GEMINI_API_KEY not set on server' });
  }
  if (!base64 || !catLabel) {
    return res.status(400).json({ error: 'Missing base64 or catLabel' });
  }

  const prompt = `고객이 "${catLabel}" 항목을 선택하고 사진을 찍었습니다.

1. 먼저, 사진 속 물건이 실제로 "${catLabel}"이 맞는지 확인하세요. 완전히 다른 종류의 물건(예: 침대를 선택했는데 협탁 사진, 소파인데 의자 사진 등)이면 matches를 false로 하세요. 같은 대분류(가구 종류)면 다소 애매해도 matches는 true로 하세요.
2. matches가 true인 경우에만, 사진 속 물건의 크기를 일반적인 기준 크기와 비교해 주세요. ${dimText || ''}
-10(매우 작음) ~ 0(기준과 비슷함) ~ +10(매우 큼) 사이의 정수로 판단하세요. 기준보다 크면 양수, 작으면 음수, 비슷하면 0입니다.

반드시 아래 JSON 형식으로만 답하세요. 다른 설명 없이.
{"matches": true 또는 false, "tier": 정수}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      // Gemini의 실제 응답을 그대로 로그에 남겨서 원인(키 오류/할당량/안전필터 등)을 확인할 수 있게 함
      console.error('Gemini returned no usable text. Full response:', JSON.stringify(data));
    }
    const parsed = JSON.parse(text);

    let tier = parseInt(parsed.tier, 10);
    if (!Number.isInteger(tier) || tier < -10 || tier > 10) tier = 0;
    const matches = parsed.matches !== false;

    return res.status(200).json({ tier, matches });
  } catch (err) {
    console.error('Gemini analyze-photo failed:', err);
    // 실패 시에도 사용자 흐름이 막히지 않도록 통과 처리
    return res.status(200).json({ tier: 0, matches: true, note: 'analysis failed, defaulted' });
  }
}
