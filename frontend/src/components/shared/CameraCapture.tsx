import { useState, useRef, useEffect } from "react";
import { Camera, X, AlertCircle, Check } from "lucide-react";

interface CameraCaptureProps {
  label: string;
  onCapture: (file: File) => void;
}

export default function CameraCapture({
  label,
  onCapture,
}: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      let stream: MediaStream | null = null;
      
      // Try back camera first (for mobile)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (backCameraError) {
        console.log("Back camera not available, trying front camera or default");
        // Fallback to any available camera (for desktop)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : err.name === "NotFoundError"
          ? "No camera found. Please connect a camera to use this feature."
          : "Unable to access camera. Please check permissions and try again.",
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
              // Store the file and preview, but don't upload yet
              setCapturedFile(file);
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

  const handleConfirm = () => {
    if (capturedFile) {
      setIsUploading(true);
      try {
        // Pass the file to parent component
        onCapture(capturedFile);
        // Clear the captured file to show success state
        setCapturedFile(null);
        setIsUploading(false);
      } catch (error) {
        console.error("Error passing file:", error);
        setError("Failed to process photo. Please try again.");
        setIsUploading(false);
      }
    }
  };

  const handleRetry = () => {
    setPreview(null);
    setCapturedFile(null);
    setError(null);
    startCamera();
  };

  const handleClear = () => {
    setPreview(null);
    setCapturedFile(null);
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
        <div className="mb-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 font-medium">{error}</p>
          </div>
          {error.includes("permission") && (
            <div className="ml-6 mt-2 text-xs text-gray-400 space-y-1">
              <p className="font-semibold text-gray-300">How to enable camera:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Click the camera/lock icon in the address bar</li>
                <li>Allow camera access for this site</li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>
          )}
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
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-700">
            <img
              src={preview!}
              alt="Preview"
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute top-2 left-2 text-xs text-white/90 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg font-medium">
              {isUploading ? "Processing..." : capturedFile ? "Photo Ready" : "Photo Captured"}
            </span>
          </div>

          {/* Confirm/Retry Buttons */}
          {capturedFile && !isUploading && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border-2 border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/20 hover:border-red-500 transition-all font-medium group"
                title="Retake photo"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500/10 border-2 border-green-500/50 text-green-400 rounded-xl hover:bg-green-500/20 hover:border-green-500 transition-all font-medium group"
                title="Confirm and use photo"
              >
                <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Confirm</span>
              </button>
            </div>
          )}

          {/* Upload Success State */}
          {!capturedFile && preview && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-green-400 font-medium">Photo confirmed successfully</span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 hover:bg-green-500/10 rounded-lg transition"
                title="Clear and take new photo"
              >
                <X className="w-4 h-4 text-green-400" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isUploading && (
            <div className="flex items-center justify-center gap-2 p-3 bg-kumbh-orange/10 border border-kumbh-orange/30 rounded-xl">
              <div className="w-4 h-4 border-2 border-kumbh-orange border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-kumbh-orange font-medium">Processing photo...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
