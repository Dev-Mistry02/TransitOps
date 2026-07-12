import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Role = 'admin' | 'fleet_manager' | 'driver' | 'safety_officer' | 'financial_analyst';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type VehicleType = 'truck' | 'van' | 'bus' | 'trailer' | 'car';
export type VehicleStatus = 'available' | 'on_trip' | 'in_shop' | 'retired';

export type Vehicle = {
  id: string;
  registration_number: string;
  model: string;
  type: VehicleType;
  load_capacity: number;
  odometer: number;
  acquisition_cost: number;
  status: VehicleStatus;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  created_at: string;
};

export type DriverStatus = 'available' | 'on_trip' | 'suspended' | 'off_duty';

export type Driver = {
  id: string;
  name: string;
  license_number: string;
  license_expiry: string;
  safety_score: number;
  phone: string | null;
  email: string | null;
  status: DriverStatus;
  created_at: string;
};

export type TripStatus = 'pending' | 'dispatched' | 'completed' | 'cancelled';

export type Trip = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  origin: string;
  destination: string;
  cargo_weight: number;
  departure_time: string;
  arrival_time: string | null;
  status: TripStatus;
  revenue: number;
  notes: string | null;
  created_at: string;
  vehicles?: Pick<Vehicle, 'registration_number' | 'model'> | null;
  drivers?: Pick<Driver, 'name' | 'license_number'> | null;
};

export type Maintenance = {
  id: string;
  vehicle_id: string | null;
  service_type: string;
  description: string | null;
  cost: number;
  start_date: string;
  end_date: string | null;
  status: 'open' | 'closed';
  created_at: string;
  vehicles?: Pick<Vehicle, 'registration_number' | 'model'> | null;
};

export type FuelLog = {
  id: string;
  vehicle_id: string | null;
  liters: number;
  cost: number;
  odometer_reading: number;
  date: string;
  created_at: string;
  vehicles?: Pick<Vehicle, 'registration_number' | 'model'> | null;
};

export type ExpenseCategory = 'fuel' | 'maintenance' | 'salary' | 'insurance' | 'other';

export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  vehicle_id: string | null;
  date: string;
  created_at: string;
  vehicles?: Pick<Vehicle, 'registration_number' | 'model'> | null;
};

export type Notification = {
  id: string;
  user_id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  created_at: string;
};

export type Document = {
  id: string;
  vehicle_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_at: string;
};
