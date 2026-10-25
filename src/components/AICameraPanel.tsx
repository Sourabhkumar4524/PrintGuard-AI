import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Aperture,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
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
  const [demoDefectChoice, setDemoDefectChoice] = useState<
    'Spaghetti' | 'Layer Shift' | 'Warping'
  >('Spaghetti');

  const stopWebcam = useCallback(() => {
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
        if (cameraActive) {
          stopWebcam();
        }
        setPreviewUrl(reader.result);
        setSelectedBlob(file);
        setSelectedFilename(file.name);
        setShowingAnnotated(false);
        setCameraError(null);
        addToast('Image loaded', 'info', `${file.name} ready for analysis.`);
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

  const handleAnalyzeFrame = async () => {
    let blobToAnalyze = selectedBlob;
    let currentPreview = previewUrl;

    // If webcam is live and user clicks Analyze directly, capture current frame automatically
    if (cameraActive && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        currentPreview = canvas.toDataURL('image/jpeg', 0.92);
        setPreviewUrl(currentPreview);
        blobToAnalyze = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
        );
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
        'Start the webcam and capture a frame, or upload a JPG/PNG image first.'
      );
      return;
    }

    const result = await analyzeFrameBlob(
      blobToAnalyze,
      selectedFilename,
      currentPreview,
      cameraActive
    );
    if (result) {
      setShowingAnnotated(true);
    }
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

        {/* Scrim Overlay for Processing */}
        {isAnalyzingFrame && (
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

        {/* Top-left Live / Demo Provenance Scrim */}
        {cameraActive && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded bg-black/75 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>WEBCAM LIVE</span>
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
