import { vi } from "vitest";

export const MOCK_CLERK_USER_ID = "user_test123";

export const mockClerkUser = {
  id: MOCK_CLERK_USER_ID,
  emailAddresses: [{ emailAddress: "test@finosuke.app" }],
  fullName: "Test User",
  firstName: "Test",
};

export const mockAuth = vi.fn().mockResolvedValue({
  userId: MOCK_CLERK_USER_ID,
});

export const mockCurrentUser = vi.fn().mockResolvedValue(mockClerkUser);

export function resetClerkMocks() {
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
  mockAuth.mockResolvedValue({ userId: MOCK_CLERK_USER_ID });
  mockCurrentUser.mockResolvedValue(mockClerkUser);
}
