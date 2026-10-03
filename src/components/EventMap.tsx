"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { markerIconDefault as icon } from "@/lib/leafletIcon";

export function EventMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <div className="isolate overflow-hidden rounded-xl border border-ink/10">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: 220, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
