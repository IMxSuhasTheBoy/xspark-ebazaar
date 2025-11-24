import { headers as getHeaders } from "next/headers";

import { stripe } from "@/lib/stripe";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";

import { generateAuthCookie } from "../utils";
import { registerSchema, loginSchema } from "../schemas";

export const authRouter = createTRPCRouter({
  session: baseProcedure.query(async ({ ctx }) => {
    const headers = await getHeaders();
    const session = await ctx.payload.auth({
      headers,
    });

    return session;
  }),

  register: baseProcedure
    .input(registerSchema.omit({ confirmPassword: true }))
    .mutation(async ({ input, ctx }) => {
      const existingData = await ctx.payload.find({
        collection: "users",
        limit: 1,
        where: {
          username: {
            equals: input.username,
          },
        },
      });

      const existingUser = existingData?.docs[0];

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already taken.",
        });
      }

      const account = await stripe.accounts.create({}); // TODO: Improve Stripe account creation and error handling (pr #25)

      if (!account) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to create Stripe account.",
        });
      }

      const tenant = await ctx.payload.create({
        collection: "tenants",
        data: {
          name: input.username,
          slug: input.username,
          stripeAccountId: account.id,
        },
      });

      await ctx.payload.create({
        collection: "users",
        data: {
          email: input.email,
          username: input.username,
          password: input.password,
          tenants: [{ tenant: tenant.id }],
        },
      });

      // Attempt to Login after registration
      const data = await ctx.payload.login({
        collection: "users",
        data: {
          email: input.email,
          password: input.password,
        },
      });

      if (!data.token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to login.",
        });
      }

      await generateAuthCookie({
        prefix: ctx.payload.config.cookiePrefix,
        value: data.token,
      });
    }),

  login: baseProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const data = await ctx.payload.login({
      collection: "users",
      data: {
        email: input.email,
        password: input.password,
      },
    });

    if (!data.token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Failed to login. Invalid email or password",
      });
    }

    await generateAuthCookie({
      prefix: ctx.payload.config.cookiePrefix,
      value: data.token,
    });

    return data;
  }),
});

/* server usage example: trpc

import { createTRPCRouter, baseProcedure } from "@/trpc/init";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    return [{ hello: "world" }];
  }),
});

*/

/* Client usage example: trpc 

import { getPayload } from "payload";

import configPromise from "@payload-config";

import { Category } from "@/payload-types";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    const payload = await getPayload({
      config: configPromise,
    });

    const data = await payload.find({
      collection: "categories",
      depth: 1, // Populate subcategories, subcategories.[0] will definitely be a type of "Category"
      pagination: false,
      where: {
        parent: {
          exists: false,
        },
      },
      sort: "name",
    });

    const formattedData = data.docs.map((doc) => ({
      ...doc,
      subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
        // Because of the 'depth: 1' the "doc" will definitely be a type of "Category"
        ...(doc as Category),
        subcategories: undefined,
      })),
    }));

    return formattedData;
  }),
});

*/
