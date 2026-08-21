import * as THREE from "three";
import { AudioData } from "./types";

export type CameraRecipe = "intimate-dolly" | "drop-rush" | "stage-orbit" | "wide-sweep";

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export class CinematicDirector {
  private currentPose: CameraPose;
  private targetPose: CameraPose;
  private currentRecipe: CameraRecipe = "intimate-dolly";
  private recipeTimer: number = 0;
  private shakeIntensity: number = 0;

  constructor() {
    this.currentPose = {
      position: new THREE.Vector3(0, 1.2, 5.5),
      target: new THREE.Vector3(0, 0, 0),
      fov: 60,
    };
    this.targetPose = {
      position: new THREE.Vector3(0, 1.2, 5.5),
      target: new THREE.Vector3(0, 0, 0),
      fov: 60,
    };
  }

  public update(deltaTime: number, audioData: AudioData, time: number): CameraPose {
    this.recipeTimer += deltaTime;

    const bass = audioData.bass || 0;
    const isBeat = audioData.isBeat || false;

    // 节拍击打触发微震颤
    if (isBeat || bass > 0.8) {
      this.shakeIntensity = Math.min(0.25, this.shakeIntensity + 0.12);
      if (bass > 0.85 && this.currentRecipe !== "drop-rush") {
        this.setRecipe("drop-rush");
      }
    } else {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - deltaTime * 1.5);
    }

    // 自动轮换运镜方案 (每 15-25 秒平滑过渡)
    if (this.recipeTimer > 20) {
      this.recipeTimer = 0;
      const recipes: CameraRecipe[] = ["intimate-dolly", "stage-orbit", "wide-sweep"];
      const next = recipes[Math.floor(Math.random() * recipes.length)];
      this.setRecipe(next);
    }

    // 根据当前方案计算目标相机坐标
    switch (this.currentRecipe) {
      case "drop-rush": {
        this.targetPose.position.set(0, 0.4, 3.8 + Math.sin(time * 3.0) * 0.4);
        this.targetPose.fov = 72;
        break;
      }
      case "stage-orbit": {
        const orbitRadius = 6.2;
        this.targetPose.position.set(
          Math.sin(time * 0.3) * orbitRadius,
          1.5 + Math.cos(time * 0.2) * 0.5,
          Math.cos(time * 0.3) * orbitRadius
        );
        this.targetPose.fov = 65;
        break;
      }
      case "wide-sweep": {
        this.targetPose.position.set(
          Math.sin(time * 0.15) * 3.5,
          2.4,
          7.0
        );
        this.targetPose.fov = 55;
        break;
      }
      case "intimate-dolly":
      default: {
        this.targetPose.position.set(
          Math.sin(time * 0.2) * 0.8,
          0.8 + Math.sin(time * 0.4) * 0.3,
          4.8 + Math.cos(time * 0.25) * 0.6
        );
        this.targetPose.fov = 58;
        break;
      }
    }

    // 弹簧平滑阻尼插值 (Smooth Damping Lerp)
    const lerpSpeed = 0.04;
    this.currentPose.position.lerp(this.targetPose.position, lerpSpeed);
    this.currentPose.target.lerp(this.targetPose.target, lerpSpeed);
    this.currentPose.fov += (this.targetPose.fov - this.currentPose.fov) * lerpSpeed;

    // 应用节拍震颤 (Impulse Shake)
    const finalPos = this.currentPose.position.clone();
    if (this.shakeIntensity > 0.001) {
      finalPos.x += (Math.random() - 0.5) * this.shakeIntensity;
      finalPos.y += (Math.random() - 0.5) * this.shakeIntensity;
    }

    return {
      position: finalPos,
      target: this.currentPose.target.clone(),
      fov: this.currentPose.fov,
    };
  }

  public setRecipe(recipe: CameraRecipe) {
    this.currentRecipe = recipe;
  }
}
