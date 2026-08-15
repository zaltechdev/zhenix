/**
 * Web-Native HeadControlController.
 *
 * Full browser-native orchestrator connecting WebRTC camera capture, MediaPipe
 * Face Landmarker inference, the 6-stage HeadMotionFilter kinematics engine,
 * spatial DwellClickTracker, synthetic DOM event dispatching, and physical mouse takeover.
 */

import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  HeadMotionFilter,
  DwellClickTracker,
  type HeadPose,
  type HeadMotion,
  type HeadMotionOptions,
  type DwellClickOptions,
  type DwellTrackerState
} from "./head-motion";
import { runWithMediaPipeConsoleRouting } from "./mediapipe-console";

export type HeadControlStatus =
  | "idle"
  | "initializing"
  | "active"
  | "tracking_lost"
  | "mouse_takeover"
  | "paused"
  | "stopped"
  | "error";

export interface VirtualCursorState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isVisible: boolean;
  isPhysicalMouseActive: boolean;
  status: HeadControlStatus;
  dwellState: DwellTrackerState;
  dwellProgress: number; // 0.0 to 1.0
  hoverTarget: HTMLElement | null;
  pose: HeadPose | null;
  baseline: HeadPose | null;
  lastClickTimestamp: number | null;
}

export interface HeadControlControllerOptions {
  /** Video capture width constraint (default: 640) */
  videoWidth?: number;
  /** Video capture height constraint (default: 480) */
  videoHeight?: number;
  /** Ideal camera frame rate (default: 30) */
  targetFps?: number;
  /** Inference throttle interval in milliseconds (default: 33ms ~30 FPS) */
  inferenceIntervalMs?: number;
  /** Physical mouse movement takeover pause duration in milliseconds (default: 3000ms) */
  mouseTakeoverDelayMs?: number;
  /** Head motion kinematics filter options */
  motionOptions?: HeadMotionOptions;
  /** Dwell click options */
  dwellOptions?: DwellClickOptions;
  /** Enable audio click feedback via Web Audio API (default: true) */
  enableAudioFeedback?: boolean;
  /** Callback fired on every cursor update */
  onCursorUpdate?: (state: VirtualCursorState) => void;
  /** Callback fired when dwell click successfully triggers */
  onDwellClick?: (target: HTMLElement | null, point: { x: number; y: number }) => void;
  /** Callback fired on controller lifecycle status change */
  onStatusChange?: (status: HeadControlStatus, error?: string) => void;
}

export class HeadControlController {
  private options: Required<Omit<HeadControlControllerOptions, "onCursorUpdate" | "onDwellClick" | "onStatusChange">> & {
    onCursorUpdate?: (state: VirtualCursorState) => void;
    onDwellClick?: (target: HTMLElement | null, point: { x: number; y: number }) => void;
    onStatusChange?: (status: HeadControlStatus, error?: string) => void;
  };

  private motionFilter: HeadMotionFilter;
  private dwellTracker: DwellClickTracker;

  // WebRTC & MediaPipe instances
  private landmarker: FaceLandmarker | null = null;
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private internalVideoCreated = false;
  private animFrameId: number | null = null;

  // State
  private status: HeadControlStatus = "idle";
  private cursorX = 0;
  private cursorY = 0;
  private lastProcessedTimestamp = 0;
  private lastClickTimestamp: number | null = null;

  // Physical mouse takeover
  private isPhysicalMouseActive = false;
  private mouseTakeoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPhysicalMousePos = { x: -1, y: -1 };

  // Web Audio Context for synthesized click
  private audioCtx: AudioContext | null = null;

  // Bound event listeners
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleResizeBound: () => void;

