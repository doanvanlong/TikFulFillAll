import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  Paintbrush,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  INITIAL_ORDERS,
  INITIAL_SKU_DESIGNS,
  INITIAL_VARIANT_MAPPINGS,
} from './data/initialOrders';
import {
  ExportLogItem,
  GarmentType,
  PodOrder,
  PrintSides,
  SheetSyncSummary,
  SkuDesignItem,
  SupplierName,
  VariantMappingRule,
} from './types/order';
import { GarmentPreview, getGarmentColorInfo } from './components/GarmentPreview';
import { FulfillmentDrawer } from './components/FulfillmentDrawer';
import { BulkFulfillmentModal } from './components/BulkFulfillmentModal';
import { ExportExcelModal } from './components/ExportExcelModal';
import { ImportSheetModal } from './components/ImportSheetModal';
import { GoogleSheetsSyncPanel } from './components/GoogleSheetsSyncPanel';
import {
  SkuDesignLibraryView,
  VariantMappingView,
} from './components/MappingManagerView';

type ActiveNavTab =
  | 'orders'
  | 'queue'
  | 'variants'
  | 'designs'
  | 'exports';

type TableMode = 'fulfillment' | 'sheet_columns';

const STORAGE_KEYS = {
  ORDERS: 'tikfulfill_orders_v1',
  VARIANTS: 'tikfulfill_variants_v1',
  DESIGNS: 'tikfulfill_designs_v1',
  EXPORTS: 'tikfulfill_exports_v1',
};

