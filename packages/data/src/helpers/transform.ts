/**
 * Data Transformation Helper Functions
 * These functions help convert between camelCase and snake_case formats
 */

/**
 * Removes keys with undefined values from an object (recursively)
 * This is important for Supabase inserts to avoid sending undefined as null
 * @param obj - The object to clean
 * @returns A new object without undefined values
 * @example
 * cleanUndefined({ name: 'John', email: undefined, age: 25 })
 * // { name: 'John', age: 25 }
 */
export function cleanUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item));
  }

  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      // Skip undefined values entirely
      if (value === undefined) {
        continue;
      }

      // Recursively clean nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        result[key] = cleanUndefined(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Converts a camelCase string to snake_case
 * @param str - The camelCase string to convert
 * @returns The snake_case string
 * @example
 * camelToSnake('schoolId') // 'school_id'
 * camelToSnake('academicYearId') // 'academic_year_id'
 */
export function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Converts a snake_case string to camelCase
 * @param str - The snake_case string to convert
 * @returns The camelCase string
 * @example
 * snakeToCamel('school_id') // 'schoolId'
 * snakeToCamel('academic_year_id') // 'academicYearId'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively converts all keys in an object from camelCase to snake_case
 * @param obj - The object with camelCase keys
 * @returns A new object with snake_case keys
 * @example
 * camelToSnakeKeys({ schoolId: '123', name: 'Test' })
 * // { school_id: '123', name: 'Test' }
 */
export function camelToSnakeKeys<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnakeKeys(item));
  }

  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnake(key);
      const value = obj[key];

      // Recursively convert nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        result[snakeKey] = camelToSnakeKeys(value);
      } else {
        result[snakeKey] = value;
      }
    }
  }

  return result;
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase
 * @param obj - The object with snake_case keys
 * @returns A new object with camelCase keys
 * @example
 * snakeToCamelKeys({ school_id: '123', name: 'Test' })
 * // { schoolId: '123', name: 'Test' }
 */
export function snakeToCamelKeys<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamelKeys(item));
  }

  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      const value = obj[key];

      // Recursively convert nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        result[camelKey] = snakeToCamelKeys(value);
      } else {
        result[camelKey] = value;
      }
    }
  }

  return result;
}
