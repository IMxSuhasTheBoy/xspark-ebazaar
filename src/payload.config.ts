import path from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";
import { buildConfig } from "payload";

import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { payloadCloudPlugin } from "@payloadcms/payload-cloud";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";

import { isSuperAdmin } from "./lib/access";

import { Tags } from "./collections/Tags";
import { Media } from "./collections/Media";
import { Users } from "./collections/Users";
import { Tenants } from "./collections/Tenants";
import { Products } from "./collections/Products";
import { Categories } from "./collections/Categories";
import { Orders } from "./collections/Orders";
import { Config } from "./payload-types";
import { Reviews } from "./collections/Reviews";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeNavLinks: ["@/components/stripe-verify#StripeVerify"],
    },
  },
  collections: [
    Categories,
    Products,
    Media,
    Users,
    Tags,
    Tenants,
    Orders,
    Reviews,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    multiTenantPlugin<Config>({
      collections: {
        products: {},
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
    }),
    // storage-adapter-placeholder
  ],
});
