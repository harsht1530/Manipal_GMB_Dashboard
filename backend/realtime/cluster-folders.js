/**
 * Cluster to folder assignment, exactly as given in "unit wise team allocation.xlsx".
 *
 * The sheet decides which cluster a folder belongs to - not the `cluster` field on each
 * listing - because the realtime filters treat cluster as the parent of folder: choosing a
 * cluster selects that cluster's folders. A folder the sheet lists under two clusters (
 * MH - Ghaziabad, MH - Rangapani, MH - Vijaywada) is offered under both, and a folder the
 * sheet does not mention counts as "Others", so the clusters together still cover every
 * listing.
 *
 * 54 folders across 7 clusters. Generated from the workbook; edit the sheet and regenerate
 * rather than editing the list by hand.
 */

const OTHERS = 'Others';

const FOLDERS_BY_CLUSTER = {
  "East": [
    "MH - Broadway",
    "MH - Dhakuria",
    "MH - EM Bypass",
    "MH - Mukhundapur",
    "MH - Rangapani",
    "MH - Salt Lake",
    "MH - Siliguri",
  ],
  "International": [
    "MH - International",
  ],
  "North": [
    "MH - Dwarka",
    "MH - Ghaziabad",
    "MH - Jaipur",
    "MH - Patiala",
    "MH - Ranchi",
    "NCR-Gurugram",
  ],
  "Others": [
    "East Cluster - Hospitals",
    "Hospitals",
    "MH - Department",
    "MH - MARS",
    "MH - OOO East",
    "MH - OOO North",
    "MH - OOO South",
    "South Cluster - Hospitals",
    "South East Cluster - Hospitals",
  ],
  "South": [
    "MH - Begur",
    "MH - Doddaballapur",
    "MH - Electronic City",
    "MH - Ghaziabad",
    "MH - Hebbal",
    "MH - Indiranagar Clinic",
    "MH - Jayanagar",
    "MH - Kankapura Clinic",
    "MH - Malleshwaram",
    "MH - Millers Road",
    "MH - Mysore",
    "MH - Old Airport",
    "MH - Rangapani",
    "MH - Salem",
    "MH - Sarjapur",
    "MH - Varthur",
    "MH - Vijaywada",
    "MH - Whitefield",
    "MH - Yashwanthpur",
    "MH - Yelahanka",
    "MH- Mangalore(KMC)",
  ],
  "South-East": [
    "MH - Vijaywada",
    "MHBBS - MH- Bhubaneswar",
  ],
  "West": [
    "MH - AHL",
    "MH - Baner",
    "MH - Bibwewadi",
    "MH - Goa",
    "MH - Hadapsar",
    "MH - Karad",
    "MH - Kothrud",
    "MH - Nagar Road",
    "MH - Nashik",
    "MH - Pune",
    "MH- Deccan",
  ],
};

/** Every cluster the sheet names, for the filter list. */
const CLUSTERS = Object.keys(FOLDERS_BY_CLUSTER).sort();

/** Every folder the sheet names, used to spot the ones it does not. */
const SHEET_FOLDERS = [...new Set(Object.values(FOLDERS_BY_CLUSTER).flat())].sort();

const CLUSTERS_BY_FOLDER = new Map();
for (const [cluster, folders] of Object.entries(FOLDERS_BY_CLUSTER)) {
  for (const folder of folders) {
    if (!CLUSTERS_BY_FOLDER.has(folder)) CLUSTERS_BY_FOLDER.set(folder, []);
    CLUSTERS_BY_FOLDER.get(folder).push(cluster);
  }
}
for (const list of CLUSTERS_BY_FOLDER.values()) list.sort();

/** The clusters a folder sits under; anything the sheet leaves out belongs to Others. */
const clustersOf = (folder) => CLUSTERS_BY_FOLDER.get(folder) || [OTHERS];

/** The sheet's folders for these clusters. */
const foldersOf = (clusters) => [
  ...new Set((clusters || []).flatMap((cluster) => FOLDERS_BY_CLUSTER[cluster] || [])),
];

/**
 * A Mongo condition selecting the listings of these clusters by folder membership. Picking
 * Others also takes in listings whose folders the sheet never mentions (and listings with no
 * folder at all), so no listing is unreachable.
 */
const clusterFilter = (clusters) => {
  const folders = foldersOf(clusters);
  if (!(clusters || []).includes(OTHERS)) return { folders: { $in: folders } };
  // Wrapped in $and so it cannot be overwritten by a tile filter that uses its own $or.
  return { $and: [{ $or: [{ folders: { $in: folders } }, { folders: { $nin: SHEET_FOLDERS } }] }] };
};

module.exports = { OTHERS, CLUSTERS, SHEET_FOLDERS, FOLDERS_BY_CLUSTER, clustersOf, foldersOf, clusterFilter };
