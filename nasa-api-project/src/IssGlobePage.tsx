// @ts-nocheck
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { gql, useQuery } from '@apollo/client';

const GET_ISS_POSITION = gql`
  query {
    issPosition {
      latitude
      longitude
      timestamp
    }
    issAstronauts {
      name
      nationality
      timeInOrbit
      profileImage
      wiki
    }
  }
`;

// Convert lat/lon to 3D coordinates on a sphere
function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function MatrixGridRoom() {
  const size = 10;
  const divisions = 20;
  const color = '#00ff44';
  const lineDefs = React.useMemo(() => {
    const defs = [];
    for (let i = -size; i <= size; i += size / (divisions / 2)) {
      defs.push({ key: `floor-x-${i}`, points: [i, -size, -size, i, size, -size] });
      defs.push({ key: `floor-y-${i}`, points: [-size, i, -size, size, i, -size] });
      defs.push({ key: `ceil-x-${i}`, points: [i, -size, size, i, size, size] });
      defs.push({ key: `ceil-y-${i}`, points: [-size, i, size, size, i, size] });
      defs.push({ key: `wall-xmin-y-${i}`, points: [-size, i, -size, -size, i, size] });
      defs.push({ key: `wall-xmax-y-${i}`, points: [size, i, -size, size, i, size] });
      defs.push({ key: `wall-ymin-x-${i}`, points: [i, -size, -size, i, -size, size] });
      defs.push({ key: `wall-ymax-x-${i}`, points: [i, size, -size, i, size, size] });
    }
    return defs;
  }, []);
  return (
    <group>
      {lineDefs.map(({ key, points }) => {
        const geometry = React.useMemo(() => {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
          return g;
        }, [points.join(',')]);
        const material = React.useMemo(() => new THREE.LineBasicMaterial({ color }), []);
        return (
          <line key={key}>
            <primitive object={geometry} attach="geometry" />
            <primitive object={material} attach="material" />
          </line>
        );
      })}
    </group>
  );
}

function WireframeGlobe() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[3, 64, 64]} />
      <meshBasicMaterial color="#00ff44" wireframe />
    </mesh>
  );
}

function ISSMarker({ lat, lon, radius }: { lat: number; lon: number; radius: number }) {
  const pos = useMemo(() => latLonToVec3(lat, lon, radius), [lat, lon, radius]);
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.09, 24, 24]} />
      <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={1} />
      <pointLight color="#00ff44" intensity={1.5} distance={1.5} />
    </mesh>
  );
}

function ISSOrbitPath({ positions, radius }: { positions: Array<{ lat: number; lon: number }>; radius: number }) {
  // Convert all lat/lon to Vec3
  const points = positions.map(p => new THREE.Vector3(...latLonToVec3(p.lat, p.lon, radius)));
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [positions.map(p => `${p.lat},${p.lon}`).join('|')]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#00ff44" linewidth={2} />
    </line>
  );
}

const ORBIT_RADIUS = 3.01;

const IssGlobePage: React.FC = () => {
  const { loading, error, data } = useQuery(GET_ISS_POSITION, { pollInterval: 5000 });

  // Simulate a simple orbit path: 90 points around the equator (for demo, replace with real path if available)
  const orbitPositions = useMemo(() => {
    if (data?.issPosition) {
      // For demo, create a path that circles the globe at the ISS latitude
      const arr = [];
      const issLat = data.issPosition.latitude;
      for (let i = 0; i < 90; i++) {
        arr.push({ lat: issLat, lon: (i * 4) - 180 });
      }
      return arr;
    }
    return [];
  }, [data?.issPosition]);

  return (
    <div style={{ minHeight: '100vh', background: '#101612', color: '#00ff44', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 18], fov: 50 }} style={{ width: '100vw', height: '100vh', background: '#101612' }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <MatrixGridRoom />
        <WireframeGlobe />
        {data?.issPosition && (
          <ISSMarker lat={data.issPosition.latitude} lon={data.issPosition.longitude} radius={ORBIT_RADIUS} />
        )}
        {orbitPositions.length > 0 && (
          <ISSOrbitPath positions={orbitPositions} radius={ORBIT_RADIUS} />
        )}
        <OrbitControls enablePan={false} enableZoom={true} maxDistance={30} minDistance={8} />
      </Canvas>
      <div style={{ position: 'absolute', top: 30, left: 0, width: '100%', textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
        <h1 style={{ color: '#00ff44', fontFamily: 'monospace', fontWeight: 700, fontSize: '2.5rem', textShadow: '0 0 16px #00ff44' }}>
          🌍 Where in the World is the ISS?
        </h1>
        <p style={{ color: '#00ff44', fontFamily: 'monospace', fontSize: '1.2rem', textShadow: '0 0 8px #00ff44' }}>
          Real-time ISS position, orbit path, and astronaut info
        </p>
        {loading && <p style={{ color: '#00ff44' }}>Loading ISS data...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
        {data?.issAstronauts && (
          <div style={{
            margin: '0 auto',
            display: 'inline-block',
            background: 'rgba(0,0,0,0.7)',
            border: '1.5px solid #00ff44',
            borderRadius: '12px',
            padding: '1.2rem 2.2rem',
            marginTop: '1.5rem',
            boxShadow: '0 0 24px #00ff44',
            color: '#00ff44',
            fontFamily: 'monospace',
            fontSize: '1.1rem',
            textAlign: 'left',
            pointerEvents: 'auto',
          }}>
            <h2 style={{ color: '#00ff44', fontWeight: 700, fontSize: '1.4rem', marginBottom: '0.7rem', textShadow: '0 0 8px #00ff44' }}>
              Astronauts on the ISS
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.issAstronauts.map((astro: any) => (
                <li key={astro.name} style={{ marginBottom: '0.7rem', display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                  {astro.profileImage && (
                    <img src={astro.profileImage} alt={astro.name} style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #00ff44', marginRight: 10, objectFit: 'cover', boxShadow: '0 0 8px #00ff44' }} />
                  )}
                  <div>
                    <span style={{ fontWeight: 600 }}>{astro.name}</span>
                    {astro.nationality && <span style={{ marginLeft: 8, fontStyle: 'italic', color: '#00ff44cc' }}>({astro.nationality})</span>}
                    {astro.timeInOrbit && <div style={{ fontSize: '0.95rem', color: '#00ff44bb' }}>Time in orbit: {astro.timeInOrbit}</div>}
                    {astro.wiki && <a href={astro.wiki} target="_blank" rel="noopener noreferrer" style={{ color: '#00ff44', textDecoration: 'underline', marginLeft: 8 }}>Wiki</a>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default IssGlobePage; 