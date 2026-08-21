"use client";

import React from "react";
import { usePosterV2Store } from "@/store/posterV2Store";
import { Settings, Image as ImageIcon, Type, Layout } from "lucide-react";

export default function FabricControls() {
  const store = usePosterV2Store();

  const handleTransformChange = (element: "cover" | "title" | "artist", property: "x" | "y" | "scaleX", value: number) => {
    // If scaleX changes, also change scaleY to maintain aspect ratio
    if (property === "scaleX") {
      store.updateTransform(element, { scaleX: value, scaleY: value });
    } else {
      store.updateTransform(element, { [property]: value });
    }
  };

  const renderTransformControls = (label: string, element: "cover" | "title" | "artist", maxScale = 3) => {
    const transform = store[`${element}Transform`];
    
    return (
      <div className="mb-6 bg-white/5 rounded-2xl p-4 border border-white/5">
        <h4 className="text-white/80 text-sm font-semibold mb-4 flex items-center gap-2">
          {element === "cover" ? <ImageIcon className="w-4 h-4" /> : <Type className="w-4 h-4" />}
          {label} (双向绑定)
        </h4>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>X Position</span>
              <span>{Math.round(transform.x)}px</span>
            </div>
            <input 
              type="range" min="-100" max="700" value={transform.x} 
              onChange={(e) => handleTransformChange(element, "x", parseFloat(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Y Position</span>
              <span>{Math.round(transform.y)}px</span>
            </div>
            <input 
              type="range" min="-100" max="1500" value={transform.y} 
              onChange={(e) => handleTransformChange(element, "y", parseFloat(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Scale</span>
              <span>{transform.scaleX.toFixed(2)}x</span>
            </div>
            <input 
              type="range" min="0.1" max={maxScale} step="0.05" value={transform.scaleX} 
              onChange={(e) => handleTransformChange(element, "scaleX", parseFloat(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h3 className="text-white text-lg font-bold mb-2 flex items-center gap-2">
          <Layout className="w-5 h-5 text-pink-400" />
          Global Settings
        </h3>
        
        <div className="space-y-4 bg-white/5 rounded-2xl p-4 border border-white/5">
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Aspect Ratio</span>
              <span>{store.aspectRatio === 0.5625 ? "9:16" : store.aspectRatio === 0.75 ? "3:4" : "1:1"}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => store.updateGlobal({ aspectRatio: 0.5625 })}
                className={`flex-1 py-1 text-xs rounded-lg ${store.aspectRatio === 0.5625 ? "bg-pink-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
              >9:16</button>
              <button 
                onClick={() => store.updateGlobal({ aspectRatio: 0.75 })}
                className={`flex-1 py-1 text-xs rounded-lg ${store.aspectRatio === 0.75 ? "bg-pink-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
              >3:4</button>
              <button 
                onClick={() => store.updateGlobal({ aspectRatio: 1 })}
                className={`flex-1 py-1 text-xs rounded-lg ${store.aspectRatio === 1 ? "bg-pink-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
              >1:1</button>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Background Color</span>
            </div>
            <div className="flex gap-2">
              {['#fa2d48', '#111111', '#4f46e5', '#10b981', '#f59e0b'].map(color => (
                <button
                  key={color}
                  onClick={() => store.updateGlobal({ primaryColor: color })}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ 
                    backgroundColor: color, 
                    borderColor: store.primaryColor === color ? 'white' : 'transparent' 
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          Element Transforms
        </h3>
        
        {renderTransformControls("Cover Image", "cover")}
        {renderTransformControls("Song Title", "title")}
        {renderTransformControls("Artist Name", "artist")}
      </div>
      
    </div>
  );
}
