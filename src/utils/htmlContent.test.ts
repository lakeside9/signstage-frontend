import { describe, expect, it } from 'vitest';
import { isHtmlContentEmpty } from './htmlContent';

describe('isHtmlContentEmpty', () => {
  it('완전히 빈 문자열은 비어 있다', () => {
    expect(isHtmlContentEmpty('')).toBe(true);
  });

  it('태그만 있고 텍스트가 없는 에디터 초기값은 비어 있다', () => {
    expect(isHtmlContentEmpty('<p></p>')).toBe(true);
    expect(isHtmlContentEmpty('<p><br></p>')).toBe(true);
  });

  it('공백만 있는 텍스트도 비어 있다', () => {
    expect(isHtmlContentEmpty('<p>   </p>')).toBe(true);
  });

  it('실제 텍스트가 있으면 비어 있지 않다', () => {
    expect(isHtmlContentEmpty('<p>안녕하세요</p>')).toBe(false);
  });

  it('서식 태그로만 둘러싸인 텍스트도 비어 있지 않다', () => {
    expect(isHtmlContentEmpty('<ul><li><strong>공지</strong></li></ul>')).toBe(false);
  });
});
