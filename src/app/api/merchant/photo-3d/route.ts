import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const name = (formData.get("name") as string) || "Merchant Product";
    const widthCm = Number(formData.get("widthCm") || 100);
    const heightCm = Number(formData.get("heightCm") || 80);
    const depthCm = Number(formData.get("depthCm") || 90);
    const priceUZS = Number(formData.get("priceUZS") || 1200000);

    if (!image) {
      return NextResponse.json({ error: "No product image uploaded" }, { status: 400 });
    }

    const publicMerchantDir = path.join(process.cwd(), "public", "models", "merchant");
    fs.mkdirSync(publicMerchantDir, { recursive: true });

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36);
    const modelFileName = `${slug}.glb`;
    const modelPath = path.join(publicMerchantDir, modelFileName);

    // Fallback/Demo 3D Model Generation:
    // In production, this step invokes Tripo3D/Meshy/Rembg API. Here we copy a clean base model
    // and tag it with merchant physical dimensions (width, height, depth in meters).
    const sampleModel = path.join(process.cwd(), "public", "models", "demo", "demo-001.glb");
    if (fs.existsSync(sampleModel)) {
      fs.copyFileSync(sampleModel, modelPath);
    } else {
      fs.writeFileSync(modelPath, Buffer.from("GLTF placeholder"));
    }

    const widthM = widthCm / 100;
    const heightM = heightCm / 100;
    const depthM = depthCm / 100;

    const productRecord = {
      id: slug,
      name,
      nameUz: name,
      priceUZS,
      store: "merchant",
      modelUrl: `/models/merchant/${modelFileName}`,
      dimensions: { w: widthM, h: heightM, d: depthM },
      productClass: "mass",
      placement: "floor",
      createdAt: new Date().toISOString(),
    };

    const appHost = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "https://roomai.uz";

    return NextResponse.json({
      success: true,
      product: productRecord,
      embedScript: `<script src="${appHost}/embed.js" data-product-id="${slug}"></script>`,
    });
  } catch (error: unknown) {
    console.error("[Photo-to-3D API Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to process photo to 3D";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
