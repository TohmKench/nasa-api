import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import NavBar from './NavBar';

const GET_NEO_FEED = gql`
  query NeoFeed($startDate: String, $endDate: String) {
    neoFeed(startDate: $startDate, endDate: $endDate) {
      id
      name
      approachDate
      diameter
      isHazardous
      missDistanceKm
      velocityKps
    }
  }
`;

const today = new Date();
const formatDate = (d: Date) => d.toISOString().split('T')[0];

// Helper function to get start of week (Monday)
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper function to get end of week (Sunday)
const getEndOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Get current week
const currentWeekStart = getStartOfWeek(today);
const currentWeekEnd = getEndOfWeek(today);
const defaultStart = formatDate(currentWeekStart);
const defaultEnd = formatDate(currentWeekEnd);

const CANVAS_SIZE = 900;
const EARTH_RADIUS = 30;
const MIN_ORBIT = EARTH_RADIUS + 30;
const MAX_ORBIT = CANVAS_SIZE / 2 - 40;
const MIN_BUBBLE = 6, MAX_BUBBLE = 40;

const AsteroidWatchPage: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [minDiameter, setMinDiameter] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [angleOffset, setAngleOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Calculate current week's start and end dates
  const weekStart = getStartOfWeek(selectedWeek);
  const weekEnd = getEndOfWeek(selectedWeek);
  const startDate = formatDate(weekStart);
  const endDate = formatDate(weekEnd);

  // Navigation functions
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(newDate);
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date());
  };

  const { loading, error, data, refetch } = useQuery(GET_NEO_FEED, {
    variables: { startDate, endDate },
    skip: !startDate || !endDate,
  });



  // Animation loop
  useEffect(() => {
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const animate = (now: number) => {
      const delta = now - last;
      last = now;
      setAngleOffset(prev => prev + (delta * 0.0002)); // 0.0002 radians/ms = ~0.7 rad/sec
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused]);

  // Prepare data for radial layout
  const allAsteroids = (data?.neoFeed || []);
  
  // Check if there are any asteroids in the selected week
  const asteroidsInWeek = allAsteroids.filter((n: any) => {
    const approachDate = new Date(n.approachDate);
    return approachDate >= weekStart && approachDate <= weekEnd;
  });
  
  const allDiameters = allAsteroids.map((n: any) => n.diameter);
  const minD = allDiameters.length > 0 ? Math.min(...allDiameters) : 0;
  const maxD = allDiameters.length > 0 ? Math.max(...allDiameters) : 0;
  
  const chartData = useMemo(() => {
    // First filter by week, then by diameter
    const asteroids = asteroidsInWeek.filter((n: any) => n.diameter >= minDiameter);
    if (!asteroids.length) return [];
    
    const minMiss = Math.min(...asteroids.map((n: any) => n.missDistanceKm));
    const maxMiss = Math.max(...asteroids.map((n: any) => n.missDistanceKm));
    const minDiam = Math.min(...asteroids.map((n: any) => n.diameter));
    const maxDiam = Math.max(...asteroids.map((n: any) => n.diameter));
    const minDate = Math.min(...asteroids.map((n: any) => new Date(n.approachDate).getTime()));
    const maxDate = Math.max(...asteroids.map((n: any) => new Date(n.approachDate).getTime()));
    const minVel = Math.min(...asteroids.map((n: any) => n.velocityKps));
    const maxVel = Math.max(...asteroids.map((n: any) => n.velocityKps));
    return asteroids.map((n: any, i: number) => {
      // Scale miss distance to orbit radius
      const missNorm = (n.missDistanceKm - minMiss) / (maxMiss - minMiss || 1);
      const orbit = MIN_ORBIT + missNorm * (MAX_ORBIT - MIN_ORBIT);
      // Scale date to angle
      const dateNorm = (new Date(n.approachDate).getTime() - minDate) / (maxDate - minDate || 1);
      const baseAngle = 2 * Math.PI * dateNorm;
      // Normalize velocity to a speed factor (0.5x to 2x base speed)
      const velNorm = (n.velocityKps - minVel) / (maxVel - minVel || 1);
      const speedFactor = 0.5 + velNorm * 1.5;
      const angle = baseAngle + angleOffset * speedFactor;
      // Scale diameter to bubble size
      const size = MIN_BUBBLE + ((n.diameter - minDiam) / (maxDiam - minDiam || 1)) * (MAX_BUBBLE - MIN_BUBBLE);
      // Convert polar to cartesian
      const cx = CANVAS_SIZE / 2 + orbit * Math.cos(angle);
      const cy = CANVAS_SIZE / 2 + orbit * Math.sin(angle);
      return {
        ...n,
        cx,
        cy,
        size,
        color: n.isHazardous ? '#ff4d4f' : '#40a9ff',
        angle,
        orbit,
      };
    });
  }, [allAsteroids, minDiameter, angleOffset]);

  return (
    <div style={{
      minHeight: '100vh', height: 'auto', minWidth: '100vw', background: 'linear-gradient(135deg, #232526 0%, #414345 100%)', position: 'relative', overflowY: 'auto' }}>
      <NavBar />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '110px', paddingBottom: '40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.88)', color: '#222', borderRadius: '16px', boxShadow: '0 4px 32px rgba(0,0,0,0.18)', border: '1.5px solid #e0e0e0', padding: '2rem 2.5rem', maxWidth: 900, width: '100%', margin: '0 auto', marginBottom: '2.5rem', backdropFilter: 'blur(2px)' }}>
          <h1 style={{ fontWeight: 700, fontSize: '2.2rem', marginBottom: '0.5rem', color: '#181a20' }}>Asteroid Watch: Radial Orbit Layout</h1>
          <p style={{ color: '#444', marginBottom: '1.5rem' }}>Each asteroid is a bubble on a circular orbit: distance = miss distance, angle = approach date, size = diameter, color = hazard.</p>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {/* Week Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <label style={{ fontWeight: 600, color: '#444', fontSize: '1.1rem' }}>Week Selection</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={goToPreviousWeek}
                  style={{
                    background: '#40a9ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  ← Previous Week
                </button>
                <div style={{ 
                  background: '#f0f0f0', 
                  padding: '8px 16px', 
                  borderRadius: 6, 
                  border: '1px solid #ddd',
                  minWidth: '200px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontWeight: 600, color: '#333' }}>
                    {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {startDate} to {endDate}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: asteroidsInWeek.length > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500, marginTop: '2px' }}>
                    {asteroidsInWeek.length} asteroid{asteroidsInWeek.length !== 1 ? 's' : ''} found
                  </div>
                </div>
                <button
                  onClick={goToNextWeek}
                  style={{
                    background: '#40a9ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  Next Week →
                </button>
              </div>
              <button
                onClick={goToCurrentWeek}
                style={{
                  background: '#52c41a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  marginTop: 4
                }}
              >
                Go to Current Week
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
              <label style={{ fontWeight: 600, color: '#444' }}>Min Diameter (km): {minDiameter}</label>
              <input type="range" min={minD} max={maxD} step={0.001} value={minDiameter} onChange={e => setMinDiameter(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>
        <div style={{
          background: 'rgba(30,32,40,0.97)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          boxShadow: '0 6px 32px rgba(0,0,0,0.22)',
          border: '2px solid #fff',
          maxWidth: CANVAS_SIZE + 40,
          width: '100%',
          margin: '0 auto',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: CANVAS_SIZE + 40,
          height: 'auto'
        }}>
          <button
            onClick={() => setPaused(p => !p)}
            style={{ marginBottom: 16, alignSelf: 'flex-end', background: paused ? '#40a9ff' : '#fff', color: paused ? '#fff' : '#222', border: '1.5px solid #40a9ff', borderRadius: 8, padding: '0.4rem 1.2rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'background 0.2s' }}
          >
            {paused ? 'Play' : 'Pause'}
          </button>
          {loading ? (
            <p style={{ color: '#fff', fontSize: '1.1rem' }}>Loading asteroid data...</p>
          ) : asteroidsInWeek.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <p style={{ color: '#ff4d4f', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                No asteroids found for this week
              </p>
              <p style={{ color: '#ccc', fontSize: '1rem' }}>
                {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '1rem' }}>
                Try selecting a different week or go back to the current week
              </p>
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <p style={{ color: '#ffa500', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                No asteroids match your diameter filter
              </p>
              <p style={{ color: '#ccc', fontSize: '1rem' }}>
                Found {asteroidsInWeek.length} asteroids, but none meet the minimum diameter of {minDiameter} km
              </p>
              <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '1rem' }}>
                Try lowering the minimum diameter slider
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', width: CANVAS_SIZE, height: CANVAS_SIZE, margin: '0 auto' }}>
              <svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ display: 'block', background: 'none' }}>
                {/* Earth at center */}
                <circle cx={CANVAS_SIZE / 2} cy={CANVAS_SIZE / 2} r={EARTH_RADIUS} fill="#3ad1ff" stroke="#fff" strokeWidth={3} />
                {/* Orbits */}
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                  <circle key={i} cx={CANVAS_SIZE / 2} cy={CANVAS_SIZE / 2} r={MIN_ORBIT + f * (MAX_ORBIT - MIN_ORBIT)} fill="none" stroke="#888" strokeDasharray="4 4" strokeWidth={1} opacity={0.2} />
                ))}
                {/* Asteroids */}
                {chartData.map((n: any, i: number) => (
                  <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={n.cx}
                      cy={n.cy}
                      r={n.size}
                      fill={n.color}
                      stroke="#fff"
                      strokeWidth={n.isHazardous ? 4 : 2}
                      opacity={hovered === n.id ? 1 : 0.85}
                    />
                    {hovered === n.id && (
                      (() => {
                        // Tooltip dimensions
                        const tooltipWidth = 220;
                        const tooltipHeight = 110;
                        const padding = 10;
                        // Default: right of asteroid
                        let tooltipX = n.cx + n.size + padding;
                        let tooltipY = n.cy - 60;
                        // If it would overflow right, render to the left
                        if (tooltipX + tooltipWidth > CANVAS_SIZE) {
                          tooltipX = n.cx - n.size - padding - tooltipWidth;
                        }
                        // Clamp Y to stay within SVG
                        if (tooltipY < 0) tooltipY = 0;
                        if (tooltipY + tooltipHeight > CANVAS_SIZE) tooltipY = CANVAS_SIZE - tooltipHeight;
                        return (
                          <g>
                            <rect
                              x={tooltipX}
                              y={tooltipY}
                              width={tooltipWidth}
                              height={tooltipHeight}
                              rx={10}
                              fill="#222"
                              stroke="#fff"
                              strokeWidth={2}
                              opacity={0.95}
                            />
                            <text x={tooltipX + 10} y={tooltipY + 20} fill="#fff" fontSize={15} fontWeight={700}>{n.name}</text>
                            <text x={tooltipX + 10} y={tooltipY + 40} fill="#fff" fontSize={13}>Date: {new Date(n.approachDate).toLocaleString()}</text>
                            <text x={tooltipX + 10} y={tooltipY + 60} fill="#fff" fontSize={13}>Diameter: {n.diameter} km</text>
                            <text x={tooltipX + 10} y={tooltipY + 80} fill="#fff" fontSize={13}>Miss Distance: {n.missDistanceKm.toLocaleString()} km</text>
                            <text x={tooltipX + 10} y={tooltipY + 100} fill="#fff" fontSize={13}>Velocity: {n.velocityKps.toFixed(2)} km/s</text>
                            <text x={tooltipX + 10} y={tooltipY + 120 - 10} fill="#fff" fontSize={13}>Hazardous: {n.isHazardous ? 'Yes' : 'No'}</text>
                          </g>
                        );
                      })()
                    )}
                  </g>
                ))}
              </svg>
              {/* Overlay Material Symbols globe icon */}
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: EARTH_RADIUS * 2.2,
                  color: '#1e88e5',
                  textShadow: '0 0 8px #fff, 0 0 16px #3ad1ff',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 2
                }}
              >
                globe
              </span>
            </div>
          )}
        </div>
        {/* Legend for bubble sizes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={MAX_BUBBLE + 10} height={MAX_BUBBLE + 10}>
              <circle cx={(MAX_BUBBLE + 10) / 2} cy={(MAX_BUBBLE + 10) / 2} r={MIN_BUBBLE} fill="#40a9ff" stroke="#fff" strokeWidth={2} />
            </svg>
            <span style={{ color: '#fff' }}>Min diameter: {minD?.toFixed(3)} km</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={MAX_BUBBLE + 10} height={MAX_BUBBLE + 10}>
              <circle cx={(MAX_BUBBLE + 10) / 2} cy={(MAX_BUBBLE + 10) / 2} r={MAX_BUBBLE} fill="#40a9ff" stroke="#fff" strokeWidth={2} />
            </svg>
            <span style={{ color: '#fff' }}>Max diameter: {maxD?.toFixed(3)} km</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={40} height={40}><circle cx={20} cy={20} r={15} fill="#ff4d4f" stroke="#fff" strokeWidth={2} /></svg>
            <span style={{ color: '#fff' }}>Hazardous Asteroid</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsteroidWatchPage; 