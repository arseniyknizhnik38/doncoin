import { describe, expect, it } from 'vitest';
import { buildPostbackUrl } from './postback.js';

const input = {
  tag: { source: 'adsgram', placement: '412', campaign: '99071', clickId: 'abc 123&x' },
  userId: '777001',
  event: 'taps',
};

describe('buildPostbackUrl', () => {
  it('подставляет значения сети', () => {
    const url = buildPostbackUrl(
      'https://net.example/cb?click_id={click_id}&event={event}&uid={user_id}',
      input,
    );

    expect(url).toBe(
      'https://net.example/cb?click_id=abc%20123%26x&event=taps&uid=777001',
    );
  });

  it('экранирует click id, чтобы он не разломал запрос', () => {
    expect(buildPostbackUrl('https://n.example/?c={click_id}', input)).not.toContain('&x');
  });

  it('пустая площадка подставляется пустой строкой, а не словом null', () => {
    const url = buildPostbackUrl('https://n.example/?p={placement}', {
      ...input,
      tag: { ...input.tag, placement: null },
    });

    expect(url).toBe('https://n.example/?p=');
  });

  it('собирает запрос AdsGram ровно по их документации', () => {
    const url = buildPostbackUrl(
      'https://api.adsgram.ai/confirm_conversion?token=T0KEN&tgid={user_id}&goaltype=1&campaignid={campaign}',
      input,
    );

    expect(url).toBe(
      'https://api.adsgram.ai/confirm_conversion?token=T0KEN&tgid=777001&goaltype=1&campaignid=99071',
    );
  });

  it('незнакомую подстановку оставляет как есть', () => {
    expect(buildPostbackUrl('https://n.example/?x={unknown}', input)).toContain('{unknown}');
  });
});
