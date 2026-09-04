import { describe, expect, it } from 'vitest';
import { deriveBrowserFamily, deriveDeviceKind } from './analytics';

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/604.1';
const ANDROID_PHONE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Chrome/120.0';
const ANDROID_TABLET_UA = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0';
const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DESKTOP_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const DESKTOP_FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
const DESKTOP_EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
const IOS_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile Safari/604.1';
const IOS_FIREFOX_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile Safari/604.1';

describe('deriveDeviceKind', () => {
  it('reads an iPad as a tablet regardless of viewport width', () => {
    expect(deriveDeviceKind(IPAD_UA, 400, true)).toBe('tablet');
  });

  it('reads an Android UA without "Mobile" as a tablet', () => {
    expect(deriveDeviceKind(ANDROID_TABLET_UA, 400, true)).toBe('tablet');
  });

  it('reads a wide touch viewport as a tablet', () => {
    expect(deriveDeviceKind(DESKTOP_CHROME_UA, 1024, true)).toBe('tablet');
  });

  it('reads a narrow touch viewport as a phone', () => {
    expect(deriveDeviceKind(ANDROID_PHONE_UA, 400, true)).toBe('phone');
  });

  it('reads a non-touch device as a desktop regardless of width', () => {
    expect(deriveDeviceKind(DESKTOP_CHROME_UA, 400, false)).toBe('desktop');
    expect(deriveDeviceKind(DESKTOP_CHROME_UA, 1920, false)).toBe('desktop');
  });
});

describe('deriveBrowserFamily', () => {
  it('reads Edge as edge, not chrome, despite also containing "Chrome"', () => {
    expect(deriveBrowserFamily(DESKTOP_EDGE_UA)).toBe('edge');
  });

  it('reads desktop Chrome as chrome', () => {
    expect(deriveBrowserFamily(DESKTOP_CHROME_UA)).toBe('chrome');
  });

  it('reads iOS Chrome (CriOS) as chrome', () => {
    expect(deriveBrowserFamily(IOS_CHROME_UA)).toBe('chrome');
  });

  it('reads desktop Firefox as firefox', () => {
    expect(deriveBrowserFamily(DESKTOP_FIREFOX_UA)).toBe('firefox');
  });

  it('reads iOS Firefox (FxiOS) as firefox', () => {
    expect(deriveBrowserFamily(IOS_FIREFOX_UA)).toBe('firefox');
  });

  it('reads desktop Safari as safari', () => {
    expect(deriveBrowserFamily(DESKTOP_SAFARI_UA)).toBe('safari');
  });

  it('reads an unrecognized UA as other', () => {
    expect(deriveBrowserFamily('SomeOtherBrowser/1.0')).toBe('other');
  });
});
