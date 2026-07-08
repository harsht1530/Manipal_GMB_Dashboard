const data = [
  { month: 'Jun', date: '2025-01-05T18:30:00.000Z' },
  { month: 'Feb', date: '2025-01-01T18:30:00.000Z' },
  { month: 'May', date: '2025-01-04T18:30:00.000Z' }
];
const parseDateString = (dateStr) => {
  if (!dateStr) return new Date('');
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }
  return new Date(dateStr);
};
const selectedMonths = [];
const getLatestMonth = (dataset) => {
    if (selectedMonths.length === 0 || selectedMonths.includes('All')) {
      if (dataset.length > 0) {
        const hasValidDates = dataset.some(d => d.date);
        if (hasValidDates) {
          const sortedData = [...dataset].sort((a, b) => {
            const timeA = a.date ? parseDateString(a.date).getTime() : 0;
            const timeB = b.date ? parseDateString(b.date).getTime() : 0;
            if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
            return 0;
          });
          return sortedData[0].month;
        }
      }
    }
    return 'Jan';
};
console.log("Latest Month: ", getLatestMonth(data));
