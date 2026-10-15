export type UserRole = 'SUPER_ADMIN' | 'SHOP_ADMIN' | 'WAREHOUSEMAN' | 'CASHIER';

export type ShopStatus = 'ACTIVE' | 'TRIAL' | 'BLOCKED' | 'DELETED';

export type PaymentMethod = 'CASH' | 'CARD' | 'ELECTRONIC' | 'DEBT';

export type BatchStatus = 'NORMAL' | 'APPROACHING' | 'EXPIRED';

export type NotificationType = 
  | 'LOW_STOCK' 
  | 'EXPIRY_APPROACHING' 
  | 'EXPIRED' 
  | 'TRIAL_EXPIRING' 
  | 'SUB_EXPIRING' 
  | 'SUB_EXPIRED' 
  | 'SYSTEM';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  shopId?: string | null;
  shopName?: string | null;
  shopStatus?: ShopStatus | null;
  trialDaysLeft?: number | null;
  subscriptionDaysLeft?: number | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  unit: string;
  unitPrice: number;
  purchasePrice: number;
  availableQuantity: number;
  quantity: number;
  discount: number;
  totalPrice: number;
}
