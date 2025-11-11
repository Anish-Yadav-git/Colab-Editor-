export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate document title
 * Requirements: 1-200 characters
 */
export function validateDocumentTitle(title: string): ValidationResult {
  if (!title || title.trim().length === 0) {
    return {
      isValid: false,
      error: 'Document title is required',
    };
  }

  if (title.length < 1) {
    return {
      isValid: false,
      error: 'Document title must be at least 1 character',
    };
  }

  if (title.length > 200) {
    return {
      isValid: false,
      error: 'Document title must not exceed 200 characters',
    };
  }

  return { isValid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return {
      isValid: false,
      error: 'Email is required',
    };
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
    };
  }

  if (email.length > 254) {
    return {
      isValid: false,
      error: 'Email address is too long',
    };
  }

  return { isValid: true };
}

/**
 * Validate password requirements
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return {
      isValid: false,
      error: 'Password is required',
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      error: 'Password must not exceed 128 characters',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number',
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one special character',
    };
  }

  return { isValid: true };
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): ValidationResult {
  if (!confirmation || confirmation.length === 0) {
    return {
      isValid: false,
      error: 'Please confirm your password',
    };
  }

  if (password !== confirmation) {
    return {
      isValid: false,
      error: 'Passwords do not match',
    };
  }

  return { isValid: true };
}

/**
 * Validate user name
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Name is required',
    };
  }

  if (name.length < 2) {
    return {
      isValid: false,
      error: 'Name must be at least 2 characters',
    };
  }

  if (name.length > 100) {
    return {
      isValid: false,
      error: 'Name must not exceed 100 characters',
    };
  }

  return { isValid: true };
}

/**
 * Validate all fields and return combined errors
 */
export function validateForm(
  fields: Record<string, string>,
  validators: Record<string, (value: string) => ValidationResult>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [fieldName, value] of Object.entries(fields)) {
    const validator = validators[fieldName];
    if (validator) {
      const result = validator(value);
      if (!result.isValid && result.error) {
        errors[fieldName] = result.error;
      }
    }
  }

  return errors;
}
