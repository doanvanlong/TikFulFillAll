import React, { useState } from 'react';
import { GarmentType } from '../types/order';

export const GARMENT_COLOR_MAP: Record<string, { hex: string; border: string; textDark: boolean; labelVi: string }> = {
  'black': { hex: '#18181B', border: '#27272A', textDark: false, labelVi: 'Đen (Black)' },
  'sand': { hex: '#DDD3C2', border: '#C6B8A3', textDark: true, labelVi: 'Cát (Sand)' },
  'light pink': { hex: '#F9D6E2', border: '#EBB8CA', textDark: true, labelVi: 'Hồng nhạt (Light Pink)' },
  'white': { hex: '#FAFAFA', border: '#E4E4E7', textDark: true, labelVi: 'Trắng (White)' },
  'military green': { hex: '#4D563B', border: '#3B422C', textDark: false, labelVi: 'Xanh lính (Military Green)' },
  'ash': { hex: '#D4D5D9', border: '#B8BAC0', textDark: true, labelVi: 'Xám tro (Ash)' },
  'light blue': { hex: '#BFDCEB', border: '#9CC4DA', textDark: true, labelVi: 'Xanh nhạt (Light Blue)' },
  'orange': { hex: '#E06324', border: '#C24E15', textDark: false, labelVi: 'Cam thu (Orange)' },
  'navy': { hex: '#1E293B', border: '#0F172A', textDark: false, labelVi: 'Xanh Navy' },
  'maroon': { hex: '#5C1D24', border: '#421218', textDark: false, labelVi: 'Đỏ đô (Maroon)' },
};

export function getGarmentColorInfo(colorName: string) {
  const key = (colorName || '').trim().toLowerCase();
  return GARMENT_COLOR_MAP[key] || {
    hex: '#E4E4E7',
    border: '#D4D4D8',
    textDark: true,
    labelVi: colorName || 'Mặc định',
  };
}

interface GarmentPreviewProps {
  productName: string;
  sku: string;
  color: string;
  size?: string;
  productType?: GarmentType;
  side?: 'front' | 'back';
  customImageUrl?: string;
  sizeMode?: 'sm' | 'md' | 'lg';
}

