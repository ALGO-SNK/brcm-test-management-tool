import { useMemo, useState } from "react";
import actionRegistry from "./actionRegistry.json";

type Category = {
    id: string;
    label: string;
    description: string;
    actionIds: string[];
};

type ActionParam = {
    used: boolean;
    required: boolean;
    type: string;
    allowedValues?: string[];
    formats?: string[];
    fields?: string[];
    description?: string;
};

type ActionContract = {
    id: string;
    label: string;
    categoryId: string;
    authoringMode: "standard" | "copy-existing-only" | "enum-only";
    notes: string;
    tags: string[];
    params: {
        element: ActionParam;
        value: ActionParam;
        expectedValue: ActionParam;
        key: ActionParam;
        headers: ActionParam;
    };
};

type Registry = {
    meta: {
        id: string;
        title: string;
        sourceType: string;
        contractFields: string[];
        authoringModes: string[];
    };
    categories: Category[];
    actions: Record<string, ActionContract>;
};

const registry = actionRegistry as Registry;

export function useActionSteps(initialCategoryId: string | null = null) {
    const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
    const [search, setSearch] = useState("");
    const [mode, setMode] = useState<"all" | "standard" | "copy-existing-only" | "enum-only">("all");

    const categories = registry.categories;

    const visibleActions = useMemo(() => {
        const scopedIds = categoryId
            ? categories.find((c) => c.id === categoryId)?.actionIds ?? []
            : categories.flatMap((c) => c.actionIds);

        return scopedIds
            .map((id) => registry.actions[id])
            .filter(Boolean)
            .filter((action) => {
                const q = search.trim().toLowerCase();
                const matchesSearch =
                    !q ||
                    action.id.toLowerCase().includes(q) ||
                    action.label.toLowerCase().includes(q) ||
                    action.notes.toLowerCase().includes(q) ||
                    action.tags.some((tag) => tag.toLowerCase().includes(q));

                const matchesMode = mode === "all" || action.authoringMode === mode;

                return matchesSearch && matchesMode;
            });
    }, [categoryId, search, mode, categories]);

    const stats = useMemo(() => {
        return {
            totalCategories: categories.length,
            totalActionsLoaded: Object.keys(registry.actions).length,
            visibleCount: visibleActions.length,
            standardCount: visibleActions.filter((a) => a.authoringMode === "standard").length,
            copyExistingOnlyCount: visibleActions.filter((a) => a.authoringMode === "copy-existing-only").length,
            enumOnlyCount: visibleActions.filter((a) => a.authoringMode === "enum-only").length
        };
    }, [categories.length, visibleActions]);

    function getActionById(actionId: string) {
        return registry.actions[actionId] ?? null;
    }

    function getCategoryById(id: string) {
        return categories.find((c) => c.id === id) ?? null;
    }

    return {
        meta: registry.meta,
        categories,
        categoryId,
        setCategoryId,
        search,
        setSearch,
        mode,
        setMode,
        actions: visibleActions,
        stats,
        getActionById,
        getCategoryById
    };
}