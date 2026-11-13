import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

/**
 * 견적 인감 이미지를 관리자 인증으로 받아 object URL로 돌려준다 — 인감은 공개 경로에 두지 않아 <img src>로 바로 못 쓴다.
 * endpoint가 null이면 받지 않는다. version을 바꾸면 다시 받는다(업로드 뒤).
 */
export const useQuoteSealUrl = (endpoint: string | null, version = 0) => {
  const requestKey = endpoint === null ? null : `${endpoint}#${version}`;
  /** 마지막으로 받은 요청과 그 결과(실패하면 url null). */
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (endpoint === null || requestKey === null) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .getBlob(endpoint)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ key: requestKey, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, url: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, requestKey]);

  if (requestKey === null) return { sealUrl: null, isLoaded: true };
  const isLoaded = result?.key === requestKey;
  return { sealUrl: isLoaded ? result.url : null, isLoaded };
};
