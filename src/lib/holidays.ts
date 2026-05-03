// Default Philippine Regular Holidays (HR can override via DB).
// Date format: MM-DD for fixed-date Regular Holidays only.
// Movable holidays should be added explicitly per-year via the holidays table.
export const PH_REGULAR_HOLIDAYS_FIXED: Record<string, string> = {
  "01-01": "New Year's Day",
  "04-09": "Araw ng Kagitingan",
  "05-01": "Labor Day",
  "06-12": "Independence Day",
  "08-21": "Ninoy Aquino Day",
  "08-26": "National Heroes Day",
  "11-30": "Bonifacio Day",
  "12-25": "Christmas Day",
  "12-30": "Rizal Day",
  "12-31": "Last Day of the Year",
};
