'use client';

import QRCode from 'react-qr-code';

export default function VerifyQr({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        QR Verification
      </p>
      <div className="rounded-lg bg-white p-2">
        <QRCode value={value} size={148} level="H" />
      </div>
      <p className="text-[11px] text-slate-500 text-center">
        Scannez pour verifier ce bulletin
      </p>
    </div>
  );
}
