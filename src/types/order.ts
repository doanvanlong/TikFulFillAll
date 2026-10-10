export type GarmentType = 'T-Shirt' | 'Sweatshirt' | 'Hoodie' | 'Comfort Colors';
export type PrintSides = '1M' | '2M';
export type SupplierName = 'Merchize' | 'Gearment' | 'Printify' | 'BurgerPrints' | 'Custom';

export interface PodOrder {
  id: string;
  stt: number;
  sheetRowNumber?: number; // Exact 1-based row index on Google Sheet (e.g. Row 9 for STT 8)
  orderId: string;
  orderDate: string;
  fulfillDate: string;
  productName: string;
  mockupUrl: string;
  variation: string; // e.g. "Black, L"
  color: string;     // e.g. "Black"
  size: string;      // e.g. "L"
  quantity: number;
  sku: string;       // e.g. "T_20382627295_1M"
  price: number;     // e.g. 16.96
  labelUrl: string;  // Google Drive shipping label link
  shopCode: string;  // e.g. "922", "947", "949"
  fulfilled: boolean; // Column M: TRUE / FALSE
  batchHighlighted?: boolean; // Gray highlight rows 12-15 from sheet

  // Fulfillment specific fields updated via the Fulfillment action
  variantId: string;
  productType: GarmentType;
  printSides: PrintSides;
  designFront: string;
  designBack: string;
  neckLabel: string;
  supplier: SupplierName;
  baseCost: number;
  note: string;
  updatedAt: string;
}

export interface VariantMappingRule {
  id: string;
  supplier: SupplierName;
  productType: GarmentType;
  color: string;
  size: string;
  variantId: string;
  baseCost: number;
}

export interface SkuDesignItem {
  sku: string;
  title: string;
  productType: GarmentType;
  printSides: PrintSides;
  designFront: string;
  designBack: string;
  defaultMockup: string;
  graphicTheme: 'dachshund' | 'boobie' | 'racist' | 'redfish' | 'duck_logo' | 'thankful' | 'marsh_duck' | 'custom';
}

export interface ExportLogItem {
  id: string;
  filename: string;
  templateName: string;
  format: 'xlsx' | 'csv';
  orderCount: number;
  exportedAt: string;
  shopFilter: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface SheetSyncSummary {
  totalDetected: number;
  newOrdersAdded: number;
  existingUpdated: number;
  autoMappedVariants: number;
  autoMappedDesigns: number;
  syncedAt: string;
  columnMapSummary: string;
}
