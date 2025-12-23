// src/server/services/settingsService.ts
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { SettingsKey, SortBy, SortOrder, ViewMode } from "../db/schema";
import {
  SettingsKeys,
  SortByOptions,
  SortOrderOptions,
  ViewModes
} from "../db/schema";

const { settings } = schema;

/**
 * Application settings interface
 */
export interface AppSettings {
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  showHiddenFiles: boolean;
  theme: string;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  viewMode: ViewModes.LIST,
  sortBy: SortByOptions.NAME,
  sortOrder: SortOrderOptions.ASC,
  showHiddenFiles: true,
  theme: "light"
};

/**
 * Settings Service
 * Handles global application settings
 */
export class SettingsService {
  /**
   * Get a single setting value
   */
  async getSetting<T>(key: SettingsKey): Promise<T | undefined> {
    try {
      const result = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (result.length === 0) {
        return undefined;
      }

      return JSON.parse(result[0].value) as T;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set a single setting value
   */
  async setSetting<T>(key: SettingsKey, value: T): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);

      // Use upsert pattern: insert with onConflict update
      await db
        .insert(settings)
        .values({
          key,
          value: jsonValue,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: jsonValue,
            updatedAt: new Date()
          }
        });

      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<AppSettings> {
    const result: AppSettings = { ...DEFAULT_SETTINGS };

    try {
      const allSettings = await db.select().from(settings);

      for (const setting of allSettings) {
        try {
          const value = JSON.parse(setting.value);
          switch (setting.key) {
            case SettingsKeys.VIEW_MODE:
              if (Object.values(ViewModes).includes(value)) {
                result.viewMode = value;
              }
              break;
            case SettingsKeys.SORT_BY:
              if (Object.values(SortByOptions).includes(value)) {
                result.sortBy = value;
              }
              break;
            case SettingsKeys.SORT_ORDER:
              if (Object.values(SortOrderOptions).includes(value)) {
                result.sortOrder = value;
              }
              break;
            case SettingsKeys.SHOW_HIDDEN_FILES:
              result.showHiddenFiles = Boolean(value);
              break;
            case SettingsKeys.THEME:
              result.theme = String(value);
              break;
          }
        } catch {
          // Skip invalid JSON values
        }
      }
    } catch (error) {
      console.error("Error getting all settings:", error);
    }

    return result;
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<boolean> {
    try {
      if (updates.viewMode !== undefined) {
        await this.setSetting(SettingsKeys.VIEW_MODE, updates.viewMode);
      }
      if (updates.sortBy !== undefined) {
        await this.setSetting(SettingsKeys.SORT_BY, updates.sortBy);
      }
      if (updates.sortOrder !== undefined) {
        await this.setSetting(SettingsKeys.SORT_ORDER, updates.sortOrder);
      }
      if (updates.showHiddenFiles !== undefined) {
        await this.setSetting(
          SettingsKeys.SHOW_HIDDEN_FILES,
          updates.showHiddenFiles
        );
      }
      if (updates.theme !== undefined) {
        await this.setSetting(SettingsKeys.THEME, updates.theme);
      }

      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      return false;
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetSettings(): Promise<boolean> {
    try {
      await this.updateSettings(DEFAULT_SETTINGS);
      return true;
    } catch (error) {
      console.error("Error resetting settings:", error);
      return false;
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
