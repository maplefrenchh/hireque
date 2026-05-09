"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  ShieldCheck,
  Square,
  Video,
} from "lucide-react";

type Sender = "interviewer" | "customer" | "candidate";

type Message = {
  sender: Sender;
  text: string;
  followUp?: boolean;
  phase?: string;
  topic?: string;
};

type CandidateInfo = {
  name: string;
  email: string;
};

type InterviewStep = "info" | "permissions" | "ready" | "live" | "complete";

type NextInterviewResponse = {
  phase?: string;
  sender?: Sender;
  topic?: string;
  text?: string;
  complete?: boolean;
  terminated?: boolean;
  followUp?: boolean;
  reason?: string;
  error?: string;
};

type ScoreResult = {
  score?: number;
  verdict?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  redFlags?: string[];
  dimensionScores?: Record<string, number>;
};

const MIN_RECORDING_MS = 2500;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function safeTrim(value: string, max = 3000) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export default function InterviewClient() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const role = searchParams.get("role") || "sales";
  const level = searchParams.get("level") || "rep";
  const experience = searchParams.get("experience") || "newcomer";
  const seed = searchParams.get("seed") || "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const interviewStartedAtRef = useRef<number>(0);
  const isStoppingRef = useRef(false);

  const [step, setStep] = useState<InterviewStep>("info");

  const [candidate, setCandidate] = useState<CandidateInfo>({
    name: "",
    email: "",
  });

  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>("not_started");
  const [currentTopic, setCurrentTopic] = useState<string>("not_started");
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [lastFollowUp, setLastFollowUp] = useState(false);
  const [systemNotice, setSystemNotice] = useState<string>("");

  const roleLabel = role === "support" ? "Customer Service" : "Sales";

  const levelLabel =
    level === "rep"
      ? "Rep"
      : level === "senior"
      ? "Senior Rep"
      : level === "manager"
      ? "Store Manager"
      : "District Lead";

  const experienceLabel =
    experience === "experienced" ? "Experienced" : "Newcomer";

  const candidateAnswerCount = useMemo(
    () => messages.filter((m) => m.sender === "candidate").length,
    [messages]
  );

  const acceptedPromptCount = useMemo(
    () =>
      messages.filter(
        (m) =>
          (m.sender === "interviewer" || m.sender === "customer") &&
          !m.followUp &&
          m.phase !== "complete" &&
          m.phase !== "terminated"
      ).length,
    [messages]
  );

  const followUpCount = useMemo(
    () => messages.filter((m) => m.followUp).length,
    [messages]
  );

  const canFinish = interviewComplete && !processing && !submitting;

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, processing]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const requestAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      setStep("ready");

      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      alert("Camera and microphone access is required to continue.");
    }
  };

  const getNextInterviewMessage = async (updatedMessages: Message[]) => {
    const cleanMessages = updatedMessages.map((m) => ({
      sender: m.sender,
      text: safeTrim(m.text),
    }));

    const localAcceptedPromptCount = updatedMessages.filter(
      (m) =>
        (m.sender === "interviewer" || m.sender === "customer") &&
        !m.followUp &&
        m.phase !== "complete" &&
        m.phase !== "terminated"
    ).length;

    const localFollowUpCount = updatedMessages.filter((m) => m.followUp).length;

    const elapsedSeconds = interviewStartedAtRef.current
      ? Math.floor((Date.now() - interviewStartedAtRef.current) / 1000)
      : 0;

    const res = await fetch("/api/interview/next", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        level,
        experience,
        seed,
        messages: cleanMessages,

        // Future backend-safe fields. Harmless if route ignores them.
        acceptedPromptCount: localAcceptedPromptCount,
        followUpCount: localFollowUpCount,
        elapsedSeconds,
      }),
    });

    const data: NextInterviewResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Interview generation failed");
    }

    return data;
  };

  const beginInterview = async () => {
    if (processing) return;

    setProcessing(true);
    setSystemNotice("");
    interviewStartedAtRef.current = Date.now();

    try {
      const data = await getNextInterviewMessage([]);

      const firstMessage: Message = {
        sender: data.sender || "interviewer",
        text:
          data.text ||
          "Tell me about your background and why you fit this role.",
        phase: data.phase || "intro",
        topic: data.topic || "background_fit",
        followUp: Boolean(data.followUp),
      };

      setCurrentPhase(data.phase || "intro");
      setCurrentTopic(data.topic || "background_fit");
      setInterviewComplete(Boolean(data.complete));
      setTerminated(Boolean(data.terminated));
      setLastFollowUp(Boolean(data.followUp));
      setMessages([firstMessage]);
      setStep("live");
    } catch (error) {
      console.error(error);
      alert("Could not start interview. Check terminal.");
    } finally {
      setProcessing(false);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    if (processing || submitting || interviewComplete || terminated || recording) return;

    chunksRef.current = [];
    isStoppingRef.current = false;
    recordingStartedAtRef.current = Date.now();
    setSystemNotice("");

    const supportedType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: supportedType,
    });

    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });

      if (blob.size < 1000) {
        setSystemNotice("Recording was too short or empty. Record your answer again.");
        setProcessing(false);
        return;
      }

      await handleRecordedAnswer(blob);
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (!recorderRef.current || !recording || isStoppingRef.current) return;

    const elapsed = Date.now() - recordingStartedAtRef.current;

    if (elapsed < MIN_RECORDING_MS) {
      setSystemNotice("Answer is too short. Speak for at least a few seconds.");
      return;
    }

    isStoppingRef.current = true;
    setRecording(false);
    setProcessing(true);

    try {
      recorderRef.current.stop();
    } catch {
      setProcessing(false);
      setSystemNotice("Recording could not be stopped. Try again.");
    }
  };

  const handleRecordedAnswer = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "candidate-answer.webm");

      const transcriptRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const transcriptData: { text?: string; error?: string } =
        await transcriptRes.json();

      if (!transcriptRes.ok) {
        throw new Error(transcriptData.error || "Transcription failed");
      }

      const candidateText = safeTrim(transcriptData.text || "");

      if (!candidateText || candidateText.length < 8) {
        setSystemNotice(
          "We could not capture a clear answer. Record again with a complete spoken response."
        );
        return;
      }

      const updatedMessages: Message[] = [
        ...messages,
        {
          sender: "candidate",
          text: candidateText,
          phase: currentPhase,
          topic: currentTopic,
        },
      ];

      setMessages(updatedMessages);

      const nextData = await getNextInterviewMessage(updatedMessages);

      const nextMessage: Message = {
        sender: nextData.sender || "interviewer",
        text:
          nextData.text ||
          "Tell me more specifically how you would handle that situation.",
        phase: nextData.phase || currentPhase,
        topic: nextData.topic || currentTopic,
        followUp: Boolean(nextData.followUp),
      };

      setCurrentPhase(nextData.phase || currentPhase);
      setCurrentTopic(nextData.topic || currentTopic);
      setInterviewComplete(Boolean(nextData.complete));
      setTerminated(Boolean(nextData.terminated));
      setLastFollowUp(Boolean(nextData.followUp));

      setMessages([...updatedMessages, nextMessage]);

      if (nextData.terminated) {
        setSystemNotice(
          nextData.reason ||
            "The screening has been ended because the last response was unacceptable."
        );
      }
    } catch (error) {
      console.error(error);
      alert("Something failed while processing the answer. Check terminal.");
    } finally {
      setProcessing(false);
      chunksRef.current = [];
      recorderRef.current = null;
      isStoppingRef.current = false;
    }
  };

  const finishSimulation = async () => {
    if (!canFinish) {
      alert("Complete the full interview before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      const scoreRes = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          level,
          experience,
          seed,
          messages: messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            phase: m.phase,
            topic: m.topic,
            followUp: m.followUp,
          })),
          screeningId: params.id,
          candidate,
        }),
      });

      const scoreData: ScoreResult & { error?: string } = await scoreRes.json();

      if (!scoreRes.ok) {
        throw new Error(scoreData.error || "Scoring failed");
      }

      setScoreResult(scoreData);
      setStep("complete");
      stopCamera();
    } catch (error) {
      console.error(error);
      alert("Submission failed. Check terminal.");
    } finally {
      setSubmitting(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  if (step === "info") {
    return (
      <main className="min-h-screen bg-[#050914] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <section className="flex flex-col justify-center">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Hireque Candidate Screening
              </p>

              <h1 className="mt-5 text-5xl font-black tracking-tight">
                Structured role assessment.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                You will answer role-specific questions and complete a realistic
                wireless customer scenario using your camera and microphone.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <InfoPill icon={<Video size={18} />} label="Video required" />
                <InfoPill icon={<Mic size={18} />} label="Audio required" />
                <InfoPill icon={<ShieldCheck size={18} />} label="No retakes" />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Candidate details
              </p>

              <div className="mt-6 space-y-4">
                <input
                  value={candidate.name}
                  onChange={(e) =>
                    setCandidate((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
                />

                <input
                  value={candidate.email}
                  onChange={(e) =>
                    setCandidate((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Email address"
                  type="email"
                  className="w-full rounded-2xl border border-white/10 bg-[#0B1220] px-5 py-4 outline-none focus:border-blue-500"
                />

                <div className="rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-sm text-slate-300">
                  <p>
                    Track:{" "}
                    <span className="font-bold text-white">{roleLabel}</span>
                  </p>
                  <p className="mt-1">
                    Level:{" "}
                    <span className="font-bold text-white">{levelLabel}</span>
                  </p>
                  <p className="mt-1">
                    Experience:{" "}
                    <span className="font-bold text-white">
                      {experienceLabel}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!candidate.name.trim()) {
                      alert("Enter your full name.");
                      return;
                    }

                    if (!isValidEmail(candidate.email)) {
                      alert("Enter a valid email address.");
                      return;
                    }

                    setStep("permissions");
                  }}
                  className="w-full rounded-full bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500"
                >
                  Continue
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (step === "permissions") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050914] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
            <Camera size={28} />
          </div>

          <h1 className="mt-6 text-3xl font-black">Camera & Mic Required</h1>

          <p className="mt-3 leading-7 text-slate-400">
            This screening records live answers for company review. Make sure
            you are in a quiet place and answer naturally.
          </p>

          <button
            onClick={requestAccess}
            className="mt-7 w-full rounded-full bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500"
          >
            Allow Camera & Microphone
          </button>
        </div>
      </main>
    );
  }

  if (step === "ready") {
    return (
      <main className="min-h-screen bg-[#050914] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
            Device check
          </p>

          <h1 className="mt-4 text-4xl font-black">Ready to begin?</h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Make sure your face is visible and your microphone is working. Once
            started, answer naturally. The screening adapts to role, level, and
            experience.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full rounded-[2rem] border border-white/10 bg-black object-cover shadow-2xl"
            />

            <div className="flex flex-col justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Screening setup
              </p>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <CheckLine text="Camera and microphone active" />
                <CheckLine text="Structured role-specific assessment" />
                <CheckLine text="Realistic customer scenario included" />
                <CheckLine text="Results visible only to the company" />
              </div>

              <button
                onClick={beginInterview}
                disabled={processing}
                className="mt-7 rounded-full bg-blue-600 px-6 py-4 font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? "Starting..." : "Start Screening"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (step === "complete") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050914] px-6 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 size={30} />
          </div>

          <h1 className="mt-6 text-4xl font-black">Screening complete.</h1>

          <p className="mt-4 leading-7 text-slate-300">
            Thank you for completing your screening. If selected, the company
            will contact you using the email you provided.
          </p>

          {scoreResult && (
            <p className="mt-6 text-xs text-slate-500">
              Your responses have been submitted successfully.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050914] px-6 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[430px_1fr]">
        <section className="space-y-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-3 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full rounded-[1.4rem] bg-black object-cover"
            />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
              Live answer
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Record your spoken response. The system will transcribe your
              answer and continue with the next question or customer response.
            </p>

            {lastFollowUp && !interviewComplete && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p>
                    Follow-up required. Answer directly and give exact wording
                    or exact next action.
                  </p>
                </div>
              </div>
            )}

            {systemNotice && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                {systemNotice}
              </div>
            )}

            <div className="mt-5">
              {!recording ? (
                <button
                  onClick={startRecording}
                  disabled={processing || submitting || interviewComplete || terminated}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-4 font-bold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Mic size={18} />
                  {processing
                    ? "Processing answer..."
                    : interviewComplete || terminated
                    ? "Screening complete"
                    : "Start Recording"}
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-4 font-bold hover:bg-red-500"
                >
                  <Square size={18} />
                  Stop Recording
                </button>
              )}

              <button
                onClick={finishSimulation}
                disabled={processing || submitting || !canFinish}
                className="mt-4 w-full rounded-full border border-white/15 px-6 py-4 font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Finish & Submit"}
              </button>

              {!canFinish && (
                <p className="mt-3 text-xs text-slate-500">
                  Complete the full screening before submitting. Answers:{" "}
                  {candidateAnswerCount}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
            <p className="font-bold text-white">Screening</p>
            <p className="mt-2">{roleLabel}</p>
            <p>{levelLabel}</p>
            <p>{experienceLabel}</p>
            <p className="mt-3 text-blue-300">Phase: {currentPhase}</p>
            <p>Topic: {currentTopic}</p>
            <p>Answers: {candidateAnswerCount}</p>
            <p>Follow-ups: {followUpCount}</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                Structured assessment
              </p>

              <h1 className="mt-3 text-3xl font-black">
                {role === "support"
                  ? "Wireless Customer Support"
                  : "Wireless Sales"}
              </h1>
            </div>

            <span className="rounded-full border border-white/10 bg-[#0B1220] px-4 py-2 text-sm text-slate-300">
              Adaptive
            </span>
          </div>

          <div className="mt-6 max-h-[620px] space-y-4 overflow-y-auto pr-1">
            {messages.map((msg, index) => (
              <div
                key={`${msg.sender}-${index}-${msg.topic || "msg"}`}
                className={`max-w-[88%] rounded-2xl p-4 ${
                  msg.sender === "candidate"
                    ? "ml-auto bg-blue-600/25 text-blue-100"
                    : msg.followUp
                    ? "mr-auto border border-amber-400/20 bg-amber-500/10"
                    : "mr-auto border border-white/10 bg-[#0B1220]"
                }`}
              >
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  {msg.sender === "candidate"
                    ? "Candidate"
                    : msg.sender === "customer"
                    ? msg.followUp
                      ? "Customer Follow-up"
                      : "Customer"
                    : msg.followUp
                    ? "Interviewer Follow-up"
                    : "Interviewer"}
                </p>
                <p className="leading-7">{msg.text}</p>
              </div>
            ))}

            {processing && (
              <div className="mr-auto max-w-[88%] rounded-2xl border border-white/10 bg-[#0B1220] p-4 text-slate-400">
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Processing response...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
      <span className="text-blue-300">{icon}</span>
      {label}
    </div>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 size={17} className="text-emerald-300" />
      <span>{text}</span>
    </div>
  );
}
