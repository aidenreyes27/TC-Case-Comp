import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Big QR code of this site's address, for judges to scan during the demo.
export default function InviteQR() {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState(null);
  const url = window.location.origin;
  const local = /localhost|127\.0\.0\.1|^http:\/\/(10|192\.168|172\.)/.test(url) || window.location.protocol !== 'https:';
  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: '#16302B', light: '#FFFFFF' } }).then(setImg);
  }, [open, url]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className="btn-dark px-4 py-2 text-sm" onClick={() => setOpen(true)}>Show join QR</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-3xl font-extrabold">Order lunch with us</h2>
            <p className="mt-1 text-ink/60">Scan with your phone camera, then tap Continue with Google to start a crew order.</p>
            {img ? <img src={img} alt={`QR code for ${url}`} className="mx-auto mt-5 w-full max-w-sm" /> : <div className="mx-auto mt-5 aspect-square w-full max-w-sm animate-pulse rounded-xl bg-paper" />}
            <p className="mt-3 break-all font-display text-lg font-bold">{url}</p>
            {local && (
              <p className="mt-3 rounded-lg bg-chile/10 px-3 py-2 text-left text-sm font-bold text-chile">
                Phones can’t open this address. Run <code>npm run tunnel</code> in a second terminal, open the https link it prints on this laptop, and show the QR from there.
              </p>
            )}
            <button className="btn-ghost mt-5" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
