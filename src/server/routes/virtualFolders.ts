import { Elysia, t } from "elysia";
import type { User } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { virtualFolderService } from "../services";

export const virtualFolderRoutes = new Elysia({
  prefix: "/virtual-folders"
})
  .use(requireAuth)
  .get("/", async (ctx: any) => {
    const user = ctx.user as User | null;
    if (!user) {
      return { collections: [] };
    }

    const collections = await virtualFolderService.listCollections(user.id);
    return { collections };
  })
  .post(
    "/",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.createCollection(
        user.id,
        body.name
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, collection: result.collection };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 })
      })
    }
  )
  .patch(
    "/:id",
    async (ctx: any) => {
      const { params, body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.renameCollection(
        params.id,
        user.id,
        body.name
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        name: t.String({ minLength: 1 })
      })
    }
  )
  .patch(
    "/reorder",
    async (ctx: any) => {
      const { body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.reorderCollections(
        user.id,
        body.orderedIds
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      body: t.Object({
        orderedIds: t.Array(t.String())
      })
    }
  )
  .delete(
    "/:id",
    async (ctx: any) => {
      const { params, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.deleteCollection(
        params.id,
        user.id
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  )
  .get(
    "/:id/items",
    async (ctx: any) => {
      const { params, query, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.listItems(params.id, user.id, {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search
      });

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { ...result.data };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String())
      })
    }
  )
  .post(
    "/:id/items",
    async (ctx: any) => {
      const { params, body, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.addItems(
        params.id,
        user.id,
        body.entries
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, added: result.added, skipped: result.skipped };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        entries: t.Array(
          t.Object({
            path: t.String({ minLength: 1 }),
            label: t.Optional(t.String())
          }),
          { minItems: 1 }
        )
      })
    }
  )
  .delete(
    "/:id/items/:itemId",
    async (ctx: any) => {
      const { params, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.removeItem(
        params.id,
        user.id,
        params.itemId
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
        itemId: t.String()
      })
    }
  )
  .post(
    "/:id/items/cleanup",
    async (ctx: any) => {
      const { params, set } = ctx;
      const user = ctx.user as User | null;

      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      const result = await virtualFolderService.cleanupMissingItems(
        params.id,
        user.id
      );

      if (!result.success) {
        set.status = 400;
        return { error: result.error };
      }

      return { success: true, removed: result.removed };
    },
    {
      params: t.Object({
        id: t.String()
      })
    }
  );
