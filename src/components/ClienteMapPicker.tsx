"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Reference marker images from the CDN instead of bundling them — avoids
// Next.js/webpack static-asset path issues with Leaflet's default icon.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const PERU_CENTER: [number, number] = [-9.19, -75.0152];

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
  }, [lat, lng, map]);
  return null;
}

export default function ClienteMapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasPosition = lat != null && lng != null;
  const initialCenter: [number, number] = hasPosition
    ? [lat as number, lng as number]
    : PERU_CENTER;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-gray-300">
        <MapContainer
          center={initialCenter}
          zoom={hasPosition ? 16 : 6}
          style={{ height: "300px", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          <RecenterOnChange lat={lat} lng={lng} />
          {hasPosition && (
            <Marker
              position={[lat as number, lng as number]}
              icon={defaultIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onChange(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.geolocation?.getCurrentPosition((pos) => {
            onChange(pos.coords.latitude, pos.coords.longitude);
          });
        }}
        className="text-sm font-medium text-gray-700 underline hover:text-gray-900"
      >
        Usar mi ubicación actual
      </button>
    </div>
  );
}
