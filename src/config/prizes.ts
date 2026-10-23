export interface Prize {
  id: string;
  name: string;
  category: string;
  tier: 'mega' | 'mid' | 'general';
  baseQuota: number;
  totalStock: number;
  minBillAmount: number;
  allowedDays?: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  excludedBrands?: string[];
  allowsCarryForward: boolean;
}

export const PRIZES: Prize[] = [
  // --- GENERAL TIER (Any price) ---
  {
    id: 'gift_box',
    name: 'Custom Gift Box',
    category: 'Gift Box',
    tier: 'general',
    baseQuota: 30,
    totalStock: 500,
    minBillAmount: 0,
    allowsCarryForward: true,
  },
  {
    id: 'movie_ticket',
    name: 'Movie Ticket',
    category: 'Entertainment',
    tier: 'general',
    baseQuota: 18,
    totalStock: 300,
    minBillAmount: 0,
    allowsCarryForward: true,
  },
  {
    id: 'ice_cream',
    name: 'Ice Cream Buy 1 Get 1',
    category: 'Dining',
    tier: 'general',
    baseQuota: 12,
    totalStock: 200,
    minBillAmount: 0,
    excludedBrands: ['ice_cream_partner'],
    allowsCarryForward: true,
  },
  {
    id: 'car_wash',
    name: 'Car Wash Discount',
    category: 'Automotive',
    tier: 'general',
    baseQuota: 6,
    totalStock: 100,
    minBillAmount: 0,
    excludedBrands: ['car_wash_partner'],
    allowsCarryForward: true,
  },
  {
    id: 'pizza_discount',
    name: 'Pizza 30% Off',
    category: 'Dining',
    tier: 'general',
    baseQuota: 10,
    totalStock: 160,
    minBillAmount: 0,
    excludedBrands: ['pizza_partner'],
    allowsCarryForward: true,
  },
  {
    id: 'gaming_points',
    name: '₹500 Gaming Points',
    category: 'Gaming',
    tier: 'general', // Moved to general tier (available at any price)
    baseQuota: 30,
    totalStock: 480,
    minBillAmount: 0,
    excludedBrands: ['playkingdom', 'wahgobha'],
    allowsCarryForward: true,
  },

  // --- MID-TIER (Bill > ₹8,000 up to ₹50,000) ---
  {
    id: 'bbq_lunch',
    name: 'Barbeque Nation Lunch',
    category: 'Dining',
    tier: 'mid',
    baseQuota: 2, // Strict limit of 2 winners per day
    totalStock: 30,
    minBillAmount: 8000, // Strictly greater than 8000
    allowedDays: [1, 2, 3, 4, 5], // Monday to Friday only
    excludedBrands: ['bbq_nation'],
    allowsCarryForward: true,
  },

  // --- MEGA-PRIZE TIER (Bill > ₹50,000) ---
  {
    id: 'mixer_grinder',
    name: 'Free Mixer Grinder',
    category: 'Appliance',
    tier: 'mega',
    baseQuota: 1,
    totalStock: 1,
    minBillAmount: 50000,
    allowsCarryForward: false,
  },
  {
    id: 'bluetooth_speaker',
    name: 'Free Bluetooth Speaker',
    category: 'Appliance',
    tier: 'mega',
    baseQuota: 1,
    totalStock: 1,
    minBillAmount: 50000,
    allowsCarryForward: false,
  },
];