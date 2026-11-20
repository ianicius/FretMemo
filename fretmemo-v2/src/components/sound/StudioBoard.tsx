import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    DRIVE_CHARACTERS,
    IMPULSE_RESPONSES,
    MAX_CHAIN_BLOCKS,
    NAM_MODELS,
    createChainBlock,
    driveCharacterOf,
    type BlockType,
    type ChainBlock,
    type ChainGlobals,
    type SoundPreset,
} from "@/audio/presets";
import { deleteUserModel, saveUserModel, UserModelError, type UserModelMeta } from "@/audio/userModels";
import { getPresetName } from "@/components/sound/presetUtils";
import { Knob } from "@/components/sound/Knob";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import { cn } from "@/lib/utils";

const AMP_GROUPS: { labelKey: string; ids: string[] }[] = [
    { labelKey: "sound.studio.groups.classic", ids: ["classic"] },
    { labelKey: "sound.studio.groups.clean", ids: ["nam-deluxe-a2", "nam-clean-jc"] },
    { labelKey: "sound.studio.groups.crunch", ids: ["nam-crunch-ac10", "nam-lead-jcm", "nam-lead-dumble"] },
    { labelKey: "sound.studio.groups.lead", ids: ["nam-high-gain-5153"] },
    { labelKey: "sound.studio.groups.bass", ids: ["nam-vintage-ampeg"] },
];

const PALETTE: { labelKey: string; types: BlockType[] }[] = [
    { labelKey: "sound.studio.palette.ampCab", types: ["amp", "cab"] },
    { labelKey: "sound.studio.palette.gain", types: ["drive", "comp"] },
    { labelKey: "sound.studio.palette.tone", types: ["eq"] },
    { labelKey: "sound.studio.palette.modulation", types: ["chorus", "tremolo", "phaser", "flanger", "wah"] },
    { labelKey: "sound.studio.palette.time", types: ["delay", "reverb"] },
];

export interface StudioEditor {
    sourceId: string | null;
    name: string;
    blocks: ChainBlock[];
    globals: ChainGlobals;
    dirty: boolean;
}

interface StudioBoardProps {
    editor: StudioEditor;
    builtInPresets: SoundPreset[];
    customPresets: SoundPreset[];
    activePresetId: string;
    userAmps: UserModelMeta[];
    onUserAmpsChange: (amps: UserModelMeta[]) => void;
    onSelectPreset: (preset: SoundPreset) => void;
    onDeletePreset: (preset: SoundPreset) => void;
    onNewRig: () => void;
    onChange: (editor: StudioEditor) => void;
}

const CAB_IRS = Object.entries(IMPULSE_RESPONSES).filter(([, ir]) => ir.kind === "cab");
const REVERB_IRS = Object.entries(IMPULSE_RESPONSES).filter(([, ir]) => ir.kind === "reverb");

function dbText(value: number): string {
    const rounded = Number(value.toFixed(1));
    return `${rounded > 0 ? "+" : ""}${rounded} dB`;
}

function gainText(value: number): string {
    return `${Number(value.toFixed(2))}x`;
}

function percentText(value: number): string {
    return `${Math.round(value * 100)} %`;
}

