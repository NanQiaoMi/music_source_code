import * as THREE from "three";

export class ThreeJSScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private isContextLost: boolean = false;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.setupContextListeners();
  }

  private setupContextListeners(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.isContextLost = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  };

  private handleContextRestored = (): void => {
    this.isContextLost = false;
  };

  resize(width: number, height: number): void {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  render(): void {
    if (!this.isContextLost && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Deeply disposes of an object and its children
   */
  private disposeObject(object: THREE.Object3D): void {
    object.children.forEach((child) => this.disposeObject(child));

    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => this.disposeMaterial(material));
        } else {
          this.disposeMaterial(object.material);
        }
      }
    }
  }

  /**
   * Disposes of a material and its textures
   */
  private disposeMaterial(material: THREE.Material): void {
    material.dispose();

    // Dispose of textures
    for (const key in material) {
      if (material.hasOwnProperty(key)) {
        const value = (material as any)[key];
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
    }
  }

  clear(): void {
    if (!this.scene) return;

    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.disposeObject(child);
      this.scene.remove(child);
    }
  }

  destroy(): void {
    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener("webglcontextlost", this.handleContextLost);
      canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    }

    this.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    // Nullify references to break cycles and help GC
    (this as any).scene = null;
    (this as any).camera = null;
    (this as any).renderer = null;
  }
}
