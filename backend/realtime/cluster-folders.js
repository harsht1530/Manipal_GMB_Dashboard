/**
 * Cluster to folder assignment, exactly as given in "unit wise team allocation.xlsx".
 *
 * This sheet is the one source of cluster in the realtime section. The filters use it to
 * decide which folders a cluster holds, and every table, export and the optimization page
 * use it to label a listing's cluster from its primary folder - not the `cluster` value
 * looked up from older insight data, which disagreed with the sheet for hundreds of listings.
 *
 * Every folder sits under exactly one cluster. Four folders the sheet leaves out are placed
 * by hand in NOT_IN_SHEET below; any other folder it does not mention counts as "Others", so
 * the clusters together still cover every listing.
 *
 * 54 folders across 6 clusters. Generated from the workbook; edit the sheet and regenerate
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
    "MH - International",
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
    "MH - Hebbal",
    "MH - Indiranagar Clinic",
    "MH - Jayanagar",
    "MH - Kankapura Clinic",
    "MH - Malleshwaram",
    "MH - Millers Road",
    "MH - Mysore",
    "MH - Old Airport",
    "MH - Salem",
    "MH - Sarjapur",
    "MH - Varthur",
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

/**
 * Folders the sheet does not list, placed by hand (confirmed 18 Nov 2026). Kept apart from
 * the generated list above so that regenerating it from the workbook does not lose them - and
 * so the next person can see these four came from a decision, not from the sheet.
 */
const NOT_IN_SHEET = {
  'South-East': ['MH - Cuttack'],
  Others: ['MH - Clinic', 'MH - OOO Clinic', 'MH - OOO South East'],
};
for (const [cluster, folders] of Object.entries(NOT_IN_SHEET)) {
  FOLDERS_BY_CLUSTER[cluster] = [...new Set([...(FOLDERS_BY_CLUSTER[cluster] || []), ...folders])].sort();
}

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

/**
 * The one cluster a listing belongs to, from its primary folder. This is the value every
 * Cluster column in the realtime section shows.
 */
const clusterOfFolder = (folder) => clustersOf(folder)[0];

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

/**
 * Folder -> GMB branch (unit name), from the "Unit mapping" sheet of
 * "unit_wise_team_allocation_with_GMB_units.xlsx". A user's Branch at login is one of these
 * names; several folders can share one (Hospitals, Out Of Org), and a branch-level user sees
 * every folder mapped to their branch. Generated from the workbook (55 folders).
 */
const BRANCH_BY_FOLDER = {
  "East Cluster - Hospitals": "Hospitals",
  "Hospitals": "Hospitals",
  "MH - AHL": "Ahilyanagar",
  "MH - Baner": "Baner",
  "MH - Begur": "Begur",
  "MH - Bibwewadi": "Bibwewadi",
  "MH - Broadway": "Broadway",
  "MH - Cuttack": "Cuttack",
  "MH - Department": "Depatments",
  "MH - Dhakuria": "Dhakuria",
  "MH - Doddaballapur": "Doddaballapur",
  "MH - Dwarka": "Delhi",
  "MH - EM Bypass": "EM Bypass",
  "MH - Electronic City": "Electronic City",
  "MH - Ghaziabad": "Ghaziabad",
  "MH - Goa": "Goa",
  "MH - Hadapsar": "Hadaspar",
  "MH - Hebbal": "Hebbal",
  "MH - Indiranagar Clinic": "Indiranagar",
  "MH - International": "International",
  "MH - Jaipur": "Jaipur",
  "MH - Jayanagar": "Jayanagar",
  "MH - Kankapura Clinic": "Kanakapura",
  "MH - Karad": "Kharad",
  "MH - Kothrud": "Kothurd",
  "MH - MARS": "MARS",
  "MH - Malleshwaram": "Malleshwaram",
  "MH - Millers Road": "Millers Road",
  "MH - Mukhundapur": "Mukundapur",
  "MH - Mysore": "Mysore",
  "MH - Nagar Road": "Nagar Road",
  "MH - Nashik": "Nashik",
  "MH - OOO East": "Out Of Org",
  "MH - OOO North": "Out Of Org",
  "MH - OOO South": "Out Of Org",
  "MH - Old Airport": "Old Airport Road",
  "MH - Patiala": "Patiala",
  "MH - Pune": "Kharadi",
  "MH - Ranchi": "Ranchi",
  "MH - Rangapani": "Rangapani",
  "MH - Salem": "Salem",
  "MH - Salt Lake": "Salt lake",
  "MH - Sarjapur": "Sarjapur",
  "MH - Siliguri": "Siliguri",
  "MH - Varthur": "Varthur",
  "MH - Vijaywada": "Vijayawada",
  "MH - Whitefield": "Whitefield",
  "MH - Yashwanthpur": "Yeshwanthpur",
  "MH - Yelahanka": "Yelahanka",
  "MH- Deccan": "Deccan Gymkhana",
  "MH- Mangalore(KMC)": "Mangalore",
  "MHBBS - MH- Bhubaneswar": "Bhubaneswar",
  "NCR-Gurugram": "Gurugram",
  "South Cluster - Hospitals": "Hospitals",
  "South East Cluster - Hospitals": "Hospitals",
};

const normaliseBranch = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** "MH - Dwarka" / "MH- Deccan" / "MHBBS - MH- Bhubaneswar" -> the place name alone. */
const placeOfFolder = (folder) => String(folder || '').replace(/^(MHBBS\s*-\s*)?MH\s*-\s*/i, '');

/**
 * The folders a login branch covers. Matched on the sheet's branch name first; a branch the
 * sheet spells differently (user "Dwarka", sheet "Delhi"; "Kothrud" vs "Kothurd") still finds
 * its folder by the folder's own place name. An unknown branch gets no folders.
 */
const foldersOfBranch = (branch) => {
  const wanted = normaliseBranch(branch);
  if (!wanted) return [];
  const byName = Object.keys(BRANCH_BY_FOLDER).filter((f) => normaliseBranch(BRANCH_BY_FOLDER[f]) === wanted);
  if (byName.length) return byName.sort();
  return SHEET_FOLDERS.filter((f) => normaliseBranch(placeOfFolder(f)) === wanted).sort();
};

const branchOfFolder = (folder) => BRANCH_BY_FOLDER[folder] || '';

module.exports = {
  OTHERS,
  CLUSTERS,
  SHEET_FOLDERS,
  FOLDERS_BY_CLUSTER,
  clustersOf,
  clusterOfFolder,
  foldersOf,
  clusterFilter,
  BRANCH_BY_FOLDER,
  foldersOfBranch,
  branchOfFolder,
};