function blockDetail(
    block: ChainBlock,
    userAmps: UserModelMeta[],
    t: (key: string, options?: Record<string, unknown>) => string,
): string {
    if (block.type === "amp") {
        const model = typeof block.params.model === "string" ? block.params.model : "classic";
        if (model === "classic" || model in NAM_MODELS) return t(`sound.designer.amps.${model}`);
        return userAmps.find((amp) => amp.id === model)?.name ?? model;
    }
    if (block.type === "cab") {
        if (block.params.mode === "none") return t("sound.designer.cab.none");
        if (block.params.mode === "ir") {
            const id = typeof block.params.irId === "string" ? block.params.irId : "";
            return IMPULSE_RESPONSES[id]?.label ?? t("sound.studio.cabFilter");
        }
        return t("sound.studio.cabFilter");
    }
    if (block.type === "drive") {
        const amount = typeof block.params.amount === "number" ? block.params.amount : 0;
        return `${t(`sound.studio.drives.${driveCharacterOf(block.params.character)}`)} · ${percentText(amount)}`;
    }
    if (block.type === "comp") return percentText(typeof block.params.amount === "number" ? block.params.amount : 0);
    if (block.type === "eq") {
        const signed = (key: string, fallback: number) => {
            const raw = block.params[key];
            const value = Math.round(typeof raw === "number" ? raw : fallback);
            return `${value > 0 ? "+" : ""}${value}`;
        };
        return `${signed("bass", 2)} · ${signed("mid", -4)} · ${signed("treble", 3)}`;
    }
    if (block.type === "chorus") return percentText(typeof block.params.mix === "number" ? block.params.mix : 0);
    if (block.type === "wah") return percentText(typeof block.params.depth === "number" ? block.params.depth : 0);
    if (block.type === "tremolo" || block.type === "phaser" || block.type === "flanger") {
        const depth = typeof block.params.depth === "number" ? block.params.depth : 0;
        const rate = typeof block.params.rate === "number" ? block.params.rate : 0;
        return `${percentText(depth)} · ${Number(rate.toFixed(2))} Hz`;
    }
    if (block.type === "delay") {
        const time = typeof block.params.time === "number" ? block.params.time : 0.28;
        return `${Math.round(time * 1000)} ms`;
    }
    if (block.type === "reverb") return percentText(typeof block.params.mix === "number" ? block.params.mix : 0);
    return "";
}

