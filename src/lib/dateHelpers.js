
export const getISTDate = (date = null) => {
  const d = date ? new Date(date) : new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(d.getTime() + istOffset);
};

export const getISTStartOfDay = (date = null) => {
  const istDate = date ? new Date(date) : getISTDate();
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();

  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(startOfDay.getTime() - istOffset);
};

export const getISTEndOfDay = (date = null) => {
  const istDate = date ? new Date(date) : getISTDate();
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();

  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(endOfDay.getTime() - istOffset);
};

export const getYesterdayRange = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    start: getISTStartOfDay(yesterday),
    end: getISTEndOfDay(yesterday)
  };
};

export const getLastWeekRange = () => {
  const today = getISTEndOfDay();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 6);

  return {
    start: getISTStartOfDay(lastWeek),
    end: today
  };
};

export const getLastMonthRange = () => {
  const today = getISTEndOfDay();
  const lastMonth = new Date(today);
  lastMonth.setDate(today.getDate() - 29);

  return {
    start: getISTStartOfDay(lastMonth),
    end: today
  };
};

export const getCurrentMonthRange = () => {
  const istNow = getISTDate();
  const firstOfMonth = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), 1));

  return {
    start: getISTStartOfDay(firstOfMonth),
    end: getISTEndOfDay(),
  };
};

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

export const toDateQuery = ({ start, end }) => {
  if (!start && !end) return null;
  const q = {};
  if (start) q.$gte = start;
  if (end) q.$lte = end;
  return q;
};

export const formatISTDate = (date, options = {}) => {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...options
  });
};

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

export const isToday = (date) => {
  const d = getISTDate(date);
  const today = getISTDate();

  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
};

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

export const logDateInfo = (label, date) => {
  console.log(`${label}:`, {
    utc: date.toISOString(),
    ist: formatISTDate(date),
    timestamp: date.getTime()
  });
};