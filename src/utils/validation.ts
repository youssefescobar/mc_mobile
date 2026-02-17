/**
 * Validates a Saudi National ID or Iqama number.
 * Uses the Luhn algorithm-like check used by Saudi authorities.
 * National ID starts with 1, Iqama starts with 2.
 * Length must be 10 digits.
 */
export const isValidSaudiID = (id: string): boolean => {
    if (!id) return false;
    // Remove all non-digit characters (spaces, dashes, etc.)
    const cleanId = id.replace(/\D/g, '');
    if (cleanId.length !== 10) return false;
    if (!['1', '2'].includes(cleanId[0])) return false;
    if (!/^\d{10}$/.test(cleanId)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        const digit = parseInt(cleanId[i], 10);
        if (i % 2 === 0) {
            const doubled = digit * 2;
            sum += doubled > 9 ? doubled - 9 : doubled;
        } else {
            sum += digit;
        }
    }
    return sum % 10 === 0;
};

/**
 * Validates a Passport number.
 * Standard format: 6-9 alphanumeric characters.
 */
export const isValidPassport = (passport: string): boolean => {
    if (!passport) return false;
    // Remove spaces and convert to uppercase for consistency
    const cleanPassport = passport.replace(/\s+/g, '').toUpperCase();
    // Relaxed International Passport regex (allows 5-20 alphanumeric)
    // Some countries have longer passport numbers or shorter ones.
    const regex = /^[A-Z0-9]{5,20}$/;
    return regex.test(cleanPassport);
};
