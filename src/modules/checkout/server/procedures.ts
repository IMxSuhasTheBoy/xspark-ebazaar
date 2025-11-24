import { z } from "zod";
import type Stripe from "stripe";

import { TRPCError } from "@trpc/server";

import { stripe } from "@/lib/stripe";
import { Media, Tenant } from "@/payload-types";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";

import { CheckoutMetadata, ProductMetadata } from "../types";
import { generateTenantURL } from "@/lib/utils";

export const checkoutRouter = createTRPCRouter({
  verify: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.payload.findByID({
      collection: "users",
      id: ctx.session.user.id,
      depth: 0, // user.tenants[0].tenant will be a string (tenantId)
    }); // query db

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const tenantId = user.tenants?.[0]?.tenant as string; // This is an id beacause of depth: 0
    const tenant = await ctx.payload.findByID({
      collection: "tenants",
      id: tenantId,
    }); // query db

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: tenant.stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL!}/admin`,
      type: "account_onboarding",
    });

    console.log(accountLink, "rrr");

    if (!accountLink.url) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Failed to create verification link",
      });
    }

    console.log(accountLink.url);
    return { url: accountLink.url };
  }),

  getProducts: baseProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.payload.find({
        collection: "products",
        depth: 2, // Control relationship depth for populating "category", "image", "tenant" & "tenant.image".
        where: {
          and: [
            {
              id: { in: input.ids },
            },
            // {
            //   isArchived: { not_equals: true }, // Ensure products are not archived
            // },
          ],
        },
      }); // query db

      //
      // const foundIds = new Set(data.docs.map((doc) => doc.id));
      // const missingIds = input.ids.filter((id) => !foundIds.has(id)); // only the IDs that are not present in the foundIds Set.

      if (data.totalDocs !== input.ids.length) {
        // console.warn(
        //   `Product count mismatch: found ${data.totalDocs} products, expected ${input.ids.length}`,
        // );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Products not found",
        }); // temporary
      }
      //

      // typeof image is assigned as Media type individually
      return {
        ...data,
        // missingIds,
        totalPrice: data.docs.reduce((acc, doc) => acc + doc.price, 0),
        docs: data.docs.map((doc) => ({
          ...doc,
          image: doc.image as Media | null,
          cover: doc.cover as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null },
        })),
      };
    }),

  purchase: protectedProcedure
    .input(
      z.object({
        productIds: z.array(z.string()).min(1),
        tenantSlug: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const products = await ctx.payload.find({
        collection: "products",
        depth: 2,
        where: {
          and: [
            {
              id: { in: input.productIds },
            },
            {
              "tenant.slug": { equals: input.tenantSlug },
            },
            // {
            //   isArchived: { not_equals: true }, // Ensure products are not archived
            // },
          ],
        },
      }); // query db

      if (products.totalDocs !== input.productIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "checkoutRouter: purchase: Some products not found",
        });
      }

      // Retrieve tenant details associated with the listed products
      const tenantsData = await ctx.payload.find({
        collection: "tenants",
        depth: 1,
        where: {
          slug: { equals: input.tenantSlug },
        },
        limit: 1,
        pagination: false,
      }); // query db

      const tenant = tenantsData.docs[0];

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "checkoutRouter: purchase: Tenant not found",
        });
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        products.docs.map((product) => ({
          quantity: 1,
          price_data: {
            currency: "INR",
            unit_amount: product.price * 100, // miliunits
            product_data: {
              name: product.name,
              ...(typeof product.description === "string"
                ? { description: product.description }
                : {}),
              metadata: {
                stripeAccountId: tenant.stripeAccountId,
                id: product.id,
                name: product.name,
                price: product.price,
              } as ProductMetadata,
            },
          },
        }));

      /* Create Stripe checkout session, which is a secure Stripe-hosted payment page */
      const checkout = await stripe.checkout.sessions.create(
        {
          customer_email: ctx.session.user.email,
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${input.tenantSlug}/checkout?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenants/${input.tenantSlug}/checkout?cancel=true`,
          mode: "payment",
          line_items: lineItems,
          invoice_creation: { enabled: true },
          metadata: {
            userId: ctx.session.user.id,
          } as CheckoutMetadata,
          // payment_intent_data: {
          //   application_fee_amount: platformFeeAmount,
          // },
        },
        // {
        //   stripeAccount: tenant.stripeAccountId,
        // },
      );

      if (!checkout.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Stripe checkout session",
        });
      }

      return {
        checkoutUrl: checkout.url,
      };
    }),
});
