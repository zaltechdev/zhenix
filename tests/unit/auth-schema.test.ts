import { describe, expect, it } from "vitest";

import { users } from "@/lib/server/db/schema";

describe("Better Auth user schema", () => {
  it("exposes the image field Better Auth writes", () => {
    expect(users.image.name).toBe("image_url");
  });
});
