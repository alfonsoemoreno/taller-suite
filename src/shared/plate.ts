export const normalizePlate = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const PLATE_PATTERNS = [/^[A-Z]{4}\d{2}$/, /^[A-Z]{2}\d{4}$/];

export const isValidChileanPlate = (plate: string) => {
  const normalized = normalizePlate(plate);
  return PLATE_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const extractPlateCandidates = (rawText: string) => {
  const normalized = normalizePlate(rawText);
  const candidates = new Set<string>();
  const regexes = [/[A-Z]{4}\d{2}/g, /[A-Z]{2}\d{4}/g];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      candidates.add(match[0]);
    }
  }

  return Array.from(candidates);
};
