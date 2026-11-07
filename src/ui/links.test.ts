import { describe, expect, it } from 'vitest';
import { SUPPORT_URL, supportUrl } from './links';

describe('The Support link (D-169)', () => {
  it('shows only for an https Ko-fi page', () => {
    expect(supportUrl('')).toBeNull();
    expect(supportUrl('https://ko-fi.com/example')).toBe('https://ko-fi.com/example');
    expect(supportUrl('http://ko-fi.com/example')).toBeNull();
    expect(supportUrl('https://evil.example/ko-fi.com')).toBeNull();
    expect(supportUrl('javascript:alert(1)')).toBeNull();
  });

  it("is set to the developer's Ko-fi page, so the main menu shows it", () => {
    expect(supportUrl()).toBe(SUPPORT_URL);
  });
});
