import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  PackageCheck,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  GarmentType,
  PodOrder,
  PrintSides,
  SkuDesignItem,
  SupplierName,
  VariantMappingRule,
} from '../types/order';
import { GarmentPreview, getGarmentColorInfo } from './GarmentPreview';

interface FulfillmentDrawerProps {
  order: PodOrder | null;
  allOrders: PodOrder[];
  variantMappings: VariantMappingRule[];
  skuDesigns: SkuDesignItem[];
  onClose: () => void;
  onSaveOrder: (
    updatedOrder: PodOrder,
    options: {
      syncDesignToSameSku: boolean;
      syncVariantToSameColorSize: boolean;
    }
  ) => void;
  onSelectOrder: (order: PodOrder) => void;
}

const AVAILABLE_COLORS = [
  'Black',
  'White',
  'Sand',
  'Light pink',
  'Military Green',
  'Ash',
  'Light blue',
  'Orange',
  'Navy',
  'Maroon',
];

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const SUPPLIERS: SupplierName[] = ['Merchize', 'Gearment', 'Printify', 'BurgerPrints', 'Custom'];
const GARMENT_TYPES: GarmentType[] = ['T-Shirt', 'Sweatshirt', 'Hoodie', 'Comfort Colors'];

export const FulfillmentDrawer: React.FC<FulfillmentDrawerProps> = ({
  order,
  allOrders,
  variantMappings,
  skuDesigns,
  onClose,
  onSaveOrder,
  onSelectOrder,
}) => {
  const [formData, setFormData] = useState<PodOrder | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [syncDesignToSameSku, setSyncDesignToSameSku] = useState(false);
  const [syncVariantToSameColorSize, setSyncVariantToSameColorSize] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({ ...order });
      setPreviewSide('front');
      setSyncDesignToSameSku(false);
      setSyncVariantToSameColorSize(false);
      setSaveFeedback(false);
    }
  }, [order]);

  if (!order || !formData) return null;

  const currentIndex = allOrders.findIndex((o) => o.id === order.id);
  const prevOrder = currentIndex > 0 ? allOrders[currentIndex - 1] : null;
  const nextOrder =
    currentIndex >= 0 && currentIndex < allOrders.length - 1
      ? allOrders[currentIndex + 1]
      : null;

  const sameSkuCount = allOrders.filter(
    (o) => o.sku.trim() !== '' && o.sku === formData.sku
  ).length;

  const sameVariationCount = allOrders.filter(
    (o) =>
      o.color.toLowerCase() === formData.color.toLowerCase() &&
      o.size.toLowerCase() === formData.size.toLowerCase()
  ).length;

  const extractDriveFileId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const lookupVariantId = (
    supplier: SupplierName,
    productType: GarmentType,
    color: string,
    size: string
  ) => {
    const exactMatch = variantMappings.find(
      (m) =>
        m.supplier === supplier &&
        m.productType === productType &&
        m.color.toLowerCase() === color.toLowerCase() &&
        m.size.toLowerCase() === size.toLowerCase()
    );
    if (exactMatch) {
      return { variantId: exactMatch.variantId, baseCost: exactMatch.baseCost };
    }

    const anySupplierMatch = variantMappings.find(
      (m) =>
        m.color.toLowerCase() === color.toLowerCase() &&
        m.size.toLowerCase() === size.toLowerCase() &&
        m.productType === productType
    );
    if (anySupplierMatch) {
      return {
        variantId: anySupplierMatch.variantId,
        baseCost: anySupplierMatch.baseCost,
      };
    }

    // Generate standardized code if not in custom table
    const prefix =
      supplier === 'Merchize'
        ? 'MZ'
        : supplier === 'Gearment'
        ? 'GM'
        : supplier === 'Printify'
        ? 'PF'
        : supplier === 'BurgerPrints'
        ? 'BP'
        : 'CS';
    const garmentCode =
      productType === 'Sweatshirt'
        ? 'G18000'
        : productType === 'Hoodie'
        ? 'G18500'
        : productType === 'Comfort Colors'
        ? 'CC1717'
        : 'G5000';
    const colorShort = color
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase();
    const basePrice =
      productType === 'Sweatshirt'
        ? 13.5
        : size.includes('4XL') || size.includes('3XL')
        ? 9.5
        : size === 'XL' || size === '2XL'
        ? 6.85
        : 6.45;

    return {
      variantId: `${prefix}-${garmentCode}-${colorShort}-${size.toUpperCase()}`,
      baseCost: basePrice,
    };
  };

  const handleAutoFillVariant = () => {
    const result = lookupVariantId(
      formData.supplier,
      formData.productType,
      formData.color,
      formData.size
    );
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            variantId: result.variantId,
            baseCost: result.baseCost,
          }
        : null
    );
  };

  const handleAutoFillSkuDesign = () => {
    const preset = skuDesigns.find(
      (d) => d.sku.toLowerCase() === formData.sku.toLowerCase()
    );
    if (preset) {
      setFormData((prev) =>
        prev
          ? {
              ...prev,
              designFront: preset.designFront || prev.designFront,
              designBack: preset.designBack || prev.designBack,
              mockupUrl: preset.defaultMockup || prev.mockupUrl,
              printSides: preset.printSides,
              productType: preset.productType,
            }
          : null
      );
    }
  };

  const handleColorOrSizeChange = (newColor: string, newSize: string) => {
    const newVariation = `${newColor}, ${newSize}`;
    const autoMapped = lookupVariantId(
      formData.supplier,
      formData.productType,
      newColor,
      newSize
    );
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            color: newColor,
            size: newSize,
            variation: newVariation,
            variantId: autoMapped.variantId,
            baseCost: autoMapped.baseCost,
          }
        : null
    );
  };

  const handleSubmit = (andNext: boolean) => {
    if (!formData) return;
    const nowStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const finalOrder: PodOrder = {
      ...formData,
      variation: `${formData.color}, ${formData.size}`,
      updatedAt: nowStr,
    };

    onSaveOrder(finalOrder, {
      syncDesignToSameSku,
      syncVariantToSameColorSize,
    });

    if (andNext && nextOrder) {
      onSelectOrder(nextOrder);
    } else {
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 1800);
    }
  };

  const labelDriveId = extractDriveFileId(formData.labelUrl);
  const colorInfo = getGarmentColorInfo(formData.color);
  const isMissingBackWarning =
    (formData.printSides === '2M' || formData.sku.endsWith('_2M')) &&
    !formData.designBack.trim();
  const estProfit =
    formData.price * formData.quantity - formData.baseCost * formData.quantity;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px] transition-opacity">
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl border-l border-[#E4E4E7] flex flex-col overflow-hidden">
        {/* Top Drawer Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121212] text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-semibold text-[#25F4EE] tracking-tight whitespace-nowrap">
              STT #{formData.stt}
            </span>
            <span className="text-white/30">·</span>
            <h2 className="text-base font-bold tracking-tight truncate">
              Fulfillment Order {formData.orderId}
            </h2>
            <span className="text-white/30">·</span>
            <span className="text-xs text-zinc-300 whitespace-nowrap">
              Shop {formData.shopCode}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!prevOrder}
              onClick={() => prevOrder && onSelectOrder(prevOrder)}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
              title="Đơn trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums text-zinc-300 px-1">
              {currentIndex + 1}/{allOrders.length}
            </span>
            <button
              type="button"
              disabled={!nextOrder}
              onClick={() => nextOrder && onSelectOrder(nextOrder)}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
              title="Đơn tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Overview Strip: Live Garment Mockup + Core Product Details */}
          <div className="flex flex-col sm:flex-row gap-5 pb-6 border-b border-[#E8E8ED]">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <GarmentPreview
                productName={formData.productName}
                sku={formData.sku}
                color={formData.color}
                size={formData.size}
                productType={formData.productType}
                side={previewSide}
                customImageUrl={
                  previewSide === 'front'
                    ? formData.designFront || formData.mockupUrl
                    : formData.designBack
                }
                sizeMode="md"
              />
              <div className="flex items-center gap-1 bg-[#F1F1F4] p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setPreviewSide('front')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    previewSide === 'front'
                      ? 'bg-white text-[#121212] shadow-xs'
                      : 'text-zinc-600 hover:text-[#121212]'
                  }`}
                >
                  Mặt trước
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSide('back')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    previewSide === 'back'
                      ? 'bg-white text-[#121212] shadow-xs'
                      : 'text-zinc-600 hover:text-[#121212]'
                  }`}
                >
                  Mặt sau
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">
                  Tên sản phẩm trên TikTok Shop (Cột E)
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212] focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    Mã SKU / Design (Cột I)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => {
                        const val = e.target.value;
                        const detectedSides: PrintSides = val.endsWith('_2M')
                          ? '2M'
                          : '1M';
                        setFormData({
                          ...formData,
                          sku: val,
                          printSides: detectedSides,
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    Ngày đặt / Ngày đi đơn
                  </label>
                  <div className="px-2.5 py-1.5 text-xs font-mono tabular-nums text-zinc-700 bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg">
                    {formData.orderDate} → {formData.fulfillDate}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    Trạng thái (Cột M)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, fulfilled: !formData.fulfilled })
                    }
                    className={`w-full px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      formData.fulfilled
                        ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#15803D]'
                        : 'bg-amber-50 border-amber-300 text-amber-800'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {formData.fulfilled ? 'TRUE · Đã Fulfill' : 'FALSE · Chờ xử lý'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Variant ID, Supplier, Color, Size, Quantity */}
          <div className="space-y-4 pb-6 border-b border-[#E8E8ED]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#121212] tracking-tight">
                1. Cấu hình Variant ID, Phân loại & Số lượng
              </h3>
              <button
                type="button"
                onClick={handleAutoFillVariant}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FE2C55] hover:text-[#D91B42] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tự động lấy mã Variant theo Màu/Size
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Variant ID Input */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-[#121212] mb-1">
                  Variant ID (Mã nhà in) <span className="text-[#FE2C55]">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="VD: MZ-G5000-BLK-L hoặc 40128592"
                    value={formData.variantId}
                    onChange={(e) =>
                      setFormData({ ...formData, variantId: e.target.value })
                    }
                    className={`w-full pl-3 pr-8 py-2 text-xs font-mono font-semibold rounded-lg border focus:outline-none transition-colors ${
                      !formData.variantId.trim()
                        ? 'bg-amber-50/70 border-amber-400 text-[#121212]'
                        : 'bg-white border-[#121212] text-[#121212]'
                    }`}
                  />
                  {formData.variantId && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.variantId, 'variantId')}
                      className="absolute right-2 text-zinc-400 hover:text-[#121212] cursor-pointer"
                      title="Copy Variant ID"
                    >
                      {copiedField === 'variantId' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Supplier Selector */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Nhà in (Fulfillment Supplier)
                </label>
                <select
                  value={formData.supplier}
                  onChange={(e) => {
                    const nextSupplier = e.target.value as SupplierName;
                    const mapped = lookupVariantId(
                      nextSupplier,
                      formData.productType,
                      formData.color,
                      formData.size
                    );
                    setFormData({
                      ...formData,
                      supplier: nextSupplier,
                      variantId: mapped.variantId,
                      baseCost: mapped.baseCost,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                >
                  {SUPPLIERS.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>

              {/* Garment Type */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Dòng sản phẩm
                </label>
                <select
                  value={formData.productType}
                  onChange={(e) => {
                    const nextType = e.target.value as GarmentType;
                    const mapped = lookupVariantId(
                      formData.supplier,
                      nextType,
                      formData.color,
                      formData.size
                    );
                    setFormData({
                      ...formData,
                      productType: nextType,
                      variantId: mapped.variantId,
                      baseCost: mapped.baseCost,
                    });
                  }}
                  className="w-full px-2.5 py-2 text-xs font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                >
                  {GARMENT_TYPES.map((gt) => (
                    <option key={gt} value={gt}>
                      {gt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color, Size, Quantity Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Màu áo (Color - Cột G)
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-md border shrink-0"
                    style={{
                      backgroundColor: colorInfo.hex,
                      borderColor: colorInfo.border,
                    }}
                  />
                  <select
                    value={
                      AVAILABLE_COLORS.find(
                        (c) => c.toLowerCase() === formData.color.toLowerCase()
                      ) || formData.color
                    }
                    onChange={(e) =>
                      handleColorOrSizeChange(e.target.value, formData.size)
                    }
                    className="w-full px-3 py-2 text-xs font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                  >
                    {!AVAILABLE_COLORS.some(
                      (c) => c.toLowerCase() === formData.color.toLowerCase()
                    ) && <option value={formData.color}>{formData.color}</option>}
                    {AVAILABLE_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Kích cỡ (Size - Cột G)
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {AVAILABLE_SIZES.slice(0, 7).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleColorOrSizeChange(formData.color, sz)}
                      className={`px-2 py-1.5 text-xs font-mono font-semibold rounded-md border transition-colors cursor-pointer ${
                        formData.size.toUpperCase() === sz
                          ? 'bg-[#121212] text-white border-[#121212]'
                          : 'bg-[#F8F8FA] text-zinc-700 border-[#E4E4E7] hover:border-zinc-400'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[#121212] mb-1">
                  Quantity (Cột H)
                </label>
                <div className="flex items-center border border-[#E4E4E7] rounded-lg bg-[#F8F8FA] overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        quantity: Math.max(1, formData.quantity - 1),
                      })
                    }
                    className="px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="w-full text-center text-xs font-mono font-bold tabular-nums bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        quantity: formData.quantity + 1,
                      })
                    }
                    className="px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {sameVariationCount > 1 && (
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncVariantToSameColorSize}
                  onChange={(e) => setSyncVariantToSameColorSize(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#FE2C55]"
                />
                <span className="text-xs text-zinc-600">
                  Đồng bộ <strong className="font-mono text-[#121212]">{formData.variantId || 'Variant ID'}</strong> cho tất cả{' '}
                  <strong className="text-[#121212]">{sameVariationCount} đơn</strong> có phân loại{' '}
                  <strong className="text-[#121212]">{formData.color}, {formData.size}</strong>
                </span>
              </label>
            )}
          </div>

          {/* Section 2: Design Front, Design Back & Mockup */}
          <div className="space-y-4 pb-6 border-b border-[#E8E8ED]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-[#121212] tracking-tight">
                  2. File In Design Front, Back & Mockup
                </h3>
                <div className="inline-flex items-center bg-[#F1F1F4] p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, printSides: '1M' })}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      formData.printSides === '1M'
                        ? 'bg-white text-[#121212] shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    1 Mặt (_1M)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, printSides: '2M' })}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      formData.printSides === '2M'
                        ? 'bg-[#121212] text-white shadow-xs'
                        : 'text-zinc-600'
                    }`}
                  >
                    2 Mặt (_2M)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoFillSkuDesign}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#121212] hover:text-[#FE2C55] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FE2C55]" />
                Lấy Design từ Thư viện SKU
              </button>
            </div>

            {/* Design Front */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#121212]">
                  Design Front (Link file in mặt trước - PNG 300DPI / Drive) <span className="text-[#FE2C55]">*</span>
                </label>
                {formData.designFront && (
                  <a
                    href={formData.designFront}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-[#121212]"
                  >
                    Mở link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="text"
                placeholder="https://drive.google.com/file/d/... hoặc link ảnh PNG thiết kế mặt trước"
                value={formData.designFront}
                onChange={(e) =>
                  setFormData({ ...formData, designFront: e.target.value })
                }
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none transition-colors ${
                  !formData.designFront.trim()
                    ? 'bg-amber-50/70 border-amber-400 text-[#121212]'
                    : 'bg-[#F8F8FA] border-[#E4E4E7] focus:bg-white focus:border-[#121212] text-[#121212]'
                }`}
              />
            </div>

            {/* Design Back */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#121212]">
                  Design Back (Link file in mặt sau)
                  {formData.printSides === '2M' && (
                    <span className="ml-1.5 text-[#FE2C55] font-bold">
                      * Bắt buộc cho đơn _2M
                    </span>
                  )}
                </label>
                {formData.designBack && (
                  <a
                    href={formData.designBack}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-[#121212]"
                  >
                    Mở link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="text"
                placeholder={
                  formData.printSides === '2M'
                    ? 'Nhập link Google Drive / PNG mặt sau cho đơn 2 mặt (_2M)...'
                    : 'Để trống nếu áo chỉ in 1 mặt trước (_1M)'
                }
                value={formData.designBack}
                onChange={(e) =>
                  setFormData({ ...formData, designBack: e.target.value })
                }
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none transition-colors ${
                  isMissingBackWarning
                    ? 'bg-rose-50 border-[#FE2C55] text-[#121212]'
                    : 'bg-[#F8F8FA] border-[#E4E4E7] focus:bg-white focus:border-[#121212] text-[#121212]'
                }`}
              />
            </div>

            {/* Mockup URL (Column F) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-600">
                  Mockup URL (Ảnh mẫu sản phẩm - Cột F)
                </label>
                {formData.mockupUrl && (
                  <a
                    href={formData.mockupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-[#121212]"
                  >
                    Xem ảnh gốc <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="text"
                placeholder="https://p16-oec-general-use..."
                value={formData.mockupUrl}
                onChange={(e) =>
                  setFormData({ ...formData, mockupUrl: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212] text-zinc-700"
              />
            </div>

            {sameSkuCount > 1 && (
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncDesignToSameSku}
                  onChange={(e) => setSyncDesignToSameSku(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#FE2C55]"
                />
                <span className="text-xs text-zinc-600">
                  Áp dụng <strong className="text-[#121212]">Design Front / Back & Mockup</strong> này cho tất cả{' '}
                  <strong className="text-[#FE2C55]">{sameSkuCount} đơn</strong> có cùng mã SKU{' '}
                  <strong className="font-mono text-[#121212]">{formData.sku}</strong>
                </span>
              </label>
            )}
          </div>

          {/* Section 3: Shipping Label (Column K), Financials & Note */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#121212] tracking-tight">
              3. Shipping Label PDF (Cột K), Giá & Ghi chú Nhà in
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#121212]">
                  Link Shipping Label Google Drive (Cột K) <span className="text-[#FE2C55]">*</span>
                </label>
                <div className="flex items-center gap-3">
                  {labelDriveId && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Drive ID: {labelDriveId.slice(0, 14)}...
                    </span>
                  )}
                  {formData.labelUrl && (
                    <a
                      href={formData.labelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#FE2C55] hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Mở file PDF Label
                    </a>
                  )}
                </div>
              </div>
              <input
                type="text"
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                value={formData.labelUrl}
                onChange={(e) =>
                  setFormData({ ...formData, labelUrl: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212] text-[#121212]"
              />
            </div>

            {/* Price, Base Cost, Shop Code, Profit */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Doanh thu (Cột J - $)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-semibold tabular-nums bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Chi phí Fulfill ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.baseCost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      baseCost: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-semibold tabular-nums bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Mã Shop (Cột L)
                </label>
                <input
                  type="text"
                  value={formData.shopCode}
                  onChange={(e) =>
                    setFormData({ ...formData, shopCode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-semibold tabular-nums bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Lợi nhuận ròng
                </label>
                <div
                  className={`px-3 py-2 text-xs font-mono font-bold tabular-nums rounded-lg border ${
                    estProfit >= 0
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {estProfit >= 0 ? '+' : ''}${estProfit.toFixed(2)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Ghi chú sản xuất / vị trí in (Fulfillment Note)
              </label>
              <input
                type="text"
                placeholder="VD: In ngực trái 10cm, lưng full 35cm, xé tag cổ..."
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
                className="w-full px-3 py-2 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212] text-[#121212]"
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="px-6 py-4 bg-[#F8F8FA] border-t border-[#E4E4E7] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {saveFeedback ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16A34A]">
                <Check className="w-4 h-4" />
                Đã lưu thông tin Fulfillment!
              </span>
            ) : (
              <span className="text-xs text-zinc-500">
                Cập nhật lần cuối: <span className="font-mono">{formData.updatedAt}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-[#D4D4D8] rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#121212] rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <PackageCheck className="w-4 h-4" />
              Lưu Fulfillment
            </button>

            {nextOrder && (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-4 h-4" />
                Lưu & Qua đơn #{nextOrder.stt}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
