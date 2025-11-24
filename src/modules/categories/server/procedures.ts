import { Category } from "@/payload-types";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    const data = await ctx.payload.find({
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
      subcategories: (doc.subcategories?.docs ?? []).map((subcategoryDoc) => ({
        // Because of the 'depth: 1' the "subcategoryDoc" will definitely be a type of "Category"
        ...(subcategoryDoc as Category),
        // subcategories: undefined,
      })),
    }));

    return formattedData;
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
