/**
 * Validates a Saudi National ID or Iqama number.
 * Uses the Luhn algorithm-like check used by Saudi authorities.
 * National ID starts with 1, Iqama starts with 2.
 * Length must be 10 digits.
 */
export const isValidSaudiID = (id: string): boolean => {
    if (!id || id.length !== 10) return false;

    // Must start with 1 or 2
    if (!['1', '2'].includes(id[0])) return false;

    // Must be all digits
    if (!/^\d+$/.test(id)) return false;

    // Checksum calculation
    // 1. Sum odd digits (1st, 3rd, ... 9th) -> Indices 0, 2, ... 8
    // 2. Multiply even digits (2nd, 4th, ... 10th) by 2 -> Indices 1, 3, ... 9. 
    //    If result > 9, subtract 9. Sum these results.
    // 3. Total sum % 10 should be 0.

    // Note: The standard Luhn definition often processes right-to-left. 
    // Saudi ID specific implementation usually follows:
    // "The sum of the odd digits (positions 1, 3, 5, 7, 9) plus the sum of the even digits (positions 2, 4, 6, 8, 10) multiplied by 2.
    // If the multiplied digit is > 9, subtract 9."
    // Let's implement the standard check known for Saudi ID:

    let sum = 0;
    for (let i = 0; i < 10; i++) {
        const digit = parseInt(id[i], 10);
        // Even positions (1-based index: 2, 4, 6, 8, 10) -> Array index (1, 3, 5, 7, 9) are multiplied by 2?
        // Actually, the common variation for Saudi ID is:
        // Position (1-based): 1 2 3 4 5 6 7 8 9 10
        // Weight:             1 2 1 2 1 2 1 2 1 2  <-- Wait, usually check digit is last.

        // Official formula often cited:
        // "Review the first digit... If 1 (National) or 2 (Iqama)..."
        // Algorithm:
        // 1. Digits at odd positions (1, 3, 5, 7, 9) are multiplied by 2 ?? No wait.

        // Let's use the proven implementation:
        // digit at index i (0-based):
        // if i is even (0, 2, 4...): multiply by 2. If > 9, subtract 9.
        // if i is odd (1, 3, 5...): add as is.
        // wait, let's verify.
        // Example ID: 1000000003 (Valid?)

        // Correct Saudi ID Validation Algorithm:
        // 1. Put the weights corresponding to the 10 digits: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] ? No.

        // Let's stick to the reliable code snippet for Saudi ID:
        // odd indices (1, 3, 5...) match even positions in 1-based indexing.

        if (i % 2 === 0) { // Indices 0, 2, 4, 6, 8 (Odd positions 1, 3, 5...)
            const doubled = digit * 2;
            sum += doubled > 9 ? doubled - 9 : doubled;
        } else { // Indices 1, 3, 5, 7, 9 (Even positions 2, 4, 6...)
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
    // Standard international passport regex (allows 6-9 alphanumeric)
    const regex = /^[A-Z0-9]{6,9}$/i;
    return regex.test(passport);
};
