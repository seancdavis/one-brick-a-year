import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics, deriveBrowserFamily, deriveDeviceKind } from './analytics';

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

const START_FIELDS = {
  ageYears: 8,
  homeMeters: 8,
  colorId: 'bright-red',
  soundOn: true,
  inputKind: 'wheel' as const,
  viewportW: 1024,
  viewportH: 768,
  deviceKind: 'desktop' as const,
  browserFamily: 'chrome' as const,
};

describe('createAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('issues both the create and the end request immediately, without end waiting on create to resolve', () => {
    // The mocked create request never resolves — if end() were still chained
    // onto it (the old idPromise.then() pattern this replaced), the end
    // beacon below would never fire within this synchronous test.
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const beaconMock = vi.fn((_url: string, _data?: BodyInit) => true);
    vi.stubGlobal('navigator', { sendBeacon: beaconMock });

    const analytics = createAnalytics();
    analytics.start(START_FIELDS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [createUrl, createInit] = fetchMock.mock.calls[0];
    expect(createUrl).toBe('/api/sessions');
    const createBody = JSON.parse(createInit!.body as string);
    expect(typeof createBody.id).toBe('string');
    expect(createBody.id.length).toBeGreaterThan(0);

    analytics.end({ yearsReached: 100, finished: false }, { preferBeacon: true });

    expect(beaconMock).toHaveBeenCalledTimes(1);
    const [endUrl] = beaconMock.mock.calls[0];
    expect(endUrl).toBe(`/api/sessions/${createBody.id}/end`);
  });

  it('is a no-op the second time end() is called for the same session', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {})),
    );
    const beaconMock = vi.fn((_url: string, _data?: BodyInit) => true);
    vi.stubGlobal('navigator', { sendBeacon: beaconMock });

    const analytics = createAnalytics();
    analytics.start(START_FIELDS);
    analytics.end({ yearsReached: 100, finished: false }, { preferBeacon: true });
    analytics.end({ yearsReached: 200, finished: true }, { preferBeacon: true });

    expect(beaconMock).toHaveBeenCalledTimes(1);
  });
});
