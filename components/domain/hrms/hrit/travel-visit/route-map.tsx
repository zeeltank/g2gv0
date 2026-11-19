'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import { Button } from '@/components/ui/button'
import type { TravelPoint } from '@/services/hrms/travel-visits'

/**
 * The trip's route on an OpenStreetMap: green start, red end, a line through
 * every position fix, and a Play button that walks a marker along it.
 *
 * Leaflet touches `window`, so it is imported inside the effect, never at module
 * load (this file is also rendered on the server).
 */
export function RouteMap({ points, ongoing }: { points: TravelPoint[]; ongoing: boolean }) {
  const el = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMap | null>(null)
  const walker = React.useRef<Marker | null>(null)
  const line = React.useRef<Polyline | null>(null)
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const [playing, setPlaying] = React.useState(false)

  const stop = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setPlaying(false)
  }, [])

  React.useEffect(() => {
    let cancelled = false

    void import('leaflet').then((L) => {
      if (cancelled || !el.current) return

      const map = L.map(el.current)
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const coords = points.map((p) => [p.lat, p.lng] as [number, number])
      if (coords.length === 0) {
        map.setView([22.9734, 78.6569], 5) // India, when there is nothing to draw
        return
      }

      // Divs, not the default marker image: the bundler would not find its PNGs.
      const dot = (color: string) =>
        L.divIcon({
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5)"></span>`,
        })

      line.current = L.polyline(coords, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map)

      // Intermediate fixes: small dots with their time.
      points.slice(1, -1).forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 3, color: '#2563eb', fillColor: '#fff', fillOpacity: 1, weight: 2 })
          .bindTooltip(new Date(p.recorded_at).toLocaleTimeString('en-IN'))
          .addTo(map)
      })

      L.marker(coords[0], { icon: dot('#16a34a') }).bindTooltip('Start').addTo(map)
      if (coords.length > 1) {
        L.marker(coords[coords.length - 1], { icon: dot(ongoing ? '#f59e0b' : '#dc2626') })
          .bindTooltip(ongoing ? 'Last seen' : 'End')
          .addTo(map)
      }

      walker.current = L.marker(coords[0], { icon: dot('#7c3aed'), opacity: 0 }).addTo(map)

      // Zoom to the trip. Identical points (a phone that never moved) give a
      // zero-size area, which fitBounds turns into a world view, so zoom to the
      // spot instead.
      const fit = () => {
        const bounds = line.current?.getBounds()
        if (!bounds) return
        if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
          map.setView(coords[0], 16)
        } else {
          map.fitBounds(bounds.pad(0.15), { maxZoom: 17 })
        }
      }
      fit()
      // The dialog is still animating open when this runs, so the map may have been
      // measured at the wrong size. Re-measure once it has settled, then fit again.
      setTimeout(() => {
        if (cancelled || mapRef.current !== map) return
        map.invalidateSize()
        fit()
      }, 300)
    })

    return () => {
      cancelled = true
      stop()
      mapRef.current?.remove()
      mapRef.current = null
      walker.current = null
      line.current = null
    }
  }, [points, ongoing, stop])

  function play() {
    if (playing) return stop()
    if (!walker.current || points.length < 2) return
    const marker = walker.current
    let i = 0
    marker.setOpacity(1)
    setPlaying(true)
    timer.current = setInterval(() => {
      i += 1
      if (i >= points.length) {
        stop()
        return
      }
      marker.setLatLng([points[i].lat, points[i].lng])
      mapRef.current?.panTo([points[i].lat, points[i].lng], { animate: true })
    }, 400)
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" onClick={play} disabled={points.length < 2} className="cursor-pointer">
        {playing ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
        {playing ? 'Stop' : 'Play Route'}
      </Button>
      <div ref={el} className="z-0 h-[420px] w-full overflow-hidden rounded-xl border border-border" />
      {points.length === 0 && <p className="text-sm text-muted-foreground">No location has been recorded for this trip yet.</p>}
    </div>
  )
}
