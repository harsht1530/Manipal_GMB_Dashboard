const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vasudeva:ommN1EMg2KsURyPQ@cluster0.n3ejr.mongodb.net/HarshDB';

const corporateMembers = [
  {
    name: "Aman",
    email: "mohd.aman@manipalhospitals.com",
    role: "Admin",
    accessScope: "Global",
    cluster: "All",
    branch: "All",
    isActive: true
  },
  {
    name: "Harsh Mishra",
    email: "harsh@multipliersolutions.com",
    role: "Admin",
    accessScope: "Global",
    cluster: "All",
    branch: "All",
    isActive: true
  },
  {
    name: "Rupesh Mishra",
    email: "rupesh.mishra@manipalhospitals.com",
    role: "Admin",
    accessScope: "Global",
    cluster: "All",
    branch: "All",
    isActive: true
  },
  {
    name: "Rumela Bhattacharya",
    email: "rumela.bhattacharya@manipalhospitals.com",
    role: "Admin",
    accessScope: "Global",
    cluster: "All",
    branch: "All",
    isActive: true
  },
  {
    name: "Mayank Agarwal",
    email: "mayank.agarwal@multipliersolutions.com",
    role: "Admin",
    accessScope: "Global",
    cluster: "All",
    branch: "All",
    isActive: true
  },
  {
    name: "Dr. Bhavana B.",
    email: "bhavana.b@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "South",
    branch: "All",
    isActive: true
  },
  {
    name: "Abhishek Mishra",
    email: "abhishek.mishra@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "North",
    branch: "All",
    isActive: true
  },
  {
    name: "Dr. Arun Chakravarty",
    email: "arun.chakravarty@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "East",
    branch: "All",
    isActive: true
  },
  {
    name: "Bejoy Changarath",
    email: "bejoy.changarath@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "South",
    branch: "All",
    isActive: true
  },
  {
    name: "Ravi Shankar Danaboina",
    email: "ravi.danaboina@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "South-East",
    branch: "All",
    isActive: true
  },
  {
    name: "Rakesh Dharshan",
    email: "rakesh.dharshan@manipalhospitals.com",
    role: "Cluster",
    accessScope: "Cluster",
    cluster: "West",
    branch: "All",
    isActive: true
  }
];

async function seedCorporate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.db.collection('manipalcorporate');
    
    for (const member of corporateMembers) {
      await collection.updateOne(
        { email: member.email.toLowerCase() },
        { $set: member },
        { upsert: true }
      );
      console.log(`Seeded/Updated corporate member: ${member.name} (${member.email})`);
    }

    const allDocs = await collection.find({}).toArray();
    console.log('\n--- Current manipalcorporate collection contents ---');
    console.dir(allDocs, { depth: null });

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Error seeding corporate team:', err);
    process.exit(1);
  }
}

seedCorporate();