export const GarmentPreview: React.FC<GarmentPreviewProps> = ({
  productName,
  sku,
  color,
  size = 'L',
  productType = 'T-Shirt',
  side = 'front',
  customImageUrl,
  sizeMode = 'md',
}) => {
  const [imgError, setImgError] = useState(false);
  const colorInfo = getGarmentColorInfo(color);
  const isDirectImage =
    customImageUrl &&
    !imgError &&
    (customImageUrl.startsWith('data:image/') ||
      /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(customImageUrl)) &&
    !customImageUrl.includes('ttcdn-us.com') &&
    !customImageUrl.includes('drive.google.com');

  const lowerTitle = (productName + ' ' + sku).toLowerCase();
  const isSweatshirt = productType === 'Sweatshirt' || lowerTitle.includes('sweatshirt') || sku.startsWith('S-');

  const renderGraphicArtwork = () => {
    const inkColor = colorInfo.textDark ? '#18181B' : '#F8FAFC';
    const accentColor = colorInfo.textDark ? '#B91C1C' : '#FBBF24';

    if (side === 'back') {
      if (lowerTitle.includes('redfish') || sku.includes('73326023411')) {
        return (
          <div className="flex flex-col items-center justify-center text-center px-1 select-none">
            <span className="text-[7px] font-extrabold tracking-widest uppercase" style={{ color: inkColor }}>
              SOUTHERN COASTAL
            </span>
            <svg viewBox="0 0 60 32" className="w-10 h-6 my-0.5">
              <path
                d="M8 16 C18 6, 36 6, 48 16 C52 12, 57 9, 58 8 L56 16 L58 24 C57 23, 52 20, 48 16 C36 26, 18 26, 8 16 Z"
                fill="#C2410C"
                stroke={inkColor}
                strokeWidth="1.5"
              />
              <circle cx="49" cy="14" r="2.2" fill="#18181B" />
            </svg>
            <span className="text-[6.5px] font-bold tracking-wider uppercase" style={{ color: inkColor }}>
              REDFISH TAIL CLUB
            </span>
          </div>
        );
      }

      if (lowerTitle.includes('boobie') || sku.includes('64479233969')) {
        return (
          <div className="flex flex-col items-center justify-center text-center px-1 select-none">
            <span className="text-[7px] font-extrabold tracking-tight uppercase" style={{ color: '#DB2777' }}>
              SHOW ME YOUR
            </span>
            <span className="text-[9px] font-black tracking-wider uppercase leading-none my-0.5" style={{ color: inkColor }}>
              BOOBIES
            </span>
            <span className="text-[6px] font-semibold" style={{ color: inkColor }}>
              FOOTBALL SEASON CLUB
            </span>
          </div>
        );
      }

      if (lowerTitle.includes('duck') || sku.includes('32148963740') || sku.includes('70904613480')) {
        return (
          <div className="flex flex-col items-center justify-center text-center px-1 select-none">
            <span className="text-[6.5px] font-extrabold tracking-widest uppercase" style={{ color: inkColor }}>
              SOUTHERN MARSH
            </span>
            <svg viewBox="0 0 48 28" className="w-9 h-5 my-0.5">
              <path
                d="M6 18 C14 14, 22 10, 32 6 L28 14 L42 12 C34 18, 22 22, 10 22 Z"
                fill={accentColor}
              />
            </svg>
            <span className="text-[6.5px] font-bold uppercase" style={{ color: inkColor }}>
              WATERFOWL OUTFITTERS
            </span>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center text-center px-1 select-none opacity-80">
          <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: inkColor }}>
            BACK PRINT
          </span>
          <span className="text-[6px] font-mono" style={{ color: inkColor }}>
            4500×5400px
          </span>
        </div>
      );
    }

    // Front graphics
    if (lowerTitle.includes('dachshund') || sku.includes('20382627295')) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-1 select-none">
          <span className="text-[6.5px] font-extrabold tracking-wider uppercase leading-tight" style={{ color: inkColor }}>
            DACHSHUND
          </span>
          <svg viewBox="0 0 60 24" className="w-9 h-4 my-0.5">
            <path
              d="M8 14 L15 9 L20 11 L42 11 L48 7 L51 9 L47 14 L48 20 L44 20 L43 16 L21 16 L20 20 L16 20 L17 15 L10 16 Z"
              fill={accentColor}
            />
          </svg>
          <span className="text-[6.5px] font-black tracking-widest uppercase leading-none" style={{ color: inkColor }}>
            DAD CLUB
          </span>
        </div>
      );
    }

    if (lowerTitle.includes('boobie') || sku.includes('64479233969')) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-1 select-none">
          <span className="text-[7px] font-black uppercase leading-tight" style={{ color: '#BE185D' }}>
            BOO-BIE
          </span>
          <span className="text-[6px] font-bold uppercase" style={{ color: inkColor }}>
            CREW EST. 2026
          </span>
        </div>
      );
    }

    if (lowerTitle.includes('racist') || sku.includes('33676946018')) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-1 select-none leading-tight">
          <span className="text-[6px] font-black uppercase" style={{ color: inkColor }}>
            WHY BE RACIST,
          </span>
          <span className="text-[6px] font-black uppercase" style={{ color: '#DC2626' }}>
            SEXIST, HOMOPHOBIC
          </span>
          <span className="text-[5.5px] font-bold uppercase" style={{ color: inkColor }}>
            WHEN YOU COULD BE QUIET?
          </span>
        </div>
      );
    }

    if (lowerTitle.includes('thankful') || sku.startsWith('s-')) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-1 select-none">
          <span className="text-[8px] font-black italic tracking-wide" style={{ color: '#FEF3C7' }}>
            Thankful
          </span>
          <span className="text-[5.5px] font-semibold uppercase tracking-widest" style={{ color: '#FDE68A' }}>
            GRATEFUL · BLESSED
          </span>
        </div>
      );
    }

    if (lowerTitle.includes('redfish') || lowerTitle.includes('duck')) {
      return (
        <div className="flex flex-col items-end justify-start w-full px-2 pt-0.5 select-none">
          <div
            className="w-4 h-4 rounded-sm border flex items-center justify-center text-[5px] font-black"
            style={{ borderColor: inkColor, color: inkColor }}
          >
            SC
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center text-center select-none">
        <span className="text-[7px] font-bold uppercase" style={{ color: inkColor }}>
          POD DESIGN
        </span>
      </div>
    );
  };

  const dimensions =
    sizeMode === 'sm'
      ? 'w-11 h-11'
      : sizeMode === 'lg'
      ? 'w-44 h-44'
      : 'w-28 h-28';

  return (
    <div
      className={`relative ${dimensions} rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center overflow-hidden shrink-0 select-none`}
      title={`${productName} (${color}, ${size}) - ${side === 'front' ? 'Mặt trước' : 'Mặt sau'}`}
    >
      {isDirectImage ? (
        <img
          src={customImageUrl}
          alt={`${productName} - ${side}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center p-1">
          {/* Vector T-Shirt or Crewneck Sweatshirt Silhouette */}
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
          >
            {isSweatshirt ? (
              /* Crewneck Sweatshirt Path */
              <g>
                <path
                  d="M36 18 L46 15 C52 21, 68 21, 74 15 L84 18 L108 42 L98 54 L86 42 L86 104 L34 104 L34 42 L22 54 L12 42 Z"
                  fill={colorInfo.hex}
                  stroke={colorInfo.border}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Ribbed Collar & Hem */}
                <path
                  d="M46 15 C52 23, 68 23, 74 15"
                  fill="none"
                  stroke={colorInfo.border}
                  strokeWidth="3"
                />
                <line x1="34" y1="98" x2="86" y2="98" stroke={colorInfo.border} strokeWidth="2" />
              </g>
            ) : (
              /* Classic Gildan 5000 Unisex T-Shirt Path */
              <g>
                <path
                  d="M35 16 L47 13 C52 20, 68 20, 73 13 L85 16 L108 34 L96 49 L85 40 L85 105 L35 105 L35 40 L24 49 L12 34 Z"
                  fill={colorInfo.hex}
                  stroke={colorInfo.border}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Collar detail */}
                {side === 'front' ? (
                  <path
                    d="M45 14 C51 24, 69 24, 75 14"
                    fill="none"
                    stroke={colorInfo.border}
                    strokeWidth="2.5"
                  />
                ) : (
                  <path
                    d="M46 14 C53 18, 67 18, 74 14"
                    fill="none"
                    stroke={colorInfo.border}
                    strokeWidth="2.5"
                  />
                )}
              </g>
            )}
          </svg>

          {/* Artwork Overlay Zone on Chest / Back */}
          <div
            className={`absolute flex items-center justify-center pointer-events-none ${
              sizeMode === 'sm' ? 'scale-[0.52] w-16 h-12 top-3' : sizeMode === 'lg' ? 'scale-125 w-24 h-20 top-12' : 'w-20 h-16 top-7'
            }`}
          >
            {renderGraphicArtwork()}
          </div>
        </div>
      )}

      {/* Subtle Corner Side Indicator for Medium/Large Previews */}
      {sizeMode !== 'sm' && (
        <span className="absolute bottom-1 right-1.5 text-[10px] font-mono font-semibold text-[#52525B] bg-white/85 px-1 rounded">
          {side === 'front' ? 'FRONT' : 'BACK'}
        </span>
      )}
    </div>
  );
};
