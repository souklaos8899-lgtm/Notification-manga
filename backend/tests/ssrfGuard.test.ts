import { describe, expect, it } from 'vitest';
import {
  assertSafeUrl,
  isPrivateIp,
  isPrivateIPv4,
  isPrivateIPv6,
  SsrfSecurityError,
} from '../src/security/ssrfGuard';

describe('SSRF Guard Security Tests', () => {
  it('blocks standard, octal, hex, and integer IPv4 representations', () => {
    // Standard loopback and private
    expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    expect(isPrivateIPv4('127.100.200.1')).toBe(true);
    expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('192.168.1.1')).toBe(true);
    expect(isPrivateIPv4('169.254.169.254')).toBe(true);
    expect(isPrivateIPv4('100.64.0.1')).toBe(true);
    expect(isPrivateIPv4('0.0.0.0')).toBe(true);

    // Octal representation (0177.0.0.1 = 127.0.0.1)
    expect(isPrivateIPv4('0177.0.0.1')).toBe(true);
    expect(isPrivateIPv4('0177.0000.0000.0001')).toBe(true);

    // Hex representations (0x7f.0.0.1, 0x7f000001 = 127.0.0.1)
    expect(isPrivateIPv4('0x7f.0.0.1')).toBe(true);
    expect(isPrivateIPv4('0x7f000001')).toBe(true);
    expect(isPrivateIPv4('0xa.0.0.1')).toBe(true); // 10.0.0.1

    // Dword integer representation (2130706433 = 127.0.0.1)
    expect(isPrivateIPv4('2130706433')).toBe(true);

    // Public IPs
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv4('1.1.1.1')).toBe(false);
    expect(isPrivateIPv4('142.250.190.46')).toBe(false);
  });

  it('blocks private, loopback, and IPv4-mapped IPv6 addresses', () => {
    expect(isPrivateIPv6('::1')).toBe(true);
    expect(isPrivateIPv6('::')).toBe(true);
    expect(isPrivateIPv6('0:0:0:0:0:0:0:1')).toBe(true);
    expect(isPrivateIPv6('0:0:0:0:0:0:0:0')).toBe(true);
    expect(isPrivateIPv6('fc00::1')).toBe(true);
    expect(isPrivateIPv6('fd12:3456:789a::1')).toBe(true);
    expect(isPrivateIPv6('fe80::1')).toBe(true);

    // IPv4-mapped IPv6 (dotted decimal and hex forms)
    expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:7f00:1')).toBe(true);
    expect(isPrivateIPv6('[::ffff:7f00:1]')).toBe(true);
    expect(isPrivateIPv6('0:0:0:0:0:ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIPv6('0:0:0:0:0:ffff:7f00:1')).toBe(true);
    expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:a00:1')).toBe(true);
    expect(isPrivateIPv6('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);

    // Public IPv6
    expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
  });

  it('rejects forbidden protocols and schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('ftp://example.com/file')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('javascript:alert(1)')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('gopher://127.0.0.1:6379/')).rejects.toThrow(SsrfSecurityError);
  });

  it('rejects local hostnames and direct private IP URLs including IPv6 and alternative encodings', async () => {
    await expect(assertSafeUrl('http://localhost:4000')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://admin.localhost/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://myhost.local/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://backend.internal/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://127.0.0.1/secret')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://192.168.1.1/admin')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://10.0.0.5/api')).rejects.toThrow(SsrfSecurityError);

    // Hex, octal, integer URL forms
    await expect(assertSafeUrl('http://0177.0.0.1/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://0x7f.0.0.1/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://0x7f000001/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://2130706433/')).rejects.toThrow(SsrfSecurityError);

    // IPv6 URLs
    await expect(assertSafeUrl('http://[::1]/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://[::ffff:127.0.0.1]/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://[::ffff:7f00:1]/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://[fe80::1]/')).rejects.toThrow(SsrfSecurityError);
    await expect(assertSafeUrl('http://[fc00::1]/')).rejects.toThrow(SsrfSecurityError);
  });
});
