const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://vasudeva:ommN1EMg2KsURyPQ@cluster0.n3ejr.mongodb.net/HarshDB').then(async () => {
    const db = mongoose.connection.db;
    const stats = await db.collection('manipalinsightsdatas').aggregate([
        { $group: { _id: '$Date', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
    ]).toArray();
    console.log(JSON.stringify(stats, null, 2));
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
