// Timezone utility functions for handling IST (Indian Standard Time) dates
// This is crucial for ensuring consistent date handling across different deployment environments

/**
 * Convert any date to IST timezone
 * @param {Date|string|null} date - Date to convert (defaults to current time)
 * @returns {Date} Date adjusted for IST timezone
 */
export const getISTDate = (date = null) => {
  const d = date ? new Date(date) : new Date();
  // IST is UTC+5:30 (5 hours 30 minutes ahead of UTC)
  const istOffset = 5.5 * 60 * 60 * 1000; // in milliseconds
  return new Date(d.getTime() + istOffset);
};

/**
 * Get the start of day in IST timezone
 * @param {Date|string|null} date - Date to get start of (defaults to today)
 * @returns {Date} UTC time that corresponds to midnight IST
 */
export const getISTStartOfDay = (date = null) => {
  const istDate = date ? new Date(date) : getISTDate();
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();
  
  // Create date at midnight IST
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  // Subtract IST offset to get the UTC time that corresponds to IST midnight
  // This is what should be stored in the database (which stores in UTC)
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(startOfDay.getTime() - istOffset);
};

/**
 * Get the end of day in IST timezone
 * @param {Date|string|null} date - Date to get end of (defaults to today)
 * @returns {Date} UTC time that corresponds to 23:59:59.999 IST
 */
export const getISTEndOfDay = (date = null) => {
  const istDate = date ? new Date(date) : getISTDate();
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();
  
  // Create date at end of day IST
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  
  // Subtract IST offset to get the UTC time that corresponds to IST end of day
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(endOfDay.getTime() - istOffset);
};

/**
 * Get yesterday's date range in IST
 * @returns {Object} Object with start and end dates for yesterday
 */
export const getYesterdayRange = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return {
    start: getISTStartOfDay(yesterday),
    end: getISTEndOfDay(yesterday)
  };
};

/**
 * Get last week's date range in IST
 * @returns {Object} Object with start and end dates for last 7 days
 */
export const getLastWeekRange = () => {
  const today = getISTEndOfDay();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 6);
  
  return {
    start: getISTStartOfDay(lastWeek),
    end: today
  };
};

/**
 * Get last month's date range in IST
 * @returns {Object} Object with start and end dates for last 30 days
 */
export const getLastMonthRange = () => {
  const today = getISTEndOfDay();
  const lastMonth = new Date(today);
  lastMonth.setDate(today.getDate() - 29);
  
  return {
    start: getISTStartOfDay(lastMonth),
    end: today
  };
};

/**
 * Get the current calendar month's range in IST (1st 00:00:00 → today 23:59:59.999).
 *
 * This is the default window for admin list pages: without it those queries scanned all history,
 * which gets monotonically slower as the dataset grows. Note this is a CALENDAR month, not a
 * rolling 30 days, so the boundaries line up with the accounting periods the finance pages use.
 * @returns {{start: Date, end: Date}}
 */
export const getCurrentMonthRange = () => {
  const istNow = getISTDate();
  const firstOfMonth = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), 1));

  return {
    start: getISTStartOfDay(firstOfMonth),
    end: getISTEndOfDay(),
  };
};

/**
 * Resolve the date window for a list API route from its query string.
 *
 * Precedence: an explicit `all=1` (or `all=true`) means no window at all — that is the "All time"
 * escape hatch the UI exposes. Otherwise an explicit dateFrom/dateTo is honoured (either bound may
 * be given alone). With neither, the current month is used.
 *
 * Callers get `{ start, end, isDefault }` — `isDefault` lets a route tell the client that it
 * narrowed the window on its own, so the UI can show the "This Month" chip honestly rather than
 * implying the user chose it.
 *
 * @param {URLSearchParams} searchParams
 * @param {{fromKey?: string, toKey?: string}} [keys] param names, for routes using from/to
 * @returns {{start: Date|null, end: Date|null, isDefault: boolean, isAll: boolean}}
 */
export const resolveDateRange = (searchParams, { fromKey = "dateFrom", toKey = "dateTo" } = {}) => {
  const allParam = searchParams.get("all");
  if (allParam === "1" || allParam === "true") {
    return { start: null, end: null, isDefault: false, isAll: true };
  }

  const rawFrom = searchParams.get(fromKey);
  const rawTo = searchParams.get(toKey);

  if (rawFrom || rawTo) {
    return {
      start: rawFrom ? getISTStartOfDay(rawFrom) : null,
      end: rawTo ? getISTEndOfDay(rawTo) : null,
      isDefault: false,
      isAll: false,
    };
  }

  const { start, end } = getCurrentMonthRange();
  return { start, end, isDefault: true, isAll: false };
};

/**
 * Build a Mongo range predicate from resolveDateRange's output, or `null` when unbounded.
 * @param {{start: Date|null, end: Date|null}} range
 * @returns {{$gte?: Date, $lte?: Date}|null}
 */
export const toDateQuery = ({ start, end }) => {
  if (!start && !end) return null;
  const q = {};
  if (start) q.$gte = start;
  if (end) q.$lte = end;
  return q;
};

/**
 * Format date for display in IST timezone
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in IST
 */
export const formatISTDate = (date, options = {}) => {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...options
  });
};

/**
 * Get current IST time as a formatted string
 * @returns {string} Current time in IST
 */
export const getCurrentISTTime = () => {
  return formatISTDate(new Date(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

/**
 * Check if a date is today in IST timezone
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if the date is today in IST
 */
export const isToday = (date) => {
  const d = getISTDate(date);
  const today = getISTDate();
  
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
};

/**
 * Get date range based on filter type
 * @param {string} filterType - Type of filter (Today, Yesterday, Last 7 Days, etc.)
 * @param {Object} customDates - Custom date range with from and to
 * @returns {Object} Object with start and end dates
 */
export const getDateRangeFromFilter = (filterType = "Today", customDates = {}) => {
  switch (filterType) {
    case "Today":
      return {
        start: getISTStartOfDay(),
        end: getISTEndOfDay()
      };
    
    case "Yesterday":
      return getYesterdayRange();
    
    case "Last 7 Days":
      return getLastWeekRange();
    
    case "Last 30 Days":
      return getLastMonthRange();

    // Calendar month-to-date — the default window for admin lists. Distinct from "Last 30 Days",
    // which is a rolling window and doesn't line up with accounting periods.
    case "This Month":
      return getCurrentMonthRange();

    case "Custom":
      return {
        start: customDates.from ? getISTStartOfDay(customDates.from) : getISTStartOfDay(),
        end: customDates.to ? getISTEndOfDay(customDates.to) : getISTEndOfDay()
      };
    
    default:
      return {
        start: getISTStartOfDay(),
        end: getISTEndOfDay()
      };
  }
};

/**
 * Debug helper to log date information
 * @param {string} label - Label for the log
 * @param {Date} date - Date to log
 */
export const logDateInfo = (label, date) => {
  console.log(`${label}:`, {
    utc: date.toISOString(),
    ist: formatISTDate(date),
    timestamp: date.getTime()
  });
};