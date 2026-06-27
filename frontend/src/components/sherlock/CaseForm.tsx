import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CameraCapture from "../shared/CameraCapture";
import GPSCapture from "../shared/GPSCapture";
import {
  MapPin,
  User,
  Search,
  UserCheck,
  Camera,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import {
  validatePhone,
  formatPhone,
  validateName,
  validateAge,
  validateHeight,
  getValidationMessage,
} from "../../utils/validation";

interface CaseFormProps {
  caseType: "lost" | "searching" | "found";
  onSuccess: () => void;
}

const caseConfig = {
  lost: {
    title: "Report Missing Person",
    icon: <Search className="w-5 h-5" />,
    color: "from-red-500 to-rose-600",
    accent: "text-red-400",
  },
  searching: {
    title: "Searching for Someone",
    icon: <Camera className="w-5 h-5" />,
    color: "from-amber-500 to-yellow-600",
    accent: "text-amber-400",
  },
  found: {
    title: "Found Unknown Person",
    icon: <UserCheck className="w-5 h-5" />,
    color: "from-blue-500 to-indigo-600",
    accent: "text-blue-400",
  },
};

export default function CaseForm({ caseType, onSuccess }: CaseFormProps) {
  useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const [reporterPhoto, setReporterPhoto] = useState<File | null>(null);
  const [personPhoto, setPersonPhoto] = useState<File | null>(null);
  const [foundPersonPhoto, setFoundPersonPhoto] = useState<File | null>(null);

  // Wrapper functions with logging
  const handleReporterPhotoCapture = (file: File) => {
    console.log("📸 Reporter photo captured:", file.name, file.size, "bytes");
    setReporterPhoto(file);
  };

  const handlePersonPhotoCapture = (file: File) => {
    console.log("📸 Person photo captured:", file.name, file.size, "bytes");
    setPersonPhoto(file);
  };

  const handleFoundPersonPhotoCapture = (file: File) => {
    console.log(
      "📸 Found person photo captured:",
      file.name,
      file.size,
      "bytes",
    );
    setFoundPersonPhoto(file);
  };

  const [formData, setFormData] = useState({
    reporter_name: "",
    reporter_phone: "",
    person_name: "",
    person_age: "",
    person_gender: "",
    person_height: "",
    person_clothing: "",
    person_physical_features: "",
    last_seen_location: "",
    found_person_description: "",
  });

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    setValidationErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const updateWithValidation = (
    field: string,
    value: string,
    validator?: (v: string) => boolean,
  ) => {
    let processedValue = value;

    if (field === "reporter_phone") {
      processedValue = formatPhone(value);
    }

    update(field, processedValue);

    if (validator && value && !validator(processedValue)) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: getValidationMessage(field),
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.reporter_name || !validateName(formData.reporter_name)) {
      errors.reporter_name = "Valid name is required (2-50 characters)";
    }

    if (!formData.reporter_phone || !validatePhone(formData.reporter_phone)) {
      errors.reporter_phone = "Valid phone number required (+91XXXXXXXXXX)";
    }

    if (
      (caseType === "lost" || caseType === "searching") &&
      formData.person_age &&
      !validateAge(formData.person_age)
    ) {
      errors.person_age = "Age must be between 0 and 120";
    }

    if (
      (caseType === "lost" || caseType === "searching") &&
      formData.person_height &&
      !validateHeight(formData.person_height)
    ) {
      errors.person_height = "Height must be between 30 and 250 cm";
    }

    if (
      (caseType === "lost" || caseType === "searching") &&
      formData.person_name &&
      !validateName(formData.person_name)
    ) {
      errors.person_name = "Valid name required (2-50 characters)";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const config = caseConfig[caseType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      setError("Please fix the validation errors before submitting");
      return;
    }

    console.log("📋 Form validation passed");
    console.log("📍 GPS Location:", gpsLocation);
    console.log("📸 Reporter Photo:", reporterPhoto);
    console.log("📸 Person Photo:", personPhoto);
    console.log("📸 Found Person Photo:", foundPersonPhoto);

    if (!gpsLocation) {
      setError("📍 Please enable GPS location to submit");
      return;
    }
    if (!reporterPhoto) {
      console.error("❌ Reporter photo missing");
      setError("📸 Your photo is required for verification");
      return;
    }
    if (caseType === "lost" && !personPhoto) {
      console.error("❌ Person photo missing for lost case");
      setError("📸 Photo of the missing person is required");
      return;
    }
    if (caseType === "found" && !foundPersonPhoto) {
      console.error("❌ Found person photo missing");
      setError("📸 Photo of the found person is required");
      return;
    }

    console.log("✅ All validations passed, submitting form...");
    setLoading(true);

    try {
      console.log("🔧 Creating FormData...");
      const fd = new FormData();
      fd.append("case_type", caseType);
      fd.append("reporter_name", formData.reporter_name);
      fd.append("reporter_phone", formData.reporter_phone);
      fd.append("gps_lat", gpsLocation.lat.toString());
      fd.append("gps_lng", gpsLocation.lng.toString());
      fd.append("reporter_photo", reporterPhoto);
      console.log(
        "📸 Reporter photo appended to FormData:",
        reporterPhoto.name,
        reporterPhoto.size,
      );

      if (caseType === "lost" || caseType === "searching") {
        fd.append("person_name", formData.person_name);
        fd.append("person_age", formData.person_age);
        fd.append("person_gender", formData.person_gender);
        fd.append("person_height", formData.person_height);
        fd.append("person_clothing", formData.person_clothing);
        fd.append(
          "person_physical_features",
          formData.person_physical_features,
        );
        fd.append("last_seen_location", formData.last_seen_location);
        if (personPhoto) fd.append("person_photo", personPhoto);
      }

      if (caseType === "found") {
        fd.append(
          "found_person_description",
          formData.found_person_description,
        );
        if (foundPersonPhoto) {
          fd.append("found_person_photo", foundPersonPhoto);
          console.log(
            "📸 Found person photo appended to FormData:",
            foundPersonPhoto.name,
            foundPersonPhoto.size,
          );
        }
      }
      // Use offline-aware fetch
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: fd,
      });

      const result = await response.json();

      if (response.status === 202 && result.cached) {
        // Request was cached offline
        setSuccess(true);
        setError("📴 Offline mode: Request cached and will sync when online");
        setTimeout(() => onSuccess(), 3000);
      } else if (response.ok) {
        // Request successful
        setSuccess(true);
        setTimeout(() => onSuccess(), 2000);
      } else {
        throw new Error(result.error || "Failed to submit case");
      }
    } catch (err: any) {
      console.error("❌ Submission error:", err);
      // Handle different error types
      if (err.message === "Failed to fetch") {
        setError(
          "🔌 Cannot connect to server. Please ensure the backend is running.",
        );
      } else {
        setError(err.message || "Failed to submit case");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Case Submitted Successfully
        </h2>
        <p className="text-sm text-gray-400">
          The case is now being matched against all centers. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-white shadow`}
        >
          {config.icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{config.title}</h2>
          <p className="text-xs text-gray-500">
            All fields help improve cross-center matching accuracy
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* GPS */}
        <Section
          icon={<MapPin className="w-4 h-4" />}
          title="Location"
          accent={config.accent}
        >
          <GPSCapture onLocationCapture={setGpsLocation} />
        </Section>

        {/* Reporter */}
        <Section
          icon={<User className="w-4 h-4" />}
          title="Your Information"
          accent={config.accent}
        >
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <Input
                placeholder="Your Name"
                value={formData.reporter_name}
                onChange={(v) =>
                  updateWithValidation("reporter_name", v, validateName)
                }
                required
              />
              {validationErrors.reporter_name && (
                <p className="text-xs text-red-400 mt-1">
                  {validationErrors.reporter_name}
                </p>
              )}
            </div>
            <div>
              <Input
                placeholder="Your Phone (+91...)"
                value={formData.reporter_phone}
                onChange={(v) =>
                  updateWithValidation("reporter_phone", v, validatePhone)
                }
                type="tel"
                required
              />
              {validationErrors.reporter_phone && (
                <p className="text-xs text-red-400 mt-1">
                  {validationErrors.reporter_phone}
                </p>
              )}
              {formData.reporter_phone &&
                validatePhone(formData.reporter_phone) && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <span>✓</span> Valid phone number
                  </p>
                )}
            </div>
          </div>
          <CameraCapture
            label="Your Photo"
            onCapture={handleReporterPhotoCapture}
          />
        </Section>

        {/* Person Details */}
        {(caseType === "lost" || caseType === "searching") && (
          <Section
            icon={<Search className="w-4 h-4" />}
            title="Missing Person Details"
            accent={config.accent}
          >
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <Input
                  placeholder="Person Name (if known)"
                  value={formData.person_name}
                  onChange={(v) =>
                    updateWithValidation("person_name", v, validateName)
                  }
                />
                {validationErrors.person_name && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.person_name}
                  </p>
                )}
              </div>
              <div>
                <Input
                  placeholder="Age (0-120)"
                  value={formData.person_age}
                  onChange={(v) =>
                    updateWithValidation("person_age", v, validateAge)
                  }
                  type="number"
                />
                {validationErrors.person_age && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.person_age}
                  </p>
                )}
              </div>
              <select
                value={formData.person_gender}
                onChange={(e) => update("person_gender", e.target.value)}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-kumbh-orange/50 focus:border-kumbh-orange outline-none"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <div>
                <Input
                  placeholder="Height in cm (30-250)"
                  value={formData.person_height}
                  onChange={(v) =>
                    updateWithValidation("person_height", v, validateHeight)
                  }
                  type="number"
                />
                {validationErrors.person_height && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.person_height}
                  </p>
                )}
              </div>
            </div>
            <TextArea
              placeholder="Clothing description (color, type — e.g. white dhoti, red dupatta)"
              value={formData.person_clothing}
              onChange={(v) => update("person_clothing", v)}
              maxLength={500}
            />
            <TextArea
              placeholder="Physical features (birthmarks, glasses, limp, etc.)"
              value={formData.person_physical_features}
              onChange={(v) => update("person_physical_features", v)}
              maxLength={500}
            />
            <Input
              placeholder="Last seen location (e.g. near Ramkund ghat)"
              value={formData.last_seen_location}
              onChange={(v) => update("last_seen_location", v)}
            />
            {caseType === "lost" && (
              <div className="mt-3">
                <CameraCapture
                  label="Lost Person Photo"
                  onCapture={handlePersonPhotoCapture}
                />
              </div>
            )}
          </Section>
        )}

        {/* Found Person */}
        {caseType === "found" && (
          <Section
            icon={<UserCheck className="w-4 h-4" />}
            title="Found Person Details"
            accent={config.accent}
          >
            <div>
              <TextArea
                placeholder="Describe the found person (approximate age, gender, clothing, condition, language spoken...)"
                value={formData.found_person_description}
                onChange={(v) => update("found_person_description", v)}
                rows={4}
                required
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 -mt-2 mb-2">
                {formData.found_person_description.length}/1000 characters
              </p>
            </div>
            <div className="mt-3">
              <CameraCapture
                label="Found Person Photo"
                onCapture={handleFoundPersonPhotoCapture}
              />
            </div>
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">
                <strong>Auto P1 Alert:</strong> This case will be immediately
                escalated to police for urgent response.
              </p>
            </div>
          </Section>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !gpsLocation}
          className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r ${config.color} hover:shadow-lg active:scale-[0.98]`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Submit Report"
          )}
        </button>
      </form>
    </div>
  );
}

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-800 rounded-xl p-4">
      <h3
        className={`text-xs font-bold uppercase tracking-wider ${accent} flex items-center gap-2 mb-3`}
      >
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-kumbh-orange/50 focus:border-kumbh-orange outline-none transition"
      required={required}
    />
  );
}

function TextArea({
  placeholder,
  value,
  onChange,
  rows = 2,
  required = false,
  maxLength,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="mb-3">
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-kumbh-orange/50 focus:border-kumbh-orange outline-none transition"
        rows={rows}
        required={required}
        maxLength={maxLength}
      />
      {maxLength && (
        <p className="text-xs text-gray-500 mt-1">
          {value.length}/{maxLength} characters
        </p>
      )}
    </div>
  );
}
