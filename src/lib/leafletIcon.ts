import L from "leaflet";
// Leaflet's default icon paths don't resolve under bundlers, so import the
// bundled images (served from our own domain, no third-party CDN).
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Turbopack's client build imports these as plain URL strings, while the
// types (and webpack) give `{ src }`. Accept both: an undefined iconUrl makes
// Leaflet throw and crashes the whole page.
const url = (img: unknown) => (typeof img === "string" ? img : (img as { src: string }).src);

export const markerIconDefault = L.icon({
  iconUrl: url(markerIcon),
  iconRetinaUrl: url(markerIcon2x),
  shadowUrl: url(markerShadow),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
