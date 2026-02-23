import { format, parseISO, differenceInYears } from "date-fns";

// Date formatters
export const formatDate = (date: Date | string, formatStr = "PPP") => {
  const parsedDate = typeof date === "string" ? parseISO(date) : date;
  return format(parsedDate, formatStr);
};

export const formatDateTime = (date: Date | string) => {
  return formatDate(date, "PPP p");
};

export const formatTime = (date: Date | string) => {
  const parsedDate = typeof date === "string" ? parseISO(date) : date;
  return format(parsedDate, "p");
};

export const formatShortDate = (date: Date | string) => {
  return formatDate(date, "P");
};

export const formatRelativeTime = (date: Date | string) => {
  const parsedDate = typeof date === "string" ? parseISO(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - parsedDate.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date, "MMM d, yyyy");
};

// String formatters
export const formatName = (firstName: string, lastName: string) => {
  return `${firstName} ${lastName}`;
};

export const formatInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

// Number formatters
export const formatPercentage = (value: number, decimals = 1) => {
  return `${value.toFixed(decimals)}%`;
};

export const formatGrade = (score: number, maxScore: number) => {
  return `${score}/${maxScore}`;
};

export const formatGPA = (percentage: number): { gpa: number; letter: string } => {
  let letter = "F";
  let gpa = 0.0;

  if (percentage >= 97) {
    letter = "A+";
    gpa = 4.0;
  } else if (percentage >= 93) {
    letter = "A";
    gpa = 4.0;
  } else if (percentage >= 90) {
    letter = "A-";
    gpa = 3.7;
  } else if (percentage >= 87) {
    letter = "B+";
    gpa = 3.3;
  } else if (percentage >= 83) {
    letter = "B";
    gpa = 3.0;
  } else if (percentage >= 80) {
    letter = "B-";
    gpa = 2.7;
  } else if (percentage >= 77) {
    letter = "C+";
    gpa = 2.3;
  } else if (percentage >= 73) {
    letter = "C";
    gpa = 2.0;
  } else if (percentage >= 70) {
    letter = "C-";
    gpa = 1.7;
  } else if (percentage >= 67) {
    letter = "D+";
    gpa = 1.3;
  } else if (percentage >= 63) {
    letter = "D";
    gpa = 1.0;
  } else if (percentage >= 60) {
    letter = "D-";
    gpa = 0.7;
  }

  return { gpa, letter };
};

// Validators
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
};

export const calculateAge = (dateOfBirth: Date | string): number => {
  const dob = typeof dateOfBirth === "string" ? parseISO(dateOfBirth) : dateOfBirth;
  return differenceInYears(new Date(), dob);
};

// Array helpers
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

export const uniqueBy = <T>(array: T[], key: keyof T): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const keyValue = String(item[key]);
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
};

export const sortBy = <T>(array: T[], key: keyof T, order: "asc" | "desc" = "asc"): T[] => {
  return [...array].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];

    if (aValue < bValue) return order === "asc" ? -1 : 1;
    if (aValue > bValue) return order === "asc" ? 1 : -1;
    return 0;
  });
};

// Object helpers
export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
};

export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Debounce function
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Schedule constraint validation
export * from "./scheduleConstraints";

// Auth utilities
export * from "./auth";

// Schedule helpers
export * from "./scheduleHelpers";

// Payment status utilities
export * from "./paymentStatus";

// Document access utilities
export * from "./documentAccess";

// Card generation utilities
export * from "./cardGeneration";

// Campus helpers
export * from "./campusHelpers";
