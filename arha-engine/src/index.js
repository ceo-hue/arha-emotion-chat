/**
 * @arha/engine
 * ARHA Emotion Vector Engine — Self-hosted entry point
 *
 * Usage:
 *   import { ArhaEngine } from '@arha/engine';
 *
 *   const arha = new ArhaEngine({
 *     anthropicKey: process.env.ANTHROPIC_API_KEY,
 *     arhaLicense:  process.env.ARHA_LICENSE_KEY,
 *   });
 *
 *   const result = await arha.chat({ persona, blocks, message, history });
 *   console.log(result.response);
 */

import { chat } from './engine.js';
import { verifyLicense } from './license.js';

export class ArhaEngine {
  /**
   * @param {object} opts
   * @param {string} opts.anthropicKey  - 본인의 Anthropic API 키
   * @param {string} opts.arhaLicense   - ARHA 라이선스 키 (arha_lic_...)
   * @param {string} [opts.model]       - Claude 모델 override
   * @param {number} [opts.maxTokens]   - 최대 토큰 override
   */
  constructor({ anthropicKey, arhaLicense, model, maxTokens } = {}) {
    if (!anthropicKey) throw new Error('[ARHA] anthropicKey is required');
    if (!arhaLicense)  throw new Error('[ARHA] arhaLicense is required');
    this._anthropicKey = anthropicKey;
    this._arhaLicense  = arhaLicense;
    this._model        = model;
    this._maxTokens    = maxTokens;
  }

  /**
   * ARHA 엔진으로 대화 생성
   *
   * @param {object} opts
   * @param {object} opts.persona       - { summary: string, triggers?: [] }
   * @param {Array}  [opts.blocks]      - 에센스 블록 배열
   * @param {string} opts.message       - 유저 메시지
   * @param {Array}  [opts.history]     - 이전 대화 [{ role, content }]
   * @returns {Promise<{
   *   response: string,
   *   conflictIndex: number,
   *   vectorDistance: number,
   *   axisBreakdown: { x: number, y: number, z: number },
   *   activatedTriggers: string[]
   * }>}
   */
  async chat({ persona, blocks = [], message, history = [] }) {
    // 매 호출 전 라이선스 검증 (캐시로 1시간에 1번만 실제 요청)
    await verifyLicense(this._arhaLicense);

    return chat({
      anthropicKey: this._anthropicKey,
      persona,
      blocks,
      message,
      history,
      model:     this._model,
      maxTokens: this._maxTokens,
    });
  }
}

// 고급 사용자용: 함수형 API도 export
export { chat } from './engine.js';
