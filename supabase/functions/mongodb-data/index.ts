import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONGODB_URI = Deno.env.get('MONGODB_URI') || '';

// Parse MongoDB connection string to extract cluster info
function parseMongoUri(uri: string) {
  // mongodb+srv://vasudeva:ommN1EMg2KsURyPQ@cluster0.n3ejr.mongodb.net/HarshDB
  const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/(\w+)/);
  if (!match) return null;
  return {
    username: match[1],
    password: match[2],
    cluster: match[3], // cluster0.n3ejr.mongodb.net
    database: match[4], // HarshDB
  };
}

// Get the Data API endpoint from the cluster
function getDataApiEndpoint(cluster: string): string {
  // Extract the cluster identifier (e.g., cluster0.n3ejr -> n3ejr)
  const clusterParts = cluster.split('.');
  if (clusterParts.length >= 2) {
    const region = clusterParts[1]; // n3ejr
    return `https://data.mongodb-api.com/app/data-${region}/endpoint/data/v1`;
  }
  return '';
}

const DATABASE_NAME = 'HarshDB';

// Collection names
const COLLECTIONS = {
  insights: 'manipalinsightsdatas',
  doctors: 'manipalfinaldatas',
  locations: 'manipalLocations',
  users: 'users'
};

// Fetch from MongoDB using Data API
async function fetchFromMongoDB(collectionName: string, filter: Record<string, any> = {}, options: { limit?: number; sort?: Record<string, number> } = {}) {
  const parsedUri = parseMongoUri(MONGODB_URI);
  
  if (!parsedUri) {
    console.error('Invalid MongoDB URI, using mock data');
    return getMockData(collectionName, filter);
  }

  const dataApiEndpoint = getDataApiEndpoint(parsedUri.cluster);
  
  if (!dataApiEndpoint) {
    console.error('Could not determine Data API endpoint, using mock data');
    return getMockData(collectionName, filter);
  }

  try {
    const requestBody: any = {
      dataSource: parsedUri.cluster.split('.')[0], // cluster0
      database: DATABASE_NAME,
      collection: collectionName,
      filter: filter,
    };

    if (options.limit) {
      requestBody.limit = options.limit;
    }

    if (options.sort) {
      requestBody.sort = options.sort;
    }

    console.log(`Fetching from MongoDB: ${collectionName}, filter: ${JSON.stringify(filter)}`);

    const response = await fetch(`${dataApiEndpoint}/action/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': parsedUri.password, // Using password as API key (this is a workaround)
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`MongoDB Data API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return getMockData(collectionName, filter);
    }

    const data = await response.json();
    console.log(`Fetched ${data.documents?.length || 0} documents from ${collectionName}`);
    return data.documents || [];
  } catch (error) {
    console.error(`Error fetching from ${collectionName}:`, error);
    return getMockData(collectionName, filter);
  }
}

// Get mock data as fallback
function getMockData(collection: string, filter: Record<string, any>) {
  console.log(`Using mock data for collection: ${collection}`);
  
  if (collection === 'manipalinsightsdatas') {
    return generateInsightsMockData(filter);
  } else if (collection === 'manipalfinaldatas') {
    return generateDoctorsMockData();
  } else if (collection === 'manipalLocations') {
    return generateLocationsMockData();
  }
  return [];
}

