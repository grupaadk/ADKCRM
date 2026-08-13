export function normalizePhoneForDb(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  
  // Usuń wszystkie znaki, które nie są cyframi
  let cleaned = phone.replace(/\D/g, "");
  
  // Jeśli numer zaczyna się od "48" (prefiks Polski) i ma 11 cyfr, ucinamy prefiks
  if (cleaned.length === 11 && cleaned.startsWith("48")) {
    cleaned = cleaned.slice(2);
  }
  
  // Jeśli numer ma 9 cyfr, formatujemy go jako XXX-XXX-XXX
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
  }
  
  // Jeśli numer ma inną długość, zwracamy oczyszczony z innych znaków (np. zagraniczny)
  return phone.trim();
}
