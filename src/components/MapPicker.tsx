"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { markerIconDefault as icon } from "@/lib/leafletIcon";

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

/** `marker` is null until the organizer pins a spot. */
export function MapPicker({
  center,
  marker,
  onChange,
}: {
  center: { lat: number; lng: number };
  marker: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10">
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: 280, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {marker && <Marker position={[marker.lat, marker.lng]} icon={icon} />}
        <ClickHandler onPick={onChange} />
        <Recenter lat={center.lat} lng={center.lng} />
      </MapContainer>
    </div>
  );
}
