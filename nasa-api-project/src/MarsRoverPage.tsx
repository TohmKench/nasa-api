import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, gql } from '@apollo/client';
import './MarsRoverPage.css';
import NavBar from './NavBar';

const ROVERS = [
  { name: 'Curiosity', value: 'curiosity' },
  { name: 'Perseverance', value: 'perseverance' },
  { name: 'Opportunity', value: 'opportunity' },
  { name: 'Spirit', value: 'spirit' },
];

const GET_AVAILABLE_SOLS = gql`
  query AvailableSols($rover: String!) {
    availableSols(rover: $rover)
  }
`;

const GET_AVAILABLE_CAMERAS = gql`
  query AvailableCameras($rover: String!) {
    availableCameras(rover: $rover)
  }
`;

const GET_MARS_ROVER_PHOTOS_SUMMARY = gql`
  query MarsRoverPhotosSummary($rover: String!) {
    marsRoverPhotos(rover: $rover, summaryOnly: true) {
      sol
      photoCount
      camera
    }
  }
`;

const GET_MARS_ROVER_PHOTOS_FOR_SOL = gql`
  query MarsRoverPhotosForSol($rover: String!, $sol: Int!, $camera: String) {
    marsRoverPhotos(rover: $rover, solRange: [$sol], camera: $camera, summaryOnly: false) {
      sol
      photos {
        id
        img_src
        earth_date
        sol
        camera
        rover
      }
    }
  }
`;

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * Math.PI / 180.0;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function describeArc(cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number) {
  // Returns SVG path for a thick arc (donut segment)
  const [sx1, sy1] = polarToCartesian(cx, cy, rOuter, endAngle);
  const [ex1, ey1] = polarToCartesian(cx, cy, rOuter, startAngle);
  const [sx2, sy2] = polarToCartesian(cx, cy, rInner, endAngle);
  const [ex2, ey2] = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    `M ${sx1} ${sy1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${ex1} ${ey1}`,
    `L ${ex2} ${ey2}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${sx2} ${sy2}`,
    'Z',
  ].join(' ');
}

interface ChartDataItem {
  sol: number;
  count: number;
  cameras: string[];
  earth_date: string;
}

