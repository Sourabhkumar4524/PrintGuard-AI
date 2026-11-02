import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Aperture,
  Camera,
  CameraOff,
  CheckCircle2,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
  Radio,
  ScanSearch,
  Upload,
} from 'lucide-react';
import { usePrintGuard } from '../context/PrintGuardContext';
import { DEMO_SAMPLE_IMAGES } from '../utils/demoEngine';
import { StatusBadge } from './StatusBadge';

interface AICameraPanelProps {
  expanded?: boolean;
}

export const AICameraPanel: React.FC<AICameraPanelProps> = ({
  expanded = false,
}) => {
  const {
    settings,
    visionStatus,
    latestVision,
    isAnalyzingFrame,
    analyzeFrameBlob,
    simulateDemoDefect,
    addToast,
  } = usePrintGuard();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string>('frame.jpg');
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    settings.demoMode ? DEMO_SAMPLE_IMAGES.normal : null
  );
  const [showingAnnotated, setShowingAnnotated] = useState(true);
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [demoDefectChoice, setDemoDefectChoice] = useState<
    'Spaghetti' | 'Layer Shift' | 'Warping'
  >('Spaghetti');

  const isAnalyzingRef = useRef(isAnalyzingFrame);
  isAnalyzingRef.current = isAnalyzingFrame;

  const stopWebcam = useCallback(() => {
    setAutoScanActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Ensure tracks are always released when component unmounts or page closes
  useEffect(() => {
    const handleUnload = () => stopWebcam();
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      stopWebcam();
    };
  }, [stopWebcam]);

  const startWebcam = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Browser MediaDevices API is not supported in this environment. Use Upload Image instead.'
      );
      return;
    }

    setStartingCamera(true);
    setCameraError(null);

    try {
      stopWebcam();
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraActive(true);

      // Enumerate available video inputs after permission is granted
      try {
        const allDevs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevs.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
      } catch {
        // Ignore device enumeration failure
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError(
          'Webcam permission was denied. Allow camera access in your browser address bar, or upload a JPG/PNG image.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError(
          'No webcam detected on this device. Connect a USB camera or use Upload Image.'
        );
      } else {
        setCameraError(
          err instanceof Error
            ? `Unable to access camera: ${err.message}`
            : 'Camera unavailable. Use Upload Image instead.'
        );
      }
      stopWebcam();
    } finally {
      setStartingCamera(false);
    }
  }, [selectedDeviceId, stopWebcam]);

  // Attach stream whenever video element mounts while cameraActive
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraActive) {
      addToast('Start webcam first to capture a live frame', 'warning');
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(dataUrl);
    setShowingAnnotated(false);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const fname = `webcam_${Date.now()}.jpg`;
          setSelectedBlob(blob);
          setSelectedFilename(fname);
          addToast('Frame captured from webcam', 'success', 'Click Analyze Frame to inspect.');
        }
      },
      'image/jpeg',
      0.92
    );
  }, [addToast, cameraActive]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMime = ['image/jpeg', 'image/jpg', 'image/png'];
    const lowerName = file.name.toLowerCase();
    const validExt =
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png');

    if (!validMime.includes(file.type) && !validExt) {
      addToast(
        'Unsupported image format',
        'error',
        'Please select a JPG, JPEG, or PNG image.'
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const rawDataUrl = reader.result;
        if (cameraActive) {
          stopWebcam();
        }

        // Downscale high-resolution images to max 1024px JPEG for fast upload & inference
        const img = new Image();
        img.onload = () => {
          const maxDim = 1024;
          let targetW = img.naturalWidth || 800;
          let targetH = img.naturalHeight || 600;
          if (targetW > maxDim || targetH > maxDim) {
            const scale = Math.min(maxDim / targetW, maxDim / targetH);
            targetW = Math.round(targetW * scale);
            targetH = Math.round(targetH * scale);
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setPreviewUrl(rawDataUrl);
            setSelectedBlob(file);
            setSelectedFilename(file.name);
            setShowingAnnotated(false);
            setCameraError(null);
            addToast('Image loaded', 'info', `${file.name} ready for analysis.`);
            return;
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
          setPreviewUrl(optimizedDataUrl);
          setShowingAnnotated(false);
          setCameraError(null);

          canvas.toBlob(
            (compressedBlob) => {
              const outName = file.name.replace(/\.(png|jpeg|jpg)$/i, '') + '.jpg';
              setSelectedBlob(compressedBlob || file);
              setSelectedFilename(outName);
              addToast(
                'Image optimized & loaded',
                'info',
                `${outName} ready for fast AI inspection.`
              );
            },
            'image/jpeg',
            0.84
          );
        };
        img.onerror = () => {
          setPreviewUrl(rawDataUrl);
          setSelectedBlob(file);
          setSelectedFilename(file.name);
          setShowingAnnotated(false);
          setCameraError(null);
          addToast('Image loaded', 'info', `${file.name} ready for analysis.`);
        };
        img.src = rawDataUrl;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const loadSampleImageIntoBlob = useCallback(
    async (sampleType: 'normal' | 'defect') => {
      const sampleSrc =
        sampleType === 'normal'
          ? DEMO_SAMPLE_IMAGES.normal
          : DEMO_SAMPLE_IMAGES.defect;
      try {
        if (cameraActive) stopWebcam();
        const res = await fetch(sampleSrc);
        const blob = await res.blob();
        setPreviewUrl(sampleSrc);
        setSelectedBlob(blob);
        setSelectedFilename(`sample_${sampleType}_print.jpg`);
        setShowingAnnotated(false);
        setCameraError(null);
      } catch {
        setPreviewUrl(sampleSrc);
      }
    },
    [cameraActive, stopWebcam]
  );

  const captureLiveVideoBlob = useCallback(async (): Promise<{
    blob: Blob | null;
    dataUrl: string | null;
  }> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      return { blob: null, dataUrl: null };
    }
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const maxDim = 960;
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const width = Math.max(320, Math.round(rawW * scale));
    const height = Math.max(240, Math.round(rawH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: null, dataUrl: null };

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82)
    );
    return { blob, dataUrl };
  }, []);

  const handleAnalyzeFrame = useCallback(async () => {
    if (isAnalyzingRef.current) return;

    let blobToAnalyze = selectedBlob;
    let currentPreview = previewUrl;
    let fname = selectedFilename;

    // If webcam is live, grab an optimized live frame directly from the video stream
    if (cameraActive && videoRef.current) {
      const captured = await captureLiveVideoBlob();
      if (captured.blob && captured.dataUrl) {
        blobToAnalyze = captured.blob;
        currentPreview = captured.dataUrl;
        fname = `webcam_live_${Date.now()}.jpg`;
        setPreviewUrl(captured.dataUrl);
      }
    } else if (!blobToAnalyze && currentPreview) {
      try {
        const res = await fetch(currentPreview);
        blobToAnalyze = await res.blob();
      } catch {
        blobToAnalyze = null;
      }
    }

    if (!blobToAnalyze || !currentPreview) {
      addToast(
        'No image selected',
        'warning',
        'Start the webcam or upload a JPG/PNG image first.'
      );
      return;
    }

    const result = await analyzeFrameBlob(
      blobToAnalyze,
      fname,
      currentPreview,
      cameraActive
    );
    if (result) {
      setShowingAnnotated(true);
    }
  }, [
    addToast,
    analyzeFrameBlob,
    cameraActive,
    captureLiveVideoBlob,
    previewUrl,
    selectedBlob,
    selectedFilename,
  ]);

  // Continuous Real-Time Webcam Auto-Scan Loop
  useEffect(() => {
    if (!cameraActive || !autoScanActive) return;

    const intervalMs = Math.max(5, settings.cameraIntervalSec || 5) * 1000;

    // Trigger initial scan 1.2s after webcam stream stabilizes
    const initialTimer = window.setTimeout(() => {
      if (!isAnalyzingRef.current) {
        void handleAnalyzeFrame();
      }
    }, 1200);

    const loopTimer = window.setInterval(() => {
      if (!isAnalyzingRef.current) {
        void handleAnalyzeFrame();
      }
    }, intervalMs);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(loopTimer);
    };
  }, [autoScanActive, cameraActive, handleAnalyzeFrame, settings.cameraIntervalSec]);

  const handleToggleAutoScan = async () => {
    if (autoScanActive) {
      setAutoScanActive(false);
      addToast('Live Auto-Scan paused', 'info', 'Manual Analyze Frame mode active.');
      return;
    }

    if (!cameraActive) {
      await startWebcam();
    }
    setAutoScanActive(true);
    addToast(
      'Real-Time Webcam Auto-Scan ON',
      'success',
      `Automatically inspecting live webcam frames every ${Math.max(
        5,
        settings.cameraIntervalSec || 5
      )}s.`
    );
  };

  const handleSimulateDefect = async () => {
    if (cameraActive) stopWebcam();
    const res = await simulateDemoDefect(demoDefectChoice, previewUrl);
    if (res) {
      setShowingAnnotated(true);
      if (res.annotatedImageUrl) {
        setPreviewUrl(res.annotatedImageUrl);
      }
    }
  };

  const displayedImageUrl =
    showingAnnotated && latestVision?.annotatedImageUrl
      ? latestVision.annotatedImageUrl
      : previewUrl;

  return (
    <section className="rounded-lg bg-[#0D1526] border border-slate-800/90 p-4 flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-slate-100">
              AI CAMERA
            </h3>
            {visionStatus.online && visionStatus.modelLoaded ? (
              <StatusBadge
                label={visionStatus.modelName || 'MODEL READY'}
                tone="normal"
              />
            ) : (
              <StatusBadge label="NO LIVE MODEL" tone="neutral" />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Laptop webcam / image input (JPG, JPEG, PNG)
          </p>
        </div>

        {expanded && devices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            aria-label="Select camera device"
            className="px-2.5 py-1.5 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
          >
            {devices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                {dev.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Viewport */}
      <div
        className={`relative w-full rounded-lg bg-[#060A13] border border-slate-800 overflow-hidden flex items-center justify-center ${
          expanded ? 'aspect-video min-h-[300px] max-h-[500px]' : 'aspect-video min-h-[210px]'
        }`}
      >
        {cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
          />
        ) : displayedImageUrl ? (
          <img
            src={displayedImageUrl}
            alt="Selected 3D printer inspection frame"
            referrerPolicy="no-referrer"
            onError={() => setPreviewUrl(null)}
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6">
            <CameraOff
              className="w-8 h-8 text-slate-600 mb-2"
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-slate-300">
              No active camera feed or image loaded
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              Click Start Webcam to stream from your browser camera, or upload a print photo (JPG/PNG) for inspection.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Upload Image</span>
            </button>
          </div>
        )}

        {/* Scrim Overlay for Static Image Processing (non-blocking badge used when live webcam is streaming) */}
        {isAnalyzingFrame && !cameraActive && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 z-10">
            <Loader2
              className="w-6 h-6 text-cyan-400 animate-spin"
              aria-hidden="true"
            />
            <span className="text-xs font-mono text-slate-100">
              Analyzing print frame...
            </span>
          </div>
        )}

        {/* Live Webcam Bounding Box Overlay */}
        {cameraActive &&
          latestVision &&
          !latestVision.isSimulated &&
          latestVision.isDefect &&
          latestVision.boxes &&
          latestVision.boxes.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {latestVision.boxes.map((box, idx) => {
                const bx = Math.max(0, Math.min(96, box.x * 100));
                const by = Math.max(0, Math.min(96, box.y * 100));
                const bw = Math.max(4, Math.min(100 - bx, box.width * 100));
                const bh = Math.max(4, Math.min(100 - by, box.height * 100));
                return (
                  <rect
                    key={`${box.label}-${idx}`}
                    x={bx}
                    y={by}
                    width={bw}
                    height={bh}
                    fill="rgba(244, 63, 94, 0.14)"
                    stroke="#F43F5E"
                    strokeWidth="0.6"
                  />
                );
              })}
            </svg>
          )}

        {/* Top-left Live Webcam & Auto-Scan Status Badges */}
        {cameraActive && (
          <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/80 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                <span>WEBCAM LIVE</span>
              </div>
              {autoScanActive && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-950/90 border border-cyan-500/50 text-[11px] font-mono text-cyan-200">
                  <Radio className="w-3 h-3 text-cyan-400 animate-pulse" aria-hidden="true" />
                  <span>
                    AUTO-SCAN ({Math.max(5, settings.cameraIntervalSec || 5)}s)
                  </span>
                </div>
              )}
            </div>

            {isAnalyzingFrame && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/85 border border-cyan-500/40 text-[11px] font-mono text-cyan-300">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                <span>AI SCANNING...</span>
              </div>
            )}
          </div>
        )}

        {/* Live Webcam Real-Time AI Verdict HUD */}
        {cameraActive && latestVision && !latestVision.isSimulated && (
          <div
            className={`absolute bottom-0 inset-x-0 px-3 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs z-20 ${
              latestVision.isDefect
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-emerald-950/85 border-emerald-500/40 text-emerald-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {latestVision.isDefect ? (
                <AlertTriangle
                  className="w-4 h-4 text-rose-400 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="w-4 h-4 text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono font-bold uppercase tracking-wide shrink-0">
                {latestVision.isDefect
                  ? `DEFECT: ${latestVision.detectedClass}`
                  : `NORMAL PRINT`}
              </span>
              {latestVision.confidence !== null && (
                <span className="font-mono text-[11px] tabular-nums opacity-90 shrink-0">
                  ({latestVision.confidence.toFixed(1)}%)
                </span>
              )}
              <span className="text-[11px] text-slate-200 truncate hidden sm:inline">
                — {latestVision.explanation}
              </span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-slate-300 shrink-0">
              {latestVision.latencyMs ? `${latestVision.latencyMs}ms · ` : ''}
              {new Date(latestVision.timestamp).toLocaleTimeString([], {
                hour12: false,
              })}
            </span>
          </div>
        )}

        {!cameraActive && displayedImageUrl && latestVision && showingAnnotated && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {latestVision.isSimulated ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 font-semibold">
                  <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                  DEMO SIMULATION: {latestVision.detectedClass}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-100 font-semibold">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      latestVision.isDefect ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                    aria-hidden="true"
                  />
                  {latestVision.detectedClass}
                </span>
              )}
              {latestVision.confidence !== null && (
                <span className="font-mono text-[11px] tabular-nums text-slate-300">
                  · {latestVision.confidence.toFixed(1)}%
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              {new Date(latestVision.timestamp).toLocaleTimeString([], {
                hour12: false,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Camera Permission / Device Error Banner */}
      {cameraError && (
        <div
          role="alert"
          className="mt-2.5 flex items-start gap-2 rounded-md bg-rose-950/30 border border-rose-500/40 px-3 py-2 text-xs text-rose-200"
        >
          <AlertCircle
            className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Primary Camera & File Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={handleFileUpload}
          className="hidden"
        />

        {!cameraActive ? (
          <button
            type="button"
            onClick={() => void startWebcam()}
            disabled={startingCamera}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>{startingCamera ? 'Starting...' : 'Start Webcam'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopWebcam}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-500/40 transition-colors whitespace-nowrap shrink-0"
          >
            <CameraOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Stop Webcam</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleToggleAutoScan()}
          disabled={startingCamera}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 ${
            autoScanActive
              ? 'bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-200 border-emerald-500/50'
              : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/30'
          }`}
        >
          <Radio
            className={`w-3.5 h-3.5 shrink-0 ${
              autoScanActive ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'
            }`}
            aria-hidden="true"
          />
          <span>{autoScanActive ? 'Auto-Scan: ON' : 'Auto-Scan Live'}</span>
        </button>

        <button
          type="button"
          onClick={captureFrame}
          disabled={!cameraActive}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Aperture className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
          <span>Capture Frame</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span>Upload Image</span>
        </button>

        <button
          type="button"
          onClick={() => void handleAnalyzeFrame()}
          disabled={isAnalyzingFrame}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ml-auto"
        >
          <ScanSearch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Analyze Frame</span>
        </button>
      </div>

      {/* Demo-Mode-Only Controls (strictly hidden when Demo Mode is off) */}
      {settings.demoMode && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300">
              <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />
              DEMO CONTROLS:
            </span>
            <button
              type="button"
              onClick={() => void loadSampleImageIntoBlob('normal')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              Sample Normal Bed
            </button>
            <button
              type="button"
              onClick={() => void loadSampleImageIntoBlob('defect')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-3 h-3 text-rose-400" aria-hidden="true" />
              Sample Spaghetti Bed
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={demoDefectChoice}
              onChange={(e) =>
                setDemoDefectChoice(
                  e.target.value as 'Spaghetti' | 'Layer Shift' | 'Warping'
                )
              }
              aria-label="Simulated defect class"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-900 border border-amber-500/30 text-amber-200"
            >
              <option value="Spaghetti">Spaghetti</option>
              <option value="Layer Shift">Layer Shift</option>
              <option value="Warping">Warping</option>
            </select>
            <button
              type="button"
              onClick={() => void handleSimulateDefect()}
              disabled={isAnalyzingFrame}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 transition-colors whitespace-nowrap shrink-0"
            >
              <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Simulate Defect (Demo)</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
