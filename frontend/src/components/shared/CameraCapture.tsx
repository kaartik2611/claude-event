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
      console.log("🎥 Starting camera...");
      console.log("📱 User Agent:", navigator.userAgent);
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("❌ getUserMedia not supported");
        throw new Error("Camera not supported on this device/browser");
      }

      console.log("✅ getUserMedia is supported");
      let stream: MediaStream | null = null;

      // Try back camera first (for mobile) with mobile-friendly constraints
      try {
        console.log("📱 Attempting to access back camera (mobile)...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
          audio: false,
        });
        console.log("✅ Back camera accessed successfully");
      } catch (backCameraError) {
        console.log("⚠️ Back camera not available, trying any camera...", backCameraError);
        // Fallback to any available camera (for desktop or if back camera fails)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
            },
            audio: false,
          });
          console.log("✅ Front/default camera accessed successfully");
        } catch (fallbackError) {
          console.log("⚠️ Trying with minimal constraints...");
          // Last resort - minimal constraints for older devices
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            console.log("✅ Camera accessed with basic constraints");
          } catch (minimalError) {
            console.error("❌ All camera access attempts failed:", minimalError);
            throw minimalError; // Re-throw to be caught by outer catch
          }
        }
      }

      if (!stream) {
        console.error("❌ No camera stream obtained");
        throw new Error("Failed to obtain camera stream. Please ensure camera permissions are granted.");
      }

      console.log("📹 Camera stream obtained successfully");
      // Store stream and activate camera view (which will render the video element)
      streamRef.current = stream;
      setCameraActive(true);
      
    } catch (err: any) {
      console.error("❌ Camera error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : err.name === "NotFoundError"
            ? "No camera found on this device."
            : `Camera error: ${err.message || 'Unknown error'}. Please try again.`
      );
    }
  };

  // Effect to attach stream to video element once it's rendered
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      console.log("🎬 Video element now available, attaching stream");
      videoRef.current.srcObject = streamRef.current;
      
      console.log("⏳ Waiting for video metadata to load...");
      
      // Wait for video to be ready (important for mobile)
      videoRef.current.onloadedmetadata = () => {
        console.log("📹 Video metadata loaded");
        videoRef.current?.play().then(() => {
          console.log("▶️ Video playing successfully");
        }).catch(err => {
          console.error("❌ Error playing video:", err);
          setError("Failed to start video preview. Please try again.");
        });
      };
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      console.error("❌ Video or canvas ref not available");
      setError("Camera not initialized. Please try again.");
      return;
    }

    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight) {
      console.error("❌ Video not ready");
      setError("Camera not ready. Please wait a moment and try again.");
      return;
    }
      
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log("📹 Capturing photo:", video.videoWidth, "x", video.videoHeight);

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (ctx) {
      // Draw image to canvas
      ctx.drawImage(video, 0, 0);

      // Mobile-optimized compression
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const quality = isMobile ? 0.7 : 0.85; // More aggressive compression on mobile
      
      console.log(`📱 Device type: ${isMobile ? 'Mobile' : 'Desktop'}, quality: ${quality}`);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("✅ Blob created:", blob.size, "bytes", `(${(blob.size / 1024).toFixed(1)} KB)`);
            
            // Warn if file is very large (might fail on mobile)
            if (blob.size > 5 * 1024 * 1024) { // 5MB
              console.warn("⚠️ Large file size detected:", blob.size, "bytes");
            }
            
            const file = new File([blob], `photo-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            console.log("📁 File created:", file.name, file.size, "bytes");
            
            // Store the file and preview
            setCapturedFile(file);
            
            try {
              const dataUrl = canvas.toDataURL("image/jpeg", quality);
              setPreview(dataUrl);
              console.log("🖼️ Preview set, length:", dataUrl.length, "chars");
              stopCamera();
            } catch (e) {
              console.error("❌ Error creating preview:", e);
              // Still set the file even if preview fails
              setPreview(URL.createObjectURL(blob));
              stopCamera();
            }
          } else {
            console.error("❌ Failed to create blob from canvas");
            setError("Failed to capture photo. Please try again.");
          }
        },
        "image/jpeg",
        quality
      );
    } else {
      console.error("❌ Failed to get canvas context");
      setError("Failed to initialize photo capture. Please try again.");
    }
  };

  const handleConfirm = () => {
    if (capturedFile) {
      console.log("📸 Confirming photo upload:", capturedFile);
      setIsUploading(true);
      setError(null);
      
      try {
        // Pass the file to parent component BEFORE clearing state
        onCapture(capturedFile);
        console.log("✅ Photo passed to parent successfully");
        
        // Use setTimeout to ensure state updates after onCapture completes
        setTimeout(() => {
          setCapturedFile(null);
          setIsUploading(false);
        }, 100);
      } catch (error) {
        console.error("❌ Error passing file:", error);
        setError("Failed to process photo. Please try again.");
        setIsUploading(false);
      }
    } else {
      console.warn("⚠️ No captured file to confirm");
      setError("No photo captured. Please take a photo first.");
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

  // File input fallback for devices where camera doesn't work
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      console.log("📁 File selected from input:", file.name, file.size, "bytes");
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
        setCapturedFile(file);
        console.log("🖼️ Preview created from file input");
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please select a valid image file");
    }
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
              <p className="font-semibold text-gray-300">
                How to enable camera:
              </p>
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
        <div className="space-y-2">
          <button
            type="button"
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-700 rounded-xl hover:border-kumbh-orange/50 hover:bg-gray-800/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-kumbh-orange/10 transition">
              <Camera className="w-5 h-5 text-gray-500 group-hover:text-kumbh-orange transition" />
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-300 font-medium">📸 Take Photo</p>
              <p className="text-[10px] text-gray-600">Click to open camera</p>
            </div>
          </button>
          
          {/* File upload fallback */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id={`file-input-${label.replace(/\s+/g, '-')}`}
            />
            <label
              htmlFor={`file-input-${label.replace(/\s+/g, '-')}`}
              className="block w-full text-center px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition cursor-pointer"
            >
              <p className="text-xs text-gray-400">Or choose from gallery</p>
            </label>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            💡 Ensure good lighting and clear image for better matching
          </p>
        </div>
      ) : cameraActive ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
            style={{ transform: 'scaleX(1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/60 to-transparent">
            <p className="text-xs text-white/90 text-center font-medium">
              📷 Position the subject in frame and click Capture
            </p>
          </div>
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
              {isUploading
                ? "Processing..."
                : capturedFile
                  ? "Photo Ready"
                  : "Photo Captured"}
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
                <span className="text-sm text-green-400 font-medium">
                  Photo confirmed successfully
                </span>
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
              <span className="text-sm text-kumbh-orange font-medium">
                Processing photo...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
