export interface PaymentOrderRequest {
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentOrderResponse {
  id: string;
  status: "created" | "approved" | "completed" | "failed";
  amount: number;
  currency: string;
  approvalUrl?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentGateway {
  name: string;
  createOrder: (req: PaymentOrderRequest) => Promise<PaymentOrderResponse>;
  captureOrder: (orderId: string) => Promise<PaymentOrderResponse>;
}