  constructor(options?: HeadControlControllerOptions) {
    this.options = {
      videoWidth: options?.videoWidth ?? 640,
      videoHeight: options?.videoHeight ?? 480,
      targetFps: options?.targetFps ?? 30,
      inferenceIntervalMs: options?.inferenceIntervalMs ?? 33,
      mouseTakeoverDelayMs: options?.mouseTakeoverDelayMs ?? 3000,
      enableAudioFeedback: options?.enableAudioFeedback ?? true,
      motionOptions: options?.motionOptions ?? {},
      dwellOptions: options?.dwellOptions ?? {},
      onCursorUpdate: options?.onCursorUpdate,
      onDwellClick: options?.onDwellClick,
      onStatusChange: options?.onStatusChange
    };

    this.motionFilter = new HeadMotionFilter(this.options.motionOptions);
    this.dwellTracker = new DwellClickTracker({
      ...this.options.dwellOptions,
      onActivate: (point, target) => this.handleDwellActivation(point, target)
    });

    // Default cursor start at center of viewport if in browser
    if (typeof window !== "undefined") {
      this.cursorX = window.innerWidth / 2;
      this.cursorY = window.innerHeight / 2;
    }

    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleResizeBound = this.handleResize.bind(this);

    // Attach global listeners for physical mouse takeover and window resize
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", this.handleMouseMoveBound, { passive: true });
      window.addEventListener("resize", this.handleResizeBound, { passive: true });
    }
  }

  public getStatus(): HeadControlStatus {
    return this.status;
  }

  public getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  public getMotionFilter(): HeadMotionFilter {
    return this.motionFilter;
  }

  public getDwellTracker(): DwellClickTracker {
    return this.dwellTracker;
  }

  public setOnCursorUpdate(callback?: (state: VirtualCursorState) => void): void {
    this.options.onCursorUpdate = callback;
  }

  /**
   * Re-center baseline to current head posture immediately.
   */
  public calibrate(): void {
    this.motionFilter.recalibrate();
  }

  /**
   * Initialize MediaPipe Face Landmarker WebAssembly model.
   */
  public async initializeModel(): Promise<boolean> {
    if (this.landmarker) return true;

    this.updateStatus("initializing");

    try {
      this.landmarker = await runWithMediaPipeConsoleRouting(async () => {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        );

        const commonOptions = {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
          },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        };

        try {
          return await FaceLandmarker.createFromOptions(fileset, {
            ...commonOptions,
            baseOptions: { ...commonOptions.baseOptions, delegate: "GPU" }
          });
        } catch {
          return FaceLandmarker.createFromOptions(fileset, commonOptions);
        }
      });

      this.updateStatus("idle");
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Model load failed";
      this.updateStatus("error", errorMsg);
      return false;
    }
  }

  /**
   * Start camera stream and processing loop.
   *
   * @param existingVideo Optional existing video element. If omitted, an off-screen element is created.
   * @param existingStream Optional existing MediaStream.
   */
  public async start(
    existingVideo?: HTMLVideoElement | null,
    existingStream?: MediaStream | null
  ): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Ensure model is initialized
    if (!this.landmarker) {
      const modelReady = await this.initializeModel();
      if (!modelReady) return false;
    }

    try {
      this.updateStatus("initializing");

      // Setup video stream
      if (existingStream) {
        this.mediaStream = existingStream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: this.options.videoWidth },
            height: { ideal: this.options.videoHeight },
            frameRate: { ideal: this.options.targetFps }
          },
          audio: false
        });
      }

      // Setup video element
      if (existingVideo) {
        this.videoElement = existingVideo;
        this.internalVideoCreated = false;
      } else {
        this.videoElement = document.createElement("video");
        this.videoElement.setAttribute("playsinline", "true");
        this.videoElement.setAttribute("muted", "true");
        this.videoElement.style.position = "fixed";
        this.videoElement.style.top = "-9999px";
        this.videoElement.style.left = "-9999px";
        this.videoElement.style.width = "1px";
        this.videoElement.style.height = "1px";
        this.videoElement.style.opacity = "0";
        this.videoElement.style.pointerEvents = "none";
        document.body.appendChild(this.videoElement);
        this.internalVideoCreated = true;
      }

      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();

      // Start RAF loop
      this.motionFilter.reset();
      this.dwellTracker.reset();
      this.updateStatus("active");
      this.startLoop();

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Camera permission denied or unavailable";
      this.stop();
      this.updateStatus("error", errorMsg);
      return false;
    }
  }

  /**
   * Pause tracking temporarily without tearing down the camera.
   */
  public pause(): void {
    this.stopLoop();
    this.updateStatus("paused");
  }

  /**
   * Resume tracking.
   */
  public resume(): void {
    if (this.videoElement && this.mediaStream && this.landmarker) {
      this.updateStatus("active");
      this.startLoop();
    }
  }

  /**
   * Stop camera capture, release media tracks, and stop loop.
   */
  public stop(): void {
    this.stopLoop();

    if (this.mouseTakeoverTimeout) {
      clearTimeout(this.mouseTakeoverTimeout);
      this.mouseTakeoverTimeout = null;
    }
    this.isPhysicalMouseActive = false;

    // Stop MediaStream tracks
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.mediaStream = null;
    }

    // Detach and clean up video element
    if (this.videoElement) {
      try {
        this.videoElement.srcObject = null;
        if (this.internalVideoCreated && this.videoElement.parentNode) {
          this.videoElement.parentNode.removeChild(this.videoElement);
        }
      } catch {
        // ignore
      }
      this.videoElement = null;
      this.internalVideoCreated = false;
    }

    if (this.status !== "error") {
      this.updateStatus("stopped");
    }
  }

  /**
   * Full teardown including WebAssembly landmarker memory release and event listeners removal.
   */
  public destroy(): void {
    this.stop();

    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", this.handleMouseMoveBound);
      window.removeEventListener("resize", this.handleResizeBound);
    }

    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // ignore
      }
      this.landmarker = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }

  private startLoop(): void {
    this.stopLoop();
    this.animFrameId = requestAnimationFrame(this.processFrame);
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private processFrame = (): void => {
    if (this.status === "stopped" || this.status === "paused" || this.status === "error") {
      return;
    }

    const now = performance.now();
    const video = this.videoElement;

    // Inference throttling ~30 FPS
    if (
      video &&
      video.readyState >= 2 &&
      this.landmarker &&
      now - this.lastProcessedTimestamp >= this.options.inferenceIntervalMs
    ) {
      this.lastProcessedTimestamp = now;

      try {
        const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, now);
        this.handleLandmarkerResult(result, now);
      } catch {
        this.updateStatus("error", "Inference execution error");
        return;
      }
    }

    if (this.status === "active" || this.status === "tracking_lost" || this.status === "mouse_takeover") {
      this.animFrameId = requestAnimationFrame(this.processFrame);
    }
  };

  /**
   * Process landmarks and update virtual cursor kinematics & dwell tracker.
   */
  public handleLandmarkerResult(result: FaceLandmarkerResult, nowMs: number): void {
    const hasFace = Boolean(result.faceLandmarks && result.faceLandmarks.length > 0);

    if (!hasFace) {
      if (this.status === "active") {
        this.updateStatus("tracking_lost");
      }
      this.dwellTracker.cancel();
      this.broadcastState(null, 0, null);
      return;
    }

    if ((this.status === "idle" || this.status === "tracking_lost") && !this.isPhysicalMouseActive) {
      this.updateStatus("active");
    }

    const landmarks = result.faceLandmarks[0];
    const motion: HeadMotion = this.motionFilter.process(landmarks);

    // Apply cursor movement only when not in physical mouse takeover
    if (!this.isPhysicalMouseActive) {
      const maxX = typeof window !== "undefined" ? window.innerWidth : 1920;
      const maxY = typeof window !== "undefined" ? window.innerHeight : 1080;
      this.cursorX = Math.max(0, Math.min(maxX, this.cursorX + motion.dx));
      this.cursorY = Math.max(0, Math.min(maxY, this.cursorY + motion.dy));
    }

    // Identify target element at cursor coordinates
    const targetElement =
      typeof document !== "undefined" && typeof document.elementFromPoint === "function"
        ? (document.elementFromPoint(this.cursorX, this.cursorY) as HTMLElement | null)
        : null;

    // Process dwell clicking
    const isControlActive = this.status === "active" && !this.isPhysicalMouseActive;
    const dwellInfo = this.dwellTracker.process(
      { x: this.cursorX, y: this.cursorY },
      nowMs,
      targetElement,
      isControlActive
    );

    this.broadcastState(motion, dwellInfo.progress, targetElement);
  }

  /**
   * Dispatch synthetic DOM click & pointer events when dwell completes.
   */
  private handleDwellActivation(point: { x: number; y: number }, target: HTMLElement | null): void {
    this.lastClickTimestamp = typeof performance !== "undefined" ? performance.now() : Date.now();

    // Play click audio
    if (this.options.enableAudioFeedback) {
      this.playClickAudio();
    }

    if (target && typeof document !== "undefined") {
      const clientX = point.x;
      const clientY = point.y;

      try {
        const evt =
          typeof PointerEvent !== "undefined"
            ? new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                pointerId: 1,
                pointerType: "mouse"
              })
            : new MouseEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY
              });
        target.dispatchEvent(evt);
      } catch {
        try {
          target.dispatchEvent(new CustomEvent("pointerdown", { bubbles: true }));
        } catch {
          // ignore
        }
      }

      try {
        target.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY
          })
        );
      } catch {
        // ignore
      }

      try {
        const evt =
          typeof PointerEvent !== "undefined"
            ? new PointerEvent("pointerup", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                pointerId: 1,
                pointerType: "mouse"
              })
            : new MouseEvent("pointerup", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY
              });
        target.dispatchEvent(evt);
      } catch {
        try {
          target.dispatchEvent(new CustomEvent("pointerup", { bubbles: true }));
        } catch {
          // ignore
        }
      }

      try {
        target.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY
          })
        );
      } catch {
        // ignore
      }

      try {
        target.click();
      } catch {
        // ignore
      }

      try {
        if (typeof target.focus === "function") {
          target.focus();
        }
      } catch {
        // ignore
      }
    }

    this.options.onDwellClick?.(target, point);
  }

  /**
   * Synthesize crisp, lightweight click audio using Web Audio API.
   */
  private playClickAudio(): void {
    try {
      if (typeof window === "undefined") return;
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch {
      // Audio playback fails gracefully if un-interacted
    }
  }

  /**
   * Detect physical mouse movement for coexistence / takeover.
   */
  private handleMouseMove(e: MouseEvent): void {
    // Ignore initial event or zero-displacement noise
    if (this.lastPhysicalMousePos.x < 0) {
      this.lastPhysicalMousePos = { x: e.clientX, y: e.clientY };
      return;
    }

    const dist = Math.hypot(
      e.clientX - this.lastPhysicalMousePos.x,
      e.clientY - this.lastPhysicalMousePos.y
    );

    this.lastPhysicalMousePos = { x: e.clientX, y: e.clientY };

    if (dist < 3) return; // ignore sub-pixel jitter

    // Takeover activated
    this.isPhysicalMouseActive = true;
    this.dwellTracker.cancel();
    this.updateStatus("mouse_takeover");

    if (this.mouseTakeoverTimeout) {
      clearTimeout(this.mouseTakeoverTimeout);
    }

    this.mouseTakeoverTimeout = setTimeout(() => {
      this.isPhysicalMouseActive = false;
      this.mouseTakeoverTimeout = null;
      if (this.status === "mouse_takeover") {
        this.updateStatus("active");
      }
    }, this.options.mouseTakeoverDelayMs);
  }

  private handleResize(): void {
    if (typeof window !== "undefined") {
      this.cursorX = Math.max(0, Math.min(window.innerWidth, this.cursorX));
      this.cursorY = Math.max(0, Math.min(window.innerHeight, this.cursorY));
    }
  }

  private updateStatus(newStatus: HeadControlStatus, error?: string): void {
    this.status = newStatus;
    this.options.onStatusChange?.(newStatus, error);
  }

  private broadcastState(
    motion: HeadMotion | null,
    dwellProgress: number,
    hoverTarget: HTMLElement | null
  ): void {
    const isVisible =
      (this.status === "active" || this.status === "tracking_lost") && !this.isPhysicalMouseActive;

    const state: VirtualCursorState = {
      x: this.cursorX,
      y: this.cursorY,
      vx: motion?.vx ?? 0,
      vy: motion?.vy ?? 0,
      isVisible,
      isPhysicalMouseActive: this.isPhysicalMouseActive,
      status: this.status,
      dwellState: this.dwellTracker.getState(),
      dwellProgress,
      hoverTarget,
      pose: motion?.smoothPose ?? null,
      baseline: motion?.baseline ?? null,
      lastClickTimestamp: this.lastClickTimestamp
    };

    this.options.onCursorUpdate?.(state);
  }
}
