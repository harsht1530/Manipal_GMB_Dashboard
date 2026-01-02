// Dummy data based on the MongoDB collections structure

export interface InsightData {
  id: string;
  businessName: string;
  googleSearchMobile: number;
  googleSearchDesktop: number;
  googleMapsMobile: number;
  googleMapsDesktop: number;
  directions: number;
  websiteClicks: number;
  calls: number;
  cluster: string;
  month: string;
  branch: string;
  date: string;
  speciality: string;
  review: number;
  rating: number;
  department: string;
  phone: string;
}

export interface LabelData {
  rank: number;
  label: string;
  competitors: string[];
  screenShot: string;
}

export interface DoctorData {
  id: string;
  businessName: string;
  name: string;
  phone: string;
  placeId: string;
  newReviewUri: string;
  mapsUri: string;
  websiteUrl: string;
  labels: LabelData[];
  primaryCategory: string;
  address: string;
  averageRating: number;
  totalReviewCount: number;
  mailId: string;
  cluster: string;
  branch: string;
}

export interface LocationData {
  id: string;
  month: string;
  cluster: string;
  unitName: string;
  department: string;
  totalProfiles: number;
  verifiedProfiles: number;
  unverifiedProfiles: number;
  needAccess: number;
  notInterested: number;
  outOfOrganization: number;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const clusters = ["South", "North", "East", "West", "North West", "Central"];
const branches = ["Old Airport Road", "Hebbal", "Whitefield", "Yeshwanthpur", "Baner", "Jayanagar", "Indiranagar"];
const departments = ["Doctors", "Clinic", "Hospitals", "Department", "MARS"];
const specialities = ["Cardiology", "Orthopedics", "Oncology", "Neurology", "Gastroenterology", "Dermatology", "Pulmonology", "Skull Based Surgery"];

const doctorNames = [
  "Dr. Mayur Suryawanshi", "Dr. Anand R Shenoy", "Dr. Ranjan Shetty", "Dr. Darshan B S", 
  "Dr. Priya Sharma", "Dr. Arun Kumar", "Dr. Sunita Reddy", "Dr. Vijay Patil",
  "Dr. Meena Iyer", "Dr. Rajesh Menon", "Dr. Kavitha Nair", "Dr. Suresh Babu",
  "Dr. Lakshmi Prasad", "Dr. Ramesh Kumar", "Dr. Deepa Menon", "Dr. Prakash Rao"
];

// Generate insights data with monthly progression
export const insightsData: InsightData[] = (() => {
  const data: InsightData[] = [];
  
  doctorNames.forEach((doctor, dIndex) => {
    months.forEach((month, mIndex) => {
      const baseMultiplier = 1 + (mIndex * 0.1); // Growth over months
      data.push({
        id: `${dIndex}-${mIndex}`,
        businessName: doctor,
        googleSearchMobile: Math.floor((50 + Math.random() * 200) * baseMultiplier),
        googleSearchDesktop: Math.floor((30 + Math.random() * 150) * baseMultiplier),
        googleMapsMobile: Math.floor((20 + Math.random() * 100) * baseMultiplier),
        googleMapsDesktop: Math.floor((10 + Math.random() * 80) * baseMultiplier),
        directions: Math.floor((5 + Math.random() * 80) * baseMultiplier),
        websiteClicks: Math.floor((5 + Math.random() * 60) * baseMultiplier),
        calls: Math.floor((2 + Math.random() * 50) * baseMultiplier),
        cluster: clusters[dIndex % clusters.length],
        month: month,
        branch: branches[dIndex % branches.length],
        date: `2025-${String(mIndex + 1).padStart(2, '0')}-05`,
        speciality: specialities[dIndex % specialities.length],
        review: Math.floor(Math.random() * 100),
        rating: Math.round((3 + Math.random() * 2) * 10) / 10,
        department: departments[dIndex % departments.length],
        phone: dIndex % 3 === 0 ? "Not available" : "1800 102 4647"
      });
    });
  });
  
  return data;
})();

export const doctorsData: DoctorData[] = [
  {
    id: "1",
    businessName: "Dr. Anand R Shenoy | Best Cardiologist in Old Airport Road | Manipal Hospital Old Airport Road",
    name: "Dr. Anand R Shenoy",
    phone: "1800 102 4647",
    placeId: "ChIJzeI7W0UVrjsRG3dDrzBPIq4",
    newReviewUri: "https://search.google.com/local/writereview?placeid=ChIJzeI7W0UVrjsRG3dDrzBPIq4",
    mapsUri: "https://maps.google.com/maps?cid=12547678582325081883",
    websiteUrl: "https://www.manipalhospitals.com/oldairportroad/doctors/dr-anand-r-shenoy-consultant-interventional-cardiology/",
    labels: [
      { rank: 1, label: "Best cardiologist in Old Airport Road", competitors: ["Dr. Darshan B S", "Dr. Devananda N S", "Dr. Sridhara G", "Dr. D S Chadha", "Dr. Murali Krishna"], screenShot: "DrAnandRShenoy0" },
      { rank: 3, label: "Best cardiologist in Bengaluru", competitors: ["Dr. Rajpal Singh", "Dr. Rahul Patil", "Dr. Ashwin M Daware", "Dr. Vinod Revankar", "Dr. Umesh Gupta"], screenShot: "DrAnandRShenoy1" },
      { rank: 0, label: "Cardiologist near me", competitors: ["Dr. Mukharjee", "Pulse Heart Center", "Dr. RK Cardiology Clinic", "Dr. Ramakrishna Janapati", "Dr. Prashant Patil"], screenShot: "DrAnandRShenoy2" },
      { rank: 1, label: "Cardiologist in Old Airport Road", competitors: ["Dr. Anand R Shenoy", "Dr. Ranjan Shetty", "Dr. Darshan B S", "Dr. Chakrapani B S", "Dr. Devananda N S"], screenShot: "DrAnandRShenoy8" }
    ],
    primaryCategory: "Cardiologist",
    address: "#98/ 1st Floor, Manipal Hospital HAL Old Airport Road, Kodihalli",
    averageRating: 4.5,
    totalReviewCount: 43,
    mailId: "manipaloldairport@gmail.com",
    cluster: "South",
    branch: "Old Airport Road"
  },
  {
    id: "2",
    businessName: "Dr. Ranjan Shetty | Top Cardiologist | Manipal Hospital",
    name: "Dr. Ranjan Shetty",
    phone: "1800 102 4647",
    placeId: "ChIJ123456789",
    newReviewUri: "https://search.google.com/local/writereview?placeid=ChIJ123456789",
    mapsUri: "https://maps.google.com/maps?cid=123456789",
    websiteUrl: "https://www.manipalhospitals.com/doctors/dr-ranjan-shetty/",
    labels: [
      { rank: 1, label: "Heart specialist Bangalore", competitors: ["Dr. Anand Shenoy", "Dr. Darshan B S", "Dr. Vinod Revankar", "Dr. C M Nagesh", "Dr. Rahul Patil"], screenShot: "DrRanjanShetty0" },
      { rank: 2, label: "Best heart doctor Bangalore", competitors: ["Dr. Rajpal Singh", "Dr. Ranjan Shetty", "Dr. Ashwin M Daware", "Dr. K S Kishore", "Dr. Yunus Saleem"], screenShot: "DrRanjanShetty1" }
    ],
    primaryCategory: "Cardiologist",
    address: "Manipal Hospital, Old Airport Road, Bengaluru",
    averageRating: 4.8,
    totalReviewCount: 87,
    mailId: "manipaloldairport@gmail.com",
    cluster: "South",
    branch: "Old Airport Road"
  },
  {
    id: "3",
    businessName: "Dr. Priya Sharma | Orthopedic Surgeon | Manipal Hospital Hebbal",
    name: "Dr. Priya Sharma",
    phone: "1800 102 4647",
    placeId: "ChIJ987654321",
    newReviewUri: "https://search.google.com/local/writereview?placeid=ChIJ987654321",
    mapsUri: "https://maps.google.com/maps?cid=987654321",
    websiteUrl: "https://www.manipalhospitals.com/doctors/dr-priya-sharma/",
    labels: [
      { rank: 2, label: "Best orthopedic surgeon Hebbal", competitors: ["Dr. Arun Kumar", "Dr. Priya Sharma", "Dr. Vikram Singh", "Dr. Ravi Menon", "Dr. Suresh Babu"], screenShot: "DrPriyaSharma0" },
      { rank: 4, label: "Knee replacement specialist Bangalore", competitors: ["Dr. Vikram Singh", "Dr. Ravi Menon", "Dr. Suresh Babu", "Dr. Priya Sharma", "Dr. Arun Kumar"], screenShot: "DrPriyaSharma1" }
    ],
    primaryCategory: "Orthopedic Surgeon",
    address: "Manipal Hospital, Hebbal, Bengaluru",
    averageRating: 4.6,
    totalReviewCount: 56,
    mailId: "manipalhebbal@gmail.com",
    cluster: "North",
    branch: "Hebbal"
  },
  {
    id: "4",
    businessName: "Dr. Sunita Reddy | Oncologist | Manipal Hospital Whitefield",
    name: "Dr. Sunita Reddy",
    phone: "1800 102 4647",
    placeId: "ChIJ456789123",
    newReviewUri: "https://search.google.com/local/writereview?placeid=ChIJ456789123",
    mapsUri: "https://maps.google.com/maps?cid=456789123",
    websiteUrl: "https://www.manipalhospitals.com/doctors/dr-sunita-reddy/",
    labels: [
      { rank: 1, label: "Best oncologist Whitefield", competitors: ["Dr. Sunita Reddy", "Dr. Ramesh Kumar", "Dr. Anjali Sharma", "Dr. Prakash Rao", "Dr. Deepa Menon"], screenShot: "DrSunitaReddy0" },
      { rank: 2, label: "Cancer specialist Bangalore East", competitors: ["Dr. Ramesh Kumar", "Dr. Sunita Reddy", "Dr. Anjali Sharma", "Dr. Prakash Rao", "Dr. Deepa Menon"], screenShot: "DrSunitaReddy1" }
    ],
    primaryCategory: "Oncologist",
    address: "Manipal Hospital, Whitefield, Bengaluru",
    averageRating: 4.9,
    totalReviewCount: 78,
    mailId: "manipalwhitefield@gmail.com",
    cluster: "East",
    branch: "Whitefield"
  }
];

// Generate locations data
export const locationsData: LocationData[] = (() => {
  const data: LocationData[] = [];
  const units = ["Old Airport Road", "Hebbal", "Whitefield", "Yeshwanthpur", "Baner", "Jayanagar", "Indiranagar"];
  
  units.forEach((unit, uIndex) => {
    months.slice(0, 3).forEach((month) => {
      departments.forEach((dept, dIndex) => {
        const totalProfiles = Math.floor(Math.random() * 300) + 100;
        const verified = Math.floor(totalProfiles * 0.8);
        const unverified = Math.floor(totalProfiles * 0.05);
        const needAccess = Math.floor(totalProfiles * 0.02);
        const notInterested = totalProfiles - verified - unverified - needAccess;
        
        data.push({
          id: `loc-${uIndex}-${month}-${dIndex}`,
          month,
          cluster: clusters[uIndex % clusters.length],
          unitName: unit,
          department: dept,
          totalProfiles,
          verifiedProfiles: verified,
          unverifiedProfiles: unverified,
          needAccess,
          notInterested,
          outOfOrganization: 0
        });
      });
    });
  });
  
  return data;
})();

export const clusterOptions = ["All", ...clusters];
export const branchOptions = ["All", ...branches];
export const monthOptions = ["All", ...months];
export const specialityOptions = ["All", ...specialities];
export const departmentOptions = departments;
export const ratingOptions = [5, 4, 3, 2, 1];

export const getAggregatedMetrics = (data: InsightData[]) => {
  return {
    totalSearchImpressions: data.reduce((acc, item) => acc + item.googleSearchMobile + item.googleSearchDesktop, 0),
    totalMapsViews: data.reduce((acc, item) => acc + item.googleMapsMobile + item.googleMapsDesktop, 0),
    totalDirections: data.reduce((acc, item) => acc + item.directions, 0),
    totalWebsiteClicks: data.reduce((acc, item) => acc + item.websiteClicks, 0),
    totalCalls: data.reduce((acc, item) => acc + item.calls, 0),
    averageRating: data.reduce((acc, item) => acc + item.rating, 0) / data.filter(d => d.rating > 0).length || 0,
    googleSearchMobile: data.reduce((acc, item) => acc + item.googleSearchMobile, 0),
    googleSearchDesktop: data.reduce((acc, item) => acc + item.googleSearchDesktop, 0),
    googleMapsMobile: data.reduce((acc, item) => acc + item.googleMapsMobile, 0),
    googleMapsDesktop: data.reduce((acc, item) => acc + item.googleMapsDesktop, 0),
  };
};
