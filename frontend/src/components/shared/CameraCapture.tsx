import { useState, useRef, useEffect } from "react";
import { Camera, X, RotateCcw, AlertCircle } from "lucide-react";

interface CameraCaptureProps {
  label: string;
  onCapture: (file: File) => void;
}

export default function CameraCapture({
  label,
  onCapture,
}: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : "Unable to access camera. Please check permissions.",
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `photo-${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
              onCapture(file);
              setPreview(canvas.toDataURL("image/jpeg"));
              stopCamera();
            }
          },
          "image/jpeg",
          0.9,
        );
      }
    }
  };

  const handleClear = () => {
    setPreview(null);
    setError(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
      </label>

      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {!preview && !cameraActive ? (
        <div>
          <button
            type="button"
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-700 rounded-xl hover:border-kumbh-orange/50 hover:bg-gray-800/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-kumbh-orange/10 transition">
              <Camera className="w-5 h-5 text-gray-500 group-hover:text-kumbh-orange transition" />
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-300 font-medium">Take Photo</p>
              <p className="text-[10px] text-gray-600">Camera will open</p>
            </div>
          </button>
        </div>
      ) : cameraActive ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={stopCamera}
              className="px-4 py-2 bg-gray-700/80 backdrop-blur-sm text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="px-6 py-2 bg-kumbh-orange text-white rounded-lg hover:bg-kumbh-orange/90 transition text-sm font-semibold flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Capture
            </button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-700">
          <img
            src={preview!}
            alt="Preview"
            className="w-full h-44 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 p-1.5 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-500 transition flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="text-[10px] font-medium">Retake</span>
          </button>
          <span className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded">
            Photo captured
          </span>
        </div>
      )}
    </div>
  );
}
