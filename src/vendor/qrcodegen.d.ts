export namespace qrcodegen {
  namespace QrCode {
    class Ecc {
      static readonly LOW: Ecc;
      static readonly MEDIUM: Ecc;
      static readonly QUARTILE: Ecc;
      static readonly HIGH: Ecc;
    }
  }

  class QrSegment {
    static makeBytes(data: Uint8Array): QrSegment;
    static makeAlphanumeric(text: string): QrSegment;
  }

  class QrCode {
    static readonly Ecc: typeof QrCode.Ecc;
    readonly size: number;
    static encodeText(text: string, ecl: QrCode.Ecc): QrCode;
    static encodeSegments(segs: QrSegment[], ecl: QrCode.Ecc): QrCode;
    getModule(x: number, y: number): boolean;
  }
}
