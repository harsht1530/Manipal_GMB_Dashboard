const http = require('http');

http.get('http://localhost:5000/api/locations', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    const data = json.data.map(doc => ({
      month: doc['Month'] || '',
      date: doc['Date'] || ''
    }));

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

    const getLatestDataScope = (dataset) => {
      if (dataset.length === 0) return { month: 'Jan', date: null };
      const selectedMonths = [];
      let targetData = dataset;

      const sortedData = [...targetData].sort((a, b) => {
        const timeA = a.date ? parseDateString(a.date).getTime() : 0;
        const timeB = b.date ? parseDateString(b.date).getTime() : 0;
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
        
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
      });

      return { 
        month: sortedData[0].month || 'Jan', 
        date: sortedData[0].date 
      };
    };

    const scope = getLatestDataScope(data);
    console.log("Calculated Latest Scope:", scope);
  });
}).on('error', console.error);
