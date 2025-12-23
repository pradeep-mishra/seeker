// src/server/routes/settings.ts
import { Elysia, t } from "elysia";
import { requireAuth } from "../middleware/auth";
import { settingsService } from "../services";

/**
 * Settings routes
 */
export const settingsRoutes = new Elysia({ prefix: "/settings" })
  .use(requireAuth)

  /**
   * GET /api/settings
   * Get all settings
   */
  .get("/", async () => {
    const settings = await settingsService.getAllSettings();
    return { settings };
  })

  /**
   * PATCH /api/settings
   * Update settings
   */
  .patch(
    "/",
    async ({ body, set }) => {
      const success = await settingsService.updateSettings(body);

      if (!success) {
        set.status = 500;
        return { error: "Failed to update settings" };
      }

      const settings = await settingsService.getAllSettings();
      return { success: true, settings };
    },
    {
      body: t.Object({
        viewMode: t.Optional(t.Union([
          t.Literal("list"),
          t.Literal("thumbnail"),
          t.Literal("card"),
        ])),
        sortBy: t.Optional(t.Union([
          t.Literal("name"),
          t.Literal("date"),
          t.Literal("size"),
          t.Literal("type"),
        ])),
        sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        showHiddenFiles: t.Optional(t.Boolean()),
        theme: t.Optional(t.String()),
      }),
    }
  )

  /**
   * POST /api/settings/reset
   * Reset all settings to defaults
   */
  .post("/reset", async ({ set }) => {
    const success = await settingsService.resetSettings();

    if (!success) {
      set.status = 500;
      return { error: "Failed to reset settings" };
    }

    const settings = await settingsService.getAllSettings();
    return { success: true, settings };
  });
