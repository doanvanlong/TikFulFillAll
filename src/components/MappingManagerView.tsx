import React, { useState } from 'react';
import { Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  GarmentType,
  PrintSides,
  SkuDesignItem,
  SupplierName,
  VariantMappingRule,
} from '../types/order';
import { GarmentPreview, getGarmentColorInfo } from './GarmentPreview';

interface VariantManagerProps {
  variantMappings: VariantMappingRule[];
  onAddRule: (rule: VariantMappingRule) => void;
  onDeleteRule: (id: string) => void;
  onSyncAllVariantsToOrders: () => void;
}

export const VariantMappingView: React.FC<VariantManagerProps> = ({
  variantMappings,
  onAddRule,
  onDeleteRule,
  onSyncAllVariantsToOrders,
}) => {
  const [supplier, setSupplier] = useState<SupplierName>('Merchize');
  const [productType, setProductType] = useState<GarmentType>('T-Shirt');
  const [color, setColor] = useState('Black');
  const [size, setSize] = useState('L');
  const [variantId, setVariantId] = useState('');
  const [baseCost, setBaseCost] = useState('6.45');
  const [syncedFeedback, setSyncedFeedback] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId.trim()) return;
    onAddRule({
      id: `vm-${Date.now()}`,
      supplier,
      productType,
      color: color.trim(),
      size: size.trim().toUpperCase(),
      variantId: variantId.trim(),
      baseCost: parseFloat(baseCost) || 6.45,
    });
    setVariantId('');
  };

  const handleTriggerSync = () => {
    onSyncAllVariantsToOrders();
    setSyncedFeedback(true);
    setTimeout(() => setSyncedFeedback(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8ED]">
        <div>
          <h2 className="text-lg font-bold text-[#121212] tracking-tight">
            Bảng Quy Đổi Mã Variant ID Nhà In (Variant Mapping)
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Thiết lập sẵn mã Variant ID theo từng Màu + Size (VD: <code className="font-mono">Black, L</code> → <code className="font-mono">MZ-G5000-BLK-L</code>) để tự động điền khi có đơn mới từ Google Sheet.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTriggerSync}
          className="px-4 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {syncedFeedback ? (
            <>
              <Check className="w-4 h-4" />
              Đã đồng bộ Variant ID vào tất cả đơn!
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Áp dụng bảng Variant cho toàn bộ đơn hàng
            </>
          )}
        </button>
      </div>

      {/* Add new Variant Rule Form */}
      <form
        onSubmit={handleAdd}
        className="p-4 bg-white border border-[#E4E4E7] rounded-xl grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">
            Nhà in
          </label>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value as SupplierName)}
            className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
          >
            <option value="Merchize">Merchize</option>
            <option value="Gearment">Gearment</option>
            <option value="Printify">Printify</option>
            <option value="BurgerPrints">BurgerPrints</option>
            <option value="Custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">
            Dòng áo
          </label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value as GarmentType)}
            className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
          >
            <option value="T-Shirt">T-Shirt</option>
            <option value="Sweatshirt">Sweatshirt</option>
            <option value="Hoodie">Hoodie</option>
            <option value="Comfort Colors">Comfort Colors</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">
            Màu sắc (Color)
          </label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Black, Sand..."
            className="w-full px-3 py-2 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">
            Size
          </label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="S, M, L, XL..."
            className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121212] mb-1">
            Mã Variant ID *
          </label>
          <input
            type="text"
            required
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            placeholder="MZ-G5000-BLK-L"
            className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20">
            <label className="block text-xs font-semibold text-zinc-600 mb-1">
              Cost ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={baseCost}
              onChange={(e) => setBaseCost(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="flex-1 py-2 px-3 bg-[#121212] text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white border border-[#E4E4E7] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F1F1F4] border-b border-[#E4E4E7] text-zinc-600 font-bold">
              <th className="py-3 px-4">Nhà in</th>
              <th className="py-3 px-4">Dòng sản phẩm</th>
              <th className="py-3 px-4">Màu áo (Color)</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Variant ID</th>
              <th className="py-3 px-4 text-right">Chi phí Base Cost</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E8ED]">
            {variantMappings.map((rule) => {
              const cInfo = getGarmentColorInfo(rule.color);
              return (
                <tr key={rule.id} className="hover:bg-zinc-50/80">
                  <td className="py-2.5 px-4 font-semibold text-[#121212]">
                    {rule.supplier}
                  </td>
                  <td className="py-2.5 px-4 text-zinc-600">{rule.productType}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-xs border shrink-0"
                        style={{
                          backgroundColor: cInfo.hex,
                          borderColor: cInfo.border,
                        }}
                      />
                      <span className="font-medium text-[#121212]">
                        {rule.color}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#121212]">
                    {rule.size}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#FE2C55]">
                    {rule.variantId}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#121212]">
                    ${rule.baseCost.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Xóa mã này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface SkuDesignManagerProps {
  skuDesigns: SkuDesignItem[];
  onUpdateSkuDesign: (updated: SkuDesignItem) => void;
  onSyncAllDesignsToOrders: () => void;
}

export const SkuDesignLibraryView: React.FC<SkuDesignManagerProps> = ({
  skuDesigns,
  onUpdateSkuDesign,
  onSyncAllDesignsToOrders,
}) => {
  const [syncedFeedback, setSyncedFeedback] = useState(false);

  const handleSync = () => {
    onSyncAllDesignsToOrders();
    setSyncedFeedback(true);
    setTimeout(() => setSyncedFeedback(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E8ED]">
        <div>
          <h2 className="text-lg font-bold text-[#121212] tracking-tight">
            Thư Viện File In Theo Mã SKU (Design Front / Back / Mockup)
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Quản lý tập trung link Design Front, Design Back và Mockup theo từng mã SKU cột I (VD: <code className="font-mono">T_20382627295_1M</code>, <code className="font-mono">T_73326023411_2M</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          className="px-4 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {syncedFeedback ? (
            <>
              <Check className="w-4 h-4" />
              Đã đồng bộ Design cho toàn bộ đơn!
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Đồng bộ Design Front/Back vào tất cả đơn cùng SKU
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {skuDesigns.map((item) => (
          <div
            key={item.sku}
            className="p-4 bg-white border border-[#E4E4E7] rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center"
          >
            <div className="flex items-center gap-3 shrink-0">
              <GarmentPreview
                productName={item.title}
                sku={item.sku}
                color={item.sku.startsWith('S-') ? 'Orange' : 'Black'}
                productType={item.productType}
                side="front"
                sizeMode="sm"
              />
              {item.printSides === '2M' && (
                <GarmentPreview
                  productName={item.title}
                  sku={item.sku}
                  color="Military Green"
                  productType={item.productType}
                  side="back"
                  sizeMode="sm"
                />
              )}
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
              <div className="sm:col-span-3">
                <div className="text-[11px] font-semibold text-zinc-500">
                  Mã SKU (Cột I) · {item.printSides}
                </div>
                <div className="font-mono text-xs font-bold text-[#121212] mt-0.5">
                  {item.sku}
                </div>
                <div className="text-xs text-zinc-600 truncate mt-0.5" title={item.title}>
                  {item.title}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Link Design Front (Mặt trước)
                </label>
                <input
                  type="text"
                  value={item.designFront}
                  onChange={(e) =>
                    onUpdateSkuDesign({ ...item, designFront: e.target.value })
                  }
                  placeholder="https://drive.google.com/..."
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:bg-white focus:border-[#121212] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Link Design Back (Mặt sau)
                </label>
                <input
                  type="text"
                  value={item.designBack}
                  onChange={(e) =>
                    onUpdateSkuDesign({ ...item, designBack: e.target.value })
                  }
                  placeholder={
                    item.printSides === '2M'
                      ? 'Nhập link mặt sau (_2M)...'
                      : 'Không bắt buộc (_1M)'
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:bg-white focus:border-[#121212] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Số mặt in
                </label>
                <select
                  value={item.printSides}
                  onChange={(e) =>
                    onUpdateSkuDesign({
                      ...item,
                      printSides: e.target.value as PrintSides,
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                >
                  <option value="1M">1 Mặt (1M)</option>
                  <option value="2M">2 Mặt (2M)</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
