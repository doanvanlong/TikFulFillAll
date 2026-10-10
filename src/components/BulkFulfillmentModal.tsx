import React, { useState } from 'react';
import { Check, Layers, X } from 'lucide-react';
import { GarmentType, PodOrder, PrintSides, SupplierName } from '../types/order';

interface BulkFulfillmentModalProps {
  selectedOrders: PodOrder[];
  onClose: () => void;
  onApplyBulk: (updates: {
    variantId?: string;
    designFront?: string;
    designBack?: string;
    mockupUrl?: string;
    quantity?: number;
    labelUrl?: string;
    supplier?: SupplierName;
    productType?: GarmentType;
    printSides?: PrintSides;
    fulfilled?: boolean;
    note?: string;
  }) => void;
}

export const BulkFulfillmentModal: React.FC<BulkFulfillmentModalProps> = ({
  selectedOrders,
  onClose,
  onApplyBulk,
}) => {
  const [variantId, setVariantId] = useState('');
  const [designFront, setDesignFront] = useState('');
  const [designBack, setDesignBack] = useState('');
  const [mockupUrl, setMockupUrl] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [labelUrl, setLabelUrl] = useState('');
  const [supplier, setSupplier] = useState<string>('');
  const [printSides, setPrintSides] = useState<string>('');
  const [fulfilledState, setFulfilledState] = useState<string>('true');
  const [note, setNote] = useState('');

  if (selectedOrders.length === 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Parameters<typeof onApplyBulk>[0] = {};
    if (variantId.trim()) updates.variantId = variantId.trim();
    if (designFront.trim()) updates.designFront = designFront.trim();
    if (designBack.trim()) updates.designBack = designBack.trim();
    if (mockupUrl.trim()) updates.mockupUrl = mockupUrl.trim();
    if (quantity.trim() && !isNaN(parseInt(quantity, 10))) {
      updates.quantity = Math.max(1, parseInt(quantity, 10));
    }
    if (labelUrl.trim()) updates.labelUrl = labelUrl.trim();
    if (supplier) updates.supplier = supplier as SupplierName;
    if (printSides) updates.printSides = printSides as PrintSides;
    if (fulfilledState === 'true') updates.fulfilled = true;
    if (fulfilledState === 'false') updates.fulfilled = false;
    if (note.trim()) updates.note = note.trim();

    onApplyBulk(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl border border-[#E4E4E7] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#121212] text-white">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#FE2C55]" />
            <h2 className="text-base font-bold tracking-tight">
              Fulfillment Hàng Loạt ({selectedOrders.length} đơn đã chọn)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-zinc-600">
            Chỉ những trường bạn nhập bên dưới mới được ghi đè lên{' '}
            <strong className="text-[#121212]">{selectedOrders.length} đơn hàng</strong> đã chọn. Các trường để trống sẽ giữ nguyên giá trị cũ của từng đơn.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Variant ID chung
              </label>
              <input
                type="text"
                placeholder="Giữ nguyên nếu trống"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Nhà in (Supplier)
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              >
                <option value="">-- Giữ nguyên --</option>
                <option value="Merchize">Merchize</option>
                <option value="Gearment">Gearment</option>
                <option value="Printify">Printify</option>
                <option value="BurgerPrints">BurgerPrints</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Số lượng (Quantity)
              </label>
              <input
                type="number"
                min={1}
                placeholder="Giữ nguyên"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Design Front URL (Mặt trước)
              </label>
              <input
                type="text"
                placeholder="https://drive.google.com/..."
                value={designFront}
                onChange={(e) => setDesignFront(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Design Back URL (Mặt sau)
              </label>
              <input
                type="text"
                placeholder="https://drive.google.com/..."
                value={designBack}
                onChange={(e) => setDesignBack(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Mockup URL (Cột F)
              </label>
              <input
                type="text"
                placeholder="Giữ nguyên nếu trống"
                value={mockupUrl}
                onChange={(e) => setMockupUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Label URL (Cột K)
              </label>
              <input
                type="text"
                placeholder="Giữ nguyên nếu trống"
                value={labelUrl}
                onChange={(e) => setLabelUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Số mặt in
              </label>
              <select
                value={printSides}
                onChange={(e) => setPrintSides(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              >
                <option value="">-- Giữ nguyên --</option>
                <option value="1M">1 Mặt (_1M)</option>
                <option value="2M">2 Mặt (_2M)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Trạng thái Cột M
              </label>
              <select
                value={fulfilledState}
                onChange={(e) => setFulfilledState(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              >
                <option value="true">Đánh dấu TRUE (Đã Fulfill)</option>
                <option value="false">Đánh dấu FALSE (Chờ xử lý)</option>
                <option value="keep">Giữ nguyên</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">
                Ghi chú nhà in
              </label>
              <input
                type="text"
                placeholder="VD: Lô in ngày 10/10"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-[#D4D4D8] rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Cập nhật {selectedOrders.length} đơn hàng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