export default function App() {
  const [orders, setOrders] = useState<PodOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [variantMappings, setVariantMappings] = useState<VariantMappingRule[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.VARIANTS);
        return saved ? JSON.parse(saved) : INITIAL_VARIANT_MAPPINGS;
      } catch {
        return INITIAL_VARIANT_MAPPINGS;
      }
    }
  );

  const [skuDesigns, setSkuDesigns] = useState<SkuDesignItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DESIGNS);
      return saved ? JSON.parse(saved) : INITIAL_SKU_DESIGNS;
    } catch {
      return INITIAL_SKU_DESIGNS;
    }
  });

  const [exportLogs, setExportLogs] = useState<ExportLogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXPORTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Navigation & View States
  const [activeNav, setActiveNav] = useState<ActiveNavTab>('orders');
  const [tableMode, setTableMode] = useState<TableMode>('fulfillment');
  const [searchQuery, setSearchQuery] = useState('');
  const [shopFilter, setShopFilter] = useState<string>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | '1M' | '2M'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TRUE' | 'FALSE' | 'MISSING'>('ALL');

  // Selection & Modals
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingOrder, setEditingOrder] = useState<PodOrder | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const flagDirty = (ids: string[]) => setDirtyIds(prev => Array.from(new Set([...prev, ...ids])));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch {
      // Ignore storage quota errors
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.VARIANTS,
        JSON.stringify(variantMappings)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [variantMappings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DESIGNS, JSON.stringify(skuDesigns));
    } catch {
      // Ignore storage quota errors
    }
  }, [skuDesigns]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPORTS, JSON.stringify(exportLogs));
    } catch {
      // Ignore storage quota errors
    }
  }, [exportLogs]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Helper to check if an order is missing any required fulfillment field
  const isOrderIncomplete = (o: PodOrder) => {
    if (!o.variantId.trim()) return true;
    if (!o.designFront.trim()) return true;
    if ((o.printSides === '2M' || o.sku.endsWith('_2M')) && !o.designBack.trim()) {
      return true;
    }
    if (!o.labelUrl.trim()) return true;
    return false;
  };

  // Filtered Orders
  const displayedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (activeNav === 'queue' && o.fulfilled && !isOrderIncomplete(o)) {
        return false;
      }

      if (shopFilter !== 'ALL' && o.shopCode !== shopFilter) return false;
      if (sideFilter !== 'ALL' && o.printSides !== sideFilter) return false;

      if (statusFilter === 'TRUE' && !o.fulfilled) return false;
      if (statusFilter === 'FALSE' && o.fulfilled) return false;
      if (statusFilter === 'MISSING' && !isOrderIncomplete(o)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hay = [
          String(o.stt),
          o.orderId,
          o.productName,
          o.variation,
          o.sku,
          o.variantId,
          o.shopCode,
          o.note,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [orders, activeNav, shopFilter, sideFilter, statusFilter, searchQuery]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalUnits = orders.reduce((acc, o) => acc + o.quantity, 0);
    const fulfilledCount = orders.filter((o) => o.fulfilled).length;
    const incompleteCount = orders.filter((o) => isOrderIncomplete(o) || !o.fulfilled).length;
    const totalRevenue = orders.reduce((acc, o) => acc + o.price * o.quantity, 0);
    const totalCost = orders.reduce((acc, o) => acc + o.baseCost * o.quantity, 0);
    const netProfit = totalRevenue - totalCost;

    return {
      totalOrders,
      totalUnits,
      fulfilledCount,
      incompleteCount,
      totalRevenue,
      totalCost,
      netProfit,
    };
  }, [orders]);

  const uniqueShops = useMemo(() => {
    const set = new Set(orders.map((o) => o.shopCode).filter(Boolean));
    return Array.from(set).sort();
  }, [orders]);

  // Smart Merge Handler for both Live Google Sheets Sync and Paste/Excel Import
  const handleMergeOrdersFromSheet = (
    detectedOrders: PodOrder[],
    replaceExisting: boolean,
    summary?: SheetSyncSummary
  ) => {
    if (replaceExisting) {
      setOrders(detectedOrders);
    } else {
      setOrders((prev) => {
        const pending = [...detectedOrders];
        const updatedExisting = prev.map((existingOrd) => {
          const index = pending.findIndex(d =>
            d.id === existingOrd.id ||
            (d.orderId === existingOrd.orderId && d.sheetRowNumber != null && d.sheetRowNumber === existingOrd.sheetRowNumber) ||
            (d.orderId === existingOrd.orderId && d.sku === existingOrd.sku && d.variation === existingOrd.variation)
          );
          if (index < 0) return existingOrd;
          const [match] = pending.splice(index, 1);
          return match;
        });
        return [...updatedExisting, ...pending];
      });
    }

    if (summary) {
      showToast(
        `Đã đồng bộ ${summary.totalDetected} đơn từ Sheet (+${summary.newOrdersAdded} mới, cập nhật ${summary.existingUpdated} đơn)`
      );
    }
  };

  // Handlers
  const handleSaveSingleOrder = (
    updatedOrder: PodOrder,
    options: {
      syncDesignToSameSku: boolean;
      syncVariantToSameColorSize: boolean;
    }
  ) => {
    setOrders((prev) =>
      prev.map((item) => {
        if (item.id === updatedOrder.id) {
          return updatedOrder;
        }

        let nextItem = { ...item };

        if (
          options.syncDesignToSameSku &&
          updatedOrder.sku.trim() &&
          item.sku === updatedOrder.sku
        ) {
          nextItem = {
            ...nextItem,
            designFront: updatedOrder.designFront,
            designBack: updatedOrder.designBack,
            mockupUrl: updatedOrder.mockupUrl,
            printSides: updatedOrder.printSides,
          };
        }

        if (
          options.syncVariantToSameColorSize &&
          item.color.toLowerCase() === updatedOrder.color.toLowerCase() &&
          item.size.toLowerCase() === updatedOrder.size.toLowerCase()
        ) {
          nextItem = {
            ...nextItem,
            variantId: updatedOrder.variantId,
            baseCost: updatedOrder.baseCost,
            supplier: updatedOrder.supplier,
          };
        }

        return nextItem;
      })
    );

    flagDirty(orders.filter(o => o.id === updatedOrder.id || (options.syncDesignToSameSku && o.sku === updatedOrder.sku) || (options.syncVariantToSameColorSize && o.color === updatedOrder.color && o.size === updatedOrder.size)).map(o=>o.id));
    setEditingOrder(updatedOrder);
    showToast(`Đã cập nhật Fulfillment cho Order ${updatedOrder.orderId}`);
  };

  const handleInlineFieldChange = (
    orderId: string,
    field: keyof PodOrder,
    value: string | number | boolean
  ) => {
    flagDirty([orderId]);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, [field]: value } : o))
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === displayedOrders.length && displayedOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedOrders.map((o) => o.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyBulkUpdates = (updates: {
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
  }) => {
    const nowStr = new Date().toLocaleDateString('vi-VN');
    setOrders((prev) =>
      prev.map((o) => {
        if (!selectedIds.includes(o.id)) return o;
        return {
          ...o,
          ...updates,
          updatedAt: nowStr,
        };
      })
    );
    flagDirty(selectedIds);
    showToast(`Đã cập nhật hàng loạt cho ${selectedIds.length} đơn hàng`);
  };

  const handleAutoFulfillMissingOrders = () => {
    let updatedCount = 0;
    setOrders((prev) =>
      prev.map((o) => {
        const skuPreset = skuDesigns.find(
          (d) => d.sku.toLowerCase() === o.sku.toLowerCase()
        );
        const variantRule = variantMappings.find(
          (m) =>
            m.productType === o.productType &&
            m.color.toLowerCase() === o.color.toLowerCase() &&
            m.size.toLowerCase() === o.size.toLowerCase()
        );

        const autoVariant = o.variantId.trim() || variantRule?.variantId || '';
        const autoFront = o.designFront.trim() || skuPreset?.designFront || '';
        const needsBack = o.printSides === '2M' || o.sku.endsWith('_2M');
        const autoBack = o.designBack.trim() || (needsBack ? skuPreset?.designBack || '' : '');
        const ready = !!(autoVariant && autoFront && (!needsBack || autoBack) && o.labelUrl.trim());
        if (autoVariant !== o.variantId || autoFront !== o.designFront || autoBack !== o.designBack) updatedCount++;
        return { ...o, variantId:autoVariant, designFront:autoFront, designBack:autoBack, fulfilled:o.fulfilled && ready };
      })
    );
    flagDirty(orders.map(o=>o.id));
    showToast(
      updatedCount > 0
        ? `Đã tự động điền Variant ID & Design cho ${updatedCount} đơn hàng!`
        : 'Tất cả đơn hàng đã đầy đủ thông tin Fulfillment!'
    );
  };

  const handleSyncAllVariantsToOrders = () => {
    setOrders((prev) =>
      prev.map((o) => {
        const match = variantMappings.find(
          (m) =>
            m.color.toLowerCase() === o.color.toLowerCase() &&
            m.size.toLowerCase() === o.size.toLowerCase() &&
            m.productType === o.productType
        );
        if (!match) return o;
        return {
          ...o,
          variantId: match.variantId,
          baseCost: match.baseCost,
          supplier: match.supplier,
        };
      })
    );
    flagDirty(orders.map(o=>o.id));
    showToast('Đã đồng bộ bảng Variant ID vào toàn bộ đơn hàng!');
  };

  const handleSyncAllDesignsToOrders = () => {
    setOrders((prev) =>
      prev.map((o) => {
        const match = skuDesigns.find(
          (d) => d.sku.toLowerCase() === o.sku.toLowerCase()
        );
        if (!match) return o;
        return {
          ...o,
          designFront: match.designFront || o.designFront,
          designBack: match.designBack || o.designBack,
          mockupUrl: match.defaultMockup || o.mockupUrl,
          printSides: match.printSides,
        };
      })
    );
    flagDirty(orders.map(o=>o.id));
    showToast('Đã đồng bộ Design Front/Back từ Thư viện SKU vào các đơn hàng!');
  };

  const handleResetDemoSheet = () => {
    setOrders(INITIAL_ORDERS);
    setVariantMappings(INITIAL_VARIANT_MAPPINGS);
    setSkuDesigns(INITIAL_SKU_DESIGNS);
    setSelectedIds([]);
    showToast('Đã khôi phục 17 đơn hàng gốc từ Sheet Orders (STT 8 → 24)');
  };

  const handleDeleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F8FA] text-[#121212]">
      {/* TOP BAR CONTRACT: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#121212] text-white border-b border-zinc-800">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#orders"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('orders');
          }}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          TikFulfill Studio
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveNav('orders')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'orders'
                ? 'border-[#FE2C55] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Đơn hàng ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('queue')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'queue'
                ? 'border-[#FE2C55] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Cần Fulfill ({stats.incompleteCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('variants')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'variants'
                ? 'border-[#FE2C55] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Bảng mã Variant
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('designs')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'designs'
                ? 'border-[#FE2C55] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Thư viện Design
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('exports')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'exports'
                ? 'border-[#FE2C55] text-white'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Lịch sử Xuất Excel
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel Fulfillment
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#121212] text-white text-xs font-semibold shadow-xl border border-zinc-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-[#25F4EE]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* LIVE GOOGLE SHEETS CONNECTION & AUTO-DETECTION PANEL */}
        <GoogleSheetsSyncPanel
          orders={orders}
          variantMappings={variantMappings}
          skuDesigns={skuDesigns}
          onOrdersSynced={(mergedOrders, summary) =>
            handleMergeOrdersFromSheet(mergedOrders, false, summary)
          }
          onToast={showToast}
          dirtyIds={dirtyIds}
          onDirtySaved={(ids) => setDirtyIds(prev=>prev.filter(id=>!ids.includes(id)))}
          exportLogs={exportLogs}
          onExportLogsSynced={setExportLogs}
          onVariantsSynced={setVariantMappings}
          onDesignsSynced={setSkuDesigns}
        />

        {/* KPI & Sheet Summary Strip */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E8E8ED]">
            <div>
              <div className="text-xs font-semibold text-zinc-500">
                Đồng bộ dữ liệu Sheet: Orders (STT #8 → #{orders[orders.length - 1]?.stt || 24}) · Shop 922 · 947 · 949
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#121212] mt-0.5">
                Quản Lý Đơn Hàng TikTok Shop & Fulfillment POD
              </h1>
            </div>

            {/* Secondary Workspace Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 text-xs font-bold text-[#121212] bg-[#F8F8FA] border border-[#D4D4D8] rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#FE2C55]" />
                Dán nhanh từ Sheet / Nhập Excel
              </button>

              <button
                type="button"
                onClick={handleAutoFulfillMissingOrders}
                className="px-3.5 py-2 text-xs font-bold text-[#121212] bg-[#F8F8FA] border border-[#D4D4D8] rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title="Tự động điền Variant ID & Design cho các đơn còn thiếu (như STT 22, 23, 24)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FE2C55]" />
                Tự động điền đơn thiếu ({stats.incompleteCount})
              </button>

              <button
                type="button"
                onClick={handleResetDemoSheet}
                className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:text-[#121212] transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title="Khôi phục dữ liệu 17 dòng gốc từ ảnh chụp Google Sheet"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục Sheet gốc
              </button>
            </div>
          </div>

          {/* 5-Column Tabular Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E8E8ED]">
            <div className="pr-4">
              <div className="text-xs font-medium text-zinc-500">
                Tổng đơn trên Sheet
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#121212] mt-1">
                {stats.totalOrders}{' '}
                <span className="text-xs font-normal text-zinc-500">
                  ({stats.totalUnits} áo)
                </span>
              </div>
            </div>

            <div className="sm:px-4 pt-3 sm:pt-0">
              <div className="text-xs font-medium text-zinc-500">
                Đã Fulfill (Cột M = TRUE)
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#16A34A] mt-1">
                {stats.fulfilledCount}
                <span className="text-xs font-normal text-zinc-500">
                  /{stats.totalOrders} đơn
                </span>
              </div>
            </div>

            <div className="sm:px-4 pt-3 sm:pt-0">
              <div className="text-xs font-medium text-zinc-500">
                Chờ cập nhật Variant / Design
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#D97706] mt-1">
                {stats.incompleteCount}{' '}
                <span className="text-xs font-normal text-zinc-500">đơn</span>
              </div>
            </div>

            <div className="sm:px-4 pt-3 sm:pt-0">
              <div className="text-xs font-medium text-zinc-500">
                Tổng Payout (Cột J)
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#121212] mt-1">
                ${stats.totalRevenue.toFixed(2).replace('.', ',')}
              </div>
            </div>

            <div className="sm:pl-4 pt-3 sm:pt-0">
              <div className="text-xs font-medium text-zinc-500">
                Lợi nhuận ước tính
              </div>
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#FE2C55] mt-1">
                +${stats.netProfit.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Navigation Switcher */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto bg-white p-1.5 rounded-xl border border-[#E4E4E7]">
          <button
            type="button"
            onClick={() => setActiveNav('orders')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 ${
              activeNav === 'orders' ? 'bg-[#121212] text-white' : 'text-zinc-600'
            }`}
          >
            Đơn hàng ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('queue')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 ${
              activeNav === 'queue' ? 'bg-[#121212] text-white' : 'text-zinc-600'
            }`}
          >
            Cần Fulfill ({stats.incompleteCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('variants')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 ${
              activeNav === 'variants' ? 'bg-[#121212] text-white' : 'text-zinc-600'
            }`}
          >
            Bảng mã Variant
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('designs')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 ${
              activeNav === 'designs' ? 'bg-[#121212] text-white' : 'text-zinc-600'
            }`}
          >
            Thư viện Design
          </button>
        </div>

        {/* View Routing */}
        {activeNav === 'variants' ? (
          <VariantMappingView
            variantMappings={variantMappings}
            onAddRule={(rule) =>
              setVariantMappings((prev) => [rule, ...prev])
            }
            onDeleteRule={(id) =>
              setVariantMappings((prev) => prev.filter((r) => r.id !== id))
            }
            onSyncAllVariantsToOrders={handleSyncAllVariantsToOrders}
          />
        ) : activeNav === 'designs' ? (
          <SkuDesignLibraryView
            skuDesigns={skuDesigns}
            onUpdateSkuDesign={(updated) =>
              setSkuDesigns((prev) =>
                prev.map((d) => (d.sku === updated.sku ? updated : d))
              )
            }
            onSyncAllDesignsToOrders={handleSyncAllDesignsToOrders}
          />
        ) : activeNav === 'exports' ? (
          <section className="bg-white border border-[#E4E4E7] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#121212]">
                  Lịch Sử Xuất File Excel / CSV Fulfillment
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Lưu vết các đợt xuất file đặt hàng nhà in từ hệ thống
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors cursor-pointer whitespace-nowrap"
              >
                Tạo Lượt Xuất Mới
              </button>
            </div>

            {exportLogs.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-[#D4D4D8] rounded-xl bg-[#F8F8FA]">
                <FileSpreadsheet className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-[#121212]">
                  Chưa có lịch sử xuất file Excel nào
                </div>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Nhấn nút "Xuất Excel Fulfillment" ở góc phải trên cùng để tải file .xlsx hoặc .csv đầu tiên.
                </p>
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#121212] rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Xuất File Excel Ngay
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F1F1F4] border-b border-[#E4E4E7] text-zinc-600 font-bold">
                    <th className="py-3 px-4">Tên file</th>
                    <th className="py-3 px-4">Mẫu Template</th>
                    <th className="py-3 px-4">Định dạng</th>
                    <th className="py-3 px-4 text-right">Số đơn</th>
                    <th className="py-3 px-4 text-right">Thời gian xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED]">
                  {exportLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#121212]">
                        {log.filename}
                      </td>
                      <td className="py-3 px-4 text-zinc-700">{log.templateName}</td>
                      <td className="py-3 px-4 font-mono uppercase text-[#FE2C55] font-bold">
                        .{log.format}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        {log.orderCount} đơn
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-500">
                        {log.exportedAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : (
          /* ORDERS & FULFILLMENT TABLE WORKSPACE */
          <section className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-white border border-[#E4E4E7] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Left: Search + Segmented Status Filters */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm Order ID, Tên áo, SKU, Variant ID, Màu..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212] transition-colors"
                  />
                </div>

                {/* Status Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-[#F1F1F4] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      statusFilter === 'ALL'
                        ? 'bg-white text-[#121212] shadow-xs'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    Tất cả ({orders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('TRUE')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      statusFilter === 'TRUE'
                        ? 'bg-white text-[#16A34A] shadow-xs'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    TRUE ({stats.fulfilledCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('FALSE')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      statusFilter === 'FALSE'
                        ? 'bg-white text-[#D97706] shadow-xs'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    Chờ Fulfill ({orders.length - stats.fulfilledCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('MISSING')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      statusFilter === 'MISSING'
                        ? 'bg-white text-[#FE2C55] shadow-xs'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    Thiếu Variant/Design ({orders.filter((o) => isOrderIncomplete(o)).length})
                  </button>
                </div>

                {/* Shop Filter */}
                <select
                  value={shopFilter}
                  onChange={(e) => setShopFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                >
                  <option value="ALL">Tất cả Shop (Cột L)</option>
                  {uniqueShops.map((sc) => (
                    <option key={sc} value={sc}>
                      Shop {sc} ({orders.filter((o) => o.shopCode === sc).length})
                    </option>
                  ))}
                </select>

                {/* Print Side Filter */}
                <select
                  value={sideFilter}
                  onChange={(e) =>
                    setSideFilter(e.target.value as 'ALL' | '1M' | '2M')
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
                >
                  <option value="ALL">1 Mặt & 2 Mặt</option>
                  <option value="1M">Chỉ đơn 1 Mặt (_1M)</option>
                  <option value="2M">Chỉ đơn 2 Mặt (_2M)</option>
                </select>
              </div>

              {/* Right: Table Mode Toggle & Bulk Fulfillment Action */}
              <div className="flex items-center gap-2.5 shrink-0">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Fulfillment Hàng Loạt ({selectedIds.length} đơn)
                  </button>
                )}

                <div className="flex items-center gap-1 p-1 bg-[#F1F1F4] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTableMode('fulfillment')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      tableMode === 'fulfillment'
                        ? 'bg-[#121212] text-white'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    Giao diện Fulfillment
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableMode('sheet_columns')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      tableMode === 'sheet_columns'
                        ? 'bg-[#121212] text-white'
                        : 'text-zinc-600 hover:text-[#121212]'
                    }`}
                  >
                    Cột Google Sheet (A–M)
                  </button>
                </div>
              </div>
            </div>

            {/* DATA GRID */}
            <div className="bg-white border border-[#E4E4E7] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                {tableMode === 'fulfillment' ? (
                  /* MODE 1: OPTIMIZED FULFILLMENT WORKSTATION TABLE */
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F1F1F4] border-b border-[#E4E4E7] text-[11px] font-bold text-zinc-600">
                        <th className="py-3 pl-4 pr-2 w-9">
                          <input
                            type="checkbox"
                            checked={
                              displayedOrders.length > 0 &&
                              selectedIds.length === displayedOrders.length
                            }
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded accent-[#FE2C55] cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2.5 whitespace-nowrap">STT</th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Order ID · Ngày · Shop
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Sản phẩm & Mockup
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Variation (Màu, Size) · SL
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Mã SKU · Mặt in
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Variant ID (Sửa nhanh)
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Design Front / Back / Mockup
                        </th>
                        <th className="py-3 px-3 whitespace-nowrap">
                          Label PDF · Giá ($)
                        </th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">
                          Cột M
                        </th>
                        <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                          Thao tác Fulfillment
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8ED] text-xs">
                      {displayedOrders.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-zinc-500">
                            Không tìm thấy đơn hàng nào khớp bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        displayedOrders.map((order) => {
                          const colorInfo = getGarmentColorInfo(order.color);
                          const incomplete = isOrderIncomplete(order);
                          const isSelected = selectedIds.includes(order.id);
                          const needsBack =
                            order.printSides === '2M' || order.sku.endsWith('_2M');

                          return (
                            <tr
                              key={order.id}
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-[#FE2C55]/5'
                                  : order.batchHighlighted
                                  ? 'bg-zinc-100/90 hover:bg-zinc-200/60'
                                  : 'hover:bg-[#F8F8FA]'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-2.5 pl-4 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectRow(order.id)}
                                  className="w-4 h-4 rounded accent-[#FE2C55] cursor-pointer"
                                />
                              </td>

                              {/* STT (Col A) */}
                              <td className="py-2.5 px-2.5 font-mono font-bold tabular-nums text-zinc-600">
                                {order.stt}
                              </td>

                              {/* Order ID, Dates, Shop (Col B, C, D, L) */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold tabular-nums text-[#121212]">
                                    {order.orderId}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(order.orderId, `id-${order.id}`)
                                    }
                                    className="text-zinc-400 hover:text-[#121212] cursor-pointer"
                                    title="Copy Order ID"
                                  >
                                    {copiedId === `id-${order.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                                  {order.orderDate} → {order.fulfillDate} · Shop{' '}
                                  <strong className="text-[#121212]">
                                    {order.shopCode}
                                  </strong>
                                </div>
                              </td>

                              {/* Product & Garment Preview (Col E, F) */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5 max-w-[230px]">
                                  <div
                                    onClick={() => setEditingOrder(order)}
                                    className="cursor-pointer"
                                  >
                                    <GarmentPreview
                                      productName={order.productName}
                                      sku={order.sku}
                                      color={order.color}
                                      size={order.size}
                                      productType={order.productType}
                                      side="front"
                                      sizeMode="sm"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div
                                      onClick={() => setEditingOrder(order)}
                                      className="font-semibold text-[#121212] truncate hover:text-[#FE2C55] cursor-pointer"
                                      title={order.productName}
                                    >
                                      {order.productName}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                      {order.productType} · {order.supplier}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Variation & Quantity (Col G, H) */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3.5 h-3.5 rounded-xs border shrink-0"
                                    style={{
                                      backgroundColor: colorInfo.hex,
                                      borderColor: colorInfo.border,
                                    }}
                                  />
                                  <span className="font-bold text-[#121212]">
                                    {order.color}, {order.size}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                                  Quantity:{' '}
                                  <strong className="text-[#121212]">
                                    {order.quantity}
                                  </strong>
                                </div>
                              </td>

                              {/* SKU & Print Sides (Col I) */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-mono font-bold text-[#121212]">
                                  {order.sku}
                                </div>
                                <div className="text-[11px] text-zinc-500 mt-0.5">
                                  {needsBack
                                    ? 'In 2 mặt (Front + Back)'
                                    : 'In 1 mặt (Front)'}
                                </div>
                              </td>

                              {/* Inline Editable Variant ID */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={order.variantId}
                                  placeholder="Nhập Variant ID..."
                                  onChange={(e) =>
                                    handleInlineFieldChange(
                                      order.id,
                                      'variantId',
                                      e.target.value
                                    )
                                  }
                                  className={`w-36 px-2.5 py-1 text-xs font-mono font-semibold rounded-md border focus:outline-none transition-colors ${
                                    !order.variantId.trim()
                                      ? 'bg-amber-50 border-amber-400 text-[#121212]'
                                      : 'bg-[#F8F8FA] border-[#E4E4E7] focus:bg-white focus:border-[#121212] text-[#121212]'
                                  }`}
                                />
                              </td>

                              {/* Design Front / Back / Mockup Status */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-[11px] font-semibold">
                                  <span
                                    className={
                                      order.designFront.trim()
                                        ? 'text-[#16A34A]'
                                        : 'text-amber-600'
                                    }
                                  >
                                    Front: {order.designFront.trim() ? 'OK' : 'Thiếu'}
                                  </span>
                                  <span className="text-zinc-300">·</span>
                                  {needsBack ? (
                                    <span
                                      className={
                                        order.designBack.trim()
                                          ? 'text-[#16A34A]'
                                          : 'text-[#FE2C55] font-bold'
                                      }
                                    >
                                      Back: {order.designBack.trim() ? 'OK' : 'Thiếu!'}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400">Back: —</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                                  {order.mockupUrl ? (
                                    <a
                                      href={order.mockupUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:text-[#121212] underline decoration-zinc-300"
                                    >
                                      Mockup Link
                                    </a>
                                  ) : (
                                    <span>Chưa có Mockup</span>
                                  )}
                                  {incomplete && (
                                    <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold">
                                      <AlertCircle className="w-3 h-3" />
                                      Cần bổ sung
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Label PDF & Price (Col J, K) */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-mono font-bold tabular-nums text-[#121212]">
                                  ${order.price.toFixed(2).replace('.', ',')}
                                </div>
                                {order.labelUrl ? (
                                  <a
                                    href={order.labelUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline mt-0.5"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Drive Label
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-rose-600 font-semibold">
                                    Thiếu Label
                                  </span>
                                )}
                              </td>

                              {/* Status TRUE/FALSE Toggle (Col M) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInlineFieldChange(
                                      order.id,
                                      'fulfilled',
                                      !order.fulfilled
                                    )
                                  }
                                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                                    order.fulfilled
                                      ? 'bg-[#16794B] text-white border-[#16794B]'
                                      : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:border-zinc-400'
                                  }`}
                                >
                                  {order.fulfilled ? 'TRUE' : 'FALSE'}
                                </button>
                              </td>

                              {/* Fulfillment Action Button */}
                              <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrder(order)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                      incomplete || !order.fulfilled
                                        ? 'bg-[#FE2C55] text-white hover:bg-[#E02046]'
                                        : 'bg-[#121212] text-white hover:bg-zinc-800'
                                    }`}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    Fulfillment
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleInlineFieldChange(
                                        order.id,
                                        'batchHighlighted',
                                        !order.batchHighlighted
                                      )
                                    }
                                    className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                                      order.batchHighlighted
                                        ? 'bg-zinc-700 text-white border-zinc-700'
                                        : 'text-zinc-400 border-transparent hover:text-[#121212] hover:bg-zinc-100'
                                    }`}
                                    title="Đánh dấu màu xám dòng (giống dòng 12-15 trên Sheet)"
                                  >
                                    <Paintbrush className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Xóa dòng này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  /* MODE 2: EXACT GOOGLE SHEET COLUMNS A -> M + FULFILLMENT COLUMNS */
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F1F1F4] border-b border-[#E4E4E7] text-[11px] font-mono font-bold text-zinc-600">
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7] text-center">
                          A (STT)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          B (Order ID)
                        </th>
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7]">
                          C (Ngày đặt)
                        </th>
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7]">
                          D (Ngày đi)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          E (Product Name)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          F (Mockup URL)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          G (Variation)
                        </th>
                        <th className="py-2.5 px-2 border-r border-[#E4E4E7] text-right">
                          H (SL)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          I (SKU)
                        </th>
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7] text-right">
                          J (Giá)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7]">
                          K (Label Google Drive)
                        </th>
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7] text-right">
                          L (Shop)
                        </th>
                        <th className="py-2.5 px-2.5 border-r border-[#E4E4E7] text-center">
                          M (Status)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7] bg-rose-50/60 text-[#FE2C55]">
                          N (Variant ID)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7] bg-rose-50/60 text-[#FE2C55]">
                          O (Design Front)
                        </th>
                        <th className="py-2.5 px-3 border-r border-[#E4E4E7] bg-rose-50/60 text-[#FE2C55]">
                          P (Design Back)
                        </th>
                        <th className="py-2.5 px-3 text-right">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E4E7] text-xs">
                      {displayedOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={
                            order.batchHighlighted
                              ? 'bg-[#B7B7B7]/45 hover:bg-[#B7B7B7]/60'
                              : 'hover:bg-zinc-50'
                          }
                        >
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] text-center font-mono tabular-nums">
                            {order.stt}
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] font-mono tabular-nums whitespace-nowrap">
                            {order.orderId}
                          </td>
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] font-mono tabular-nums whitespace-nowrap">
                            {order.orderDate}
                          </td>
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] font-mono tabular-nums whitespace-nowrap">
                            {order.fulfillDate}
                          </td>
                          <td
                            className="py-2 px-3 border-r border-[#E8E8ED] max-w-[180px] truncate"
                            title={order.productName}
                          >
                            {order.productName}
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] max-w-[160px] truncate text-blue-600 underline">
                            <a
                              href={order.mockupUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {order.mockupUrl}
                            </a>
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] whitespace-nowrap">
                            {order.variation}
                          </td>
                          <td className="py-2 px-2 border-r border-[#E8E8ED] text-right font-mono tabular-nums">
                            {order.quantity}
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] font-mono whitespace-nowrap">
                            {order.sku}
                          </td>
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] text-right font-mono tabular-nums">
                            {order.price.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] max-w-[210px] truncate text-blue-600 underline">
                            <a
                              href={order.labelUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {order.labelUrl}
                            </a>
                          </td>
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] text-right font-mono tabular-nums">
                            {order.shopCode}
                          </td>
                          <td className="py-2 px-2.5 border-r border-[#E8E8ED] text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleInlineFieldChange(
                                  order.id,
                                  'fulfilled',
                                  !order.fulfilled
                                )
                              }
                              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded cursor-pointer ${
                                order.fulfilled
                                  ? 'bg-[#16794B] text-white'
                                  : 'bg-zinc-200 text-zinc-600'
                              }`}
                            >
                              {order.fulfilled ? 'TRUE' : 'FALSE'}
                            </button>
                          </td>
                          <td className="py-2 px-3 border-r border-[#E8E8ED] font-mono font-bold text-[#121212] whitespace-nowrap">
                            {order.variantId || (
                              <span className="text-amber-600">Chưa có</span>
                            )}
                          </td>
                          <td
                            className="py-2 px-3 border-r border-[#E8E8ED] max-w-[140px] truncate font-mono text-[11px]"
                            title={order.designFront}
                          >
                            {order.designFront || (
                              <span className="text-amber-600">Thiếu Front</span>
                            )}
                          </td>
                          <td
                            className="py-2 px-3 border-r border-[#E8E8ED] max-w-[140px] truncate font-mono text-[11px]"
                            title={order.designBack}
                          >
                            {order.designBack || '—'}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEditingOrder(order)}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#FE2C55] rounded hover:bg-[#E02046] cursor-pointer"
                            >
                              Fulfillment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FULFILLMENT SLIDE-OVER DRAWER */}
      <FulfillmentDrawer
        order={editingOrder}
        allOrders={displayedOrders}
        variantMappings={variantMappings}
        skuDesigns={skuDesigns}
        onClose={() => setEditingOrder(null)}
        onSaveOrder={handleSaveSingleOrder}
        onSelectOrder={(nextOrd) => setEditingOrder(nextOrd)}
      />

      {/* BULK FULFILLMENT MODAL */}
      {showBulkModal && (
        <BulkFulfillmentModal
          selectedOrders={orders.filter((o) => selectedIds.includes(o.id))}
          onClose={() => setShowBulkModal(false)}
          onApplyBulk={handleApplyBulkUpdates}
        />
      )}

      {/* EXPORT EXCEL MODAL */}
      {showExportModal && (
        <ExportExcelModal
          orders={orders}
          selectedIds={selectedIds}
          onClose={() => setShowExportModal(false)}
          onLogExport={(newLog) => {
            const entry: ExportLogItem = {
              ...newLog,
              id: `exp-${Date.now()}`,
              exportedAt: new Date().toLocaleString('vi-VN'),
            };
            setExportLogs((prev) => [entry, ...prev]);
            showToast(`Đã xuất thành công file ${newLog.filename}`);
          }}
        />
      )}

      {/* IMPORT / PASTE GOOGLE SHEET MODAL */}
      {showImportModal && (
        <ImportSheetModal
          existingOrders={orders}
          variantMappings={variantMappings}
          skuDesigns={skuDesigns}
          onClose={() => setShowImportModal(false)}
          onImportOrders={(importedOrders, replace, summary) =>
            handleMergeOrdersFromSheet(importedOrders, replace, summary)
          }
        />
      )}
    </div>
  );
}
