'use client';

import { useState } from 'react';
import { MonitorSmartphone, RotateCcw, Smartphone } from 'lucide-react';

const devices = [
  { label: 'iPhone SE', width: 375, height: 667 },
  { label: 'iPhone 14', width: 390, height: 844 },
  { label: 'iPhone Pro Max', width: 430, height: 932 },
] as const;

export default function MobilePreviewPage() {
  const [deviceIndex, setDeviceIndex] = useState(1);
  const [portrait, setPortrait] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const device = devices[deviceIndex];
  const width = portrait ? device.width : device.height;
  const height = portrait ? device.height : device.width;

  return (
    <main className="mobile-preview-page">
      <header className="mobile-preview-toolbar">
        <div>
          <span>
            <MonitorSmartphone size={20} />
          </span>
          <div>
            <strong>Infonits mobile preview</strong>
            <small>Use the app inside the phone and attach comments to any UI issue.</small>
          </div>
        </div>
        <div className="mobile-preview-controls">
          <label>
            <span>Device</span>
            <select
              value={deviceIndex}
              onChange={(event) => setDeviceIndex(Number(event.target.value))}
            >
              {devices.map((item, index) => (
                <option value={index} key={item.label}>
                  {item.label} · {item.width}px
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setPortrait((value) => !value)}>
            <Smartphone size={16} /> {portrait ? 'Landscape' : 'Portrait'}
          </button>
          <button type="button" onClick={() => setFrameKey((value) => value + 1)}>
            <RotateCcw size={16} /> Refresh
          </button>
        </div>
      </header>
      <section className="mobile-preview-stage" aria-label={`${device.label} preview`}>
        <div className="mobile-device-shell" style={{ width: width + 20 }}>
          <div className="mobile-device-speaker" aria-hidden="true" />
          <iframe
            key={frameKey}
            title="Infonits Finance mobile workspace"
            src="/local?mobile-preview=1"
            style={{ width, height }}
          />
        </div>
        <p>
          {device.label} · {width} × {height}px · {portrait ? 'Portrait' : 'Landscape'}
        </p>
      </section>
    </main>
  );
}
