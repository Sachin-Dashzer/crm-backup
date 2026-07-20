export const MAIN_BRANCHES = ["Delhi", "Mumbai", "Hyderabad", "Noida"];

export const COLLAB_BRANCHES = [
  "Patna",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Bengaluru",
  "Pune",
  "Lucknow",
  "Chennai",
];

export const ALL_BRANCHES = [...MAIN_BRANCHES, ...COLLAB_BRANCHES];

// Resolves the Mongo filter object to merge into a query's `branch` (or custom field)
// restriction, given the logged-in user's session and an optional client-requested branch.
export function resolveBranchFilter(session, requestedBranch, field = "branch") {
  const userBranch = session?.user?.branch;

  if (userBranch === "Collab") {
    if (requestedBranch && COLLAB_BRANCHES.includes(requestedBranch)) {
      return { [field]: requestedBranch };
    }
    return { [field]: { $in: COLLAB_BRANCHES } };
  }

  if (userBranch && userBranch !== "All") {
    return { [field]: userBranch };
  }

  if (requestedBranch) {
    return { [field]: requestedBranch };
  }

  return {};
}
