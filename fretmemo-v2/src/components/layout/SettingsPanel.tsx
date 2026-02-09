import { useSettingsStore } from '@/stores/useSettingsStore';
import { useGameStore } from '@/stores/useGameStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    INSTRUMENT_LABELS,
    getDefaultTuningForInstrument,
    getTuningByPresetId,
    getTuningPresetId,
    getTuningPresetsForInstrument,
    normalizeInstrumentType,
    normalizeTuning
} from '@/lib/tuning';


export function SettingsPanel() {
    const full = useSettingsStore((state) => state.full);
    const quick = useSettingsStore((state) => state.quick);
    const updateQuickSettings = useSettingsStore((state) => state.updateQuickSettings);
    const updateFullSettings = useSettingsStore((state) => state.updateFullSettings);
    const bpm = useGameStore((state) => state.bpm);
    const setBpm = useGameStore((state) => state.setBpm);
    const isMetronomeArmed = useGameStore((state) => state.isMetronomeArmed);
    const toggleMetronome = useGameStore((state) => state.toggleMetronome);
    const selectedTuning = normalizeTuning(quick.tuning);
    const instrumentType = normalizeInstrumentType(full.instrument.type);
    const instrumentPresets = getTuningPresetsForInstrument(instrumentType);
    const selectedTuningPresetId = (() => {
        const presetId = getTuningPresetId(selectedTuning);
        return instrumentPresets.some((preset) => preset.id === presetId) ? presetId : 'custom';
    })();

    return (
        <div className="flex flex-col gap-6 py-4">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Quick Settings</h3>

                {/* Tempo */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label>Tempo ({bpm} BPM)</Label>
                    </div>
                    <Slider
                        value={[bpm]}
                        min={40}
                        max={240}
                        step={1}
                        onValueChange={(vals: number[]) => setBpm(vals[0])}

                    />
                </div>

                {/* Metronome Toggle */}
                <div className="flex items-center justify-between">
                    <Label htmlFor="metronome">Metronome</Label>
                    <Switch
                        id="metronome"
                        checked={isMetronomeArmed}
                        onCheckedChange={(checked: boolean) => {
                            if (checked !== isMetronomeArmed) {
                                toggleMetronome();
                            }
                        }}

                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="quick-instrument">Instrument</Label>
                    <select
                        id="quick-instrument"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={instrumentType}
                        onChange={(event) => {
                            const nextType = normalizeInstrumentType(event.target.value);
                            updateFullSettings({
                                instrument: {
                                    ...full.instrument,
                                    type: nextType,
                                }
                            });
                            updateQuickSettings({ tuning: getDefaultTuningForInstrument(nextType) });
                        }}
                    >
                        {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="quick-tuning">Tuning</Label>
                    <select
                        id="quick-tuning"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={selectedTuningPresetId}
                        onChange={(event) => {
                            const presetId = event.target.value;
                            if (presetId === 'custom') return;
                            updateQuickSettings({ tuning: getTuningByPresetId(presetId) });
                        }}
                    >
                        {instrumentPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label}
                            </option>
                        ))}
                        <option value="custom">Custom</option>
                    </select>
                </div>
            </div>

            <hr className="border-muted" />

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Preferences</h3>

                {/* Sound Volume */}
                <div className="space-y-2">
                    <Label>Volume</Label>
                    <Slider
                        value={[full.audio.volume * 100]}
                        min={0}
                        max={100}
                        onValueChange={(vals) => updateFullSettings({
                            audio: { ...full.audio, volume: vals[0] / 100 }
                        })}
                    />
                </div>

                {/* Left Handed Mode */}
                <div className="flex items-center justify-between">
                    <Label htmlFor="left-handed">Left-Handed Mode</Label>
                    <Switch
                        id="left-handed"
                        checked={full.instrument.leftHanded}
                        onCheckedChange={(checked) => updateFullSettings({
                            instrument: { ...full.instrument, leftHanded: checked }
                        })}
                    />
                </div>
            </div>

            <div className="pt-4">
                <p className="text-xs text-muted-foreground text-center">
                    More settings available in full settings menu.
                </p>
            </div>
        </div>
    );
}
