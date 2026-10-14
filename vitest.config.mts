import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "db/**/*.test.{ts,tsx}",
      "domain/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "server/**/*.test.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
    ],
  },
});