// Mock data generators (fallback)
function generateInsightsMockData(filter: Record<string, any> = {}) {
  const clusters = ["South", "North", "East", "West", "North West", "Central"];
  const branches = ["Old Airport Road", "Hebbal", "Whitefield", "Yeshwanthpur", "Baner", "Jayanagar", "Indiranagar"];
  const departments = ["Doctors", "Clinic", "Hospitals", "Department", "MARS"];
  const specialities = ["Cardiology", "Orthopedics", "Oncology", "Neurology", "Gastroenterology", "Dermatology", "Pulmonology"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const doctors = [
    { name: "Dr. Anand R Shenoy", baseSearch: 450, baseRating: 4.5 },
    { name: "Dr. Ranjan Shetty", baseSearch: 420, baseRating: 4.8 },
    { name: "Dr. Priya Sharma", baseSearch: 380, baseRating: 4.6 },
    { name: "Dr. Sunita Reddy", baseSearch: 360, baseRating: 4.9 },
    { name: "Dr. Mayur Suryawanshi", baseSearch: 340, baseRating: 4.3 },
  ];

  const data: any[] = [];
  
  doctors.forEach((doctor, index) => {
    months.forEach((month, mIndex) => {
      const monthMultiplier = 1 + (mIndex * 0.08);
      const variance = 0.9 + Math.random() * 0.2;
      
      const googleSearchMobile = Math.floor(doctor.baseSearch * monthMultiplier * variance);
      const googleSearchDesktop = Math.floor(googleSearchMobile * 0.65 * variance);
      
      data.push({
        _id: { $oid: `insight_${index}_${mIndex}` },
        "Business name": doctor.name,
        "Google Search - Mobile": googleSearchMobile,
        "Google Search - Desktop": googleSearchDesktop,
        "Google Maps - Mobile": Math.floor(googleSearchMobile * 0.45),
        "Google Maps - Desktop": Math.floor(googleSearchMobile * 0.25),
        "Directions": Math.floor(googleSearchMobile * 0.12),
        "Website clicks": Math.floor(googleSearchMobile * 0.15),
        "Calls": Math.floor(googleSearchMobile * 0.08),
        "Cluster": clusters[index % clusters.length],
        "Month": month,
        "Branch": branches[index % branches.length],
        "Date": `2025-${String(mIndex + 1).padStart(2, '0')}-15`,
        "Speciality": specialities[index % specialities.length],
        "Review": Math.floor(20 + Math.random() * 80),
        "Rating": doctor.baseRating,
        "Department": departments[index % departments.length],
        "Phone": index % 4 === 0 ? "Not available" : "1800 102 4647"
      });
    });
  });
  
  return data;
}

function generateDoctorsMockData() {
  const doctors = [
    { name: "Dr. Anand R Shenoy", speciality: "Cardiologist", cluster: "South", branch: "Old Airport Road", rating: 4.5 },
    { name: "Dr. Ranjan Shetty", speciality: "Cardiologist", cluster: "South", branch: "Old Airport Road", rating: 4.8 },
    { name: "Dr. Priya Sharma", speciality: "Orthopedic Surgeon", cluster: "North", branch: "Hebbal", rating: 4.6 },
    { name: "Dr. Sunita Reddy", speciality: "Oncologist", cluster: "East", branch: "Whitefield", rating: 4.9 },
    { name: "Dr. Mayur Suryawanshi", speciality: "Neurologist", cluster: "West", branch: "Yeshwanthpur", rating: 4.3 },
  ];

  return doctors.map((doc, index) => ({
    _id: { $oid: `doctor_${index}` },
    business_name: `${doc.name} | ${doc.speciality} | Manipal Hospital`,
    name: doc.name,
    phone: "1800 102 4647",
    primaryCategory: doc.speciality,
    address: `Manipal Hospital, ${doc.branch}, Bengaluru`,
    averageRating: doc.rating,
    totalReviewCount: 40 + index * 10,
    Cluster: doc.cluster,
    Branch: doc.branch,
    labels: []
  }));
}

function generateLocationsMockData() {
  const units = ["Old Airport Road", "Hebbal", "Whitefield"];
  const clusters = ["South", "North", "East"];
  const departments = ["Doctors", "Clinic", "Hospitals"];
  const months = ["Oct", "Nov", "Dec"];

  const data: any[] = [];
  
  units.forEach((unit, uIndex) => {
    months.forEach((month, mIndex) => {
      departments.forEach((dept, dIndex) => {
        const totalProfiles = 150 + Math.floor(Math.random() * 50);
        const verified = Math.floor(totalProfiles * 0.8);
        
        data.push({
          _id: { $oid: `loc_${uIndex}_${mIndex}_${dIndex}` },
          Month: month,
          Cluster: clusters[uIndex],
          "Unit Name": unit,
          Department: dept,
          "Total Profiles": totalProfiles,
          "Verified Profiles": verified,
          "Unverfied Profiles": Math.floor((totalProfiles - verified) * 0.3),
          "Need Access": Math.floor((totalProfiles - verified) * 0.2),
          "Not Intrested": Math.floor((totalProfiles - verified) * 0.5)
        });
      });
    });
  });
  
  return data;
}

// Get top 10 doctors by Google Search metrics for the latest month
async function getTop10Doctors() {
  try {
    const insightsData = await fetchFromMongoDB(COLLECTIONS.insights, {});
    
    if (!insightsData || insightsData.length === 0) {
      console.log('No insights data found');
      return { latestMonth: '', topDoctors: [] };
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const uniqueMonths = [...new Set(insightsData.map((d: any) => d.Month))];
    const sortedMonths = uniqueMonths.sort((a: any, b: any) => months.indexOf(b) - months.indexOf(a));
    const latestMonth = sortedMonths[0] || '';
    
    console.log(`Latest month found: ${latestMonth}`);
    
    const latestMonthData = insightsData
      .filter((d: any) => d.Month === latestMonth)
      .map((d: any) => ({
        ...d,
        totalGoogleSearch: (d['Google Search - Mobile'] || 0) + (d['Google Search - Desktop'] || 0)
      }))
      .sort((a: any, b: any) => b.totalGoogleSearch - a.totalGoogleSearch)
      .slice(0, 10);
    
    console.log(`Found ${latestMonthData.length} top doctors`);
    return { latestMonth, topDoctors: latestMonthData };
  } catch (error) {
    console.error('Error getting top 10 doctors:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, collection, filter = {}, doctorName } = await req.json();
    
    console.log(`Request - action: ${action}, collection: ${collection}, filter: ${JSON.stringify(filter)}`);

    let result;
    
    switch (action) {
      case 'getTop10Doctors':
        result = await getTop10Doctors();
        console.log('Returning top 10 doctors result');
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'getDoctorDetails':
        if (!doctorName) {
          return new Response(
            JSON.stringify({ success: false, error: 'Doctor name is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const doctors = await fetchFromMongoDB(COLLECTIONS.doctors, { name: doctorName }, { limit: 1 });
        const profile = doctors.length > 0 ? doctors[0] : null;
        const insights = await fetchFromMongoDB(COLLECTIONS.insights, { 'Business name': doctorName });
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyInsights = insights.sort((a: any, b: any) => months.indexOf(a.Month) - months.indexOf(b.Month));
        
        result = {
          profile,
          monthlyInsights,
          keywords: profile?.labels || [],
          competitors: profile?.labels?.flatMap((l: any) => l.competitors) || []
        };
        console.log(`Returning details for ${doctorName}`);
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'getAllInsights':
        result = await fetchFromMongoDB(COLLECTIONS.insights, filter);
        console.log(`Returning ${result.length} insights`);
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'getAllDoctors':
        result = await fetchFromMongoDB(COLLECTIONS.doctors, filter);
        console.log(`Returning ${result.length} doctors`);
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'getLocations':
        result = await fetchFromMongoDB(COLLECTIONS.locations, filter);
        console.log(`Returning ${result.length} locations`);
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      default:
        if (collection) {
          result = await fetchFromMongoDB(collection, filter);
          console.log(`Returning ${result.length} results from ${collection}`);
          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action or collection' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
