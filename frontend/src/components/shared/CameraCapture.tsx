import { useState, useRef } from 'react';
import { Camera, X, Upload } from 'lucide-react';

interface CameraCaptureProps {
  label: string;
  onCapture: (file: File) => void;
}

export default function CameraCapture({ label, onCapture }: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleClear = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {!preview ? (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-700 rounded-xl hover:border-kumbh-orange/50 hover:bg-gray-800/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-kumbh-orange/10 transition">
              <Camera className="w-5 h-5 text-gray-500 group-hover:text-kumbh-orange transition" />
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-300 font-medium">Take Photo or Upload</p>
              <p className="text-[10px] text-gray-600">JPEG, PNG up to 10MB</p>
            </div>
            <Upload className="w-4 h-4 text-gray-600 ml-auto" />
          </button>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-700">
          <img src={preview} alt="Preview" className="w-full h-44 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 p-1.5 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-500 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded">Photo captured</span>
        </div>
      )}
    </div>
  );
}
