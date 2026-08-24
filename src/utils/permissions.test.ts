import { describe, expect, it } from 'vitest';
import { canManagePlatform, isPlatformSuper } from './permissions';

describe('canManagePlatform', () => {
  it('PLATFORM_OPS/PLATFORM_SUPER는 제어 가능하다', () => {
    expect(canManagePlatform('PLATFORM_OPS')).toBe(true);
    expect(canManagePlatform('PLATFORM_SUPER')).toBe(true);
  });

  it('PLATFORM_SUPPORT나 없음은 제어할 수 없다', () => {
    expect(canManagePlatform('PLATFORM_SUPPORT')).toBe(false);
    expect(canManagePlatform(null)).toBe(false);
    expect(canManagePlatform(undefined)).toBe(false);
  });
});

describe('isPlatformSuper', () => {
  it('PLATFORM_SUPER만 true다', () => {
    expect(isPlatformSuper('PLATFORM_SUPER')).toBe(true);
    expect(isPlatformSuper('PLATFORM_OPS')).toBe(false);
    expect(isPlatformSuper(null)).toBe(false);
  });
});
