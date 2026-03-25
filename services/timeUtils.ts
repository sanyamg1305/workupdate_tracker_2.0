
/**
 * Utility to parse flexible time inputs into minutes.
 * Supports: "1h 30m", "90min", "1.5h", "0.5", etc.
 */
export const parseTimeInput = (input: string): number => {
  if (!input) return 0;
  
  const cleanInput = input.toLowerCase().trim();
  
  // Case: "1h 30m" or "1h30m"
  const hMatch = cleanInput.match(/(\d+(\.\d+)?)h/);
  const mMatch = cleanInput.match(/(\d+(\.\d+)?)m/);
  
  let totalMinutes = 0;
  
  if (hMatch) {
    totalMinutes += parseFloat(hMatch[1]) * 60;
  }
  
  if (mMatch) {
    totalMinutes += parseFloat(mMatch[1]);
  }
  
  // If no h/m units, check if it's just a number (assume minutes if < 24 and no unit, but user said 0.5h is valid)
  // Actually, if it's just a number like "90", it could be minutes. If "1.5", it could be hours.
  // The requirement says "0.5h (still valid)" and "90 min".
  // If no units are provided at all, let's look at the decimal.
  if (!hMatch && !mMatch) {
    const num = parseFloat(cleanInput);
    if (!isNaN(num)) {
      // If it contains a dot or is small (< 8), assume hours. Otherwise assume minutes?
      // This is ambiguous. Let's stick to the units or default to hours for consistency with existing logic.
      // Existing logic used hours (0.5 increments).
      totalMinutes = num * 60;
    }
  }
  
  return totalMinutes;
};

/**
 * Formats minutes into a readable string like "1h 20m".
 */
export const formatTimeDisplay = (minutes: number): string => {
  if (minutes === 0) return "0m";
  
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  
  let result = "";
  if (h > 0) result += `${h}h `;
  if (m > 0) result += `${m}m`;
  
  return result.trim();
};

/**
 * Formats minutes into decimal hours (e.g., 90 -> 1.5).
 */
export const toDecimalHours = (minutes: number): number => {
  return parseFloat((minutes / 60).toFixed(2));
};
