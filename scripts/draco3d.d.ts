declare module "draco3d" {
  export interface DracoModule {
    createEncoderModule(): Promise<{
      create: (attributes: number) => void;
      destroy: () => void;
    }>;
    createDecoderModule(): Promise<{
      create: () => void;
      destroy: () => void;
    }>;
  }

  const draco3d: DracoModule;
  export default draco3d;
}
