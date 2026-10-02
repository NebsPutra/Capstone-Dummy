/**
 * Pages inside the signed-in app that logged-out visitors may also open, in a
 * read-only form: Explore, an activity's details and invite links. Editing
 * (/activities/<id>/edit) and everything else still needs a sign-in.
 */
export function isGuestPath(pathname: string): boolean {
  return /^\/(explore|activities\/[^/]+|join\/[^/]+|event\/[^/]+|event\/code\/[^/]+)\/?$/.test(pathname);
}