export function StudioBoard({
    editor,
    builtInPresets,
    customPresets,
    activePresetId,
    userAmps,
    onUserAmpsChange,
    onSelectPreset,
    onDeletePreset,
    onNewRig,
    onChange,
}: StudioBoardProps) {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(0);
    const [pickerAt, setPickerAt] = useState<number | null>(null);
    const selectedIndex = editor.blocks.length === 0 ? -1 : Math.min(selected, editor.blocks.length - 1);
    const selectedBlock = selectedIndex >= 0 ? editor.blocks[selectedIndex] : null;
    const full = editor.blocks.length >= MAX_CHAIN_BLOCKS;

    const commit = (blocks: ChainBlock[], globals: ChainGlobals, selectIndex = selectedIndex) => {
        onChange({ ...editor, blocks, globals, dirty: true });
        if (selectIndex >= 0) setSelected(selectIndex);
    };

    const patchBlock = (index: number, recipe: (block: ChainBlock) => ChainBlock) => {
        const blocks = editor.blocks.map((block, i) => (i === index ? recipe(block) : block));
        commit(blocks, editor.globals, index);
    };

    const insert = (index: number, type: BlockType) => {
        if (full) return;
        const block = createChainBlock(type);
        const at = Math.max(0, Math.min(index, editor.blocks.length));
        const blocks = editor.blocks.slice();
        blocks.splice(at, 0, block);
        const toneStackIndex = at <= editor.globals.toneStackIndex
            ? editor.globals.toneStackIndex + 1
            : editor.globals.toneStackIndex;
        commit(blocks, { ...editor.globals, toneStackIndex }, at);
        setPickerAt(null);
    };

    const removeAt = (index: number) => {
        const blocks = editor.blocks.filter((_, i) => i !== index);
        const toneStackIndex = index < editor.globals.toneStackIndex
            ? Math.max(0, editor.globals.toneStackIndex - 1)
            : editor.globals.toneStackIndex;
        commit(blocks, { ...editor.globals, toneStackIndex: Math.min(toneStackIndex, blocks.length) }, Math.max(0, index - 1));
    };

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= editor.blocks.length) return;
        const blocks = editor.blocks.slice();
        const [item] = blocks.splice(index, 1);
        blocks.splice(target, 0, item);
        let toneStackIndex = editor.globals.toneStackIndex;
        if (index < toneStackIndex && target >= toneStackIndex) toneStackIndex -= 1;
        else if (index >= toneStackIndex && target < toneStackIndex) toneStackIndex += 1;
        commit(blocks, { ...editor.globals, toneStackIndex }, target);
    };

    const setGlobal = (patch: Partial<ChainGlobals>) => {
        onChange({ ...editor, globals: { ...editor.globals, ...patch }, dirty: true });
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav aria-label={t("sound.studio.presets")} className="order-2 space-y-4 rounded-xl border border-border bg-card/60 p-3 lg:order-1">
                <p className="text-xs leading-snug text-muted-foreground">{t("sound.studio.appSound")}</p>
                <div className="space-y-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("sound.studio.builtIn")}</h2>
                    <ul className="space-y-1">
                        {builtInPresets.map((preset) => (
                            <li key={preset.id}>
                                <PresetRow
                                    name={getPresetName(preset, t)}
                                    active={preset.id === activePresetId}
                                    onSelect={() => onSelectPreset(preset)}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="space-y-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("sound.studio.yourRigs")}</h2>
                    {customPresets.length === 0 ? (
                        <p className="px-1 text-xs text-muted-foreground">{t("sound.studio.noRigs")}</p>
                    ) : (
                        <ul className="space-y-1">
                            {customPresets.map((preset) => (
                                <li key={preset.id} className="flex items-center gap-1">
                                    <PresetRow
                                        name={getPresetName(preset, t)}
                                        active={preset.id === activePresetId}
                                        onSelect={() => onSelectPreset(preset)}
                                    />
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 shrink-0"
                                        aria-label={t("sound.actions.deleteTone")}
                                        onClick={() => onDeletePreset(preset)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={onNewRig}>
                    {t("sound.studio.newRig")}
                </Button>
            </nav>

            <div className="order-1 min-w-0 space-y-4 lg:order-2">
                <section
                    aria-label={t("sound.studio.chainLabel")}
                    className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-sm"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                        <h2 className="text-sm font-semibold">{t("sound.studio.chainLabel")}</h2>
                        <p className="text-xs tabular-nums text-muted-foreground">{editor.blocks.length}/{MAX_CHAIN_BLOCKS}</p>
                    </div>
                    <div className="overflow-x-auto" data-testid="signal-chain">
                        <div className="relative mx-auto flex w-max items-center gap-1 px-3 py-6">
                            <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-primary/35" aria-hidden="true" />
                            <InsertPoint disabled={full} active={pickerAt === 0} onClick={() => setPickerAt(pickerAt === 0 ? null : 0)} />
                            {editor.globals.toneStackIndex <= 0 && <ToneSlot label={t("sound.studio.toneSlot")} />}
                            {editor.blocks.length === 0 && (
                                <p className="relative px-3 text-sm text-muted-foreground">{t("sound.studio.empty")}</p>
                            )}
                            {editor.blocks.map((block, index) => (
                                <div key={block.id} className="relative flex items-center gap-1">
                                    {index > 0 && editor.globals.toneStackIndex === index && <ToneSlot label={t("sound.studio.toneSlot")} />}
                                    <button
                                        type="button"
                                        data-chain-block={block.type}
                                        aria-pressed={index === selectedIndex}
                                        onClick={() => setSelected(index)}
                                        className={cn(
                                            "flex h-[6.75rem] w-[7.375rem] shrink-0 flex-col justify-between rounded-xl border bg-background px-2.5 py-2 text-left shadow-sm",
                                            index === selectedIndex
                                                ? "border-primary bg-primary/10 shadow-[inset_0_3px_0_0_hsl(var(--primary))] ring-2 ring-primary/25"
                                                : "border-border hover:border-primary/40",
                                            !block.enabled && "opacity-50",
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                                                {t(`sound.studio.blocks.${block.type}`)}
                                            </span>
                                        </span>
                                        <span className="line-clamp-2 font-heading text-[13px] font-semibold leading-tight">
                                            {blockDetail(block, userAmps, t)}
                                        </span>
                                    </button>
                                    <InsertPoint
                                        disabled={full}
                                        active={pickerAt === index + 1}
                                        onClick={() => setPickerAt(pickerAt === index + 1 ? null : index + 1)}
                                    />
                                </div>
                            ))}
                            {editor.globals.toneStackIndex >= editor.blocks.length && editor.blocks.length > 0 && (
                                <ToneSlot label={t("sound.studio.toneSlot")} />
                            )}
                        </div>
                    </div>
                    <div className="space-y-3 border-t border-border/70 px-4 py-3" role="group" aria-label={t("sound.studio.pickerTitle")}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">{t("sound.studio.pickerTitle")}</p>
                            {pickerAt !== null && (
                                <p className="text-xs text-primary">{t("sound.studio.insertHere")}</p>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-start xl:gap-x-8 xl:gap-y-3">
                            {PALETTE.map((group) => (
                                <div key={group.labelKey} className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(group.labelKey)}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {group.types.map((type) => (
                                            <Button
                                                key={type}
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                disabled={full}
                                                onClick={() => insert(pickerAt ?? (selectedIndex >= 0 ? selectedIndex + 1 : editor.blocks.length), type)}
                                            >
                                                {t(`sound.studio.blocks.${type}`)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-2 gap-y-4 border-t border-border/70 bg-muted/30 px-3 py-4 sm:grid-cols-6">
                        <div className="flex flex-col items-center justify-end">
                            <Knob label={t("sound.studio.input")} value={editor.globals.inputGain} min={0} max={2} step={0.05} valueText={gainText(editor.globals.inputGain)} onChange={(inputGain) => setGlobal({ inputGain })} />
                        </div>
                        <div className="flex flex-col items-center justify-end gap-1">
                            <button
                                type="button"
                                aria-pressed={editor.globals.gateEnabled}
                                aria-label={t("sound.studio.gate")}
                                onClick={() => setGlobal({ gateEnabled: !editor.globals.gateEnabled })}
                                className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium",
                                    editor.globals.gateEnabled ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                                )}
                            >
                                {t("sound.studio.gate")}
                            </button>
                            <Knob
                                label={t("sound.studio.gateThreshold")}
                                value={editor.globals.gateThresholdDb}
                                min={-80}
                                max={0}
                                step={1}
                                valueText={`${editor.globals.gateThresholdDb} dB`}
                                onChange={(gateThresholdDb) => setGlobal({ gateThresholdDb })}
                                disabled={!editor.globals.gateEnabled}
                            />
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <Knob label={t("sound.studio.bass")} value={editor.globals.bass} min={-12} max={12} step={0.5} valueText={dbText(editor.globals.bass)} onChange={(bass) => setGlobal({ bass })} />
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <Knob label={t("sound.studio.middle")} value={editor.globals.mid} min={-12} max={12} step={0.5} valueText={dbText(editor.globals.mid)} onChange={(mid) => setGlobal({ mid })} />
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <Knob label={t("sound.studio.treble")} value={editor.globals.treble} min={-12} max={12} step={0.5} valueText={dbText(editor.globals.treble)} onChange={(treble) => setGlobal({ treble })} />
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            <Knob label={t("sound.studio.output")} value={editor.globals.outputGain} min={0} max={2} step={0.05} valueText={gainText(editor.globals.outputGain)} onChange={(outputGain) => setGlobal({ outputGain })} />
                        </div>
                    </div>
                </section>

                {selectedBlock && (
                    <section aria-label={t("sound.studio.inspector")} className="space-y-3 rounded-xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                    {t(`sound.studio.blocks.${selectedBlock.type}`)}
                                </p>
                                <h2 className="font-heading text-base font-semibold leading-tight">
                                    {blockDetail(selectedBlock, userAmps, t)}
                                </h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => patchBlock(selectedIndex, (block) => ({ ...block, enabled: !block.enabled }))}>
                                    {selectedBlock.enabled ? t("sound.studio.bypass") : t("sound.studio.enable")}
                                </Button>
                                <Button type="button" size="sm" variant="outline" aria-label={t("sound.studio.moveLeft")} onClick={() => move(selectedIndex, -1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="outline" aria-label={t("sound.studio.moveRight")} onClick={() => move(selectedIndex, 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="outline" aria-label={t("sound.studio.remove")} onClick={() => removeAt(selectedIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <BlockControls
                            block={selectedBlock}
                            userAmps={userAmps}
                            onUserAmpsChange={onUserAmpsChange}
                            onChange={(params) => patchBlock(selectedIndex, (block) => ({ ...block, params }))}
                        />
                    </section>
                )}
            </div>
        </div>
    );
}

function PresetRow({ name, active, onSelect }: { name: string; active: boolean; onSelect: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onSelect}
            className={cn(
                "w-full truncate rounded-lg px-2 py-1.5 text-left text-sm",
                active ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
        >
            {name}
        </button>
    );
}

function ToneSlot({ label }: { label: string }) {
    return (
        <div className="relative grid h-[6.75rem] w-14 shrink-0 place-items-center rounded-lg border border-dashed border-primary/50 bg-background text-[10px] font-semibold uppercase tracking-wider text-primary">
            {label}
        </div>
    );
}

function InsertPoint({ disabled, active, onClick }: { disabled: boolean; active: boolean; onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            aria-label={t("sound.studio.addEffect")}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed bg-background disabled:opacity-30",
                active ? "border-primary bg-primary text-primary-foreground" : "border-primary/50 text-primary",
            )}
        >
            <Plus className="h-3.5 w-3.5" />
        </button>
    );
}

function GearGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
        </div>
    );
}

function GearCard({
    name,
    hint,
    pressed,
    onClick,
}: {
    name: string;
    hint?: string;
    pressed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
                "min-h-[3.25rem] rounded-lg border px-3 py-2 text-left transition-colors",
                pressed
                    ? "border-primary bg-primary/15 shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "border-border bg-background hover:border-primary/45",
            )}
        >
            <span className="block font-heading text-sm font-semibold leading-snug">{name}</span>
            {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span> : null}
        </button>
    );
}

function BlockControls({
    block,
    userAmps,
    onUserAmpsChange,
    onChange,
}: {
    block: ChainBlock;
    userAmps: UserModelMeta[];
    onUserAmpsChange: (amps: UserModelMeta[]) => void;
    onChange: (params: Record<string, string | number>) => void;
}) {
    const { t } = useTranslation();
    const fileRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [importErrorKey, setImportErrorKey] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<UserModelMeta | null>(null);
    const enqueueFeedback = useFeedbackStore((state) => state.enqueue);
    const set = (key: string, value: string | number) => onChange({ ...block.params, [key]: value });
    const num = (key: string, fallback: number) => {
        const value = block.params[key];
        return typeof value === "number" ? value : fallback;
    };

    if (block.type === "amp") {
        const model = typeof block.params.model === "string" ? block.params.model : "classic";
        const selectedUser = userAmps.find((amp) => amp.id === model) ?? null;
        const importFile = async (file: File) => {
            setImporting(true);
            setImportErrorKey(null);
            try {
                const bytes = await file.arrayBuffer();
                const meta = await saveUserModel(file.name.replace(/\.nam$/i, ""), bytes);
                onUserAmpsChange([meta, ...userAmps.filter((amp) => amp.id !== meta.id)]);
                onChange({ ...block.params, model: meta.id });
                enqueueFeedback(t("sound.designer.import.success", { name: meta.name }), "success");
            } catch (error) {
                const code = error instanceof UserModelError ? error.code : "storage-error";
                setImportErrorKey(`sound.designer.import.errors.${code}`);
            } finally {
                setImporting(false);
            }
        };
        const confirmDelete = async () => {
            const target = pendingDelete;
            if (!target) return;
            setPendingDelete(null);
            await deleteUserModel(target.id);
            onUserAmpsChange(userAmps.filter((amp) => amp.id !== target.id));
            if (model === target.id) onChange({ ...block.params, model: "classic" });
            enqueueFeedback(t("sound.designer.import.deleted", { name: target.name }), "success");
        };
        return (
            <div className="space-y-4">
                {AMP_GROUPS.map((group) => (
                    <GearGroup key={group.labelKey} label={t(group.labelKey)}>
                        {group.ids.map((id) => (
                            <GearCard
                                key={id}
                                name={t(`sound.designer.amps.${id}`)}
                                pressed={model === id}
                                onClick={() => onChange({ ...block.params, model: id })}
                            />
                        ))}
                    </GearGroup>
                ))}
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("sound.studio.groups.yours")}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {userAmps.length === 0 ? (
                            <p className="col-span-full text-xs leading-snug text-muted-foreground">{t("sound.studio.yourModelsEmpty")}</p>
                        ) : (
                            userAmps.map((amp) => (
                                <GearCard
                                    key={amp.id}
                                    name={amp.name}
                                    hint={t("sound.designer.import.userNote")}
                                    pressed={model === amp.id}
                                    onClick={() => onChange({ ...block.params, model: amp.id })}
                                />
                            ))
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".nam,application/json"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void importFile(file);
                            }}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
                            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {t("sound.designer.import.label")}
                        </Button>
                        {selectedUser && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setPendingDelete(selectedUser)}>
                                <Trash2 className="h-4 w-4" />
                                {t("sound.designer.import.deleteAmp")}
                            </Button>
                        )}
                    </div>
                    {importErrorKey && (
                        <p className="text-xs text-destructive" role="alert">{t(importErrorKey)}</p>
                    )}
                    <p className="text-xs leading-snug text-muted-foreground">{t("sound.designer.import.licenseNote")}</p>
                </div>
                <ConfirmDialog
                    open={pendingDelete !== null}
                    onOpenChange={(open) => {
                        if (!open) setPendingDelete(null);
                    }}
                    title={t("sound.designer.import.deleteConfirmTitle")}
                    description={t("sound.designer.import.deleteConfirmDesc", { name: pendingDelete?.name ?? "" })}
                    confirmLabel={t("sound.designer.import.deleteAmp")}
                    cancelLabel={t("sound.custom.deleteConfirmCancel")}
                    confirmVariant="destructive"
                    onConfirm={() => void confirmDelete()}
                />
            </div>
        );
    }

    if (block.type === "cab") {
        const mode = typeof block.params.mode === "string" ? block.params.mode : "filter";
        const irId = typeof block.params.irId === "string" ? block.params.irId : "";
        return (
            <div className="space-y-4">
                <GearGroup label={t("sound.studio.groups.speaker")}>
                    <GearCard name={t("sound.studio.cabFilter")} pressed={mode === "filter"} onClick={() => onChange({ mode: "filter" })} />
                    <GearCard
                        name={t("sound.designer.cab.none")}
                        hint={t("sound.designer.cab.hint")}
                        pressed={mode === "none"}
                        onClick={() => onChange({ mode: "none" })}
                    />
                </GearGroup>
                <GearGroup label={t("sound.studio.groups.cabinets")}>
                    {CAB_IRS.map(([id, ir]) => (
                        <GearCard
                            key={id}
                            name={ir.label}
                            pressed={mode === "ir" && irId === id}
                            onClick={() => onChange({ mode: "ir", irId: id })}
                        />
                    ))}
                </GearGroup>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {block.type === "drive" && (
                <div className="space-y-2">
                    <GearGroup label={t("sound.studio.groups.character")}>
                        {DRIVE_CHARACTERS.map((id) => (
                            <GearCard
                                key={id}
                                name={t(`sound.studio.drives.${id}`)}
                                pressed={driveCharacterOf(block.params.character) === id}
                                onClick={() => set("character", id)}
                            />
                        ))}
                    </GearGroup>
                    <p className="text-xs leading-snug text-muted-foreground">{t("sound.studio.drives.note")}</p>
                </div>
            )}
            {block.type === "wah" && (
                <p className="text-xs leading-snug text-muted-foreground">{t("sound.studio.wah.note")}</p>
            )}
            {block.type === "eq" && (
                <p className="text-xs leading-snug text-muted-foreground">{t("sound.studio.eq.note")}</p>
            )}
            <div className="flex flex-wrap items-end gap-4">
                {block.type === "drive" && (
                    <Knob label={t("sound.designer.params.drive")} value={num("amount", 0)} min={0} max={1} step={0.01} valueText={percentText(num("amount", 0))} onChange={(amount) => set("amount", amount)} />
                )}
                {block.type === "comp" && (
                    <Knob label={t("sound.designer.params.comp")} value={num("amount", 0)} min={0} max={1} step={0.01} valueText={percentText(num("amount", 0))} onChange={(amount) => set("amount", amount)} />
                )}
                {block.type === "eq" && (
                    <>
                        <Knob label={t("sound.studio.eq.low")} value={num("bass", 2)} min={-12} max={12} step={0.5} valueText={dbText(num("bass", 2))} onChange={(bass) => set("bass", bass)} />
                        <Knob label={t("sound.studio.eq.mid")} value={num("mid", -4)} min={-12} max={12} step={0.5} valueText={dbText(num("mid", -4))} onChange={(mid) => set("mid", mid)} />
                        <Knob label={t("sound.studio.eq.high")} value={num("treble", 3)} min={-12} max={12} step={0.5} valueText={dbText(num("treble", 3))} onChange={(treble) => set("treble", treble)} />
                    </>
                )}
                {block.type === "chorus" && (
                    <Knob label={t("sound.designer.params.chorusMix")} value={num("mix", 0)} min={0} max={1} step={0.01} valueText={percentText(num("mix", 0))} onChange={(mix) => set("mix", mix)} />
                )}
                {block.type === "tremolo" && (
                    <>
                        <Knob label={t("sound.designer.params.tremoloDepth")} value={num("depth", 0)} min={0} max={1} step={0.01} valueText={percentText(num("depth", 0))} onChange={(depth) => set("depth", depth)} />
                        <Knob label={t("sound.designer.params.tremoloRate")} value={num("rate", 5)} min={1} max={12} step={0.1} valueText={`${num("rate", 5)} Hz`} onChange={(rate) => set("rate", rate)} />
                    </>
                )}
                {block.type === "wah" && (
                    <>
                        <Knob label={t("sound.designer.params.tremoloDepth")} value={num("depth", 0.75)} min={0} max={1} step={0.01} valueText={percentText(num("depth", 0.75))} onChange={(depth) => set("depth", depth)} />
                        <Knob label={t("sound.designer.params.wahResponse")} value={num("response", 0.55)} min={0} max={1} step={0.01} valueText={percentText(num("response", 0.55))} onChange={(response) => set("response", response)} />
                    </>
                )}
                {(block.type === "phaser" || block.type === "flanger") && (
                    <>
                        <Knob label={t("sound.designer.params.tremoloDepth")} value={num("depth", 0)} min={0} max={1} step={0.01} valueText={percentText(num("depth", 0))} onChange={(depth) => set("depth", depth)} />
                        <Knob
                            label={t("sound.designer.params.tremoloRate")}
                            value={num("rate", block.type === "phaser" ? 0.4 : 0.25)}
                            min={0.1}
                            max={block.type === "phaser" ? 4 : 5}
                            step={0.05}
                            valueText={`${num("rate", block.type === "phaser" ? 0.4 : 0.25)} Hz`}
                            onChange={(rate) => set("rate", rate)}
                        />
                    </>
                )}
                {block.type === "delay" && (
                    <>
                        <Knob label={t("sound.designer.params.delayMix")} value={num("mix", 0)} min={0} max={1} step={0.01} valueText={percentText(num("mix", 0))} onChange={(mix) => set("mix", mix)} />
                        <Knob label={t("sound.designer.params.delayTime")} value={num("time", 0.28)} min={0.05} max={1} step={0.01} valueText={`${Math.round(num("time", 0.28) * 1000)} ms`} onChange={(time) => set("time", time)} />
                        <Knob label={t("sound.designer.params.delayFeedback")} value={num("feedback", 0.35)} min={0} max={0.9} step={0.01} valueText={percentText(num("feedback", 0.35))} onChange={(feedback) => set("feedback", feedback)} />
                    </>
                )}
                {block.type === "reverb" && (
                    <>
                        <Knob label={t("sound.designer.params.reverbMix")} value={num("mix", 0)} min={0} max={1} step={0.01} valueText={percentText(num("mix", 0))} onChange={(mix) => set("mix", mix)} />
                        <Knob label={t("sound.designer.params.reverbDecay")} value={num("decay", 1.6)} min={0.3} max={5} step={0.1} valueText={`${num("decay", 1.6)} s`} onChange={(decay) => set("decay", decay)} />
                    </>
                )}
            </div>
            {block.type === "reverb" && (
                <GearGroup label={t("sound.studio.groups.reverb")}>
                    <GearCard
                        name={t("sound.designer.reverb.room")}
                        pressed={typeof block.params.irId !== "string"}
                        onClick={() => {
                            const next = { ...block.params };
                            delete next.irId;
                            onChange(next);
                        }}
                    />
                    {REVERB_IRS.map(([id, ir]) => (
                        <GearCard
                            key={id}
                            name={ir.label}
                            pressed={block.params.irId === id}
                            onClick={() => set("irId", id)}
                        />
                    ))}
                </GearGroup>
            )}
        </div>
    );
}
