/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";

interface MerchantResult {
  success: boolean;
  product: {
    id: string;
    name: string;
    modelUrl: string;
    priceUZS: number;
  };
  embedScript: string;
}

export default function MerchantPortalPage() {
  const [name, setName] = useState("");
  const [priceUZS, setPriceUZS] = useState(1500000);
  const [widthCm, setWidthCm] = useState(120);
  const [heightCm, setHeightCm] = useState(85);
  const [depthCm, setDepthCm] = useState(90);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MerchantResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("name", name);
    formData.append("priceUZS", priceUZS.toString());
    formData.append("widthCm", widthCm.toString());
    formData.append("heightCm", heightCm.toString());
    formData.append("depthCm", depthCm.toString());

    try {
      const res = await fetch("/api/merchant/photo-3d", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        alert(data.error || "Failed to process photo");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert("Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
            B2B Merchant Portal
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Photo-to-3D AR Generator
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl mx-auto">
            Convert smartphone product photos into 1:1 scale WebXR 3D models in under 60 seconds.
          </p>
        </div>

        {/* Upload Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlassPanel className="p-6 rounded-3xl border border-white/10 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Velvet Armchair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Price (UZS)
                </label>
                <input
                  type="number"
                  required
                  value={priceUZS}
                  onChange={(e) => setPriceUZS(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-400 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                    Width (cm)
                  </label>
                  <input
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                    Depth (cm)
                  </label>
                  <input
                    type="number"
                    value={depthCm}
                    onChange={(e) => setDepthCm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Product Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !file || !name}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl active:scale-95 transition-all text-sm shadow-lg shadow-emerald-500/30 disabled:opacity-50 mt-4"
              >
                {loading ? "Generating 3D Model..." : "⚡ Generate 3D AR Asset"}
              </button>
            </form>
          </GlassPanel>

          {/* Live Preview & Integration Code */}
          <GlassPanel className="p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span>👁</span> Instant 3D Preview
              </h2>
              {previewUrl ? (
                <div className="w-full aspect-square rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden flex items-center justify-center p-4">
                  <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center text-slate-500 p-6 text-center text-xs">
                  Upload a 2D product photo to generate 1:1 scale 3D GLB model
                </div>
              )}
            </div>

            {result && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl text-xs space-y-2">
                <div className="font-bold text-emerald-300">✅ 3D Model Published Successfully!</div>
                <div className="text-slate-300 font-mono text-[11px] break-all bg-black/40 p-2 rounded-lg">
                  {result.product.modelUrl}
                </div>
                <div className="text-slate-400 text-[11px]">B2B 1-Line Embed Code:</div>
                <input
                  type="text"
                  readOnly
                  value={result.embedScript}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full p-2 bg-black/60 border border-white/10 rounded-lg text-emerald-400 font-mono text-[10px]"
                />
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
