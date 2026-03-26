import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

import { configureWebPush, getWebPush } from "@/lib/webPush";

beforeEach(() => {
  mockSetVapidDetails.mockReset();
  mockSendNotification.mockReset();
  // Reset the module-level `configured` singleton between tests via re-import trick
  vi.resetModules();
});

describe("configureWebPush", () => {
  it("should return false when VAPID env vars are missing", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const { configureWebPush: freshConfigure } = await import("@/lib/webPush");
    const result = freshConfigure();
    expect(result).toBe(false);
  });

  it("should return true and call setVapidDetails when all VAPID vars are present", async () => {
    process.env.VAPID_PUBLIC_KEY = "BFakePublicKey";
    process.env.VAPID_PRIVATE_KEY = "FakePrivateKey";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    const { configureWebPush: freshConfigure } = await import("@/lib/webPush");
    const result = freshConfigure();
    expect(result).toBe(true);
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "BFakePublicKey",
      "FakePrivateKey"
    );
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });
});

describe("getWebPush", () => {
  it("should return null when VAPID configuration is missing", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const { getWebPush: freshGet } = await import("@/lib/webPush");
    const result = freshGet();
    expect(result).toBeNull();
  });

  it("should return the webpush instance when VAPID vars are configured", async () => {
    process.env.VAPID_PUBLIC_KEY = "BFakePublicKey";
    process.env.VAPID_PRIVATE_KEY = "FakePrivateKey";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    const { getWebPush: freshGet } = await import("@/lib/webPush");
    const result = freshGet();
    expect(result).not.toBeNull();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });
});
