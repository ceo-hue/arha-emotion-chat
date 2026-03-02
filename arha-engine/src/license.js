/**
 * ARHA License Validator
 * 엔진 초기화 시 라이선스 서버에 검증 요청
 */

const LICENSE_SERVER = 'https://arha-admin.vercel.app/api/license/verify';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1시간 캐시 (매 호출마다 검증 방지)

let _cache = null; // { validUntil: number, licenseKey: string }

/**
 * 라이선스 키 검증
 * @param {string} licenseKey - arha_lic_xxxxxxxx 형식
 * @throws 유효하지 않으면 Error
 */
export async function verifyLicense(licenseKey) {
  if (!licenseKey) throw new Error('[ARHA] arhaLicense key is required. Get one at https://arha-admin.vercel.app');

  // 캐시 유효하면 스킵
  if (_cache && _cache.licenseKey === licenseKey && Date.now() < _cache.validUntil) {
    return;
  }

  let result;
  try {
    const resp = await fetch(LICENSE_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
    result = await resp.json();
    if (!resp.ok) throw new Error(result.error || 'License verification failed');
  } catch (e) {
    // 네트워크 오류 시: 캐시가 있으면 허용 (grace period), 없으면 차단
    if (_cache && _cache.licenseKey === licenseKey) return;
    throw new Error('[ARHA] License verification failed: ' + e.message);
  }

  if (!result.valid) {
    throw new Error('[ARHA] Invalid or expired license: ' + (result.reason || 'unknown'));
  }

  // 캐시 갱신
  _cache = { licenseKey, validUntil: Date.now() + CACHE_TTL_MS };
}
