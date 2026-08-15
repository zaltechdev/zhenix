import { NextResponse } from "next/server";
import { z } from "zod";
import { resetUserPassword } from "@/lib/server/db/dal";
import { PASSWORD_MIN_LENGTH } from "@/lib/contracts/auth";

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 }
      );
    }

    const result = await resetUserPassword(parsed.data.email, parsed.data.newPassword);
    if (!result.success) {
      if (result.error === "user_not_found") {
        return NextResponse.json(
          { ok: false, error: "user_not_found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "server_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
