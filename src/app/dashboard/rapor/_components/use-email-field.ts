'use client';

import { useEffect, useState } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Yazma durduktan bu kadar sonra geçersiz e-posta uyarısı görünür. */
const SETTLE_MS = 600;

/**
 * Tedarikçi e-posta alanının doğrulaması. Boş alan geçerlidir (e-posta
 * opsiyonel). Uyarı yazarken her tuşta yanıp sönmesin diye kullanıcı yazmayı
 * bırakınca ya da alandan çıkınca görünür; geçerli olduğu an kaybolur.
 */
export function useEmailField(email: string) {
  const trimmed = email.trim();
  const valid = trimmed === '' || EMAIL_PATTERN.test(trimmed);

  const [settled, setSettled] = useState(email);
  const [blurred, setBlurred] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(email), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [email]);

  const showError = !valid && (blurred || settled === email);

  return {
    trimmed,
    valid,
    showError,
    onBlur: () => setBlurred(true),
    /** Form sıfırlanınca (dialog/popover yeniden açılış) uyarı da temiz başlar. */
    reset: () => setBlurred(false),
  };
}
