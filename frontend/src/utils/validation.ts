/**
 * Shared validation utilities for the Kumbh Mela application
 */

/**
 * Validates Indian phone number format
 * Must start with +91 and have 10 digits after that
 */
export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\s+/g, "");
  return /^\+91[6-9]\d{9}$/.test(cleaned);
};

/**
 * Formats phone number to Indian format with +91 prefix
 */
export const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (!value.startsWith("+91") && cleaned.length > 0) {
    if (cleaned.startsWith("91")) {
      return "+" + cleaned;
    }
    return "+91" + cleaned;
  }
  return value;
};

/**
 * Validates name format (2-50 characters, letters, spaces, and common punctuation)
 */
export const validateName = (name: string): boolean => {
  return /^[a-zA-Z\s.'-]{2,50}$/.test(name);
};

/**
 * Validates age (0-120 years)
 */
export const validateAge = (age: string): boolean => {
  const num = parseInt(age);
  return !isNaN(num) && num >= 0 && num <= 120;
};

/**
 * Validates height in centimeters (30-250 cm)
 */
export const validateHeight = (height: string): boolean => {
  const num = parseInt(height);
  return !isNaN(num) && num >= 30 && num <= 250;
};

/**
 * Validates GPS coordinates
 */
export const validateGPSCoordinates = (lat: number, lng: number): boolean => {
  // India roughly: 8°N to 37°N latitude, 68°E to 97°E longitude
  return lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97;
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validates password strength (minimum 6 characters)
 */
export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Validation error messages
 */
export const validationMessages = {
  phone: "Please enter a valid 10-digit phone number starting with +91",
  name: "Name should be 2-50 characters with letters only",
  age: "Age must be between 0 and 120",
  height: "Height must be between 30 and 250 cm",
  gps: "GPS coordinates appear to be outside India. Please ensure location services are enabled.",
  email: "Please enter a valid email address",
  password: "Password must be at least 6 characters",
  required: "This field is required",
};

/**
 * Get validation message for a specific field
 */
export const getValidationMessage = (field: string): string => {
  switch (field) {
    case "reporter_phone":
    case "phone":
      return validationMessages.phone;
    case "reporter_name":
    case "person_name":
    case "name":
      return validationMessages.name;
    case "person_age":
    case "age":
      return validationMessages.age;
    case "person_height":
    case "height":
      return validationMessages.height;
    case "email":
      return validationMessages.email;
    case "password":
      return validationMessages.password;
    default:
      return "Invalid input";
  }
};
