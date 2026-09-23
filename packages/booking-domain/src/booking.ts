import type {
  BookingStatus,
  PreferredTimeWindow,
  TreeCountCategory,
} from "@justcocon/shared-types";

export interface BookingRequest {
  id: string;
  customerName: string;
  location: string;
  treeCountCategory: TreeCountCategory;
  preferredDate: string;
  preferredTimeWindow: PreferredTimeWindow;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}

export function createInitialBooking(
  request: Omit<BookingRequest, "status" | "createdAt">,
): BookingRequest {
  return {
    ...request,
    status: "PENDING_STAFF_REVIEW",
    createdAt: new Date().toISOString(),
  };
}
