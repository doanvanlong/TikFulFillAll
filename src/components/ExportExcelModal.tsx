import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Check, Copy, Download, FileSpreadsheet, X } from 'lucide-react';
import { ExportLogItem, PodOrder } from '../types/order';

interface ExportExcelModalProps {
  orders: PodOrder[];
  selectedIds: string[];
  onClose: () => void;
  onLogExport: (log: Omit<ExportLogItem, 'id' | 'exportedAt'>) => void;
}

type ExportTemplateType = 'fulfillment_core' | 'google_sheet_full' | 'supplier_pod';
type ScopeType = 'all' | 'selected' | 'fulfilled_only' | 'shop_922' | 'shop_947' | 'shop_949';

export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  orders,
  selectedIds,
  onClose,
  onLogExport,
}) => {
  const [template, setTemplate] = useState<ExportTemplateType>('fulfillment_core');
  const [scope, setScope] = useState<ScopeType>(
    selectedIds.length > 0 ? 'selected' : 'all'
  );
  const [commaDecimalPrice, setCommaDecimalPrice] = useState(true);
  const [copiedTsv, setCopiedTsv] = useState(false);

  const filteredOrders = useMemo(() => {
    switch (scope) {
      case 'selected':
        return orders.filter((o) => selectedIds.includes(o.id));
      case 'fulfilled_only':
        return orders.filter((o) => o.fulfilled);
      case 'shop_922':
        return orders.filter((o) => o.shopCode === '922');
      case 'shop_947':
        return orders.filter((o) => o.shopCode === '947');
      case 'shop_949':
        return orders.filter((o) => o.shopCode === '949');
      default:
        return orders;
    }
  }, [orders, selectedIds, scope]);

  const formatPriceValue = (val: number) => {
    if (commaDecimalPrice) {
      return val.toFixed(2).replace('.', ',');
    }
    return Number(val.toFixed(2));
  };

  const formattedRows = useMemo(() => {
    return filteredOrders.map((o) => {
      if (template === 'fulfillment_core') {
        return {
          STT: o.stt,
          'Order ID': o.orderId,
          'Variant ID': o.variantId,
          'Design Front': o.designFront,
          'Design Back': o.designBack,
          Mockup: o.mockupUrl,
          Quantity: o.quantity,
          Label: o.labelUrl,
          Variation: o.variation,
          Color: o.color,
          Size: o.size,
          SKU: o.sku,
          'Product Name': o.productName,
          Price: formatPriceValue(o.price),
          Shop: o.shopCode,
          Status: o.fulfilled ? 'TRUE' : 'FALSE',
          Note: o.note,
        };
      }

      if (template === 'supplier_pod') {
        return {
          'External Order ID': o.orderId,
          'Variant ID': o.variantId,
          Quantity: o.quantity,
          'Front Artwork URL': o.designFront,
          'Back Artwork URL': o.designBack,
          'Mockup URL': o.mockupUrl,
          'Shipping Label URL': o.labelUrl,
          SKU: o.sku,
          Color: o.color,
          Size: o.size,
          'Product Type': o.productType,
          Supplier: o.supplier,
          'Base Cost ($)': o.baseCost,
          'Production Note': o.note,
        };
      }

      // google_sheet_full (Matches Columns A to M in screenshot + Fulfillment columns)
      return {
        STT: o.stt,
        'Order ID': o.orderId,
        'Order Date': o.orderDate,
        'Fulfill Date': o.fulfillDate,
        'Product Name': o.productName,
        'Mockup Link': o.mockupUrl,
        Variation: o.variation,
        Quantity: o.quantity,
        SKU: o.sku,
        Price: formatPriceValue(o.price),
        'Label Link': o.labelUrl,
        Shop: o.shopCode,
        Status: o.fulfilled ? 'TRUE' : 'FALSE',
        'Variant ID': o.variantId,
        'Design Front': o.designFront,
        'Design Back': o.designBack,
        Supplier: o.supplier,
        Note: o.note,
      };
    });
  }, [filteredOrders, template, commaDecimalPrice]);

  const handleDownload = (format: 'xlsx' | 'csv') => {
    if (formattedRows.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const headers = Object.keys(formattedRows[0] || {});
    worksheet['!cols'] = headers.map((h) => {
      if (
        h.includes('Design') ||
        h.includes('Mockup') ||
        h.includes('Label') ||
        h.includes('URL') ||
        h.includes('Product Name')
      ) {
        return { wch: 36 };
      }
      if (h.includes('Order ID') || h.includes('Variant') || h.includes('SKU')) {
        return { wch: 22 };
      }
      return { wch: 14 };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fulfillment_Orders');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `TikFulfill_${template}_${dateStamp}.${format}`;

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, filename);
    } else {
      XLSX.writeFile(workbook, filename, { bookType: 'csv' });
    }

    onLogExport({
      filename,
      templateName:
        template === 'fulfillment_core'
          ? 'Fulfillment Chuẩn (VariantID, Front, Back, Mockup, Qty, Label)'
          : template === 'supplier_pod'
          ? 'Template Nhà In POD (Merchize / Gearment)'
          : 'Google Sheet Đầy Đủ (A-M + Fulfillment)',
      format,
      orderCount: formattedRows.length,
      shopFilter: scope,
    });
  };

  const handleCopyTsvForGoogleSheet = () => {
    if (formattedRows.length === 0) return;
    const headers = Object.keys(formattedRows[0]);
    const lines = [
      headers.join('\t'),
      ...formattedRows.map((row) =>
        headers
          .map((h) => String((row as Record<string, unknown>)[h] ?? '').replace(/\t|\n/g, ' '))
          .join('\t')
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2000);
  };

  const previewHeaders =
    formattedRows.length > 0 ? Object.keys(formattedRows[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl bg-white rounded-xl border border-[#E4E4E7] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121212] text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#25F4EE]" />
            <h2 className="text-base font-bold tracking-tight">
              Xuất File Excel / CSV Fulfillment
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Template & Scope Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#121212] mb-2">
                1. Chọn mẫu cột xuất Excel (Template)
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTemplate('fulfillment_core')}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    template === 'fulfillment_core'
                      ? 'border-[#121212] bg-[#F8F8FA]'
                      : 'border-[#E4E4E7] hover:border-zinc-300'
                  }`}
                >
                  <div className="text-xs font-bold text-[#121212]">
                    Fulfillment Chuẩn (Variant ID, Design Front, Back, Mockup, Qty, Label)
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                     Tối ưu để gửi trực tiếp cho team Fulfillment / Nhà in cập nhật đơn
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplate('google_sheet_full')}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    template === 'google_sheet_full'
                      ? 'border-[#121212] bg-[#F8F8FA]'
                      : 'border-[#E4E4E7] hover:border-zinc-300'
                  }`}
                >
                  <div className="text-xs font-bold text-[#121212]">
                    Cấu trúc Google Sheet Gốc (Cột A–M) + Cột Fulfillment
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Giữ nguyên thứ tự cột A đến M như Sheet gốc và nối thêm Variant ID, Design Front, Back
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplate('supplier_pod')}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    template === 'supplier_pod'
                      ? 'border-[#121212] bg-[#F8F8FA]'
                      : 'border-[#E4E4E7] hover:border-zinc-300'
                  }`}
                >
                  <div className="text-xs font-bold text-[#121212]">
                    File Import Nhà In POD (Merchize / Gearment / Printify)
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Định dạng cột tiêu chuẩn để upload bulk order lên cổng nhà in
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#121212] mb-2">
                  2. Phạm vi đơn hàng cần xuất
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeType)}
                  className="w-full px-3 py-2.5 text-xs font-semibold text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                >
                  <option value="all">
                    Tất cả đơn hàng hiện có ({orders.length} đơn)
                  </option>
                  {selectedIds.length > 0 && (
                    <option value="selected">
                      Chỉ các đơn đang tích chọn ({selectedIds.length} đơn)
                    </option>
                  )}
                  <option value="fulfilled_only">
                    Chỉ đơn có trạng thái TRUE ({orders.filter((o) => o.fulfilled).length} đơn)
                  </option>
                  <option value="shop_922">
                    Lọc riêng Shop 922 ({orders.filter((o) => o.shopCode === '922').length} đơn)
                  </option>
                  <option value="shop_947">
                    Lọc riêng Shop 947 ({orders.filter((o) => o.shopCode === '947').length} đơn)
                  </option>
                  <option value="shop_949">
                    Lọc riêng Shop 949 ({orders.filter((o) => o.shopCode === '949').length} đơn)
                  </option>
                </select>
              </div>

              <div className="p-3.5 rounded-lg bg-[#F8F8FA] border border-[#E4E4E7] space-y-2.5">
                <div className="text-xs font-bold text-[#121212]">
                  Tùy chỉnh định dạng dữ liệu
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={commaDecimalPrice}
                    onChange={(e) => setCommaDecimalPrice(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#FE2C55]"
                  />
                  <span className="text-xs text-zinc-700">
                    Định dạng dấu phẩy thập phân cho cột Giá giống Google Sheet VN (VD: <code className="font-mono font-bold">16,96</code>)
                  </span>
                </label>

                <div className="pt-1 flex items-center justify-between text-xs text-zinc-600 border-t border-[#E4E4E7]">
                  <span>Số dòng sẽ xuất:</span>
                  <span className="font-mono font-bold text-[#121212] tabular-nums">
                    {filteredOrders.length} đơn hàng
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#121212]">
                Xem trước cấu trúc bảng xuất ({ Math.min(5, formattedRows.length) } / {formattedRows.length} dòng đầu)
              </span>
              <button
                type="button"
                onClick={handleCopyTsvForGoogleSheet}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#121212] hover:text-[#FE2C55] transition-colors cursor-pointer"
              >
                {copiedTsv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã copy! Dán (Ctrl+V) vào Google Sheet</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy toàn bộ bảng để dán vào Google Sheet</span>
                  </>
                )}
              </button>
            </div>

            <div className="border border-[#E4E4E7] rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#F1F1F4] border-b border-[#E4E4E7] text-zinc-700 font-bold">
                    {previewHeaders.map((h) => (
                      <th key={h} className="py-2 px-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED] font-mono">
                  {formattedRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50">
                      {previewHeaders.map((h) => {
                        const cellVal = String((row as Record<string, unknown>)[h] ?? '');
                        return (
                          <td
                            key={h}
                            className="py-2 px-2.5 max-w-[160px] truncate text-zinc-700 tabular-nums"
                            title={cellVal}
                          >
                            {cellVal || <span className="text-zinc-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F8F8FA] border-t border-[#E4E4E7] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-[#D4D4D8] rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleDownload('csv')}
              className="px-4 py-2 text-xs font-bold text-[#121212] bg-white border border-[#121212] rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Xuất CSV (.csv)
            </button>

            <button
              type="button"
              onClick={() => handleDownload('xlsx')}
              className="px-5 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất File Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
