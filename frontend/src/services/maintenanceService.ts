export type PriorityLevel = "CRITICAL" | "HIGH" | "ROUTINE";
export type OrderStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface WorkOrder {
  id: string;
  stationCode: string;
  stationName: string;
  sensorType: string;
  priority: PriorityLevel;
  status: OrderStatus;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  assignedTechnician: string;
  issueDescription: string;
  actionRequired: string;
  estimatedHours: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceOrdersResponse {
  orders: WorkOrder[];
  total: number;
  criticalCount: number;
  scheduledCount: number;
}

export interface CreateWorkOrderInput {
  stationCode: string;
  stationName: string;
  sensorType?: string;
  priority?: PriorityLevel;
  scheduledDate?: string;
  scheduledTime?: string;
  assignedTechnician?: string;
  issueDescription?: string;
  actionRequired?: string;
  estimatedHours?: number;
  notes?: string;
}

export interface UpdateWorkOrderInput {
  scheduledDate?: string;
  scheduledTime?: string;
  priority?: PriorityLevel;
  assignedTechnician?: string;
  status?: OrderStatus;
  notes?: string;
  estimatedHours?: number;
}

const API_BASE_URL = "/api/maintenance-orders";

export async function fetchAllWorkOrders(): Promise<MaintenanceOrdersResponse> {
  const res = await fetch(`${API_BASE_URL}/`);
  if (!res.ok) {
    throw new Error(`Failed to load work orders: ${res.statusText}`);
  }
  return res.json();
}

export async function createWorkOrderApi(input: CreateWorkOrderInput): Promise<WorkOrder> {
  const res = await fetch(`${API_BASE_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create work order: ${res.statusText}`);
  }
  const data = await res.json();
  return data.order;
}

export async function updateWorkOrderApi(
  orderId: string,
  input: UpdateWorkOrderInput
): Promise<WorkOrder> {
  const res = await fetch(`${API_BASE_URL}/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to update work order: ${res.statusText}`);
  }
  const data = await res.json();
  return data.order;
}

export async function cancelWorkOrderApi(orderId: string): Promise<WorkOrder> {
  const res = await fetch(`${API_BASE_URL}/${orderId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel work order: ${res.statusText}`);
  }
  const data = await res.json();
  return data.cancelledOrder;
}
