import { useState, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceInputProps {
  caseType: "lost" | "searching" | "found";
  onFieldsExtracted: (fields: Record<string, string>) => void;
}

// Extend window for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

export default function VoiceInput({
  caseType,
  onFieldsExtracted,
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const recognitionRef = useRef<any>(null);

  const startRecording = () => {
    setError("");
    setTranscript("");
    setStatusMsg("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN"; // Indian English, also picks up Hindi
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow mic access.");
      } else if (event.error === "no-speech") {
        setError("No speech detected. Please try again.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
    setStatusMsg("🎙️ Listening... Speak now");
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    // Wait a moment for final transcript
    setTimeout(() => {
      processTranscript();
    }, 500);
  };

  const processTranscript = async () => {
    const text = transcript.trim();
    if (!text) {
      setError("No speech was captured. Please try again.");
      return;
    }

    setIsProcessing(true);
    setStatusMsg("🤖 Extracting form fields with AI...");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/cases/parse-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript: text, caseType }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse voice input");
      }

      const data = await response.json();
      if (data.fields && Object.keys(data.fields).length > 0) {
        onFieldsExtracted(data.fields);
        setStatusMsg(
          `✅ Filled ${Object.keys(data.fields).length} field(s) from voice`,
        );
      } else {
        setStatusMsg("No relevant fields could be extracted. Try again.");
      }
    } catch (err: any) {
      console.error("Voice parse error:", err);
      setError(err.message || "Failed to process voice input");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border border-dashed border-indigo-500/40 rounded-xl p-4 bg-indigo-500/5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
          <Mic className="w-4 h-4" /> Voice Fill
        </h4>
        <span className="text-[10px] text-gray-500">
          Speak to auto-fill the form
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            isRecording
              ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
              : isProcessing
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="w-4 h-4" /> Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" /> Start Speaking
            </>
          )}
        </button>

        {statusMsg && !error && (
          <p className="text-xs text-indigo-300">{statusMsg}</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {transcript && (
        <div className="mt-3 p-3 bg-gray-800/60 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase mb-1">
            Transcript
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">{transcript}</p>
        </div>
      )}
    </div>
  );
}
