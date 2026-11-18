const mongoose = require('mongoose');
const {
  OTHERS,
  CLUSTERS,
  SHEET_FOLDERS,
  clustersOf,
  foldersOf,
  foldersOfBranch,
} = require('./cluster-folders');

/**
 * Who may see which listings in the realtime data, from the signed-in user's own record.
 *
 *   Admin                 everything
 *   Cluster-level login   the folders the allocation sheet puts in their cluster
 *   Branch-level login    the folders mapped to their branch (GMB Branch column of the sheet)
 *
 * The Others cluster (Hospitals, Departments, MARS, International, Out Of Org, ...) is shown to
 * Admin only: a cluster or branch login sees its own folders and nothing else. Set OTHERS_SHARED
 * to true to show Others to every login as well.
 *
 * The caller is identified by the x-user-email header the dashboard sends with every realtime
 * request, looked up in the users collection - the role, cluster and branch come from the
 * database, never from the request. One email can hold several logins (a Broadway and a Salt
 * Lake branch login, say, each with its own password), so the dashboard also sends the role,
 * cluster and branch of the login in use (x-user-role / -cluster / -branch); they only pick
 * between that email's own records and can never grant a scope the email does not have. A request with no email, or an email that is not a user
 * (the development admin), is treated as Admin, which is how every realtime endpoint behaved
 * before. As with the optimization gate, this is not a substitute for a server-side session.
 */
const OTHERS_SHARED = false;

const USER_TTL_MS = 60 * 1000;
const userCache = new Map();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUsers = async (email) => {
  const hit = userCache.get(email);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.users;
  const exact = new RegExp(`^${escapeRegex(email)}$`, 'i');
  const users = await mongoose.connection.db
    .collection('users')
    .find({ $or: [{ orgEmail: exact }, { mail: exact }] }, { projection: { user: 1, Cluster: 1, Branch: 1 } })
    .toArray();
  userCache.set(email, { at: Date.now(), users });
  return users;
};

const norm = (v) => String(v || '').trim().toLowerCase();

/** The email's login record that matches the session's role/cluster/branch, else its first. */
const pickUser = (users, req) => {
  if (users.length <= 1) return users[0] || null;
  const role = norm(req.headers['x-user-role']);
  const cluster = norm(req.headers['x-user-cluster']);
  const branch = norm(req.headers['x-user-branch']);
  const match = users.find(
    (u) => norm(u.user) === role && norm(u.Cluster) === cluster && norm(u.Branch) === branch
  );
  return match || users[0];
};

/** Listings whose folders include any of these, plus - with Others - the unmapped ones. */
const folderCondition = (folders, withOthers) => {
  const list = [...new Set([...folders, ...(withOthers ? foldersOf([OTHERS]) : [])])];
  if (!withOthers) return { folders: { $in: list } };
  // Others also covers listings whose folders the sheet never names (as clusterFilter does).
  return { $and: [{ $or: [{ folders: { $in: list } }, { folders: { $nin: SHEET_FOLDERS } }] }] };
};

const FULL = { level: 'all', filter: null, clusters: null, key: 'all' };

/**
 * The caller's access: `filter` is a Mongo condition on realtimeProfiles (null = everything),
 * `clusters` the clusters they may pick from, `key` a short label for logs and cache keys.
 */
const accessFor = async (req) => {
  const email = String(req.headers['x-user-email'] || '').trim().toLowerCase();
  if (!email) return FULL;
  const user = pickUser(await findUsers(email), req);
  if (!user) return FULL;

  const role = String(user.user || '').trim();
  const cluster = String(user.Cluster || '').trim();
  const branch = String(user.Branch || '').trim();

  if (role === 'Admin') return FULL;

  // The role decides the level; the fields only matter when the role is missing.
  const asBranch = role === 'Branch' || (role !== 'Cluster' && !!branch);
  if (asBranch && branch) {
    const folders = foldersOfBranch(branch);
    const own = [...new Set(folders.flatMap(clustersOf))];
    return {
      level: 'branch',
      branch,
      folders,
      filter: folderCondition(folders, OTHERS_SHARED),
      clusters: [...new Set([...own, ...(OTHERS_SHARED ? [OTHERS] : [])])].sort(),
      key: `branch:${branch}`,
    };
  }
  if (cluster && CLUSTERS.includes(cluster)) {
    return {
      level: 'cluster',
      cluster,
      folders: foldersOf([cluster]),
      filter: cluster === OTHERS ? folderCondition([], true) : folderCondition(foldersOf([cluster]), OTHERS_SHARED),
      clusters: [...new Set([cluster, ...(OTHERS_SHARED ? [OTHERS] : [])])].sort(),
      key: `cluster:${cluster}`,
    };
  }
  // A non-admin with no usable branch or cluster sees only what is common to everyone.
  return {
    level: 'none',
    folders: [],
    filter: OTHERS_SHARED ? folderCondition([], true) : { _id: null },
    clusters: OTHERS_SHARED ? [OTHERS] : [],
    key: 'none',
  };
};

/** Express middleware: sets req.access for every realtime route. */
const attachAccess = async (req, res, next) => {
  try {
    req.access = await accessFor(req);
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { accessFor, attachAccess, OTHERS_SHARED };
