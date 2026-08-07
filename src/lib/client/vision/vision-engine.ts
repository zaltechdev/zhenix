/**
 * MediaPipe Face Landmarker Vision Engine.
 * Client-side boundary managing camera stream lifecycle, landmark inference, and tracking state.
 */

import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { HeadPose, extractPoseFromMatrix, extractPoseFromLandmarks, computePoseDelta, NeutralBaseline } from "./head-pose";
import { BlendshapeCategory } from "./gesture-detector";

export type VisionLifecycleState =
  | "idle"
  | "initializing"
  | "active"
  | "tracking_lost"
  | "paused"
  | "disabled"
  | "error";

export interface VisionFrameData {
  lifecycleState: VisionLifecycleState;
  faceDetected: boolean;
  pose: HeadPose;
  poseDelta: HeadPose;
  blendshapes: BlendshapeCategory[];
  timestampMs: number;
  errorMessage: string | null;
}

export interface VisionEngineCallbacks {
  onFrame?: (data: VisionFrameData) => void;
  onStateChange?: (state: VisionLifecycleState, errorMessage?: string | null) => void;
}

export class VisionEngine {
  private state: VisionLifecycleState = "idle";
  private landmarker: FaceLandmarker | null = null;
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;
  private lastProcessedTimestamp = 0;
  private neutralBaseline: NeutralBaseline = { yaw: 0, pitch: 0, roll: 0 };
  private errorMessage: string | null = null;
  private callbacks: VisionEngineCallbacks = {};
  private minInferenceIntervalMs = 25; // Limit inference cadence to ~40 FPS max to prevent backlog

  constructor(callbacks?: VisionEngineCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public getState(): VisionLifecycleState {
    return this.state;
  }

  public setNeutralBaseline(baseline: NeutralBaseline): void {
    this.neutralBaseline = { ...baseline };
  }

  public getNeutralBaseline(): NeutralBaseline {
    return { ...this.neutralBaseline };
  }

  private updateState(newState: VisionLifecycleState, errorMsg: string | null = null): void {
    this.state = newState;
    this.errorMessage = errorMsg;
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(newState, errorMsg);
    }
  }

  /**
   * Initialize MediaPipe Face Landmarker model.
   */
  public async initialize(): Promise<boolean> {
    if (this.landmarker) {
      return true;
    }

    this.updateState("initializing");

    try {
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );

      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: true
      });

      this.updateState("idle");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Face Landmarker model";
      this.updateState("error", msg);
      return false;
    }
  }

  /**
   * Start processing an active HTMLVideoElement and MediaStream.
   */
  public start(videoElement: HTMLVideoElement, stream: MediaStream): void {
    this.videoElement = videoElement;
    this.mediaStream = stream;

    if (!this.landmarker) {
      this.initialize().then((success) => {
        if (success) {
          this.startLoop();
        }
      });
    } else {
      this.startLoop();
    }
  }

  public pause(): void {
    this.stopLoop();
    this.updateState("paused");
  }

  public resume(): void {
    if (this.videoElement && this.mediaStream && this.landmarker) {
      this.startLoop();
    }
  }

  public disable(): void {
    this.stopLoop();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.updateState("disabled");
  }

  private startLoop(): void {
    this.stopLoop();
    this.updateState("active");
    this.loop();
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (): void => {
    if (this.state !== "active" && this.state !== "tracking_lost") {
      return;
    }

    const now = performance.now();
    const video = this.videoElement;

    if (
      video &&
      video.readyState >= 2 &&
      this.landmarker &&
      now - this.lastProcessedTimestamp >= this.minInferenceIntervalMs
    ) {
      this.lastProcessedTimestamp = now;

      try {
        const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, now);
        this.processLandmarkerResult(result, now);
      } catch {
        // Degrade gracefully on inference frame glitch
      }
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Process a single FaceLandmarkerResult object.
   */
  public processLandmarkerResult(result: FaceLandmarkerResult, nowMs: number): VisionFrameData {
    const faceDetected = Boolean(result.faceLandmarks && result.faceLandmarks.length > 0);

    if (!faceDetected) {
      if (this.state === "active") {
        this.updateState("tracking_lost");
      }

      const emptyFrame: VisionFrameData = {
        lifecycleState: this.state,
        faceDetected: false,
        pose: { yaw: 0, pitch: 0, roll: 0 },
        poseDelta: { yaw: 0, pitch: 0, roll: 0 },
        blendshapes: [],
        timestampMs: nowMs,
        errorMessage: this.errorMessage
      };

      if (this.callbacks.onFrame) {
        this.callbacks.onFrame(emptyFrame);
      }
      return emptyFrame;
    }

    // Face detected -> transition back to active if was tracking_lost
    if (this.state === "tracking_lost") {
      this.updateState("active");
    }

    // Extract pose from matrix or landmark vector fallback
    let pose: HeadPose = { yaw: 0, pitch: 0, roll: 0 };
    if (
      result.facialTransformationMatrixes &&
      result.facialTransformationMatrixes.length > 0 &&
      result.facialTransformationMatrixes[0].data
    ) {
      pose = extractPoseFromMatrix(result.facialTransformationMatrixes[0].data);
    } else if (result.faceLandmarks && result.faceLandmarks[0]) {
      pose = extractPoseFromLandmarks(result.faceLandmarks[0]);
    }

    const poseDelta = computePoseDelta(pose, this.neutralBaseline);

    // Extract blendshapes
    const blendshapes: BlendshapeCategory[] = [];
    if (result.faceBlendshapes && result.faceBlendshapes[0] && result.faceBlendshapes[0].categories) {
      for (const cat of result.faceBlendshapes[0].categories) {
        blendshapes.push({ categoryName: cat.categoryName, score: cat.score });
      }
    }

    const frameData: VisionFrameData = {
      lifecycleState: this.state,
      faceDetected: true,
      pose,
      poseDelta,
      blendshapes,
      timestampMs: nowMs,
      errorMessage: this.errorMessage
    };

    if (this.callbacks.onFrame) {
      this.callbacks.onFrame(frameData);
    }

    return frameData;
  }
}
