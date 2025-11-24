import z from "zod";
import type { Sort, Where } from "payload";
import { headers as getHeaders } from "next/headers";

import { DEFAULT_LIMIT } from "@/constants";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { Category, Media, Review, Tenant } from "@/payload-types";

import { sortValues } from "../search-params";

interface ReviewsByProductId {
  [productId: string]: Review[];
}

export const productsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const headers = await getHeaders();
      const session = await ctx.payload.auth({ headers });

      const product = await ctx.payload.findByID({
        collection: "products",
        depth: 2, // "product.image", "product.cover", "product.tenant", "product.tenant.image" and "product.tenant.cover"
        id: input.id,
        select: {
          content: false, // do not fetch content field
        },
      }); // query db

      let isPurchased = false;

      if (session.user) {
        const ordersData = await ctx.payload.find({
          collection: "orders",
          pagination: false,
          limit: 1,
          where: {
            and: [
              {
                product: { equals: input.id },
              },
              {
                user: { equals: session.user.id },
              },
            ],
          },
        }); // query db

        isPurchased = !!ordersData.docs[0];
      }
      // Fetch reviews for the product to summarize them
      const reviewsData = await ctx.payload.find({
        collection: "reviews",
        pagination: false,
        where: {
          product: { equals: input.id },
        },
      }); // query db

      const reviewRating =
        reviewsData.docs.length > 0
          ? reviewsData.docs.reduce((acc, review) => acc + review.rating, 0) /
            reviewsData.docs.length
          : 0;

      const ratingDistribution: Record<number, number> = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      };

      if (reviewsData.totalDocs > 0) {
        reviewsData.docs.forEach((review) => {
          const rating = review.rating;

          if (rating >= 1 && rating <= 5) {
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
          }
        });

        // Convert the rating distribution to an array of objects
        Object.keys(ratingDistribution).forEach((key) => {
          const rating = Number(key);
          const count = ratingDistribution[rating] || 0;
          ratingDistribution[rating] = Math.round(
            (count / reviewsData.docs.length) * 100,
          );
        });
      }

      return {
        ...product,
        isPurchased,
        image: product.image as Media | null,
        cover: product.cover as Media | null,
        tenant: product.tenant as Tenant & { image: Media | null },
        reviewRating,
        reviewCount: reviewsData.totalDocs,
        ratingDistribution,
      };
    }),

  getMany: baseProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),
        category: z.string().nullable().optional(),
        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        sort: z.enum(sortValues).nullable().optional(),
        tenantSlug: z.string().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Where = {};

      let sort: Sort = "-createdAt";

      // Sort filters
      if (input.sort === "curated") {
        sort = "-createdAt";
      }

      if (input.sort === "new") {
        sort = "-createdAt";
      }

      if (input.sort === "trending") {
        sort = "+createdAt";
      }

      // Price filters
      if (input.minPrice && input.maxPrice) {
        where.price = {
          greater_than_equal: input.minPrice,
          less_than_equal: input.maxPrice,
        };
      } else if (input.minPrice) {
        where.price = {
          greater_than_equal: input.minPrice,
        };
      } else if (input.maxPrice) {
        where.price = {
          less_than_equal: input.maxPrice,
        };
      }

      // tenant filters (query by a tenant)
      if (input.tenantSlug) {
        where["tenant.slug"] = {
          equals: input.tenantSlug,
        };
      }
      //  else {
      //   // if we are loading products for pubic storefront (no tenantSlug)
      //   // make sure not load products set to "isPrivate: true"
      //   // these products are only visible to the tenant store who created them
      //   where["isPrivate"] = {
      //     not_equals: true, // omit private products
      //   };
      // }

      // fetch the products data of selected category (category -> with all subcategories/subcategory -> only it self)

      if (input.category) {
        const categoriesData = await ctx.payload.find({
          collection: "categories",
          limit: 1,
          depth: 1, // Populate subcategories, subcategories.[0] will definitely be a type of "Category"
          pagination: false,
          where: {
            slug: { equals: input.category },
          },
        }); // query db

        console.log(JSON.stringify(categoriesData, null, 2));

        const formattedData = categoriesData.docs.map((doc) => ({
          ...doc,
          subcategories: (doc.subcategories?.docs ?? []).map(
            (subcategoryDoc) => ({
              // Because of the 'depth: 1' the "subcategoryDoc" will definitely be a type of "Category"
              ...(subcategoryDoc as Category),
              subcategories: undefined,
            }),
          ),
        }));

        const subcategoriesSlugs = [];
        const parentCategory = formattedData[0];

        if (parentCategory) {
          subcategoriesSlugs.push(
            ...parentCategory.subcategories.map(
              (subcategory) => subcategory.slug,
            ),
          );

          where["category.slug"] = {
            in: [parentCategory.slug, ...subcategoriesSlugs],
          };
        }
      }

      if (input.tags && input.tags.length > 0) {
        where["tags.name"] = {
          in: input.tags,
        };
      }

      const data = await ctx.payload.find({
        collection: "products",
        depth: 2, // Control relationship depth for populating "category", "image", "tenant" & "tenant.image".
        where,
        sort,
        page: input.cursor,
        limit: input.limit,
        select: {
          content: false, // do not fetch content field
        },
      }); // query db

      // batch fetching reviews and then matching them to products in memory:
      // fetch all reviews for all products in a single query
      const productsIds = data.docs.map((doc) => doc.id);
      const allReviewsData = await ctx.payload.find({
        collection: "reviews",
        pagination: false,
        where: {
          product: { in: productsIds },
        },
      }); // query db

      // group reviews by product id with proper typing
      const reviewsByProductId = allReviewsData.docs.reduce<ReviewsByProductId>(
        (acc, review) => {
          // product field from Review type is string | Product, we want the string (ID)
          const productId =
            typeof review.product === "string"
              ? review.product
              : review.product.id;
          if (!acc[productId]) {
            acc[productId] = [];
          }
          acc[productId].push(review);
          return acc;
        },
        {},
      );

      // map product data with review summaries
      const dataWithSummarizedReviews = data.docs.map((doc) => {
        const productReviews = reviewsByProductId[doc.id] || [];
        const reviewCount = productReviews.length;
        const rawAverage =
          reviewCount === 0
            ? 0
            : productReviews.reduce((acc, review) => acc + review.rating, 0) /
              reviewCount;
        const reviewRating = Math.round(rawAverage * 100) / 100; // round to two decimal places

        return {
          ...doc,
          reviewCount,
          reviewRating,
        };
      });

      // const dataWithSummarizedReviews = await Promise.all(
      //   data.docs.map(async (doc) => {
      //     const reviewsData = await ctx.payload.find({
      //       collection: "reviews",
      //       pagination: false,
      //       where: {
      //         product: { equals: doc.id },
      //       },
      //     });

      //     return {
      //       ...doc,
      //       reviewCount: reviewsData.totalDocs,
      //       reviewRating:
      //         reviewsData.docs.length === 0
      //           ? 0
      //           : reviewsData.docs.reduce(
      //               (acc, review) => acc + review.rating,
      //               0,
      //             ) / reviewsData.totalDocs,
      //     };
      //   }),
      // );

      // dev testing code, artificial delay:
      // await new Promise((resolve) => setTimeout(() => resolve, 5000));
      return {
        ...data,
        docs: dataWithSummarizedReviews.map((doc) => ({
          ...doc,
          image: doc.image as Media | null,
          cover: doc.cover as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null },
        })),
      };
    }),
});
