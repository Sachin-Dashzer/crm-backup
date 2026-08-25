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