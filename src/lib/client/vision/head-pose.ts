/**
 * Head pose orientation calculation from facial landmarks or transformation matrix.
 * Pure functions for testability independent of MediaPipe runtime.
 */

export interface HeadPose {
  /** Yaw angle in degrees (-left, +right) */
  yaw: number;
  /** Pitch angle in degrees (-down, +up) */
  pitch: number;
  /** Roll angle in degrees (-tilt left, +tilt right) */
  roll: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface NeutralBaseline {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Extract head pose angles (yaw, pitch, roll in degrees) from a 4x4 transformation matrix.
 * Column-major format as output by MediaPipe.
 */
export function extractPoseFromMatrix(matrixData: Float32Array | number[]): HeadPose {
  if (matrixData.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Column-major 4x4 matrix
  // R00=m[0], R10=m[1], R20=m[2]
  // R01=m[4], R11=m[5], R21=m[6]
  // R02=m[8], R12=m[9], R22=m[10]

  const r20 = matrixData[2];
  const r21 = matrixData[6];
  const r22 = matrixData[10];
  const r00 = matrixData[0];
  const r10 = matrixData[1];

  const pitch = Math.atan2(r21, r22) * (180 / Math.PI);
  const yaw = Math.atan2(-r20, Math.sqrt(r21 * r21 + r22 * r22)) * (180 / Math.PI);
  const roll = Math.atan2(r10, r00) * (180 / Math.PI);

  return {
    yaw: isNaN(yaw) ? 0 : yaw,
    pitch: isNaN(pitch) ? 0 : pitch,
    roll: isNaN(roll) ? 0 : roll
  };
}

/**
 * Fallback landmark-based head pose estimation when transformation matrix is unavailable.
 * Key landmark indices:
 * Nose tip: 1
 * Left eye outer: 33
 * Right eye outer: 263
 * Chin: 152
 * Forehead top: 10
 */
export function extractPoseFromLandmarks(landmarks: LandmarkPoint[]): HeadPose {
  if (!landmarks || landmarks.length <= 263) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  if (!nose || !leftEye || !rightEye || !chin || !forehead) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Midpoint between eyes
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

  if (eyeDistance === 0) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Yaw: horizontal offset of nose relative to eye midpoint normalized by eye distance
  const yawOffset = (nose.x - eyeMidX) / eyeDistance;
  const yaw = yawOffset * 90; // Scale to approximate degrees

  // Pitch: vertical offset of nose relative to eye-to-chin line
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const pitchOffset = faceHeight > 0 ? (nose.y - eyeMidY) / faceHeight - 0.35 : 0;
  const pitch = pitchOffset * 90;

  // Roll: angle of eye line relative to horizontal
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  return {
    yaw: isNaN(yaw) ? 0 : yaw,
    pitch: isNaN(pitch) ? 0 : pitch,
    roll: isNaN(roll) ? 0 : roll
  };
}

/**
 * Calculate delta relative to neutral calibration baseline.
 */
export function computePoseDelta(current: HeadPose, baseline: NeutralBaseline): HeadPose {
  return {
    yaw: current.yaw - baseline.yaw,
    pitch: current.pitch - baseline.pitch,
    roll: current.roll - baseline.roll
  };
}
