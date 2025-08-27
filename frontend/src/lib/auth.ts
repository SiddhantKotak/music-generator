import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true if you want email verification
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },
  user: {
    additionalFields: {
      credits: {
        type: "number",
        defaultValue: 0,
        required: false,
      },
    },
  },
  // Optional: Add trusted origins for CORS
  trustedOrigins: [
    "http://localhost:3000", 
    "https://yourdomain.com" // Replace with your production domain
  ],
  // Optional: Add rate limiting
  rateLimit: {
    window: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  // Optional: Configure advanced security
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});