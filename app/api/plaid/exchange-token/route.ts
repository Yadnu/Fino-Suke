export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { plaidExchangeTokenSchema } from "@/lib/validations";
import prisma from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthenticatedUser();

    const { allowed } = await rateLimit(userId, 20, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = plaidExchangeTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { public_token, institution_name, institution_id } = parsed.data;

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = exchangeResponse.data;

    const plaidItem = await prisma.plaidItem.create({
      data: {
        userId,
        itemId: item_id,
        accessToken: access_token,
        institutionId: institution_id ?? null,
        institutionName: institution_name ?? null,
      },
    });

    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    const accounts = await Promise.all(
      accountsResponse.data.accounts.map((acct) =>
        prisma.plaidAccount.upsert({
          where: { accountId: acct.account_id },
          update: {
            name: acct.name,
            mask: acct.mask ?? null,
            type: acct.type,
            subtype: acct.subtype ?? null,
          },
          create: {
            userId,
            plaidItemId: plaidItem.id,
            accountId: acct.account_id,
            name: acct.name,
            mask: acct.mask ?? null,
            type: acct.type,
            subtype: acct.subtype ?? null,
          },
        })
      )
    );

    return NextResponse.json(
      {
        success: true,
        itemId: plaidItem.id,
        accounts: accounts.map((a) => ({
          id: a.id,
          accountId: a.accountId,
          name: a.name,
          mask: a.mask,
          type: a.type,
          subtype: a.subtype,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[plaid/exchange-token POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