const MarsRoverPage: React.FC = () => {
  const [rover, setRover] = useState('curiosity');
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [hoveredSol, setHoveredSol] = useState<number | null>(null);
  const [selectedSol, setSelectedSol] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<any | null>(null);
  const [photoPage, setPhotoPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
  const PHOTOS_PER_PAGE = 25;

  // Fetch available sols and cameras (only once per rover)
  const { 
    data: solsData, 
    loading: solsLoading, 
    error: solsError,
    refetch: refetchSols 
  } = useQuery(GET_AVAILABLE_SOLS, { 
    variables: { rover },
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all'
  });

  const { 
    data: camerasData, 
    loading: camerasLoading, 
    error: camerasError,
    refetch: refetchCameras 
  } = useQuery(GET_AVAILABLE_CAMERAS, { 
    variables: { rover },
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all'
  });

  // Fetch photo summary for the selected rover (get all data once, filter client-side)
  const { 
    data: photosSummaryData, 
    loading: photosSummaryLoading, 
    error: photosSummaryError,
    refetch: refetchPhotosSummary 
  } = useQuery(GET_MARS_ROVER_PHOTOS_SUMMARY, {
    variables: { 
      rover
    },
    skip: !rover, // Skip until rover is selected
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all'
  });

  // Fetch actual photos for the selected sol (only when modal is opened)
  const { 
    data: modalPhotosData, 
    loading: modalPhotosLoading,
    error: modalPhotosError 
  } = useQuery(GET_MARS_ROVER_PHOTOS_FOR_SOL, {
    variables: { 
      rover, 
      sol: selectedSol || 0, 
      camera: selectedCamera 
    },
    skip: !modalOpen || selectedSol === null || !rover,
    errorPolicy: 'all'
  });

  // Get sols array with fallback
  const sols = useMemo(() => {
    return solsData?.availableSols || [];
  }, [solsData]);

  // Camera options for the selected rover
  const cameras = useMemo(() => {
    return camerasData?.availableCameras || [];
  }, [camerasData]);

  // Prepare data for charts from summary data with client-side camera filtering
  const allChartData = useMemo(() => {
    if (!photosSummaryData?.marsRoverPhotos) return [];
    
    // Filter by selected camera client-side (no new API calls)
    let filteredData = photosSummaryData.marsRoverPhotos;
    if (selectedCamera) {
      filteredData = photosSummaryData.marsRoverPhotos.filter((group: any) => 
        group.camera === selectedCamera
      );
    }
    
    const mappedData = filteredData.map((group: any): ChartDataItem => ({
      sol: group.sol,
      count: group.photoCount || 0,
      cameras: [group.camera || ''],
      earth_date: '', // Not available in summary
    }));
    
    return mappedData;
  }, [photosSummaryData, selectedCamera]);

  // Bar chart showing 28 sols with photos per bar
  const SOLS_PER_BAR = 28;
  const barChartData = useMemo(() => {
    if (!allChartData.length) return [];
    
    // Filter to only include sols with photos and sort by sol number
    const solsWithPhotos = allChartData
      .filter((item: ChartDataItem) => item.count > 0) // Only sols with photos
      .sort((a: ChartDataItem, b: ChartDataItem) => a.sol - b.sol);
    
    // Group into chunks of 28 sols with photos
    const groups: { startSol: number; endSol: number; sols: ChartDataItem[]; totalPhotos: number }[] = [];
    
    for (let i = 0; i < solsWithPhotos.length; i += SOLS_PER_BAR) {
      const chunk = solsWithPhotos.slice(i, i + SOLS_PER_BAR);
      if (chunk.length > 0) {
        groups.push({
          startSol: chunk[0].sol,
          endSol: chunk[chunk.length - 1].sol,
          sols: chunk,
          totalPhotos: chunk.reduce((sum: number, item: ChartDataItem) => sum + item.count, 0)
        });
      }
    }
    
    return groups;
  }, [allChartData]);

  // State for selected bar group from bar chart
  const [selectedBar, setSelectedBar] = useState(0);
  
  // Use filtered data directly for radial chart (respects camera filter)
  const radialChartData = useMemo(() => {
    if (!allChartData.length) return [];
    
    // If a bar is selected, use that bar's data
    if (barChartData[selectedBar]) {
      return barChartData[selectedBar].sols;
    }
    
    // Otherwise, use the first 28 sols from filtered data
    return allChartData.slice(0, 28);
  }, [allChartData, barChartData, selectedBar]);
  
  const chartData = radialChartData;

  // Handle rover change
  const handleRoverChange = useCallback((newRover: string) => {
    setRover(newRover);
    setSelectedCamera(null);
    setSelectedSol(null);
    setModalOpen(false);
    setSelectedBar(0);
    setPhotoPage(0);
  }, []);

  // Handle camera change
  const handleCameraChange = useCallback((newCamera: string | null) => {
    setSelectedCamera(newCamera);
    setSelectedSol(null);
    setModalOpen(false);
    setPhotoPage(0);
  }, []);

  // Handle radial chart sol click
  const handleSolClick = useCallback((sol: number, chartDataItem: ChartDataItem) => {
    // Set the selected sol and open modal
    setSelectedSol(sol);
    setModalOpen(true);
  }, []);

  // Drag scrolling handlers for bar chart
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    const element = e.currentTarget as HTMLElement;
    setDragStartScrollLeft(element.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const element = e.currentTarget as HTMLElement;
    const x = e.clientX;
    const walk = (x - dragStartX) * 2; // Scroll speed multiplier
    element.scrollLeft = dragStartScrollLeft - walk;
  }, [isDragging, dragStartX, dragStartScrollLeft]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Global mouse event listeners for drag scrolling
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const element = document.querySelector('.bar-chart-scroll') as HTMLElement;
      if (element) {
        const x = e.clientX;
        const walk = (x - dragStartX) * 2;
        element.scrollLeft = dragStartScrollLeft - walk;
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStartX, dragStartScrollLeft]);

  // Radial chart constants
  const CANVAS_SIZE = 520;
  const CX = CANVAS_SIZE / 2;
  const CY = CANVAS_SIZE / 2;
  const R_INNER = 120;
  const R_OUTER_BASE = 180;
  const ARC_GAP = 2; // degrees between arcs
  const MAX_PHOTOS = Math.max(...chartData.map((d: ChartDataItem) => d.count), 1);

  return (
    <div style={{ background: '#181a20', minHeight: '100vh', color: '#fff', padding: '2rem', position: 'relative', marginTop: 100 }}>
      <NavBar />
      <h1 style={{ textAlign: 'center', color: '#ffb347', fontWeight: 700, fontSize: '2.5rem', letterSpacing: 1 }}>
        Mars Rover Photo Explorer
      </h1>
      <div style={{ textAlign: 'center', color: '#ccc', marginBottom: 24, fontSize: '1.15rem' }}>
        Explore photos taken by NASA's Mars rovers. The bar chart shows groups of 28 sols with photos for the selected rover. Click a bar to view those sols in the radial timeline, then click a segment to see photos.
      </div>
      
      {/* Rover Status */}
      {!solsLoading && !photosSummaryLoading && (
        <div style={{ textAlign: 'center', color: '#ffb347', marginBottom: 16, fontSize: '1.1rem', fontWeight: 600 }}>
          {ROVERS.find(r => r.value === rover)?.name}: {sols.length} sols with photos, {allChartData.length} total photo entries
        </div>
      )}
      
      {/* Error Display */}
      {(solsError || photosSummaryError || camerasError) && (
        <div style={{ textAlign: 'center', color: '#ff6b6b', marginBottom: 16, padding: '1rem', background: '#2a2a2a', borderRadius: 8 }}>
          <div>Error loading data:</div>
          {solsError && <div>Sols: {solsError.message}</div>}
          {photosSummaryError && <div>Photos: {photosSummaryError.message}</div>}
          {camerasError && <div>Cameras: {camerasError.message}</div>}
          <button 
            onClick={() => {
              refetchSols();
              refetchCameras();
              refetchPhotosSummary();
            }}
            style={{
              background: '#ffb347',
              color: '#222',
              border: 'none',
              borderRadius: 6,
              padding: '0.5rem 1rem',
              marginTop: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Loading Display */}
      {(solsLoading || photosSummaryLoading || camerasLoading) && (
        <div style={{ textAlign: 'center', color: '#ffb347', marginBottom: 16 }}>
          Loading data...
        </div>
      )}
      
      {/* Rover Selector */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', margin: '2rem 0' }}>
        {ROVERS.map(r => (
          <button
            key={r.value}
            onClick={() => handleRoverChange(r.value)}
            style={{
              background: rover === r.value ? '#ffb347' : '#222',
              color: rover === r.value ? '#222' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.7rem 1.5rem',
              fontWeight: 600,
              fontSize: '1.1rem',
              cursor: 'pointer',
              boxShadow: rover === r.value ? '0 0 12px #ffb347' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Camera Filter */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1.5rem 0', alignItems: 'center' }}>
        <label style={{ color: '#fff', fontSize: '1rem', fontWeight: 500 }}>Camera:</label>
        <select
          className="camera-select"
          value={selectedCamera || ''}
          onChange={e => handleCameraChange(e.target.value || null)}
          style={{ 
            padding: '0.75rem 1.25rem', 
            borderRadius: 8, 
            fontSize: '1rem',
            background: '#333',
            color: '#fff',
            border: '2px solid #444',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '200px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease'
          }}
          disabled={camerasLoading}
          onFocus={(e) => {
            e.target.style.borderColor = '#4fc3f7';
            e.target.style.boxShadow = '0 0 0 3px rgba(79, 195, 247, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#444';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
          }}
        >
          <option value="" style={{ background: '#333', color: '#fff' }}>All Cameras</option>
          {cameras.map((cam: string) => (
            <option key={cam} value={cam} style={{ background: '#333', color: '#fff' }}>{cam}</option>
          ))}
        </select>
      </div>
      
      {/* Bar Chart for 28 Sols with Photos */}
      <div style={{ 
        width: '100%', 
        minHeight: 200, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#222', 
        borderRadius: 16, 
        boxShadow: '0 2px 16px #0008', 
        marginBottom: '2rem', 
        padding: '1.5rem 1rem' 
      }}>
        {barChartData.length === 0 ? (
          <div style={{ color: '#ffb347', fontSize: '1.1rem', textAlign: 'center', padding: '1rem' }}>
            No photos found for this rover/camera combination.
          </div>
        ) : (
          <>
            <div style={{ color: '#ffb347', fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              {ROVERS.find(r => r.value === rover)?.name} Timeline for "Months" on Mars
            </div>
            
            {/* Responsive bar chart container */}
            <div style={{ 
              width: '100%', 
              maxWidth: '90vw', 
              position: 'relative',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <div 
                className="bar-chart-scroll"
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  justifyContent: 'flex-start', 
                  height: 240, 
                  gap: 3, 
                  overflowX: 'auto', 
                  overflowY: 'hidden',
                  padding: '0 1rem 1rem 1rem',
                  width: '100%',
                  maxWidth: '100%'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                {barChartData.map((group: { startSol: number; endSol: number; sols: ChartDataItem[]; totalPhotos: number }, i: number) => {
                  const maxCount = Math.max(...barChartData.map((g: { startSol: number; endSol: number; sols: ChartDataItem[]; totalPhotos: number }) => g.totalPhotos), 1);
                  const barHeight = 40 + 160 * (group.totalPhotos / maxCount);
                  const isSelected = i === selectedBar;
                  
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        flex: '0 0 28px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        minWidth: '28px',
                        position: 'relative'
                      }}
                      onClick={() => setSelectedBar(i)}
                    >
                      {/* Bar */}
                      <div style={{
                        width: 24,
                        height: barHeight,
                        background: isSelected ? '#4fc3f7' : `hsl(30, 100%, ${60 + 30 * (group.totalPhotos / maxCount)}%)`,
                        borderRadius: 6,
                        boxShadow: isSelected ? '0 0 0 3px #4fc3f7, 0 4px 12px rgba(79, 195, 247, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
                        marginBottom: 6,
                        border: `2px solid ${isSelected ? '#4fc3f7' : 'rgba(255, 179, 71, 0.5)'}`,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        position: 'relative',
                        zIndex: isSelected ? 2 : 1,
                      }} 
                      title={`Sols ${group.startSol}-${group.endSol}\nPhotos: ${group.totalPhotos}`}
                      >
                        {/* Photo count label */}
                        <span style={{ 
                          color: '#222', 
                          fontWeight: 700, 
                          fontSize: 9, 
                          writingMode: 'vertical-rl', 
                          textAlign: 'center', 
                          opacity: 0.8,
                          transform: 'rotate(180deg)',
                          lineHeight: '1.2'
                        }}>
                          {group.totalPhotos}
                        </span>
                      </div>
                      
                                             {/* Sol number label */}
                       <div style={{ 
                         color: isSelected ? '#4fc3f7' : '#fff', 
                         fontSize: 10, 
                         textAlign: 'center', 
                         fontWeight: isSelected ? 700 : 500,
                         transition: 'all 0.3s ease',
                         transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                         textShadow: isSelected ? '0 0 8px rgba(79, 195, 247, 0.5)' : 'none'
                       }}>
                         {group.startSol}
                       </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Scroll indicator */}
              {barChartData.length > 20 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#888', 
                  fontSize: '0.8rem', 
                  marginTop: '0.5rem',
                  fontStyle: 'italic'
                }}>
                  ← Scroll to see more bars →
                </div>
              )}
            </div>
            
                         {/* Selected bar info */}
             {selectedBar !== null && barChartData[selectedBar] && (
               <div style={{ 
                 background: 'rgba(79, 195, 247, 0.1)', 
                 border: '1px solid rgba(79, 195, 247, 0.3)', 
                 borderRadius: 8, 
                 padding: '0.75rem 1rem', 
                 marginTop: '0.5rem',
                 textAlign: 'center'
               }}>
                 <div style={{ color: '#4fc3f7', fontWeight: 600, fontSize: '0.9rem' }}>
                   {barChartData[selectedBar].sols[0]?.earth_date && barChartData[selectedBar].sols[barChartData[selectedBar].sols.length - 1]?.earth_date 
                     ? `${barChartData[selectedBar].sols[0].earth_date} - ${barChartData[selectedBar].sols[barChartData[selectedBar].sols.length - 1].earth_date}`
                     : `Sols ${barChartData[selectedBar].startSol}-${barChartData[selectedBar].endSol}`
                   }
                 </div>
                 <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                   {barChartData[selectedBar].totalPhotos} photos across {barChartData[selectedBar].sols.length} sols
                 </div>
               </div>
             )}
          </>
        )}
      </div>
      
      {/* Radial Timeline Chart for Selected Group */}
      <div style={{ width: '100%', minHeight: 520, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#222', borderRadius: 16, boxShadow: '0 2px 16px #0008', marginBottom: '2rem', position: 'relative', overflow: 'visible' }}>
        {chartData.length === 0 && !photosSummaryLoading && (
          <p style={{ color: '#ffb347', fontSize: '1.2rem' }}>
            No photos found for this sol/camera/rover combination.
          </p>
        )}
        <svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ display: 'block', overflow: 'visible' }}>
          {/* Central Mars circle */}
          <circle cx={CX} cy={CY} r={R_INNER - 30} fill="#b55239" stroke="#ffb347" strokeWidth={4} />
          {/* Sol arcs */}
          {chartData.map((d: ChartDataItem, i: number) => {
            const anglePer = 360 / chartData.length;
            const startAngle = i * anglePer + ARC_GAP / 2;
            const endAngle = (i + 1) * anglePer - ARC_GAP / 2;
            // Arc thickness and color scale with photo count
            const thickness = 18 + 32 * (d.count / Math.max(...chartData.map((x: ChartDataItem) => x.count), 1));
            const rOuter = R_OUTER_BASE + thickness / 2;
            const rInner = R_OUTER_BASE - thickness / 2;
            const color = `hsl(30, 100%, ${60 + 30 * (d.count / Math.max(...chartData.map((x: ChartDataItem) => x.count), 1))}%)`;
            // Place earth date label
            const midAngle = (startAngle + endAngle) / 2;
            const [labelX, labelY] = polarToCartesian(CX, CY, rOuter + 44, midAngle);
            const rotate = midAngle - 90;
            return (
              <g key={d.sol}>
                <path
                  d={describeArc(CX, CY, rInner, rOuter, startAngle, endAngle)}
                  fill={color}
                  stroke={hoveredSol === d.sol ? '#fff' : '#ffb347'}
                  strokeWidth={hoveredSol === d.sol ? 4 : 2}
                  opacity={hoveredSol === null || hoveredSol === d.sol ? 1 : 0.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={() => setHoveredSol(d.sol)}
                  onMouseLeave={() => setHoveredSol(null)}
                  onClick={() => handleSolClick(d.sol, d)}
                />
                {/* Earth date label with background and rotation */}
                {d.earth_date && (
                  <g transform={`translate(${labelX},${labelY}) rotate(${rotate})`}>
                    <rect x={-48} y={-16} width={96} height={28} rx={8} fill="#181a20" opacity={0.85} />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fontSize={hoveredSol === d.sol ? 17 : 14}
                      fill={hoveredSol === d.sol ? '#fff' : '#ffb347'}
                      style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: 700, letterSpacing: 0.5 }}
                    >
                      {d.earth_date}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* Modal for photo gallery */}
      {modalOpen && selectedSol !== null && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: '#000a',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setModalOpen(false)}
        >
          <div style={{
            background: '#222',
            borderRadius: 16,
            padding: 32,
            minWidth: 800,
            maxWidth: '98vw',
            maxHeight: '90vh',
            overflowY: 'hidden',
            boxShadow: '0 4px 32px #000c',
            position: 'relative',
          }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setModalOpen(false); setPhotoPage(0); }}
              style={{ position: 'absolute', top: 16, right: 16, background: '#ffb347', color: '#222', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Close
            </button>
            <h2 style={{ color: '#ffb347', marginBottom: 16 }}>Photos for Sol {selectedSol}</h2>
            
            {modalPhotosError && (
              <div style={{ color: '#ff6b6b', marginBottom: 16 }}>
                Error loading photos: {modalPhotosError.message}
              </div>
            )}
            
            {modalPhotosLoading && <div style={{ color: '#ffb347' }}>Loading photos...</div>}
            {!modalPhotosLoading && modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length === 0 && (
              <div style={{ color: '#ffb347' }}>No photos found for this sol.</div>
            )}
            
            {/* Pagination controls */}
            {modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length > PHOTOS_PER_PAGE && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 16 }}>
                <button
                  onClick={() => setPhotoPage(p => Math.max(0, p - 1))}
                  disabled={photoPage === 0}
                  style={{ background: '#ffb347', color: '#222', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 700, cursor: photoPage === 0 ? 'not-allowed' : 'pointer', opacity: photoPage === 0 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ color: '#ffb347', fontWeight: 600 }}>
                  Page {photoPage + 1} / {Math.ceil((modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length || 0) / PHOTOS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setPhotoPage(p => p + 1)}
                  disabled={((photoPage + 1) * PHOTOS_PER_PAGE) >= (modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length || 0)}
                  style={{ background: '#ffb347', color: '#222', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 700, cursor: ((photoPage + 1) * PHOTOS_PER_PAGE) >= (modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length || 0) ? 'not-allowed' : 'pointer', opacity: ((photoPage + 1) * PHOTOS_PER_PAGE) >= (modalPhotosData?.marsRoverPhotos?.[0]?.photos?.length || 0) ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            )}
            <div
              className="mars-modal-photo-grid"
              style={{
                maxHeight: '70vh',
                overflowY: 'auto',
                paddingRight: 8,
              }}
            >
              {modalPhotosData?.marsRoverPhotos?.[0]?.photos?.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE).map((photo: any) => (
                <div key={photo.id} style={{ background: '#181a20', borderRadius: 8, padding: 8, width: '100%', cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: fullscreenPhoto?.id === photo.id ? '0 0 0 3px #ffb347' : 'none' }}
                  onClick={() => setFullscreenPhoto(photo)}
                >
                  <img src={photo.img_src} alt={`Mars Rover ${photo.id}`} style={{ width: '100%', borderRadius: 6, maxHeight: 180, objectFit: 'cover' }} />
                  <div style={{ color: '#ffb347', fontSize: 12, marginTop: 4 }}>Camera: {photo.camera}</div>
                  <div style={{ color: '#fff', fontSize: 12 }}>Earth date: {photo.earth_date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen photo modal */}
      {fullscreenPhoto && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: '#000e',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setFullscreenPhoto(null)}
        >
          <div style={{
            background: 'rgba(0,0,0,0.95)',
            borderRadius: 0,
            padding: 0,
            maxWidth: '100vw',
            maxHeight: '100vh',
            boxShadow: 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setFullscreenPhoto(null)}
              style={{ position: 'absolute', top: 24, right: 32, background: '#ffb347', color: '#222', border: 'none', borderRadius: 8, padding: '0.7rem 1.3rem', fontWeight: 700, cursor: 'pointer', zIndex: 10, fontSize: 22 }}
            >
              Close
            </button>
            <img src={fullscreenPhoto.img_src} alt={`Mars Rover ${fullscreenPhoto.id}`} style={{
              maxWidth: '98vw',
              maxHeight: '90vh',
              borderRadius: 12,
              margin: '0 auto 24px auto',
              boxShadow: '0 2px 24px #000a',
              display: 'block',
              objectFit: 'contain',
            }} />
            <div style={{ color: '#ffb347', fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Camera: {fullscreenPhoto.camera}</div>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 8, textAlign: 'center' }}>Earth date: {fullscreenPhoto.earth_date}</div>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 8, textAlign: 'center' }}>Sol: {fullscreenPhoto.sol}</div>
            <div style={{ color: '#fff', fontSize: 18, textAlign: 'center' }}>Rover: {fullscreenPhoto.rover}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarsRoverPage; 