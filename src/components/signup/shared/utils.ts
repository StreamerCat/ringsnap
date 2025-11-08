const GENERIC_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'ymail.com'
];

export const isGenericEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return GENERIC_EMAIL_DOMAINS.includes(domain);
};

export const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
};

export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
};

export const extractCompanyNameFromEmail = (email: string): string => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || isGenericEmail(email)) return '';
  // Convert "acme.com" to "Acme"
  return domain.split('.')[0]
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
